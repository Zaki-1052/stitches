// web/src/routes/FriendsPage.tsx — the Friends feed (/friends, DESIGN §9): a cozy feed of
// friends' shared patterns and finished objects with owner avatars, one merged list newest
// first (p11 plan). Renders inside AppShell (header + dock for free). Looking is the whole
// feature — taps land on the read-only detail reuse; nothing here composes or mutates, so
// there's no heading and no controls row (Home precedent: straight into content).
import { useFriendsFeed, feedItemKey } from '../features/friends/queries.ts'
import { FeedCard } from '../features/friends/components/FeedCard.tsx'
import { FriendsEmptyState } from '../features/friends/components/FriendsEmptyState.tsx'

export default function FriendsPage() {
  const feedQuery = useFriendsFeed()
  const items = feedQuery.data ?? []

  return (
    <div className="flex flex-col gap-4">
      {feedQuery.isPending ? (
        <div className="flex flex-col gap-3 px-5">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-box flex items-center gap-3 bg-base-100 p-3">
              <div className="skeleton size-20 shrink-0 rounded-2xl" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : feedQuery.isError ? (
        <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            The feed couldn't load.
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => void feedQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <FriendsEmptyState />
      ) : (
        <div className="flex flex-col gap-3 px-5 pt-1">
          {items.map((item) => (
            <FeedCard key={feedItemKey(item)} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
