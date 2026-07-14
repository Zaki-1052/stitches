// web/src/routes/CounterPage.tsx — /projects/:id/count, the flagship surface (DESIGN §10).
// Full-screen 100dvh, top to bottom: 56 px bar (back · project name · moon · wake-lock · edit),
// the numeral pager (scroll-snap, one page per counter: label, giant tabular numeral, progress
// bar when a target exists, linked captions), dots, the tap-to-switch strip, the −1/edit/reset
// row, and the bottom +1 tap zone. The validated ?c= param is the single source of truth for
// the active counter — the pager scrolls to match it, and a settled user swipe writes it back
// (replace, so paging never pollutes history). Every value change is an outbox op; the page
// renders server truth folded with pending taps. Dim mode swaps data-theme="stitchesdim" on
// this subtree only; pulse and star feedback fire from local tap handlers, reduced-motion
// gated in JS.
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ChevronLeft, Coffee, Moon, Pencil, Plus } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { appendOps, foldValue, usePendingOps, useOutboxSyncing } from '../lib/outbox.ts'
import { usePref, setPref } from '../lib/prefs.ts'
import { useProject } from '../features/projects/queries.ts'
import { useCounters } from '../features/counters/queries.ts'
import { useCountersRealtime } from '../features/counters/realtime.ts'
import { useOutboxErrorToasts } from '../features/counters/useOutboxErrorToasts.ts'
import { buildTapOps, crossesTarget } from '../features/counters/actions.ts'
import { useWakeLock, wakeLockSupported } from '../features/counters/useWakeLock.ts'
import { useHapticTick } from '../features/counters/haptics.tsx'
import { CounterSheet } from '../features/counters/components/CounterSheet.tsx'
import { EditValueSheet } from '../features/counters/components/EditValueSheet.tsx'
import { ResetConfirmSheet } from '../features/counters/components/ResetConfirmSheet.tsx'
import { TargetStar } from '../features/counters/components/TargetStar.tsx'
import { SyncStitch } from '../features/counters/components/SyncStitch.tsx'

const CROSS_FADE = 'transition-colors duration-[250ms]'

// `active` undefined = a plain button (no aria-pressed); boolean = a toggle.
function BarButton({
  label,
  active,
  onPress,
  children,
}: {
  label: string
  active?: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onPress}
      className="btn btn-ghost btn-circle size-11"
      style={active ? { color: 'var(--color-primary)' } : undefined}
    >
      {children}
    </button>
  )
}

export default function CounterPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const projectQuery = useProject(id)
  const countersQuery = useCounters(id)
  useCountersRealtime(id)
  useOutboxErrorToasts()

  const pending = usePendingOps()
  const syncing = useOutboxSyncing()
  const dim = usePref('counterDim')
  const wake = usePref('counterWakeLock')
  useWakeLock(wake)
  const haptic = useHapticTick()

  const [searchParams, setSearchParams] = useSearchParams()
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [valueSheetOpen, setValueSheetOpen] = useState(false)
  const [resetSheetOpen, setResetSheetOpen] = useState(false)
  const [starring, setStarring] = useState(false)
  const [pulseTick, setPulseTick] = useState(0)

  const pagerRef = useRef<HTMLDivElement>(null)
  const programmaticScroll = useRef(false)
  const settleTimer = useRef<number | undefined>(undefined)

  const counters = countersQuery.data ?? []
  // ?c= is truth, validated on every render — unknown or remotely deleted falls back to the
  // oldest counter (the list is created-asc).
  const paramId = searchParams.get('c') ?? ''
  const active = counters.find((c) => c.id === paramId) ?? counters[0] ?? null
  const activeIndex = active ? counters.findIndex((c) => c.id === active.id) : -1
  const display = active ? foldValue(active.value, active.id, pending) : 0

  // Keep the pager on the active page (initial mount, strip taps, remote create/delete).
  useEffect(() => {
    const pager = pagerRef.current
    if (!pager || activeIndex < 0) return
    const target = activeIndex * pager.clientWidth
    if (Math.abs(pager.scrollLeft - target) < 2) return
    programmaticScroll.current = true
    pager.scrollTo({ left: target })
  }, [activeIndex, counters.length])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  // A settled swipe writes the nearest snap page back to ?c= (replace — no history churn).
  const onPagerScroll = () => {
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const pager = pagerRef.current
      if (!pager) return
      if (programmaticScroll.current) {
        programmaticScroll.current = false
        return
      }
      const index = Math.round(pager.scrollLeft / pager.clientWidth)
      const counter = counters[index]
      if (counter && counter.id !== active?.id) {
        setSearchParams({ c: counter.id }, { replace: true })
      }
    }, 80)
  }

  const switchTo = (counterId: string) => {
    if (counterId !== active?.id) setSearchParams({ c: counterId }, { replace: true })
  }

  const goBack = () => {
    const idx = (window.history.state?.idx as number | undefined) ?? 0
    if (idx > 0) navigate(-1)
    else navigate(`/projects/${id}`, { replace: true })
  }

  const tap = (n: number) => {
    if (!active) return
    const before = foldValue(active.value, active.id, pending)
    if (n < 0 && before <= 0) return
    haptic.tick() // must fire inside the tap's own gesture; resets/edits don't tick
    appendOps(buildTapOps(counters, active.id, n))
    if (n > 0 && !reducedMotion) {
      setPulseTick((t) => t + 1)
      if (crossesTarget(active.target, before, before + n)) setStarring(true)
    }
  }

  const reset = () => {
    if (!active) return
    appendOps([{ kind: 'set', counterId: active.id, value: 0 }]) // sets never chain (SPEC §11)
    setResetSheetOpen(false)
  }

  const setValue = (value: number) => {
    if (!active) return
    appendOps([{ kind: 'set', counterId: active.id, value }])
  }

  const projectName = projectQuery.data?.name ?? ''

  return (
    <div
      data-theme={dim ? 'stitchesdim' : undefined}
      className={`relative flex h-dvh touch-manipulation flex-col overflow-hidden bg-base-200 text-base-content select-none overscroll-none ${CROSS_FADE}`}
    >
      {/* 56 px bar */}
      <div
        className="flex h-14 shrink-0 items-center gap-1 px-3"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <BarButton label="Back" onPress={goBack}>
          <ChevronLeft size={24} strokeWidth={2} />
        </BarButton>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{projectName}</h1>
        <BarButton label="Dim mode" active={dim} onPress={() => setPref('counterDim', !dim)}>
          <Moon size={22} strokeWidth={2} />
        </BarButton>
        {wakeLockSupported && (
          <BarButton
            label="Keep screen awake"
            active={wake}
            onPress={() => setPref('counterWakeLock', !wake)}
          >
            <Coffee size={22} strokeWidth={2} />
          </BarButton>
        )}
        {active && (
          <BarButton label="Edit counter" onPress={() => setEditSheetOpen(true)}>
            <Pencil size={22} strokeWidth={2} />
          </BarButton>
        )}
      </div>

      {/* The syncing stitch, tucked in the top corner under the bar (DESIGN §10). */}
      {syncing && (
        <div className="absolute right-4" style={{ top: 'calc(env(safe-area-inset-top) + 3.75rem)' }}>
          <SyncStitch />
        </div>
      )}

      {countersQuery.isPending ? (
        <div className="grid flex-1 place-items-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : countersQuery.isError ? (
        // Offline reopen lands here (memory cache died with the app) — never the empty state.
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            The counters couldn't load — try again in a moment.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void countersQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : counters.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-base" style={{ color: 'var(--ink-muted)' }}>
            Nothing to count yet — add one and keep your place.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setEditSheetOpen(true)}
          >
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
            Add a counter
          </button>
        </div>
      ) : (
        <>
          {/* VoiceOver hears one polite value, not every duplicated pager numeral. */}
          {active && (
            <div aria-live="polite" className="sr-only">
              {active.label}: {display}
            </div>
          )}

          {/* Numeral pager — swipeable, one page per counter (p07: the numeral zone swipes). */}
          <div
            ref={pagerRef}
            onScroll={onPagerScroll}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {counters.map((counter) => {
              const value = foldValue(counter.value, counter.id, pending)
              const resetters = counters.filter((c) => c.resets_with === counter.id)
              const parent = counters.find((c) => c.id === counter.resets_with)
              const isActive = counter.id === active?.id
              return (
                <div
                  key={counter.id}
                  aria-hidden={!isActive}
                  className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-2 px-8"
                >
                  <p className="text-lg font-semibold" style={{ color: 'var(--ink-muted)' }}>
                    {counter.label}
                  </p>
                  {reducedMotion ? (
                    <span
                      className="font-display leading-none font-bold tabular-nums"
                      style={{
                        fontSize: 'clamp(5.5rem, 26dvh, 10.5rem)',
                        textShadow: dim
                          ? '0 0 24px color-mix(in srgb, var(--color-primary) 45%, transparent)'
                          : undefined,
                      }}
                    >
                      {value}
                    </span>
                  ) : (
                    <motion.span
                      key={value}
                      initial={{ y: '0.08em', scale: 1.05 }}
                      animate={{ y: 0, scale: 1 }}
                      transition={{ duration: 0.18, ease: [0.2, 0.9, 0.3, 1.15] }}
                      className="font-display leading-none font-bold tabular-nums"
                      style={{
                        fontSize: 'clamp(5.5rem, 26dvh, 10.5rem)',
                        textShadow: dim
                          ? '0 0 24px color-mix(in srgb, var(--color-primary) 45%, transparent)'
                          : undefined,
                      }}
                    >
                      {value}
                    </motion.span>
                  )}
                  {counter.target > 0 && (
                    <div className="flex w-full max-w-64 flex-col items-center gap-1.5">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: 'var(--color-base-300)' }}
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: 'var(--color-primary)',
                            width: `${Math.min(100, (value / counter.target) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                        {value} of {counter.target} {counter.label.toLowerCase()}
                      </p>
                    </div>
                  )}
                  {resetters.length > 0 && (
                    <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                      {counter.label} +1 resets {resetters.map((c) => c.label).join(' & ')}
                    </p>
                  )}
                  {parent && (
                    <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                      Resets with {parent.label}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Dots + the tap-to-switch strip of live values. */}
          {counters.length > 1 && (
            <>
              <div className="flex shrink-0 justify-center gap-1.5 pt-1 pb-2" aria-hidden="true">
                {counters.map((counter) => (
                  <span
                    key={counter.id}
                    className="size-2 rounded-full"
                    style={{
                      background:
                        counter.id === active?.id
                          ? 'var(--color-primary)'
                          : 'var(--color-base-300)',
                    }}
                  />
                ))}
              </div>
              <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {counters.map((counter) => {
                  const isActive = counter.id === active?.id
                  return (
                    <button
                      key={counter.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => switchTo(counter.id)}
                      className={`flex h-11 shrink-0 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-semibold ${CROSS_FADE}`}
                      style={
                        isActive
                          ? {
                              background: 'var(--color-base-100)',
                              borderColor: 'var(--color-primary)',
                            }
                          : { borderColor: 'var(--color-base-300)', color: 'var(--ink-muted)' }
                      }
                    >
                      <span className="max-w-32 truncate">{counter.label}</span>
                      <span className="font-display font-bold tabular-nums">
                        {foldValue(counter.value, counter.id, pending)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* 44 px action row: −1 · edit value · reset. */}
          <div className="flex shrink-0 gap-3 px-5 pb-3">
            <button
              type="button"
              aria-label="Minus one"
              className="btn btn-ghost h-11 min-h-11 flex-1 font-display text-xl"
              disabled={display <= 0}
              onClick={() => tap(-1)}
            >
              −1
            </button>
            <button
              type="button"
              aria-label="Edit value"
              className="btn btn-ghost h-11 min-h-11 flex-1"
              onClick={() => setValueSheetOpen(true)}
            >
              <Pencil size={18} strokeWidth={2} aria-hidden="true" />
              edit
            </button>
            <button
              type="button"
              aria-label="Reset to zero"
              className="btn btn-ghost h-11 min-h-11 flex-1"
              onClick={() => setResetSheetOpen(true)}
            >
              reset
            </button>
          </div>

          {/* The tap zone: full-width, bottom-anchored, the whole thing is +1 (DESIGN §10). */}
          <button
            type="button"
            aria-label="Plus one"
            onClick={() => tap(1)}
            className={`flex w-full shrink-0 items-center justify-center transition-transform active:scale-[0.98] ${CROSS_FADE}`}
            style={{
              height: 'calc(clamp(120px, 22dvh, 180px) + env(safe-area-inset-bottom))',
              paddingBottom: 'env(safe-area-inset-bottom)',
              background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
              borderTopLeftRadius: 'var(--radius-box)',
              borderTopRightRadius: 'var(--radius-box)',
            }}
          >
            <span
              className="font-display text-3xl font-bold"
              style={{ color: 'var(--color-primary)' }}
              aria-hidden="true"
            >
              +1
            </span>
          </button>
        </>
      )}

      {/* Tap feedback: a brief primary pulse at 8% over the whole surface. */}
      {pulseTick > 0 && (
        <motion.div
          key={pulseTick}
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--color-primary)' }}
          initial={{ opacity: 0.08 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
      {starring && <TargetStar onComplete={() => setStarring(false)} />}
      {haptic.element}

      <CounterSheet
        open={editSheetOpen}
        projectId={id}
        counter={counters.length === 0 ? null : active}
        counters={counters}
        onClose={() => setEditSheetOpen(false)}
      />
      {active && (
        <>
          <EditValueSheet
            open={valueSheetOpen}
            label={active.label}
            current={display}
            onSet={setValue}
            onClose={() => setValueSheetOpen(false)}
          />
          <ResetConfirmSheet
            open={resetSheetOpen}
            label={active.label}
            onConfirm={reset}
            onClose={() => setResetSheetOpen(false)}
          />
        </>
      )}
    </div>
  )
}
