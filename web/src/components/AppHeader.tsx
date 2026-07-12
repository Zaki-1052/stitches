// web/src/components/AppHeader.tsx — home header: a warm greeting + avatar. The avatar is the
// entry point to Settings (DESIGN §8: settings live behind the avatar; there is no dock slot for
// them). Seeded users have no uploaded avatar, so we draw an initials placeholder. The top pads
// for the iOS status-bar safe area.
import { Link } from 'react-router'
import { pb } from '../lib/pb.ts'
import { useAuth } from '../lib/auth.tsx'

export function AppHeader() {
  const { user } = useAuth()
  const name = user?.name || 'friend'
  const initial = name.trim().charAt(0).toUpperCase() || '♡'
  const avatarUrl = user && user.avatar ? pb.files.getURL(user, user.avatar) : null

  return (
    <header
      className="flex items-center justify-between gap-3 px-5 pb-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          on the hook
        </p>
        <h1 className="truncate font-display text-2xl font-bold">hi, {name} ♡</h1>
      </div>

      <Link
        to="/settings"
        aria-label="Settings"
        className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full"
        style={{ background: 'var(--patch-lilac-soft)' }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span
            className="font-display text-lg font-bold"
            style={{ color: 'var(--patch-lilac-deep)' }}
          >
            {initial}
          </span>
        )}
      </Link>
    </header>
  )
}
