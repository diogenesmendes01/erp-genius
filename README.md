# ERP Genius

Next.js + Prisma + PostgreSQL. Node 22 (`.nvmrc`).

## Rodar localmente

```bash
npm ci
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

## Verificar

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## Testes de integração

```bash
npm run test:db
node scripts/prepare-test-profile.mjs
npm run test:int
npm run test:db:stop
```

## Deploy

`Dockerfile` + `docker-compose.prod.yml` (ou `docker-compose.coolify.yml`).
