// importer/src/config.ts — env + every SPEC §10 constant, in one place.
export const PORT = Number(process.env.PORT ?? 8095)
export const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090'

export const TOKEN_CACHE_TTL_MS = 5 * 60_000
export const TOKEN_CACHE_MAX_ENTRIES = 500
export const PB_TIMEOUT_MS = 5_000

export const RATE_LIMIT_MAX = 20
export const RATE_LIMIT_WINDOW = '1 minute'

export const FETCH_TIMEOUT_MS = 8_000
export const MAX_REDIRECTS = 3
export const HTML_MAX_BYTES = 3_000_000
export const IMAGE_MAX_BYTES = 10_000_000
export const BODY_LIMIT_BYTES = 8 * 1024

export const USER_AGENT = 'StitchesImporter/1.0 (+https://github.com/Zaki-1052/stitches)'
