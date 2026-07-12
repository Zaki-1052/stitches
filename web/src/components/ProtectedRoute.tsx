// web/src/components/ProtectedRoute.tsx — gates the authenticated app. While the boot-time
// authRefresh runs, show the yarn-ball splash; once settled, unauthenticated visitors are sent to
// /login. This is UX sugar — real enforcement is PocketBase API rules (SPEC §15).
import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../lib/auth.tsx'
import { YarnBall } from './YarnBall.tsx'

export function ProtectedRoute() {
  const { user, booting } = useAuth()

  if (booting) {
    return (
      <div className="grid min-h-dvh place-items-center bg-base-200">
        <YarnBall size={96} className="animate-pulse" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
