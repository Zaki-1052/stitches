// importer/src/net/guardedFetch.ts — SSRF pipeline step 3 (SPEC §10): manual redirects
// (≤3 hops, the guard re-run per hop), one 8 s budget across all hops, byte cap enforced
// while streaming, content-type required. Fetches go through undici's fetch with a per-hop
// Agent whose connect.lookup returns only the addresses ipGuard just validated — checked
// IP ≡ dialed IP, so a rebinding DNS server can't swap targets between check and connect.
// The hostname still flows to TLS, so SNI and certificate validation are untouched.
import type { LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { Agent, fetch as pinnedFetch } from 'undici'
import { FETCH_TIMEOUT_MS, MAX_REDIRECTS, USER_AGENT } from '../config'
import { blockedTarget, fetchFailed, HttpError } from '../errors'
import { resolveAndGuard } from './ipGuard'
import { isAllowedScheme, stripCredentials } from './parseTargetUrl'

export interface GuardedFetchOptions {
  accept: 'text/html' | 'image/*'
  maxBytes: number
}

export interface GuardedFetchResult {
  finalUrl: URL
  contentType: string
  body: Buffer
}

type UndiciResponse = Awaited<ReturnType<typeof pinnedFetch>>

function pinnedAgent(addresses: LookupAddress[]): Agent {
  const first = addresses[0]
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, addresses)
    else callback(null, first.address, first.family)
  }
  return new Agent({ connect: { lookup: pinnedLookup } })
}

async function discardBody(response: UndiciResponse): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // the response is being thrown away either way
  }
}

async function readCapped(
  response: UndiciResponse,
  maxBytes: number,
  hasTimedOut: () => boolean,
): Promise<Buffer> {
  if (!response.body) throw fetchFailed('The site sent an empty response.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          // already over budget; the error below is the real outcome
        }
        throw fetchFailed(`That page is bigger than ${Math.round(maxBytes / 1_000_000)} MB — refusing it.`)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (hasTimedOut()) throw fetchFailed('Fetching took longer than 8 s — gave up.')
    throw fetchFailed('The connection dropped while reading the response.')
  }
  return Buffer.concat(chunks)
}

export async function guardedFetch(target: URL, opts: GuardedFetchOptions): Promise<GuardedFetchResult> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, FETCH_TIMEOUT_MS)
  const agents: Agent[] = []

  try {
    let current = target
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const pinned = await resolveAndGuard(current)
      let agent: Agent | undefined
      if (pinned) {
        agent = pinnedAgent(pinned)
        agents.push(agent)
      }

      let response: UndiciResponse
      try {
        response = await pinnedFetch(current.href, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          dispatcher: agent,
          headers: { 'user-agent': USER_AGENT, accept: opts.accept },
        })
      } catch {
        if (timedOut) throw fetchFailed('Fetching took longer than 8 s — gave up.')
        throw fetchFailed(`Could not reach ${current.hostname}.`)
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await discardBody(response)
        if (!location) throw fetchFailed('The site redirected without saying where to.')
        let next: URL
        try {
          next = new URL(location, current)
        } catch {
          throw fetchFailed('The site redirected to an unparseable URL.')
        }
        if (!isAllowedScheme(next)) {
          throw blockedTarget(`Blocked redirect to a ${next.protocol.replace(':', '')} URL.`)
        }
        stripCredentials(next)
        current = next
        continue
      }

      if (!response.ok) {
        await discardBody(response)
        throw fetchFailed(`The site responded with ${response.status}.`)
      }

      const rawType = response.headers.get('content-type')
      const contentType = rawType?.split(';')[0]?.trim().toLowerCase() ?? ''
      const typeOk =
        opts.accept === 'text/html' ? contentType === 'text/html' : contentType.startsWith('image/')
      if (!typeOk) {
        await discardBody(response)
        throw fetchFailed(
          contentType
            ? `Expected ${opts.accept} but the site sent ${contentType}.`
            : 'The site did not say what kind of content it sent.',
        )
      }

      const body = await readCapped(response, opts.maxBytes, () => timedOut)
      return { finalUrl: current, contentType, body }
    }
    throw fetchFailed(`Gave up after ${MAX_REDIRECTS} redirects.`)
  } finally {
    clearTimeout(timer)
    await Promise.all(agents.map((agent) => agent.close().catch(() => undefined)))
  }
}
