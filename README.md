# 1DotDev

A personal WhatsApp-native AI assistant. Messages from an allowlisted set of WhatsApp users route through the Meta Cloud API into a small Node bridge hosted on AWS Lightsail, which forwards them to Claude (Anthropic API) and replies back on WhatsApp.

Built by [Sarvesh Karandikar](https://github.com/sarvesh1karandikar).

## What it does

- **Chat** — normal messages get a Claude reply, with per-user history (last 20 turns) and per-user "remembered facts" auto-injected into the system prompt.
- **Commands** — 17 slash-commands for journaling, notes, timezone-awareness, cost tracking, model switching, and more.
- **Private, allowlisted** — only pre-approved phone numbers can interact; all others are dropped silently.
- **Per-user state** — each user has their own timezone, model preference, facts, notes, journal, and chat history. No cross-user bleed.
- **Multi-tier admin view** — admins see aggregate usage/cost across all users; regular users only see their own.

## Architecture (one-liner)

```
WhatsApp user → Meta Cloud API (webhook) → nginx/TLS → Node bridge → Claude Haiku 4.5 → Meta Cloud API → WhatsApp user
```

Detailed: [ARCHITECTURE.md](./ARCHITECTURE.md)
Deployment: [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) · [DEPLOY.md](./DEPLOY.md)

## Live infrastructure

| | |
|---|---|
| Host | AWS Lightsail `openclaw` instance (us-east-1a, $5/mo nano, 1 GB RAM, 2 GB swap, Ubuntu 24.04) |
| Public IP | `100.49.94.57` (static, free while attached) |
| Hostname | `100-49-94-57.nip.io` (free IP-based DNS, Let's Encrypt TLS auto-renew) |
| Webhook URL | `https://100-49-94-57.nip.io/webhook` |
| Bridge | `systemd` unit `openclaw-bridge.service`, Node 22 |
| DB | SQLite (`/home/ubuntu/bridge/data.db`, WAL) |
| Model | Claude Haiku 4.5 (switchable per-user via `/model`) |

## Commands

| Category | Commands |
|---|---|
| Meta | `/help`, `/reset`, `/cost`, `/whoami`, `/debug` (admin) |
| Time & settings | `/time`, `/tz <zone>`, `/model [haiku\|sonnet\|opus]` |
| Memory | `/remember <fact>`, `/facts`, `/forget <n>` |
| Notes & journal | `/note`, `/notes`, `/journal`, `/entry YYYY-MM-DD <text>`, `/on YYYY-MM-DD`, `/recall <query>` |

## Cost

| | |
|---|---|
| Lightsail | $5/mo flat |
| Anthropic (Haiku) | ~$0.0035/turn; hard-capped at $5/mo on the API key |
| Meta WhatsApp | Free tier: 1,000 business-initiated convos/mo. No billing method attached. |
| TLS, DNS (nip.io) | $0 |
| **Worst case** | **$10/mo** (caps make overshooting impossible) |

## Security posture

- HMAC-SHA256 signature validation on every Meta webhook POST (`X-Hub-Signature-256`); unsigned/forged requests get `401`.
- Sender allowlist; non-allowlisted numbers dropped silently (no Claude call, no reply, $0).
- Secrets only in `.env` on the server (`chmod 600`, never committed).
- Permanent Meta System User token (no 24h expiry); Anthropic key scoped with $5/mo hard cap.

## Repo layout

```
.
├── README.md                      this file
├── ARCHITECTURE.md                request flow, DB schema, code structure
├── INFRASTRUCTURE.md              AWS/nginx/certbot/systemd setup details
├── DEPLOY.md                      step-by-step to reproduce from scratch
├── .env.example                   env var template
├── .gitignore
├── bridge/
│   ├── package.json
│   ├── server.js                  webhook handler + command dispatcher
│   ├── lib/                       shared modules (db, users, tz, anthropic, state, welcome)
│   └── commands/                  one file per slash-command
└── infra/
    ├── nginx/openclaw-bridge.conf
    └── systemd/openclaw-bridge.service
```
