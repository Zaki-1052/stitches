// web/src/features/patterns/components/VisibilityToggle.tsx — owner-only sharing switch on the
// pattern detail (DESIGN §9). Helper copy is verbatim and load-bearing: files (attachments) stay
// structurally owner-only no matter what this toggle says. An unset visibility reads as private
// (empty select never matches "friends" — DECISIONS 2026-07-11).
import type { Visibility } from '../../../lib/schema.ts'

export function VisibilityToggle({
  value,
  onChange,
  disabled,
}: {
  value: Visibility | ''
  onChange: (next: Visibility) => void
  disabled?: boolean
}) {
  const shared = value === 'friends'
  return (
    <div
      className="rounded-box flex flex-col gap-1.5 bg-base-100 p-4"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <label className="flex min-h-11 items-center justify-between gap-3">
        <span className="font-semibold">Shared with friends</span>
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={shared}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? 'friends' : 'private')}
        />
      </label>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        Friends can see this pattern's info and photos — never your files.
      </p>
    </div>
  )
}
