// web/src/features/patterns/importerClient.ts — the web app's client for the importer sidecar
// (SPEC §10), reached same-origin via the /import proxy (Vite in dev, Nginx in prod). Plain
// fetch, NOT the PB SDK: the importer is a separate service that just happens to validate PB
// tokens, so the Authorization header is set by hand (raw token, no "Bearer").
import { pb } from '../../lib/pb.ts'

// The importer's own budget is 8 s per request; this catches a hung proxy so busy states
// always end.
const CLIENT_TIMEOUT_MS = 12_000

export class ImporterError extends Error {
  // invalid_url | invalid_body | unauthorized | blocked_target | fetch_failed | rate_limited
  // | internal_error, plus 'unreachable' for a dead importer / non-JSON proxy error.
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ImporterError'
    this.code = code
    this.status = status
  }
}

// POST /import/extract response (SPEC §10): all nullable except source_url; image is already
// absolute-resolved server-side; canonical_url falls back to the final post-redirect URL.
export interface ExtractResult {
  source_url: string
  canonical_url: string | null
  title: string | null
  description: string | null
  image: string | null
  site_name: string | null
  author: string | null
}

async function post(path: '/import/extract' | '/import/image', url: string): Promise<Response> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
  })
  if (!res.ok) {
    // A dead importer yields a non-JSON 502 from the proxy — parse defensively.
    let body: { error?: string; message?: string } | null = null
    try {
      body = (await res.json()) as { error?: string; message?: string }
    } catch {
      // non-JSON body
    }
    throw new ImporterError(
      body?.error ?? 'unreachable',
      body?.message ?? 'Importer unreachable',
      res.status,
    )
  }
  return res
}

export async function extractUrl(url: string): Promise<ExtractResult> {
  return (await post('/import/extract', url)).json() as Promise<ExtractResult>
}

// og:image bytes → a File the §8 pipeline can eat (the pipeline re-encodes and renames to
// .webp/.jpg anyway, so the name only matters for logs).
export async function fetchImportImage(url: string): Promise<File> {
  const res = await post('/import/image', url)
  const blob = await res.blob()
  const name = (() => {
    try {
      return new URL(url).pathname.split('/').filter(Boolean).pop() || 'imported-image'
    } catch {
      return 'imported-image'
    }
  })()
  return new File([blob], name, { type: blob.type })
}
