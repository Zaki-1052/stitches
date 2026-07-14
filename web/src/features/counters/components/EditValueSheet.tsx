// web/src/features/counters/components/EditValueSheet.tsx — the surface's "edit value" number
// input (DESIGN §10). Seeds from the folded display value on open, commits one `set` op
// through the caller. 16 px input font per the iOS focus-zoom rule; digits only.
import { useEffect, useRef, useState } from 'react'

export function EditValueSheet({
  open,
  label,
  current,
  onSet,
  onClose,
}: {
  open: boolean
  label: string
  current: number
  onSet: (value: number) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setDraft(String(current))
      dialog.showModal()
      inputRef.current?.focus()
      inputRef.current?.select()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, current])

  const commit = () => {
    onSet(Math.max(0, Number(draft || '0')))
    onClose()
  }

  return (
    <dialog ref={dialogRef} className="modal modal-bottom" onClose={onClose}>
      <form
        method="dialog"
        className="modal-box flex flex-col gap-4 bg-base-100"
        onSubmit={(e) => {
          e.preventDefault()
          commit()
        }}
      >
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'var(--color-base-300)' }}
          aria-hidden="true"
        />
        <h3 className="font-display text-xl font-bold">Set {label}</h3>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className="input input-lg w-full text-center font-display text-2xl font-bold tabular-nums"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          maxLength={6}
          aria-label={`New value for ${label}`}
        />
        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost btn-lg" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-lg flex-1">
            Set
          </button>
        </div>
      </form>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close value editor">close</button>
      </form>
    </dialog>
  )
}
