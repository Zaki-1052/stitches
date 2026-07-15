// web/src/components/Dock.tsx — bottom navigation (DESIGN §8). daisyUI `dock` (fixed, safe-area
// aware) with a raised 56px center "+" (blue circle, espresso plus). Slots: Home · Library · ➕ ·
// Projects · Friends (the 5th slot landed in 4.1; ➕ stays the center child). ➕ opens the
// quick-add sheet with its three doors.
import { useState } from 'react'
import { NavLink } from 'react-router'
import { House, Library, FolderHeart, Plus, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { QuickAddSheet } from '../features/patterns/components/QuickAddSheet.tsx'

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
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  return (
    <>
      <nav className="dock" style={{ background: 'var(--color-base-100)' }}>
        <DockTab to="/" label="Home" icon={House} end />
        <DockTab to="/patterns" label="Library" icon={Library} />

        <button type="button" aria-label="Add a pattern" onClick={() => setQuickAddOpen(true)}>
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
        <DockTab to="/friends" label="Friends" icon={UsersRound} />
      </nav>

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  )
}
