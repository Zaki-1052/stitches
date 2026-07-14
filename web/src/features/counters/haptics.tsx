// web/src/features/counters/haptics.tsx — the experimental haptic tick (Session 2.3, Zara's
// pick). iOS Safari has no Vibration API (SPEC §1), but since iOS 17.4 toggling a native
// <input type="checkbox" switch> plays the system haptic — an undocumented side effect, which
// is exactly why the pref ships default-off and the settings caption says "experimental".
// tick() must run synchronously inside the tap's own gesture handler; everywhere else (older
// iOS, Android, desktop) the click is a silent no-op. The element is visually hidden but NOT
// display:none — iOS skips fully hidden switches. React's JSX types don't know the `switch`
// attribute, so the ref callback sets it; leaving the checkbox uncontrolled lets clicks flip
// it natively.
import { useCallback, useRef } from 'react'
import { getPref } from '../../lib/prefs.ts'

export function useHapticTick(): { element: React.ReactNode; tick: () => void } {
  const ref = useRef<HTMLInputElement | null>(null)

  // getPref, not usePref: read the live value per tap without re-rendering the surface when
  // the toggle flips in another tab.
  const tick = useCallback(() => {
    if (!getPref('hapticTick')) return
    ref.current?.click()
  }, [])

  const element = (
    <input
      ref={(el) => {
        ref.current = el
        el?.setAttribute('switch', '')
      }}
      type="checkbox"
      tabIndex={-1}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 size-px opacity-0"
    />
  )

  return { element, tick }
}
