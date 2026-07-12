# Handoff: tailscale serve HTTPS not reachable from iPhone

## RESOLVED 2026-07-11

**Fix:** enable **"Override DNS servers"** in the Tailscale admin console
(`https://login.tailscale.com/admin/dns`, Nameservers section — the 1.1.1.1 global
nameserver added earlier stays). After toggling Tailscale off/on on the iPhone,
`https://zakirs-macbook-air.tailfaeaf.ts.net/` loads in Safari. Verified on the phone.

**Mechanism (confirmed by evidence):** `.ts.net` device names exist only in Tailscale's
resolver path — `dig @1.1.1.1` returns nothing for the name, while the local MagicDNS
resolver (`dig @100.100.100.100`) returns `100.72.114.74`. The phone's tunnel and netmap
were healthy (IP workaround worked), so the failure was Safari's DNS queries bypassing
Tailscale's resolver entirely and getting NXDOMAIN from a public resolver. With "Override
DNS servers" off, iOS lets another resolver win despite the "Use Tailscale DNS" toggle —
the known regression in [tailscale#12563](https://github.com/tailscale/tailscale/issues/12563),
whose confirmed workaround is exactly this override.

**Not pinpointed:** which resolver on the phone was winning (encrypted-DNS profile,
Private Relay remnant, or the #12563 bug itself). The override makes Tailscale DNS
authoritative regardless, so this was not chased further.

**Trade-off to know about:** Override applies tailnet-wide — every connected device now
sends *all* DNS to 1.1.1.1, not the local network's resolvers. If campus/LAN-internal
hostnames (e.g. UCSD's `132.239.0.25x` resolvers) stop resolving while Tailscale is on,
add a split-DNS rule for that domain in the admin console instead of disabling Override.

**Error-message decoder for future tests:** Safari's "server with the specified hostname
could not be found" = DNS failure; "couldn't connect to the server" = DNS succeeded,
nothing listening (e.g. browsing to the phone's own name) — the latter is the healthy
result for a name with no server behind it.

---

## The problem

`tailscale serve --bg 5173` creates an HTTPS reverse proxy at
`https://zakirs-macbook-air.tailfaeaf.ts.net/` → `http://127.0.0.1:5173` (Vite). **It works
perfectly from the Mac** (HTTP 200 via curl and browser). **The iPhone cannot reach it** — Safari
shows "A server with the specified hostname could not be found" (DNS resolution failure).

This blocks the 📱 acceptance tests that need a secure context (Wake Lock, service worker,
clipboard — SPEC §4). Session 0.2's visual checks (fonts, safe-area, tap targets, back
affordance) were verified using the temporary IP workaround below, but future sessions need HTTPS.

## Environment

- Mac: `zakirs-macbook-air`, Tailscale IP `100.72.114.74`, client v1.96.4, tailscaled v1.98.8
- iPhone: `iphone171`, Tailscale IP `100.99.13.120`, iOS, connected (green)
- Tailnet: `tailfaeaf.ts.net` (account `zaki-1052.github`)
- MagicDNS: **enabled** (confirmed — iPhone shows `iphone171.tailfaeaf.ts.net` in the app)
- HTTPS Certificates / Serve: **enabled** (visited the enable link, confirmed "ready to use")
- Cloudflare `1.1.1.1` added as global nameserver in Tailscale admin DNS settings
- iCloud Private Relay: was **on** (could intercept `.ts.net` DNS), now **off**

## What was tried (all failed to fix the phone)

1. Confirmed both devices online and green in the Tailscale app
2. Confirmed MagicDNS enabled at the tailnet level
3. Confirmed "Use Tailscale DNS" on in the iPhone Tailscale app
4. Enabled HTTPS / Serve for the tailnet via the admin link
5. Turned off iCloud Private Relay (Settings → Apple ID → iCloud → Private Relay)
6. Added Cloudflare `1.1.1.1` as a global nameserver in Tailscale admin DNS
7. Toggled Tailscale off/on on the iPhone after each change
8. Toggled Airplane Mode on/off on the iPhone to flush DNS cache
9. Sent the link via shared clipboard (not a typo)

None resolved the phone's DNS failure. The Mac resolves the same hostname fine.

## What was NOT tried

- Restarting the iPhone entirely
- Removing and reinstalling the Tailscale iOS app
- Checking if the iPhone resolves OTHER `.ts.net` names (e.g., `iphone171.tailfaeaf.ts.net`
  from Safari — would isolate "all MagicDNS broken on phone" vs "just this one name")
- `dig` / `nslookup` from the phone (no terminal access on iOS)
- Checking whether a different browser (Chrome iOS) resolves it (Private Relay only affects Safari)
- Checking Tailscale iOS app logs (Settings → Tailscale → scroll to "Log" or diagnostics)
- Testing from a second device on the tailnet

## Temporary workaround (verified working)

The iPhone CAN reach the Mac via its raw Tailscale IP (`100.72.114.74`) over the tunnel — no DNS
needed. To use this:

1. In `web/vite.config.ts`: change `host` to `'0.0.0.0'` and add `'100.72.114.74'` to
   `allowedHosts`
2. Restart `npm run dev`
3. On the iPhone: `http://100.72.114.74:5173/`

This is **plain HTTP** (not a secure context), so features requiring HTTPS (Wake Lock, service
worker, clipboard) won't work. Adequate for Session 0.2's visual acceptance checks only.

**Revert `vite.config.ts` when done** — the committed config should stay as `host: '127.0.0.1'`,
`allowedHosts: ['.ts.net']` (the proper tailscale serve setup).

## Relevant files

- `web/vite.config.ts` — server host, proxy, and allowedHosts config
- `scripts/dev.sh` — launches PB + Vite; Vite picks its port dynamically if 5173 is busy
- `docs/SPEC.md` §4 — the tailscale serve requirement and why HTTPS matters

## Key observation

The Tailscale tunnel itself works (the IP workaround proves it). The failure is specifically
**MagicDNS name resolution on iOS Safari**. The Mac resolves the same name via the same tailnet.
This is likely an iOS-specific MagicDNS issue — the Reddit thread from `u/scooooooooooooooooty`
describes the same symptoms, and adding Cloudflare DNS was their fix (but didn't work here).
