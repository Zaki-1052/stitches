# Session 2.1 — Projects & journal — Plan

*Approved 2026-07-13. Archived to `logs/p06-session-2.1-projects-journal-plan.md` when green.*

## Context

Phase 1 (library) is complete through Session 1.3: full SPEC §7 schema + hardened rules exist and
are regression-tested (`rules-check.mjs`, 105 green ×2), pattern CRUD, attachments vault, and the
file-first quick-add door all work. Session 2.1 makes the diary half real: project CRUD with an
optional pattern link, a status-grouped projects list, a status sheet whose finished flip fires
star confetti + a finished-photo prompt, a pinned summary edited in place, and a date-grouped
journal feed with a composer, photos, and backdating. **No migrations, API rules, or seed changes
— this is a pure `web/` session** against the existing `projects` / `journal_entries` collections.

Acceptance (docs/PLAN.md §2.1):
- 📱 Full loop: start project → journal entry with photo → finish → confetti once → entry prompt
- `prefers-reduced-motion`: no confetti, everything still updates instantly
- Backdated entries sort correctly

## Decisions

Locked with Zara before drafting (AskUserQuestion):
- **/projects layout** — grouped sections (in_progress → planned → hibernating → finished →
  frogged, `-updated` within each) **plus** single-select status filter chips in URL params;
  tapping the active chip clears. Reconciles PLAN "grouped by status" with DESIGN §9 chips.
- **Full journal-entry CRUD** — composer on top (create/backdate/photos) + edit in place +
  delete with plain confirm.
- **Install `motion`** (motion.dev, AI-known v12 major) — confetti via `motion/react`;
  reduced-motion gate via its `useReducedMotion()`.

Approved with this plan (each gets a DECISIONS.md line):
- **Date defaults, minimal-assumption** — flip→finished sets `finished_on = today` **only if
  empty**; un-finishing leaves it untouched; status flips never touch `started_on` (create form
  pre-fills today, visible + clearable).
- **Journal-feed empty microcopy** — *"No entries yet — this project's story starts here."*
- **Finished prompt** — small bottom dialog: "Finished! ☆" / "Add a finished photo to the
  journal?" / Not now · Add a photo (opens composer scrolled into view; no programmatic
  file-input `.click()` — flaky on iOS Safari).
- **Project visibility helper copy** — *"Friends can see this project and its journal — counters
  stay yours."* (toggle on detail, like patterns; form defaults private invisibly).

## Files

| Path | Change | Why |
|---|---|---|
| `web/src/lib/dates.ts` | create | tz-safe PB-date slice/format helpers; no `new Date()` on PB strings |
| `web/src/lib/schema.ts` | modify | PROJECT_STATUSES/labels, ProjectRecord, JournalEntryRecord, projectFormSchema/defaults/toFormValues; `ProjectLinkRecord.name` |
| `web/src/features/projects/queries.ts` | create | projectKeys/entryKeys + useProjects/useProject/useJournalEntries; **moves** projectKeys, useFinishedPatternIds, useLinkedProjects out of patterns/queries.ts |
| `web/src/features/patterns/queries.ts` | modify | sheds project hooks; gains patternKeys.options + usePatternOptions (form's pattern select) |
| `web/src/features/projects/mutations.ts` | create | create/update/quickUpdate/delete project + entry mutations, mirroring patterns/mutations.ts shapes |
| `web/src/features/projects/formData.ts` | create | buildProjectFormData / buildEntryFormData; reuses ThumbnailState/PhotosState from patterns/formData.ts |
| `web/src/features/projects/urlParams.ts` | create | status filter parse/serialize, patterns/urlParams.ts conventions |
| `web/src/features/patterns/components/PhotosField.tsx` | modify | `max?: number` prop (default 10); entries pass 6 |
| `web/src/features/patterns/components/SaveBar.tsx` | modify | `label` prop ("Save pattern"/"Save project") |
| `web/src/features/patterns/components/VisibilityToggle.tsx` | modify | required `helperText` prop (pattern + project copy) |
| `web/src/features/projects/components/StatusChip.tsx` | create | STATUS_PATCH map + soft/deep pill via patchSwatch |
| `web/src/features/projects/components/StatusSheet.tsx` | create | instant-apply bottom sheet; FilterSheet dialog shell; frogged microcopy |
| `web/src/features/projects/components/StatusPill.tsx` | create | form radiogroup, ShelfPill anatomy |
| `web/src/features/projects/components/ProjectCard.tsx` | create | list row; cover `?thumb=400x0`, YarnBall fallback; no progress bar (2.2) |
| `web/src/features/projects/components/ProjectsEmptyState.tsx` | create | "Nothing on the hook. Chain on!" + filtered variant |
| `web/src/features/projects/components/ProjectForm.tsx` | create | RHF+zod; reuses ThumbnailField, HookAliasReadout, SaveBar, applyFieldErrors |
| `web/src/features/projects/components/SummaryCard.tsx` | create | edit-in-place (AttachmentsCard typed-pattern precedent) via NotesEditor + quick update |
| `web/src/features/projects/components/EntryComposer.tsx` | create | create+edit composer; NotesEditor + PhotosField(6); plain state, no RHF |
| `web/src/features/projects/components/EntryCard.tsx` | create | sanitized body, rounded photo grid, pencil/trash |
| `web/src/features/projects/components/JournalFeed.tsx` | create | ghost affordance, date-grouped feed (`-entry_date,-created`), empty state |
| `web/src/features/projects/components/StarConfetti.tsx` | create | 24 patch-color SVG stars, motion/react, ≤1.5 s, transform/opacity only |
| `web/src/features/projects/components/FinishedPromptDialog.tsx` | create | finished-photo prompt dialog |
| `web/src/features/projects/components/ConfirmDeleteDialog.tsx` | create | generic plain confirm (project + entry delete) |
| `web/src/routes/ProjectsPage.tsx` | create | grouped list + chips (LibraryPage anatomy); replaces ProjectsStub |
| `web/src/routes/ProjectsStub.tsx` | delete | superseded |
| `web/src/routes/ProjectFormPage.tsx` | create | mirrors PatternFormPage; `?pattern=` prefill; started_on=today on create |
| `web/src/routes/ProjectDetailPage.tsx` | create | detail + status sheet + finished-flip state machine + feed |
| `web/src/main.tsx` | modify | ProjectsPage swap; `/projects/new`, `/projects/:id`, `/projects/:id/edit` (static `new` first) |
| `web/src/routes/LibraryPage.tsx` | modify | moved-import fix (useFinishedPatternIds) |
| `web/src/routes/PatternDetailPage.tsx` | modify | projects section + Start a project; moved-import fix; helperText prop |
| `docs/DECISIONS.md` | modify | session decision lines (2026-07-13) |
| `logs/2026-07-13_session-2.1-projects-journal.md` | create | session log |

## Steps

### Phase 0 — Setup
- [x] Root PLAN.md written (this file)
- [x] **Zara ran:** `npm install motion@12 --workspace=web` → pinned **12.42.2**; `motion/react`
      API (`motion` proxy, `useReducedMotion`) verified against the installed `.d.ts`.

### Phase 1 — Data layer
- [x] `web/src/lib/dates.ts`
- [x] `web/src/lib/schema.ts` additions
- [x] `web/src/features/projects/queries.ts` + move + `usePatternOptions`
- [x] `web/src/features/projects/{mutations,formData,urlParams}.ts` (+ `status.ts`)

### Phase 2 — Components
- [x] Parameterize PhotosField / SaveBar / VisibilityToggle
- [x] StatusChip / StatusSheet / StatusPill
- [x] ProjectCard / ProjectsEmptyState / ProjectForm / SummaryCard
- [x] EntryComposer / EntryCard / JournalFeed / ConfirmDeleteDialog
- [x] StarConfetti / FinishedPromptDialog

### Phase 3 — Routes & integration
- [x] ProjectsPage (+ delete stub) / ProjectFormPage / ProjectDetailPage / main.tsx
- [x] PatternDetailPage projects section + import fixes

### Phase 4 — Close-out
- [x] DECISIONS.md lines · session log · `npx tsc -b` (web) exit 0 · `npm run lint` exit 0
- [x] 📱 Zara: on-device acceptance walk green (2026-07-13) → archived to
      `logs/p06-session-2.1-projects-journal-plan.md`

## Edge cases

- Timezone-safe dates: PB strings sliced, never `new Date()`-parsed; backdates can't shift a day.
- Backdated sort: `-entry_date,-created` (same-day ties break by creation).
- Confetti exactly once per flip: per-call mutation `onSuccess` (StrictMode-safe), cleanup-safe
  auto-unmount timer; navigating away mid-confetti unmounts cleanly; reduced motion → confetti
  never mounts, status/date/prompt still instant.
- Tapping the current status: sheet closes, no mutation; `isPending` guard against double-flips.
- Create-as-finished: `finished_on` backfilled in FormData, no confetti (celebration is the flip).
- Stale/foreign `?pattern=` id ignored (options whitelist); unlink (`pattern: ''`) unblocks
  pattern delete.
- `owner`/`project` omitted on entry update, `owner` on project update (OWNER_LOCK / `:changed`).
- `summary` never sent by the form (edit-in-place owns it); optimistic edits roll back on error.
- Missing cover/pattern/dates → placeholders/hidden meta; unset status renders planned-styled.
- Made-✓ badge + pattern-delete pre-check refresh via the single `projectKeys.all` root.
- 6-photo cap client-side; Save disabled while image pipeline busy; empty entries blocked
  (needs body or ≥1 photo).

## Verification

Claude runs:
1. `cd web && npx tsc -b` → exits 0, no output.
2. `npm run lint` → exits 0, no warnings/errors.

Zara runs (`npm run dev`, iPhone via `tailscale serve`):
3. 📱 Full loop: pattern detail → Start a project → save → journal entry with photo → status
   sheet → finished → **confetti plays once** → prompt → Add a photo → save finished-photo entry.
4. 📱 iOS Settings → Accessibility → Motion → Reduce Motion ON → flip another project to
   finished → **no confetti**, status + `finished_on` + prompt all instant.
5. 📱 Backdate an entry to last week → sorts under its own date header below newer entries.
6. Status chips filter via URL; back/forward safe; grouped sections ordered
   in_progress → planned → hibernating → finished → frogged.
7. Frogged flip shows "Frogged — rip-it happens."
8. Pattern delete while linked → blocked dialog; unlink project → delete works.
9. Project delete confirm wipes its journal (entries cascade).
10. 📱 Date inputs don't trigger iOS focus-zoom (16 px floor).
11. (Optional; schema untouched) `npm run verify:rules` → still green.
