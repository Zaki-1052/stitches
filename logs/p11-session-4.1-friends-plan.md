# p11 — Session 4.1: Friends (the group sees each other's makes — and only what they should)

## Context

Phase 4 opens with Session 4.1 (one session brief per sitting; 4.2 PWA/polish is the next
sitting). PLAN 4.1 lists four build items — and exploration shows **two are already done**:

- **Visibility toggles with exact helper copy** — `VisibilityToggle.tsx` ships on both detail
  pages with the verbatim approved lines ("Friends can see this pattern's info and photos —
  never your files." / "Friends can see this project and its journal — counters stay yours.").
- **Read-only detail reuse** — both detail pages already branch on
  `isOwner = record.owner === user?.id`: edit/delete/shelf/status-sheet/visibility owner-gated;
  `AttachmentsCard` and `CountersCard` never mount for non-owners (CountersCard also self-gates:
  `useCounters(isOwner ? id : '')` + early `return null`); `JournalFeed` renders read-only for
  viewers. The API rules have permitted shared reads since Session 1.1 — counters/attachments
  are owner-only at the rule layer, so a UI bug can't leak them.

The net-new surface is narrow: the **Friends dock tab (5th slot)**, the **`/friends` shared
feed** with owner avatars, small supporting pieces (shared `<Avatar>`, owner-attribution chip,
`expand: 'owner'` on the two detail hooks), and one tiny **migration** (`users.avatar` has no
declared thumb sizes — PB serves `?thumb=` only for pre-declared sizes, and SPEC §8 says lists
never load originals). **Because a migration lands, the regression gate escalates from
`verify:rules` to `npm run verify:fresh`.**

**Zara's picks (AskUserQuestion, this plan):**
1. **Feed scope: finished only** — feed = friends' shared patterns + friends' shared **finished**
   projects (DESIGN §9 "shared patterns and finished objects" read literally). Shared WIPs stay
   reachable via shared patterns' linked-projects lists; they join the feed when finished.
2. **One merged feed**, newest first — patterns dated by `created`, finished objects by
   `finished_on` (fallback `updated`); meta lines ("added 12 Jul 2026" / "finished 12 Jul 2026 ☆")
   differentiate the kinds. Viewer's own items excluded (PLAN goal: "each other's makes").
3. **"shared by {name}" chip** on both read-only detail pages (non-owners only) — mini avatar +
   name; on patterns it takes the shelf-pill's slot (owner-only anyway).
4. **Empty-state copy**: whimsy kept, **no em-dashes, don't sound like a bot** → all new p11
   microcopy is written em-dash-free (below).

**Facts verified (not guessed):**
- Rules (migration `1783819397`): patterns/projects list/view
  `@request.auth.id != "" && (owner = @request.auth.id || visibility = "friends")`;
  journal_entries read `… || project.visibility = "friends"`; counters + pattern_attachments
  all owner-only; tags read any-authed; users list/view any-authed (name + avatar readable).
- `scripts/rules-check.mjs` already asserts the full B-vs-A matrix (incl. "attachment on shared
  pattern invisible", "counter on shared project invisible") — 4.1 is a re-run, no new checks.
- Detail hooks `usePattern`/`useProject` have no owner filter (rule-scoped) — already work
  cross-owner. All list hooks hard-filter `owner = {:me}` — the feed needs new hooks.
- `useCountersRealtime('')` short-circuits (`if (projectId === '') return`) — the owner-gate is
  literally an argument change. Optimistic quick-updates spread `{ ...previous, ...body }`, so an
  added `expand.owner` survives them.
- `lucide-react` 1.24.0 exports `UsersRound` (checked `.d.ts`) — rounded variant matches `House`/
  `FolderHeart`. daisyUI `dock` distributes children evenly: 5 children keep ➕ centered (3 of 5).
  DESIGN §8 pre-authorizes the 5th slot ("Friends joins as the 5th in the sharing phase").
- `formatShortDate` exists in `lib/dates.ts`; `YarnBall`/`YarnBasket` components exist. PB
  datetimes are UTC strings — lexical compare is chronological; date-only `finished_on`
  ("… 00:00:00.000Z") interleaves correctly with full stamps.
- PB generates declared thumbs **lazily on first request** — existing avatars need no backfill.
- List pages handle query errors with **inline muted copy + ghost Retry** (not toasts) —
  FriendsPage matches that pattern.

## Files

```
pb/pb_migrations/<date +%s>_users_avatar_thumbs.js        NEW — thumbs ['100x100'] on users.avatar
web/src/lib/schema.ts                                     MOD — UserRecord + expand types
web/src/components/Avatar.tsx                             NEW — shared initials-fallback avatar
web/src/components/AppHeader.tsx                          MOD — use <Avatar> (drops original-file load)
web/src/components/AppShell.tsx                           MOD — comment only
web/src/components/Dock.tsx                               MOD — 5th DockTab
web/src/main.tsx                                          MOD — /friends route under AppShell
web/src/features/friends/queries.ts                       NEW — friendsKeys + useFriendsFeed
web/src/features/friends/components/FeedCard.tsx          NEW — person-first feed card
web/src/features/friends/components/FriendsEmptyState.tsx NEW — YarnBasket + whimsy line
web/src/features/friends/components/SharedByChip.tsx      NEW — attribution chip
web/src/routes/FriendsPage.tsx                            NEW — the feed screen
web/src/features/patterns/queries.ts                      MOD — usePattern expand 'tags,owner' + comment tense
web/src/features/projects/queries.ts                      MOD — useProject expand 'pattern,owner' + comment tense
web/src/routes/PatternDetailPage.tsx                      MOD — SharedByChip in shelf slot
web/src/routes/ProjectDetailPage.tsx                      MOD — SharedByChip + realtime owner-gate
web/src/routes/LibraryPage.tsx                            MOD — comment tense
web/package.json                                          MOD — version 0.4.1
docs/DECISIONS.md                                         MOD — ~7 lines
logs/p11-session-4.1-friends-plan.md + logs/2026-07-14_session-4.1-friends.md
```

---

## Task 1 — migration: `users.avatar` thumbs

New file `pb/pb_migrations/<date +%s>_users_avatar_thumbs.js` (timestamp must sort after
`1783819397_…`; take it at creation time). Style copied from `1783806920_configure_users.js`:

```js
/// <reference path="../pb_data/types.d.ts" />

// pb/pb_migrations/<ts>_users_avatar_thumbs.js
// Session 4.1 — declare a 100x100 thumb on users.avatar so the friends feed, shared-by chips,
// and the header load avatar thumbnails instead of originals (SPEC §8 "lists never load
// originals"; DECISIONS 2026-07-11 thumbs precedent). PB serves `?thumb=` only for pre-declared
// sizes and generates them lazily on first request, so existing avatars need no backfill.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.getByName('avatar').thumbs = ['100x100']
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.getByName('avatar').thumbs = []
    app.save(users)
  },
)
```

## Task 2 — `web/src/lib/schema.ts`: `UserRecord` + expand types

```ts
// Public slice of the `users` auth collection (list/view any-authed per Session 0.2; email
// stays hidden behind emailVisibility). What friends' avatars and names render from.
export interface UserRecord {
  id: string
  name: string
  avatar: string
}
```
- `PatternRecord.expand?: { tags?: TagRecord[]; owner?: UserRecord }`
- `ProjectRecord.expand?: { pattern?: PatternRecord; owner?: UserRecord }`
(Purely additive; no existing consumer types the expand shape beyond `tags`/`pattern`.)

## Task 3 — `web/src/components/Avatar.tsx` (new) + AppHeader refactor

Extract the initials-circle inlined in AppHeader/ProfileCard (callsites become four):

```tsx
// web/src/components/Avatar.tsx — the initials-fallback avatar circle (lilac patch), extracted
// from AppHeader now that friends' faces appear in the feed and on shared details. Loads the
// 100x100 thumb (SPEC §8: lists never load originals; declared in the 4.1 users migration).
// Accepts null so callers can pass pb's nullable AuthRecord straight through.
import { pb } from '../lib/pb.ts'

type AvatarUser = { id: string; name: string; avatar: string } | null

export function Avatar({
  user,
  className = 'size-11',
  initialClassName = 'text-lg',
}: { user: AvatarUser; className?: string; initialClassName?: string }) {
  const initial = (user?.name ?? '').trim().charAt(0).toUpperCase() || '♡'
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      style={{ background: 'var(--patch-lilac-soft)' }}
    >
      {user?.avatar ? (
        <img
          src={pb.files.getURL(user, user.avatar, { thumb: '100x100' })}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <span className={`font-display font-bold ${initialClassName}`}
              style={{ color: 'var(--patch-lilac-deep)' }}>
          {initial}
        </span>
      )}
    </span>
  )
}
```

- **AppHeader**: replace the inline circle with `<Avatar user={user} />` inside the existing
  settings `<Link>` (keep `aria-label`); drop local `avatarUrl`/`initial`.
- **ProfileCard: leave alone** — its `<img>` src is a three-state preview machine
  (unchanged/new-objectURL/removed), not "the stored file"; Avatar genuinely doesn't fit.

## Task 4 — `web/src/features/friends/queries.ts` (new)

One hook, one queryFn, `Promise.all` over both collections — the page wants one
loading/error/retry state and one atomic snapshot. Keys embed viewerId (house convention);
30 s staleTime + refocus refetch is the freshness story (the viewer can't mutate this data —
zero invalidation plumbing).

```ts
// web/src/features/friends/queries.ts — read-side hooks for the Friends feed (DESIGN §9:
// "a cozy feed of shared patterns and finished objects with owner avatars"). One query merges
// friends' shared patterns (dated by created) and friends' shared FINISHED projects (dated by
// finished_on, falling back to updated). The viewer's own shared items are excluded — this
// screen is everyone else's news. Rules alone would already scope the reads; the filters here
// narrow to the feed's editorial shape.
export const friendsKeys = {
  all: ['friends'] as const,
  feed: (viewerId: string) => [...friendsKeys.all, 'feed', viewerId] as const,
}

export type FeedItem =
  | { kind: 'pattern'; date: string; pattern: PatternRecord }
  | { kind: 'finished_object'; date: string; project: ProjectRecord }

export function useFriendsFeed() {
  const { user } = useAuth()
  const viewerId = user?.id ?? ''
  return useQuery({
    queryKey: friendsKeys.feed(viewerId),
    enabled: viewerId !== '',
    queryFn: async (): Promise<FeedItem[]> => {
      const [patterns, projects] = await Promise.all([
        pb.collection('patterns').getFullList<PatternRecord>({
          filter: pb.filter('visibility = "friends" && owner != {:me}', { me: viewerId }),
          sort: '-created',
          expand: 'owner',
        }),
        pb.collection('projects').getFullList<ProjectRecord>({
          filter: pb.filter(
            'visibility = "friends" && status = "finished" && owner != {:me}',
            { me: viewerId },
          ),
          sort: '-finished_on,-updated',
          expand: 'owner,pattern',
        }),
      ])
      // PB datetimes are UTC strings — lexical compare is chronological; date-only finished_on
      // interleaves fine with full stamps.
      return [
        ...patterns.map((p) => ({ kind: 'pattern' as const, date: p.created, pattern: p })),
        ...projects.map((p) => ({
          kind: 'finished_object' as const,
          date: p.finished_on || p.updated,
          project: p,
        })),
      ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    },
  })
}
```

- `getFullList`, no cap — matches Library/Projects; a per-collection page cap would skew the
  merged order. Four users; revisit only if real.
- `expand: 'owner'` only on patterns (no `tags`) — feed altitude is who + what + when; tag dots
  are a one-string change later if wanted.

## Task 5 — feed components + page + tab + route

**`FeedCard.tsx`** — new component, **not** a PatternCard/ProjectCard reuse (those are own-shelf
cards with shelf/made-✓/status hierarchies; the feed is *person first*). Full-width row card:
`<Link>` with `rounded-box bg-base-100 p-3 shadow-soft`, 80 px cover (`thumb: '400x0'`,
ProjectCard precedent) or `YarnBall` fallback; then a `min-w-0` column — [Avatar `size-6` +
owner name, `text-sm font-semibold`], truncated title (`text-lg`), truncated context line
(pattern → designer; FO → linked pattern title, `ink-muted`), meta line (`text-xs ink-muted`):
`added {formatShortDate}` for patterns, `finished {formatShortDate} ☆` tinted
`var(--patch-mint-deep)` for FOs. Links to `/patterns/:id` / `/projects/:id`.

**`FriendsEmptyState.tsx`** — ProjectsEmptyState shape: centered column, `YarnBasket`
(decorative, aria-hidden), display-font line. Copy (Zara's pick, em-dash-free):
**"All quiet on the hook. Friends' makes will land here ♡"** No CTA (a viewer can't fill
someone else's feed; never guilt).

**`SharedByChip.tsx`** —
```tsx
export function SharedByChip({ owner }: { owner?: UserRecord }) {
  if (!owner) return null
  return (
    <span className="inline-flex h-9 w-fit items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-semibold"
          style={{ background: 'var(--patch-lilac-soft)', color: 'var(--patch-lilac-deep)' }}>
      <Avatar user={owner} className="size-7" initialClassName="text-xs" />
      shared by {owner.name}
    </span>
  )
}
```

**`FriendsPage.tsx`** (routes/, default export, renders inside AppShell — header + dock free):
`isPending` → 3 ProjectsPage-style row skeletons · `isError` → inline muted
**"The feed couldn't load."** + ghost **Retry** (`refetch()`; sibling list-page pattern, not a
toast) · empty → `<FriendsEmptyState />` · else `flex flex-col gap-3 px-5` of FeedCards with
composite keys `` `${item.kind}-${record.id}` ``. No page heading, no controls row (Home
precedent: straight into content).

**`Dock.tsx`** — import `UsersRound`; add `<DockTab to="/friends" label="Friends"
icon={UsersRound} />` after Projects (children: Home · Library · ➕ · Projects · Friends; ➕
stays center). Update header comment. **`main.tsx`** — `{ path: 'friends', element:
<FriendsPage /> }` under AppShell after `projects`. **`AppShell.tsx`** — comment only.

## Task 6 — detail pages

- **`features/patterns/queries.ts`**: `usePattern` expand `'tags'` → `'tags,owner'`; header
  comment tense ("the Friends feed is where shared patterns surface"). Same for
  **`features/projects/queries.ts`**: `'pattern'` → `'pattern,owner'`.
- **`PatternDetailPage.tsx`**: shelf-pill slot becomes
  `{isOwner ? <ShelfPill … /> : <SharedByChip owner={pattern.expand?.owner} />}` — the chip
  takes the owner-affordance's row (keeps rhythm; "shared by {name}" can't be confused with the
  "by {designer}" line above). Header comment updated.
- **`ProjectDetailPage.tsx`**: realtime owner-gate —
  ```ts
  // SPEC §11: counters realtime is per open project, owners only; a viewer's subscription
  // would be rule-filtered to silence anyway, so don't open the SSE topic at all.
  useCountersRealtime(user && projectQuery.data?.owner === user.id ? id : '')
  ```
  (`user &&` guard prevents `undefined === undefined` while data loads; hook stays
  unconditionally called — only the argument changes. This makes the file's existing header
  comment — "…and its realtime subscription are owner-only" — actually true.)
  Add `{!isOwner && <SharedByChip owner={project.expand?.owner} />}` at the end of the title
  block.

## Task 7 — housekeeping

- `web/package.json` → `0.4.1` (settings footer via existing Vite define).
- `LibraryPage.tsx` line-5 comment: shared patterns now "live in /friends".
- DECISIONS.md draft lines (2026-07-14, one each):
  1. Friends feed = friends' shared patterns + friends' shared **finished** projects, one merged
     newest-first list (patterns by `created`, FOs by `finished_on` → `updated` fallback);
     viewer's own shared items excluded · DESIGN §9 read literally; Zara's picks with p11.
  2. Feed cards are a new person-first `FeedCard`, not a PatternCard/ProjectCard variant; a make
     shared as both pattern and FO appears twice deliberately (two pieces of news) · with p11.
  3. Read-only details gain a "shared by {name}" chip via `expand: 'owner'` on the detail hooks
     (users read rules already allow it); on patterns it takes the owner-only shelf-pill slot ·
     beyond DESIGN's feed-only avatars; Zara's pick with p11.
  4. `users.avatar` gains `thumbs ['100x100']` by migration; AppHeader switches to the extracted
     `<Avatar>` (thumb); ProfileCard keeps its raw `<img>` (three-state preview, not a
     stored-file render) · SPEC §8 lists-never-load-originals + 2026-07-11 thumbs precedent.
  5. `useCountersRealtime` owner-gated in ProjectDetailPage (was subscribing rule-scoped-to-
     silence for viewers) · makes the header comment true.
  6. Dock 5th slot: `UsersRound` icon, label "Friends" · DESIGN §8 pre-authorized the slot;
     icon pick with p11.
  7. New microcopy (p11, em-dash-free per Zara): feed empty "All quiet on the hook. Friends'
     makes will land here ♡"; feed error "The feed couldn't load." + Retry; meta "added {date}" /
     "finished {date} ☆"; chip "shared by {name}" · DESIGN gives none of these verbatim.

## Edge-case ledger (all handled above)

Deep link to A's private/nonexistent record as B → PB 404 → existing "couldn't be found" branch,
**identical copy for private vs nonexistent** (no information leak; in the walk) · same make
shared as pattern + FO → two cards, intentional · owner with no avatar → initials fallback ·
`visibility` unset (pre-default records) never matches `"friends"` → excluded by rule and filter ·
empty `finished_on` → `updated` fallback date · feed offline/PB down → inline error + Retry ·
`expand: 'owner'` vs optimistic updates → spread of previous record preserves expand; no other
detail-cache writers · pre-migration avatars → PB lazy-generates thumbs on first request ·
feed invalidation → none needed (viewer can't mutate friends' content; 30 s staleTime + refocus) ·
StrictMode double-mount of gated realtime → existing cancelled-flag idiom; `''` short-circuits ·
dock 4→5 children → daisyUI dock distributes evenly, ➕ stays child 3 of 5 (visual check in walk).

## Verification

- **Claude runs:** `npm run lint` clean · `tsc -b` in `web/` exit 0.
- **Zara runs** (migrations changed → escalated gate):
  1. `npm run verify:fresh` — fresh DB boots (new migration applies) → migrations → superuser →
     seed → rules-check ×2 green. **(PLAN box 2)**
  2. Walk setup: as user A share one pattern + one finished project (toggles already shipped);
     keep one of each private.
  3. 📱 as user B **(PLAN box 1)**: dock has five slots, ➕ centered; Friends tab → feed shows
     A's shared pattern ("added …") and finished object ("finished … ☆") with A's avatar/name;
     A's private items absent; B's own shared items absent · shared pattern detail: metadata/
     photos/tags render, "shared by A" chip, zero attachment/shelf/edit/visibility/delete UI ·
     shared FO detail: journal read-only (no composer), no counters card, status chip inert ·
     deep-link to A's private pattern and to a garbage id → identical "couldn't be found" ·
     a user without an avatar shows the initials circle · settings footer "stitches v0.4.1" ·
     (optional) inspector: avatar requests carry `?thumb=100x100`.
- PLAN 4.1 boxes stay **unticked** until Zara confirms (memory: acceptance batched per phase).

## Wrap-up

- Session log `logs/2026-07-14_session-4.1-friends.md` (house format, 40–60 lines); archive this
  plan as `logs/p11-session-4.1-friends-plan.md`.
- Save a memory: Zara's microcopy guidance — no em-dashes in new copy, whimsy welcome, don't
  sound like a bot.
- Out of scope, deliberately: friends realtime (SPEC §11 scopes realtime to counters), feed
  pagination, tag dots on feed cards, reactions/comments (v1 out of scope per SPEC §17),
  Session 4.2 items (PWA, icon, polish sweep — including the known-deferred JournalQuickSheet
  `revokePreview` leak, which stays with 4.2 per DECISIONS 2026-07-13).
