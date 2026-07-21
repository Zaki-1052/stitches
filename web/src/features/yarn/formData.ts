// web/src/features/yarn/formData.ts — the one create/edit body builder for yarns, mirroring
// patterns/formData.ts: PB distinguishes "clear this field" (key present, empty) from "leave it
// alone" (key absent), so every schema field is sent explicitly — blank text/select → '', blank
// numbers → '0', `owner` on create only. No thumbnail handling: cards render photos[0].
import type { YarnFormValues } from '../../lib/schema.ts'
import type { PhotosState } from '../patterns/formData.ts'

export function buildYarnFormData(
  values: YarnFormValues,
  photos: PhotosState,
  mode: 'create' | 'edit',
  ownerId: string,
): FormData {
  const fd = new FormData()
  if (mode === 'create') fd.append('owner', ownerId)

  fd.append('name', values.name)
  fd.append('brand', values.brand)
  fd.append('colorway', values.colorway)
  fd.append('weight', values.weight)
  fd.append('fiber', values.fiber)
  fd.append('yardage_per_skein', values.yardage_per_skein || '0')
  fd.append('skein_count', values.skein_count || '0')
  fd.append('notes', values.notes)
  fd.append('visibility', values.visibility)

  const photosKey = mode === 'edit' ? 'photos+' : 'photos'
  for (const image of photos.added) fd.append(photosKey, image.file)
  if (mode === 'edit') for (const filename of photos.removed) fd.append('photos-', filename)

  return fd
}
