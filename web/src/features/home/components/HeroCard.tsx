// web/src/features/home/components/HeroCard.tsx — the "on the hook" hero (DESIGN §9): cover,
// name, pattern, live counter value, and two actions — Count (→ the surface; PLAN 2.3's
// "counting in one tap") and Journal (quick entry sheet, opened by HomePage). The live value is
// always foldValue(pending) over server truth, never counter.value raw (SPEC §11). The hero
// counter is chosen by HomePage: primary (oldest with a target, the p07 rule) falling back to
// the oldest. Cover/name are one Link; the action buttons are siblings — no nested interactives.
import { Link } from 'react-router'
import { thumbUrl } from '../../../lib/files.ts'
import type { CounterRecord, ProjectRecord } from '../../../lib/schema.ts'
import type { CounterOp } from '../../../lib/outbox.ts'
import { foldValue } from '../../../lib/outbox.ts'
import { YarnBall } from '../../../components/YarnBall.tsx'

export function HeroCard({
  project,
  counter,
  pendingOps,
  onJournal,
}: {
  project: ProjectRecord
  counter: CounterRecord | undefined
  pendingOps: readonly CounterOp[]
  onJournal: (project: ProjectRecord) => void
}) {
  const patternTitle = project.expand?.pattern?.title ?? ''
  const value = counter ? foldValue(counter.value, counter.id, pendingOps) : null
  const hasTarget = counter !== undefined && counter.target > 0
  const countTo = counter
    ? `/projects/${project.id}/count?c=${counter.id}`
    : `/projects/${project.id}/count`

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

      {counter && value !== null ? (
        <div className="flex flex-col gap-1.5 px-4">
          <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            {counter.label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl leading-none font-bold tabular-nums">
              {value}
            </span>
            {hasTarget && (
              <span className="text-sm tabular-nums" style={{ color: 'var(--ink-muted)' }}>
                of {counter.target}
              </span>
            )}
          </div>
          {hasTarget && (
            <span
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--color-base-300)' }}
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  background: 'var(--color-primary)',
                  width: `${Math.min(100, (value / counter.target) * 100)}%`,
                }}
              />
            </span>
          )}
        </div>
      ) : (
        <p className="px-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
          No counters yet. The Count button will set one up.
        </p>
      )}

      <div className="mt-auto flex gap-3 px-4">
        <Link to={countTo} className="btn btn-primary btn-lg flex-1">
          Count
        </Link>
        <button
          type="button"
          className="btn btn-lg border-none"
          style={{ background: 'var(--patch-lilac-soft)', color: 'var(--patch-lilac-deep)' }}
          onClick={() => onJournal(project)}
        >
          Journal
        </button>
      </div>
    </article>
  )
}
