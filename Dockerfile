# SuperBad Lite — production Dockerfile for Coolify deployment.
# Multi-stage build: deps → build → runtime.
# Runs Next.js on port 3001 with Litestream sidecar for SQLite → R2 backup.

FROM node:20-bookworm-slim AS base

# --- Stage 1: install dependencies ---
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- Stage 2: build the Next.js app ---
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# --- Stage 3: production runtime ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    gnupg \
    # Chromium for PDF rendering (native package, works on any arch)
    chromium \
    fonts-liberation \
    # Litestream for continuous SQLite → R2 backup
  && wget -q https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.deb \
  && dpkg -i litestream-v0.3.13-linux-amd64.deb \
  && rm litestream-v0.3.13-linux-amd64.deb \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/data/au-holidays.json ./data/au-holidays.json

COPY litestream.yml /etc/litestream.yml
COPY scripts/start.sh /app/start.sh
RUN chmod +x /app/start.sh

RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3001

CMD ["/app/start.sh"]
