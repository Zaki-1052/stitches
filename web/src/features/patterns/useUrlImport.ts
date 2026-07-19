// web/src/features/patterns/useUrlImport.ts — the generic URL-import pipeline shared by the
// paste-a-link door and the Ravelry search screen: importer /import/extract → optional image
// through /import/image + the §8 pipeline → pendingUrlImport stash → /patterns/new. Failure
// semantics split by whether retrying helps (DECISIONS 2026-07-19):
//   - rate-limited extract → return 'rate_limited' WITHOUT navigating; the caller explains in
//     place and the user retries in a minute for the full prefill (a near-blank form with a
//     missable toast read as "broken");
//   - any other extraction failure → land on the form so manual entry is never blocked,
//     seeded with the caller's `seed` (search cards know title/designer) plus the URL + toast;
//   - image failure alone → no thumbnail + gentle toast, metadata intact.
// Callers own their busy/disabled UI state — the paste door needs busy to start at the
// clipboard read, before any URL exists.
//
// When the extract response carries a `ravelry` block (RAVELRY.md §4.3) the stash prefills the
// Details section, craft, and notes, and carries the provenance pair for the create body. The
// chip keeps reading "imported from ravelry.com" via the hostLabel fallback (site_name is null
// on Ravelry extracts by design), while source_name gets the friendlier "Ravelry".
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../shared/toast.tsx'
import { processImage, revokePreview } from '../shared/imagePipeline.ts'
import type { ProcessedImage } from '../shared/imagePipeline.ts'
import { ImporterError, extractUrl, fetchImportImage } from './importerClient.ts'
import type { ExtractResult } from './importerClient.ts'
import type { PatternFormValues } from '../../lib/schema.ts'
import { setPendingUrlImport } from './pendingUrlImport.ts'

const MSG_SOFT_FAIL = "Couldn't read that page — the link is filled in for you."
const MSG_IMAGE_SOFT_FAIL = "Couldn't fetch the picture — everything else made it."

// TipTap's value is an HTML string — plain scraped text must be escaped before wrapping.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// "https://www.ravelry.com/…" → "ravelry.com", for the chip and source_name fallbacks.
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// PB datetime shape ("YYYY-MM-DD HH:MM:SS.sssZ") — full moment, not date-only, so lib/dates.ts
// (deliberately date-only) doesn't apply.
function nowPbDateTime(): string {
  return new Date().toISOString().replace('T', ' ')
}

function buildDefaults(meta: ExtractResult, site: string): Partial<PatternFormValues> {
  const r = meta.ravelry ?? null
  return {
    title: meta.title ?? '',
    designer: meta.author ?? '', // craft blogs put the designer in meta author
    source_url: meta.canonical_url ?? meta.source_url,
    source_name: r ? 'Ravelry' : site,
    notes: r?.notes_html
      ? r.notes_html
      : meta.description
        ? `<p>${escapeHtml(meta.description)}</p>`
        : '',
    ...(r?.craft ? { craft: r.craft } : {}),
    ...(r
      ? {
          yarn_weight: r.yarn_weight ?? '',
          hook_mm: r.hook_mm != null ? String(r.hook_mm) : '',
          gauge: r.gauge ?? '',
          yardage: r.yardage != null ? String(r.yardage) : '',
          yardage_max: r.yardage_max != null ? String(r.yardage_max) : '',
          difficulty: r.difficulty ?? '',
        }
      : {}),
  }
}

// 'navigated' = the form opened (rich, seeded, or URL-only); 'rate_limited' = nothing
// happened on purpose — the caller tells the user to wait a minute and retry.
export type UrlImportOutcome = 'navigated' | 'rate_limited'

export function useUrlImport(onDone?: () => void) {
  const navigate = useNavigate()
  const toast = useToast()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = async (url: string, seed?: Partial<PatternFormValues>): Promise<UrlImportOutcome> => {
    let meta: ExtractResult | null = null
    let rateLimited = false
    try {
      meta = await extractUrl(url)
    } catch (err) {
      // Every other server failure (400/401/403/422/502/timeout) takes the same soft path —
      // retrying wouldn't help, so the form still opens.
      rateLimited = err instanceof ImporterError && err.code === 'rate_limited'
      console.warn('[url-import] extract soft-fail', err)
    }

    // Retryable by waiting: don't stash, don't navigate — the caller's surface (door error /
    // toast) explains, and the user's clipboard or search card is still right there.
    if (rateLimited) return 'rate_limited'

    let thumbnail: ProcessedImage | null = null
    if (meta?.image) {
      try {
        thumbnail = await processImage(await fetchImportImage(meta.image))
      } catch (err) {
        // Unlike the file door, never rethrow: the user didn't pick this image. Covers 422
        // non-image, the 10 MB cap, 429 on the second request, SVGs failing createImageBitmap.
        console.warn('[url-import] image soft-fail', err)
      }
    }

    // The flow can run ~25 s worst-case; if the caller unmounted meanwhile, a late stash would
    // pre-fill the next visit and leak the preview URL — discard instead.
    if (!mountedRef.current) {
      if (thumbnail) revokePreview(thumbnail.previewUrl)
      return 'navigated'
    }

    if (meta) {
      const site = meta.site_name ?? hostLabel(meta.canonical_url ?? meta.source_url)
      const r = meta.ravelry ?? null
      setPendingUrlImport({
        defaults: buildDefaults(meta, site),
        importedFrom: site,
        thumbnail,
        ravelryProvenance: r ? { id: r.pattern_id, fetchedAt: nowPbDateTime() } : null,
      })
    } else {
      setPendingUrlImport({
        defaults: { ...(seed ?? {}), source_url: url },
        importedFrom: null,
        thumbnail: null,
        ravelryProvenance: null,
      })
    }
    onDone?.()
    navigate('/patterns/new')
    if (!meta) toast(MSG_SOFT_FAIL, 'info')
    else if (meta.image && !thumbnail) toast(MSG_IMAGE_SOFT_FAIL, 'info')
    return 'navigated'
  }

  return { run }
}
