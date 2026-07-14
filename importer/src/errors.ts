// importer/src/errors.ts — the one error type the app-level handler maps to responses.
// SPEC §10 contract: 400 invalid URL · 401 bad token · 403 blocked target · 422 fetch
// failed/not HTML · 429 rate limited (429 comes from @fastify/rate-limit, not from here).
export class HttpError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
  }
}

export const invalidUrl = (message: string): HttpError => new HttpError(400, 'invalid_url', message)
export const unauthorized = (message: string): HttpError => new HttpError(401, 'unauthorized', message)
export const blockedTarget = (message: string): HttpError => new HttpError(403, 'blocked_target', message)
export const fetchFailed = (message: string): HttpError => new HttpError(422, 'fetch_failed', message)
