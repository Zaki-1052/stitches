// web/src/routes/HomePage.tsx — home landing stub. The real "on the hook right now" feed and
// quick-add arrive in Phase 1; for now it's a friendly empty state that proves the shell renders.
export default function HomePage() {
  return (
    <div className="px-5 py-4">
      <section
        className="rounded-box bg-base-100 p-6 text-center"
        style={{ boxShadow: 'var(--shadow-soft)' }}
      >
        <p className="font-display text-lg font-bold">nothing on the hook yet</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Your works-in-progress will nest here.
        </p>
      </section>
    </div>
  )
}
