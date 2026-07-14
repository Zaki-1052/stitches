// web/src/features/counters/components/CountersCard.tsx — the project-detail counters card
// (DESIGN §9): rows with label, folded live value, small ±, a link glyph when linked, one big
// Open counter button, and a stitch-border ghost row to add. Owner-only by design AND by rule
// — counters are personal process, never rendered (or hinted at) for friends. The ± share the
// surface's exact tap semantics (p07 plan): every action is an outbox op, and +1 fires linked
// resets; only the mint-star celebration stays on the surface.
import { useState } from 'react'
import { Link } from 'react-router'
import { Link2, Minus, Plus } from 'lucide-react'
import type { CounterRecord, ProjectRecord } from '../../../lib/schema.ts'
import { appendOps, foldValue, usePendingOps } from '../../../lib/outbox.ts'
import { buildTapOps } from '../actions.ts'
import { useCounters } from '../queries.ts'
import { useOutboxErrorToasts } from '../useOutboxErrorToasts.ts'
import { CounterSheet } from './CounterSheet.tsx'

export function CountersCard({ project, isOwner }: { project: ProjectRecord; isOwner: boolean }) {
  const countersQuery = useCounters(isOwner ? project.id : '')
  const pending = usePendingOps()
  const [sheetOpen, setSheetOpen] = useState(false)
  useOutboxErrorToasts()

  if (!isOwner) return null

  const counters = countersQuery.data ?? []

  const tap = (counter: CounterRecord, n: number) => {
    appendOps(buildTapOps(counters, counter.id, n))
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between">
        <h2 className="font-display text-xl font-semibold">counters</h2>
      </div>

      {countersQuery.isPending ? (
        <div className="grid place-items-center py-4">
          <span className="loading loading-spinner" />
        </div>
      ) : countersQuery.isError ? (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          The counters couldn't load — try again in a moment.
        </p>
      ) : (
        <>
          {counters.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
              Nothing counted yet — rows, repeats, anything worth keeping track of.
            </p>
          )}

          {counters.length > 0 && (
            <div
              className="rounded-box flex flex-col bg-base-100 px-4 py-1"
              style={{ boxShadow: 'var(--shadow-soft)' }}
            >
              {counters.map((counter, index) => {
                const display = foldValue(counter.value, counter.id, pending)
                return (
                  <div
                    key={counter.id}
                    className={`flex min-h-14 items-center gap-2 ${index > 0 ? 'border-t-[1.5px]' : ''}`}
                    style={index > 0 ? { borderColor: 'var(--color-base-300)' } : undefined}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {counter.resets_with !== '' && (
                        <Link2
                          size={16}
                          strokeWidth={2}
                          aria-hidden="true"
                          style={{ color: 'var(--ink-muted)' }}
                        />
                      )}
                      <span className="truncate text-base font-semibold">{counter.label}</span>
                    </span>

                    <span className="font-display text-xl font-bold tabular-nums">
                      {display}
                      {counter.target > 0 && (
                        <span className="text-sm font-semibold" style={{ color: 'var(--ink-muted)' }}>
                          {' '}
                          / {counter.target}
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      aria-label={`Minus one ${counter.label}`}
                      className="btn btn-ghost btn-circle size-11"
                      disabled={display <= 0}
                      onClick={() => tap(counter, -1)}
                    >
                      <Minus size={20} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Plus one ${counter.label}`}
                      className="btn btn-ghost btn-circle size-11"
                      onClick={() => tap(counter, 1)}
                    >
                      <Plus size={20} strokeWidth={2} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="rounded-box flex min-h-12 items-center justify-center gap-2 border-2 border-dashed text-sm font-semibold"
            style={{ borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }}
          >
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
            Add counter
          </button>

          {counters.length > 0 && (
            <Link to={`/projects/${project.id}/count`} className="btn btn-primary btn-lg">
              Open counter
            </Link>
          )}
        </>
      )}

      <CounterSheet
        open={sheetOpen}
        projectId={project.id}
        counter={null}
        counters={counters}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  )
}
