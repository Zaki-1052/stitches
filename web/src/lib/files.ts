// web/src/lib/files.ts — the one thumb-URL builder (ADDONS §3.4). The service worker's
// CacheFirst rule matches EXACT URL strings, so every surface requesting a record image goes
// through this size map — and lib/sync.ts warms exactly these URLs, making offline cache hits
// true by construction rather than by coincidence. Deliberately NOT used for: original-size
// tap-throughs, token-gated vault URLs (features/shared/protectedFiles.ts), and the avatar
// editor's full-size preview (2026-07-14 deliberate exception).
import { pb } from './pb.ts'

export type ThumbContext = 'chip' | 'grid' | 'hero'

const THUMB_SIZE: Record<ThumbContext, string> = {
  chip: '100x100', // square crop: chips, avatars, list rows
  grid: '400x0', // card grids, photo strips, form previews
  hero: '800x0', // detail-page heroes
}

type FileRecord = Parameters<typeof pb.files.getURL>[0]

export function thumbUrl(record: FileRecord, filename: string, context: ThumbContext): string {
  return pb.files.getURL(record, filename, { thumb: THUMB_SIZE[context] })
}
