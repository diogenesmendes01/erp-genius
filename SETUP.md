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
> testes de **integração** contra o DB pendentes; uploads em **storage local privado**
> (`data/uploads/`, servidos por rota autenticada) — ainda em filesystem local, não serverless.

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
  - Em CI/sandbox, prefira validar com `npm run lint` + `npm test` (+ `npx tsc --noEmit`).

## Uploads (storage privado)
- Comprovantes, contratos e documentos são gravados em **`data/uploads/`** (fora de
  `public/`), portanto **não** são acessíveis por URL pública. A leitura passa por
  `GET /api/files/[...path]`, que **exige sessão válida e autorização por papel/escopo**
  sobre o objeto que referencia o arquivo (ex.: a cobrança/lead correspondente). O envio é por
  `POST /api/upload` (também autenticado). A pasta `data/uploads/` está no `.gitignore`.


## Variáveis novas (Fases 1–3, ago/2026)

| Variável | Para quê | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | C3 — copiloto IA (sem a chave roda a heurística local "simulado") | vazio |
| `IA_MODELO` | Modelo da API Anthropic usado pelo copiloto | `claude-sonnet-5` |
| `PAGAMENTO_SIMULADO` | Habilita o botão de pagar da página `/pagar/[token]` (dev/demo) | vazio |

Rotas públicas novas: `/pagar/[token]` (link de pagamento do gateway simulado) e
`/certificado/[codigo]` (validação pública de certificado). Portal do aluno em `/portal`
(papel `ALUNO`; a secretaria cria o acesso na ficha do aluno). O tick do cron
(`POST /api/whatsapp/cron`, header `x-cron-secret`) agora roda também: cadências C4,
check-in vencido (B9), copiloto (quietude), gestão (C5) e fechamento mensal de comissões
— em produção o serviço `cron` do `docker-compose.prod.yml` bate a cada 5 minutos.

---

## Deploy no Coolify (v4.3.23+)

O ERP Genius pode ser implantado no **Coolify** (VPS com Traefik como proxy reverso).
Use o arquivo **`docker-compose.coolify.yml`** — ele não usa Caddy (o Traefik do Coolify
cuida de TLS e domínio) e nenhum serviço publica porta no host.

### Pré-requisitos

1. **Coolify** v4.3.23+ instalado na VPS (Traefik ocupando portas 80/443).
2. **DNS**: registro A apontando `erp.geniusidiomas.com` para o IP da VPS.
3. **Portas 80 e 443** liberadas no firewall (Traefik escuta HTTPS público).

### Passo a passo

1. **Criar Resource** no Coolify:
   - Tipo: **Docker Compose** (Source: Git).
   - **Repository**: apontar para este repo (branch `main`).
   - **Compose File**: `docker-compose.coolify.yml`.

2. **Domínio do serviço `app`**:
   - No painel do Coolify, aba "Configuration" → "Domains for app":
   - Preencher: **`https://erp.geniusidiomas.com:3000`** (a porta `:3000` é interna;
     o Coolify gera os labels do Traefik automaticamente).
   - O público acessa **`https://erp.geniusidiomas.com`** (porta 443 padrão).

3. **Variáveis de ambiente** (aba "Environment Variables"):

   | Variável | Obrigatória | O que é | Exemplo / como obter |
   |---|---|---|---|
   | `DOMINIO_APP` | ✅ | Domínio público do app (sem https://) | `erp.geniusidiomas.com` |
   | `POSTGRES_USER` | ✅ | Usuário do banco | `erp` |
   | `POSTGRES_PASSWORD` | ✅ | Senha do banco (URL-safe, sem `/+=`) | `openssl rand -hex 32` |
   | `AUTH_SECRET` | ✅ | Segredo do Auth.js (sessão) | `npx auth secret` ou `openssl rand -base64 32` |
   | `CRON_SECRET` | ✅ | Segredo do cron (header `x-cron-secret`) | `openssl rand -hex 32` |
   | `EVOLUTION_APIKEY` | ✅ | API key da Evolution (Baileys self-hosted) | `openssl rand -hex 32` |
   | `WHATSAPP_LIVE` | | Ativar envios reais (só após piloto) | vazio em dev/staging, `1` em produção |
   | `ANTHROPIC_API_KEY` | | Copiloto IA (opcional; sem ele roda heurística local) | chave da API Anthropic |
   | `IA_MODELO` | | Modelo do copiloto | `claude-sonnet-5` (default) |
   | `PAGAMENTO_SIMULADO` | | Habilita gateway simulado (dev/demo) | `1` em demo, vazio em produção |
   | `META_WA_TOKEN` | | Token da Meta Cloud API (driver oficial) | painel Meta Developers |
   | `META_WA_APP_SECRET` | | App Secret da Meta Cloud API | painel Meta Developers |
   | `META_WA_VERIFY_TOKEN` | | Token de verificação do webhook Meta | escolha aleatória |
   | `META_WA_WABA_ID` | | ID da conta WhatsApp Business (WABA) | painel Meta Developers |
   | `EVOLUTION_WEBHOOK_TOKEN` | | Token do webhook da Evolution | `openssl rand -hex 32` |

   > **Importante**: variáveis sem valor ficam vazias (sintaxe `${VAR:-}` no compose).
   > As marcadas como obrigatórias (`${VAR:?...}`) bloqueiam o deploy se estiverem vazias.

4. **Deploy**:
   - Clique em "Deploy" no Coolify.
   - O Traefik emite certificado TLS (Let's Encrypt) e roteia
     `https://erp.geniusidiomas.com` → serviço `app` porta 3000 (interna).
   - O Coolify monitora o healthcheck do app (`/api/whatsapp/health` com header
     `x-cron-secret`) e marca o deploy como bem-sucedido após 3 checks OK.

5. **Deploy automático**:
   - Cada merge no branch `main` dispara um novo deploy (webhook Git do Coolify).

### Diferenças em relação ao docker-compose.prod.yml

- **Sem Caddy**: o Traefik do Coolify cuida de TLS e roteamento.
- **Sem portas publicadas**: nenhum serviço tem `ports:` no compose.
- **Banco da Evolution**: criado por serviço one-shot `db-init` (comando SQL inline),
  em vez de bind mount `./deploy/initdb`.
- **Domínio**: vem da variável mágica `SERVICE_FQDN_APP_3000` (gerada pelo Coolify).
- **Healthcheck**: endpoint `/api/whatsapp/health` (exige header `x-cron-secret`).

### Troubleshooting

- **`no available server` no Traefik**: confira se o domínio foi preenchido com a porta
  interna `:3000` no campo "Domains for app" (ex.: `https://erp.geniusidiomas.com:3000`).
- **Certificado TLS não gerado**: aguarde alguns minutos (Let's Encrypt pode demorar).
  Se persistir, verifique se o DNS aponta para a VPS e se as portas 80/443 estão abertas.
- **App não sobe**: veja os logs do Coolify (aba "Logs" do Resource). Variáveis obrigatórias
  ausentes bloqueiam o deploy com erro claro.
- **Evolution sem conexão**: o serviço `evolution` só é acessível na rede interna do
  compose. O app se comunica via `http://evolution:8080` (nunca HTTPS público).
