// web/src/features/counters/realtime.ts — the app's first realtime subscription (SPEC §11:
// realtime scope is counters only, subscribed per open project). PB realtime is SSE; the SDK
// reconnects transparently and re-sends every topic — including its filter option — on
// reconnect (verified against pocketbase 0.27.0). Cleanup uses the cancelled-flag idiom:
// subscribe is async, and StrictMode's first cleanup can run before the promise resolves.
// Events write server truth through the shared cache funnel; the outbox fold keeps pending
// local taps painted on top.
import { useEffect } from 'react'
import { pb } from '../../lib/pb.ts'
import { dropOpsFor } from '../../lib/outbox.ts'
import type { CounterRecord } from '../../lib/schema.ts'
import { applyServerCounter, removeCounterFromCache } from './queries.ts'

export function useCountersRealtime(projectId: string): void {
  useEffect(() => {
    if (projectId === '') return
    let cancelled = false
    let unsubscribe: (() => void | Promise<void>) | null = null

    pb.collection('counters')
      .subscribe<CounterRecord>(
        '*',
        (event) => {
          if (event.record.project !== projectId) return // belt and braces over the filter
          if (event.action === 'delete') {
            dropOpsFor(event.record.id) // taps queued for a remotely deleted counter
            removeCounterFromCache(event.record)
          } else {
            applyServerCounter(event.record)
          }
        },
        { filter: pb.filter('project = {:id}', { id: projectId }) },
      )
      .then((unsub) => {
        if (cancelled) void unsub()
        else unsubscribe = unsub
      })
      .catch((err: unknown) => console.warn('[realtime] counters subscribe failed', err))

    return () => {
      cancelled = true
      void unsubscribe?.()
    }
  }, [projectId])
}
