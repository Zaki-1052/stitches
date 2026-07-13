// web/src/features/projects/components/ConfirmDeleteDialog.tsx — generic plain-language delete
// confirm (DESIGN §11: destructive flows stay plain), the DeleteFileDialog shell with the copy
// supplied by the caller. Used for project delete (the journal cascades) and entry delete.
import { useEffect, useRef } from 'react'

export function ConfirmDeleteDialog({
  open,
  title,
  body,
  confirmLabel,
  deleting,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
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
        <h3 className="font-display text-xl font-bold">{title}</h3>
        <p>{body}</p>
        <div className="flex gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error btn-lg flex-1"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" disabled={deleting}>
          close
        </button>
      </form>
    </dialog>
  )
}
