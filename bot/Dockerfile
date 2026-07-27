# ---- Build Stage ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY bot/package.json ./bot/

# Install dependencies
RUN pnpm install --filter bot --frozen-lockfile || pnpm install --filter bot

# Copy source
COPY tsconfig.base.json ./
COPY bot/ ./bot/

# Build
RUN pnpm --filter bot build

# ---- Production Stage ----
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY bot/package.json ./bot/

RUN pnpm install --filter bot --prod --frozen-lockfile || pnpm install --filter bot --prod

COPY --from=builder /app/bot/dist ./bot/dist
COPY --from=builder /app/bot/drizzle ./bot/drizzle

WORKDIR /app/bot

EXPOSE 3000

CMD ["node", "dist/index.js"]
