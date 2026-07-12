// web/src/routes/LibraryStub.tsx — Library (patterns) placeholder; the real pattern grid lands in
// Phase 1. Present so the dock's Library slot navigates somewhere real.
export default function LibraryStub() {
  return (
    <div className="grid place-items-center px-5 py-16 text-center">
      <p className="font-display text-xl font-bold">the library</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
        Patterns will live here soon.
      </p>
    </div>
  )
}
