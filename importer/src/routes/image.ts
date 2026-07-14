// importer/src/routes/image.ts — POST /import/image (SPEC §10): same guard pipeline,
// image/* only, ≤10 MB, bytes streamed back for the client to run the §8 pipeline on.
// Buffered rather than piped: the cap has to be enforced while reading anyway, ≤10 MB is
// nothing at four users, and failures stay clean JSON instead of half-sent streams.
import type { FastifyReply, FastifyRequest } from 'fastify'
import { IMAGE_MAX_BYTES } from '../config'
import { guardedFetch } from '../net/guardedFetch'
import { parseTargetUrl } from '../net/parseTargetUrl'
import type { UrlBody } from './extract'

export async function imageHandler(
  request: FastifyRequest<{ Body: UrlBody }>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const target = parseTargetUrl(request.body.url)
  const { contentType, body } = await guardedFetch(target, {
    accept: 'image/*',
    maxBytes: IMAGE_MAX_BYTES,
  })
  return reply.type(contentType).send(body)
}
