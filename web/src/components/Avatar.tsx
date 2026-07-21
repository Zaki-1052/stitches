// web/src/components/Avatar.tsx — the initials-fallback avatar circle (lilac patch), extracted
// from AppHeader now that friends' faces appear in the feed and on shared details. Loads the
// 100x100 thumb (SPEC §8: lists never load originals; declared in the 4.1 users migration).
// Accepts null/undefined so callers can pass pb's nullable AuthRecord or an expand straight
// through; sizing is className-driven so one component fits the header, feed, and chip.
import { thumbUrl } from '../lib/files.ts'

// name/avatar are optional because the SDK's RecordModel declares neither — it carries them
// behind an index signature; the fallback handles their absence either way.
type AvatarUser = { id: string; name?: string; avatar?: string } | null | undefined

export function Avatar({
  user,
  className = 'size-11',
  initialClassName = 'text-lg',
}: {
  user: AvatarUser
  className?: string
  initialClassName?: string
}) {
  const initial = (user?.name ?? '').trim().charAt(0).toUpperCase() || '♡'
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      style={{ background: 'var(--patch-lilac-soft)' }}
    >
      {user?.avatar ? (
        <img
          src={thumbUrl(user, user.avatar, 'chip')}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <span
          className={`font-display font-bold ${initialClassName}`}
          style={{ color: 'var(--patch-lilac-deep)' }}
        >
          {initial}
        </span>
      )}
    </span>
  )
}
