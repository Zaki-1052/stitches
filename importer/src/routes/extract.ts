// importer/src/routes/extract.ts — POST /import/extract (SPEC §10).
import type { FastifyRequest } from 'fastify'
import { HTML_MAX_BYTES } from '../config'
import { extractMetadata, type ExtractedMetadata } from '../extract/normalize'
import { guardedFetch } from '../net/guardedFetch'
import { parseTargetUrl } from '../net/parseTargetUrl'

export interface UrlBody {
  url: string
}

export async function extractHandler(
  request: FastifyRequest<{ Body: UrlBody }>,
): Promise<ExtractedMetadata> {
  const target = parseTargetUrl(request.body.url)
  const { finalUrl, body } = await guardedFetch(target, {
    accept: 'text/html',
    maxBytes: HTML_MAX_BYTES,
  })
  return extractMetadata(body.toString('utf8'), target, finalUrl)
}
