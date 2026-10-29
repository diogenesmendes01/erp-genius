# syntax=docker/dockerfile:1

FROM node:26-alpine3.24@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS base
RUN apk add --no-cache libatomic openssl

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
RUN node -e "require('esbuild')" && npx esbuild --version

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN DATABASE_URL="postgresql://check:check@127.0.0.1:1/check" npx prisma migrate status 2>&1 | grep -q P1001 \
  || (echo "ERRO: schema engine do Prisma não carregou (o serviço migrate quebraria)" && exit 1)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN DATABASE_URL="postgresql://check:check@127.0.0.1:1/check" node -e ' \
  const { PrismaClient } = require("@prisma/client"); \
  new PrismaClient().$connect().then( \
    () => { console.error("ERRO: conectou num banco que não existe"); process.exit(1); }, \
    (e) => { if (e.errorCode === "P1001") process.exit(0); \
             console.error("ERRO: query engine do Prisma não carregou:", e.message); process.exit(1); });'

ARG GIT_SHA=""
ENV GIT_SHA=${GIT_SHA}

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
