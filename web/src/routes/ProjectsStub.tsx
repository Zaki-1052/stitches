// web/src/routes/ProjectsStub.tsx — Projects placeholder; the real project list + counters land in
// later phases. Present so the dock's Projects slot navigates somewhere real.
export default function ProjectsStub() {
  return (
    <div className="grid place-items-center px-5 py-16 text-center">
      <p className="font-display text-xl font-bold">your projects</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
        Makes-in-progress will gather here.
      </p>
    </div>
  )
}
