// web/src/features/patterns/attachmentMutations.ts — write side of the vault. One record per
// uploaded file, so deleting a file is deleting its record (no files+/files- bookkeeping);
// pattern_text saves resend the unchanged `pattern` relation, the update-rule path rules-check
// proves stays open (the :changed lock only trips on an actual re-parent).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import type { AttachmentRecord } from '../../lib/schema.ts'
import { attachmentKeys } from './attachmentQueries.ts'

// Client-side cap mirrors the field's 30 MB maxSize so an oversized pick fails fast with a
// clear message instead of a doomed multipart upload (PhotosField's cap-ahead-of-server idea).
export const MAX_ATTACHMENT_MB = 30
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024

export function useCreateAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: FormData) =>
      pb.collection('pattern_attachments').create<AttachmentRecord>(body),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.forPattern(created.pattern) })
    },
  })
}

export function useUpdateAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AttachmentRecord> }) =>
      pb.collection('pattern_attachments').update<AttachmentRecord>(id, body),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.forPattern(updated.pattern) })
    },
  })
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; pattern: string }) =>
      pb.collection('pattern_attachments').delete(id),
    onSuccess: (_ok, { pattern }) => {
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.forPattern(pattern) })
    },
  })
}
