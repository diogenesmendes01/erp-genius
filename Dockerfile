# syntax=docker/dockerfile:1
# Imagem de produção do ERP (doc 31 — WhatsApp E5, gap A1 do doc 28).
# Multi-stage: base (openssl) → deps → builder (prisma generate + next build standalone) → runner enxuto.
# O estágio `builder` também serve de imagem do serviço `migrate` do compose
# (prisma migrate deploy roda ANTES do app subir — nunca dentro do app).
# Imagem base pinnada com digest para prevenir quebras em deploys automáticos (Alpine bump).

FROM node:22-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS base
RUN apk add --no-cache openssl

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Client Prisma gerado no build (não precisa de conexão com banco).
RUN npx prisma generate
# Checagem REAL do schema engine (é ele que o serviço `migrate` usa): executa o engine contra
# uma porta sem banco. P1001 ("can't reach database server") só aparece se o engine carregou;
# engine errado/libssl ausente dá outro erro e derruba o build em vez da produção.
RUN DATABASE_URL="postgresql://check:check@127.0.0.1:1/check" npx prisma migrate status 2>&1 | grep -q P1001 \
  || (echo "ERRO: schema engine do Prisma não carregou (o serviço migrate quebraria)" && exit 1)
# Next 16 standalone (next.config.mjs `output: "standalone"`).
# DATABASE_URL de placeholder: páginas são dinâmicas (auth), o build não conecta.
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# HOSTNAME=0.0.0.0: Next standalone server.js precisa bind em todas as interfaces IPv4.
# Sem isso, bind no container id (HOSTNAME padrão do Docker) e o healthcheck local é refused.
# Só IPv4: o healthcheck do compose usa 127.0.0.1 (o wget do BusyBox resolve localhost para ::1).
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégio; data/uploads é volume (mídia WhatsApp + comprovantes).
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

# Sem COPY de public/: o repo não tem assets públicos (fontes vivem em src/app/fonts e
# uploads são privados em data/ — review PR #52). Se public/ nascer um dia, adicionar a cópia.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Checagem REAL do query engine no runner: `require('@prisma/client')` sozinho não carrega o
# engine nativo (ele só sobe no primeiro $connect). Conecta numa porta sem banco e exige P1001,
# que prova que o .so.node do standalone carregou com a libssl desta imagem.
RUN DATABASE_URL="postgresql://check:check@127.0.0.1:1/check" node -e ' \
  const { PrismaClient } = require("@prisma/client"); \
  new PrismaClient().$connect().then( \
    () => { console.error("ERRO: conectou num banco que não existe"); process.exit(1); }, \
    (e) => { if (e.errorCode === "P1001") process.exit(0); \
             console.error("ERRO: query engine do Prisma não carregou:", e.message); process.exit(1); });'

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
