#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# Sanaei VPN Bot - Update Script
# Updates /opt/sanaei-vpn-bot with fresh source and rebuilds
# Usage: sudo ./update.sh [source_dir]
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
SOURCE_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root (sudo ./update.sh)"
fi

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  error "No existing installation found at $PROJECT_DIR. Run install.sh first."
fi

info "Updating Sanaei VPN Bot..."
echo "─────────────────────────────────────────"
info "Source: $SOURCE_DIR"
info "Target: $PROJECT_DIR"

# Backup .env
cp "$PROJECT_DIR/.env" /tmp/.env.backup
log "Configuration backed up"

# Copy fresh source (including dotfiles)
info "Copying updated source files..."
cp -r "$SOURCE_DIR"/. "$PROJECT_DIR/"

# Restore .env (don't overwrite user config)
cp /tmp/.env.backup "$PROJECT_DIR/.env"
rm -f /tmp/.env.backup
log "Configuration preserved"

# Update git tracking if available
if git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree &>/dev/null; then
  git -C "$PROJECT_DIR" add -A
  git -C "$PROJECT_DIR" -c user.name="updater" -c user.email="updater@local" commit -qm "Update $(date +%F_%H:%M)" 2>/dev/null || true
fi

# Rebuild containers
cd "$PROJECT_DIR"
info "Rebuilding containers (no cache)..."
docker compose build --no-cache
docker compose up -d

echo ""
log "Update complete!"
echo "─────────────────────────────────────────"
docker compose ps
echo ""
info "Recent logs:"
docker compose logs --tail=15
