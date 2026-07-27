# ReZeroBot

A production-ready Telegram bot for selling VPN services, built exclusively for the **Sanaei/Alireza (3x-ui)** panel. Features a modern Node.js + TypeScript backend, a beautiful Telegram Mini App, and a full admin panel.

## Features

- **Automated Config Delivery** — Creates clients on Sanaei panel and delivers VLESS/VMess/Trojan/Shadowsocks configs instantly
- **Telegram Mini App** — High-quality React-based Mini App with RTL support, dark mode, and smooth animations
- **Multiple Payment Gateways** — Zarinpal, Aqayepardakht, IranPay, NowPayments, Plisio, Tronado, Card-to-Card
- **Wallet System** — Users can charge their balance and purchase with one click
- **Referral System** — Unique referral links with configurable rewards and cashback
- **Discount & Gift Codes** — Admin-generated codes with usage tracking
- **Lottery** — Create lotteries with automatic winner drawing
- **Trial System** — One free trial per user with configurable duration/volume
- **Admin Panel** — Full web-based admin with dashboard, user management, product CRUD, payment approvals
- **Cron Jobs** — Expiry reminders, payment checks, panel health monitoring, auto-backup
- **Bilingual** — Persian (FA) and English (EN) with RTL/LTR support
- **Subscription Links** — Compatible with V2Ray, Clash, and all major clients

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Bot Framework | grammY |
| Backend | Node.js + TypeScript + Express |
| Database | PostgreSQL 16 (Drizzle ORM) |
| Cache/Sessions | Redis 7 |
| Mini App | React 18 + Vite + TailwindCSS |
| Admin Panel | React 18 + Vite + TailwindCSS |
| State Management | Zustand + React Query |
| Animations | Framer Motion |
| Validation | Zod |
| Deployment | Docker Compose + Caddy (auto HTTPS) |

## Project Structure

```
ReZeroBot/
├── bot/                    # Telegram bot backend
│   ├── src/
│   │   ├── index.ts        # Entry point (Express + grammY)
│   │   ├── config.ts       # Environment config (Zod validated)
│   │   ├── db/             # Database schema & connection
│   │   ├── panels/sanaei/  # Sanaei (3x-ui) API client
│   │   ├── bot/            # Commands, callbacks, keyboards
│   │   ├── services/       # Business logic layer
│   │   ├── payments/       # Payment gateway integrations
│   │   ├── api/            # REST API (Mini App + Admin)
│   │   ├── cron/           # Scheduled jobs
│   │   └── i18n/           # FA/EN translations
│   └── Dockerfile
├── miniapp/                # Telegram Mini App
│   ├── src/
│   │   ├── pages/          # Home, Shop, Services, Wallet, Account, Support
│   │   ├── hooks/          # useTelegram (WebApp SDK)
│   │   ├── store/          # Zustand state
│   │   └── api/            # API client
│   └── Dockerfile
├── admin/                  # Admin Panel
│   ├── src/
│   │   ├── pages/          # Dashboard, Users, Products, Orders, Payments, Panels, Marketing, Settings
│   │   └── components/     # Layout, sidebar navigation
│   └── Dockerfile
├── docker-compose.yml      # PostgreSQL + Redis + Bot + MiniApp + Admin
├── install.sh              # Interactive deployment script (Ubuntu)
└── .env.example            # All configuration variables
```

## Prerequisites

- **Server:** Ubuntu 22.04 or 24.04 (for production)
- **Domain:** A domain with DNS A record pointing to your server
- **Panel:** A running Sanaei/Alireza (3x-ui) panel
- **Bot Token:** From [@BotFather](https://t.me/BotFather)

## Installation (Linux Server)

### Quick Install (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/ReZeRoP/ReZeroBot.git
cd ReZeroBot

# 2. Run the interactive installer
chmod +x install.sh
sudo ./install.sh
```

The installer will:
1. Prompt for your bot token, domain, panel credentials, and payment keys
2. Install Docker & Docker Compose automatically
3. Generate `.env` configuration
4. Set up Caddy reverse proxy with automatic HTTPS (Let's Encrypt)
5. Build and start all containers
6. Create a systemd service for auto-restart on reboot

### Manual Install

```bash
# 1. Clone
git clone https://github.com/ReZeRoP/ReZeroBot.git
cd ReZeroBot

# 2. Configure environment
cp .env.example .env
nano .env
```

Edit `.env` with your values:

```env
BOT_TOKEN=123456:ABC-DEF...
BOT_USERNAME=ReZeroBot
ADMIN_IDS=123456789
DOMAIN=https://bot.example.com

DATABASE_URL=postgresql://sanaei:sanaei_secret@postgres:5432/sanaei_bot
REDIS_URL=redis://redis:6379

PANEL_URL=http://your-panel-ip:2053
PANEL_USERNAME=admin
PANEL_PASSWORD=your_password

JWT_SECRET=a_random_secure_string
```

```bash
# 3. Build and start
docker compose up -d --build

# 4. Set Telegram webhook
curl -F "url=https://bot.example.com/webhook" https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook
```

### Access Points

| Service | URL |
|---------|-----|
| Bot API | `https://your-domain.com/api` |
| Mini App | `https://your-domain.com/app` |
| Admin Panel | `https://your-domain.com/admin` |
| Webhook | `https://your-domain.com/webhook` |

## Local Development (Windows/Linux)

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [pnpm 9+](https://pnpm.io) — `npm install -g pnpm`
- [Docker Desktop](https://docker.com/products/docker-desktop) (for PostgreSQL + Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start database and cache
docker compose up -d postgres redis

# Configure environment
cp .env.example .env
# Edit .env: change "postgres" → "localhost" in DATABASE_URL
#            change "redis" → "localhost" in REDIS_URL

# Push database schema
pnpm db:push

# Run bot in development mode (hot reload)
pnpm dev:bot

# Run Mini App dev server (http://localhost:5173)
pnpm dev:miniapp

# Run Admin Panel dev server (http://localhost:5174)
pnpm dev:admin
```

## Server Commands

```bash
# View all container logs
docker compose logs -f

# View specific service logs
docker compose logs -f bot
docker compose logs -f postgres

# Restart all services
docker compose restart

# Restart only the bot
docker compose restart bot

# Stop all services
docker compose down

# Stop and remove volumes (destroys data!)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Rebuild only the bot
docker compose up -d --build bot

# Check container status
docker compose ps

# Enter bot container shell
docker exec -it sanaei-bot sh

# Run database migrations
docker exec -it sanaei-bot node -e "import('./dist/db/migrate.js')"

# Backup database
docker exec sanaei-bot-db pg_dump -U sanaei sanaei_bot > backup_$(date +%Y%m%d).sql

# Restore database
cat backup.sql | docker exec -i sanaei-bot-db psql -U sanaei sanaei_bot

# View resource usage
docker stats

# Update to latest version
git pull origin master
docker compose up -d --build
```

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram bot token from BotFather | — |
| `BOT_USERNAME` | Bot username (without @) | — |
| `ADMIN_IDS` | Comma-separated admin Telegram IDs | — |
| `DOMAIN` | Your domain (https://...) | — |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `PANEL_URL` | Sanaei panel address | — |
| `PANEL_USERNAME` | Panel login username | — |
| `PANEL_PASSWORD` | Panel login password | — |
| `JWT_SECRET` | Secret for JWT token signing | — |
| `MINIAPP_URL` | Mini App URL for Telegram | — |
| `CHANNEL_ID` | Mandatory join channel (@username) | — |
| `CHANNEL_ENABLED` | Enable forced channel join | `true` |
| `TRIAL_ENABLED` | Enable free trial | `true` |
| `TRIAL_DAYS` | Trial duration in days | `1` |
| `TRIAL_VOLUME_GB` | Trial traffic limit | `1` |
| `REFERRAL_ENABLED` | Enable referral system | `true` |
| `REFERRAL_REWARD` | Referral reward (Toman) | `10000` |
| `ZARINPAL_MERCHANT_ID` | Zarinpal gateway merchant ID | — |
| `AQAYEPARDAKHT_PIN` | Aqayepardakht gateway PIN | — |
| `CARD_NUMBER` | Card number for manual payments | — |

## Payment Gateways

| Gateway | Type | Config Variable |
|---------|------|----------------|
| Zarinpal | Online (IRR) | `ZARINPAL_MERCHANT_ID` |
| Aqayepardakht | Online (IRR) | `AQAYEPARDAKHT_PIN` |
| IranPay | Online (IRR) | `IRANPAY_API_KEY` |
| NowPayments | Crypto | `NOWPAYMENTS_API_KEY` |
| Plisio | Crypto | `PLISIO_API_KEY` |
| Tronado | Crypto (TRX) | `TRONADO_API_KEY` + `TRONADO_WALLET` |
| Card-to-Card | Manual | `CARD_NUMBER` + `CARD_HOLDER` |

## License

MIT
