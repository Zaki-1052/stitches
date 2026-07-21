// web/src/features/yarn/queries.ts — read-side hooks for the stash (ADDONS §2.3). Keys are
// namespaced per collection; the "used in" reverse read lives in features/projects/queries.ts,
// because every projects-collection read hangs off the single ['projects'] root there.
//
// Like the Library, /yarn hard-filters `owner = viewer`: the stash is *your* basket. Friend-
// shared yarns surface only through the project-form picker (useYarnOptions) and project chips.
//
// Every list query carries an explicit requestKey (DECISIONS 2026-07-19): the SDK auto-cancels
// on method+path alone, so concurrent yarns reads (stash list + picker options) would cancel
// each other without one. The key is the query's *logical* identity, not its filter identity —
// a filter change superseding its own in-flight read is exactly the default we want to keep.
import { useQuery } from '@tanstack/react-query'
import { pb } from '../../lib/pb.ts'
import { useAuth } from '../../lib/auth.tsx'
import type { YarnRecord } from '../../lib/schema.ts'
import type { YarnFilters } from './urlParams.ts'

export const yarnKeys = {
  all: ['yarns'] as const,
  lists: () => [...yarnKeys.all, 'list'] as const,
  list: (viewerId: string, filters: YarnFilters) =>
    [...yarnKeys.lists(), viewerId, filters] as const,
  // Nested under lists() so every existing yarn-mutation invalidation catches it too.
  options: (viewerId: string) => [...yarnKeys.lists(), 'options', viewerId] as const,
  details: () => [...yarnKeys.all, 'detail'] as const,
  detail: (id: string) => [...yarnKeys.details(), id] as const,
}

// OR-joins one filter template (`{:value}` placeholder) across a group's selected values —
// within a filter group, any match qualifies.
function anyOf(template: string, values: readonly string[]): string {
  return '(' + values.map((value) => pb.filter(template, { value })).join(' || ') + ')'
}

function buildStashFilter(viewerId: string, f: YarnFilters): string {
  const parts = [pb.filter('owner = {:me}', { me: viewerId })]
  if (f.q) parts.push(pb.filter('(name ~ {:q} || brand ~ {:q} || colorway ~ {:q})', { q: f.q }))
  if (f.weight.length) parts.push(anyOf('weight = {:value}', f.weight))
  return parts.join(' && ')
}

export function useYarns(filters: YarnFilters) {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: yarnKeys.list(viewerId, filters),
    enabled: viewerId !== '',
    queryFn: () =>
      pb.collection('yarns').getFullList<YarnRecord>({
        filter: buildStashFilter(viewerId, filters),
        sort: '-updated',
        requestKey: [...yarnKeys.lists(), viewerId].join(':'),
      }),
  })
}

export function useYarn(id: string) {
  return useQuery({
    queryKey: yarnKeys.detail(id),
    enabled: id !== '',
    // `owner` feeds the shared-by chip on a friend's yarn (users read rules are any-authed).
    queryFn: () => pb.collection('yarns').getOne<YarnRecord>(id, { expand: 'owner' }),
  })
}

// The project-form picker's candidate set, in lockstep with the shipped link guard.
// OWN-ONLY shipped (2026-07-20, DECISIONS): the pinned binary evaluates an OR of two
// multi-relation dot-path conditions per-aggregate — each arm ALL-quantified over the whole
// set — so the friends-linkable form misgrouped and rules-check's legit-mix fixture proved it.
// Offering friend-shared yarns here would just 400 on save. Flip back only with the migration's
// YARN_LINKABLE constants and a fresh empirical proof, never alone.
const FULL_RULE_SHIPPED = false

export function useYarnOptions() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: yarnKeys.options(viewerId),
    enabled: viewerId !== '',
    // Full records, no `fields` projection: the picker chips render photos[0] swatches, and
    // pb.files.getURL needs the record's system fields to build the URL. Stashes are small.
    queryFn: () =>
      pb.collection('yarns').getFullList<YarnRecord>({
        filter: FULL_RULE_SHIPPED
          ? pb.filter('owner = {:me} || visibility = "friends"', { me: viewerId })
          : pb.filter('owner = {:me}', { me: viewerId }),
        sort: '-updated',
        requestKey: yarnKeys.options(viewerId).join(':'),
      }),
  })
}

// lib/sync.ts fetch (ADDONS §3.3): the canonical unfiltered stash with the detail cache's
// expand. Own requestKey per DECISIONS 2026-07-19.
export function fetchYarnsForSync(viewerId: string): Promise<YarnRecord[]> {
  return pb.collection('yarns').getFullList<YarnRecord>({
    filter: pb.filter('owner = {:me}', { me: viewerId }),
    sort: '-updated',
    expand: 'owner',
    requestKey: 'sync:yarns',
  })
}
