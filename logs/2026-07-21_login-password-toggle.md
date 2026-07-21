# 2026-07-21 — Password visibility toggle (login + settings) + em-dash microcopy audit

## What was done

- Added a show/hide password (eye) toggle to every password field in the app.
- New shared `web/src/components/PasswordInput.tsx`: DaisyUI wrapper pattern
  already used by `SearchBar.tsx` (wrapper carries `input input-lg`, bare
  input inside with `grow`), plus an inner icon button that flips the input
  `type` between `password` and `text`. Accepts standard input props
  (react-hook-form `register()` spreads straight in; React 19 passes `ref`
  through props, so no forwardRef).
- `web/src/routes/LoginPage.tsx`: password field uses `PasswordInput`.
- `web/src/features/settings/components/PasswordCard.tsx`: all three fields
  (current, new, confirm) use `PasswordInput`.
- Em-dash microcopy audit (Zara's call): every rendered UI string in `web/src`
  swept; ~33 strings across ~25 files rewritten with a period, comma, or plain
  connective, meaning preserved. Highlights: home empty state now "Save a
  pattern you love. The hook can wait."; empty library matches DESIGN's
  period style; "Frogged. Rip-it happens."; error toasts like "Something went
  wrong. Try again?". `DeleteConfirmDialog` also gained singular/plural
  agreement ("Unlink it/them first"). Code comments and the numeric-range
  en-dash in `MetaChips.tsx` were left alone.
- DESIGN §11 updated: verbatim quotes match the app and the no-em-dash rule
  is codified. DECISIONS.md got the audit line. DESIGN.md also gained its
  missing trailing newline (markdownlint MD047).

## Decisions made

- Reused the `SearchBar.tsx` idiom rather than inventing a new one: lucide
  icons at `size={20} strokeWidth={2}`, muted via `var(--ink-muted)`, button
  is `size-11` (44 px) for the iOS tap-target rule, `-mr-2` to tuck it into
  the field padding.
- `Eye` = hidden state ("tap to show"), `EyeOff` = visible state; `aria-label`
  swaps between "Show password" / "Hide password".
- `onMouseDown={preventDefault}` on the toggle so tapping it doesn't blur the
  input and dismiss the iOS keyboard mid-typing.
- Each `PasswordInput` owns its visibility state independently, so revealing
  the new password in settings never reveals the current one.

## Open items

- Device pass (does it load/look right on iPhone) is Zara's, per usual.

## Key file paths

- `web/src/components/PasswordInput.tsx` (new)
- `web/src/routes/LoginPage.tsx` (modified)
- `web/src/features/settings/components/PasswordCard.tsx` (modified)
- `logs/2026-07-21_login-password-toggle.md` (this log)

Verification: `npm run lint` and `npx tsc -b` both green.
