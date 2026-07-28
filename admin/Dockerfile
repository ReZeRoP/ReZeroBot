# ---- Build Stage ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

ARG VITE_API_URL=/api/admin
ENV VITE_API_URL=$VITE_API_URL

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY admin/package.json ./admin/

RUN pnpm install --filter admin --frozen-lockfile || pnpm install --filter admin

COPY admin/ ./admin/

RUN pnpm --filter admin build

# ---- Serve Stage ----
FROM nginx:alpine AS runner

COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/admin/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
