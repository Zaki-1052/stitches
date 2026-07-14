// web/src/features/counters/components/CounterSheet.tsx — create/edit a counter's metadata
// (DESIGN §8: sheets for counter editing). Draft state seeds when the sheet opens, like
// FilterSheet; plain component state, not RHF — three fields (EntryComposer precedent).
// Value is deliberately absent: it only ever moves through the outbox (edit-value lives on
// the surface). resets_with offers same-project siblings only — the client-enforced half of
// SPEC §7's link rule. Delete lives here too, behind the plain-language confirm.
import { useEffect, useRef, useState } from 'react'
import type { CounterRecord } from '../../../lib/schema.ts'
import { useToast } from '../../shared/toast.tsx'
import { normalizePbError } from '../../shared/errors.ts'
import { ConfirmDeleteDialog } from '../../projects/components/ConfirmDeleteDialog.tsx'
import { useCreateCounter, useDeleteCounter, useUpdateCounterMeta } from '../mutations.ts'

export function CounterSheet({
  open,
  projectId,
  counter,
  counters,
  onClose,
}: {
  open: boolean
  projectId: string
  counter: CounterRecord | null // null = create
  counters: readonly CounterRecord[]
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const toast = useToast()
  const createCounter = useCreateCounter()
  const updateMeta = useUpdateCounterMeta()
  const deleteCounter = useDeleteCounter()

  const [label, setLabel] = useState('')
  const [target, setTarget] = useState('')
  const [resetsWith, setResetsWith] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const siblings = counters.filter((c) => c.id !== counter?.id)
  const pending = createCounter.isPending || updateMeta.isPending

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setLabel(counter?.label ?? '')
      setTarget(counter && counter.target > 0 ? String(counter.target) : '')
      setResetsWith(counter?.resets_with ?? '')
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, counter])

  const save = async () => {
    const trimmed = label.trim()
    if (!trimmed || pending) return
    const body = {
      label: trimmed,
      target: target === '' ? 0 : Number(target),
      resets_with: resetsWith,
    }
    try {
      if (counter) await updateMeta.mutateAsync({ id: counter.id, body })
      else await createCounter.mutateAsync({ projectId, body })
      onClose()
    } catch (err) {
      toast(normalizePbError(err).message, 'error')
    }
  }

  const handleDelete = async () => {
    if (!counter) return
    try {
      await deleteCounter.mutateAsync({ id: counter.id, projectId })
      setConfirmOpen(false)
      onClose()
    } catch (err) {
      setConfirmOpen(false)
      toast(normalizePbError(err).message, 'error')
    }
  }

  return (
    <>
      <dialog ref={dialogRef} className="modal modal-bottom" onClose={onClose}>
        <div className="modal-box flex flex-col gap-4 bg-base-100">
          <div
            className="mx-auto h-1 w-10 rounded-full"
            style={{ background: 'var(--color-base-300)' }}
            aria-hidden="true"
          />
          <h3 className="font-display text-xl font-bold">
            {counter ? 'Edit counter' : 'New counter'}
          </h3>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold" style={{ color: 'var(--ink-muted)' }}>
              label
            </span>
            <input
              type="text"
              className="input input-lg w-full"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Rows"
              maxLength={60}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold" style={{ color: 'var(--ink-muted)' }}>
              target <span className="font-normal">· Optional — like 48</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              className="input input-lg w-full"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
            />
          </label>

          {siblings.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold" style={{ color: 'var(--ink-muted)' }}>
                resets when another counter counts up
              </span>
              <select
                className="select select-lg w-full"
                value={resetsWith}
                onChange={(e) => setResetsWith(e.target.value)}
              >
                <option value="">On its own</option>
                {siblings.map((sibling) => (
                  <option key={sibling.id} value={sibling.id}>
                    {sibling.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-3">
            <button type="button" className="btn btn-ghost btn-lg" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg flex-1"
              disabled={label.trim() === '' || pending}
              onClick={() => void save()}
            >
              {pending ? 'Saving…' : counter ? 'Save' : 'Add counter'}
            </button>
          </div>

          {counter && (
            <button
              type="button"
              className="btn btn-ghost btn-sm self-center"
              style={{ color: 'var(--color-error)' }}
              onClick={() => setConfirmOpen(true)}
            >
              Delete this counter
            </button>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="Close counter editor">close</button>
        </form>
      </dialog>

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete this counter?"
        body="Delete this counter? Its count goes with it."
        confirmLabel="Delete counter"
        deleting={deleteCounter.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
