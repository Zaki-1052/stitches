# p04 — Session 1.2: Pattern CRUD (approved plan)

## Context

Sessions 0.1–1.1 are done: themed scaffold, auth + app shell (login, ProtectedRoute, AppShell/Dock/BackBar), and the full SPEC §7 schema with hardened rules, seed, and the 99-check `rules-check.mjs` regression gate (verified fresh, twice). Session 1.2 makes Stitches work as Cece's manual-entry library: library list, create/edit form, the §8 image pipeline, pattern detail, and delete — per the PLAN.md 1.2 brief, SPEC §7/§7.9/§8/§12, DESIGN §3/§8/§9/§11/§12. No migrations, rules, or seed changes this session.

**Zara's decisions (asked & answered):**
- **Notes = rich text editor dependency** (not a plain textarea). → TipTap **2.27.2** (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/pm`), the AI-known major per version policy (3.x is mid-2025+, registry keeps a `v2-latest` tag on 2.27.2). `dompurify` 3.4.12 sanitizes stored HTML on render (bundles its own TS types). Bonus: seeded patterns already contain real HTML notes (`<p>…</p>`) — they render correctly with no legacy-text shim.
- **Dock ➕ → `navigate('/patterns/new')`** — interim until the multi-door quick-add sheet exists (1.3/3.2).
- **cyc_8 label = "8 · Jumbo+"** (CYC standard ends at 7; one named constant, schema untouched).

**Two facts that drive correctness (verified against the 1.1 migration + seed):**
1. `patterns.createRule` is `owner = @request.auth.id` and PB does **not** auto-fill relations — the client must send `owner: user.id` on create (and never on update, where it would brush the OWNER_LOCK). Forgetting it = silent 400 on every create.
2. `patterns.listRule` is visibility-aware, and seed data already has cross-user `friends` patterns — the Library must hard-filter `owner = {viewer}` client-side or friends' patterns leak in months before Phase 4.

## Step 0 — first actions on approval

1. **Claude copies this approved plan into the repo as `logs/p04-session-1.2-pattern-crud.md`** (this file).
2. **Zara runs the install** (exact pins via .npmrc save-exact):

```
npm install --workspace web @tanstack/react-query@5.101.2 browser-image-compression@2.0.2 @tiptap/react@2.27.2 @tiptap/starter-kit@2.27.2 @tiptap/pm@2.27.2 dompurify@3.4.12
```

## Files

**`web/src/lib/` (pure modules, matching `lib/pb.ts` convention)**
- `lib/schema.ts` — the one zod-schemas module (SPEC §12): select-value consts (CRAFTS, YARN_WEIGHTS, DIFFICULTIES, SHELVES, VISIBILITIES, TAG_COLORS), `patternFormSchema`, `tagFormSchema`. Numbers come through as strings (`''` → undefined; avoids RHF `valueAsNumber` NaN-on-empty).
- `lib/hooks.ts` — mm↔US alias table (13 core rows from DESIGN §9) + `formatHook(mm)` → "5.0 mm · H-8"; off-table mm (e.g. 4.5) → "4.5 mm", no guessed alias. (Name is DESIGN-mandated despite looking like React hooks.)
- `lib/cyc.ts` — CYC label map ("4 · Medium/Worsted", …, "8 · Jumbo+") + `formatCyc()`.

**`web/src/features/shared/` (cross-cutting, reused by projects/journal later)**
- `queryClient.ts` — shared `QueryClient`; provider wired in `main.tsx`.
- `errors.ts` — `normalizePbError()` (PB `ClientResponseError` → message + per-field errors) + RHF `setError` bridge (SPEC §12: inline for field errors, toast for the rest).
- `toast.tsx` — minimal toast provider/`useToast()`: daisyUI toast, top, 2.5 s, one at a time (DESIGN §8); mounted at router root so dockless subpages get it too.
- `imagePipeline.ts` — §8 pipeline over `browser-image-compression`: `processImage(file)` → `{file, previewUrl}`: ≤2000 px long edge, ~0.85 quality, WebP; JPEG fallback detected by checking the **output MIME** (Safari canvas may silently downgrade rather than throw); undecodable input throws `ImagePipelineError("Please convert this one…")`. `processImages()` = per-file `allSettled` so one bad file doesn't sink the batch. Photo-count caps are the callers' job.

**`web/src/features/patterns/`**
- `queries.ts` — `usePatterns(params)` (filter: `owner={me}` AND `title ~ q || designer ~ q` AND shelf/craft/weight/tags, via `pb.filter()`; sort `-updated`), `usePattern(id)` (`expand: tags`), `useTags()` (own tags), `useFinishedPatternIds()` (§7.9 made-✓: viewer's finished projects, `fields=pattern,status` — empty until Phase 2, implemented now), `useLinkedProjects(patternId)` (delete pre-check).
- `mutations.ts` — create/update/delete pattern, create tag; invalidation per the key scheme below.
- `formData.ts` — `buildPatternFormData(values, images, mode, ownerId)`: one FormData path for create & edit (see PB mapping below).
- `urlParams.ts` — parse/serialize Library params; unknown/stale values dropped defensively.
- `components/` — `PatternForm.tsx` (assembles sections), `ThumbnailField.tsx` (single image: pipeline, preview, explicit "×" remove), `PhotosField.tsx` (multi, live "N of 10" cap over existing+added, per-file errors, removal of existing by filename), `NotesEditor.tsx` (TipTap StarterKit, minimal 44 px toolbar: bold/italic/bullet/ordered; RHF `Controller`, `onUpdate` → `getHTML()`, empty `<p></p>` normalized to `''`; content area ≥16 px, `radius-box`, tokens only), `TagPicker.tsx` (toggle chips + inline create: name + 5 patch swatches; `(owner,name)` unique violation → inline "You already have a tag named "{name}"", input preserved), `HookAliasReadout.tsx`, `SaveBar.tsx` (sticky safe-area Save/Cancel), `PatternCard.tsx` (grid 4:5 `?thumb=400x0` / list row `?thumb=100x100`, title, designer, tag dots, mint made-✓), `SearchBar.tsx` (sticky, local state + 300 ms debounce → URL), `FilterSheet.tsx` (daisyUI `modal-bottom` `<dialog>` with drag handle; draft state, single Apply commit), `ActiveFilterChips.tsx`, `EmptyState.tsx` (two variants), `ShelfPill.tsx` (segmented, optimistic), `MetaChips.tsx` (empty fields omitted), `VisibilityToggle.tsx` (verbatim helper: *"Friends can see this pattern's info and photos — never your files."*), `DeleteConfirmDialog.tsx`.

**`web/src/routes/` (flat, matching existing convention)**
- `LibraryPage.tsx` (replaces deleted `LibraryStub.tsx`), `PatternFormPage.tsx` (shared for `/patterns/new` + `/patterns/:id/edit`; edit mode: `reset()` from `usePattern`, owner-guard redirect to detail if not mine), `PatternDetailPage.tsx` (hero `?thumb=800x0`, title/designer, source chip → new tab, ShelfPill, MetaChips, tags, notes via `DOMPurify.sanitize` + `dangerouslySetInnerHTML`, photo strip, VisibilityToggle, owner-only Edit in BackBar right slot + Delete; Attachments card = 1.3, Projects section = 2.1 — deferred, not stubbed).

**Modified:** `main.tsx` (QueryClientProvider + toast root; `/patterns` → LibraryPage under AppShell; `/patterns/new`, `/patterns/:id`, `/patterns/:id/edit` as dockless subpages alongside `/settings`), `Dock.tsx` (➕ wiring), `BackBar.tsx` (optional `right?: ReactNode` slot — backward compatible), `web/package.json` (deps, via Zara).

**Untouched deliberately:** `pb_migrations/**`, seed, rules; `AppHeader` still renders the greeting above Library (0.2 artifact — flagged, revisit with the real Home in 2.3, not silently "fixed" here).

## Key design decisions

**URL params** (`/patterns`): `q`, `shelf`, `craft`, `weight`, `tags` (comma-joined), `view=list` (grid default, omitted). **Every in-page change uses `setSearchParams(..., {replace: true})`** — the Library stays one history entry, so back from a detail lands on the exact filtered state, and back from the Library exits in one press (never N presses to unwind keystrokes). Refresh survives because state is the URL. `view` is excluded from query keys (rendering choice, no refetch).

**Query keys:** `['patterns','list',params]` / `['patterns','detail',id]` / `['tags','list']` / `['projects','finishedPatternIds',viewerId]` / `['projects','linkedToPattern',patternId]` (project keys namespaced under `projects` so Session 2.1 mutations can invalidate them without touching this code). Create → invalidate lists; full-form update → detail + lists; shelf/visibility quick-taps → optimistic `setQueryData` in `onMutate`, invalidate on settle, `isPending` guard against double-taps; delete → invalidate lists, `removeQueries` detail, navigate to `/patterns`.

**PB body mapping** (no schema defaults exist — DECISIONS 2026-07-11): always send every schema field explicitly on create *and* update — blank text/url/select send `''` (PB's clear signal), blank numbers send `'0'` (PB numbers have no NULL; 0 = "not set" for hook/yardage, and UI renders 0 as unset), tags `[]` sends one explicit empty append (clear ≠ omit). Display defaults supplied by the form: craft=crochet, shelf=saved, visibility=private. `owner` appended **only** on create. Thumbnail: file when replaced, `''` only when explicitly removed, key omitted when untouched. Photos on edit: `photos+` appends, `photos-` removals by filename. Image fields live in **local component state, not zod** — `zodResolver` adopts the parsed output and `z.object()` strips unknown keys, which would silently drop File state on revalidation; files are read at submit time next to `handleSubmit`'s validated values.

**Delete flow:** confirm copy verbatim — "Delete this pattern and its attachments? This can't be undone." Pre-check `useLinkedProjects`: if the viewer can see N linked projects, disable delete with "N project(s) still point to this pattern — unlink first." If pre-check shows 0 but the server still 400s (a friend's private project can block invisibly — rule is `projects_via_pattern.id = ""`), show a generic non-revealing message.

**New microcopy** (on-voice, DESIGN §11): empty library verbatim "No patterns yet — your shelf is ready when you are." + CTA to `/patterns/new`; empty search (new, distinct): "Nothing matches, yet — try loosening a filter." — approved with this plan.

## Build order

1. Step 0: plan copied to `logs/p04-session-1.2-pattern-crud.md`, then Zara installs. 2. `lib/schema.ts`, `lib/hooks.ts`, `lib/cyc.ts`. 3. `queryClient` + provider, `errors`, `toast`. 4. `imagePipeline`. 5. `queries`/`mutations`/`formData`/`urlParams`. 6. Form leaves (NotesEditor, TagPicker, image fields, SaveBar, HookAliasReadout) → `PatternForm` → `PatternFormPage` + routes. 7. Library leaves → `LibraryPage`, delete stub. 8. Detail leaves → `PatternDetailPage`. 9. `BackBar` slot, `Dock` ➕. 10. Lint + tsc, fix everything.

## Verification

**Claude runs:** `npm run lint` clean · `npx tsc -b web` exit 0 (per-step while iterating, full at the end).

**Zara runs (dev + 📱 via `tailscale serve`), mapped to the three acceptance boxes:**
- **A (photo/HEIC/thumbs):** create a pattern with a camera-roll photo — converts to webp/jpeg, fast upload; grid `<img>` uses `?thumb=400x0`, list `100x100`, hero `800x0` (never originals); an undecodable file (desktop test) gets "please convert this one" without breaking the form.
- **B (URL state + hook alias):** search + two filters → refresh → identical results/chips/URL; open detail → back → same filtered list in one press; hook 5.0 shows exactly "5.0 mm · H-8", 4.5 shows "4.5 mm".
- **C (empty states):** zero-pattern user sees the verbatim empty-library copy; filtered-to-zero shows the distinct empty-search copy; clearing filters restores the grid without reload.
- **Cross-cutting:** create persists (owner sent — the likeliest silent failure); Library never shows the other seed user's `friends` pattern; edit-clearing hook/yardage/tags actually clears after reload; delete of a linked pattern shows the blocked path, unlinked delete succeeds with exact copy; a friend's shared pattern by direct URL shows no Edit/Delete and the edit route redirects; notes typed in TipTap round-trip and render sanitized; keyboard vs sticky Save bar behaves (§12 #12 known pain — sticky-in-flow like BackBar, still needs the device check).
- **Bonus:** this device pass also covers Session 0.2's still-unchecked 📱 box (fonts, dock safe-area, ≥44 pt targets, back affordance) — check both sessions' boxes in PLAN.md if green.

No `verify:rules`/`verify:fresh` required (no migrations/rules/seed touched); harmless to re-run if desired.

## Post-session bookkeeping

- `docs/DECISIONS.md` lines: TipTap 2.27.2 + dompurify 3.4.12 adopted for `editor` fields (dep beyond the SPEC §5 list, AI-known major over 3.x per version policy); cyc_8 UI label "8 · Jumbo+"; dock ➕ interim wiring; empty-search copy.
- Write the session log `logs/2026-07-11_session-1.2-pattern-crud.md`; tick PLAN.md acceptance boxes only after Zara's 📱 pass is green.
