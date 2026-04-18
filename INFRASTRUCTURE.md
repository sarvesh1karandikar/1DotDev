# Infrastructure

## AWS Lightsail instance

| | |
|---|---|
| Name | `openclaw` |
| Region / AZ | `us-east-1` / `us-east-1a` |
| Plan | Nano, $5/mo (1 vCPU, 1 GB RAM, 40 GB SSD, 2 TB transfer) |
| OS | Ubuntu 24.04 LTS |
| Static IP | `100.49.94.57` (free while attached) |
| Ports open | 22 (SSH), 80 (HTTP, for Let's Encrypt HTTP-01), 443 (HTTPS) |

Shell access:
```bash
ssh -i /path/to/openclaw.pem ubuntu@100.49.94.57
```

A 2 GB swap file is on the instance — Node 22 plus `npm install` on 1 GB RAM is tight without swap.

## DNS / TLS

- **Hostname:** `100-49-94-57.nip.io` — free, no-signup wildcard DNS service. Resolves the encoded IP directly, so nothing to maintain.
- **TLS:** Let's Encrypt cert via `certbot` + nginx plugin. Auto-renews via systemd timer installed by the cert bot package. Expires every ~90 days; renewal is unattended.
- **Why not a custom domain?** None needed for a personal bot. If you want one later, swap the `server_name` in the nginx config and rerun certbot.

## Reverse proxy (nginx)

`/etc/nginx/sites-available/openclaw-bridge` — see [`infra/nginx/openclaw-bridge.conf`](./infra/nginx/openclaw-bridge.conf).

- Listens on 443 (TLS) and 80 (redirects to 443 via certbot).
- `server_name 100-49-94-57.nip.io`.
- `proxy_pass` → `http://127.0.0.1:3000`.
- Forwards `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`.

## Bridge service (systemd)

`/etc/systemd/system/openclaw-bridge.service` — see [`infra/systemd/openclaw-bridge.service`](./infra/systemd/openclaw-bridge.service).

- `Type=simple`, runs `node /home/ubuntu/bridge/server.js` as user `ubuntu`.
- `EnvironmentFile=/home/ubuntu/bridge/.env` (secrets loaded on start).
- `Restart=always`, 5s backoff — service survives crashes and reboots.
- Logs: `sudo journalctl -u openclaw-bridge -f`

## Meta WhatsApp setup

- Developer app: **1DotDev** on `developers.facebook.com/apps`.
- Webhook URL: `https://100-49-94-57.nip.io/webhook`, subscribed to `messages` field.
- Verify token: `META_WEBHOOK_VERIFY_TOKEN` (must match server `.env`).
- App secret: `META_APP_SECRET` used to verify inbound webhook HMAC.
- Permanent access token: generated via **Meta Business Suite → Users → System Users → Generate token** with `whatsapp_business_messaging` + `whatsapp_business_management` scopes, expiry set to "Never". Stored as `META_WA_TOKEN`.
- Phone number: Meta's free test number (shown in **WhatsApp → API Setup**). Test numbers can only message verified "To" recipients.

## Anthropic

- Model: `claude-haiku-4-5` (switchable per-user to Sonnet 4.6 / Opus 4.7 via `/model`).
- Spend cap: **$5/mo** hard cap on the API key (set in Anthropic console → Limits). API refuses calls past this — prevents runaway cost under all circumstances.

## Budget guardrails

| Control | Location | Effect |
|---|---|---|
| AWS Budget | `$10/mo alert` | Email alert; not enforcement. |
| Anthropic spend cap | `$5/mo hard` | API refuses calls past this. |
| Meta Cloud API | No billing method attached | Can never be charged. Free tier caps at 1,000 business-initiated convos/mo — since we never initiate, we never hit it. |
| Lightsail | $5/mo flat, bandwidth free up to 2 TB | Fixed-price. |

Combined worst case: **$10/mo**, even under abuse.

## Common operations

Restart the bridge (new `.env`, new code, etc.):
```bash
sudo systemctl restart openclaw-bridge
```

Tail logs:
```bash
sudo journalctl -u openclaw-bridge -f
```

Open an additional port on the firewall:
```bash
aws lightsail open-instance-public-ports \
  --port-info fromPort=8080,toPort=8080,protocol=TCP \
  --instance-name openclaw \
  --region us-east-1
```

Renew TLS cert (should be automatic — verify):
```bash
sudo certbot renew --dry-run
```

Back up the database:
```bash
sqlite3 /home/ubuntu/bridge/data.db ".backup /tmp/data-backup.db"
scp ubuntu@100.49.94.57:/tmp/data-backup.db ./backups/
```
