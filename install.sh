#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# Sanaei VPN Bot - Installation Script
# Ubuntu 22.04 / 24.04
# ===========================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

PROJECT_DIR="/opt/sanaei-vpn-bot"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Pre-flight checks ---
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root (sudo ./install.sh)"
fi

# --- Update mode: if .env already exists, skip prompts ---
if [[ -f "$PROJECT_DIR/.env" && "${1:-}" == "--update" ]]; then
  info "Update mode detected — re-deploying with existing configuration..."
  
  # Backup .env
  cp "$PROJECT_DIR/.env" /tmp/.env.backup
  
  # Copy fresh source (including dotfiles)
  info "Copying updated source files..."
  if [[ "$(realpath "$SCRIPT_DIR")" != "$(realpath "$PROJECT_DIR")" ]]; then
    cp -r "$SCRIPT_DIR"/. "$PROJECT_DIR/"
  else
    log "Already running from project directory — skipping copy"
  fi
  
  # Restore .env
  cp /tmp/.env.backup "$PROJECT_DIR/.env"
  rm -f /tmp/.env.backup
  
  # Rebuild
  cd "$PROJECT_DIR"
  info "Rebuilding containers (no cache)..."
  docker compose build --no-cache
  docker compose up -d
  
  log "Update complete!"
  docker compose logs --tail=10
  exit 0
fi

info "Sanaei VPN Bot Installer"
echo "─────────────────────────────────────────"

# --- Prompt for configuration ---
read -rp "Bot Token (from @BotFather): " BOT_TOKEN
[[ -z "$BOT_TOKEN" ]] && error "Bot token is required"

read -rp "Bot Username (without @): " BOT_USERNAME
read -rp "Admin Telegram ID(s) (comma-separated): " ADMIN_IDS
read -rp "Domain (e.g. bot.example.com): " DOMAIN
[[ -z "$DOMAIN" ]] && error "Domain is required"

echo ""
info "Database Configuration (press Enter for defaults)"
read -rp "  DB Name [sanaei_bot]: " DB_NAME
DB_NAME=${DB_NAME:-sanaei_bot}
read -rp "  DB User [sanaei]: " DB_USER
DB_USER=${DB_USER:-sanaei}
read -rp "  DB Password [auto-generated]: " DB_PASS
DB_PASS=${DB_PASS:-$(openssl rand -hex 16)}

echo ""
info "Sanaei Panel Configuration"
read -rp "  Panel URL (e.g. https://1.2.3.4:2053/basePath): " PANEL_URL
[[ -z "$PANEL_URL" ]] && error "Panel URL is required"
# Strip trailing slash
PANEL_URL="${PANEL_URL%/}"
read -rp "  Panel API Key (Settings → Security → API Token): " PANEL_API_KEY
if [[ -z "$PANEL_API_KEY" ]]; then
  warn "No API Key provided. Falling back to username/password login."
  read -rp "  Panel Username: " PANEL_USERNAME
  read -rp "  Panel Password: " PANEL_PASSWORD
else
  PANEL_USERNAME="admin"
  PANEL_PASSWORD="admin"
  log "Using API Key authentication (recommended)"
fi
read -rp "  Subscription Path [/sub]: " PANEL_SUB_PATH
PANEL_SUB_PATH=${PANEL_SUB_PATH:-/sub}

echo ""
info "Payment Gateways (optional, press Enter to skip)"
read -rp "  Zarinpal Merchant ID: " ZARINPAL_MERCHANT_ID
read -rp "  Aqayepardakht PIN: " AQAYEPARDAKHT_PIN
read -rp "  Card Number: " CARD_NUMBER
read -rp "  Card Holder Name: " CARD_HOLDER

echo ""
info "Mini App URL"
MINIAPP_URL="https://${DOMAIN}/app"
read -rp "  Mini App URL [${MINIAPP_URL}]: " CUSTOM_MINIAPP_URL
MINIAPP_URL=${CUSTOM_MINIAPP_URL:-$MINIAPP_URL}

JWT_SECRET=$(openssl rand -hex 32)

echo ""
echo "─────────────────────────────────────────"
info "Installing Docker..."

# --- Install Docker ---
if command -v docker &>/dev/null; then
  log "Docker already installed: $(docker --version)"
else
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release >/dev/null 2>&1

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null 2>&1
  systemctl enable docker
  systemctl start docker
  log "Docker installed successfully"
fi

# Verify docker compose
if docker compose version &>/dev/null; then
  log "Docker Compose available"
else
  error "Docker Compose plugin not found. Install docker-compose-plugin."
fi

# --- Create project directory ---
mkdir -p "$PROJECT_DIR"
log "Project directory: $PROJECT_DIR"

# --- Copy project files (including dotfiles) ---
if [[ "$(realpath "$SCRIPT_DIR")" != "$(realpath "$PROJECT_DIR")" ]]; then
  info "Copying project files..."
  cp -r "$SCRIPT_DIR"/. "$PROJECT_DIR/"
else
  log "Already running from project directory — skipping copy"
fi

# --- Initialize git repo for future updates ---
if ! git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree &>/dev/null; then
  git -C "$PROJECT_DIR" init -q
  git -C "$PROJECT_DIR" add -A
  git -C "$PROJECT_DIR" -c user.name="installer" -c user.email="installer@local" commit -qm "Initial deploy $(date +%F)"
  git -C "$PROJECT_DIR" remote add origin https://github.com/ReZeRoP/ReZeroBot.git 2>/dev/null || true
  log "Git repository initialized (git pull available for future updates)"
fi

# --- Generate .env ---
info "Generating .env configuration..."
cat > "$PROJECT_DIR/.env" <<EOF
# Auto-generated by install.sh on $(date)
BOT_TOKEN=${BOT_TOKEN}
BOT_USERNAME=${BOT_USERNAME}
ADMIN_IDS=${ADMIN_IDS}
DOMAIN=https://${DOMAIN}

DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_PORT=5432
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}

REDIS_PORT=6379
REDIS_URL=redis://redis:6379

BOT_PORT=3000
MINIAPP_PORT=8080
ADMIN_PORT=8081
WEBHOOK_PATH=/webhook

PANEL_URL=${PANEL_URL}
PANEL_API_KEY=${PANEL_API_KEY}
PANEL_USERNAME=${PANEL_USERNAME}
PANEL_PASSWORD=${PANEL_PASSWORD}
PANEL_SUB_PATH=${PANEL_SUB_PATH}

ZARINPAL_MERCHANT_ID=${ZARINPAL_MERCHANT_ID}
AQAYEPARDAKHT_PIN=${AQAYEPARDAKHT_PIN}
IRANPAY_API_KEY=
NOWPAYMENTS_API_KEY=
PLISIO_API_KEY=
TRONADO_API_KEY=
TRONADO_WALLET=
CARD_NUMBER=${CARD_NUMBER}
CARD_HOLDER=${CARD_HOLDER}

JWT_SECRET=${JWT_SECRET}
MINIAPP_URL=${MINIAPP_URL}

CHANNEL_ID=
CHANNEL_ENABLED=false

TRIAL_ENABLED=true
TRIAL_DAYS=1
TRIAL_VOLUME_GB=1
REFERRAL_ENABLED=true
REFERRAL_REWARD=10000
LOTTERY_ENABLED=true
PHONE_VERIFY_ENABLED=false
EOF

log "Environment configured"

# --- Caddy reverse proxy (auto HTTPS) ---
info "Setting up Caddy reverse proxy with automatic HTTPS..."

mkdir -p /etc/caddy

cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    # Bot API + Webhook
    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle /webhook {
        reverse_proxy localhost:3000
    }

    # Mini App
    handle /app/* {
        uri strip_prefix /app
        reverse_proxy localhost:8080
    }

    # Admin Panel
    handle /admin/* {
        uri strip_prefix /admin
        reverse_proxy localhost:8081
    }

    # Default: redirect to mini app
    handle {
        redir /app permanent
    }
}
EOF

# Install Caddy if not present
if command -v caddy &>/dev/null; then
  log "Caddy already installed"
else
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null 2>&1
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null 2>&1
  log "Caddy installed"
fi

systemctl enable caddy
if systemctl restart caddy; then
  log "Caddy configured for ${DOMAIN}"
else
  warn "Caddy failed to start. Check: journalctl -xeu caddy.service"
  warn "Make sure DNS for ${DOMAIN} points to this server and ports 80/443 are free."
  warn "You can fix and restart later: systemctl restart caddy"
fi

# --- Build and start containers ---
info "Building containers (this may take a few minutes)..."
cd "$PROJECT_DIR"
docker compose down --remove-orphans 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

log "Containers started"

# --- Wait for DB ---
info "Waiting for database to be ready..."
sleep 5
for i in $(seq 1 30); do
  if docker exec sanaei-bot-db pg_isready -U "$DB_USER" &>/dev/null; then
    break
  fi
  sleep 2
done
log "Database is ready"

# --- Push DB schema (auto-handled by migrations on bot startup) ---
info "Database schema will be applied automatically on bot startup via migrations."
log "Database initialization complete"

# --- Systemd service for auto-restart ---
info "Creating systemd service..."
cat > /etc/systemd/system/sanaei-bot.service <<EOF
[Unit]
Description=Sanaei VPN Bot Stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose restart

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sanaei-bot.service
log "Systemd service enabled"

# --- Summary ---
echo ""
echo "═══════════════════════════════════════════"
echo -e "${GREEN} Installation Complete!${NC}"
echo "═══════════════════════════════════════════"
echo ""
echo "  Bot API:      https://${DOMAIN}/api"
echo "  Mini App:     https://${DOMAIN}/app"
echo "  Admin Panel:  https://${DOMAIN}/admin"
echo "  Webhook:      https://${DOMAIN}/webhook"
echo ""
echo "  Database:     ${DB_NAME} (user: ${DB_USER})"
echo "  DB Password:  ${DB_PASS}"
echo ""
echo "  Project Dir:  ${PROJECT_DIR}"
echo ""
echo "  Commands:"
echo "    docker compose logs -f     # View logs"
echo "    docker compose restart     # Restart all"
echo "    docker compose down        # Stop all"
echo "    ./install.sh --update      # Update to latest code"
echo ""
echo -e "${YELLOW}  ⚠ Save your DB password: ${DB_PASS}${NC}"
echo "═══════════════════════════════════════════"
