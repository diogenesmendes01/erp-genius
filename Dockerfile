# syntax=docker/dockerfile:1
# Imagem de produção do ERP (doc 31 — WhatsApp E5, gap A1 do doc 28).
# Multi-stage: deps → builder (prisma generate + next build standalone) → runner enxuto.
# O estágio `builder` também serve de imagem do serviço `migrate` do compose
# (prisma migrate deploy roda ANTES do app subir — nunca dentro do app).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Client Prisma gerado no build (não precisa de conexão com banco).
RUN npx prisma generate
# Next 16 standalone (next.config.mjs `output: "standalone"`).
# DATABASE_URL de placeholder: páginas são dinâmicas (auth), o build não conecta.
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Usuário sem privilégio; data/uploads é volume (mídia WhatsApp + comprovantes).
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
