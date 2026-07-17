# p10 — Session 3.2: Paste-a-link door (link in, cute pre-filled form out)

## Context

Session 3.1 shipped the importer sidecar (`/import/extract`, `/import/image` on :8095, SSRF
pipeline, 20/min/user rate limit) — but nothing in the web app calls it yet. Session 3.2 is the
frontend half: a third quick-add door that reads the clipboard, extracts OG metadata through the
sidecar, and lands on `/patterns/new` pre-filled — title, designer, source, notes blurb, and the
og:image pulled through the proxy, compressed by the §8 pipeline into the thumbnail. Extraction
failure is *soft*: the form opens with just the URL filled plus a gentle toast; manual entry is
never blocked (SPEC §10 frontend flow; DESIGN save-form §).

The whole shape already exists as the **file door** (Session 1.3/2.3): a hook
(`useAddFileDoor.ts`), a module-scope one-shot bridge (`pendingAttachmentImport.ts`), and
consumption in `PatternFormPage.tsx` → `PatternForm`'s `initialThumbnail` seam. 3.2 mirrors that
trio for URLs. No new dependencies, no schema/rules/seed changes (**regression gate:
`verify:rules` not required**).

**Zara's picks (AskUserQuestion, this plan):**
1. **Modules live in `features/patterns/`** beside the file door (SPEC §6's `import/` folder
   folded in — DECISIONS line, same precedent as `home/`/`settings/`).
2. **Saved link = `canonical_url`** (post-redirect, og:url-resolved; strips UTM/share junk),
   falling back to the pasted `source_url` — DECISIONS line.
3. **og:description pre-fills notes** as one escaped `<p>` paragraph (TipTap value is an HTML
   string) — DECISIONS line.
4. **Lilac patch** for the door and the "imported from {site}" chip
   (`--patch-lilac-soft`/`--patch-lilac-deep`; blue = file door, mint = type-it-in).

**Facts verified (not guessed):**
- Importer wants the **raw PB token** in `Authorization` (no `Bearer`) — `auth.ts` forwards the
  header verbatim to PB's POST auth-refresh. The PB SDK does **not** attach tokens to plain
  `fetch`; set `pb.authStore.token` manually.
- Extract response: `{source_url, canonical_url, title, description, image, site_name, author}`,
  all nullable except `source_url`; `image` is already absolute-resolved; `canonical_url` is
  never null on success (falls back to final URL server-side). Errors uniform `{error, message}`:
  400 `invalid_url`/`invalid_body` · 401 · 403 `blocked_target` · 422 `fetch_failed` ·
  429 `rate_limited`. Server body schema caps `url` at **2048 chars** → client pre-rejects longer.
- iOS Safari: `navigator.clipboard.readText()` must be called **synchronously inside the tap
  handler** (first statement — any prior `await` kills the gesture); shows the native paste
  bubble; requires a secure context (tailscale serve https ✓, localhost ✓).
- `lucide-react` 1.24.0 has `ClipboardPaste` and `Link` (checked in node_modules).
- Toast provider mounts above the router — toast-after-navigate works (file door relies on it).
- DESIGN door order is **Paste a link · Add a file · Type it in** — paste door goes FIRST in
  both surfaces; Home's row becomes `grid-cols-3` ("one row of cute buttons").
- 2 requests per paste (extract + image) → 10 pastes/min inside the 20/min budget.

## Files

```
web/src/features/patterns/
├── importerClient.ts        NEW — typed fetch wrappers + ImporterError
├── pendingUrlImport.ts      NEW — one-shot bridge (mirrors pendingAttachmentImport)
├── usePasteLinkDoor.ts      NEW — clipboard → extract → stash → navigate hook
├── components/QuickAddSheet.tsx   MOD — third Door (first), dual-busy composition
└── components/PatternForm.tsx     MOD — importedFrom chip prop
web/src/features/home/components/DoorsRow.tsx   MOD — third tile, grid-cols-3
web/src/routes/PatternFormPage.tsx              MOD — consume pendingUrlImport
web/package.json                                MOD — version 0.3.2
docs/DECISIONS.md                               MOD — 4 lines
logs/p10-session-3.2-paste-link-plan.md + logs/2026-07-13_session-3.2-paste-link.md
```

---

## Task 1 — `web/src/features/patterns/importerClient.ts` (new)

Typed wrappers over the same-origin `/import` proxy (Vite dev proxy exists; Nginx in prod).

```ts
// web/src/features/patterns/importerClient.ts — the web app's client for the importer sidecar
// (SPEC §10). Plain fetch, NOT the PB SDK: the importer is a separate service that just happens
// to validate PB tokens, so the Authorization header is set by hand (raw token, no "Bearer").
import { pb } from '../../lib/pb.ts'

// Server budget is 8 s per request; this catches a hung proxy so busy states always end.
const CLIENT_TIMEOUT_MS = 12_000

export class ImporterError extends Error {
  constructor(
    readonly code: string,   // invalid_url | unauthorized | blocked_target | fetch_failed | rate_limited | unreachable | …
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ImporterError'
  }
}

export interface ExtractResult {
  source_url: string
  canonical_url: string | null
  title: string | null
  description: string | null
  image: string | null
  site_name: string | null
  author: string | null
}

async function post(path: '/import/extract' | '/import/image', url: string): Promise<Response> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
  })
  if (!res.ok) {
    // A dead importer yields a non-JSON 502 from the proxy — parse defensively.
    let body: { error?: string; message?: string } | null = null
    try { body = await res.json() } catch { /* non-JSON */ }
    throw new ImporterError(body?.error ?? 'unreachable', body?.message ?? 'Importer unreachable', res.status)
  }
  return res
}

export async function extractUrl(url: string): Promise<ExtractResult> {
  return (await post('/import/extract', url)).json()
}

// og:image bytes → a File the §8 pipeline can eat (pipeline re-encodes/renames to .webp anyway).
export async function fetchImportImage(url: string): Promise<File> {
  const res = await post('/import/image', url)
  const blob = await res.blob()
  const name = (() => {
    try { return new URL(url).pathname.split('/').filter(Boolean).pop() || 'imported-image' }
    catch { return 'imported-image' }
  })()
  return new File([blob], name, { type: blob.type })
}
```

## Task 2 — `web/src/features/patterns/pendingUrlImport.ts` (new)

Mirror `pendingAttachmentImport.ts` **verbatim** — module-scope `pending` var, `UNSET` symbol,
`useRef` consume-during-render (keep the StrictMode comment: a lazy `useState` initializer or an
effect runs twice in dev and the second pass would null out the real stash; the ref survives the
double-invoke, and resolving during render folds straight into `useForm` defaults).

```ts
export interface PendingUrlImport {
  defaults: Partial<PatternFormValues> // merged over patternFormDefaults by PatternFormPage
  importedFrom: string | null          // chip label; null on the soft-failure path (no chip)
  thumbnail: ProcessedImage | null     // null when og:image absent or its fetch/pipeline soft-failed
}
export function setPendingUrlImport(next: PendingUrlImport): void
export function useConsumePendingUrlImport(): PendingUrlImport | null
```

## Task 3 — `web/src/features/patterns/usePasteLinkDoor.ts` (new)

API mirrors `useAddFileDoor` minus input plumbing: `usePasteLinkDoor(onDone?: () => void)` →
`{ busy, error, clearError, onPress }`. `clearError` in `useCallback` (sheet open-effect dep,
same as `useAddFileDoor.ts:94`).

**The gesture-critical shape** (clipboard read is the FIRST statement; `busyRef` is the sync
double-tap guard since state updates are async):

```ts
const onPress = () => {
  if (busyRef.current) return
  setError('')
  if (!navigator.clipboard?.readText) { setError(MSG_NO_CLIPBOARD); return }
  const read = navigator.clipboard.readText() // sync-in-gesture — iOS paste bubble
  busyRef.current = true
  setBusy(true)
  void run(read).finally(() => { busyRef.current = false; setBusy(false) })
}
```

`run(read)`:
1. `await read` — rejection (iOS "Don't Allow" → NotAllowedError) → inline `MSG_PASTE_DENIED`,
   return. **No navigation on any inline outcome.**
2. Sanitize:
   ```ts
   function sanitizeUrl(raw: string): string | null {
     const text = raw.trim()
     if (!text || /\s/.test(text) || text.length > 2048) return null // server caps url at 2048
     const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
     try {
       const url = new URL(candidate)
       if (url.protocol !== 'http:' && url.protocol !== 'https:') return null // mailto:, data:…
       if (!url.hostname.includes('.')) return null // "hello" would otherwise parse
       return url.href
     } catch { return null }
   }
   ```
   Empty-after-trim → inline `MSG_EMPTY`; otherwise-null → inline `MSG_NOT_A_LINK`; return.
3. `const meta = await extractUrl(url)` in try/catch — **every** failure (400/401/403/422/429/
   502/timeout) takes the uniform soft path (`meta = null`, remember the `ImporterError` code).
4. If `meta?.image`: `thumbnail = await processImage(await fetchImportImage(meta.image))` inside
   one broad try/catch → `thumbnail = null` + `console.warn('[paste-link] image soft-fail', err)`.
   Do NOT rethrow non-ImagePipelineError (unlike the file door — the user didn't pick this image;
   covers 422 non-image, 10 MB cap, 429 on the second request, SVG failing createImageBitmap).
5. Unmount guard (the flow can run ~25 s worst-case; user may navigate away):
   `if (!mountedRef.current) { if (thumbnail) revokePreview(thumbnail.previewUrl); return }`
   (`mountedRef` set false in a `useEffect` cleanup.)
6. Stash + go:
   ```ts
   setPendingUrlImport(
     meta
       ? {
           defaults: {
             title: meta.title ?? '',
             designer: meta.author ?? '',          // craft blogs put the designer in meta author
             source_url: meta.canonical_url ?? meta.source_url,  // Zara's pick #2
             source_name: meta.site_name ?? hostLabel(meta.canonical_url ?? meta.source_url),
             notes: meta.description ? `<p>${escapeHtml(meta.description)}</p>` : '', // pick #3
           },
           importedFrom: meta.site_name ?? hostLabel(meta.canonical_url ?? meta.source_url),
           thumbnail,
         }
       : { defaults: { source_url: url }, importedFrom: null, thumbnail: null },
   )
   onDone?.()
   navigate('/patterns/new')
   if (!meta) toast(failCode === 'rate_limited' ? MSG_RATE_LIMITED : MSG_SOFT_FAIL, 'info')
   else if (meta.image && !thumbnail) toast(MSG_IMAGE_SOFT_FAIL, 'info')
   ```
   Helpers in this file:
   ```ts
   // TipTap's value is an HTML string — plain scraped text must be escaped before wrapping.
   const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   const hostLabel = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
   ```

## Task 4 — wire the third door into both surfaces

**`QuickAddSheet.tsx`** — `const paste = usePasteLinkDoor(onClose)`;
`const anyBusy = busy || paste.busy` (file door's `busy` + paste's). New `<Door>` **first**:
icon `ClipboardPaste` size 28 (spinner while `paste.busy`), title `Paste a link`, caption idle
`A pattern page from the web` / busy `Fetching that page…`,
`soft="var(--patch-lilac-soft)" deep="var(--patch-lilac-deep)"`, `disabled={anyBusy}`,
`onPress={paste.onPress}`. All three doors + the backdrop close button switch to
`disabled={anyBusy}`; the open-effect calls both `clearError`s; render both error paragraphs
(at most one non-empty in practice).

**`DoorsRow.tsx`** — `grid-cols-2` → `grid-cols-3`; lilac paste `DoorTile` first (caption idle
`A link you copied` — short for 3-col at 390 px; busy `Fetching that page…`); same
`anyBusy`/dual-error composition. Update both files' header comments (the "joins in 3.2" notes
have come due).

## Task 5 — consume on the form page + chip

**`PatternFormPage.tsx`** (beside the existing unconditional attachment consume):
```ts
const pendingUrl = useConsumePendingUrlImport()
const createDefaults = {
  ...patternFormDefaults,
  ...(pendingUrl?.defaults ?? {}),
  ...(pendingImport ? { title: pendingImport.suggestedTitle } : {}), // file door wins (can't coexist)
}
// initialThumbnail={mode === 'create' ? (pendingImport?.thumbnail ?? pendingUrl?.thumbnail ?? undefined) : undefined}
// importedFrom={mode === 'create' ? (pendingUrl?.importedFrom ?? undefined) : undefined}
```
No submit-path changes — no attachment is created; the thumbnail rides the existing
`ThumbnailState` `kind:'new'` mechanics and `buildPatternFormData` already appends it.

**`PatternForm.tsx`** — new optional prop `importedFrom?: string`; render in the
`pendingAttachmentLabel` slot (below `ThumbnailField`; mutually exclusive with it):
```tsx
{importedFrom && (
  <span
    className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-semibold"
    style={{ background: 'var(--patch-lilac-soft)', color: 'var(--patch-lilac-deep)' }}
  >
    <Link size={14} strokeWidth={2} aria-hidden="true" />
    imported from {importedFrom}
  </span>
)}
```

## Task 6 — housekeeping

- `web/package.json` → `0.3.2` (settings footer picks it up via the Vite `define`).
- DECISIONS.md lines (draft, one each):
  1. Paste-door modules live in `features/patterns/` beside the file door they mirror ·
     SPEC §6's `features/import/` folder folded in (home/settings precedent); Zara's pick with p10.
  2. Saved pattern link = `canonical_url` (post-redirect, og:url-resolved — UTM/share junk
     stripped), falling back to the pasted URL · SPEC §10 doesn't say which of the pair the form
     keeps; Zara's pick with p10.
  3. og:description pre-fills notes as one HTML-escaped `<p>` (TipTap value is an HTML string);
     og:author pre-fills designer · "cute pre-filled form out" beyond DESIGN's literal
     title/source/thumbnail list; Zara's pick with p10.
  4. New microcopy (p10): door captions "A pattern page from the web" / "A link you copied" /
     "Fetching that page…"; inline "That doesn't look like a link — copy the page's address and
     try again." / "Nothing to paste yet — copy a pattern link first." / "Stitches wasn't allowed
     to peek at your clipboard — tap Paste when iOS asks." / "Pasting isn't available here — the
     Type-it-in door still works."; toasts (all `info`) "Couldn't read that page — the link is
     filled in for you." / "That's a lot of imports at once — the link is filled in; give it a
     minute." / "Couldn't fetch the picture — everything else made it."; chip "imported from
     {site}" · DESIGN gives only the chip shape verbatim.

## Edge-case ledger (all handled above)

Double-tap (`busyRef` + disabled doors) · unmount mid-flow (`mountedRef` → discard + revoke) ·
dialog trap during busy (backdrop disabled but the 12 s client timeout guarantees busy ends) ·
empty / non-URL / multi-line / >2048-char clipboard, paste denied, clipboard API absent → four
inline copies, never navigate · scheme-less text → `https://` prefix + hostname-dot check ·
`mailto:`/`data:`/`javascript:` → rejected · non-image og:image (422) · SVG og:image (passes
server `image/*`, fails `createImageBitmap` → caught) · >10 MB image (422) · 429 on either
request · 401 mid-session (incl. importer's PB-unreachable-as-401) · importer down (non-JSON 502
→ `unreachable`) · hung proxy (AbortSignal.timeout) · null title → `''` (zod "Every pattern
needs a name" blocks save) · full reload on `/patterns/new` → bridge lost, blank form
(documented file-door precedent — manual entry never blocked).

## Verification

- **Claude runs:** `npm run lint` clean · `tsc -b` in `web/` exit 0.
- **Zara runs** (`npm run dev`, iPhone via tailscale serve — 📱 acceptance):
  1. Copy a Ravelry pattern URL → dock ➕ → Paste a link → form pre-filled (title, designer if
     present, source name "Ravelry", canonical link, notes blurb, lilac chip, compressed
     thumbnail) → save → detail shows the thumbnail. *(PLAN box 1, Ravelry half)*
  2. Random craft-blog URL from Home's three-door row → same; row sane at 390 px. *(box 1)*
  3. Garbage URL (`https://nope.invalid`) → form opens with only the link filled + gentle toast;
     title typed by hand saves fine. *(PLAN box 2)*
  4. Non-URL clipboard → inline error, sheet stays open. 5. Empty clipboard → inline. 6. "Don't
     Allow" on the paste bubble → inline. 7. Importer killed → soft path within ~12 s.
  8. Double-tap → one import. 9. Busy: backdrop won't dismiss, caption "Fetching that page…".
  10. Page with no og:image → pre-filled, no thumbnail, no error. 11. Abandon the pre-filled
     form, reopen "Type it in" → blank (no stale stash).
- PLAN 3.2 boxes stay **unticked** until Zara confirms (memory: acceptance batched per phase).
- No schema/rules/seed changes → no `verify:rules` rerun required.

## Wrap-up

- Session log `logs/2026-07-13_session-3.2-paste-link.md` (house format, 40–60 lines).
- Note in the log: 3.1's "`/patterns/new?url=` prefill" open item is superseded by the module
  bridge (a File can't ride a query param; matches the file-door precedent).
- Out of scope, deliberately: Ravelry API enrichment (Phase 6), share-sheet/PWA entry points,
  multi-image import (og:image only), PM2/deploy (5.1).
