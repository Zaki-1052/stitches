// importer/src/routes/ravelrySearch.ts — POST /import/ravelry/search (RAVELRY.md §5.1): proxy
// patterns/search.json with page_size=20 and craft=crochet fixed server-side, mapped to the
// Stitches result shape. Registered inside the /import scope, so PB-token auth and the
// per-user rate limit apply exactly like the other routes; a Ravelry-side failure (including
// its own 429) surfaces as the contract's 422 fetch_failed.
import type { FastifyRequest } from 'fastify'
import { fetchFailed } from '../errors'
import { RavelryApiError, fetchRavelrySearch } from '../ravelry/client'
import { mapSearchResult } from '../ravelry/map'
import type { RavelryPaginator, RavelrySearchResult } from '../ravelry/types'

export interface RavelrySearchBody {
  query: string
  page?: number
}

export interface RavelrySearchReply {
  results: RavelrySearchResult[]
  paginator: RavelryPaginator
}

export async function ravelrySearchHandler(
  request: FastifyRequest<{ Body: RavelrySearchBody }>,
): Promise<RavelrySearchReply> {
  try {
    const { patterns, paginator } = await fetchRavelrySearch(
      request.body.query,
      request.body.page ?? 1,
      request.log,
    )
    return {
      results: patterns
        .map(mapSearchResult)
        .filter((result): result is RavelrySearchResult => result !== null),
      paginator,
    }
  } catch (error) {
    if (error instanceof RavelryApiError) throw fetchFailed('Ravelry search failed.')
    throw error
  }
}
