// web/src/features/friends/components/FriendsEmptyState.tsx — the feed before any friend has
// shared a make. Deliberately no CTA: a viewer can't fill someone else's feed, and DESIGN §11
// says never guilt. Copy approved with the p11 plan (em-dash-free per Zara).
import { YarnBasket } from '../../../components/YarnBasket.tsx'

export function FriendsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
      <YarnBasket size={120} />
      <p className="font-display max-w-64 text-xl font-bold">
        All quiet on the hook. Friends' makes will land here ♡
      </p>
    </div>
  )
}
