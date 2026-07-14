// importer/src/extract/normalize.ts — SSRF pipeline steps 4–5 (SPEC §10): hand the fetched
// HTML *string* to open-graph-scraper ({ html } input — OGS never fetches; all network
// stayed inside guardedFetch), then normalize to the contract shape. OGS returns raw meta
// content verbatim, so relative image/canonical URLs resolve against the FINAL (post-
// redirect) URL here.
import ogs from 'open-graph-scraper'
import { fetchFailed } from '../errors'

export interface ExtractedMetadata {
  source_url: string
  canonical_url: string | null
  title: string | null
  description: string | null
  image: string | null
  site_name: string | null
  author: string | null
}

type OgResult = Awaited<ReturnType<typeof ogs>>['result']

function textOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function resolveOrNull(candidate: string | undefined, base: URL): string | null {
  const trimmed = candidate?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed, base).href
  } catch {
    return null
  }
}

export async function extractMetadata(
  html: string,
  sourceUrl: URL,
  finalUrl: URL,
): Promise<ExtractedMetadata> {
  let result: OgResult
  try {
    const response = await ogs({ html })
    result = response.result
  } catch {
    // OGS rejects with a data object, not an Error — either way the page gave us nothing.
    throw fetchFailed('Could not read any metadata from that page.')
  }

  return {
    source_url: sourceUrl.href,
    canonical_url: resolveOrNull(result.ogUrl, finalUrl) ?? finalUrl.href,
    title: textOrNull(result.ogTitle),
    description: textOrNull(result.ogDescription),
    image: resolveOrNull(result.ogImage?.[0]?.url, finalUrl),
    site_name: textOrNull(result.ogSiteName),
    // Plain <meta name="author"> only — OGS tracks articleAuthor/bookAuthor separately and
    // conflating them surfaces publisher noise.
    author: textOrNull(result.author),
  }
}
