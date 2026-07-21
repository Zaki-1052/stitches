// web/src/features/friends/queries.ts — read-side hooks for the Friends feed (DESIGN §9:
// "a cozy feed of shared patterns and finished objects with owner avatars"). One query merges
// friends' shared patterns (dated by created) and friends' shared FINISHED projects (dated by
// finished_on, falling back to updated). The viewer's own shared items are excluded — this
// screen is everyone else's news. Rules alone would already scope the reads; the filters here
// narrow to the feed's editorial shape. No invalidation plumbing on purpose: the viewer can't
// mutate friends' content, so 30 s staleTime + refetch-on-focus is the freshness story.
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import type { PatternRecord, ProjectRecord } from '../../lib/schema.ts'

export const friendsKeys = {
  all: ['friends'] as const,
  feed: (viewerId: string) => [...friendsKeys.all, 'feed', viewerId] as const,
}

// A feed entry: `date` is the sort key, pre-extracted so the merge is one comparator.
export type FeedItem =
  | { kind: 'pattern'; date: string; pattern: PatternRecord }
  | { kind: 'finished_object'; date: string; project: ProjectRecord }

export function feedItemKey(item: FeedItem): string {
  // Kind-prefixed: a pattern id and a project id could theoretically collide across collections.
  return item.kind === 'pattern' ? `pattern-${item.pattern.id}` : `fo-${item.project.id}`
}

// One implementation for the hook and lib/sync.ts (no shape drift between them). The expands
// are supersets of what the feed cards render: `tags` and `yarns` ride along so sync's seeded
// DETAIL caches (usePattern / useProject shapes) are complete for friend-shared records too.
// Explicit per-caller requestKeys: a background sync must never auto-cancel a mounted feed
// read on the same method+path (DECISIONS 2026-07-19).
async function fetchFeed(viewerId: string, keyPrefix: string): Promise<FeedItem[]> {
  const [patterns, projects] = await Promise.all([
    pb.collection('patterns').getFullList<PatternRecord>({
      filter: pb.filter('visibility = "friends" && owner != {:me}', { me: viewerId }),
      sort: '-created',
      expand: 'tags,owner',
      requestKey: `${keyPrefix}:patterns`,
    }),
    pb.collection('projects').getFullList<ProjectRecord>({
      filter: pb.filter('visibility = "friends" && status = "finished" && owner != {:me}', {
        me: viewerId,
      }),
      sort: '-finished_on,-updated',
      expand: 'owner,pattern,yarns',
      requestKey: `${keyPrefix}:projects`,
    }),
  ])
  // PB datetimes are UTC strings — lexical compare is chronological (lib/dates.ts rule),
  // and date-only finished_on ("… 00:00:00.000Z") interleaves fine with full stamps.
  return [
    ...patterns.map((p) => ({ kind: 'pattern' as const, date: p.created, pattern: p })),
    ...projects.map((p) => ({
      kind: 'finished_object' as const,
      date: p.finished_on || p.updated,
      project: p,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function useFriendsFeed() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: friendsKeys.feed(viewerId),
    enabled: viewerId !== '',
    queryFn: () => fetchFeed(viewerId, 'feed'),
  })
}

export function fetchFriendsFeedForSync(viewerId: string): Promise<FeedItem[]> {
  return fetchFeed(viewerId, 'sync:feed')
}
