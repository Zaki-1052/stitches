// web/src/features/patterns/formData.ts — the one create/edit body builder. PB has no schema
// defaults and distinguishes "clear this field" (key present, empty) from "leave it alone" (key
// absent), so every schema field is sent explicitly on both create and update:
//   - blank text/url/select → ''            (PB's clear signal)
//   - blank numbers        → '0'            (PB numbers have no NULL; the UI renders 0 as unset)
//   - tags []              → one empty append (clear ≠ omit)
// The two deliberate exceptions: `owner` is appended ONLY on create (createRule demands it;
// sending it on update would brush the OWNER_LOCK guard), and an untouched thumbnail's key is
// omitted so PB keeps the stored file.
import type { PatternFormValues } from '../../lib/schema.ts'
import type { ProcessedImage } from '../shared/imagePipeline.ts'

export type ThumbnailState =
  | { kind: 'unchanged' }
  | { kind: 'removed' }
  | { kind: 'new'; image: ProcessedImage }

export interface PhotosState {
  existing: string[]
  removed: string[]
  added: ProcessedImage[]
}

export interface PatternImages {
  thumbnail: ThumbnailState
  photos: PhotosState
}

export function buildPatternFormData(
  values: PatternFormValues,
  images: PatternImages,
  mode: 'create' | 'edit',
  ownerId: string,
): FormData {
  const fd = new FormData()
  if (mode === 'create') fd.append('owner', ownerId)

  fd.append('title', values.title)
  fd.append('designer', values.designer)
  fd.append('source_url', values.source_url)
  fd.append('source_name', values.source_name)
  fd.append('craft', values.craft)
  fd.append('yarn_weight', values.yarn_weight)
  fd.append('hook_mm', values.hook_mm || '0')
  fd.append('gauge', values.gauge)
  fd.append('yardage', values.yardage || '0')
  fd.append('yardage_max', values.yardage_max || '0')
  fd.append('difficulty', values.difficulty)
  fd.append('shelf', values.shelf)
  fd.append('visibility', values.visibility)
  fd.append('notes', values.notes)

  if (values.tags.length === 0) fd.append('tags', '')
  else for (const id of values.tags) fd.append('tags', id)

  if (images.thumbnail.kind === 'new') fd.append('thumbnail', images.thumbnail.image.file)
  else if (images.thumbnail.kind === 'removed') fd.append('thumbnail', '')

  const photosKey = mode === 'edit' ? 'photos+' : 'photos'
  for (const image of images.photos.added) fd.append(photosKey, image.file)
  if (mode === 'edit') for (const filename of images.photos.removed) fd.append('photos-', filename)

  return fd
}
