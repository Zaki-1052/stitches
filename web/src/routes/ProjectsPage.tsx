// web/src/routes/ProjectsPage.tsx — /projects (DESIGN §9 + PLAN 2.1, reconciled per this
// session's plan): grouped status sections, on-the-hook first, with single-select status chips
// as a filter. The one filter lives in the URL (?status=), replace-style like the Library, so
// back from a detail restores the view and back from here exits in one press.
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import type { ProjectRecord, ProjectStatus } from '../lib/schema.ts'
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from '../lib/schema.ts'
import { patchSwatch } from '../features/shared/patchColors.ts'
import { useProjects } from '../features/projects/queries.ts'
import { parseProjectsParams, serializeProjectsParams } from '../features/projects/urlParams.ts'
import { normalizeStatus, STATUS_PATCH } from '../features/projects/status.ts'
import { ProjectCard } from '../features/projects/components/ProjectCard.tsx'
import { ProjectsEmptyState } from '../features/projects/components/ProjectsEmptyState.tsx'

// Section order: active work leads, dreams next, naps, then the finished and frogged archives.
const STATUS_ORDER: ProjectStatus[] = [
  'in_progress',
  'planned',
  'hibernating',
  'finished',
  'frogged',
]

function StatusFilterChip({
  status,
  selected,
  onToggle,
}: {
  status: ProjectStatus
  selected: boolean
  onToggle: () => void
}) {
  const swatch = patchSwatch(STATUS_PATCH[status])
  const style = selected
    ? { background: swatch.soft, color: swatch.deep, borderColor: swatch.deep }
    : {
        background: 'var(--color-base-100)',
        color: 'var(--ink-muted)',
        borderColor: 'var(--color-base-300)',
      }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className="h-11 shrink-0 rounded-full border-[1.5px] px-4 text-sm font-semibold"
      style={style}
    >
      {PROJECT_STATUS_LABELS[status]}
    </button>
  )
}

function SectionHeader({ status }: { status: ProjectStatus }) {
  const swatch = patchSwatch(STATUS_PATCH[status])
  return (
    <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
      <span
        className="size-3 rounded-full"
        style={{ background: swatch.core }}
        aria-hidden="true"
      />
      {PROJECT_STATUS_LABELS[status]}
    </h2>
  )
}

export default function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { status } = useMemo(() => parseProjectsParams(searchParams), [searchParams])

  const projectsQuery = useProjects(status)
  const projects = projectsQuery.data ?? []

  const setStatus = (next: ProjectStatus | null) => {
    setSearchParams(serializeProjectsParams({ status: next }), { replace: true })
  }

  const sections = useMemo(() => {
    const byStatus = new Map<ProjectStatus, ProjectRecord[]>()
    for (const project of projectsQuery.data ?? []) {
      const key = normalizeStatus(project.status)
      const list = byStatus.get(key)
      if (list) list.push(project)
      else byStatus.set(key, [project])
    }
    return STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => ({
      status: s,
      projects: byStatus.get(s)!,
    }))
  }, [projectsQuery.data])

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-base-200 px-5 pt-1 pb-2.5">
        <div className="-my-1 flex flex-1 gap-2 overflow-x-auto py-1">
          {PROJECT_STATUSES.map((s) => (
            <StatusFilterChip
              key={s}
              status={s}
              selected={status === s}
              onToggle={() => setStatus(status === s ? null : s)}
            />
          ))}
        </div>
        <Link
          to="/projects/new"
          aria-label="Start a project"
          className="btn btn-primary btn-circle size-11 shrink-0"
        >
          <Plus size={24} strokeWidth={2.5} />
        </Link>
      </div>

      {projectsQuery.isPending ? (
        <div className="flex flex-col gap-3 px-5">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-box flex items-center gap-3 bg-base-100 p-3">
              <div className="skeleton size-20 shrink-0 rounded-2xl" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : projectsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Your projects couldn't load — try again in a moment?
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void projectsQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        status ? (
          <ProjectsEmptyState kind="filtered" onClear={() => setStatus(null)} />
        ) : (
          <ProjectsEmptyState kind="empty" />
        )
      ) : status ? (
        // A single-status filter needs no section header — the selected chip says it.
        <div className="flex flex-col gap-3 px-5">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-5">
          {sections.map((section) => (
            <section key={section.status} className="flex flex-col gap-3">
              <SectionHeader status={section.status} />
              {section.projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
