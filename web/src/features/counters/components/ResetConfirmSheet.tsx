// web/src/features/counters/components/ResetConfirmSheet.tsx — one small confirm before a
// reset (Zara's pick, p07 plan: a stray thumb must not wipe a 300-row count). A reset is
// routine, not destructive — primary blue, not error coral (DESIGN §3 reserves coral-deep
// for delete alone).
import { useEffect, useRef } from 'react'

export function ResetConfirmSheet({
  open,
  label,
  onConfirm,
  onClose,
}: {
  open: boolean
  label: string
  onConfirm: () => void
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
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
      <div className="modal-box flex flex-col gap-4 bg-base-100">
        <h3 className="font-display text-xl font-bold">Reset {label} to 0?</h3>
        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost btn-lg" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-lg flex-1" onClick={onConfirm}>
            Reset
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close reset confirm">close</button>
      </form>
    </dialog>
  )
}
