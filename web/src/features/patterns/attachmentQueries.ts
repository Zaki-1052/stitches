// web/src/features/patterns/attachmentQueries.ts — read side of the copyright vault (Session
// 1.3), same shape as queries.ts. No viewer scoping: the rules hide the whole collection from
// everyone but the owner, and the card only mounts for the owner anyway (UX sugar, SPEC §15).
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import type { AttachmentRecord } from '../../lib/schema.ts'

export const attachmentKeys = {
  all: ['pattern_attachments'] as const,
  forPattern: (patternId: string) => [...attachmentKeys.all, 'pattern', patternId] as const,
}

export function usePatternAttachments(patternId: string) {
  return useQuery({
    queryKey: attachmentKeys.forPattern(patternId),
    enabled: patternId !== '',
    queryFn: () =>
      pb.collection('pattern_attachments').getFullList<AttachmentRecord>({
        filter: pb.filter('pattern = {:id}', { id: patternId }),
        sort: '-created',
      }),
  })
}
