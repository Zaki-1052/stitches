// web/src/features/projects/components/EntryComposer.tsx — one component writes and edits
// journal entries. Plain component state, no RHF/zod: both fields (a date and TipTap html) live
// outside RHF even in PatternForm, and the only validation is "say something" — an entry needs
// a body or a photo before Save enables. The editable date IS the backdating feature (SPEC §7).
// Edit mode omits owner/project keys (the rules' OWNER_LOCK and :changed re-parent lock).
import { useState } from 'react'
import { pb } from '../../../lib/pb.ts'
import { useAuth } from '../../../lib/auth.tsx'
import type { JournalEntryRecord, ProjectRecord } from '../../../lib/schema.ts'
import { todayLocalISO } from '../../../lib/dates.ts'
import { useToast } from '../../shared/toast.tsx'
import { normalizePbError } from '../../shared/errors.ts'
import { revokePreview } from '../../shared/imagePipeline.ts'
import { useRevokeOnUnmount } from '../../shared/useRevokeOnUnmount.ts'
import type { PhotosState } from '../../patterns/formData.ts'
import { LazyNotesEditor as NotesEditor } from '../../patterns/components/LazyNotesEditor.tsx'
import { PhotosField } from '../../patterns/components/PhotosField.tsx'
import { buildEntryFormData } from '../formData.ts'
import { useCreateEntry, useUpdateEntry } from '../mutations.ts'

const MAX_ENTRY_PHOTOS = 6

export function EntryComposer({
  project,
  entry,
  onDone,
  onCancel,
}: {
  project: ProjectRecord
  entry?: JournalEntryRecord
  onDone: () => void
  onCancel: () => void
}) {
  const toast = useToast()
  const { user } = useAuth()
  const createEntry = useCreateEntry()
  const updateEntry = useUpdateEntry()

  const [entryDate, setEntryDate] = useState(() =>
    entry ? entry.entry_date.slice(0, 10) : todayLocalISO(),
  )
  const [body, setBody] = useState(entry?.body ?? '')
  const [photos, setPhotos] = useState<PhotosState>({
    existing: entry?.photos ?? [],
    removed: [],
    added: [],
  })
  const [photosBusy, setPhotosBusy] = useState(false)

  // 4.2 (DECISIONS 2026-07-13 KNOWN DEFERRED): added-photo previews must be revoked however the
  // composer goes away — including a backdrop-dismissed sheet, which unmounts it without
  // touching Save/Cancel.
  useRevokeOnUnmount(() => photos.added.map((image) => image.previewUrl))

  const keptPhotos =
    photos.existing.length - photos.removed.length + photos.added.length
  const hasContent = body !== '' || keptPhotos > 0
  const saving = createEntry.isPending || updateEntry.isPending
  const canSave = hasContent && entryDate !== '' && !photosBusy && !saving

  const save = async () => {
    try {
      const fd = buildEntryFormData(
        { entryDate, body },
        photos,
        entry ? 'edit' : 'create',
        user?.id ?? '',
        project.id,
      )
      if (entry) await updateEntry.mutateAsync({ id: entry.id, projectId: project.id, body: fd })
      else await createEntry.mutateAsync({ projectId: project.id, body: fd })
      for (const image of photos.added) revokePreview(image.previewUrl)
      toast('Entry saved ♡', 'success')
      onDone()
    } catch (err) {
      toast(normalizePbError(err).message, 'error')
    }
  }

  const cancel = () => {
    for (const image of photos.added) revokePreview(image.previewUrl)
    onCancel()
  }

  return (
    <div
      className="rounded-box flex flex-col gap-4 bg-base-100 p-4"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Date</span>
        <input
          type="date"
          className="input input-lg w-full"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
        />
      </label>

      <NotesEditor value={body} onChange={setBody} ariaLabel="Journal entry" />

      <PhotosField
        photos={photos}
        onChange={setPhotos}
        onBusyChange={setPhotosBusy}
        urlFor={(filename) => (entry ? pb.files.getURL(entry, filename, { thumb: '400x0' }) : '')}
        max={MAX_ENTRY_PHOTOS}
        label="Photos"
      />

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={cancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary flex-1"
          onClick={() => void save()}
          disabled={!canSave}
        >
          {saving ? 'Saving…' : 'Save entry'}
        </button>
      </div>
    </div>
  )
}
