// web/src/features/projects/components/FinishedPromptDialog.tsx — after the confetti settles,
// offer a finished-photo journal entry (PLAN 2.1). "Not now" is a first-class answer. "Add a
// photo" opens the composer scrolled into view — deliberately NOT a programmatic file-input
// .click(), which iOS Safari drops when it arrives async after a state-driven mount; one honest
// extra tap on the photo tile is reliable.
import { useEffect, useRef } from 'react'
import { Camera } from 'lucide-react'

export function FinishedPromptDialog({
  open,
  onClose,
  onAddPhoto,
}: {
  open: boolean
  onClose: () => void
  onAddPhoto: () => void
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
        <h3 className="font-display text-xl font-bold">Finished! ☆</h3>
        <p>Add a finished photo to the journal?</p>
        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost btn-lg" onClick={onClose}>
            Not now
          </button>
          <button type="button" className="btn btn-primary btn-lg flex-1" onClick={onAddPhoto}>
            <Camera size={20} strokeWidth={2} aria-hidden="true" />
            Add a photo
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Not now">close</button>
      </form>
    </dialog>
  )
}
