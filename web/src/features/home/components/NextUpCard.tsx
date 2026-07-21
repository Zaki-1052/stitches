// web/src/features/home/components/NextUpCard.tsx — the "next up" fallback card (DESIGN §9):
// a planned project shown when nothing is on the hook. Same cover/name/pattern anatomy as
// HeroCard, but no counter block — the single action is Cast on, the deliberate one-tap flip
// to in progress (no date side-effects: DECISIONS 2026-07-13). HomePage owns the mutation and
// shares one `pending` flag across cards so two flips can't race.
import { Link } from 'react-router'
import { thumbUrl } from '../../../lib/files.ts'
import type { ProjectRecord } from '../../../lib/schema.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'
import { StatusChip } from '../../projects/components/StatusChip.tsx'

export function NextUpCard({
  project,
  pending,
  onCastOn,
}: {
  project: ProjectRecord
  pending: boolean
  onCastOn: (project: ProjectRecord) => void
}) {
  const patternTitle = project.expand?.pattern?.title ?? ''

  return (
    <article
      className="rounded-box flex h-full flex-col gap-4 overflow-hidden bg-base-100 pb-4"
      style={{ boxShadow: 'var(--shadow-lift)' }}
    >
      <Link to={`/projects/${project.id}`} className="flex flex-col">
        {project.cover ? (
          <img
            src={thumbUrl(project, project.cover, 'hero')}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <div
            className="grid aspect-[16/9] w-full place-items-center"
            style={{ background: 'var(--color-base-300)' }}
          >
            <YarnBall size={56} />
          </div>
        )}
        <span className="flex flex-col gap-0.5 px-4 pt-3">
          <span className="truncate font-display text-xl leading-snug font-bold">
            {project.name}
          </span>
          {patternTitle && (
            <span className="truncate text-sm" style={{ color: 'var(--ink-muted)' }}>
              {patternTitle}
            </span>
          )}
        </span>
      </Link>

      <div className="px-4">
        <StatusChip status={project.status} />
      </div>

      <div className="mt-auto flex px-4">
        <button
          type="button"
          className="btn btn-primary btn-lg flex-1"
          disabled={pending}
          aria-label={`Cast on ${project.name}`}
          onClick={() => onCastOn(project)}
        >
          Cast on
        </button>
      </div>
    </article>
  )
}
