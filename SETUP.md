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

## O que já funciona (Fase 0 implementada)
- Login (Auth.js) com os 7 papéis · rotas protegidas · **app shell** com menu lateral **role-aware**.
- Configuração (países, catálogo, turmas, usuários), CRM (pipeline/kanban, ficha do lead),
  matrícula manual, Homes (vendedor/gerente/professor), área de alunos e financeiro manual.
- Banco modelado em **eventos + estado** (ver `prisma/schema.prisma` e `docs/02`, `docs/10`).

> **Limitações conhecidas da Fase 0** (ver [`docs/16-plano-execucao.md`](docs/16-plano-execucao.md)
> §Limitações): guards de permissão só nas **mutações** (leituras ainda sem guard por consulta);
> testes de **integração** contra o DB pendentes; **storage local** de uploads em `public/uploads`
> (não serverless).

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

### Windows / PowerShell
- **`npm.ps1 cannot be loaded ... running scripts is disabled on this system`:** o PowerShell
  está bloqueando o script `npm.ps1` por política de execução. Soluções:
  - liberar para o usuário atual (recomendado):
    `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` e reabrir o terminal; ou
  - usar `npm.cmd` em vez de `npm` (ex.: `npm.cmd install`, `npm.cmd run dev`); ou
  - rodar pelo **Git Bash**/WSL, onde a política do PowerShell não se aplica.
- **`build` travado / `EPERM: operation not permitted ... .next/trace`:** o arquivo de trace do
  Next fica preso (antivírus, OneDrive sincronizando a pasta, ou um `next dev` ainda rodando).
  - encerre processos `node`/`next` pendentes;
  - apague a pasta de build e rode de novo: remova `.next` (`Remove-Item -Recurse -Force .next`
    no PowerShell, ou `rm -rf .next` no bash) e refaça `npm run build`;
  - se persistir, mova o projeto para **fora** de pastas sincronizadas (OneDrive/Dropbox) ou
    adicione a pasta do projeto à exceção do antivírus.
