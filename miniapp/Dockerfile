# ---- Build Stage ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY miniapp/package.json ./miniapp/

RUN pnpm install --filter miniapp --frozen-lockfile || pnpm install --filter miniapp

COPY miniapp/ ./miniapp/

RUN pnpm --filter miniapp build

# ---- Serve Stage ----
FROM nginx:alpine AS runner

COPY miniapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/miniapp/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
