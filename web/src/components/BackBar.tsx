// web/src/components/BackBar.tsx — the in-app back affordance for pushed subpages. Standalone
// PWAs have no browser chrome, so every subpage renders its own back control (DESIGN §12 #9).
// When the subpage is the first history entry (cold-start deep link), there's nothing to pop, so
// fall back to Home. Tops out at the iOS status-bar safe area.
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { ReactNode } from 'react'

export function BackBar({ title, right }: { title?: string; right?: ReactNode }) {
  const navigate = useNavigate()

  const goBack = () => {
    const idx = (window.history.state?.idx as number | undefined) ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <div
      className="flex items-center gap-1 px-3 pb-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      <button
        type="button"
        onClick={goBack}
        aria-label="Back"
        className="btn btn-ghost btn-circle size-11"
      >
        <ChevronLeft size={24} strokeWidth={2} />
      </button>
      {title && <h1 className="font-display text-xl font-bold lowercase">{title}</h1>}
      {right && <div className="ml-auto flex items-center gap-1">{right}</div>}
    </div>
  )
}
