// web/src/features/projects/components/ProjectForm.tsx — create/edit form for a project
// (PLAN 2.1). PatternForm's anatomy: RHF + zod, image state outside zod, PB failures inline per
// field when possible. Deliberate absences: the pinned summary (edit-in-place on the detail
// page) and visibility (defaults private invisibly; the detail page carries the toggle — the
// patterns precedent). The pattern link is a native <select> of the owner's patterns —
// improvised makes are first-class (SPEC §7), so "no pattern" leads the list.
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { thumbUrl } from '../../../lib/files.ts'
import { projectFormSchema } from '../../../lib/schema.ts'
import type { ProjectFormValues, ProjectRecord } from '../../../lib/schema.ts'
import { applyFieldErrors, normalizePbError } from '../../shared/errors.ts'
import { useToast } from '../../shared/toast.tsx'
import { usePatternOptions } from '../../patterns/queries.ts'
import { useRevokeOnUnmount } from '../../shared/useRevokeOnUnmount.ts'
import type { ThumbnailState } from '../../patterns/formData.ts'
import { HookAliasReadout } from '../../patterns/components/HookAliasReadout.tsx'
import { SaveBar } from '../../patterns/components/SaveBar.tsx'
import { ThumbnailField } from '../../patterns/components/ThumbnailField.tsx'
import { YarnPicker } from '../../yarn/components/YarnPicker.tsx'
import { StatusPill } from './StatusPill.tsx'

const FORM_FIELDS = Object.keys(projectFormSchema.shape)

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

// Dates get a non-<label> wrapper: the clear button must not double as a label activator.
// iOS's date wheel has no reliable empty option, so clearing needs its own affordance.
function DateField({
  label,
  value,
  error,
  onClear,
  children,
}: {
  label: string
  value: string
  error?: string
  onClear: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        {children}
        {value && (
          <button type="button" className="btn btn-ghost" onClick={onClear}>
            clear
          </button>
        )}
      </div>
      {error && <span className="text-error text-sm">{error}</span>}
    </div>
  )
}

export function ProjectForm({
  mode,
  defaultValues,
  record,
  patternPrefill,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit'
  defaultValues: ProjectFormValues
  record?: ProjectRecord
  // /projects/new?pattern= (SPEC §12): applied only once the options confirm the id, so a stale
  // or foreign id from an old link is silently ignored.
  patternPrefill?: string
  onSubmit: (values: ProjectFormValues, cover: ThumbnailState) => Promise<void>
  onCancel: () => void
}) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({ resolver: zodResolver(projectFormSchema), defaultValues })

  const [cover, setCover] = useState<ThumbnailState>({ kind: 'unchanged' })
  const [coverBusy, setCoverBusy] = useState(false)

  // 4.2: a picked-but-unsaved cover preview releases on any exit (see useRevokeOnUnmount).
  useRevokeOnUnmount(() => (cover.kind === 'new' ? [cover.image.previewUrl] : []))

  const optionsQuery = usePatternOptions()
  const options = optionsQuery.data ?? []

  const prefillApplied = useRef(false)
  useEffect(() => {
    if (prefillApplied.current || mode !== 'create' || !patternPrefill) return
    if ((optionsQuery.data ?? []).some((option) => option.id === patternPrefill)) {
      setValue('pattern', patternPrefill)
      prefillApplied.current = true
    }
  }, [mode, patternPrefill, optionsQuery.data, setValue])

  // An edit-mode link outside the owner's options (a friends-shared pattern — rules allow it)
  // still renders and round-trips instead of silently displaying "no pattern".
  const linkedFallback =
    defaultValues.pattern && !options.some((option) => option.id === defaultValues.pattern)
      ? { id: defaultValues.pattern, title: record?.expand?.pattern?.title || 'linked pattern' }
      : null

  const status = watch('status')
  const startedOn = watch('started_on')
  const finishedOn = watch('finished_on')
  const hookMm = watch('hook_mm')
  const showFinishedOn = status === 'finished' || Boolean(defaultValues.finished_on)

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values, cover)
    } catch (err) {
      const normalized = normalizePbError(err)
      if (!applyFieldErrors(normalized, setError, FORM_FIELDS)) toast(normalized.message, 'error')
    }
  })

  const existingCoverUrl =
    record && record.cover ? thumbUrl(record, record.cover, 'grid') : null

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6 px-5 pb-2">
      <section className="flex flex-col gap-4">
        <Field label="Name" error={errors.name?.message}>
          <input type="text" className="input input-lg w-full" {...register('name')} />
        </Field>

        <Field label="Pattern" error={errors.pattern?.message}>
          <select className="select select-lg w-full" {...register('pattern')}>
            <option value="">no pattern — improvised</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
            {linkedFallback && <option value={linkedFallback.id}>{linkedFallback.title}</option>}
          </select>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Status</span>
          <Controller
            control={control}
            name="status"
            render={({ field }) => <StatusPill value={field.value} onChange={field.onChange} />}
          />
        </div>

        <DateField
          label="Started"
          value={startedOn}
          error={errors.started_on?.message}
          onClear={() => setValue('started_on', '')}
        >
          <input type="date" className="input input-lg w-full" {...register('started_on')} />
        </DateField>

        {showFinishedOn && (
          <DateField
            label="Finished"
            value={finishedOn}
            error={errors.finished_on?.message}
            onClear={() => setValue('finished_on', '')}
          >
            <input type="date" className="input input-lg w-full" {...register('finished_on')} />
          </DateField>
        )}

        <ThumbnailField
          state={cover}
          existingUrl={existingCoverUrl}
          onChange={setCover}
          onBusyChange={setCoverBusy}
        />
      </section>

      {/* ---- The making-of details ---- */}
      <section className="flex flex-col gap-4">
        <Field label="Hook (mm)" error={errors.hook_mm?.message}>
          <input
            type="text"
            inputMode="decimal"
            className="input input-lg w-full"
            {...register('hook_mm')}
          />
          <HookAliasReadout value={hookMm} />
        </Field>

        <Field label="Yarn used" error={errors.yarn_used?.message}>
          <input
            type="text"
            placeholder="brand, colorway, held double…"
            className="input input-lg w-full"
            {...register('yarn_used')}
          />
        </Field>

        {/* The stash link (ADDONS §2.3): multi-select chips, distinct from the freeform note
            field above — both stay; the note covers yarn that never entered the stash. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Yarn from your stash</span>
          <Controller
            control={control}
            name="yarns"
            render={({ field }) => <YarnPicker value={field.value} onChange={field.onChange} />}
          />
        </div>
      </section>

      <SaveBar
        saving={isSubmitting}
        disabled={coverBusy}
        onCancel={onCancel}
        label="Save project"
      />
    </form>
  )
}
