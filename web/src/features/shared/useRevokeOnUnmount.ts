// web/src/features/shared/useRevokeOnUnmount.ts — release image-preview object URLs when the
// component owning them unmounts (4.2, DECISIONS 2026-07-13 KNOWN DEFERRED: abandoning any
// photo form mid-edit leaked its previews). Explicit save/cancel revokes stay where they are —
// re-revoking is a silent no-op; this catches every other exit (backdrop-dismissed sheets,
// BackBar/browser-back, route remounts).
//
// The revoke is deferred one macrotask and canceled if setup runs again: StrictMode's dev-only
// fake unmount re-runs setup synchronously in the same commit, and a revoked URL cannot be
// re-minted for DOM the component still renders (e.g. a form seeded with a file-door preview).
import { useEffect, useRef } from 'react'
import { revokePreview } from './imagePipeline.ts'

export function useRevokeOnUnmount(getUrls: () => string[]) {
  const getUrlsRef = useRef(getUrls)
  useEffect(() => {
    getUrlsRef.current = getUrls
  })

  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (pendingRef.current !== null) {
      clearTimeout(pendingRef.current)
      pendingRef.current = null
    }
    return () => {
      const urls = getUrlsRef.current()
      if (urls.length === 0) return
      pendingRef.current = setTimeout(() => {
        for (const url of urls) revokePreview(url)
      }, 0)
    }
  }, [])
}
