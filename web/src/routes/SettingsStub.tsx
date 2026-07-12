// web/src/routes/SettingsStub.tsx — Settings subpage stub, reached via the header avatar. This is
// the canonical "pushed subpage" pattern: its own in-app back affordance (BackBar), no dock. It
// hosts logout for now; full settings arrive in a later session. Logout just clears the authStore
// — ProtectedRoute then redirects to /login declaratively.
import { BackBar } from '../components/BackBar.tsx'
import { pb } from '../lib/pb.ts'
import { useAuth } from '../lib/auth.tsx'

export default function SettingsStub() {
  const { user } = useAuth()

  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar title="settings" />
      <div className="space-y-6 px-5 py-4">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Signed in as {user?.name || 'friend'}.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-error btn-lg w-full"
          onClick={() => pb.authStore.clear()}
        >
          Log out
        </button>
      </div>
    </div>
  )
}
