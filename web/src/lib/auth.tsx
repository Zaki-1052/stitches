// web/src/lib/auth.tsx — auth context: bridges pb.authStore into React and runs the boot-time
// authRefresh (SPEC §9, hardened per ADDONS §3.1). A DEFINITIVE server rejection clears the
// store (the token truly is invalid) and ProtectedRoute redirects to /login; a network failure
// or abort keeps the stored session — offline reopen must not log anyone out — and marks the
// context `unverified` until a refresh lands for real (retried on `online` and on returning to
// the foreground). Real access control lives in PocketBase API rules — this is UX state only
// (SPEC §15).
import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ClientResponseError } from 'pocketbase'
import type { AuthRecord } from 'pocketbase'
import { pb } from './pb.ts'
import { triggerSync } from './sync.ts'

type AuthContextValue = { user: AuthRecord; booting: boolean; unverified: boolean }

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Mirror the PB auth store into React state via its onChange subscription. We can't feed
  // pb.authStore.record into useSyncExternalStore — its getter returns a fresh object each call,
  // which trips React's "getSnapshot should be cached" infinite loop on login. onChange only
  // fires on real store mutations (save/clear), so state updates exactly when auth changes.
  const [user, setUser] = useState<AuthRecord>(() => pb.authStore.record)
  const [booting, setBooting] = useState(() => pb.authStore.isValid)
  const [unverified, setUnverified] = useState(false)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => setUser(record))

    let disposed = false
    // Retries are gated to the unverified state: once a refresh has landed (or the store was
    // cleared), online/visibility events stop re-hitting the endpoint.
    let pendingRetry = false

    const refresh = () => {
      if (!pb.authStore.isValid) return
      pb.collection('users')
        .authRefresh()
        .then(() => {
          if (disposed) return
          pendingRetry = false
          setUnverified(false)
          // Boot-success sync trigger (ADDONS §3.3). Forced: the boot moment outranks the
          // min-interval gate; triggerSync's own inProgress guard dedupes.
          void triggerSync({ force: true })
        })
        .catch((err: unknown) => {
          if (disposed) return
          // Verified against pocketbase@0.27.0: a raw network TypeError arrives here wrapped as
          // ClientResponseError{status: 0, isAbort: false}; an auto-cancellation arrives with
          // isAbort true. Only a real HTTP answer (≥400, not an abort) invalidates the token.
          const definitelyInvalid =
            err instanceof ClientResponseError && err.status >= 400 && !err.isAbort
          if (definitelyInvalid) {
            pb.authStore.clear()
          } else {
            pendingRetry = true
            setUnverified(true)
          }
        })
        .finally(() => setBooting(false))
    }

    const retry = () => {
      if (pendingRetry) refresh()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') retry()
    }

    refresh()
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      unsubscribe()
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <AuthContext value={{ user, booting, unverified }}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its context
export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
