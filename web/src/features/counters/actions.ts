// web/src/features/counters/actions.ts — the one place that knows what a tap *means*
// (SPEC §11): incrementing counter A enqueues inc(A,+n) plus set(B,0) for every B whose
// resets_with = A. Resets fire only on increments — a set never chains, so links can't loop
// and a manual reset never zeroes anything else. Shared by the surface tap zone and the
// detail-card ± (identical semantics; p07 plan).
import type { CounterRecord } from '../../lib/schema.ts'
import type { CounterOp } from '../../lib/outbox.ts'

export function buildTapOps(
  counters: readonly CounterRecord[],
  activeId: string,
  n: number,
): CounterOp[] {
  const ops: CounterOp[] = [{ kind: 'inc', counterId: activeId, n }]
  if (n > 0) {
    for (const counter of counters) {
      if (counter.resets_with === activeId && counter.id !== activeId) {
        ops.push({ kind: 'set', counterId: counter.id, value: 0 })
      }
    }
  }
  return ops
}

// Did a local increment just cross the target from below? Fires the one mint star (DESIGN §7);
// re-crossing after a reset fires again, which is exactly right for repeat trackers.
export function crossesTarget(target: number, before: number, after: number): boolean {
  return target > 0 && before < target && after >= target
}
