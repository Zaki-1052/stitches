// web/src/features/counters/useOutboxErrorToasts.ts — bridges the outbox's rare dropped-op
// reports (lib/outbox.ts) into the toast system. Mounted by whichever counter screen is up
// (the card or the surface — never both); with neither mounted, drops still land in the
// console, and the value self-corrects from server truth either way.
import { useEffect } from 'react'
import { subscribeOutboxErrors } from '../../lib/outbox.ts'
import { useToast } from '../shared/toast.tsx'

export function useOutboxErrorToasts(): void {
  const toast = useToast()
  useEffect(() => subscribeOutboxErrors((message) => toast(message, 'error')), [toast])
}
