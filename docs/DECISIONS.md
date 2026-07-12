# DECISIONS.md — Stitches decisions log

One line per decision: date · what · why. Append whenever a session deviates from
SPEC/DESIGN (per the PLAN.md session ritual).

- 2026-07-10 · Docs renamed to `docs/SPEC.md` / `DESIGN.md` / `PLAN.md` / `handoff.md` · match PLAN.md's binding references.
- 2026-07-10 · Node pinned 24.18.0 (nvm + `.nvmrc` + `engines`); dev machine had 26.0.0 · SPEC §5 says Node 24 LTS on dev and VPS.
- 2026-07-10 · **Version policy: pin to AI-known majors.** Scaffolded with `create-vite@7.1.3` → Vite 7.3.6, not current Vite 8 · AI assistance breaks on post-knowledge majors; deviates from SPEC §5 "current major" but stays inside its "7/8-era" note.
- 2026-07-10 · `@vitejs/plugin-react` held at 5.2.0 · 6.x peer-requires Vite ^8 only — never bump without deliberately moving to Vite 8.
- 2026-07-10 · TypeScript 5.9.3 (template shipped ~5.8.3; registry latest is 7.0.2) · SPEC pins 5.x; TS 7 (2-day-old Go rewrite) is peer-rejected by typescript-eslint (`<6.1.0`).
- 2026-07-10 · React Router 7.18.1, package `react-router` only · SPEC pins ^7; v8.2.0 (ESM-only, breaking) deferred per SPEC §16 #6.
- 2026-07-10 · ESLint 9.39.5 stack from the CV7 template + `eslint-config-prettier` · SPEC §12 "ESLint + Prettier defaults"; ESLint 10 is post-AI-knowledge.
- 2026-07-10 · `@types/node` pinned 24.13.3 · npm's `latest` tag tracks Node 26, not our pinned 24.
- 2026-07-10 · PocketBase v0.39.6 pinned in `scripts/dev.sh`; binary + `pb_data/` gitignored, downloaded on first `npm run dev`.
- 2026-07-10 · DESIGN §3 chip-contrast prose corrected with measured ratios (soft/deep 5.07–9.22:1, espresso-on-core 5.23–7.63:1) · the draft's "≈9:1" claim only holds for lilac; all pairs pass AA.
- 2026-07-11 · Login wordmark is lowercase `stitches` (Baloo 2 700) · resolves the DESIGN §9 ("Stitches") vs §14 (lowercase wordmark everywhere) conflict in favor of §14's more specific typographic rule.
- 2026-07-11 · `lucide-react` pinned 1.24.0 (post-AI-knowledge 1.x major); icon names verified against the installed package — the `Home` icon is now `House` · never trust remembered 0.x lucide names; grep the package's `.d.ts` first.
- 2026-07-11 · Session 0.2 deps pinned: `pocketbase` 0.27.0, `react-hook-form` 7.81.0, `zod` 4.4.3, `@hookform/resolvers` 5.4.0 (zodResolver accepts zod 4 via standard-schema) · SPEC §5 stack, exact pins per `.npmrc`.
- 2026-07-11 · Tailscale admin DNS: **"Override DNS servers" enabled** (global nameserver 1.1.1.1) · iOS let a non-Tailscale resolver win despite "Use Tailscale DNS" (tailscale#12563), so the iPhone got NXDOMAIN for `*.ts.net` and 📱 HTTPS tests were blocked; lives in the admin console, not the repo — don't disable without re-testing MagicDNS on iOS.
- 2026-07-11 · **API rules hardened beyond SPEC §7's literal text** (auth-gate prefix on visibility-aware reads; `:changed` locks on attachment→pattern / entry→project / counter→project; `project.owner` guard on counters create; pattern-link visibility guard on projects create/update) · the literal rules leaked shared records to anonymous requests and let a user re-point owned records into a friend's shared parents.
- 2026-07-11 · patterns.deleteRule gains a `projects_via_pattern` back-relation guard · PB v0.39.6 blocks deletes only for *required* relation references (verified against the pinned binary) and silently auto-unlinks optional ones — SPEC §7's "deleting a pattern with linked projects is blocked" needed a rule to be true.
- 2026-07-11 · `owner` relations `cascadeDelete: true` on all six library collections · account deletion (superuser-only) wipes that person's content; SPEC was silent.
- 2026-07-11 · PB v0.39.6 has **no schema-level field defaults** · SPEC §7's "default …" selects ship optional; empty visibility never matches `"friends"` so records are private-by-default, and the Session 1.2 forms supply display defaults (crochet/saved/planned/private).
- 2026-07-11 · `thumbs ["100x100","400x0","800x0"]` provisioned on every image file field (incl. `projects.cover`, `journal_entries.photos`) · PB serves `?thumb=` variants only for pre-declared sizes; SPEC §8's "lists never load originals" silently breaks otherwise.
