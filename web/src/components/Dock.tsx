// web/src/components/Dock.tsx — primary navigation (DESIGN §8). On phones: daisyUI `dock`
// (fixed, safe-area aware) with a raised 56px center "+" (blue circle, espresso plus). Slots:
// Home · Library · ➕ · Projects · Friends. At lg+ the dock becomes a slim top bar (DESIGN §5)
// rendered as a second plain-Tailwind nav — daisyUI bakes the dock's column layout into
// `.dock > *` compound selectors, so a separate markup variant beats fighting its specificity.
// Both variants share routes and the same ➕ handler opening the quick-add sheet.
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { House, Library, FolderHeart, Plus, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { QuickAddSheet } from '../features/patterns/components/QuickAddSheet.tsx'

const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/patterns', label: 'Library', icon: Library },
  { to: '/projects', label: 'Projects', icon: FolderHeart },
  { to: '/friends', label: 'Friends', icon: UsersRound },
]

function DockTab({
  to,
  label,
  icon: Icon,
  end,
  forceActive,
}: {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  // The Library slot owns two path roots (/patterns and /yarn — ADDONS §2.3), which NavLink's
  // own isActive can't express; the caller computes it and passes it down.
  forceActive?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => ((forceActive ?? isActive) ? 'dock-active' : undefined)}
    >
      <Icon size={24} strokeWidth={2} />
      <span className="text-[0.75rem] leading-none">{label}</span>
    </NavLink>
  )
}

function TopBarTab({
  to,
  label,
  icon: Icon,
  end,
  forceActive,
}: {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  forceActive?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold"
      style={({ isActive }) =>
        (forceActive ?? isActive) ? { background: 'var(--patch-blue-soft)' } : undefined
      }
    >
      <Icon size={20} strokeWidth={2} />
      {label}
    </NavLink>
  )
}

export function Dock() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  // Library's two-root active state (tapping the slot always lands /patterns).
  const location = useLocation()
  const libraryActive =
    location.pathname.startsWith('/patterns') || location.pathname.startsWith('/yarn')
  return (
    <>
      <nav className="dock lg:hidden" style={{ background: 'var(--color-base-100)' }}>
        <DockTab {...TABS[0]} />
        <DockTab {...TABS[1]} forceActive={libraryActive} />

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

        <DockTab {...TABS[2]} />
        <DockTab {...TABS[3]} />
      </nav>

      <nav
        className="hidden items-center justify-center gap-1 border-b py-2 lg:flex"
        style={{ borderColor: 'var(--color-base-300)', background: 'var(--color-base-100)' }}
      >
        {TABS.map((tab) => (
          <TopBarTab
            key={tab.to}
            {...tab}
            forceActive={tab.to === '/patterns' ? libraryActive : undefined}
          />
        ))}
        <button
          type="button"
          aria-label="Add a pattern"
          onClick={() => setQuickAddOpen(true)}
          className="ml-2 grid size-11 place-items-center rounded-full"
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-base-content)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </nav>

      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  )
}
