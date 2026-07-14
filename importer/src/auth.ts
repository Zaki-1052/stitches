// importer/src/auth.ts — every request forwards the caller's PocketBase token; we validate
// it against PB's auth-refresh (POST — SPEC §10 says GET, but PB's endpoint is POST) and
// cache successes ~5 min. The importer holds no admin credentials (SPEC §10).
import type { FastifyBaseLogger, FastifyRequest } from 'fastify'
import { PB_TIMEOUT_MS, PB_URL, TOKEN_CACHE_MAX_ENTRIES, TOKEN_CACHE_TTL_MS } from './config'
import { unauthorized } from './errors'

interface CacheEntry {
  userId: string
  expiresAt: number
}

// Successes only — a negative cache would lock a freshly logged-in user out for 5 minutes.
const cache = new Map<string, CacheEntry>()

function rememberToken(token: string, userId: string): void {
  if (cache.size >= TOKEN_CACHE_MAX_ENTRIES) {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key)
    }
    if (cache.size >= TOKEN_CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
  }
  cache.set(token, { userId, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS })
}

export async function verifyToken(token: string, log: FastifyBaseLogger): Promise<string> {
  const hit = cache.get(token)
  if (hit) {
    if (hit.expiresAt > Date.now()) return hit.userId
    cache.delete(token)
  }

  let response: Response
  try {
    response = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: { authorization: token },
      signal: AbortSignal.timeout(PB_TIMEOUT_MS),
    })
  } catch (error) {
    // Contract has no 5xx; 401 is the honest nearest code ("cannot confirm your token") —
    // the distinct event keeps a PB outage from reading as a bad-token storm in the logs.
    log.error({ event: 'pb_unreachable', reason: String(error) }, 'could not reach PocketBase to validate a token')
    throw unauthorized('Could not verify your session — try again in a moment.')
  }

  if (!response.ok) {
    log.info({ event: 'token_invalid', status: response.status }, 'PocketBase rejected a token')
    throw unauthorized('Your session is invalid or expired — log in again.')
  }

  const data = (await response.json()) as { record?: { id?: string } }
  const userId = data.record?.id
  if (!userId) throw unauthorized('Your session is invalid or expired — log in again.')

  rememberToken(token, userId)
  return userId
}

export async function authHook(request: FastifyRequest): Promise<void> {
  const token = request.headers.authorization
  if (!token) throw unauthorized('Missing Authorization header.')
  request.userId = await verifyToken(token, request.log)
}
