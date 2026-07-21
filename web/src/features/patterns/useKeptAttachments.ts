// web/src/features/patterns/useKeptAttachments.ts — object URLs for kept vault files (ADDONS
// §3.6). Reconciles minted URLs against the kept-key set: mint on keep, revoke immediately on
// un-keep (useRevokeOnUnmount alone only covers the final unmount), and reuse across renders so
// a mounted synchronous <a href> never flips mid-tap (the iOS popup-blocker rule).
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth.tsx'
import { getKeptBlob, keptFileKey, useKeptFileIds } from '../../lib/keptFiles.ts'
import { useRevokeOnUnmount } from '../shared/useRevokeOnUnmount.ts'
import type { AttachmentRecord } from '../../lib/schema.ts'

export function useKeptAttachments(records: AttachmentRecord[]): Record<string, string> {
  const { user } = useAuth()
  const ownerId = user?.id ?? ''
  const keptIds = useKeptFileIds()
  const [urls, setUrls] = useState<Record<string, string>>({})
  const urlsRef = useRef(urls)
  urlsRef.current = urls

  useEffect(() => {
    let cancelled = false

    const wanted = new Set<string>()
    for (const record of records) {
      for (const filename of record.files) {
        const key = keptFileKey(ownerId, record.id, filename)
        if (keptIds.has(key)) wanted.add(key)
      }
    }

    // Un-kept keys revoke immediately; surviving URLs are reused, never re-minted.
    const surviving: Record<string, string> = {}
    let changed = false
    for (const [key, url] of Object.entries(urlsRef.current)) {
      if (wanted.has(key)) {
        surviving[key] = url
      } else {
        URL.revokeObjectURL(url)
        changed = true
      }
    }

    const missing = [...wanted].filter((key) => !(key in surviving))
    if (missing.length === 0) {
      if (changed) setUrls(surviving)
      return
    }

    void (async () => {
      const minted: Record<string, string> = {}
      for (const key of missing) {
        // Filenames may themselves contain ':' — only the first two segments are structural.
        const [owner, attachmentId, ...rest] = key.split(':')
        const blob = await getKeptBlob(owner, attachmentId, rest.join(':'))
        if (blob) minted[key] = URL.createObjectURL(blob)
      }
      if (cancelled) {
        for (const url of Object.values(minted)) URL.revokeObjectURL(url)
        return
      }
      setUrls({ ...surviving, ...minted })
    })()

    return () => {
      cancelled = true
    }
  }, [records, keptIds, ownerId])

  useRevokeOnUnmount(() => Object.values(urlsRef.current))

  return urls
}
