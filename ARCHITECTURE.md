# Architecture

## Request flow

```
  ┌─────────────────┐
  │ WhatsApp user   │
  └────────┬────────┘
           │ 1. sends a WhatsApp message
           ▼
  ┌─────────────────────────────────────┐
  │  Meta Cloud API (WhatsApp)          │
  │  - Signs webhook w/ HMAC-SHA256     │
  └────────┬────────────────────────────┘
           │ 2. POST /webhook  (signed)
           ▼
  ┌─────────────────────────────────────┐
  │  nginx on Lightsail (443/TLS)       │
  │  - LetsEncrypt cert, auto-renewed   │
  │  - Reverse proxy → localhost:3000   │
  └────────┬────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────────────┐
  │  Node bridge (server.js, :3000)     │
  │                                     │
  │  a. Validate X-Hub-Signature-256    │
  │     └─ fail: 401 early return       │
  │  b. Allowlist check on `from`       │
  │     └─ fail: log + return (no $)    │
  │  c. ensureUser() in SQLite          │
  │  d. First message? → welcome only   │
  │  e. Slash-command? → dispatcher     │
  │     → commands/*.js registry        │
  │  f. Else: build system prompt with  │
  │     user's facts, append message,   │
  │     call Claude w/ per-user model,  │
  │     log token usage, reply          │
  └────────┬────────────────────────────┘
           │ 3. anthropic.messages.create
           ▼
  ┌─────────────────────────────────────┐
  │  Anthropic API (Claude Haiku 4.5)   │
  └────────┬────────────────────────────┘
           │ 4. reply content + usage
           ▼
  ┌─────────────────────────────────────┐
  │  Bridge sends outbound WhatsApp     │
  │  POST graph.facebook.com/messages   │
  └────────┬────────────────────────────┘
           │
           ▼
  ┌─────────────────┐
  │ WhatsApp user   │  ← reply appears in chat
  └─────────────────┘
```

Round-trip: ~1 second end-to-end for a typical short reply.

## Code layout

```
bridge/
├── server.js              Webhook endpoint, signature check, allowlist,
│                          command dispatch, Claude call, outbound send.
├── lib/
│   ├── db.js              SQLite init + schema (`better-sqlite3`, WAL).
│   ├── users.js           ensureUser / setTz / setModel. Auto-guess tz
│   │                      from phone prefix (1 → LA, 91 → IST).
│   ├── tz.js              localDate / localTime / isValidTz helpers.
│   ├── anthropic.js       createClient, logUsage, pricing table.
│   ├── models.js          Model alias registry (haiku/sonnet/opus) +
│   │                      cost-tier warnings.
│   ├── state.js           Messages, facts, entries, usage queries.
│   └── welcome.js         First-message welcome template + greet tracking.
└── commands/
    ├── index.js           Exports { commands, byName } registry.
    ├── help.js  reset.js  cost.js  whoami.js  debug.js
    ├── time.js  tz.js  model.js
    ├── remember.js  facts.js  forget.js
    ├── note.js  notes.js
    └── journal.js  entry.js  on.js  recall.js
```

Command modules are uniform shape:

```js
export default {
  name: "journal",
  adminOnly: false,
  description: "Log a reflection",
  async run({ from, user, args, isAdmin, commands }) {
    // returns string to send back, or falsy to send nothing
  },
};
```

Adding a command = one new file + one entry in `commands/index.js`.

## SQLite schema

Single file at `/home/ubuntu/bridge/data.db`, WAL mode:

| Table | Purpose | Key columns |
|---|---|---|
| `users` | One row per allowlisted user | `number` (PK), `tz`, `model`, `greeted_at`, `created_at` |
| `messages` | Chat history for Claude context | `number`, `role` ('user'/'assistant'), `content`, `created_at` |
| `usage` | One row per Claude API call | `number`, `model`, `input_tokens`, `output_tokens`, `cost_usd` |
| `facts` | `/remember` entries | `number`, `fact`, `created_at` |
| `entries` | Unified table for notes, journal, backdated entries | `number`, `kind`, `content`, `local_date`, `created_at` |

Conversation history = last 20 messages (per user) read from `messages` table on every turn.

## System prompt composition

```js
base = "You are a helpful personal assistant replying over WhatsApp. Keep replies concise."

if (user has facts) {
  systemPrompt = base + "\n\nFacts the user has told you to remember:\n" +
                 facts.map(f => "- " + f.fact).join("\n")
} else {
  systemPrompt = base
}
```

Facts are injected transparently — Claude sees them without the user having to repeat them.

## Timezone handling

- On first message, `ensureUser` assigns default tz from phone prefix (`1` → `America/Los_Angeles`, `91` → `Asia/Kolkata`, else `UTC`).
- User can override with `/tz <IANA-zone>` (validated via `Intl.DateTimeFormat`).
- `/time` always prints LA + IST side-by-side, plus user's tz if different.
- `/cost` uses the user's tz to compute "today" (local midnight → now).

## Security boundaries

| Layer | Control |
|---|---|
| Transport | TLS via Let's Encrypt; nginx terminates SSL, proxies to :3000. |
| Webhook integrity | `X-Hub-Signature-256` HMAC-SHA256 verified with `META_APP_SECRET`; mismatches → 401. |
| Who can talk | `ALLOWED_WHATSAPP_NUMBERS` allowlist. Senders not on it → silent drop, no outbound, no Claude call. |
| Who can admin | `ADMIN_WHATSAPP_NUMBERS` is a strict subset. Admin-only commands (`/debug`) error for non-admins. |
| Cost ceiling | Anthropic API key has a $5/mo hard cap (set in Anthropic console). |
| Data privacy | Each user's `messages`, `facts`, `entries` are queried only for `WHERE number = caller_number`. Admin views (`/cost` admin mode) show aggregates only, not content. |

## What's *not* in the architecture

- No queuing/retries — outbound to WhatsApp is best-effort; Meta will redeliver webhooks on 5xx anyway (we return `200` early).
- No per-user rate limit (yet). Global protection = Anthropic $5/mo cap.
- No proactive outbound messages. Per-user reactive only; outbound is always a reply within Meta's 24h window.
- No vision / audio / media handling (yet). Non-text messages are ignored.
