// importer/src/app.ts — buildApp(): the whole service minus listen(), so checks can use
// app.inject() without binding a port. Auth + rate limit live in one /import-prefixed
// encapsulated scope; nothing leaks to future sibling routes.
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { authHook } from './auth'
import { BODY_LIMIT_BYTES, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from './config'
import { HttpError } from './errors'
import { extractHandler, type UrlBody } from './routes/extract'
import { imageHandler } from './routes/image'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

const urlBodySchema = {
  type: 'object',
  required: ['url'],
  additionalProperties: false,
  properties: {
    url: { type: 'string', minLength: 1, maxLength: 2048 },
  },
} as const

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { redact: ['req.headers.authorization'] },
    bodyLimit: BODY_LIMIT_BYTES,
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message })
    }
    // Fastify 5 hands the error over as unknown; everything below is its own error shape.
    const fastifyError = (typeof error === 'object' && error !== null ? error : {}) as Partial<FastifyError>
    if (fastifyError.validation) {
      return reply.code(400).send({ error: 'invalid_body', message: 'Body must be {"url": "https://…"}.' })
    }
    if (fastifyError.statusCode === 429) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests — try again in a minute.' })
    }
    if (fastifyError.statusCode !== undefined && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
      // Fastify's own client errors: malformed JSON, body over bodyLimit, wrong media type…
      return reply.code(fastifyError.statusCode).send({ error: 'request_error', message: fastifyError.message ?? 'Bad request.' })
    }
    request.log.error({ err: error }, 'unhandled importer error')
    return reply.code(500).send({ error: 'internal_error', message: 'Something went wrong on our side.' })
  })

  await app.register(
    async (importScope) => {
      importScope.decorateRequest('userId', '')
      importScope.addHook('onRequest', authHook)
      // Registered after the auth hook on purpose (same-phase hooks run in registration
      // order): the key needs request.userId, and running at onRequest — not the README's
      // preHandler — means malformed-body 400s still count against the budget.
      await importScope.register(rateLimit, {
        hook: 'onRequest',
        max: RATE_LIMIT_MAX,
        timeWindow: RATE_LIMIT_WINDOW,
        keyGenerator: (request) => request.userId,
      })
      importScope.post<{ Body: UrlBody }>('/extract', { schema: { body: urlBodySchema } }, extractHandler)
      importScope.post<{ Body: UrlBody }>('/image', { schema: { body: urlBodySchema } }, imageHandler)
    },
    { prefix: '/import' },
  )

  return app
}
