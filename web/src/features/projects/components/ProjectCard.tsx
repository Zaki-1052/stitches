// web/src/features/projects/components/ProjectCard.tsx — one project in the grouped /projects
// list (DESIGN §9): cover, name, pattern, status chip, started date, and a slim progress bar
// when counters have targets — driven by the project's *primary* counter, the oldest one with
// a target (p07 plan; Session 2.3's home hero reuses the notion). Server values are enough at
// list altitude — pending taps reconcile within seconds. Full-width rows (grouped sections
// read as lists). Lists never load originals (SPEC §8); no cover → yarn-ball placeholder.
import { Link } from 'react-router'
import { pb } from '../../../lib/pb.ts'
import type { CounterRecord, ProjectRecord } from '../../../lib/schema.ts'
import { formatShortDate } from '../../../lib/dates.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'
import { StatusChip } from './StatusChip.tsx'

export function ProjectCard({
  project,
  progress,
}: {
  project: ProjectRecord
  progress?: CounterRecord
}) {
  const patternTitle = project.expand?.pattern?.title ?? ''
  return (
    <Link
      to={`/projects/${project.id}`}
      className="rounded-box flex items-center gap-3 bg-base-100 p-3"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      {project.cover ? (
        <img
          src={pb.files.getURL(project, project.cover, { thumb: '400x0' })}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <span
          className="grid size-20 shrink-0 place-items-center rounded-2xl"
          style={{ background: 'var(--color-base-300)' }}
        >
          <YarnBall size={48} />
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-lg leading-snug font-semibold">{project.name}</span>
        {patternTitle && (
          <span className="truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
            {patternTitle}
          </span>
        )}
        <span className="flex items-center gap-2">
          <StatusChip status={project.status} />
          {project.started_on && (
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              started {formatShortDate(project.started_on)}
            </span>
          )}
        </span>
        {progress && (
          <span className="flex items-center gap-2">
            <span
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
              style={{ background: 'var(--color-base-300)' }}
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  background: 'var(--color-primary)',
                  width: `${Math.min(100, (progress.value / progress.target) * 100)}%`,
                }}
              />
            </span>
            <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--ink-muted)' }}>
              {progress.value} of {progress.target}
            </span>
          </span>
        )}
      </span>
    </Link>
  )
}
