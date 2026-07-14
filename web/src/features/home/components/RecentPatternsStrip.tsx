// web/src/features/home/components/RecentPatternsStrip.tsx — "recently added" (DESIGN §9): a
// horizontal strip of library cards, newest saves first. Presentational — HomePage owns the
// queries because the same data also decides the new-user empty state. Reuses PatternCard's
// grid variant in fixed-width wrappers; lists never load originals (SPEC §8).
import { Link } from 'react-router'
import type { PatternRecord } from '../../../lib/schema.ts'
import { PatternCard } from '../../patterns/components/PatternCard.tsx'

export function RecentPatternsStrip({
  patterns,
  finishedPatternIds,
}: {
  patterns: PatternRecord[]
  finishedPatternIds: ReadonlySet<string>
}) {
  if (patterns.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-5">
        <h2 className="font-display text-xl font-semibold lowercase">recently added</h2>
        <Link
          to="/patterns"
          className="text-sm font-semibold"
          style={{ color: 'var(--patch-blue-deep)' }}
        >
          see all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {patterns.map((pattern) => (
          <div key={pattern.id} className="w-36 shrink-0">
            <PatternCard pattern={pattern} made={finishedPatternIds.has(pattern.id)} view="grid" />
          </div>
        ))}
      </div>
    </section>
  )
}
