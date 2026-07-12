// web/src/components/Dock.tsx — bottom navigation (DESIGN §8). daisyUI `dock` (fixed, safe-area
// aware) with a raised 56px center "+" (blue circle, espresso plus). Slots: Home · Library · ➕ ·
// Projects; Friends joins as a 5th in the sharing phase. The quick-add sheet behind ➕ lands in
// Phase 1 — the raised affordance ships now.
import { NavLink } from 'react-router'
import { House, Library, FolderHeart, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function DockTab({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'dock-active' : undefined)}>
      <Icon size={24} strokeWidth={2} />
      <span className="text-[0.75rem] leading-none">{label}</span>
    </NavLink>
  )
}

export function Dock() {
  return (
    <nav className="dock" style={{ background: 'var(--color-base-100)' }}>
      <DockTab to="/" label="Home" icon={House} end />
      <DockTab to="/patterns" label="Library" icon={Library} />

      <button
        type="button"
        aria-label="Add"
        onClick={() => console.info('[dock] quick-add sheet arrives in Phase 1')}
      >
        <span
          className="grid size-14 -translate-y-4 place-items-center rounded-full"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-base-content)',
            boxShadow: 'var(--shadow-lift)',
          }}
        >
          <Plus size={28} strokeWidth={2.5} />
        </span>
      </button>

      <DockTab to="/projects" label="Projects" icon={FolderHeart} />
    </nav>
  )
}
