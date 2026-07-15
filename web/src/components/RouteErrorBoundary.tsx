// web/src/components/RouteErrorBoundary.tsx — the app's first render-crash net (4.2). Mounted
// twice in main.tsx: at the router root (login + dockless pages, full-screen fallback) and
// inside AppShell's tab children, where it keeps the header and dock alive so navigation still
// works around a crashed tab body. Plain-language copy per DESIGN §11 (errors stay plain).
import { useRouteError } from 'react-router'

export function RouteErrorBoundary() {
  const error = useRouteError()
  // Surface loudly — this boundary must never swallow the underlying failure.
  console.error('[route-error]', error)

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-2xl font-bold">Dropped a stitch.</p>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        Something went wrong loading this screen.
      </p>
      <button type="button" className="btn btn-primary mt-2" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  )
}
