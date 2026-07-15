// web/src/features/patterns/components/LazyNotesEditor.tsx — the TipTap bundle seam (4.2).
// NotesEditor is the only thing pulling @tiptap/* into the eager graph, and route splitting
// can't evict it (HomePage → JournalQuickSheet → EntryComposer keeps it on the cold-open path),
// so the editor itself loads on demand. All call sites import this drop-in instead.
import { Suspense, lazy } from 'react'
import type { NotesEditorProps } from './NotesEditor.tsx'

const NotesEditor = lazy(() =>
  import('./NotesEditor.tsx').then((m) => ({ default: m.NotesEditor })),
)

export function LazyNotesEditor(props: NotesEditorProps) {
  return (
    <Suspense fallback={<div className="skeleton h-32 w-full rounded-box" aria-hidden="true" />}>
      <NotesEditor {...props} />
    </Suspense>
  )
}
