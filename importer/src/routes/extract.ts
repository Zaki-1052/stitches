// importer/src/routes/extract.ts — POST /import/extract (SPEC §10). Ravelry library URLs take
// the API branch (RAVELRY.md §4: permalink → patterns/{permalink}.json → Stitches vocabulary);
// ANY Ravelry failure — outage, 404, 429, mapping bug — logs why and falls through to the OG
// scrape, so the UX degrades to exactly today's behavior. Soft failure all the way down.
import type { FastifyRequest } from 'fastify'
import { HTML_MAX_BYTES } from '../config'
import { extractMetadata, type ExtractedMetadata } from '../extract/normalize'
import { guardedFetch } from '../net/guardedFetch'
import { parseTargetUrl } from '../net/parseTargetUrl'
import { fetchRavelryPattern } from '../ravelry/client'
import { matchRavelryPermalink } from '../ravelry/detect'
import { mapPatternToExtended } from '../ravelry/map'

export interface UrlBody {
  url: string
}

export async function extractHandler(
  request: FastifyRequest<{ Body: UrlBody }>,
): Promise<ExtractedMetadata> {
  const target = parseTargetUrl(request.body.url)

  const permalink = matchRavelryPermalink(target)
  if (permalink) {
    try {
      return mapPatternToExtended(await fetchRavelryPattern(permalink, request.log))
    } catch (error) {
      request.log.warn(
        { event: 'ravelry_fallthrough', permalink, reason: String(error) },
        'Ravelry enrichment failed, falling through to the OG scrape',
      )
    }
  }

  const { finalUrl, body } = await guardedFetch(target, {
    accept: 'text/html',
    maxBytes: HTML_MAX_BYTES,
  })
  return extractMetadata(body.toString('utf8'), target, finalUrl)
}
