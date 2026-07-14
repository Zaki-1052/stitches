// web/src/features/counters/useWakeLock.ts — keep-awake for the counter screen (SPEC §11).
// The browser silently releases a wake lock whenever the tab hides, so re-acquiring on
// visibilitychange is what makes it survive a tab-away-and-back. Requests need a secure
// context (localhost dev, tailscale HTTPS on device) and can be refused by low-battery
// modes — refusals are logged, never fatal.
import { useEffect } from 'react'

export const wakeLockSupported = 'wakeLock' in navigator

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !wakeLockSupported) return
    let released = false
    let sentinel: WakeLockSentinel | null = null

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (released) {
          void lock.release() // effect cleaned up while the request was in flight
        } else {
          sentinel = lock
        }
      } catch (err) {
        console.warn('[wake-lock] request refused', err)
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [enabled])
}
