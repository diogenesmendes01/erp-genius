# Como rodar o ERP Genius (V0 — fundação)

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

## O que já funciona nesta fundação
- Login (Auth.js) com os 7 papéis.
- **App shell** com menu lateral **role-aware** (cada papel vê só o que pode) e destaque do item ativo.
- Rotas protegidas (sem sessão → volta pro login).
- Banco modelado em **eventos + estado** (ver `prisma/schema.prisma` e `docs/02`, `docs/10`).

As telas (Home, Pipeline, Ficha, Financeiro…) entram em seguida, a partir do design em `docs/09-fase0-telas.md`.

## Scripts úteis
- `npm run dev` — ambiente de desenvolvimento (http://localhost:3000)
- `npm run build` / `npm start` — build de produção e execução
- `npm run lint` — checagem de lint
- `npm run prisma:studio` — abre o Prisma Studio (inspecionar/editar o banco)
- `npm run prisma:migrate` — cria/aplica migrations em dev
- `npm run seed` — popula usuários iniciais

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
- **`npm run build` falha com `EPERM` em `.next/trace`:** algum processo ainda está
  segurando a pasta `.next` (ex.: um `npm run dev` aberto). Encerre os processos Node
  em execução e limpe a pasta antes de buildar:
  ```bash
  # encerre o dev server (Ctrl+C) ou mate os processos Node travados
  rm -rf .next
  npm run build
  ```
  No Windows, feche editores/terminais que estejam usando a pasta e rode
  `rmdir /s /q .next` antes do build. Em CI/sandbox, prefira validar com
  `npm run lint` + `npm test` (+ `npx tsc --noEmit`).

## Uploads (storage privado)
- Comprovantes, contratos e documentos são gravados em **`data/uploads/`** (fora de
  `public/`), portanto **não** são acessíveis por URL pública. A leitura passa por
  `GET /api/files/[...path]`, que **exige sessão** válida. O envio é por
  `POST /api/upload` (também autenticado). A pasta `data/uploads/` está no `.gitignore`.
