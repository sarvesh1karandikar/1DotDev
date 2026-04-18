# Deploying from scratch

High-level: provision Lightsail → Node + deps → bridge code + .env → nginx + TLS → systemd → register Meta webhook.

All dollar amounts reflect the *caps* in place; actual idle cost is ~$5/mo Lightsail only.

## Prereqs

- AWS account with Lightsail access. A least-privilege IAM user (`AmazonLightsailFullAccess`) is enough.
- A Meta developer account with a WhatsApp-enabled app and a test phone number verified.
- An Anthropic API key with a $5/mo hard cap configured.

## 1. Lightsail instance

```bash
aws lightsail create-instances \
  --instance-names openclaw \
  --availability-zone us-east-1a \
  --blueprint-id ubuntu_24_04 \
  --bundle-id nano_3_0 \
  --region us-east-1

aws lightsail attach-static-ip --static-ip-name openclaw-ip --instance-name openclaw --region us-east-1

aws lightsail open-instance-public-ports \
  --port-info fromPort=443,toPort=443,protocol=TCP \
  --instance-name openclaw --region us-east-1

aws lightsail open-instance-public-ports \
  --port-info fromPort=80,toPort=80,protocol=TCP \
  --instance-name openclaw --region us-east-1
```

Download the instance SSH key (`.pem`) from the Lightsail console; `chmod 600`.

## 2. System setup on the box

```bash
ssh -i /path/to/openclaw.pem ubuntu@<IP>

# 2 GB swap (Node + npm install on 1 GB RAM is tight)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 22 (NodeSource repo)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# nginx + certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

## 3. Clone & configure bridge

```bash
# On the server:
mkdir -p /home/ubuntu/bridge
cd /home/ubuntu/bridge

# Copy bridge/ from this repo to the server (scp, rsync, or git clone).
# Example with rsync from your laptop:
rsync -az bridge/ ubuntu@<IP>:/home/ubuntu/bridge/

# Then on the server:
cd /home/ubuntu/bridge
npm install

# Create /home/ubuntu/bridge/.env from .env.example, fill in real values
cp .env.example .env
chmod 600 .env
# Edit .env with your Meta/Anthropic creds
```

## 4. nginx reverse proxy + TLS

Pick a hostname. Easiest: use [nip.io](https://nip.io) — `<ip-with-dashes>.nip.io` resolves automatically to your static IP. No registration needed.

```bash
sudo cp infra/nginx/openclaw-bridge.conf /etc/nginx/sites-available/openclaw-bridge

# Update the server_name line to your hostname
sudo sed -i "s/100-49-94-57.nip.io/<your-hostname>/" /etc/nginx/sites-available/openclaw-bridge

sudo ln -sf /etc/nginx/sites-available/openclaw-bridge /etc/nginx/sites-enabled/openclaw-bridge
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx

# Get Let's Encrypt cert (auto-configures the same nginx file)
sudo certbot --nginx -d <your-hostname> \
  --non-interactive --agree-tos --register-unsafely-without-email --redirect
```

## 5. systemd service

```bash
sudo cp infra/systemd/openclaw-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-bridge

# Verify
sudo systemctl status openclaw-bridge
sudo journalctl -u openclaw-bridge -f
```

## 6. Smoke test

```bash
curl https://<your-hostname>/health
# → {"ok":true}

curl -X POST https://<your-hostname>/webhook -H "Content-Type: application/json" -d '{}'
# → 401 Unauthorized   (signature check working)

VERIFY=<value of META_WEBHOOK_VERIFY_TOKEN>
curl -sG "https://<your-hostname>/webhook" \
  --data-urlencode "hub.mode=subscribe" \
  --data-urlencode "hub.verify_token=$VERIFY" \
  --data-urlencode "hub.challenge=ping"
# → ping
```

## 7. Register webhook with Meta

1. Meta developer portal → your app → **WhatsApp → Configuration**.
2. **Webhook → Edit**.
3. Callback URL: `https://<your-hostname>/webhook`
4. Verify token: value of `META_WEBHOOK_VERIFY_TOKEN` (no quotes).
5. **Verify and save**.
6. Subscribe to the `messages` field.

## 8. Test end-to-end

Send a WhatsApp message from a verified test recipient number to your Meta test phone number.

```bash
sudo journalctl -u openclaw-bridge -f
# watch for:   in: <number> hi
#              out: <number> Hello! ...
```

Reply arrives on WhatsApp within ~1 second.

## 9. Add users

Edit `/home/ubuntu/bridge/.env`:
```
ALLOWED_WHATSAPP_NUMBERS='15551234567,919987654321,...'
ADMIN_WHATSAPP_NUMBERS='15551234567'
```
Numbers are comma-separated, no `+`, no spaces. Restart: `sudo systemctl restart openclaw-bridge`.
