# 2026-07-19 — Phase 6 add-ons research & spec (offline · share links · clipper · yarn stash)

**Date:** 2026-07-19
**Type:** research/spec session (Ravelry-precedent shape) — docs only, no code, no schema.

## What was done

- Explored the offline-relevant web plumbing (PWA runtime caching, no query persistence, the
  auth-boot `authRefresh().catch(clear)` offline logout bug), the full PB rules surface (zero
  anonymous access anywhere; migration/rules idioms), and the importer (no CORS anywhere;
  clipper needs none).
- Verified against current PB docs: `@request.query.*` is documented in rules; `pb_hooks`
  `routerAdd` routes get app-privilege DB access; non-protected files are public by URL
  (share-page photos need no tokens). All flagged for empirical re-verification on v0.39.6.
- Wrote `docs/ADDONS.md` — the four features spec'd to buildable depth: schemas, exact rule
  strings, the `pb_hooks` share route, offline sync/persistence/vault design, extension layout,
  microcopy drafts (pending approval), 13-item verify-at-build list, dependency pins.
- Rewrote `PLAN.md` Phase 6 from a backlog stub into Sessions 6.1–6.5 with acceptance criteria
  (all boxes unchecked); Ravelry noted as shipped; gpt-oss assist moved to a trimmed stretch
  backlog.
- Appended the DECISIONS.md spec-session line.

## Decisions made (Zara, via AskUserQuestion — ten)

- Vault offline: per-file "Keep on this phone" toggle (opt-in, owner-only, device IDB).
- Share scope: patterns and projects; mechanism: `pb_hooks` server-rendered `/share/{token}`
  postcard with OG tags — API collections keep the zero-anonymous invariant.
- Clipper: open-in-tab MV3 extension + bookmarklet; docs-only delivery (`docs/clipper.md`).
- Yarn stash: linked to projects (optional multi-relation, no quantity math); Library segmented
  Patterns | Yarn tabs; quiet-unlink deletion (deliberate deviation from pattern-delete block).
- Offline guarantee: full-library proactive sync + "Sync now" in Settings, not visited-only.
- Build order: stash → offline (two sessions) → share → clipper.

## Open items

- Everything in ADDONS §7 (verify-at-build): PB multi-relation rule quantifiers (decides the
  friends-linkable yarn rule vs own-only fallback), JSVM hook API names on v0.39.6, iOS
  `blob:` PDF + `storage.persist()` behavior, dep patch pins, `tab.url` in MV3 callbacks.
- Microcopy drafts in ADDONS are pending approval at each build session.
- SPEC §7/§11/§12/§13/§17 and DESIGN §3/§8/§9 edits deferred to the sessions that make them
  true (Ravelry precedent).
- Sessions 6.4/6.5 are most useful after Phase 5 (provision & launch), which remains unbuilt.

## Key file paths

- `docs/ADDONS.md` — new, binding spec for Phase 6
- `docs/PLAN.md` — Phase 6 rewritten (Sessions 6.1–6.5 + stretch backlog)
- `docs/DECISIONS.md` — one appended line (2026-07-19, add-ons spec)
