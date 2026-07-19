// importer/src/ravelry/client.ts — Basic-auth GETs against api.ravelry.com with the etiquette
// RAVELRY.md §10 asks for: the importer's User-Agent, an in-memory ETag cache (If-None-Match
// out, cached body back on 304, LRU-capped like auth.ts's token cache), and status+body logged
// on every non-200 — no silent failures. Plain fetch, NOT guardedFetch: the API host is a
// fixed developer-controlled constant (same trust class as auth.ts's PB call), not a
// user-supplied URL, and the SSRF pipeline's html|image contract doesn't fit JSON anyway.
import type { FastifyBaseLogger } from 'fastify'
import {
  FETCH_TIMEOUT_MS,
  RAVELRY_API_BASE,
  RAVELRY_BASIC,
  RAVELRY_BASIC_USER,
  RAVELRY_ETAG_CACHE_MAX_ENTRIES,
  RAVELRY_SEARCH_PAGE_SIZE,
  USER_AGENT,
} from '../config'
import type { RavelryPaginator, RavelryPatternFull, RavelrySearchListItem } from './types'

// Local, deliberately not HttpError: extract.ts catches it and falls through to the OG scrape,
// ravelrySearch.ts maps it to fetch_failed — the caller decides how a Ravelry failure surfaces.
export class RavelryApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'RavelryApiError'
    this.status = status
  }
}

interface CacheEntry {
  etag: string
  body: unknown
}

// URL → { etag, body }. Map preserves insertion order, so delete-then-set on every touch keeps
// true LRU ordering and evicting `keys().next()` drops the least-recently-used entry.
const cache = new Map<string, CacheEntry>()

function remember(key: string, entry: CacheEntry): void {
  cache.delete(key)
  if (cache.size >= RAVELRY_ETAG_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, entry)
}

const AUTH_HEADER = `Basic ${Buffer.from(`${RAVELRY_BASIC_USER}:${RAVELRY_BASIC}`).toString('base64')}`

async function ravelryGet(path: string, log: FastifyBaseLogger): Promise<unknown> {
  const url = `${RAVELRY_API_BASE}${path}`
  const cached = cache.get(url)

  const headers: Record<string, string> = {
    authorization: AUTH_HEADER,
    'user-agent': USER_AGENT,
    accept: 'application/json',
  }
  // Weak validators (W/"…") go back verbatim, prefix and quotes included (§9 #3).
  if (cached) headers['if-none-match'] = cached.etag

  let response: Response
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (error) {
    log.warn({ event: 'ravelry_unreachable', path, reason: String(error) }, 'could not reach the Ravelry API')
    throw new RavelryApiError(0, 'Could not reach Ravelry.')
  }

  if (response.status === 304 && cached) {
    remember(url, cached) // touch: a 304 is a hit, keep the entry warm
    return cached.body
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    log.warn(
      {
        event: 'ravelry_non_200',
        status: response.status,
        path,
        retryAfter: response.headers.get('retry-after'),
        body: body.slice(0, 500),
      },
      'Ravelry API returned a non-200',
    )
    throw new RavelryApiError(response.status, `Ravelry responded ${response.status}.`)
  }

  const body = (await response.json()) as unknown
  const etag = response.headers.get('etag')
  if (etag) remember(url, { etag, body })
  return body
}

export async function fetchRavelryPattern(permalink: string, log: FastifyBaseLogger): Promise<RavelryPatternFull> {
  const data = (await ravelryGet(`/patterns/${permalink}.json`, log)) as { pattern?: RavelryPatternFull }
  if (!data?.pattern) throw new RavelryApiError(0, 'Ravelry response had no pattern envelope.')
  return data.pattern
}

export async function fetchRavelrySearch(
  query: string,
  page: number,
  log: FastifyBaseLogger,
): Promise<{ patterns: RavelrySearchListItem[]; paginator: RavelryPaginator }> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    page_size: String(RAVELRY_SEARCH_PAGE_SIZE),
    craft: 'crochet',
  })
  const data = (await ravelryGet(`/patterns/search.json?${params}`, log)) as {
    patterns?: RavelrySearchListItem[]
    paginator?: Partial<RavelryPaginator>
  }
  if (!Array.isArray(data?.patterns) || !data.paginator) {
    throw new RavelryApiError(0, 'Ravelry search response had an unexpected shape.')
  }
  return {
    patterns: data.patterns,
    paginator: {
      page: data.paginator.page ?? page,
      page_count: data.paginator.page_count ?? 1,
      results: data.paginator.results ?? data.patterns.length,
    },
  }
}
