// web/src/features/patterns/usePasteLinkDoor.ts — the "Paste a link" door's read-and-extract
// logic, shared by the dock ➕ QuickAddSheet and Home's doors row (SPEC §10 frontend flow).
// Clipboard → importer /import/extract → pre-filled save form via pendingUrlImport; the
// og:image rides /import/image through the §8 pipeline into the thumbnail (soft-fail: the
// pattern just has no thumbnail). Extraction failure is soft too — the form opens with only
// the URL filled plus a gentle toast. Only a clipboard that holds no usable link stays on the
// door as an inline error; manual entry is never blocked.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../shared/toast.tsx'
import { processImage, revokePreview } from '../shared/imagePipeline.ts'
import type { ProcessedImage } from '../shared/imagePipeline.ts'
import { ImporterError, extractUrl, fetchImportImage } from './importerClient.ts'
import type { ExtractResult } from './importerClient.ts'
import { setPendingUrlImport } from './pendingUrlImport.ts'

const MSG_NO_CLIPBOARD = "Pasting isn't available here — the Type-it-in door still works."
const MSG_PASTE_DENIED = "Stitches wasn't allowed to peek at your clipboard — tap Paste when iOS asks."
const MSG_EMPTY = 'Nothing to paste yet — copy a pattern link first.'
const MSG_NOT_A_LINK = "That doesn't look like a link — copy the page's address and try again."
const MSG_SOFT_FAIL = "Couldn't read that page — the link is filled in for you."
const MSG_RATE_LIMITED = "That's a lot of imports at once — the link is filled in; give it a minute."
const MSG_IMAGE_SOFT_FAIL = "Couldn't fetch the picture — everything else made it."

// The importer's body schema caps url at 2048 chars; anything longer would 400 anyway.
const MAX_URL_LENGTH = 2048

// Clipboard text → a fetchable http(s) URL, or null if it isn't one. Scheme-less text like
// "www.example.com/pattern" gets an https:// prefix; anything with internal whitespace is
// prose, not a link.
function sanitizeUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text || /\s/.test(text) || text.length > MAX_URL_LENGTH) return null
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null // mailto:, data:…
    if (!url.hostname.includes('.')) return null // "hello" would otherwise parse
    return url.href
  } catch {
    return null
  }
}

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

export function usePasteLinkDoor(onDone?: () => void) {
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = async (read: Promise<string>) => {
    let raw: string
    try {
      raw = await read
    } catch {
      // iOS "Don't Allow" on the paste bubble → NotAllowedError.
      setError(MSG_PASTE_DENIED)
      return
    }

    const url = sanitizeUrl(raw)
    if (!url) {
      setError(raw.trim() ? MSG_NOT_A_LINK : MSG_EMPTY)
      return
    }

    let meta: ExtractResult | null = null
    let failCode = ''
    try {
      meta = await extractUrl(url)
    } catch (err) {
      // Every server failure (400/401/403/422/429/502/timeout) takes the same soft path.
      failCode = err instanceof ImporterError ? err.code : ''
      console.warn('[paste-link] extract soft-fail', err)
    }

    let thumbnail: ProcessedImage | null = null
    if (meta?.image) {
      try {
        thumbnail = await processImage(await fetchImportImage(meta.image))
      } catch (err) {
        // Unlike the file door, never rethrow: the user didn't pick this image. Covers 422
        // non-image, the 10 MB cap, 429 on the second request, SVGs failing createImageBitmap.
        console.warn('[paste-link] image soft-fail', err)
      }
    }

    // The flow can run ~25 s worst-case; if the door unmounted meanwhile, a late stash would
    // pre-fill the next visit and leak the preview URL — discard instead.
    if (!mountedRef.current) {
      if (thumbnail) revokePreview(thumbnail.previewUrl)
      return
    }

    if (meta) {
      const site = meta.site_name ?? hostLabel(meta.canonical_url ?? meta.source_url)
      setPendingUrlImport({
        defaults: {
          title: meta.title ?? '',
          designer: meta.author ?? '', // craft blogs put the designer in meta author
          source_url: meta.canonical_url ?? meta.source_url,
          source_name: site,
          notes: meta.description ? `<p>${escapeHtml(meta.description)}</p>` : '',
        },
        importedFrom: site,
        thumbnail,
      })
    } else {
      setPendingUrlImport({ defaults: { source_url: url }, importedFrom: null, thumbnail: null })
    }
    onDone?.()
    navigate('/patterns/new')
    if (!meta) toast(failCode === 'rate_limited' ? MSG_RATE_LIMITED : MSG_SOFT_FAIL, 'info')
    else if (meta.image && !thumbnail) toast(MSG_IMAGE_SOFT_FAIL, 'info')
  }

  const onPress = () => {
    if (busyRef.current) return // sync double-tap guard; state updates are async
    setError('')
    if (!navigator.clipboard?.readText) {
      setError(MSG_NO_CLIPBOARD)
      return
    }
    // MUST be called synchronously inside the tap gesture — iOS shows its paste bubble;
    // awaiting anything first kills the gesture.
    const read = navigator.clipboard.readText()
    busyRef.current = true
    setBusy(true)
    void run(read).finally(() => {
      busyRef.current = false
      setBusy(false)
    })
  }

  // Stable so the sheet's open/close effect can list it as a dependency.
  const clearError = useCallback(() => setError(''), [])

  return { busy, error, clearError, onPress }
}
