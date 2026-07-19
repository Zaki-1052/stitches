// importer/src/config.ts — env + every SPEC §10 constant, in one place.
export const PORT = Number(process.env.PORT ?? 8095)
export const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'

// Required at boot (RAVELRY.md §2; PLAN decision: fail fast, no half-configured state).
// Runs at import time so a missing var kills the process with one clear line, not a 401 storm.
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`importer: missing required env var ${name} (see .env.example / RAVELRY.md §2)`)
    process.exit(1)
  }
  return value
}
export const RAVELRY_BASIC_USER = requireEnv('RAVELRY_BASIC_USER')
export const RAVELRY_BASIC = requireEnv('RAVELRY_BASIC')

export const RAVELRY_API_BASE = 'https://api.ravelry.com'
export const RAVELRY_ETAG_CACHE_MAX_ENTRIES = 200
export const RAVELRY_SEARCH_PAGE_SIZE = 20

export const TOKEN_CACHE_TTL_MS = 5 * 60_000
export const TOKEN_CACHE_MAX_ENTRIES = 500
export const PB_TIMEOUT_MS = 5_000

// 40 since R2 (was 20, calibrated to paste-only flows): search browsing is chattier — 1 req
// per search/page, 2 more per picked card. Still a hard abuse cap on the fetch-proxy surface
// (DECISIONS 2026-07-19), just no longer one a human can graze in normal use.
export const RATE_LIMIT_MAX = 40
export const RATE_LIMIT_WINDOW = '1 minute'

export const FETCH_TIMEOUT_MS = 8_000
export const MAX_REDIRECTS = 3
export const HTML_MAX_BYTES = 3_000_000
export const IMAGE_MAX_BYTES = 10_000_000
export const BODY_LIMIT_BYTES = 8 * 1024

export const USER_AGENT = 'StitchesImporter/1.0 (+https://github.com/Zaki-1052/stitches)'
