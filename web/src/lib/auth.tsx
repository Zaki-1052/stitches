// web/src/lib/auth.tsx — auth context: bridges pb.authStore into React and runs the boot-time
// authRefresh (SPEC §9). On boot, a valid stored token is refreshed (silently extending the
// 90-day window); a failed refresh clears the store and ProtectedRoute redirects to /login.
// Real access control lives in PocketBase API rules — this is UX state only (SPEC §15).
import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthRecord } from 'pocketbase'
import { pb } from './pb.ts'

type AuthContextValue = { user: AuthRecord; booting: boolean }

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Mirror the PB auth store into React state via its onChange subscription. We can't feed
  // pb.authStore.record into useSyncExternalStore — its getter returns a fresh object each call,
  // which trips React's "getSnapshot should be cached" infinite loop on login. onChange only
  // fires on real store mutations (save/clear), so state updates exactly when auth changes.
  const [user, setUser] = useState<AuthRecord>(() => pb.authStore.record)
  const [booting, setBooting] = useState(() => pb.authStore.isValid)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => setUser(record))

    // Boot: refresh a stored token so the 90-day window silently extends; clear it on failure.
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setBooting(false))
    }

    return unsubscribe
  }, [])

  return <AuthContext value={{ user, booting }}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its context
export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
