// web/src/features/projects/components/SummaryCard.tsx — the pinned summary (SPEC decision log:
// summary is the *state* of a project; entries are the diary). Edited in place per the vault's
// typed-pattern precedent: display + pencil ⇄ NotesEditor + Save/Cancel, saving through the
// optimistic quick-update so the card answers instantly. Friends see the summary read-only;
// an empty summary renders nothing for them.
import { useState } from 'react'
import DOMPurify from 'dompurify'
import { Pencil, PenLine } from 'lucide-react'
import type { ProjectRecord } from '../../../lib/schema.ts'
import { useToast } from '../../shared/toast.tsx'
import { normalizePbError } from '../../shared/errors.ts'
import { LazyNotesEditor as NotesEditor } from '../../patterns/components/LazyNotesEditor.tsx'
import { useQuickUpdateProject } from '../mutations.ts'

export function SummaryCard({ project, isOwner }: { project: ProjectRecord; isOwner: boolean }) {
  const toast = useToast()
  const quickUpdate = useQuickUpdateProject()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!isOwner && !project.summary) return null

  const startEditing = () => {
    setDraft(project.summary)
    setEditing(true)
  }

  const save = async () => {
    try {
      await quickUpdate.mutateAsync({ id: project.id, body: { summary: draft } })
      setEditing(false)
      toast('Saved ♡', 'success')
    } catch (err) {
      toast(normalizePbError(err).message, 'error')
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between">
        <h2 className="font-display text-xl font-semibold">summary</h2>
        {isOwner && project.summary && !editing && (
          <button
            type="button"
            aria-label="Edit summary"
            className="btn btn-ghost btn-circle"
            onClick={startEditing}
          >
            <Pencil size={20} strokeWidth={2} />
          </button>
        )}
      </div>

      {editing ? (
        <>
          <NotesEditor value={draft} onChange={setDraft} ariaLabel="Summary" />
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(false)}
              disabled={quickUpdate.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={() => void save()}
              disabled={quickUpdate.isPending}
            >
              {quickUpdate.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      ) : project.summary ? (
        <div
          className="rich-text rounded-box bg-base-100 px-4 py-3"
          style={{ boxShadow: 'var(--shadow-soft)' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(project.summary) }}
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="rounded-box flex min-h-14 items-center justify-center gap-2 border-2 border-dashed text-sm font-semibold"
          style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
        >
          <PenLine size={20} strokeWidth={2} aria-hidden="true" />
          Pin a summary — where things stand
        </button>
      )}
    </section>
  )
}
