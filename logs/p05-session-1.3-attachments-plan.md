# Session 1.3 — Attachments & the file-first door — Plan

*(Approved 2026-07-12. Archived to `logs/p05-session-1.3-attachments-plan.md` at session end, like p01–p04.)*

## Context

The copyright vault and PDFs as an import door (PLAN.md Session 1.3). The schema half already
shipped in Session 1.1: `pattern_attachments` exists with protected files (pdf/jpeg/png/webp,
≤10×≤30 MB), hardened owner-only rules + `pattern:changed` lock, and `patterns.thumbnail` is ready.
**No migrations this session** — the work is frontend (vault card, quick-add sheet, pdfjs pipeline,
token-gated viewing) plus a `rules-check.mjs` extension proving acceptance #2. Regression gate:
`npm run verify:rules` green (verify:fresh not required — no migration changes).

Acceptance: (1) 📱 vintage-scan PDF → pattern with page-1 thumbnail in one flow; (2) protected file
URL without token fails, owner playback fine; (3) rules-check still green.

## Decisions (locked with Zara)

- **Dock ➕ becomes the real 2-door quick-add sheet** ("Add a file" · "Type it in"); the paste-a-link door joins in 3.2. Ends the documented interim (Dock.tsx comment + DECISIONS 2026-07-11).
- **`pattern_text` UI ships this session** (Zara's pick — extends the brief; gets a DECISIONS.md line). Typed pattern instructions live in the vault card via the existing TipTap pattern.
- **One `pattern_attachments` record per uploaded file** (label = filename; delete file = delete record — no `files+`/`files-` bookkeeping). Typed pattern = a text-only record (exactly the shape the existing rules-check fixture already models).
- **pdfjs-dist pinned to latest 5.x** — registry latest is 6.1.200, a post-AI-knowledge major; same hold policy as Vite 7/TS 5.9/ESLint 9 → DECISIONS.md line. Worker self-hosted via Vite `?url` import (no CDN, same reasoning as the browser-image-compression `useWebWorker:false` entry).
- **Protected-file viewing: prefetch the token, render real links.** `useFileToken` TanStack Query hook (staleTime/refetchInterval ~60 s) + `pb.files.getURL(record, filename, { token })` → "View" is a plain `<a target="_blank">` — no `window.open` after `await`, so iOS Safari's popup heuristics never trigger. No inline `<img>` previews: the protected field declares no `thumbs`, and lists never load originals (SPEC §8).

## Files

| Path | Change | Why / reuse |
|---|---|---|
| `web/package.json` | Zara: install `pdfjs-dist@5` | `.npmrc save-exact` pins the resolved 5.x |
| `web/src/lib/schema.ts` | modify | add `AttachmentRecord` interface (mirror of PB shape, like `PatternRecord`) |
| `web/src/features/shared/pdfThumbnail.ts` | create | `renderPdfPageOneThumbnail(file) → ProcessedImage`; dynamic `import('pdfjs-dist')` (code-split), worker via `?url`; `PdfThumbnailError` mirrors `ImagePipelineError`; canvas→WebP follows imagePipeline's `encodeViaCanvas` pattern |
| `web/src/features/shared/protectedFiles.ts` | create | `useFileToken(enabled)` query + `protectedFileUrl()` wrapper over `pb.files.getURL {token}` |
| `web/src/features/patterns/attachmentQueries.ts` | create | `attachmentKeys` + `usePatternAttachments(patternId)` (getFullList, filter `pattern={:id}`, sort `-created`) — mirrors `queries.ts` |
| `web/src/features/patterns/attachmentMutations.ts` | create | `useCreateAttachment` (FormData), `useUpdateAttachment` (pattern_text saves), `useDeleteAttachment`; `MAX_ATTACHMENT_MB = 30`; invalidation via `attachmentKeys` — mirrors `mutations.ts` |
| `web/src/features/patterns/pendingAttachmentImport.ts` | create | one-shot in-memory bridge `{suggestedTitle, attachmentFile, attachmentLabel, thumbnail?}`; StrictMode-safe ref-guarded synchronous consume (File objects don't survive history.state reliably) |
| `web/src/features/patterns/components/QuickAddSheet.tsx` | create | `<dialog class="modal modal-bottom">` (FilterSheet shell); 2 door buttons (dashed-tile style, `FileUp`/`PenLine`); hidden `<input type="file" accept="application/pdf,image/*">` inside the dialog (gesture chain intact); busy state while processing |
| `web/src/components/Dock.tsx` | modify | ➕ opens QuickAddSheet instead of navigating; header comment updated |
| `web/src/features/patterns/components/PatternForm.tsx` | modify | optional `initialThumbnail?: ProcessedImage` (seeds ThumbnailState) + `pendingAttachmentLabel?: string` (📎 "Will attach …" caption) |
| `web/src/routes/PatternFormPage.tsx` | modify | consume pending import → defaultValues title + props; create-mode submit: pattern → attachment (partial-failure toast, still land on detail) |
| `web/src/features/patterns/components/AttachmentsCard.tsx` | create | owner-only card: `Lock` + "attachments" + **"Only you can ever see these."**; file rows (icon · label · View link · delete w/ plain-language confirm); dashed "Add a file" tile (same branch logic as sheet); typed-pattern section (render sanitized like notes → edit-in-place via NotesEditor reuse); thumbnail backfill when `!pattern.thumbnail` |
| `web/src/routes/PatternDetailPage.tsx` | modify | `{isOwner && <AttachmentsCard …/>}` after photos, before VisibilityToggle (the file's own marked spot) |
| `scripts/rules-check.mjs` | modify | `expectFileOk`/`expectFileDenied` helpers + real-file fixture + 3 token checks (below) |
| `docs/DECISIONS.md` | modify | two lines: pdfjs 5.x pin · pattern_text scope addition |
| `logs/2026-07-12_session-1.3-attachments.md` | create | session log per CLAUDE.md |

## Steps

> **Progress 2026-07-12 (final):** Phases 0–7 ✅. pdfjs-dist pinned **5.7.284**; `tsc -b` and
> `lint` clean; `verify:rules` ×2 green — **105 passed, 0 failed** each run, including the four
> token-gate checks (logs/rules-check-1.3-run{1,2}.txt). Bonus fix: npm scripts' env flag
> corrected to `--env-file-if-exists` (DECISIONS 2026-07-12). Remaining before checking the
> docs/PLAN.md acceptance boxes: the 📱 on-device checks (vintage-scan flow, tokenless URL in a
> private tab, user-B zero-hint check).

### Phase 0 — install & verify (blocking)
1. **Zara:** `npm install pdfjs-dist@5 --workspace web` (save-exact pins the resolved latest 5.x).
2. Claude verifies the *installed* package before writing code (never trust remembered APIs):
   `ls node_modules/pdfjs-dist/build/ | grep worker` (worker filename for the `?url` import),
   grep `RenderParameters` in `node_modules/pdfjs-dist/types/src/display/api.d.ts` (pdfjs 5 wants `canvas` — pass `{ canvas, canvasContext, viewport }`), confirm `getDocument`/`GlobalWorkerOptions` top-level exports.
3. Copy this plan to repo-root `PLAN.md`.

### Phase 1 — shared helpers
4. `schema.ts`: `AttachmentRecord`. 5. `pdfThumbnail.ts`: render page 1 at long edge ~1800 px → `canvas.toBlob('image/webp', 0.85)` → `File` + preview URL; `pdf.destroy()` in finally; all failures → `PdfThumbnailError` (soft everywhere). 6. `protectedFiles.ts`.

### Phase 2 — data layer
7. `attachmentQueries.ts` + `attachmentMutations.ts`.

### Phase 3 — quick-add door
8. `pendingAttachmentImport.ts`. 9. `QuickAddSheet.tsx`: on pick — PDF: size ≤30 MB check, thumbnail via pdfThumbnail (soft-fail → no thumbnail); image (incl. HEIC): `processImage` (hard-fail with its message); `suggestedTitle` = filename minus extension, `-`/`_` → spaces; stash → close → `navigate('/patterns/new')`. 10. Dock wiring + comment.

### Phase 4 — form wiring
11. `PatternForm` props (thumbnail seeds through existing `ThumbnailState`/`buildPatternFormData` untouched). 12. `PatternFormPage`: create → `createAttachment` (FormData: owner, pattern, label, files); on attachment failure toast **"Pattern saved, but the file didn't attach — add it again from here."** and navigate to detail anyway (the card is the retry path).

### Phase 5 — the vault card
13. `AttachmentsCard.tsx`: files = records with `files.length > 0`; typed pattern = first record with non-empty `pattern_text` (update it; create text-only record `{owner, pattern, pattern_text}` when none; if text emptied on a file-less record, delete the record). Add-file tile: same PDF/image branch; after create, if `!pattern.thumbnail` and a thumb was generated → `useUpdatePattern` with a FormData containing *only* `thumbnail` (PB touches only present keys). 14. Insert into `PatternDetailPage`.

### Phase 6 — rules-check (acceptance #2)
15. Helpers near `expectListEmpty`; new block after the existing `pattern_attachments` checks (line ~297): create attachment on `patternSharedA` via FormData with minimal inline PDF bytes (`%PDF-1.1 … %%EOF`, Node `Buffer`/`Blob` globals), then raw `fetch`: no token → denied; **B's** `pb.files.getToken()` token → denied (PB re-checks the view rule per fetch); **A's** token → 200. No cleanup changes — the fixture cascades with `patternSharedA`'s phase-3 delete, preserving the ×2 idempotent run. Update the "9 for A" fixtures comment.

### Phase 7 — docs & gates
16. DECISIONS.md lines; session log; update root PLAN.md checkboxes; archive to `logs/p05-session-1.3-attachments.md`.

## Edge cases

- **HEIC scan** picked as attachment → image branch converts via §8 pipeline (field MIME list forbids HEIC; raw HEIC never reaches the server).
- **PDF > 30 MB** → client-side check, toast, stop (mirrors PhotosField's cap-ahead-of-server pattern).
- **Corrupt/encrypted PDF** → `PdfThumbnailError` is soft: attachment (and in quick-add, the pattern) still saves, thumbnail skipped, manual add later. Manual entry is never blocked.
- **Undecodable image** → hard stop with the existing "please convert this one" message (ThumbnailField precedent); nothing uploads.
- **Token expiry** → 60 s refetch while the card is mounted; a long-idle tab's worst case is one denied fetch, fixed by reopening.
- **Reload on `/patterns/new`** → in-memory pending import gone; blank form (by design).
- **StrictMode double-invoke** → ref-guarded one-shot consume (not useState initializer / useEffect).
- **Quick-add while already on `/patterns/new`** → same-path navigation won't remount; pick is dropped. Known minor gap, documented, not machinery-worthy.

## Verification

Claude (allowed): `npm run lint` clean; `npx tsc -b` in `web/` clean (this is the real gate on the installed pdfjs API surface).

Zara:
1. `npm install pdfjs-dist@5 --workspace web` → exact 5.x pin lands in web/package.json.
2. `npm run dev` (PB must be up), then `npm run verify:rules 2>&1 | tee logs/rules-check-1.3.txt` → green including the 3 new protected-file checks; run twice stays green.
3. 📱 via tailscale serve (as in prior sessions): dock ➕ → Add a file → real vintage-scan PDF → form opens pre-filled (title + page-1 thumbnail + 📎 caption) → Save → detail shows hero thumbnail and the file in the vault card → View opens the PDF.
4. Copy a View URL, strip `?token=`, open in a private tab → denied (404/error). ✅ acceptance #2's manual half.
5. As demo user B in a second browser: A's shared pattern shows **zero** attachment UI or hints.
6. Typed pattern: write → save → reload → persists; empty it → section returns to its ghost state.
