# DESIGN.md — Stitches Visual System & UX Flows

*Version 1.0 · July 2026 · Companions: `SPEC.md` (architecture), `PLAN.md` (build phases).
This document closes the handoff's open item: the token palette and exact daisyUI theme values.*

---

## 1. Design intent

Stitches should feel like a personal craft room: warm, soft, a little playful, never busy. The
reference points are Cece's favorite light blue, the patchwork palette of Stitches the Animal
Crossing bear, and — usefully — Animal Crossing's own UI language: cream surfaces, chubby rounded
shapes, dark warm-brown text, pastel accents. The chosen register is **calm base, candy accents**:
a cream canvas with Cece-blue leading, and four patch colors (coral, lilac, mint, butter) used
*semantically* — statuses, tags, illustrations — never as wallpaper.

Hard rules: flat, opaque surfaces. Soft warm shadows are fine; **backdrop blur and glassmorphism
are forbidden everywhere, permanently.** Whimsy lives in empty states and celebrations; forms and
destructive flows stay plain and clear.

## 2. Design tokens — `web/src/styles/theme.css`

This file is the single source of truth. **No hex codes anywhere else in the codebase.**

```css
@import "tailwindcss";

@plugin "daisyui" {
  themes: stitches --default, stitchesdim;
}

/* ── The craft room (app-wide) ─────────────────────────── */
@plugin "daisyui/theme" {
  name: "stitches";
  default: true;
  color-scheme: light;

  --color-base-100: #FFFCF6;        /* cards / raised surfaces        */
  --color-base-200: #FAF4E9;        /* the canvas (page background)   */
  --color-base-300: #EFE5D3;        /* hairlines, washes, dividers    */
  --color-base-content: #4A3C33;    /* espresso ink                   */

  --color-primary: #8CCAEE;         /* Cece blue                      */
  --color-primary-content: #103C58; /* deep marine on blue            */
  --color-secondary: #CDA9E3;       /* lilac                          */
  --color-secondary-content: #4E2B66;
  --color-accent: #9ADDB6;          /* mint                           */
  --color-accent-content: #14523A;
  --color-neutral: #4A3C33;
  --color-neutral-content: #FFFCF6;

  --color-info: #1F6592;            /* deep blue — links, focus       */
  --color-info-content: #FFFCF6;
  --color-success: #237A4C;
  --color-success-content: #FFFCF6;
  --color-warning: #8A6A0E;
  --color-warning-content: #FFFCF6;
  --color-error: #A63E14;           /* coral-deep — destructive       */
  --color-error-content: #FFFCF6;

  --radius-selector: 1rem;
  --radius-field: 2rem;             /* pill buttons & inputs          */
  --radius-box: 1.5rem;             /* cards & sheets                 */
  --border: 1.5px;
  --depth: 1;                        /* daisyUI soft dimensionality — this is our "juice", not blur */
  --noise: 0;
}

/* ── The moonlit counter (counter screen subtree only) ──── */
@plugin "daisyui/theme" {
  name: "stitchesdim";
  color-scheme: dark;

  --color-base-100: #1B2740;
  --color-base-200: #141D31;
  --color-base-300: #0E1526;
  --color-base-content: #E9EFF7;

  --color-primary: #9AD2F3;
  --color-primary-content: #0C2A40;
  --color-accent: #8FDDB4;
  --color-accent-content: #0F3D2B;
  --color-neutral: #E9EFF7;
  --color-neutral-content: #141D31;
  --color-error: #FFB48F;
  --color-error-content: #4A1F0A;

  --radius-selector: 1rem;
  --radius-field: 2rem;
  --radius-box: 1.5rem;
  --border: 1.5px;
  --depth: 1;
  --noise: 0;
}

@theme {
  --font-sans: "Nunito", ui-rounded, system-ui, sans-serif;
  --font-display: "Baloo 2", "Nunito", ui-rounded, system-ui, sans-serif;
}

:root {
  /* Patch accents — tags, status chips, illustration fills */
  --patch-blue-soft:   #DCEEF9;  --patch-blue:   #8CCAEE;  --patch-blue-deep:   #1F6592;
  --patch-coral-soft:  #FFE0D1;  --patch-coral:  #FFB48F;  --patch-coral-deep:  #A63E14;
  --patch-lilac-soft:  #F0E4F8;  --patch-lilac:  #CDA9E3;  --patch-lilac-deep:  #4E2B66;
  --patch-mint-soft:   #DEF3E6;  --patch-mint:   #9ADDB6;  --patch-mint-deep:   #14523A;
  --patch-butter-soft: #FBF0CC;  --patch-butter: #F6D97E;  --patch-butter-deep: #7A5D0B;

  --ink-muted: #6E6152;           /* secondary text on cream */

  --shadow-soft: 0 2px 10px rgb(74 60 51 / 0.08);   /* warm-tinted, never gray */
  --shadow-lift: 0 8px 24px rgb(74 60 51 / 0.12);

  --dur-quick: 150ms;
  --dur-soft:  220ms;
  --ease-pop:  cubic-bezier(0.2, 0.9, 0.3, 1.15);
}
```

Fonts are self-hosted via `@fontsource/baloo-2` (600, 700) and `@fontsource/nunito`
(400, 600, 700), imported once in the app entry.

## 3. Color semantics

Every color use is a meaning, not a decoration.

| Thing | Color | Rationale |
|---|---|---|
| Status: planned | lilac | dreaming stage |
| Status: in progress | blue | "on the hook" — the brand color means *active* |
| Status: finished | mint | gentle success |
| Status: frogged | coral | warm and wry, never error-red |
| Status: hibernating | butter | napping in the sun |
| Shelf: saved / want to make / queued | neutral outline / coral heart / lilac list | icon-led chips |
| Tags | user's pick of the five patches | `color` select in schema |
| Links, focus rings | `--patch-blue-deep` | |
| Destructive actions | `--color-error` (coral-deep) | reserved for delete, only |

Chip anatomy: **soft** fill + **deep** text of the same patch. Selected chips flip to **core**
fill + espresso ink. Measured ratios (Phase 0, `scripts/verify/contrast.mjs`, 2026-07-10):
soft/deep pairs 5.07–9.22:1, espresso-on-core pairs 5.23–7.63:1 — all pass AA (4.5:1) with room.
An earlier draft claimed "≈9:1" for soft/deep; only lilac reaches that. The contrast check is a
permanent gate: re-run it whenever tokens change.

## 4. Typography

Baloo 2 for display (headings, numerals, empty-state titles, the wordmark); Nunito for everything
else. Scale is a ~1.2 ratio from 16 px:

| Token | Size / line | Use |
|---|---|---|
| xs | 12 / 1.4 | meta labels, dock labels |
| sm | 14 / 1.45 | secondary text, chips |
| base | 16 / 1.55 | body — **also the floor for every input** (iOS focus-zoom) |
| lg | 19 / 1.4 | card titles |
| xl | 23 / 1.3 | section titles (Baloo 600) |
| 2xl | 28 / 1.2 | screen titles (Baloo 700) |
| 3xl | 34 / 1.15 | hero moments (Baloo 700) |
| counter | `clamp(5.5rem, 26dvh, 10.5rem)` | Baloo 700, `font-variant-numeric: tabular-nums` (test on-device; fallback is a fixed-width digit container so the numeral never jitters) |

## 5. Shape, space, elevation

4 px base grid; spacing steps 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48. Mobile gutter 20 px; design at
390 px first. Desktop: centered content, `max-width: 1080px`, patterns grid widens to 3–4 columns,
dock becomes a slim top bar — desktop is an adaptation, never the design target.

Elevation is two warm shadows (`--shadow-soft` for cards, `--shadow-lift` for sheets and the
active hero) plus daisyUI's `--depth` on fields. Borders are 1.5 px `base-300`. The **stitch
border** — `2px dashed` in `base-300` or a patch-soft — is the signature: used on upload
dropzones, "add new" ghost cards, and as a running-stitch section divider. Never on filled
content cards.

## 6. Motifs & illustration rules (binding for all Claude-made SVGs)

The motif inventory: **yarn ball** (logo mark, loading state — a thread draws a circle), **X
stitches** (button-eye energy: close buttons, tiny accents), **stars** (the shirt: confetti,
empty-state sprinkles, always in patch colors), **dashed seams** (patch edges).

Style rules so every asset looks like one hand made it:
1. Flat fills from the token palette only. No gradients, no strokes-as-gradients, no blur filters.
2. Strokes: 2.5–3 px, `round` caps and joins, espresso or a patch-deep.
3. Icons: lucide-react at 24 px / 2 px stroke is the system set. Custom icons match that grid
   exactly so they mix invisibly. Decorative illustrations live at 96–160 px.
4. Geometry is round and chubby, not hand-wobbled — cuteness from proportion, not imperfection.
5. Every illustration must read on both `base-200` (cream) and `stitchesdim` navy, or ship two
   variants.

## 7. Motion principles

150–250 ms, ease-out or `--ease-pop`; animate `transform` and `opacity` only. Buttons press to
`scale(0.97)`. The counter numeral does a soft roll-pop on change. Celebration hierarchy: counter
target reached → one mint star pops; project → finished → star confetti in all five patches,
≤1.5 s, once. **Every non-essential animation respects `prefers-reduced-motion`** — values still
update instantly, nothing celebratory plays.

## 8. Component inventory (daisyUI mapping)

Buttons: `btn` pills — primary (blue), tonal (patch-soft + deep ink), ghost, and `btn-error` for
destructive only; min-height 48 px. Chips: `badge` pills per §3. Cards: `card` on `base-100`,
`radius-box`, `shadow-soft`; ghost/add cards use the stitch border. Inputs: `input`/`select`/
`textarea`, 48 px min height, 16 px font, labels always visible (no placeholder-as-label);
textareas use `radius-box`. Sheets: daisyUI `modal` (native `<dialog>`) bottom-sheet variant with
a drag handle — used for filters, status change, counter editing. Toasts: top, 2.5 s, one at a
time. Dock: daisyUI `dock`, 4 items + raised 56 px center "+" (blue circle, espresso plus), 24 px
lucide icons, 12 px labels, `padding-bottom: env(safe-area-inset-bottom)`.

Dock slots: **Home · Library · ➕ · Projects** (Friends joins as the 5th in the sharing phase).
Settings live behind the avatar in the home header.

## 9. Screens & flows

**Login.** Centered card on cream: yarn-ball mark + "Stitches" wordmark (Baloo), email, password,
big pill button. Footer: "Stitches is invite-only ♡". No signup path exists. Errors are gentle and
plain.

**Home — "On the hook."** Greeting + avatar (→ settings). Hero card: the most recently updated
in-progress project — cover, name, pattern, live primary counter value, and two actions: a big
**Count** button (→ counter screen) and **Journal** (quick entry). Multiple in-progress projects:
horizontal snap-scroll of hero cards. Below: the four import doors as a 2×2 grid of cute buttons
(Paste a link · Add a file · Type it in · Search Ravelry — RAVELRY.md R2, DECISIONS 2026-07-19),
then a "recently added" pattern strip. New-user empty state: illustration + "start your library."

**Library (`/patterns`).** Sticky search, filter chip row (shelf, craft, weight, tags → filter
sheet), grid/list toggle (grid default). Grid: 2-col, 4:5 thumbnails, title, designer,
tag dots, mint "made ✓" badge when earned. List: compact rows, small thumb. Distinct empty vs.
no-results states. Filters serialize to URL params (shareable, back-button-safe).

**Pattern detail.** Hero image; title; designer; source chip (opens in new tab); shelf segmented
pill; meta chips — craft, CYC weight ("4 · Medium/Worsted"), hook with alias ("5.0 mm · H-8"),
gauge, yardage, difficulty; tags; notes; photo strip. **Attachments card is owner-only**, marked
with a lock and the microcopy "Only you can ever see these." Projects section lists this pattern's
projects + "Start a project." Visibility toggle helper text, verbatim: *"Friends can see this
pattern's info and photos — never your files."*

**Save form (all four doors land here).** Basics open (title, thumbnail, craft, shelf); Details
collapsible (weight/hook/gauge/yardage/difficulty); tags with inline create + patch-color pick;
source; notes; attachments. Hook field: mm number input with live US-alias readout. Sticky
safe-area Save bar. URL door shows an "imported from {site}" chip; a failed extraction opens the
form with just the URL filled and a gentle toast — manual entry is never blocked. The mm↔US map
lives in `web/src/lib/hooks.ts`; core rows: 2.25 B-1 · 2.75 C-2 · 3.25 D-3 · 3.5 E-4 · 3.75 F-5 ·
4.0 G-6 · 5.0 H-8 · 5.5 I-9 · 6.0 J-10 · 6.5 K-10½ · 8.0 L-11 · 9.0 M/N-13 · 10.0 N/P-15.

**Projects.** Status chips filter (In progress first by default), cards with cover, name, pattern,
status chip, started date, and a slim progress bar when counters have targets. Sorted by recently
updated.

**Project detail.** Cover, name, status chip → status sheet. Flipping to finished: confetti,
`finished_on` defaults to today, and a prompt offers a "finished photo" journal entry. Pinned
summary card (edit in place). Counters card: rows with label, value, small ±, link glyph when
linked, and one big **Open counter** button. Journal feed: date-grouped entries, photos in rounded
grids, composer at top ("Add an entry… 📷"), editable date for backdating. Frogged microcopy:
"Frogged — rip-it happens."

**Counter (`/projects/:id/count`) — the flagship surface.** Full-screen, `100dvh`, its own §10.

**Friends (sharing phase).** A cozy feed of shared patterns and finished objects with owner
avatars. Detail views reuse the pattern/project screens read-only; attachments and counters simply
do not render for non-owners (rules already forbid them — the UI never even hints).

**Settings.** Name, avatar, change password (old + new — matters since there's no SMTP), counter
preferences (wake-lock default, dim-mode memory, the experimental haptic-tick toggle, default
off), sign out, version.

## 10. Counter surface deep-dive

Layout, top to bottom: 56 px bar (back · project name · moon toggle · wake-lock toggle · edit);
the numeral zone — active counter label, giant tabular numeral, and when a target exists, a slim
progress bar with "12 of 48 rows"; a compact strip of the *other* counters' live values (tap to
switch; also swipeable as a pager with dots); then the **tap zone**: full-width, anchored to the
bottom, `height: clamp(120px, 22dvh, 180px)` plus `env(safe-area-inset-bottom)` — the whole zone
is +1, reachable by either thumb without looking. Directly above it, a 44 px row: **−1**, **edit
value** (opens number input), **reset**. Linked counters show a caption ("Rows +1 resets
Stitches"). A tiny stitch icon appears top-corner while the outbox is non-empty ("syncing").

Feedback: numeral roll-pop, brief background pulse of `primary` at 8% opacity. Target reached:
one mint star. Dim mode: `data-theme="stitchesdim"` on this subtree only; 250 ms cross-fade; the
numeral gets a soft blue `text-shadow` glow (a shadow, not a blur filter — stays legal). Surface
rules: `touch-action: manipulation`, `user-select: none`, `overscroll-behavior: none`. The value
region is `aria-live="polite"`; every control has an explicit label.

## 11. Voice & microcopy

Warm, brief, craft-flavored; never guilt, never hype. Whimsy budget: empty states, celebrations,
the frogged status. Plain-language budget: forms, errors, anything destructive ("Delete this
pattern and its attachments? This can't be undone."). Empty library: "No patterns yet — your shelf
is ready when you are." Empty projects: "Nothing on the hook. Chain on!"

## 12. iOS hygiene checklist — binding

1. `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
2. `dvh`/`svh` units only — never `100vh`.
3. `env(safe-area-inset-*)` padding on the dock, counter tap zone, and every sticky bar.
4. Tap targets ≥ 44×44 pt everywhere.
5. Inputs ≥ 16 px font-size (kills focus-zoom).
6. `touch-action: manipulation` on all interactive elements; no double-tap-zoom surprises.
7. `-webkit-tap-highlight-color: transparent` — we ship our own pressed states.
8. `overscroll-behavior` contained on sheets and the counter.
9. Standalone PWAs have no browser chrome: **every screen renders an in-app back affordance.**
10. Hover is enhancement only; nothing requires it.
11. Animate `transform`/`opacity` only; test scrolling at 60 fps on a real device.
12. Test the on-screen keyboard against sticky Save bars on a real iPhone (known Safari pain).
13. `apple-touch-icon` (180 px) + maskable 512 px icon; manifest `display: standalone`,
    `theme_color` and `background_color` = `#FAF4E9`.

## 13. Accessibility commitments

WCAG AA contrast on every token pair used for text (checked in Phase 0 and whenever tokens
change); visible `:focus-visible` rings (2 px `--patch-blue-deep`, 2 px offset); real `<dialog>`
sheets with focus trapping (daisyUI provides); labels on every input; `prefers-reduced-motion`
honored globally; counter value announced politely to VoiceOver.

## 14. App icon

Three concepts (A: yarn ball on blue · B: patchwork heart on cream · C: night-stitch S on navy)
are rendered alongside this document; the pick drops into the manifest, `apple-touch-icon`, and a
maskable variant with the mark held inside the center 80% safe zone. The wordmark everywhere is
Baloo 2 700, lowercase "stitches".