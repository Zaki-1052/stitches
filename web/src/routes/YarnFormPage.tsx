// web/src/routes/YarnFormPage.tsx — /yarn/new and /yarn/:id/edit, one dockless subpage (the
// canonical BackBar pattern). Edit mode waits for the record before mounting the form so
// defaults are ready at mount, and redirects non-owners to the read-only detail — PB rules
// would reject the write anyway; this is the UX-sugar layer (SPEC §15). The default export
// remounts per navigation (key={location.key}), matching every form page since 4.2.
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { BackBar } from '../components/BackBar.tsx'
import { useAuth } from '../lib/auth.tsx'
import { yarnFormDefaults, yarnToFormValues } from '../lib/schema.ts'
import type { YarnFormValues } from '../lib/schema.ts'
import { useToast } from '../features/shared/toast.tsx'
import { useYarn } from '../features/yarn/queries.ts'
import { useCreateYarn, useUpdateYarn } from '../features/yarn/mutations.ts'
import { buildYarnFormData } from '../features/yarn/formData.ts'
import type { PhotosState } from '../features/patterns/formData.ts'
import { YarnForm } from '../features/yarn/components/YarnForm.tsx'

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar title={title} />
      <div className="w-full lg:mx-auto lg:max-w-3xl">{children}</div>
    </div>
  )
}

export default function YarnFormPage() {
  const location = useLocation()
  return <YarnFormPageInner key={location.key} />
}

function YarnFormPageInner() {
  const { id = '' } = useParams()
  const mode: 'create' | 'edit' = id ? 'edit' : 'create'
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const yarnQuery = useYarn(id)
  const createYarn = useCreateYarn()
  const updateYarn = useUpdateYarn()

  const title = mode === 'create' ? 'new yarn' : 'edit yarn'

  // Same fallback rule as BackBar: pop history when there is one, else land on the stash.
  const goBack = () => {
    const idx = (window.history.state?.idx as number | undefined) ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/yarn', { replace: true })
  }

  if (mode === 'edit') {
    if (yarnQuery.isPending) {
      return (
        <Frame title={title}>
          <div className="grid place-items-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        </Frame>
      )
    }
    if (yarnQuery.isError) {
      return (
        <Frame title={title}>
          <p className="px-5 py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
            That yarn couldn't be loaded. Try again in a moment?
          </p>
        </Frame>
      )
    }
    if (yarnQuery.data.owner !== user?.id) {
      return <Navigate to={`/yarn/${id}`} replace />
    }
  }

  const record = mode === 'edit' ? yarnQuery.data : undefined

  const handleSubmit = async (values: YarnFormValues, photos: PhotosState) => {
    if (!user) return
    const body = buildYarnFormData(values, photos, mode, user.id)
    if (mode === 'create') {
      const created = await createYarn.mutateAsync(body)
      toast('Yarn saved ♡', 'success')
      navigate(`/yarn/${created.id}`, { replace: true })
    } else {
      await updateYarn.mutateAsync({ id, body })
      toast('Changes saved ♡', 'success')
      navigate(`/yarn/${id}`, { replace: true })
    }
  }

  return (
    <Frame title={title}>
      <YarnForm
        defaultValues={record ? yarnToFormValues(record) : yarnFormDefaults}
        record={record}
        onSubmit={handleSubmit}
        onCancel={goBack}
      />
    </Frame>
  )
}
