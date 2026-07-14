// importer/src/net/parseTargetUrl.ts — SSRF pipeline step 1 (SPEC §10): parse, allow only
// http/https, strip embedded credentials. Also exports the pieces guardedFetch re-runs on
// every redirect hop (where a violation is a blocked/failed hop, not a 400).
import { invalidUrl } from '../errors'

export function isAllowedScheme(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:'
}

export function stripCredentials(url: URL): void {
  url.username = ''
  url.password = ''
}

export function parseTargetUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw invalidUrl('That does not look like a URL.')
  }
  if (!isAllowedScheme(url)) throw invalidUrl('Only http and https URLs can be imported.')
  stripCredentials(url)
  return url
}
