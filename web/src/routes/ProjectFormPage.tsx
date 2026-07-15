// web/src/routes/ProjectFormPage.tsx — /projects/new (accepts ?pattern=, SPEC §12) and
// /projects/:id/edit, one dockless subpage mirroring PatternFormPage: edit mode waits for the
// record so defaults are ready at mount and redirects non-owners to the read-only detail.
// Create mode pre-fills started_on with today — visible and clearable beats invisible
// auto-set-on-flip logic (this session's date-default decision).
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { BackBar } from '../components/BackBar.tsx'
import { useAuth } from '../lib/auth.tsx'
import { projectFormDefaults, projectToFormValues } from '../lib/schema.ts'
import type { ProjectFormValues } from '../lib/schema.ts'
import { todayLocalISO } from '../lib/dates.ts'
import { useToast } from '../features/shared/toast.tsx'
import type { ThumbnailState } from '../features/patterns/formData.ts'
import { useProject } from '../features/projects/queries.ts'
import { useCreateProject, useUpdateProject } from '../features/projects/mutations.ts'
import { buildProjectFormData } from '../features/projects/formData.ts'
import { ProjectForm } from '../features/projects/components/ProjectForm.tsx'

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <BackBar title={title} />
      <div className="w-full lg:mx-auto lg:max-w-3xl">{children}</div>
    </div>
  )
}

export default function ProjectFormPage() {
  const { id = '' } = useParams()
  const mode: 'create' | 'edit' = id ? 'edit' : 'create'
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const projectQuery = useProject(id)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const title = mode === 'create' ? 'new project' : 'edit project'

  // Same fallback rule as BackBar: pop history when there is one, else land on the list.
  const goBack = () => {
    const idx = (window.history.state?.idx as number | undefined) ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/projects', { replace: true })
  }

  if (mode === 'edit') {
    if (projectQuery.isPending) {
      return (
        <Frame title={title}>
          <div className="grid place-items-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        </Frame>
      )
    }
    if (projectQuery.isError) {
      return (
        <Frame title={title}>
          <p className="px-5 py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
            That project couldn't be loaded — try again in a moment?
          </p>
        </Frame>
      )
    }
    if (projectQuery.data.owner !== user?.id) {
      return <Navigate to={`/projects/${id}`} replace />
    }
  }

  const record = mode === 'edit' ? projectQuery.data : undefined

  const handleSubmit = async (values: ProjectFormValues, cover: ThumbnailState) => {
    if (!user) return
    const body = buildProjectFormData(values, cover, mode, user.id)
    if (mode === 'create') {
      const created = await createProject.mutateAsync(body)
      toast('Project saved ♡', 'success')
      navigate(`/projects/${created.id}`, { replace: true })
    } else {
      await updateProject.mutateAsync({ id, body })
      toast('Changes saved ♡', 'success')
      navigate(`/projects/${id}`, { replace: true })
    }
  }

  const createDefaults: ProjectFormValues = {
    ...projectFormDefaults,
    started_on: todayLocalISO(),
  }

  return (
    <Frame title={title}>
      <ProjectForm
        mode={mode}
        defaultValues={record ? projectToFormValues(record) : createDefaults}
        record={record}
        patternPrefill={mode === 'create' ? (searchParams.get('pattern') ?? undefined) : undefined}
        onSubmit={handleSubmit}
        onCancel={goBack}
      />
    </Frame>
  )
}
