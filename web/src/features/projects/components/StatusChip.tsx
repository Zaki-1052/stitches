// web/src/features/projects/components/StatusChip.tsx — the status pill (colors: status.ts).
// Soft fill + deep text (chip anatomy). Renders as a button (with a chevron hint) when the
// owner can open the status sheet.
import { ChevronDown } from 'lucide-react'
import { PROJECT_STATUS_LABELS } from '../../../lib/schema.ts'
import type { ProjectStatus } from '../../../lib/schema.ts'
import { patchSwatch } from '../../shared/patchColors.ts'
import { normalizeStatus, STATUS_PATCH } from '../status.ts'

export function StatusChip({
  status,
  onPress,
}: {
  status: ProjectStatus | ''
  onPress?: () => void
}) {
  const normalized = normalizeStatus(status)
  const swatch = patchSwatch(STATUS_PATCH[normalized])
  const label = PROJECT_STATUS_LABELS[normalized]
  const style = { background: swatch.soft, color: swatch.deep }

  if (!onPress) {
    return (
      <span
        className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold"
        style={style}
      >
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`Status: ${label}. Change status`}
      className="inline-flex h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold"
      style={style}
    >
      {label}
      <ChevronDown size={16} strokeWidth={2.5} aria-hidden="true" />
    </button>
  )
}
