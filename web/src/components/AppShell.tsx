// web/src/components/AppShell.tsx — the authenticated app frame: header, scrollable content, and
// navigation. Dock destinations (Home / Library / Projects / Friends) render through the
// <Outlet/>. On phones the dock is position:fixed (daisyUI), so content reserves bottom padding
// (.dock-space) to clear it plus the iOS home-indicator safe area. At lg+ the dock renders as a
// slim top bar in normal flow (DESIGN §5) and content centers in a 1080px column — <Dock/> sits
// above <main> in the DOM so the desktop variant lands at the visual top for free (harmless on
// mobile: fixed positioning ignores DOM order, and nav-before-content is friendlier tab order).
import { Outlet } from 'react-router'
import { AppHeader } from './AppHeader.tsx'
import { Dock } from './Dock.tsx'

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-base-200 text-base-content">
      <AppHeader />
      <Dock />
      <main className="dock-space w-full flex-1 lg:mx-auto lg:max-w-[1080px]">
        <Outlet />
      </main>
    </div>
  )
}
