// web/src/features/home/components/JournalQuickSheet.tsx — the hero's Journal action (DESIGN §9
// "quick entry", Zara's p08 pick): EntryComposer in a bottom sheet right on Home. The composer
// already owns the pipeline, mutation, invalidation, and its "Entry saved ♡" toast (which fires
// as the dialog closes, so the top layer never covers it). The composer mounts only while a
// project is set — closing unmounts it, so every open starts a fresh entry dated today.
import { useEffect, useRef } from 'react'
import type { ProjectRecord } from '../../../lib/schema.ts'
import { EntryComposer } from '../../projects/components/EntryComposer.tsx'

export function JournalQuickSheet({
  project,
  onClose,
}: {
  project: ProjectRecord | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = project !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog ref={dialogRef} className="modal modal-bottom" onClose={onClose}>
      {/* base-200 canvas so the composer card floats on cream, exactly like the project feed */}
      <div className="modal-box flex flex-col gap-3 bg-base-200 p-4">
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'var(--color-base-300)' }}
          aria-hidden="true"
        />
        {project && (
          <>
            <h2 className="truncate font-display text-xl font-semibold">
              journal · {project.name}
            </h2>
            <EntryComposer
              key={project.id}
              project={project}
              onDone={onClose}
              onCancel={onClose}
            />
          </>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close journal entry">close</button>
      </form>
    </dialog>
  )
}
