// web/src/components/AppHeader.tsx — the dock tabs' shared header. Route-aware (4.2, resolves
// the p04 flag): Home keeps the warm greeting (DESIGN §9 gives it to Home only); the other tabs
// get a compact lowercase wordmark-style title. The avatar stays on every variant — it is the
// only entry point to Settings (DESIGN §8: no dock slot for them). The top pads for the iOS
// status-bar safe area.
import { Link, useLocation } from 'react-router'
import { Avatar } from './Avatar.tsx'
import { useAuth } from '../lib/auth.tsx'

const PAGE_TITLES: Record<string, string> = {
  '/patterns': 'library',
  '/projects': 'projects',
  '/friends': 'friends',
}

export function AppHeader() {
  const { user } = useAuth()
  const location = useLocation()
  const name = user?.name || 'friend'
  const isHome = location.pathname === '/'
  const title = PAGE_TITLES[location.pathname]

  return (
    <header
      className="flex w-full items-center justify-between gap-3 px-5 pb-3 lg:mx-auto lg:max-w-[1080px]"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      {isHome ? (
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            on the hook
          </p>
          <h1 className="truncate font-display text-2xl font-bold">hi, {name} ♡</h1>
        </div>
      ) : (
        // /tokens (dev-only) has no entry here on purpose — it renders its own heading.
        <h1 className="min-w-0 truncate font-display text-xl font-bold">{title}</h1>
      )}

      <Link to="/settings" aria-label="Settings" className="shrink-0">
        <Avatar user={user} />
      </Link>
    </header>
  )
}
