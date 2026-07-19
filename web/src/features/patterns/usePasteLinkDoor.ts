// web/src/features/patterns/usePasteLinkDoor.ts — the "Paste a link" door's clipboard logic,
// shared by the dock ➕ QuickAddSheet and Home's doors row (SPEC §10 frontend flow). This hook
// owns what is paste-specific — the synchronous iOS clipboard gesture, URL sanitizing, and the
// inline door errors — and hands the sanitized URL to useUrlImport, the generic pipeline it
// shares with the Ravelry search screen (extract → image → pre-filled save form, soft-fail all
// the way down). Only a clipboard that holds no usable link stays on the door as an inline
// error; manual entry is never blocked.
import { useCallback, useRef, useState } from 'react'
import { useUrlImport } from './useUrlImport.ts'

const MSG_NO_CLIPBOARD = "Pasting isn't available here — the Type-it-in door still works."
const MSG_PASTE_DENIED = "Stitches wasn't allowed to peek at your clipboard — tap Paste when iOS asks."
const MSG_EMPTY = 'Nothing to paste yet — copy a pattern link first.'
const MSG_NOT_A_LINK = "That doesn't look like a link — copy the page's address and try again."
const MSG_RATE_LIMITED = "That's a lot of imports at once. Give it a minute, then try again."

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

export function usePasteLinkDoor(onDone?: () => void) {
  const { run: runImport } = useUrlImport(onDone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)

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

    // Rate-limited is retryable: stay on the door (the clipboard still holds the link) and say
    // why, instead of opening a near-blank form (DECISIONS 2026-07-19).
    if ((await runImport(url)) === 'rate_limited') setError(MSG_RATE_LIMITED)
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
