# ── Etapa 1: dependencias ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install

# ── Etapa 2: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Etapa 3: producción ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copiar output standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Directorios persistentes (montados como volumen en Fly.io)
RUN mkdir -p /storage/db /storage/uploads && chown -R nextjs:nodejs /storage

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_PATH=/storage/db/owl.db
ENV UPLOADS_DIR=/storage/uploads

CMD ["node", "server.js"]
