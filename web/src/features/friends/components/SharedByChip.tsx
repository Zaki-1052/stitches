// web/src/features/friends/components/SharedByChip.tsx — owner attribution on read-only detail
// pages: a friend's face + "shared by {name}". Worded to avoid colliding with the pattern
// page's "by {designer}" line. Renders nothing until the owner expand arrives.
import { Avatar } from '../../../components/Avatar.tsx'
import type { UserRecord } from '../../../lib/schema.ts'

export function SharedByChip({ owner }: { owner?: UserRecord }) {
  if (!owner) return null
  return (
    <span
      className="inline-flex h-9 w-fit items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-semibold"
      style={{ background: 'var(--patch-lilac-soft)', color: 'var(--patch-lilac-deep)' }}
    >
      <Avatar user={owner} className="size-7" initialClassName="text-xs" />
      shared by {owner.name}
    </span>
  )
}
