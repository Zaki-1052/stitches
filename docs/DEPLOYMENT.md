# DEPLOYMENT.md — Getting Stitches live on the VPS

*Written 2026-07-21 · Companion to `SPEC.md` §3/§13/§14 (binding) and PLAN Session 5.1.
This walks the whole provisioning from zero to `https://stitches.zalibhai.com`, in order,
with every command literal. VPS: Oracle Cloud Arm64, Ubuntu 22.04, `ubuntu@146.235.203.57`.*

**How to read this doc:** every command is copy-pasteable as written. The only things you
replace are values written in `CAPITALS-LIKE-THIS` (they're always secrets or choices only
you know). Commands in a block labeled **laptop** run in your local terminal at the repo
root; blocks labeled **VPS** run in an SSH session (`ssh ubuntu@146.235.203.57`).

---

## The picture

One thing to get straight first, because you asked: **the repo never goes onto the VPS.**
No `git clone`, no `rsync` of the project folder, no `npm install` on the server. That's
SPEC §14's design and it's worth keeping: the VPS only ever receives three build artifacts,
and it has no build tooling to break.

What actually runs on the VPS:

```
iPhone / desktop browser
   │  HTTPS · stitches.zalibhai.com (grey-cloud DNS record → 146.235.203.57)
   ▼
Nginx (TLS via Let's Encrypt)
   ├── /            → static files at /var/www/stitches/dist   (the web build)
   ├── /api/  /_/   → 127.0.0.1:8090  PocketBase binary        (managed by PM2)
   └── /import/     → 127.0.0.1:8095  importer bundle           (managed by PM2)
```

The three artifacts, and where they come from:

| Artifact | Built by (laptop) | Lands at (VPS) |
|---|---|---|
| Web build (`web/dist/`) | `npm run build --workspace web` | `/var/www/stitches/dist/` |
| Migrations (`pb/pb_migrations/`) | nothing to build — checked-in files | `/home/ubuntu/stitches/pb/pb_migrations/` |
| Importer bundle (`importer/dist/server.mjs`) | `npm run build --workspace importer` | `/home/ubuntu/stitches/importer/server.mjs` |

PocketBase itself is a single static Go binary downloaded once on the VPS (the
`linux_arm64` build of the same pinned v0.39.6 that `scripts/dev.sh` uses locally). The
importer bundle is self-contained (esbuild bundles every dependency into one file), which
is why the VPS needs a Node runtime but never runs `npm install`. Migrations apply
themselves automatically every time PocketBase starts, exactly like `verify:fresh` proves
locally.

What stays on the laptop forever: the repo, `.env`, `node_modules`, the seed script. We
deliberately never run `npm run seed` against prod — it would create the two demo users
*and their starter library*, and the friends-shared starter patterns would show up in
Cece's feed.

One honest note before you commit this file: the repo is public, and this doc contains the
VPS IP and the `ubuntu` username. The IP was going to be public anyway — a grey-cloud DNS
record *is* the IP, published to the world — and `ubuntu` is Oracle's default user, so this
leaks nothing an attacker couldn't get from `dig stitches.zalibhai.com`. Your actual
protection is that OCI instances are key-only SSH (no passwords). If it still bothers you,
strip the IP from this file before committing and keep it in `.env`.

---

## Part 0 — Before you start, check you have these

- SSH to the box works: `ssh ubuntu@146.235.203.57` gets you a prompt.
- Your local `.env` has real values for `RAVELRY_BASIC_USER` and `RAVELRY_BASIC` (the
  importer refuses to boot without them, in prod exactly like in dev).
- The domain `zalibhai.com` is in your Cloudflare account and you can edit its DNS.
- A clean local build: on the **laptop**, from the repo root:

```
npm run build --workspace web
npm run build --workspace importer
```

Both should finish without errors before you touch the server.

---

## Part 1 — DNS: the grey-cloud record

In the Cloudflare dashboard: **zalibhai.com zone → DNS → Records → Add record**.

- Type: `A`
- Name: `stitches`
- IPv4 address: `146.235.203.57`
- Proxy status: **DNS only** (click the orange cloud so it turns grey)
- TTL: Auto

The grey cloud is not optional and it's the one Cloudflare setting that can silently break
the app later: Cloudflare's proxy drops quiet Server-Sent-Events streams after about 100
seconds of idle, which kills PocketBase realtime — the thing that makes counters sync live
between devices. Nothing else on the domain changes; only this one record bypasses the
proxy. If counters ever mysteriously stop syncing across devices months from now, the first
thing to check is whether this record got flipped back to orange.

Verify from the **laptop** (may take a minute to propagate):

```
dig +short stitches.zalibhai.com
```

You want to see `146.235.203.57` and nothing else. If you see Cloudflare IPs
(104.x.x.x etc.), the record is still proxied — go flip the cloud.

---

## Part 2 — Open ports 80 and 443

Oracle Cloud has two firewalls stacked on top of each other, and both have to allow the
traffic. This is the classic OCI trap: people open the cloud firewall and forget the one
inside the instance.

**First, the quick test.** If you already serve a website from this box over plain HTTP or
HTTPS, both layers are already open and you can skip to Part 3. From the **laptop**:

```
curl -sI --connect-timeout 5 http://146.235.203.57 ; echo "exit: $?"
```

Any HTTP response at all (even a 404 or an Nginx default page) means port 80 is open end to
end. `exit: 28` (timeout) means something is blocking — do both steps below.

**Layer 1 — the OCI Security List** (in the cloud console):
Networking → Virtual Cloud Networks → your VCN → the subnet your instance is in →
its Security List → **Add Ingress Rules**. Add two rules, both with source `0.0.0.0/0`,
IP protocol TCP, destination ports `80` and `443` (one rule each).

**Layer 2 — iptables inside the instance.** Oracle's Ubuntu images ship with an iptables
ruleset that rejects everything except SSH, independent of ufw or the cloud console. On the
**VPS**, look for a `REJECT` line:

```
sudo iptables -L INPUT --line-numbers -n
```

If there's a rule like `REJECT all -- 0.0.0.0/0 ... reject-with icmp-host-prohibited`, you
need to insert accepts above it and persist them:

```
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Then re-run the curl test from the laptop. Don't proceed until port 80 answers — certbot
needs it in Part 8.

---

## Part 3 — VPS software baseline

Everything in this part happens on the **VPS**. It's all idempotent: if something is
already installed, the command just confirms it and moves on.

```
sudo apt-get update
sudo apt-get install -y nginx unzip apache2-utils
```

(`unzip` is for the PocketBase download, `apache2-utils` provides `htpasswd` for the
dashboard's basic auth in Part 8.)

**Node 24.** The importer bundle is built with esbuild's `target: node24`, so the runtime
on the box must be Node 24. Ubuntu 22.04's own `nodejs` package is ancient (v12) and
whatever "technically node" is currently installed is probably not 24, so we install from
NodeSource, which puts a system-wide `node` at `/usr/bin/node`:

```
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
/usr/bin/node --version
```

`/usr/bin/node --version` must print `v24.18.0`.

Two box-specific wrinkles hit during the real provisioning (2026-07-21), both handled
here so a future rebuild doesn't trip on them:

- **If the install fails with `trying to overwrite '/usr/include/node/common.gypi',
  which is also in package libnode-dev`**: Ubuntu's old Node 12 packages are installed
  and own files the NodeSource deb needs. Remove them and retry — the remove will also
  take Ubuntu's old `nodejs` 12 with it, which is correct:

  ```
  sudo dpkg --configure -a
  sudo apt-get remove -y libnode-dev libnode72
  sudo apt-get install -y nodejs
  ```

- **Another `node` shadows the system one in interactive shells.** The box has both nvm
  (whose node v22.15.1 wins the PATH — confirmed with `which node` during provisioning)
  and conda. So a plain `node --version` disagrees with `/usr/bin/node --version`, which
  is why every check here uses the absolute path. It also means the PM2 daemon and its
  boot-time systemd unit run under nvm's node 22 — and that's fine: pm2 itself doesn't
  care which modern node it runs on, PocketBase is a Go binary, and the ecosystem file
  pins the importer's interpreter to `/usr/bin/node` outright. The one thing that must
  run on node 24 always does, regardless of which node launched pm2.

I chose the system-wide NodeSource install
over nvm deliberately: PM2's boot-time resurrection runs from systemd, and the
non-interactive SSH command that `deploy.sh` uses later needs `pm2` on the default PATH.
Both are exactly the situations where an nvm-managed node silently isn't there (Ubuntu's
`.bashrc` returns early for non-interactive shells, before nvm loads). System node makes
both problems not exist.

**PM2:**

```
sudo npm install -g pm2
pm2 --version
```

**Last check — make sure our two ports are free** (nothing else on the box should be
squatting on 8090 or 8095):

```
sudo ss -ltnp | grep -E ':(8090|8095)' || echo "both ports free"
```

If something is listening on either port, stop here and pick the conflict apart before
continuing — the ecosystem file, the Nginx config, and the importer's `PB_URL` all assume
these two numbers.

---

## Part 4 — Directories

On the **VPS**. App state lives under your home directory; the static web build lives where
Nginx conventionally serves from, but owned by you so deploys never need sudo:

```
mkdir -p /home/ubuntu/stitches/pb/pb_migrations /home/ubuntu/stitches/importer
sudo mkdir -p /var/www/stitches/dist /var/www/certbot
sudo chown -R ubuntu:ubuntu /var/www/stitches
```

The final layout, for orientation:

```
/home/ubuntu/stitches/
├── ecosystem.config.cjs      PM2 app definitions (Part 6 — holds the Ravelry secret)
├── pb/
│   ├── pocketbase            the v0.39.6 linux_arm64 binary (Part 5)
│   ├── pb_data/              THE database + uploaded files. Created by PocketBase.
│   │                         Never rsynced, never deleted. Backed up to R2 (Part 12).
│   └── pb_migrations/        rsynced from the repo on every deploy
├── importer/
│   └── server.mjs            rsynced from the repo on every deploy
/var/www/stitches/dist/        rsynced web build
/var/www/certbot/              ACME webroot for certbot renewals
```

---

## Part 5 — The PocketBase binary

On the **VPS**. Same version dev.sh pins, Arm64 Linux build:

```
cd /home/ubuntu/stitches/pb
curl -fL -o pocketbase_0.39.6_linux_arm64.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.6/pocketbase_0.39.6_linux_arm64.zip
unzip -o pocketbase_0.39.6_linux_arm64.zip pocketbase
chmod +x pocketbase
rm pocketbase_0.39.6_linux_arm64.zip
./pocketbase --version
```

Should print `pocketbase version 0.39.6`. Updating this binary later is a deliberate act,
never automatic: read the PocketBase changelog first, then `./pocketbase update` (that
becomes a `CARE.md` chore in Session 5.2).

---

## Part 6 — First artifact push, then PM2

**On the laptop**, from the repo root — the first real deploy:

```
rsync -avz --delete web/dist/ ubuntu@146.235.203.57:/var/www/stitches/dist/
rsync -avz --delete pb/pb_migrations/ ubuntu@146.235.203.57:/home/ubuntu/stitches/pb/pb_migrations/
rsync -avz importer/dist/server.mjs ubuntu@146.235.203.57:/home/ubuntu/stitches/importer/server.mjs
```

(The `--delete` on the first two keeps the server exactly mirroring the repo — old hashed
assets and retired migration files get cleaned up. It never touches `pb_data`, which lives
outside both targets.)

**On the VPS**, create the PM2 ecosystem file at
`/home/ubuntu/stitches/ecosystem.config.cjs` (open it in vim and paste). Two values to
fill in: copy `RAVELRY_BASIC_USER` and `RAVELRY_BASIC` from the `.env` on your laptop —
the importer exits immediately at boot if they're missing, by design.

```js
// /home/ubuntu/stitches/ecosystem.config.cjs — PM2 apps for Stitches (SPEC §14).
// Holds the Ravelry basic key: keep this file chmod 600.
module.exports = {
  apps: [
    {
      name: 'stitches-pb',
      script: '/home/ubuntu/stitches/pb/pocketbase',
      args: 'serve --http=127.0.0.1:8090 --dir=/home/ubuntu/stitches/pb/pb_data --migrationsDir=/home/ubuntu/stitches/pb/pb_migrations',
      interpreter: 'none',
    },
    {
      name: 'stitches-importer',
      script: '/home/ubuntu/stitches/importer/server.mjs',
      // Absolute path on purpose: nvm/conda shadow `node` on this box (Part 3). The
      // importer must run on the system node 24, unconditionally.
      interpreter: '/usr/bin/node',
      env: {
        PORT: '8095',
        PB_URL: 'http://127.0.0.1:8090',
        RAVELRY_BASIC_USER: 'PASTE-FROM-LOCAL-ENV',
        RAVELRY_BASIC: 'PASTE-FROM-LOCAL-ENV',
      },
    },
  ],
}
```

(`interpreter: 'none'` tells PM2 that `pocketbase` is a real executable, not a script to
hand to Node.)

Lock it down and start both apps:

```
chmod 600 /home/ubuntu/stitches/ecosystem.config.cjs
cd /home/ubuntu/stitches
pm2 start ecosystem.config.cjs
pm2 status
```

Both apps should show `online`. First boot of `stitches-pb` applies every checked-in
migration to a brand-new `pb_data` — you can watch that happen:

```
pm2 logs stitches-pb --lines 40 --nostream
curl -s http://127.0.0.1:8090/api/health
pm2 logs stitches-importer --lines 20 --nostream
```

The health check should return a small JSON blob. If `stitches-importer` is errored
instead of online, its log will say exactly which env var it's missing.

**Create the dashboard superuser** (safe while PocketBase is running — `verify:fresh` does
it the same way). This is the admin account, separate from the app's users:

```
cd /home/ubuntu/stitches/pb
./pocketbase superuser upsert YOUR-SUPERUSER-EMAIL 'YOUR-SUPERUSER-PASSWORD' --dir /home/ubuntu/stitches/pb/pb_data
```

Use a real password manager entry for this one; it owns everything.

**Make PM2 survive reboots:**

```
pm2 save
pm2 startup
```

`pm2 startup` prints one `sudo env PATH=...` command — copy it, run it, done. From then on
a VPS reboot brings both apps back by itself. The PATH it bakes into the systemd unit
includes the nvm/conda paths from your shell; that's fine per the Part 3 note — the
importer's runtime is pinned no matter what. (If you ever add or rename apps, run
`pm2 save` again to refresh the snapshot.)

---

## Part 7 — A note on Nginx versions before you configure it

One version check decides which config syntax you use in Part 8. On the **VPS**:

```
nginx -v
```

Ubuntu 22.04's apt ships nginx **1.18**, which does not understand the standalone
`http2 on;` directive that SPEC §13's block uses (that directive arrived in 1.25.1). The
config in Part 8 below is written for 1.18: the only difference from SPEC §13 verbatim is
that `http2` rides on the `listen` lines instead. Functionally identical.

If `nginx -v` surprises you with 1.25.1 or newer, use SPEC §13 exactly as written instead
(drop `http2` from the two listen lines and add `http2 on;` as its own line). Either way,
when you're done, append one line to `docs/DECISIONS.md` noting which form prod uses.

---

## Part 8 — Nginx and HTTPS

This goes in two stages because of a chicken-and-egg: the HTTPS server block references
certificate files that don't exist until certbot runs, and certbot needs a working HTTP
server to prove you own the domain. So: HTTP block first, get the cert, then the full
config.

**Stage 1 — HTTP only.** On the **VPS**, create
`/etc/nginx/sites-available/stitches` (via `sudo vim`) with exactly this:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name stitches.zalibhai.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}
```

Enable it and reload:

```
sudo ln -s /etc/nginx/sites-available/stitches /etc/nginx/sites-enabled/stitches
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must say `ok` / `successful` before the reload — if it doesn't, fix the config
first; reloading with a broken config is how every site on the box goes down at once.

**Install certbot** (the snap is the currently supported install path on 22.04; the apt
certbot is outdated):

```
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

**Get the certificate.** Webroot mode, matching the ACME location above. The deploy hook
makes every future auto-renewal reload Nginx so the new cert actually gets served:

```
sudo certbot certonly --webroot -w /var/www/certbot -d stitches.zalibhai.com --deploy-hook "systemctl reload nginx"
```

First run asks for an email (expiry warnings) and terms agreement, then writes the cert to
`/etc/letsencrypt/live/stitches.zalibhai.com/`. The snap installs a systemd timer that
renews automatically about a month before expiry — prove the whole loop works now:

```
sudo certbot renew --dry-run
```

**Basic auth for the dashboard.** One password file, one user (pick any username; this is
the *outer* gate on `/_/` — the PocketBase superuser login is the real lock behind it).
Two rules learned the hard way during the real provisioning (2026-07-21):

- Make the password **letters, digits, and dashes only**, and get the strength from
  length. Browsers disagree about how to encode special characters in Basic auth, and
  the failure looks exactly like typing the right password and being rejected anyway.
- Use the `-b` form so the password is on the command line where you can see it, instead
  of htpasswd's blind double-prompt (`-c` creates the file; drop the `c` on any later
  reset). Save it in the password manager first, then:

```
sudo htpasswd -cb /etc/nginx/.htpasswd-stitches zara 'THE-PASSWORD'
```

Then make the machine confirm the file holds exactly what you think it does:

```
sudo htpasswd -vb /etc/nginx/.htpasswd-stitches zara 'THE-PASSWORD'
```

It must print that the password is correct. Nginx reads this file per-request, so changes
take effect immediately with no reload.

**Stage 2 — the full config.** Replace the entire contents of
`/etc/nginx/sites-available/stitches` with this (SPEC §13, in the nginx-1.18 syntax from
Part 7):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name stitches.zalibhai.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name stitches.zalibhai.com;

    ssl_certificate     /etc/letsencrypt/live/stitches.zalibhai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stitches.zalibhai.com/privkey.pem;

    root /var/www/stitches/dist;
    client_max_body_size 50m;          # vintage scans get chunky

    location /assets/ {                # hashed build assets only
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location / { try_files $uri /index.html; }
    # index.html and sw.js intentionally get no long-lived cache header

    location /api/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;           # realtime (SSE) silently dies without this
        proxy_read_timeout 1h;         # …and without this
    }

    location /_/ {                     # PocketBase dashboard
        auth_basic "stitches admin";
        auth_basic_user_file /etc/nginx/.htpasswd-stitches;
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /import/ {
        proxy_pass http://127.0.0.1:8095;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Test and reload:

```
sudo nginx -t
sudo systemctl reload nginx
```

Quick pulse check from the **laptop** — and it genuinely must be the laptop: an OCI
instance cannot reach its own public IP (Oracle's VCN doesn't hairpin NAT), so these exact
curls run *on the VPS* hang and print nothing, which looks exactly like a broken server
when nothing is wrong.

```
curl -sI https://stitches.zalibhai.com | head -3
curl -s https://stitches.zalibhai.com/api/health
```

The first should show `HTTP/2 200`, the second the same health JSON as before, now through
the whole TLS + proxy chain. If you ever do want to test the HTTPS stack from the VPS
itself, pin the hostname to loopback so the request never leaves the box:

```
curl -sI --resolve stitches.zalibhai.com:443:127.0.0.1 https://stitches.zalibhai.com | head -3
```

---

## Part 9 — First login and sanity checks

Open `https://stitches.zalibhai.com/_/` in a browser. You should be challenged **twice**:
first the browser's basic-auth prompt (username `zara` + the htpasswd password — **type
it by hand**, see the troubleshooting note about pasting), then PocketBase's own superuser
login (Part 6's email + password). Landing in the dashboard means the whole `/_/` chain
works.

Two small things while you're in there:

1. **Settings → Application**: set the Application URL to
   `https://stitches.zalibhai.com`. Nothing critical depends on it today (there's no
   SMTP), but PocketBase uses it wherever it constructs absolute URLs, so it should be
   right.
2. Have a look at **Collections** — you should see all of them (users, patterns,
   pattern_attachments, projects, journal_entries, counters, tags, yarns), created by the
   migrations, all empty. That's the proof the migration chain applied.

The app itself at `https://stitches.zalibhai.com/` should render the login screen, cute
and correct. Nobody can log in yet — there are no users, and there is deliberately no
signup. That's next.

---

## Part 10 — Prove the API rules against prod

Before any real accounts exist is the perfect moment to run the access-matrix regression
test against production, because its fixtures (some of which are briefly friends-visible)
can't flash into anyone's feed.

`rules-check.mjs` needs two user accounts to act as "owner" and "other user". Create two
throwaway ones in the dashboard: **Collections → users → New record**. For each, fill
email, password (and confirmation), and name — for example `check-a@stitches.local` /
`check-b@stitches.local` with names "Check A" / "Check B" and passwords you make up on the
spot (you'll need them for exactly one command).

Then from the **laptop**, repo root — shell-prefixed env vars beat the `.env` file, so
this points the script at prod without touching your local config:

```
PB_URL=https://stitches.zalibhai.com SEED_USER1_EMAIL=check-a@stitches.local SEED_USER1_PASSWORD='CHECK-A-PASSWORD' SEED_USER2_EMAIL=check-b@stitches.local SEED_USER2_PASSWORD='CHECK-B-PASSWORD' npm run verify:rules
```

You want the same ALL-GREEN finish the local runs give (~137 checks). The script creates
its own `[rules-check]`-prefixed fixtures and deletes every one of them on the way out, so
prod ends the run as empty as it started.

When it's green, delete the two check accounts in the dashboard (select each record →
delete). Owner relations cascade, so even if a cleanup had somehow half-failed, deleting
the accounts removes anything they owned.

---

## Part 11 — Real accounts

Same dashboard flow, for keeps this time: **Collections → users → New record**, one for
Cece, one for you, one per friend. Email, password + confirmation, and `name` (the app
greets people by it and labels shared things with it, so make it the name they'd want to
see). Avatars can be set later in the app's own Settings screen.

This dashboard-only creation *is* the invite gate — the `users` create rule is locked, so
these superuser-created records are the only way in. Treat the password you set here as a
**temp password**: each person logs in with it once, then changes it themselves in the
app's Settings (old + new — the Session 2.3 flow that exists precisely because there's no
SMTP). You never learn anyone's real password. The only thing missing without SMTP is the
*forgot my password* email: if someone forgets theirs, you set a fresh temp one in the
dashboard and they change it again in Settings.

Log in to the app as yourself and make sure it feels right. The full device acceptance
walk (Session 5.1's 📱 boxes: two-device realtime counters, a 30 MB PDF into the vault,
PWA install) happens at the phase boundary per usual — this doc just gets you to "live and
provably locked down."

---

## Part 12 — Backups to R2

The goal from SPEC §14: PocketBase makes a daily backup zip (database + uploaded files
together) and pushes it to a Cloudflare R2 bucket, keeping the last 7. Off-VM, automatic,
free tier.

**Create the bucket.** In the Cloudflare dashboard, left sidebar → **R2 Object Storage**.
If you've never used R2, it asks you to activate it first, and it may ask for a payment
method even for the free tier — the free allowance is 10 GB stored, and seven backup zips
of a four-person photo library will live inside that for a long time. Then:
**Create bucket**, name it `stitches-backups`, location Automatic, defaults everywhere
else.

**Create the S3 credentials.** R2 speaks the S3 API, which is what PocketBase's backup
target expects. On the R2 overview page: **Manage R2 API Tokens → Create API Token**.

- Name: `stitches-pb-backups`
- Permissions: **Object Read & Write**
- Specify bucket: only `stitches-backups`
- TTL: forever

Creating it shows you three things exactly once — copy all of them into the password
manager: the **Access Key ID**, the **Secret Access Key**, and the S3 endpoint, which has
the shape `https://ACCOUNT-ID.r2.cloudflarestorage.com` (your account id is also on the R2
overview page).

**Wire it into PocketBase.** Dashboard → **Settings → Backups**:

- Enable auto backups, cron expression `0 11 * * *` (11:00 UTC ≈ 3 am Pacific), max
  backups to keep: `7`.
- Enable the S3 storage option for backups and fill it in: endpoint
  `https://ACCOUNT-ID.r2.cloudflarestorage.com`, bucket `stitches-backups`, region `auto`
  (that's the literal region string R2 expects), the access key and secret from above, and
  turn **force path-style addressing ON** — R2 needs it; without it uploads fail with
  puzzling DNS-ish errors.
- Save, then trigger a **manual backup** from the same panel and watch for it to appear in
  the R2 bucket (Cloudflare dashboard → the bucket → objects). That's your end-to-end
  proof.

**Test a restore once, now,** while there's nothing at stake — a backup you've never
restored is a hope, not a backup. Download the zip from R2 to the laptop, then locally in
the repo (with `npm run dev` stopped):

```
mv pb/pb_data pb/pb_data.bak-restore-test
mkdir pb/pb_data
unzip ~/Downloads/THE-BACKUP-FILENAME.zip -d pb/pb_data
npm run dev
```

After extracting you should see `data.db` directly inside `pb/pb_data` (if the zip nested
a folder, move its contents up one level). Boot it, log in as a prod account, see prod
data locally. Then put your dev world back:

```
mv pb/pb_data pb/pb_data.prod-restore-check
mv pb/pb_data.bak-restore-test pb/pb_data
```

One standing chore, because there's no SMTP to email you about failures: **once a month,
open the Backups panel (or the R2 bucket) and confirm fresh zips are appearing.** Silent
backup death is the failure mode. This lands in `CARE.md` with a reminder in Session 5.2.

---

## Part 13 — Deploying updates from now on

Everything above was one-time. From here on, shipping a change is one command from the
**laptop**:

```
./scripts/deploy.sh
```

The script (checked into the repo beside this doc) does exactly what Part 6 did by hand:
build web + importer, rsync the three artifacts, then `pm2 restart` both services over
SSH. Run it as many times as you like — it's idempotent, and deploying the same build
twice is a no-op that hurts nothing. First time only, make it executable:

```
chmod +x scripts/deploy.sh
```

**Partial deploys, by kind of change.** `deploy.sh` shipping everything is always safe,
but each kind of change really only needs its own artifact. All of these run on the
**laptop** from the repo root:

*Frontend change* (anything under `web/` — the common case). Build, sync, done. No
restarts: Nginx serves the new static files on the very next request.

```
npm run build --workspace web
rsync -avz --delete web/dist/ ubuntu@146.235.203.57:/var/www/stitches/dist/
```

Browsers pick it up on their next visit; installed home-screen PWAs update via the
service worker on their next open (occasionally the one after — the worker downloads the
new build in the background and swaps on the following launch).

*Importer change* (anything under `importer/`):

```
npm run build --workspace importer
rsync -avz importer/dist/server.mjs ubuntu@146.235.203.57:/home/ubuntu/stitches/importer/server.mjs
ssh ubuntu@146.235.203.57 'pm2 restart stitches-importer'
```

*Schema change* (a new file in `pb/pb_migrations/`):

```
rsync -avz --delete pb/pb_migrations/ ubuntu@146.235.203.57:/home/ubuntu/stitches/pb/pb_migrations/
ssh ubuntu@146.235.203.57 'pm2 restart stitches-pb'
```

PocketBase applies the new migrations during that restart. A schema or API-rule change
also means re-running the Part 10 rules-check against prod afterwards — that's the
standing regression gate.

One habit that matters for frontend releases: **bump `version` in `web/package.json`**
(the phase.session numbering the sessions already use). That value becomes
`__APP_VERSION__`, which shows in the Settings footer *and* busts the persisted offline
query cache wholesale — phones carrying an old cached library re-sync cleanly against the
new build because of it.

Details worth knowing:

- **Schema changes ride along automatically.** New checked-in migration files get rsynced
  and PocketBase applies them on the restart. Never click-edit prod schema in the
  dashboard; the checked-in migrations stay the only source of truth, prod included.
- **The restart is a blip, not an outage.** PocketBase is down for well under a second;
  open realtime connections drop and the SDK reconnects on its own; queued counter taps
  flush when it does. Nobody loses anything.
- **The PWA updates itself.** The service worker is `autoUpdate`: installed home-screen
  apps pick up the new build on their next open (occasionally the one after). No manual
  cache-busting.
- After any deploy that touched `pb_migrations` or API rules, re-run the Part 10
  rules-check against prod (two temp accounts, green, delete them) — that's the standing
  regression gate from `CLAUDE.md`, now aimed at the real box.

---

## Part 14 — When something's wrong

**Counters don't sync between two devices.** In order: is the DNS record still grey-cloud
(Part 1)? Does the Nginx `/api/` block still have `proxy_buffering off` and
`proxy_read_timeout 1h` (Part 8)? Realtime is SSE and both are load-bearing; Nginx buffers
SSE to death silently without them.

**A big PDF upload fails instantly (413).** `client_max_body_size 50m` went missing from
the Nginx config, or the file is genuinely over the field's 30 MB cap.

**The site is unreachable.** First: are you testing from the VPS itself? That always
fails — OCI instances can't reach their own public IP (no hairpin NAT); test from the
laptop or use the `--resolve` trick from Part 8. If it's genuinely unreachable from
outside, walk Part 2 again — after OS updates or instance rebuilds, Oracle's iptables
rules have been known to come back — and check both ports separately: 80 and 443 are
independent rules in both the security list and iptables, and certbot working only proves
80.

**Imports/Ravelry search stopped working.** `pm2 logs stitches-importer --lines 50
--nostream` on the VPS. If it's crash-looping with a missing-env-var line, the ecosystem
file lost its Ravelry values. If requests 401, PocketBase might be down (the importer
verifies every token against it).

**Basic auth on `/_/` keeps rejecting you.** This happened during the real provisioning
(2026-07-21), so the diagnosis is field-tested. Nginx's error log names the exact failure:

```
sudo tail -20 /var/log/nginx/error.log
```

`user "..." was not found` means the username at the popup is wrong — it's `zara`, not an
email address. `user "zara": password mismatch` means the password nginx *received* isn't
the one in the file — and the live culprit was **pasting into the browser's popup**: the
paste carried something invisible (trailing whitespace or an encoding difference), so a
password that looked right kept failing until it was typed by hand. If it recurs: type
manually, re-set the password visibly with the `-b`/`-vb` pair from Part 8, and prove the
server side without any browser involved:

```
curl -sI --resolve stitches.zalibhai.com:443:127.0.0.1 -u 'zara:THE-PASSWORD' https://stitches.zalibhai.com/_/ | head -3
```

`HTTP/2 200` there means nginx and the file are right and the browser is the problem
(close *all* private windows — Safari's share auth state — and start a fresh one).

**Service status, generally.** `pm2 status`, `pm2 logs stitches-pb`, `pm2 logs
stitches-importer`. PocketBase's own request log is in the dashboard under Logs.

**Certificate worries.** `sudo certbot renew --dry-run` proves the renewal path;
`sudo certbot certificates` shows expiry dates. Renewal is a systemd timer
(`systemctl list-timers | grep certbot` to see it scheduled).

**The app looks stale after a deploy.** Give the service worker one more visit-and-close
cycle, or on desktop hard-refresh twice. If a device is truly stuck: Settings app →
Safari → website data for the site (installed PWAs keep their own).

**Full restore onto a fresh box.** Parts 2–8 rebuild the machine (nothing on the VPS is
precious except `pb_data`); then instead of letting PocketBase create an empty `pb_data`,
extract the newest R2 backup zip into `/home/ubuntu/stitches/pb/pb_data` before
`pm2 start`. Users, patterns, photos, counters — all of it is in that zip.

---

## Part 15 — Not in this doc, on purpose

- **Session 6.4 (public share links)** will add a `pb_hooks` directory, a `--hooksDir`
  flag on the PocketBase command in the ecosystem file, and a new `/share/` location in
  Nginx. This doc gets updated when that session actually builds.
- **Session 6.5 (desktop clipper)** ships as docs + an unpacked extension; nothing touches
  the VPS.
- **Cece's one-time Ravelry library import** runs from the laptop against prod
  (`docs/ravelry-import-runbook.md`), using `PB_URL=https://stitches.zalibhai.com` the same
  way Part 10 does. Her personal key never goes on the VPS.
- **`CARE.md`** (Session 5.2) will own the ongoing-care list: the monthly backup check,
  deliberate-only PocketBase updates, and where everything lives — most of which this doc
  already establishes.
