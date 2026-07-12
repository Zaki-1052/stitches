// web/src/features/shared/protectedFiles.ts — access to Protected files (SPEC §7: served only
// with a short-lived token; PB re-checks the view rule on every fetch, so a leaked URL is
// useless). The token is PREFETCHED into TanStack Query while a vault card is on screen, so
// "View" renders as a plain <a href> — a native link-follow, with no window.open() after an
// await for iOS Safari's popup heuristics to block.
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import type { AttachmentRecord } from '../../lib/schema.ts'

// PB file tokens are short-lived; refresh well inside their lifetime while a consumer is mounted.
const FILE_TOKEN_REFRESH_MS = 60_000

export function useFileToken(enabled: boolean) {
  return useQuery({
    queryKey: ['fileToken'],
    queryFn: () => pb.files.getToken(),
    enabled,
    staleTime: FILE_TOKEN_REFRESH_MS,
    refetchInterval: FILE_TOKEN_REFRESH_MS,
  })
}

// Only pattern_attachments carries Protected files; the SDK reads the record's collection
// fields (present on every PB response) at runtime, same as the public-file call sites.
export function protectedFileUrl(record: AttachmentRecord, filename: string, token: string): string {
  return pb.files.getURL(record, filename, { token })
}
