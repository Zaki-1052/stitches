// web/src/routes/PatternFormPage.tsx — /patterns/new and /patterns/:id/edit, as one dockless
// subpage (the canonical BackBar pattern from Settings). Edit mode waits for the record before
// mounting the form so defaults are ready at mount, and redirects non-owners to the read-only
// detail — PB rules would reject the write anyway; this is the UX-sugar layer (SPEC §15).
// The default export remounts the page per navigation (key={location.key}, fresh on every
// navigate() even to the same path) so a ➕ quick-add pick made while already on /patterns/new
// re-consumes the pending-import bridge instead of being dropped (the 1.3 known gap). Wiping a
// half-typed form is the correct semantics: a new file/link means starting over.
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { BackBar } from '../components/BackBar.tsx'
import { useAuth } from '../lib/auth.tsx'
import { patternFormDefaults, patternToFormValues } from '../lib/schema.ts'
import type { PatternFormValues } from '../lib/schema.ts'
import { useToast } from '../features/shared/toast.tsx'
import { usePattern } from '../features/patterns/queries.ts'
import { useCreatePattern, useUpdatePattern } from '../features/patterns/mutations.ts'
import { useCreateAttachment } from '../features/patterns/attachmentMutations.ts'
import { useConsumePendingAttachmentImport } from '../features/patterns/pendingAttachmentImport.ts'
import { useConsumePendingUrlImport } from '../features/patterns/pendingUrlImport.ts'
import { buildPatternFormData } from '../features/patterns/formData.ts'
import type { PatternImages } from '../features/patterns/formData.ts'
import { PatternForm } from '../features/patterns/components/PatternForm.tsx'

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar title={title} />
      <div className="w-full lg:mx-auto lg:max-w-3xl">{children}</div>
    </div>
  )
}

export default function PatternFormPage() {
  const location = useLocation()
  return <PatternFormPageInner key={location.key} />
}

function PatternFormPageInner() {
  const { id = '' } = useParams()
  const mode: 'create' | 'edit' = id ? 'edit' : 'create'
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const patternQuery = usePattern(id)
  const createPattern = useCreatePattern()
  const updatePattern = useUpdatePattern()
  const createAttachment = useCreateAttachment()
  // Consumed unconditionally (rules of hooks); only the create path uses them, and an edit-page
  // mount simply discards an abandoned pick. At most one bridge is ever set — each door stashes
  // and navigates in the same tick.
  const pendingImport = useConsumePendingAttachmentImport()
  const pendingUrl = useConsumePendingUrlImport()

  const title = mode === 'create' ? 'new pattern' : 'edit pattern'

  // Same fallback rule as BackBar: pop history when there is one, else land on the Library.
  const goBack = () => {
    const idx = (window.history.state?.idx as number | undefined) ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/patterns', { replace: true })
  }

  if (mode === 'edit') {
    if (patternQuery.isPending) {
      return (
        <Frame title={title}>
          <div className="grid place-items-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        </Frame>
      )
    }
    if (patternQuery.isError) {
      return (
        <Frame title={title}>
          <p className="px-5 py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
            That pattern couldn't be loaded — try again in a moment?
          </p>
        </Frame>
      )
    }
    if (patternQuery.data.owner !== user?.id) {
      return <Navigate to={`/patterns/${id}`} replace />
    }
  }

  const record = mode === 'edit' ? patternQuery.data : undefined

  const handleSubmit = async (values: PatternFormValues, images: PatternImages) => {
    if (!user) return
    const body = buildPatternFormData(values, images, mode, user.id)
    if (mode === 'create') {
      const created = await createPattern.mutateAsync(body)
      // File-first door: the pattern exists now, so an attachment failure must not look like a
      // failed save — surface it loudly and land on the detail page, where the vault card is
      // the retry path.
      if (pendingImport) {
        const fd = new FormData()
        fd.append('owner', user.id)
        fd.append('pattern', created.id)
        fd.append('label', pendingImport.attachmentLabel)
        fd.append('files', pendingImport.attachmentFile)
        try {
          await createAttachment.mutateAsync(fd)
          toast('Pattern saved ♡', 'success')
        } catch (err) {
          console.error('[quick-add] attachment create failed', err)
          toast("Pattern saved, but the file didn't attach — add it again from here.", 'error')
        }
      } else {
        toast('Pattern saved ♡', 'success')
      }
      navigate(`/patterns/${created.id}`, { replace: true })
    } else {
      await updatePattern.mutateAsync({ id, body })
      toast('Changes saved ♡', 'success')
      navigate(`/patterns/${id}`, { replace: true })
    }
  }

  const createDefaults = {
    ...patternFormDefaults,
    ...(pendingUrl?.defaults ?? {}),
    ...(pendingImport ? { title: pendingImport.suggestedTitle } : {}),
  }

  return (
    <Frame title={title}>
      <PatternForm
        mode={mode}
        defaultValues={record ? patternToFormValues(record) : createDefaults}
        record={record}
        initialThumbnail={
          mode === 'create'
            ? (pendingImport?.thumbnail ?? pendingUrl?.thumbnail ?? undefined)
            : undefined
        }
        pendingAttachmentLabel={mode === 'create' ? pendingImport?.attachmentLabel : undefined}
        importedFrom={mode === 'create' ? (pendingUrl?.importedFrom ?? undefined) : undefined}
        onSubmit={handleSubmit}
        onCancel={goBack}
      />
    </Frame>
  )
}
