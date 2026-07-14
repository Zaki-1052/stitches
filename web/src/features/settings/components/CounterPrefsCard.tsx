// web/src/features/settings/components/CounterPrefsCard.tsx — the counter preferences card
// (DESIGN §9 Settings): wake-lock default, dim-mode memory, and the experimental haptic tick.
// All three are device-local prefs (lib/prefs.ts, SPEC §11 "remembered locally"), so toggles
// apply instantly — there is nothing to save. The counter surface reads the same store.
import { setPref, usePref } from '../../../lib/prefs.ts'
import type { Prefs } from '../../../lib/prefs.ts'

function PrefRow({
  name,
  title,
  caption,
}: {
  name: keyof Prefs
  title: string
  caption: string
}) {
  const value = usePref(name)
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-4">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {caption}
        </span>
      </span>
      <input
        type="checkbox"
        className="toggle toggle-primary shrink-0"
        checked={value}
        onChange={(e) => setPref(name, e.target.checked)}
      />
    </label>
  )
}

export function CounterPrefsCard() {
  return (
    <section
      className="rounded-box flex flex-col gap-4 bg-base-100 p-5"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <h2 className="font-display text-xl font-semibold lowercase">counter preferences</h2>
      <PrefRow
        name="counterWakeLock"
        title="Keep screen awake"
        caption="Keep the screen awake while counting."
      />
      <PrefRow
        name="counterDim"
        title="Moonlight mode"
        caption="Remember moonlight mode on the counter."
      />
      <PrefRow
        name="hapticTick"
        title="Haptic tick"
        caption="A tiny tick with every tap. Experimental — newer iPhones only."
      />
    </section>
  )
}
