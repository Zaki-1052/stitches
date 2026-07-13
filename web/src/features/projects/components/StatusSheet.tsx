// web/src/features/projects/components/StatusSheet.tsx — the status-change bottom sheet
// (DESIGN §8). Unlike FilterSheet there is no draft/Apply: a status pick is a single complete
// intent, so a tap applies instantly (iOS action-sheet convention). Frogged is a reversible
// select, not a destructive action — no confirm, just its wry caption (DESIGN §11's whimsy
// budget grants frogged its one line). Tapping the current status simply closes.
import { useEffect, useRef } from 'react'
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../../../lib/schema.ts'
import type { ProjectStatus } from '../../../lib/schema.ts'
import { patchSwatch } from '../../shared/patchColors.ts'
import { STATUS_PATCH } from '../status.ts'

export function StatusSheet({
  open,
  current,
  pending,
  onPick,
  onClose,
}: {
  open: boolean
  current: ProjectStatus
  pending: boolean
  onPick: (next: ProjectStatus) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="modal modal-bottom" onClose={onClose}>
      <div className="modal-box flex flex-col gap-3 bg-base-100">
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'var(--color-base-300)' }}
          aria-hidden="true"
        />

        <div role="radiogroup" aria-label="Project status" className="flex flex-col gap-1">
          {PROJECT_STATUSES.map((status) => {
            const swatch = patchSwatch(STATUS_PATCH[status])
            const selected = status === current
            return (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => {
                  if (selected) onClose()
                  else onPick(status)
                }}
                className="flex min-h-12 items-center gap-3 rounded-full px-4 text-left"
                style={
                  selected
                    ? { background: swatch.soft, color: swatch.deep }
                    : { color: 'var(--color-base-content)' }
                }
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: swatch.core }}
                  aria-hidden="true"
                />
                <span className="flex flex-col py-2">
                  <span className="text-base font-semibold">{PROJECT_STATUS_LABELS[status]}</span>
                  {status === 'frogged' && (
                    <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                      rip-it happens
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close status picker">close</button>
      </form>
    </dialog>
  )
}
