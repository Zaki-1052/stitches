// web/src/features/patterns/components/HookAliasReadout.tsx — live "5.0 mm · H-8" readout under
// the hook input (DESIGN §9). Silent while the field is empty or mid-typing-invalid; off-table
// sizes show plain mm with no guessed alias.
import { formatHook } from '../../../lib/hooks.ts'

export function HookAliasReadout({ value }: { value: string }) {
  const mm = Number(value)
  if (!value || Number.isNaN(mm) || mm <= 0) return null
  return (
    <span className="text-sm" style={{ color: 'var(--ink-muted)' }} aria-live="polite">
      {formatHook(mm)}
    </span>
  )
}
