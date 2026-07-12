# 2026-07-11 — Tailscale MagicDNS on iPhone: diagnosed and fixed

## What was done

- Systematically debugged `docs/HANDOFF_tailscale-dns.md` (iPhone Safari: "hostname could
  not be found" for `zakirs-macbook-air.tailfaeaf.ts.net`; Mac fine).
- Mac-side evidence (read-only): `tailscale dns status` showed a correct pushed config
  (MagicDNS on, split-DNS `ts.net` routes, search domain, 1.1.1.1 global resolvers).
  `dig @100.100.100.100` resolved the name to `100.72.114.74`; `dig @1.1.1.1` returned
  nothing — so any device whose DNS bypasses Tailscale gets NXDOMAIN.
- Conclusion: the phone's DNS queries bypassed Tailscale's resolver despite "Use Tailscale
  DNS" being on — the known iOS regression tailscale#12563.
- **Fix (applied by Zara, verified on the iPhone):** enable "Override DNS servers" in the
  Tailscale admin console DNS settings. `https://zakirs-macbook-air.tailfaeaf.ts.net/`
  now loads in Safari — the 📱 HTTPS secure-context path for future sessions is unblocked.
- `web/vite.config.ts` confirmed already in its committed state (`host: '127.0.0.1'`,
  `allowedHosts: ['.ts.net']`) — the temporary IP workaround was not in place; no revert needed.

## Decisions made

- Tailnet-level "Override DNS servers" stays ON (logged in `docs/DECISIONS.md`) — it is
  admin-console state, invisible in the repo; disabling it re-breaks iOS MagicDNS.
- Did not chase which resolver on the phone was winning (encrypted-DNS profile, Private
  Relay remnant, or the #12563 bug itself) — the override makes it moot.

## Open items

- Mac version skew: `tailscale` CLI/GUI 1.96.4 vs tailscaled 1.98.8 (warning on every CLI
  call). Harmless now; align the installs (likely brew vs app duplication) at some point.
- Override sends all tailnet devices' DNS to 1.1.1.1. If campus/LAN-internal names stop
  resolving while Tailscale is on, add a split-DNS rule in the admin console rather than
  disabling Override.

## Key file paths

- `docs/HANDOFF_tailscale-dns.md` — RESOLVED section added at top (root cause, fix, trade-offs)
- `docs/DECISIONS.md` — one-line entry for the admin-console DNS override
- `web/vite.config.ts` — inspected only, unchanged
