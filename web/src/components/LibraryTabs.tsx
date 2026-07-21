// web/src/components/LibraryTabs.tsx — the Library's segmented control (ADDONS §2.3): two
// pills, Patterns · Yarn, topping both /patterns and /yarn. Pure navigation between the two
// roots; each route keeps its own independent URL filter state ACROSS switches (a Session 6.1
// acceptance criterion) — the last search string per root is remembered module-locally and
// restored on the way back. Each pill's own NavLink isActive is exact here (1:1 route match) —
// only the Dock needs the two-root wrapper.
import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'

type LibraryRoot = '/patterns' | '/yarn'

// Module scope on purpose: filter memory should survive the pages unmounting (tab switches)
// but not a page reload — exactly a module variable's lifetime.
const lastSearch: Record<LibraryRoot, string> = { '/patterns': '', '/yarn': '' }

const pillClass = 'flex h-11 items-center rounded-full px-4 text-sm font-semibold'

const pillStyle = (isActive: boolean): React.CSSProperties =>
  isActive
    ? { background: 'var(--patch-blue-soft)', color: 'var(--patch-blue-deep)' }
    : { color: 'var(--ink-muted)' }

export function LibraryTabs() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/patterns' || location.pathname === '/yarn') {
      lastSearch[location.pathname] = location.search
    }
  }, [location])

  return (
    <div className="flex gap-1 px-5" aria-label="Library sections">
      <NavLink
        to={{ pathname: '/patterns', search: lastSearch['/patterns'] }}
        end
        className={pillClass}
        style={({ isActive }) => pillStyle(isActive)}
      >
        Patterns
      </NavLink>
      <NavLink
        to={{ pathname: '/yarn', search: lastSearch['/yarn'] }}
        end
        className={pillClass}
        style={({ isActive }) => pillStyle(isActive)}
      >
        Yarn
      </NavLink>
    </div>
  )
}
