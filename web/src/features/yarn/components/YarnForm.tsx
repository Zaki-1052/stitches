// web/src/features/yarn/components/YarnForm.tsx — the stash's save form (ADDONS §2.3), a
// trimmed PatternForm mirror: basics, the skein numbers, notes, photos (≤6), sticky Save bar.
// Owns RHF + zod and the photo state (kept OUT of zod — zodResolver adopts the parsed output
// and z.object() strips unknown keys, which would silently drop File state on revalidation).
// Visibility is deliberately absent from the form: the detail page's toggle owns it, per the
// patterns precedent, and the schema default keeps new yarn private.
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { thumbUrl } from '../../../lib/files.ts'
import { YARN_WEIGHTS, yarnFormSchema } from '../../../lib/schema.ts'
import type { YarnFormValues, YarnRecord } from '../../../lib/schema.ts'
import { CYC_LABELS } from '../../../lib/cyc.ts'
import { applyFieldErrors, normalizePbError } from '../../shared/errors.ts'
import { useToast } from '../../shared/toast.tsx'
import { useRevokeOnUnmount } from '../../shared/useRevokeOnUnmount.ts'
import type { PhotosState } from '../../patterns/formData.ts'
import { LazyNotesEditor as NotesEditor } from '../../patterns/components/LazyNotesEditor.tsx'
import { PhotosField } from '../../patterns/components/PhotosField.tsx'
import { SaveBar } from '../../patterns/components/SaveBar.tsx'

const FORM_FIELDS = Object.keys(yarnFormSchema.shape)

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="text-error text-sm">{error}</span>}
    </label>
  )
}

export function YarnForm({
  defaultValues,
  record,
  onSubmit,
  onCancel,
}: {
  defaultValues: YarnFormValues
  record?: YarnRecord
  onSubmit: (values: YarnFormValues, photos: PhotosState) => Promise<void>
  onCancel: () => void
}) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<YarnFormValues>({ resolver: zodResolver(yarnFormSchema), defaultValues })

  const [photos, setPhotos] = useState<PhotosState>({
    existing: record?.photos ?? [],
    removed: [],
    added: [],
  })
  const [photosBusy, setPhotosBusy] = useState(false)

  useRevokeOnUnmount(() => photos.added.map((image) => image.previewUrl))

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values, photos)
    } catch (err) {
      const normalized = normalizePbError(err)
      if (!applyFieldErrors(normalized, setError, FORM_FIELDS)) toast(normalized.message, 'error')
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6 px-5 pb-2">
      <section className="flex flex-col gap-4">
        <Field label="Name" error={errors.name?.message}>
          <input
            type="text"
            placeholder="Softee Chunky"
            className="input input-lg w-full"
            {...register('name')}
          />
        </Field>

        <Field label="Brand" error={errors.brand?.message}>
          <input type="text" className="input input-lg w-full" {...register('brand')} />
        </Field>

        <Field label="Colorway" error={errors.colorway?.message}>
          <input type="text" className="input input-lg w-full" {...register('colorway')} />
        </Field>

        <Field label="Weight" error={errors.weight?.message}>
          <select className="select select-lg w-full" {...register('weight')}>
            <option value="">not sure yet</option>
            {YARN_WEIGHTS.map((weight) => (
              <option key={weight} value={weight}>
                {CYC_LABELS[weight]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fiber" error={errors.fiber?.message}>
          <input
            type="text"
            placeholder="80% acrylic, 20% wool"
            className="input input-lg w-full"
            {...register('fiber')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Yards per skein" error={errors.yardage_per_skein?.message}>
            <input
              type="text"
              inputMode="numeric"
              className="input input-lg w-full"
              {...register('yardage_per_skein')}
            />
          </Field>
          <Field label="Skeins" error={errors.skein_count?.message}>
            <input
              type="text"
              inputMode="numeric"
              className="input input-lg w-full"
              {...register('skein_count')}
            />
          </Field>
        </div>
      </section>

      {/* ---- Notes ---- */}
      <section className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Notes</span>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <NotesEditor value={field.value} onChange={field.onChange} />}
        />
      </section>

      {/* ---- Photos ---- */}
      <PhotosField
        photos={photos}
        onChange={setPhotos}
        onBusyChange={setPhotosBusy}
        urlFor={(filename) => (record ? thumbUrl(record, filename, 'grid') : '')}
        max={6}
        label="Photos"
      />

      <SaveBar saving={isSubmitting} disabled={photosBusy} onCancel={onCancel} label="Save yarn" />
    </form>
  )
}
