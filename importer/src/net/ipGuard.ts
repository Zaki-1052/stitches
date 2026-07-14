// importer/src/net/ipGuard.ts — SSRF pipeline step 2 (SPEC §10): resolve DNS and reject
// private/reserved targets. Allow-only-'unicast' is deliberately stricter than the SPEC's
// enumerated deny-list (it also rejects unspecified/broadcast/multicast/reserved/…), and
// IPv4-mapped IPv6 is unwrapped so [::ffff:127.0.0.1] blocks as loopback — for the right
// reason — while a mapped public address still passes.
import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import ipaddr from 'ipaddr.js'
import { blockedTarget, fetchFailed } from '../errors'

function effectiveRange(parsed: ipaddr.IPv4 | ipaddr.IPv6): string {
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6
    if (v6.isIPv4MappedAddress()) return v6.toIPv4Address().range()
  }
  return parsed.range()
}

export function assertPublicAddress(address: string, context: string): void {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6
  try {
    parsed = ipaddr.parse(address)
  } catch {
    throw blockedTarget(`Blocked target: could not parse the address for ${context}.`)
  }
  const range = effectiveRange(parsed)
  if (range !== 'unicast') {
    throw blockedTarget(`Blocked target: ${context} is a ${range} address.`)
  }
}

// URL.hostname keeps IPv6 brackets ([::1]); WHATWG URL parsing has already canonicalized
// exotic IPv4 spellings (decimal/hex hosts) into dotted quads by the time we get here.
export function ipLiteralOf(hostname: string): string | null {
  const bare =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  return ipaddr.isValid(bare) ? bare : null
}

// Returns the addresses to pin the dial to, or null for an IP-literal host (dialing the
// literal itself — there is no DNS answer to rebind).
export async function resolveAndGuard(url: URL): Promise<LookupAddress[] | null> {
  const literal = ipLiteralOf(url.hostname)
  if (literal !== null) {
    assertPublicAddress(literal, url.hostname)
    return null
  }

  let addresses: LookupAddress[]
  try {
    addresses = await lookup(url.hostname, { all: true })
  } catch {
    throw fetchFailed(`Could not resolve ${url.hostname}.`)
  }
  if (addresses.length === 0) throw fetchFailed(`Could not resolve ${url.hostname}.`)

  // Every A and AAAA answer must pass — one private record poisons the whole set.
  for (const entry of addresses) {
    assertPublicAddress(entry.address, `${url.hostname} → ${entry.address}`)
  }
  return addresses
}
