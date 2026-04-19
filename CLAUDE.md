# CLAUDE.md — context for Claude Code sessions on this repo

This file is read automatically by Claude Code at the start of every session here. It tells you (the assistant) how this project runs in production, how to deploy changes safely, and the conventions to follow. Read it before making changes.

## What this is

**1DotDev** — a self-hosted, WhatsApp-native AI assistant. A small Node bridge on AWS Lightsail receives WhatsApp webhooks via Meta's Cloud API, routes each message (either a slash-command, a Haiku-detected tool call, or a free chat), responds via Meta's send API, and runs a per-minute cron for scheduled reminders and morning news digests.

- **Owner / primary user**: Sarvesh Karandikar.
- **Users**: 4 allowlisted phone numbers. Admin = Sarvesh's US number only.
- **Repo**: https://github.com/sarvesh1karandikar/1DotDev (public).
- **Live URL**: `https://100-49-94-57.nip.io` (TLS via Let's Encrypt, auto-renews).
- **Live server**: AWS Lightsail `openclaw` instance, static IP `100.49.94.57`, `us-east-1a`.
- **DB**: SQLite (`/home/ubuntu/bridge/data.db`, WAL mode).
- **LLM**: Claude Haiku 4.5 (default, switchable per-user via `/model`).

## Architecture in one picture

```
WhatsApp user
     │
     ▼  (Meta signs webhook with HMAC-SHA256)
Meta Cloud API
     │
     ▼  POST https://100-49-94-57.nip.io/webhook
nginx :443 (TLS)  →  localhost:3000 (Node bridge)
                       │
                       │  at boot: load secrets from AWS SSM Parameter Store
                       │  (/1dotdev/prod/*) into process.env
                       │
                       ├─ verify HMAC signature → 401 if bad
                       ├─ check ALLOWED_WHATSAPP_NUMBERS → silent drop if not
                       ├─ ensure user row in SQLite
                       ├─ first message ever → send welcome, mark greeted, stop
                       ├─ starts with "/" → dispatch to commands/*.js
                       ├─ otherwise  → routeMessage(Haiku w/ tool-use) → pick:
                       │     - a tool (remind, todo_add, digest_add, etc.)
                       │       → run the equivalent command, prefix reply with emoji
                       │     - "chat" → call Claude with facts in system prompt,
                       │                reply free-form, log usage
                       │
                       └─ cron (every minute):
                             - fire due reminders (free-form if <24h since user's
                               last inbound, else reminder_notification template)
                             - fire due morning digests (fetch Google News RSS
                               per topic, summarize via Haiku, send)
```

## Repo layout

```
.
├── README.md
├── ARCHITECTURE.md            deep-dive on request flow + schema
├── INFRASTRUCTURE.md          AWS / nginx / certbot / systemd detail
├── DEPLOY.md                  reproduce from scratch
├── CLAUDE.md                  this file
├── .env.example
├── .gitignore
├── bridge/
│   ├── server.js              webhook handler + command dispatcher + NL routing
│   ├── package.json
│   └── lib/
│   │   ├── secrets.js         SSM loader (runs before anything else on boot)
│   │   ├── db.js              SQLite schema + init
│   │   ├── users.js           ensureUser, setTz, setModel; tz autoguess from phone prefix
│   │   ├── tz.js              localDate, localTime, isValidTz
│   │   ├── anthropic.js       Claude client + token pricing + logUsage
│   │   ├── models.js          haiku/sonnet/opus alias registry
│   │   ├── state.js           all DB reads/writes for messages, facts, entries, reminders, todos
│   │   ├── welcome.js         first-message welcome text + greeted flag
│   │   ├── whatsapp.js        sendText + sendTemplate helpers (used by server + scheduler)
│   │   ├── router.js          NL router — Haiku with tools[], returns "tool" or "chat"
│   │   ├── scheduler.js       node-cron 1-min tick: due reminders + due digests
│   │   ├── rss.js             Google News RSS fetcher for any free-text topic
│   │   └── digest.js          build + send morning digest for a subscription
│   └── commands/
│       ├── index.js           registry: all commands imported + exported by name
│       ├── help.js            /help + /help <command>, groups by category
│       └── (20+ command files, one per slash-command)
└── infra/
    ├── nginx/openclaw-bridge.conf
    ├── systemd/openclaw-bridge.service
    ├── templates/
    │   └── reminder_notification.json     Meta UTILITY template (pending/approved)
    └── scripts/
        ├── _common.sh                      shared cred loader (local .env or SSM)
        ├── list-templates.sh               list all WA templates + status
        ├── push-template.sh <name>         submit infra/templates/<name>.json
        └── poll-template.sh <name>         watch status until approved/rejected
```

## Commands taxonomy

Each command module exports:
```js
{
  name: "remind",
  adminOnly: false,         // if true, only admin numbers can run it
  hidden: true,             // if true, hidden from regular /help (still callable)
  category: "reminders",    // used by /help grouping
  description: "...",
  usage: "...",
  examples: ["..."],
  details: "...",
  async run({ from, user, isAdmin, args, commands }) { return "reply text" }
}
```

Adding a new command = one new file + one line in `commands/index.js`. Done.

### Current command surface (as of last push)

**Regular-user visible** (shown in `/help` for non-admins):
- `/help [command]`
- `/reset`
- `/remind <when> <what>` · `/reminders` · `/todo add|list|done|clear`
- `/time`
- `/digest` + subcommands (on/off/time/add/remove/topics/now/clear)

**Admin-only** or **hidden** (still callable if typed; absent from regular /help):
- `/cost`, `/whoami`, `/debug`, `/tz`, `/model`
- `/remember`, `/facts`, `/forget`
- `/note`, `/notes`, `/journal`, `/entry`, `/on`, `/recall`
- `/admin` + subcommands (users, stats, templates, pending, errors, reminders <num>)

### NL routing (server.js → router.js)

Non-slash messages go through `routeMessage()`. The router is Haiku with a fixed tool list and `tool_choice: "any"` so it always picks exactly one. Tools currently wired:
- `remind`, `todo_add`, `todo_list`, `todo_done`, `reminders_list`, `time`, `reset`
- `digest_add`, `digest_remove`, `digest_now`, `digest_status`
- `chat` — fallback (normal chat path)

`toolToCommand()` in `server.js` translates each tool call to the equivalent slash invocation. When adding a new tool, update BOTH files.

## Infrastructure facts

| Fact | Value |
|---|---|
| SSH to server | `ssh -i /Users/sakarand/openclaw/openclaw.pem ubuntu@100.49.94.57` |
| Bridge dir on server | `/home/ubuntu/bridge/` |
| DB on server | `/home/ubuntu/bridge/data.db` |
| systemd unit | `openclaw-bridge.service` |
| Logs | `sudo journalctl -u openclaw-bridge -f` |
| Node version | 22 |
| nginx config | `/etc/nginx/sites-available/openclaw-bridge` (proxy `:443 → :3000`) |
| TLS cert | Let's Encrypt, auto-renew via systemd timer |
| Firewall (Lightsail) | 22, 80, 443 open |
| Region | us-east-1 (us-east-1a) |

## Secrets — important

All runtime secrets live in **AWS SSM Parameter Store** under `/1dotdev/prod/*`:

```
META_WA_TOKEN                 SecureString (permanent System User token)
META_WA_PHONE_NUMBER_ID       String
META_WA_BUSINESS_ACCOUNT_ID   String
META_WEBHOOK_VERIFY_TOKEN     SecureString
META_APP_SECRET               SecureString
ANTHROPIC_API_KEY             SecureString  ($5/mo hard cap on the key)
ANTHROPIC_MODEL               String (default claude-haiku-4-5)
ALLOWED_WHATSAPP_NUMBERS      String (comma-separated, no + prefix)
ADMIN_WHATSAPP_NUMBERS        String (subset of above)
```

The server's `/home/ubuntu/bridge/.env` contains ONLY these 3 lines:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...   # openclaw-runtime IAM user (ssm:Get only)
AWS_SECRET_ACCESS_KEY=...
```

`bridge/lib/secrets.js` loads all secrets via `GetParameters` at boot and populates `process.env` BEFORE anything else imports. Never change the import order in `server.js` — SSM loader MUST run first.

The local `/Users/sakarand/openclaw/.env` (user's laptop) has the full set of secrets (for running infra scripts, AWS CLI, etc.). It is NOT committed; `.gitignore` excludes `.env`, `*.pem`, `data.db*`.

## Deploy workflow

There is NO auto-deploy from GitHub to the server. Deploys are manual `scp` + `systemctl restart`.

### Edit → deploy loop

1. Edit files in this repo locally.
2. `scp` the changed files to `/home/ubuntu/bridge/` (matching path).
3. Restart the service: `ssh ... 'sudo systemctl restart openclaw-bridge'`.
4. Tail logs: `ssh ... 'sudo journalctl -u openclaw-bridge -f'`.
5. Smoke test: either send a WhatsApp message, or:
   ```
   curl https://100-49-94-57.nip.io/health                 # → 200 {"ok":true}
   curl -X POST https://100-49-94-57.nip.io/webhook -d '{}' # → 401 (signature reject)
   ```
6. If happy, `git add` + `git commit` + `git push`. Repo is source of truth, but not deploy source.

### Example: deploy a single command file

```
scp -i /Users/sakarand/openclaw/openclaw.pem \
  bridge/commands/todo.js \
  ubuntu@100.49.94.57:/home/ubuntu/bridge/commands/todo.js

ssh -i /Users/sakarand/openclaw/openclaw.pem ubuntu@100.49.94.57 \
  'sudo systemctl restart openclaw-bridge && sleep 2 && sudo journalctl -u openclaw-bridge --no-pager -n 10'
```

### Example: deploy a migration

`lib/db.js` defines the target schema for fresh installs. Existing servers need explicit `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` migrations.

Workflow:
1. Update `lib/db.js` for the new schema (so future clones are correct).
2. Write a one-off `migrate-<topic>.cjs` (use `.cjs` because the package is ESM): `const Database = require("better-sqlite3"); const db = new Database("./data.db"); db.exec(\`...\`);`
3. `scp` the migration to `/home/ubuntu/bridge/migrate-*.cjs`, `ssh` and run `node migrate-*.cjs`, then `rm` it.
4. Deploy the new code and restart.

Don't forget: the DB on the server is real user data. Always `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` that tolerate an already-migrated DB.

### Example: install a new npm dependency

```
# On the server:
ssh ... 'cd /home/ubuntu/bridge && npm install <pkg>'

# Then locally, mirror the change in the repo:
# (edit bridge/package.json to add the dep, commit, push)
```

`package-lock.json` is not committed; rerunning `npm install` on the server is how deps are installed.

## Running the bridge locally (dev)

If you want to iterate on code without touching prod:

```bash
cd bridge
# Create a local .env (never commit):
cat > .env <<EOF
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<openclaw-runtime key>
AWS_SECRET_ACCESS_KEY=<openclaw-runtime secret>
EOF
chmod 600 .env

npm install
node server.js
```

Bridge will boot, load secrets from SSM (same as prod), listen on `http://localhost:3000`.

- `GET /health` → `{"ok": true}`
- `POST /webhook` requires a valid Meta HMAC signature, so you can't easily hand-craft inbound requests.
- To get real inbound webhooks locally, register a **separate Meta dev app** against an ngrok tunnel. Do not point prod Meta's webhook at your laptop.

Warning: running locally writes to `./data.db` (fresh file) — NOT the prod DB. Good for dev. Don't confuse the two.

## Checking status without SSH

From WhatsApp (admin only):
- `/admin` — one-screen dashboard (uptime, cost, reminder counts)
- `/admin users` — per-user MTD cost + last-seen
- `/admin stats` — aggregate msg counts over 1d/7d/30d/all-time
- `/admin templates` — WhatsApp template approval statuses
- `/admin pending` — pending + overdue reminders
- `/admin errors` — failed reminders

## Meta WhatsApp templates

Templates are defined as JSON files in `infra/templates/` and submitted via the Graph API (not browser). Three scripts:

```bash
# List all templates + status
LOCAL_ENV_FILE=/Users/sakarand/openclaw/.env ./infra/scripts/list-templates.sh

# Submit (or resubmit) a template from its JSON
LOCAL_ENV_FILE=/Users/sakarand/openclaw/.env ./infra/scripts/push-template.sh <name>

# Poll until APPROVED/REJECTED
LOCAL_ENV_FILE=/Users/sakarand/openclaw/.env ./infra/scripts/poll-template.sh <name>
```

`_common.sh` loads `META_WA_TOKEN` + `META_WA_BUSINESS_ACCOUNT_ID` from the local `.env` (or falls back to SSM).

When a template lands in a `REJECTED` state, the rejection reason shows up in the list output. Common reasons:
- `PARAMS_WORDS_RATIO_EXCEEDED` — too many variables for body length, add static words
- `INVALID_FORMAT` — typically bad `{{n}}` numbering

The scheduler uses `reminder_notification` for free-form-window fallback in both reminders and digests.

## Cost picture

Fixed (~$5/mo):
- Lightsail nano $5 flat
- AWS SSM Standard + KMS aws-managed key: $0
- DNS (nip.io): $0
- TLS (Let's Encrypt): $0
- GitHub public repo: $0

Variable:
- Anthropic Haiku 4.5: ~$0.002 / chat message, ~$0.003 / NL-routed message, ~$0.002 / digest built. Hard-capped at **$5/mo** on the API key.
- Meta WhatsApp: free tier (1000 business-initiated convos/mo). No billing method attached — cannot be charged.

**Realistic total: ~$5.50/mo. Hard ceiling: $10/mo.**

## Conventions / style

- **Node 22, ESM**. `package.json` has `"type": "module"`. Don't mix CJS inside `bridge/` — the only CJS allowed is ad-hoc `migrate-*.cjs` scripts.
- **No frameworks beyond Express** and a few focused libs. Resist bloat.
- **One file per command.** Don't batch unrelated commands into a single file.
- **DB access goes through `lib/state.js`.** Don't scatter `db.prepare(...)` across commands — keep the query surface centralized.
- **User-visible strings**: WhatsApp supports only `*bold*`, `_italic_`, `~strike~`, `` `code` ``. Don't use Markdown syntax that WhatsApp ignores.
- **Logs**: `console.log(...)` is fine — it goes to journald.
- **Test before committing** — scp to server, restart, send a test message from your phone.
- **Commit often, small messages.** The repo history is a useful changelog.
- **Commit messages** follow the pattern in existing history (present tense, one-line summary + bullets).
- **Do not commit** `.env`, `data.db*`, `*.pem`, `node_modules/`.

## Don'ts

- **Don't mock the DB or external APIs in this project.** There are no tests. The "test" is sending yourself a WhatsApp message and tailing logs.
- **Don't `rm` or overwrite `data.db` on the server.** That's live user data.
- **Don't publish secrets**, even accidentally. Scan any commit diff for token-like strings before pushing.
- **Don't** change the SSM load order in `server.js` (`loadSecretsFromSsm()` runs before other imports).
- **Don't** add auto-deploy (CI push → server). The manual gate is intentional.
- **Don't** expose admin-only actions (`/admin`, `/debug`, `/cost` for all users, `/tz`, `/model`) via the NL router. Admin must be a conscious slash command.
- **Don't** send proactive messages outside the 24h window as free-form text — Meta rejects. Always go through the template path (see `scheduler.js::fireReminder` and `digest.js::sendDigestFor` for the pattern).

## How to add a new feature (checklist)

1. Sketch behavior in a short chat with the user before writing code.
2. If DB schema changes: update `lib/db.js` + write `migrate-<topic>.cjs`.
3. Add helper functions in `lib/state.js`. Keep other libs pure.
4. Create `commands/<name>.js` — module-exported object with the command shape.
5. Add `import` + registry entry in `commands/index.js`.
6. If NL-worthy: add a tool in `lib/router.js` + a `toolToCommand()` case in `server.js`.
7. Run migration on server (if any), scp new files, restart service, tail logs.
8. Send yourself a WhatsApp test, confirm.
9. Commit + push.
10. Update this CLAUDE.md if behavior changed significantly.

## Current known TODOs

- **Template `reminder_notification`** may still be `PENDING`. Check with `/admin templates`. Once approved, long-dated reminders outside the 24h window will deliver; until then they fail silently in the logs (marked `failed` in DB).
- **Tighten `openclaw-ssm-read` IAM policy** back to read-only. During migration we granted `ssm:PutParameter` + `ssm:DeleteParameter`; those should be removed.
- **NL router doesn't expose admin commands** (intentional).
- **No rate limiting per user yet.** Anthropic $5 cap is the ultimate brake.
