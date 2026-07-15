// web/src/components/AppHeader.tsx — home header: a warm greeting + avatar. The avatar is the
// entry point to Settings (DESIGN §8: settings live behind the avatar; there is no dock slot for
// them) and renders via the shared <Avatar> (initials placeholder for avatar-less users). The
// top pads for the iOS status-bar safe area.
import { Link } from 'react-router'
import { Avatar } from './Avatar.tsx'
import { useAuth } from '../lib/auth.tsx'

export function AppHeader() {
  const { user } = useAuth()
  const name = user?.name || 'friend'

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

      <Link to="/settings" aria-label="Settings" className="shrink-0">
        <Avatar user={user} />
      </Link>
    </header>
  )
}
