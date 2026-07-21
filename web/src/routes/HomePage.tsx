// web/src/routes/HomePage.tsx — Home, "On the hook" (DESIGN §9). AppHeader (greeting + avatar →
// settings) lives in AppShell above; this page is the hero card(s) with live counter values,
// the quick-add doors, and the recently-added strip. Hero values fold pending taps over server
// truth (SPEC §11); no realtime subscription here — realtime stays per open project.
//
// State matrix (p08 plan, next-up row added 2026-07-19): WIP → heroes · no WIP but planned →
// "next up" cards with one-tap Cast on · other content only → "nothing on the hook" ghost card
// · truly nothing → the new-user empty state. The "any content?" probe defers until the
// in-progress list settles empty, and nothing is decided while a relevant query is pending
// (no empty-state flash).
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useFinishedPatternIds, useProjects } from '../features/projects/queries.ts'
import { useQuickUpdateProject } from '../features/projects/mutations.ts'
import { normalizeStatus } from '../features/projects/status.ts'
import { useMyCounters } from '../features/counters/queries.ts'
import { useRecentPatterns } from '../features/patterns/queries.ts'
import { usePendingOps } from '../lib/outbox.ts'
import { useToast } from '../features/shared/toast.tsx'
import type { CounterRecord, ProjectRecord } from '../lib/schema.ts'
import { HeroCard } from '../features/home/components/HeroCard.tsx'
import { NextUpCard } from '../features/home/components/NextUpCard.tsx'
import { DoorsRow } from '../features/home/components/DoorsRow.tsx'
import { RecentPatternsStrip } from '../features/home/components/RecentPatternsStrip.tsx'
import { HomeEmptyState } from '../features/home/components/HomeEmptyState.tsx'
import { JournalQuickSheet } from '../features/home/components/JournalQuickSheet.tsx'

const RECENT_LIMIT = 8
const NO_FINISHED: ReadonlySet<string> = new Set()

function HeroSkeleton() {
  return (
    <div className="px-5">
      <div className="rounded-box flex flex-col gap-3 bg-base-100 p-4">
        <div className="skeleton aspect-[16/9] w-full rounded-2xl" />
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-12 w-full" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const inProgressQuery = useProjects('in_progress')
  const countersQuery = useMyCounters()
  const pendingOps = usePendingOps()
  const recentQuery = useRecentPatterns(RECENT_LIMIT)
  const finishedQuery = useFinishedPatternIds()
  const [journalFor, setJournalFor] = useState<ProjectRecord | null>(null)

  const inProgress = inProgressQuery.data ?? []
  const settledEmpty = inProgressQuery.isSuccess && inProgress.length === 0
  const anyProjectsQuery = useProjects(null, { enabled: settledEmpty })

  // The probe's data does double duty: planned projects become the "next up" fallback cards.
  const planned = (anyProjectsQuery.data ?? []).filter(
    (p) => normalizeStatus(p.status) === 'planned',
  )
  const quickUpdate = useQuickUpdateProject()
  const toast = useToast()
  const handleCastOn = (project: ProjectRecord) => {
    if (quickUpdate.isPending) return
    quickUpdate.mutate(
      { id: project.id, body: { status: 'in_progress' } },
      {
        onSuccess: () => toast('On the hook ♡', 'success'),
        onError: () => toast('Cast on slipped a stitch, try again?', 'error'),
      },
    )
  }

  // Each project's hero counter: primary = oldest with a target (the p07 /projects rule),
  // falling back to the oldest counter at all. useMyCounters arrives created-asc.
  const heroCounters = useMemo(() => {
    const map = new Map<string, CounterRecord>()
    const counters = countersQuery.data ?? []
    for (const c of counters) if (c.target > 0 && !map.has(c.project)) map.set(c.project, c)
    for (const c of counters) if (!map.has(c.project)) map.set(c.project, c)
    return map
  }, [countersQuery.data])

  const patterns = recentQuery.data ?? []
  // Only the both-probes-settled, both-empty case earns the grand empty state; any error or
  // pending state falls back to the ghost card / skeleton rather than misclassifying the user.
  const isNewUser =
    settledEmpty &&
    recentQuery.isSuccess &&
    patterns.length === 0 &&
    anyProjectsQuery.isSuccess &&
    (anyProjectsQuery.data ?? []).length === 0

  const heroCard = (project: ProjectRecord) => (
    <HeroCard
      project={project}
      counter={heroCounters.get(project.id)}
      pendingOps={pendingOps}
      onJournal={setJournalFor}
    />
  )

  let heroSection: React.ReactNode
  if (inProgressQuery.isPending || (inProgress.length > 0 && countersQuery.isPending)) {
    heroSection = <HeroSkeleton />
  } else if (inProgressQuery.isError) {
    heroSection = (
      <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Your projects couldn't load. Try again in a moment?
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void inProgressQuery.refetch()}
        >
          Retry
        </button>
      </div>
    )
  } else if (inProgress.length === 1) {
    heroSection = <div className="px-5">{heroCard(inProgress[0])}</div>
  } else if (inProgress.length > 1) {
    heroSection = (
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {inProgress.map((project) => (
          <div key={project.id} className="w-[86%] shrink-0 snap-center">
            {heroCard(project)}
          </div>
        ))}
      </div>
    )
  } else if (recentQuery.isPending || anyProjectsQuery.isPending) {
    heroSection = <HeroSkeleton />
  } else if (planned.length > 0) {
    const nextUpCard = (project: ProjectRecord) => (
      <NextUpCard project={project} pending={quickUpdate.isPending} onCastOn={handleCastOn} />
    )
    heroSection = (
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2 px-5">
          <h2 className="font-display text-xl font-semibold lowercase">next up</h2>
          <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            waiting to be cast on
          </span>
        </div>
        {planned.length === 1 ? (
          <div className="px-5">{nextUpCard(planned[0])}</div>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {planned.map((project) => (
              <div key={project.id} className="w-[86%] shrink-0 snap-center">
                {nextUpCard(project)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  } else if (isNewUser) {
    heroSection = <HomeEmptyState />
  } else {
    heroSection = (
      <div className="px-5">
        <div
          className="rounded-box flex flex-col items-center gap-3 border-2 border-dashed p-6 text-center"
          style={{ borderColor: 'var(--color-base-300)' }}
        >
          <p className="font-display text-lg font-bold">Nothing on the hook right now.</p>
          <Link to="/projects/new" className="btn btn-primary">
            Start a project
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pt-1 pb-4">
      {heroSection}
      <DoorsRow />
      <RecentPatternsStrip
        patterns={patterns}
        finishedPatternIds={finishedQuery.data ?? NO_FINISHED}
      />
      <JournalQuickSheet project={journalFor} onClose={() => setJournalFor(null)} />
    </div>
  )
}
