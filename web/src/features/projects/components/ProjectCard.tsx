// web/src/features/projects/components/ProjectCard.tsx — one project in the grouped /projects
// list (DESIGN §9): cover, name, pattern, status chip, started date. Full-width rows (grouped
// sections read as lists). Lists never load originals (SPEC §8); no cover → yarn-ball
// placeholder. The slim counter-progress bar arrives with Session 2.2's counters.
import { Link } from 'react-router'
import { pb } from '../../../lib/pb.ts'
import type { ProjectRecord } from '../../../lib/schema.ts'
import { formatShortDate } from '../../../lib/dates.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'
import { StatusChip } from './StatusChip.tsx'

export function ProjectCard({ project }: { project: ProjectRecord }) {
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
      </span>
    </Link>
  )
}
