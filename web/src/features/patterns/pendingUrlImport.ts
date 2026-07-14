// web/src/features/patterns/pendingUrlImport.ts — the in-memory bridge between the quick-add
// paste-a-link door and /patterns/new, mirroring pendingAttachmentImport. A ProcessedImage
// doesn't survive history.state reliably, so the extracted pre-fill is stashed here and
// consumed exactly once by the form page. A full reload simply loses it and the form opens
// blank — manual entry is never blocked.
import { useRef } from 'react'
import type { PatternFormValues } from '../../lib/schema.ts'
import type { ProcessedImage } from '../shared/imagePipeline.ts'

export interface PendingUrlImport {
  defaults: Partial<PatternFormValues> // merged over patternFormDefaults by PatternFormPage
  importedFrom: string | null // chip label; null on the soft-failure path (no chip)
  thumbnail: ProcessedImage | null // null when og:image is absent or its fetch/pipeline soft-failed
}

let pending: PendingUrlImport | null = null

export function setPendingUrlImport(next: PendingUrlImport) {
  pending = next
}

const UNSET = Symbol('unset')

// One-shot synchronous consume on first render. A ref — not a lazy useState initializer or an
// effect — because StrictMode's dev-only double-invoke runs those twice: the second pass would
// find the module already emptied and null out the real import. The ref object survives the
// double-invoke, so the guard actually guards; and resolving during render (not in an effect)
// lets the page fold the result straight into useForm defaultValues, no reset() dance.
export function useConsumePendingUrlImport(): PendingUrlImport | null {
  const ref = useRef<PendingUrlImport | null | typeof UNSET>(UNSET)
  if (ref.current === UNSET) {
    ref.current = pending
    pending = null
  }
  return ref.current
}
