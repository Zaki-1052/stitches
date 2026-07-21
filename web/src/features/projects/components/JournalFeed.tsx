// web/src/features/projects/components/JournalFeed.tsx — the diary (DESIGN §9): composer on
// top behind a stitch-border affordance, then entries grouped under date headers. The query
// sorts -entry_date,-created, so backdated entries land under their own day (an acceptance
// criterion); grouping here just walks the sorted list. The finished-photo prompt opens the
// composer from outside via composerOpen/onComposerOpenChange, and a ref scrolls it into view.
import { useEffect, useRef, useState } from 'react'
import type { JournalEntryRecord, ProjectRecord } from '../../../lib/schema.ts'
import { formatShortDate } from '../../../lib/dates.ts'
import { useToast } from '../../shared/toast.tsx'
import { normalizePbError } from '../../shared/errors.ts'
import { useJournalEntries } from '../queries.ts'
import { useDeleteEntry } from '../mutations.ts'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog.tsx'
import { EntryCard } from './EntryCard.tsx'
import { EntryComposer } from './EntryComposer.tsx'

interface DateGroup {
  date: string
  entries: JournalEntryRecord[]
}

function groupByDate(entries: JournalEntryRecord[]): DateGroup[] {
  const groups: DateGroup[] = []
  for (const entry of entries) {
    const date = entry.entry_date.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.entries.push(entry)
    else groups.push({ date, entries: [entry] })
  }
  return groups
}

export function JournalFeed({
  project,
  isOwner,
  composerOpen,
  onComposerOpenChange,
}: {
  project: ProjectRecord
  isOwner: boolean
  composerOpen: boolean
  onComposerOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  const entriesQuery = useJournalEntries(project.id)
  const deleteEntry = useDeleteEntry()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<JournalEntryRecord | null>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  // The finished prompt's "Add a photo" lands the user right on the composer.
  useEffect(() => {
    if (composerOpen) composerRef.current?.scrollIntoView({ block: 'center' })
  }, [composerOpen])

  const entries = entriesQuery.data ?? []
  const groups = groupByDate(entries)

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteEntry.mutateAsync({ id: deleteTarget.id, projectId: project.id })
      toast('Entry deleted.', 'success')
    } catch (err) {
      toast(normalizePbError(err).message, 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold">journal</h2>

      {isOwner && (
        <div ref={composerRef}>
          {composerOpen ? (
            <EntryComposer
              project={project}
              onDone={() => onComposerOpenChange(false)}
              onCancel={() => onComposerOpenChange(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => onComposerOpenChange(true)}
              className="rounded-box flex min-h-14 w-full items-center justify-center gap-2 border-2 border-dashed text-sm font-semibold"
              style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
            >
              Add an entry… 📷
            </button>
          )}
        </div>
      )}

      {entriesQuery.isPending ? (
        <div className="grid place-items-center py-6">
          <span className="loading loading-spinner" />
        </div>
      ) : entriesQuery.isError ? (
        <p className="text-error text-sm">The journal couldn't load. Try again in a moment?</p>
      ) : entries.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          No entries yet. This project's story starts here.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink-muted)' }}>
              {formatShortDate(group.date)}
            </h3>
            {group.entries.map((entry) =>
              editingId === entry.id ? (
                <EntryComposer
                  key={entry.id}
                  project={project}
                  entry={entry}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  isOwner={isOwner}
                  onEdit={() => setEditingId(entry.id)}
                  onDelete={() => setDeleteTarget(entry)}
                />
              ),
            )}
          </div>
        ))
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Delete this entry?"
        body={
          deleteTarget && deleteTarget.photos.length > 0
            ? "Delete this journal entry and its photos? This can't be undone."
            : "Delete this journal entry? This can't be undone."
        }
        confirmLabel="Delete entry"
        deleting={deleteEntry.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  )
}
