// web/src/features/patterns/pendingAttachmentImport.ts — the in-memory bridge between the
// quick-add file door and /patterns/new. File objects don't survive history.state reliably, so
// the processed pick is stashed here and consumed exactly once by the form page. A full reload
// simply loses it and the form opens blank — manual entry is never blocked.
import { useRef } from 'react'
import type { ProcessedImage } from '../shared/imagePipeline.ts'

export interface PendingAttachmentImport {
  suggestedTitle: string
  attachmentFile: File
  attachmentLabel: string
  thumbnail: ProcessedImage | null // null when PDF page-1 rendering soft-failed
}

let pending: PendingAttachmentImport | null = null

export function setPendingAttachmentImport(next: PendingAttachmentImport) {
  pending = next
}

const UNSET = Symbol('unset')

// One-shot synchronous consume on first render. A ref — not a lazy useState initializer or an
// effect — because StrictMode's dev-only double-invoke runs those twice: the second pass would
// find the module already emptied and null out the real pick. The ref object survives the
// double-invoke, so the guard actually guards; and resolving during render (not in an effect)
// lets the page fold the result straight into useForm defaultValues, no reset() dance.
export function useConsumePendingAttachmentImport(): PendingAttachmentImport | null {
  const ref = useRef<PendingAttachmentImport | null | typeof UNSET>(UNSET)
  if (ref.current === UNSET) {
    ref.current = pending
    pending = null
  }
  return ref.current
}
