// web/src/features/projects/components/StatusPill.tsx — the form-side status radiogroup,
// ShelfPill's anatomy with the DESIGN §3 status colors: color-dot-led chips, selected = patch
// soft fill + deep ink, unselected = quiet outline.
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../../../lib/schema.ts'
import type { ProjectStatus } from '../../../lib/schema.ts'
import { patchSwatch } from '../../shared/patchColors.ts'
import { STATUS_PATCH } from '../status.ts'

export function StatusPill({
  value,
  onChange,
  disabled,
}: {
  value: ProjectStatus
  onChange: (next: ProjectStatus) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
      {PROJECT_STATUSES.map((status) => {
        const swatch = patchSwatch(STATUS_PATCH[status])
        const selected = value === status
        const style = selected
          ? { background: swatch.soft, color: swatch.deep, borderColor: swatch.deep }
          : {
              background: 'var(--color-base-100)',
              color: 'var(--ink-muted)',
              borderColor: 'var(--color-base-300)',
            }
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(status)}
            className="flex h-11 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold"
            style={style}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: swatch.core }}
              aria-hidden="true"
            />
            {PROJECT_STATUS_LABELS[status]}
          </button>
        )
      })}
    </div>
  )
}
