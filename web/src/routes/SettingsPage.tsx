// web/src/routes/SettingsPage.tsx — Settings (DESIGN §9), reached via the header avatar. A
// dockless pushed subpage: its own BackBar, no dock. Name/avatar, change password, counter
// preferences, sign out, version. Logout just clears the authStore — ProtectedRoute then
// redirects to /login declaratively.
import { BackBar } from '../components/BackBar.tsx'
import { pb } from '../lib/pb.ts'
import { ProfileCard } from '../features/settings/components/ProfileCard.tsx'
import { PasswordCard } from '../features/settings/components/PasswordCard.tsx'
import { CounterPrefsCard } from '../features/settings/components/CounterPrefsCard.tsx'
import { OfflineCard } from '../features/settings/components/OfflineCard.tsx'

export default function SettingsPage() {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar title="settings" />
      <div
        className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        <ProfileCard />
        <PasswordCard />
        <CounterPrefsCard />
        <OfflineCard />

        <button
          type="button"
          className="btn btn-outline btn-error btn-lg w-full"
          onClick={() => pb.authStore.clear()}
        >
          Log out
        </button>

        <p className="text-center text-xs" style={{ color: 'var(--ink-muted)' }}>
          stitches v{__APP_VERSION__} · made with ♡
        </p>
      </div>
    </div>
  )
}
