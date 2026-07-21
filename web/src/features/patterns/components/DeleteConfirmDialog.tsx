// web/src/features/patterns/components/DeleteConfirmDialog.tsx — plain-language delete confirm
// (DESIGN §11: destructive flows stay plain; copy verbatim from DESIGN). When viewer-visible
// projects still link the pattern, the dialog becomes the blocked path — no dead delete attempt.
// (A friend's invisible private project can still block server-side; the page handles that 400.)
import { useEffect, useRef } from 'react'

export function DeleteConfirmDialog({
  open,
  linkedCount,
  deleting,
  onClose,
  onConfirm,
}: {
  open: boolean
  linkedCount: number
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

  const blocked = linkedCount > 0

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={onClose}>
      <div className="modal-box flex flex-col gap-4 bg-base-100">
        {blocked ? (
          <>
            <h3 className="font-display text-xl font-bold">Can't delete this yet</h3>
            <p>
              {linkedCount === 1
                ? 'A project still points to this pattern. Unlink it first.'
                : `${linkedCount} projects still point to this pattern. Unlink them first.`}
            </p>
            <button type="button" className="btn btn-lg" onClick={onClose}>
              Okay
            </button>
          </>
        ) : (
          <>
            <h3 className="font-display text-xl font-bold">Delete this pattern?</h3>
            <p>Delete this pattern and its attachments? This can't be undone.</p>
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
                {deleting ? 'Deleting…' : 'Delete pattern'}
              </button>
            </div>
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close" disabled={deleting}>
          close
        </button>
      </form>
    </dialog>
  )
}
