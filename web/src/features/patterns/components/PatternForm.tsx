// web/src/features/patterns/components/PatternForm.tsx — the save form all three import doors
// land on (DESIGN §9): Basics open, Details collapsible, tags, source, notes, photos, sticky
// Save bar. Owns RHF + zod and the image-field state (kept OUT of zod: zodResolver adopts the
// parsed output and z.object() strips unknown keys, which would silently drop File state on
// revalidation). The page supplies submit/cancel; PB failures land inline per field when they
// can, otherwise as a toast (SPEC §12).
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pb } from '../../../lib/pb.ts'
import {
  CRAFTS,
  CRAFT_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  YARN_WEIGHTS,
  patternFormSchema,
} from '../../../lib/schema.ts'
import type { PatternFormValues, PatternRecord } from '../../../lib/schema.ts'
import { CYC_LABELS } from '../../../lib/cyc.ts'
import { applyFieldErrors, normalizePbError } from '../../shared/errors.ts'
import { useToast } from '../../shared/toast.tsx'
import type { PatternImages, PhotosState, ThumbnailState } from '../formData.ts'
import { HookAliasReadout } from './HookAliasReadout.tsx'
import { NotesEditor } from './NotesEditor.tsx'
import { PhotosField } from './PhotosField.tsx'
import { SaveBar } from './SaveBar.tsx'
import { ShelfPill } from './ShelfPill.tsx'
import { TagPicker } from './TagPicker.tsx'
import { ThumbnailField } from './ThumbnailField.tsx'

const FORM_FIELDS = Object.keys(patternFormSchema.shape)

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

export function PatternForm({
  mode,
  defaultValues,
  record,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit'
  defaultValues: PatternFormValues
  record?: PatternRecord
  onSubmit: (values: PatternFormValues, images: PatternImages) => Promise<void>
  onCancel: () => void
}) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatternFormValues>({ resolver: zodResolver(patternFormSchema), defaultValues })

  const [thumbnail, setThumbnail] = useState<ThumbnailState>({ kind: 'unchanged' })
  const [photos, setPhotos] = useState<PhotosState>({
    existing: record?.photos ?? [],
    removed: [],
    added: [],
  })
  const [thumbnailBusy, setThumbnailBusy] = useState(false)
  const [photosBusy, setPhotosBusy] = useState(false)

  const hookMm = watch('hook_mm')

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values, { thumbnail, photos })
    } catch (err) {
      const normalized = normalizePbError(err)
      if (!applyFieldErrors(normalized, setError, FORM_FIELDS)) toast(normalized.message, 'error')
    }
  })

  const existingThumbnailUrl =
    record && record.thumbnail ? pb.files.getURL(record, record.thumbnail, { thumb: '400x0' }) : null

  // Details starts open when editing a pattern that already has any detail filled in.
  const detailsOpen =
    mode === 'edit' &&
    Boolean(
      defaultValues.yarn_weight ||
        defaultValues.hook_mm ||
        defaultValues.gauge ||
        defaultValues.yardage ||
        defaultValues.yardage_max ||
        defaultValues.difficulty,
    )

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6 px-5 pb-2">
      {/* ---- Basics (always open) ---- */}
      <section className="flex flex-col gap-4">
        <Field label="Title" error={errors.title?.message}>
          <input type="text" className="input input-lg w-full" {...register('title')} />
        </Field>

        <ThumbnailField
          state={thumbnail}
          existingUrl={existingThumbnailUrl}
          onChange={setThumbnail}
          onBusyChange={setThumbnailBusy}
        />

        <Field label="Craft" error={errors.craft?.message}>
          <select className="select select-lg w-full" {...register('craft')}>
            {CRAFTS.map((craft) => (
              <option key={craft} value={craft}>
                {CRAFT_LABELS[craft]}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Shelf</span>
          <Controller
            control={control}
            name="shelf"
            render={({ field }) => <ShelfPill value={field.value} onChange={field.onChange} />}
          />
        </div>
      </section>

      {/* ---- Details (collapsible) ---- */}
      <details
        className="collapse-arrow rounded-box collapse bg-base-100"
        style={{ boxShadow: 'var(--shadow-soft)' }}
        open={detailsOpen}
      >
        <summary className="collapse-title font-display text-lg font-semibold">the details</summary>
        <div className="collapse-content flex flex-col gap-4">
          <Field label="Yarn weight" error={errors.yarn_weight?.message}>
            <select className="select select-lg w-full" {...register('yarn_weight')}>
              <option value="">not sure yet</option>
              {YARN_WEIGHTS.map((weight) => (
                <option key={weight} value={weight}>
                  {CYC_LABELS[weight]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hook (mm)" error={errors.hook_mm?.message}>
            <input
              type="text"
              inputMode="decimal"
              className="input input-lg w-full"
              {...register('hook_mm')}
            />
            <HookAliasReadout value={hookMm} />
          </Field>

          <Field label="Gauge" error={errors.gauge?.message}>
            <input
              type="text"
              placeholder="14 sc × 16 rows = 4 in"
              className="input input-lg w-full"
              {...register('gauge')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Yardage" error={errors.yardage?.message}>
              <input
                type="text"
                inputMode="numeric"
                className="input input-lg w-full"
                {...register('yardage')}
              />
            </Field>
            <Field label="up to" error={errors.yardage_max?.message}>
              <input
                type="text"
                inputMode="numeric"
                className="input input-lg w-full"
                {...register('yardage_max')}
              />
            </Field>
          </div>

          <Field label="Difficulty" error={errors.difficulty?.message}>
            <select className="select select-lg w-full" {...register('difficulty')}>
              <option value="">not sure yet</option>
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {DIFFICULTY_LABELS[difficulty]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </details>

      {/* ---- Tags ---- */}
      <section className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Tags</span>
        <Controller
          control={control}
          name="tags"
          render={({ field }) => <TagPicker value={field.value} onChange={field.onChange} />}
        />
      </section>

      {/* ---- Source ---- */}
      <section className="flex flex-col gap-4">
        <Field label="Where it's from" error={errors.source_name?.message}>
          <input
            type="text"
            placeholder="Ravelry, Grandma's binder…"
            className="input input-lg w-full"
            {...register('source_name')}
          />
        </Field>
        <Field label="Link" error={errors.source_url?.message}>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            className="input input-lg w-full"
            {...register('source_url')}
          />
        </Field>
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
        urlFor={(filename) => (record ? pb.files.getURL(record, filename, { thumb: '400x0' }) : '')}
      />

      <SaveBar saving={isSubmitting} disabled={thumbnailBusy || photosBusy} onCancel={onCancel} />
    </form>
  )
}
