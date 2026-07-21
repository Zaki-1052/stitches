// web/src/components/AppHeader.tsx — the dock tabs' shared header. Route-aware (4.2, resolves
// the p04 flag): Home keeps the warm greeting (DESIGN §9 gives it to Home only); the other tabs
// get a compact lowercase wordmark-style title. The avatar stays on every variant — it is the
// only entry point to Settings (DESIGN §8: no dock slot for them). The top pads for the iOS
// status-bar safe area.
import { Link, useLocation } from 'react-router'
import { CloudOff } from 'lucide-react'
import { Avatar } from './Avatar.tsx'
import { useAuth } from '../lib/auth.tsx'
import { useOnlineStatus } from '../lib/network.ts'

const PAGE_TITLES: Record<string, string> = {
  '/patterns': 'library',
  '/yarn': 'library',
  '/projects': 'projects',
  '/friends': 'friends',
}

// ADDONS §3.5: shown when the browser says offline OR the boot authRefresh hasn't landed yet
// (auth's `unverified` — an "online" signal with an unreachable server is offline in practice).
function OfflineNote() {
  return (
    <p className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
      <CloudOff size={14} strokeWidth={2} aria-hidden="true" />
      Offline. Showing what's saved.
    </p>
  )
}

export function AppHeader() {
  const { user, unverified } = useAuth()
  const online = useOnlineStatus()
  const location = useLocation()
  const name = user?.name || 'friend'
  const isHome = location.pathname === '/'
  const title = PAGE_TITLES[location.pathname]
  const offline = !online || unverified

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
          {offline && <OfflineNote />}
        </div>
      ) : (
        // /tokens (dev-only) has no entry here on purpose — it renders its own heading.
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold">{title}</h1>
          {offline && <OfflineNote />}
        </div>
      )}

      <Link to="/settings" aria-label="Settings" className="shrink-0">
        <Avatar user={user} />
      </Link>
    </header>
  )
}
