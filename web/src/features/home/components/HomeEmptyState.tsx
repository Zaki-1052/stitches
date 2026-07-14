// web/src/features/home/components/HomeEmptyState.tsx — the true new-user state (DESIGN §9:
// "illustration + 'start your library'"): no projects, no patterns, whole craft room ahead.
// Whimsy budget applies (DESIGN §11). The doors row rendered below it is the CTA.
import { YarnBasket } from '../../../components/YarnBasket.tsx'

export function HomeEmptyState() {
  return (
    <section className="flex flex-col items-center gap-3 px-5 pt-6 pb-2 text-center">
      <YarnBasket size={136} />
      <h2 className="font-display text-2xl font-bold">Start your library</h2>
      <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
        Save a pattern you love — the hook comes later.
      </p>
    </section>
  )
}
