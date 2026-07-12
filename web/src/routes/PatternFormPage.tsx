// web/src/routes/PatternFormPage.tsx — /patterns/new and /patterns/:id/edit, as one dockless
// subpage (the canonical BackBar pattern from Settings). Edit mode waits for the record before
// mounting the form so defaults are ready at mount, and redirects non-owners to the read-only
// detail — PB rules would reject the write anyway; this is the UX-sugar layer (SPEC §15).
import { Navigate, useNavigate, useParams } from 'react-router'
import { BackBar } from '../components/BackBar.tsx'
import { useAuth } from '../lib/auth.tsx'
import { patternFormDefaults, patternToFormValues } from '../lib/schema.ts'
import type { PatternFormValues } from '../lib/schema.ts'
import { useToast } from '../features/shared/toast.tsx'
import { usePattern } from '../features/patterns/queries.ts'
import { useCreatePattern, useUpdatePattern } from '../features/patterns/mutations.ts'
import { buildPatternFormData } from '../features/patterns/formData.ts'
import type { PatternImages } from '../features/patterns/formData.ts'
import { PatternForm } from '../features/patterns/components/PatternForm.tsx'

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar title={title} />
      {children}
    </div>
  )
}

export default function PatternFormPage() {
  const { id = '' } = useParams()
  const mode: 'create' | 'edit' = id ? 'edit' : 'create'
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const patternQuery = usePattern(id)
  const createPattern = useCreatePattern()
  const updatePattern = useUpdatePattern()

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
      toast('Pattern saved ♡', 'success')
      navigate(`/patterns/${created.id}`, { replace: true })
    } else {
      await updatePattern.mutateAsync({ id, body })
      toast('Changes saved ♡', 'success')
      navigate(`/patterns/${id}`, { replace: true })
    }
  }

  return (
    <Frame title={title}>
      <PatternForm
        mode={mode}
        defaultValues={record ? patternToFormValues(record) : patternFormDefaults}
        record={record}
        onSubmit={handleSubmit}
        onCancel={goBack}
      />
    </Frame>
  )
}
