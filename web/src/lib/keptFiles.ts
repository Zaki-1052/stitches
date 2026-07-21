// web/src/lib/keptFiles.ts — "Keep on this phone" vault storage (ADDONS §3.6): owner-scoped
// attachment blobs in their own idb-keyval store (a separate DB from the query-cache persist
// blob — megabyte binaries must not ride every cache rehydrate). Keys are
// `${ownerId}:${attachmentId}:${filename}`. The module follows outbox.ts's mold: init once
// from main.tsx, useSyncExternalStore bindings, identity-scoped cleanup on every auth change.
// Protected vault URLs stay NetworkOnly in the SW — kept files live ONLY here, owner-opted,
// per file; the §1 copyright posture is unchanged.
import { useSyncExternalStore } from 'react'
import { createStore, del, delMany, entries, keys, get, set } from 'idb-keyval'
import { pb } from './pb.ts'

// Verify-at-build #6 decision knob (ADDONS §3.6): if the phase-boundary device walk shows iOS
// Safari mishandling blob: PDFs opened via <a target="_blank">, flip to 'pdfjs' and build
// KeptPdfViewer on the existing pdfThumbnail.ts worker-loading idiom. Ships as 'link'.
export const KEPT_PDF_VIEW_MODE: 'link' | 'pdfjs' = 'link'

const store = createStore('stitches-kept-files', 'files')

let keptKeys: ReadonlySet<string> = new Set()
let keptSizes: ReadonlyMap<string, number> = new Map()
let totalBytes = 0
let initialized = false
let persistRequested = false

const listeners = new Set<() => void>()

function emit(): void {
  for (const cb of listeners) cb()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function keptFileKey(ownerId: string, attachmentId: string, filename: string): string {
  return `${ownerId}:${attachmentId}:${filename}`
}

// Re-derives the key set and the aggregate size from the store. Blob.size is metadata — no
// content is read here.
async function refresh(): Promise<void> {
  const all = await entries<string, Blob>(store)
  keptSizes = new Map(all.map(([key, blob]) => [String(key), blob.size]))
  keptKeys = new Set(keptSizes.keys())
  totalBytes = [...keptSizes.values()].reduce((sum, size) => sum + size, 0)
  emit()
}

// Called once from main.tsx at module scope (StrictMode doubles effects, not modules).
export async function initKeptFiles(): Promise<void> {
  if (initialized) return
  initialized = true
  await sweepForeign()
  // Logout and identity change share one code path: drop every key not scoped to the current
  // owner (the outbox onChange idiom).
  pb.authStore.onChange(() => void sweepForeign())
}

async function sweepForeign(): Promise<void> {
  const ownerId = pb.authStore.record?.id ?? ''
  const allKeys = (await keys<string>(store)).map(String)
  const foreign = allKeys.filter((key) => ownerId === '' || !key.startsWith(`${ownerId}:`))
  if (foreign.length) await delMany(foreign, store)
  await refresh()
}

export function useKeptFileIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => keptKeys)
}

export function useKeptFileSizes(): ReadonlyMap<string, number> {
  return useSyncExternalStore(subscribe, () => keptSizes)
}

export function useKeptFilesSummary(): { count: number; totalBytes: number } {
  const kept = useSyncExternalStore(subscribe, () => keptKeys)
  const bytes = useSyncExternalStore(subscribe, () => totalBytes)
  return { count: kept.size, totalBytes: bytes }
}

export async function keepFile(
  ownerId: string,
  attachmentId: string,
  filename: string,
  blob: Blob,
): Promise<void> {
  // One-shot, feature-detected persistence request (ADDONS §3.6): iOS honors it unreliably
  // (verify-at-build #5), which is why the kept-files caption stays honest about eviction.
  if (!persistRequested) {
    persistRequested = true
    if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {})
  }
  await set(keptFileKey(ownerId, attachmentId, filename), blob, store)
  await refresh()
}

export async function unkeepFile(
  ownerId: string,
  attachmentId: string,
  filename: string,
): Promise<void> {
  await del(keptFileKey(ownerId, attachmentId, filename), store)
  await refresh()
}

export async function unkeepAllForAttachment(ownerId: string, attachmentId: string): Promise<void> {
  const prefix = `${ownerId}:${attachmentId}:`
  const allKeys = (await keys<string>(store)).map(String)
  const targets = allKeys.filter((key) => key.startsWith(prefix))
  if (targets.length) await delMany(targets, store)
  await refresh()
}

export async function clearAllKept(): Promise<void> {
  const allKeys = (await keys<string>(store)).map(String)
  if (allKeys.length) await delMany(allKeys, store)
  await refresh()
}

export function getKeptBlob(
  ownerId: string,
  attachmentId: string,
  filename: string,
): Promise<Blob | undefined> {
  return get<Blob>(keptFileKey(ownerId, attachmentId, filename), store)
}
