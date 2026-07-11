// web/src/routes/TokensPage.tsx — throwaway token demo route (Session 0.1 acceptance surface).
// Every color on this page comes from theme.css tokens: daisyUI semantic classes for theme
// colors, inline var() references for the patch accents (they aren't semantic colors, and
// Tailwind can't statically extract dynamically-built class names).
import type { ReactNode } from 'react'

const semantics = [
  { name: 'base-100', cls: 'bg-base-100 text-base-content border border-base-300' },
  { name: 'base-200', cls: 'bg-base-200 text-base-content border border-base-300' },
  { name: 'base-300', cls: 'bg-base-300 text-base-content' },
  { name: 'primary', cls: 'bg-primary text-primary-content' },
  { name: 'secondary', cls: 'bg-secondary text-secondary-content' },
  { name: 'accent', cls: 'bg-accent text-accent-content' },
  { name: 'neutral', cls: 'bg-neutral text-neutral-content' },
  { name: 'info', cls: 'bg-info text-info-content' },
  { name: 'success', cls: 'bg-success text-success-content' },
  { name: 'warning', cls: 'bg-warning text-warning-content' },
  { name: 'error', cls: 'bg-error text-error-content' },
]

const dimSemantics = semantics.filter(
  (s) => !['secondary', 'info', 'success', 'warning'].includes(s.name),
)

const patches = ['blue', 'coral', 'lilac', 'mint', 'butter'] as const

function SwatchGrid({ items }: { items: typeof semantics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((s) => (
        <div key={s.name} className={`rounded-selector p-3 text-sm font-semibold ${s.cls}`}>
          {s.name}
        </div>
      ))}
    </div>
  )
}

function PatchChips({ selected }: { selected: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {patches.map((p) => (
        <span
          key={p}
          className={`badge badge-lg border-none font-semibold ${selected ? 'text-base-content' : ''}`}
          style={
            selected
              ? { background: `var(--patch-${p})` }
              : { background: `var(--patch-${p}-soft)`, color: `var(--patch-${p}-deep)` }
          }
        >
          {p}
        </span>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function TokensPage() {
  return (
    <main className="mx-auto max-w-[1080px] space-y-8 p-5">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">stitches · tokens</h1>
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          Throwaway demo route for Session 0.1 — body text is Nunito, headings are Baloo 2.
        </p>
      </header>

      <Section title="Theme colors (stitches)">
        <SwatchGrid items={semantics} />
      </Section>

      <Section title="Patch chips">
        <PatchChips selected={false} />
        <PatchChips selected={true} />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary min-h-12">Count a row</button>
          <button
            className="btn min-h-12 border-none"
            style={{ background: 'var(--patch-mint-soft)', color: 'var(--patch-mint-deep)' }}
          >
            Tonal
          </button>
          <button className="btn btn-ghost min-h-12">Ghost</button>
          <button className="btn btn-error min-h-12">Delete</button>
        </div>
      </Section>

      <Section title="Card elevation">
        <div
          className="card rounded-box bg-base-100 p-5"
          style={{ boxShadow: 'var(--shadow-soft)' }}
        >
          <p>
            A card on <code>base-100</code> with the warm <code>--shadow-soft</code>. Links use{' '}
            <a href="#top" className="text-info underline">
              the info token
            </a>
            .
          </p>
        </div>
      </Section>

      <section data-theme="stitchesdim" className="rounded-box bg-base-200 p-5">
        <div className="space-y-3 text-base-content">
          <h2 className="font-display text-xl font-semibold">The moonlit counter (stitchesdim)</h2>
          <SwatchGrid items={dimSemantics} />
          <p
            className="font-display text-6xl font-bold"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            42
          </p>
          <button className="btn btn-primary min-h-12">+1 row</button>
        </div>
      </section>
    </main>
  )
}
