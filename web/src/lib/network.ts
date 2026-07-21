// web/src/lib/network.ts — live online/offline state (ADDONS §3.5). navigator.onLine is the
// browser's own (optimistic) signal; the header indicator ORs it with auth's `unverified` so a
// lying "online" with an unreachable server still reads as offline where it matters.
import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void): () => void {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}
