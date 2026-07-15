// web/src/components/AppShell.tsx — the authenticated app frame: header, scrollable content, and
// the bottom dock. Dock destinations (Home / Library / Projects / Friends) render through the
// <Outlet/>.
// The dock is position:fixed (daisyUI), so content reserves bottom padding to clear it plus the
// iOS home-indicator safe area.
import { Outlet } from 'react-router'
import { AppHeader } from './AppHeader.tsx'
import { Dock } from './Dock.tsx'

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-base-200 text-base-content">
      <AppHeader />
      <main className="flex-1" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>
      <Dock />
    </div>
  )
}
