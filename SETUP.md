# Como rodar o ERP Genius

> Stack: **Next.js 16** (App Router) · TypeScript · Tailwind · Prisma 5 + PostgreSQL ·
> Auth.js (NextAuth v5 beta) · Zod · React Hook Form · Vitest. Detalhes em
> [`docs/02-arquitetura.md`](docs/02-arquitetura.md) e [`docs/13-convencoes-codigo.md`](docs/13-convencoes-codigo.md).

## Pré-requisitos
- Node.js 20+ (exigido pelo Next.js 16)
- PostgreSQL (local, ou na nuvem: Neon / Supabase)

## Passos

1. **Variáveis de ambiente** — copie o exemplo e preencha:
   ```bash
   cp .env.example .env
   ```

   | Variável | Obrigatória | O que é | Como obter |
   |---|---|---|---|
   | `DATABASE_URL` | ✅ | String de conexão do PostgreSQL | Local, ou painel do Neon/Supabase |
   | `AUTH_SECRET` | ✅ | Segredo de assinatura de sessão (Auth.js) | `npx auth secret` ou `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | ✅ (dev) | URL base da app | `http://localhost:3000` em desenvolvimento |

   > `.env` está no `.gitignore` — **nunca** versione segredos. O `.env.example` é o template.

2. **Instalar dependências:**
   ```bash
   npm install
   ```

3. **Criar o banco (migrations) e gerar o client:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Popular usuários iniciais (seed):**
   ```bash
   npm run seed
   ```

5. **Rodar:**
   ```bash
   npm run dev
   ```
   Abra http://localhost:3000

## Login inicial
- **admin@genius.com** / **genius123** (Administrador — vê tudo)

Outros usuários de teste (mesma senha `genius123`), para ver o menu mudar por papel:
- mariana@genius.com — Gerente Comercial + Vendedor
- joao@genius.com — Vendedor
- ana@genius.com — Financeiro + Secretaria Acadêmica
- carla@genius.com — Professor

## O que já funciona (Fase 0)
- Login (Auth.js) com os 7 papéis · rotas protegidas (sem sessão → volta pro login).
- **App shell** com menu lateral **role-aware** (cada papel vê só o que pode) e destaque do item ativo.
- Banco modelado em **eventos + estado** (ver `prisma/schema.prisma` e `docs/02`, `docs/10`).
- **Telas da Fase 0 implementadas:** Configuração (países, catálogo, turmas, usuários), Pipeline/
  Kanban + Ficha do Lead, matrícula manual, Homes (vendedor/gerente/professor), área de Alunos e
  Financeiro manual. Design em `docs/09-fase0-telas.md`; estado dos itens em
  `docs/16-plano-execucao.md`.

## Scripts úteis
- `npm run dev` — ambiente de desenvolvimento (http://localhost:3000)
- `npm run build` / `npm start` — build de produção (Turbopack) e execução
- `npm test` — testes unitários (Vitest, regras puras) · `npm run test:watch` — modo watch
- `npm run prisma:studio` — abre o Prisma Studio (inspecionar/editar o banco)
- `npm run prisma:migrate` — cria/aplica migrations em dev
- `npm run seed` — popula usuários iniciais

## Verificação estática
- **Typecheck:** `npx tsc --noEmit` — checagem de tipos do projeto (o `tsconfig.json` já usa
  `noEmit`). É a verificação estática disponível hoje.
- **Lint:** ⚠️ o script `npm run lint` ainda aponta para `next lint`, que **não funciona no
  Next.js 16** (o subcomando `next lint` foi removido) e o projeto **não tem ESLint configurado**.
  Use `npx tsc --noEmit` (e `npm test`) como checagem até o ESLint ser (re)adicionado — ver
  gap em `docs/16-plano-execucao.md`.

## Troubleshooting
- **`Can't reach database server` / erro de conexão:** confira `DATABASE_URL` e se o
  PostgreSQL está de pé. Em Neon/Supabase, a string costuma exigir `?sslmode=require`.
- **`@prisma/client did not initialize yet`:** rode `npx prisma generate` (ou
  `npm run prisma:generate`).
- **Migrations fora de sincronia em dev:** `npx prisma migrate reset` recria o banco
  (apaga os dados de dev) e re-roda o seed.
- **Login não funciona / sessão cai:** verifique se `AUTH_SECRET` está definido e se
  `NEXTAUTH_URL` bate com a URL que você está acessando.
- **Mudou o `schema.prisma`:** rode `npm run prisma:migrate` para gerar a migration e
  atualizar o client.
