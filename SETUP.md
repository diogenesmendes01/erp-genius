# Como rodar o ERP Genius (V0 — fundação)

## Pré-requisitos
- Node.js 18+
- PostgreSQL (local, ou na nuvem: Neon / Supabase)

## Passos

1. **Variáveis de ambiente** — copie o exemplo e preencha:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` → string de conexão do seu PostgreSQL.
   - `AUTH_SECRET` → gere com `npx auth secret` (ou `openssl rand -base64 32`).

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
