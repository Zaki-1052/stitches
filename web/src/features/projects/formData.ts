// web/src/features/projects/formData.ts — create/edit body builders for projects and journal
// entries, following the patterns/formData.ts rules: every schema field sent explicitly (PB
// distinguishes clear-from-omit), blank numbers → '0', `owner` only on create. Deliberate
// omissions beyond that:
//   - projects: `summary` is NEVER sent — the pinned summary belongs to the detail page's
//     edit-in-place and a form save must not clobber it.
//   - entries on edit: `owner` and `project` are omitted (OWNER_LOCK and the `:changed = false`
//     re-parent lock would reject them anyway).
import type { ProjectFormValues } from '../../lib/schema.ts'
import { todayLocalISO, toPbDate } from '../../lib/dates.ts'
import type { PhotosState, ThumbnailState } from '../patterns/formData.ts'

export function buildProjectFormData(
  values: ProjectFormValues,
  cover: ThumbnailState,
  mode: 'create' | 'edit',
  ownerId: string,
): FormData {
  const fd = new FormData()
  if (mode === 'create') fd.append('owner', ownerId)

  fd.append('name', values.name)
  fd.append('pattern', values.pattern)
  fd.append('status', values.status)
  fd.append('started_on', toPbDate(values.started_on))
  // Saving a project as finished without a date backfills today (the status-sheet flip is the
  // usual path; this covers recording an already-finished make directly in the form).
  const finishedOn =
    values.status === 'finished' && !values.finished_on ? todayLocalISO() : values.finished_on
  fd.append('finished_on', toPbDate(finishedOn))
  fd.append('hook_mm', values.hook_mm || '0')
  fd.append('yarn_used', values.yarn_used)
  fd.append('visibility', values.visibility)

  if (cover.kind === 'new') fd.append('cover', cover.image.file)
  else if (cover.kind === 'removed') fd.append('cover', '')

  return fd
}

export function buildEntryFormData(
  input: { entryDate: string; body: string },
  photos: PhotosState,
  mode: 'create' | 'edit',
  ownerId: string,
  projectId: string,
): FormData {
  const fd = new FormData()
  if (mode === 'create') {
    fd.append('owner', ownerId)
    fd.append('project', projectId)
  }

  fd.append('entry_date', toPbDate(input.entryDate))
  fd.append('body', input.body)

  const photosKey = mode === 'edit' ? 'photos+' : 'photos'
  for (const image of photos.added) fd.append(photosKey, image.file)
  if (mode === 'edit') for (const filename of photos.removed) fd.append('photos-', filename)

  return fd
}
