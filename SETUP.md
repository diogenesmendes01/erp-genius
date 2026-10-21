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
| `ANTHROPIC_API_KEY` | Aria (Fase 5, ADR-F5-01). Sem a chave, a IA roda o provedor local determinístico "simulado" e nada chama a rede. Com a chave, a Aria chama a API da Anthropic e, quando estiver `ATIVA`, pode responder clientes. Os modelos ficam em Configurações › CRM › IA (não há variável de modelo). | vazio |
| `PAGAMENTO_SIMULADO` | Habilita o botão de pagar da página `/pagar/[token]` (dev/demo) | vazio |

Rotas públicas novas: `/pagar/[token]` (link de pagamento do gateway simulado) e
`/certificado/[codigo]` (validação pública de certificado). Portal do aluno em `/portal`
(papel `ALUNO`; a secretaria cria o acesso na ficha do aluno). O tick do cron
(`POST /api/whatsapp/cron`, header `x-cron-secret`) roda as etapas de base: régua de cobrança,
acesso, início de turmas, reservas, fechamento mensal de comissões, lembretes de tarefas, eventos
do motor e despacho da fila (as cadências comerciais C4, o copiloto e a gestão C5 saíram do tick)
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

3. **Login no GHCR na VPS** (uma vez):

   O Coolify precisa de credenciais para puxar a imagem do app do GHCR. Na VPS, rode:

   ```bash
   docker login ghcr.io -u <seu-usuario-github>
   ```

   Quando pedir a senha, use um **Personal Access Token** (PAT) do GitHub com escopo `read:packages`:
   - Criar em: https://github.com/settings/tokens/new
   - Escopo mínimo: `read:packages`
   - Guarde o token em local seguro (só aparece uma vez)

   > **Nota:** o login fica salvo em `/root/.docker/config.json` e persiste entre deploys.

4. **Variáveis de ambiente** (aba "Environment Variables"):

   | Variável | Obrigatória | O que é | Exemplo / como obter |
   |---|---|---|---|
   | `APP_IMAGE` | ✅ | Imagem do app (runner) publicada no GHCR (pinada por digest) | `ghcr.io/diogenesmendes01/erp-genius@sha256:abc123...` (ver abaixo) |
   | `APP_MIGRATE_IMAGE` | ✅ | Imagem do migrate (builder) publicada no GHCR (pinada por digest) | `ghcr.io/diogenesmendes01/erp-genius/migrate@sha256:def456...` (ver abaixo) |
   | `DOMINIO_APP` | ✅ | Domínio público do app (sem https://) | `erp.geniusidiomas.com` |
   | `POSTGRES_USER` | ✅ | Usuário do banco | `erp` |
   | `POSTGRES_PASSWORD` | ✅ | Senha do banco (URL-safe, sem `/+=`) | `openssl rand -hex 32` |
   | `AUTH_SECRET` | ✅ | Segredo do Auth.js (sessão) | `npx auth secret` ou `openssl rand -base64 32` |
   | `CRON_SECRET` | ✅ | Segredo do cron (header `x-cron-secret`) | `openssl rand -hex 32` |
   | `MOTOR_IMAGE` | ✅ | Imagem publicada do motor WhatsApp | tag da imagem do `whatsapp-web-baileys` |
   | `MOTOR_API_KEY` | ✅ | API key ERP → motor (mínimo 32 caracteres) | `openssl rand -hex 32` |
   | `MOTOR_WEBHOOK_SECRET` | ✅ | Segredo do HMAC motor → ERP (mínimo 32 caracteres) | `openssl rand -hex 32` |
   | `WHATSAPP_LIVE` | | Ativar envios reais (só após piloto) | vazio em dev/staging, `1` em produção |
   | `ANTHROPIC_API_KEY` | | Aria (opcional). Vazio = provedor local "simulado", sem rede. Com a chave, a Aria chama a API da Anthropic e, quando `ATIVA`, pode enviar mensagens. Modelos em Configurações › CRM › IA | chave da API Anthropic |
   | `PAGAMENTO_SIMULADO` | | Habilita gateway simulado (dev/demo) | `1` em demo, vazio em produção |
   | `RESEND_API_KEY` | | Chave do Resend (e-mail do portal do aluno e avisos de agenda). Vazio = sem e-mail | chave da API Resend |
   | `EMAIL_INSTITUCIONAL_REMETENTE` | | Remetente dos e-mails (domínio verificado no Resend) | `nao-responda@geniusidiomas.com` |
   | `EMAIL_PORTAL_ENVIO_ENABLED` | | Liga os e-mails de acesso do portal (só `true` liga) | `false` até homologar |
   | `PORTAL_ALUNO_URL_PUBLICA` | se o envio do portal estiver ligado | Origem HTTPS pública, sem caminho — base dos links dos e-mails | `https://erp.geniusidiomas.com` |
   | `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL` | | Conta de serviço de leitura do Drive de gravações (player) | e-mail da conta de serviço |
   | `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY` | | Chave privada dessa conta (uma linha, `\n` literais) | campo `private_key` do JSON |
   | `DRIVE_ORGANIZACAO_ID` | | ID do drive compartilhado autorizado | ID do shared drive |
   | `GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_EMAIL` | | Conta de serviço separada, com escrita, para publicar/fixar revisões | e-mail da conta de serviço |
   | `GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_PRIVATE_KEY` | | Chave privada da conta de publicação | campo `private_key` do JSON |
   | `CONTINUIDADE_MENSAL_EMISSAO_ENABLED` | | Liga a emissão mensal recorrente (só `true` liga) | `false` até ativação |
   | `COMUNICACOES_AGENDA_ENVIO_ENABLED` | | Liga os avisos de alteração de agenda (só `true` liga) | `false` até homologar |
   | `COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED` | | Liga os avisos de quantidade de aulas (Q38) (só `true` liga) | `false` até homologar |

   > **Repasse ao container**: o Coolify só entrega ao app as variáveis citadas no `environment` do
   > serviço `app` em `docker-compose.coolify.yml`. Variável nova lida pelo código precisa entrar lá
   > (o teste `src/deploy/compose-env.test.ts` falha se faltar).
   >
   > **Agendadores**: o compose sobe `cron` (régua, 5 min), `cron-despacho` (60 s), `cron-portal-envios`
   > (`/api/portal-aluno/envios/cron`, 60 s) e `cron-avisos-agenda` (`/api/agenda/avisos/cron`, 5 min). Com a
   > flag desligada, as duas últimas rotas só respondem `{executou:false}`. **Exceção**:
   > `/api/financeiro/continuidade/cron` não é agendado — ao ligar `CONTINUIDADE_MENSAL_EMISSAO_ENABLED`,
   > configure um agendador (ex.: Scheduled Task do Coolify ou cron da VPS) com `POST` e header
   > `x-cron-secret: $CRON_SECRET`.

   > **Importante**: variáveis sem valor ficam vazias (sintaxe `${VAR:-}` no compose).
   > As marcadas como obrigatórias (`${VAR:?...}`) bloqueiam o deploy se estiverem vazias.

   **Como obter os digests das imagens:**

   Após cada merge na `main`, o workflow `.github/workflows/image.yml` constrói e publica duas imagens no GHCR:
   - **App (runner)**: a imagem final do app Next.js standalone
   - **Migrate (builder)**: a imagem com Prisma CLI e migrations para o serviço `migrate`

   Os digests aparecem no **job summary** do GitHub Actions (aba "Summary" do workflow).

   Formato das variáveis:
   ```
   APP_IMAGE=ghcr.io/diogenesmendes01/erp-genius@sha256:<digest-app>
   APP_MIGRATE_IMAGE=ghcr.io/diogenesmendes01/erp-genius/migrate@sha256:<digest-migrate>
   ```

   > **Importante:** sempre use o digest (`@sha256:...`), nunca uma tag (`main`, `latest`). O digest
   > garante que o Coolify sempre puxe a mesma versão validada da imagem. Tags mutáveis podem apontar
   > para imagens diferentes em cada pull. As duas imagens têm o mesmo SHA do commit embutido.

   **Variáveis de build-time (NEXT_PUBLIC_*):**

   O Next.js embute variáveis `NEXT_PUBLIC_*` no JavaScript do cliente **durante o build** (não em runtime).
   Atualmente o ERP não usa nenhuma variável `NEXT_PUBLIC_*`, então não há ação necessária.

   **Se você adicionar variáveis `NEXT_PUBLIC_*` no futuro:**
   - Elas precisam ser definidas **no GitHub Actions** (arquivo `.github/workflows/image.yml`, job `build` ou `publish`).
   - Não adianta definir no Coolify: o build acontece no CI, não na VPS.
   - Documente cada variável nova em `.env.example` e aqui no SETUP.md.

   **Ordem da virada (cutover):**

   Ao fazer a migração pela primeira vez, siga esta ordem para evitar que o deploy falhe:

   1. **No Coolify, DESLIGAR o auto-deploy por Git:**
      - Vá em "Configuration" do Resource
      - Desmarque "Auto Deploy" (se estiver ligado)
   
   2. **Mergear o PR no GitHub**
      - O merge adiciona a exigência de `APP_IMAGE` e `APP_MIGRATE_IMAGE` nos composes
   
   3. **Aguardar o workflow publicar as imagens:**
      - Acesse "Actions" no GitHub
      - Aguarde o workflow "Build e publicação de imagem" completar
      - Copie os digests do job summary
   
   4. **Fazer login no GHCR na VPS** (se ainda não foi feito, ver seção 3)
   
   5. **Definir as variáveis no Coolify:**
      - Vá em "Environment Variables"
      - Defina `APP_IMAGE` com o digest da imagem do app
      - Defina `APP_MIGRATE_IMAGE` com o digest da imagem do migrate
   
   6. **Deploy manual no Coolify:**
      - Clique em "Redeploy"
      - O Coolify puxa as imagens do GHCR e reinicia os containers

   A partir deste ponto, você pode reativar o auto-deploy por Git se desejar, mas lembre-se de que
   cada merge na `main` exige atualizar manualmente os digests no Coolify. O auto-deploy por Git não
   funciona mais porque as imagens vêm do GHCR, não do build na VPS.

   > **Deploy automático não está implementado:** o workflow não atualiza os digests no Coolify
   > automaticamente. Você deve atualizar `APP_IMAGE` e `APP_MIGRATE_IMAGE` manualmente no painel
   > do Coolify após cada merge e redesployar.

5. **Deploy**:
   - Clique em "Deploy" no Coolify.
   - O Traefik emite certificado TLS (Let's Encrypt) e roteia
     `https://erp.geniusidiomas.com` → serviço `app` porta 3000 (interna).
   - O Coolify monitora o healthcheck do app (`/api/ready`: readiness do container
     com validação do banco e Prisma, sem autenticação) e marca o deploy como
     bem-sucedido após 3 checks OK. `/api/health` continua como pure liveness
     (sem dependências externas).
   - **Nota**: `/api/whatsapp/health` (saúde do *canal* WhatsApp, protegido com
     `x-cron-secret`) é para monitores externos (UptimeRobot etc.), não para liveness
     do container Docker.

6. **Deploy automático**:
   - Cada merge no branch `main` dispara o build e publicação da imagem no GHCR.
   - Se o webhook do Coolify estiver configurado, o deploy é disparado automaticamente.
   - Caso contrário, atualize manualmente a variável `APP_IMAGE` no Coolify com o novo digest.

### Rollback (voltar para uma versão anterior)

Se um deploy causar problemas, você pode voltar para uma versão anterior **sem tocar no código**:

1. **Encontre os digests da versão anterior:**
   - Vá em "Actions" → workflow "Build e publicação de imagem" → run anterior.
   - Na aba "Summary", copie os digests das duas imagens publicadas.

2. **Atualize as variáveis no Coolify:**
   - Vá em "Environment Variables" do Resource.
   - Cole os digests antigos:
     ```
     APP_IMAGE=ghcr.io/diogenesmendes01/erp-genius@sha256:<digest-antigo-app>
     APP_MIGRATE_IMAGE=ghcr.io/diogenesmendes01/erp-genius/migrate@sha256:<digest-antigo-migrate>
     ```

3. **Redesploy no Coolify:**
   - Clique em "Redeploy" no painel do Coolify.
   - O Coolify puxa as imagens antigas (validadas) e reinicia os containers.

> **Nota:** o rollback é instantâneo (sem recompilar) e 100% confiável, pois o digest aponta
> para a mesma imagem binária que estava rodando antes. Não há "drift" de dependências ou ambiente.

### Números legados (Meta Cloud / Evolution) depois da Fase 4E

Meta Cloud e Evolution saíram do código: um número ativo com driver `META_CLOUD` ou `BAILEYS`
não envia nem recebe mais nada. A saúde do canal (`/api/whatsapp/health`) acusa cada um com o
alerta "Número … ativo em driver legado". Para cada número do alerta:

1. **Reparear a linha no motor.** O telefone é único em `NumeroWhatsApp`, então a mesma linha não
   pode ser cadastrada de novo como número novo. O integrador converte o registro (as conversas e o
   histórico ficam no mesmo número), com o app de pé e o motor no ar:

   ```sql
   UPDATE "NumeroWhatsApp"
      SET driver = 'MOTOR', "providerRef" = id, sessao = 'DESCONECTADO'
    WHERE id = '<id do número legado>';
   ```

   Depois, em **Configuração → WhatsApp → Números**, use **Conectar** (QR ou código de pareamento).
2. **Desativar o número legado** que não vai para o motor: **Editar** → desmarcar **Número ativo**.
   O número fica inativo (soft delete) e sai do alerta.
3. Confira `/api/whatsapp/health`: nenhum alerta de driver legado.

### Backup diário e o alerta de motor parado

`scripts/backup-producao.sh` (cron diário às 03:15, retenção 14 dias) para o serviço `motor` só
durante o `tar` do volume `motor_data` (o PGlite grava em arquivo) e o religa em seguida, também em
erro. Nesses segundos, um poll do monitor em `/api/whatsapp/health` pode receber **um 503 isolado**
com o alerta "Motor WhatsApp inalcançável": é esperado e não pede ação. Investigue só se o 503 se
repetir depois da janela do backup ou aparecer fora desse horário (confira `/var/log/erp-backup.log`).

### Diferenças em relação ao docker-compose.prod.yml

- **Sem Caddy**: o Traefik do Coolify cuida de TLS e roteamento.
- **Sem portas publicadas**: nenhum serviço tem `ports:` no compose.
- **Sem `db-init`**: o único banco Postgres é o do app; o motor guarda seus dados no volume `motor_data`.
- **Domínio**: vem da variável mágica `SERVICE_FQDN_APP_3000` (gerada pelo Coolify).
- **Healthcheck**: endpoint `/api/ready` (readiness do container com validação de DB
  e Prisma, sem autenticação). `/api/health` continua como pure liveness.
  Diferente de `/api/whatsapp/health` (saúde do *canal* WhatsApp, protegido).

### Troubleshooting

- **`no available server` no Traefik**: confira se o domínio foi preenchido com a porta
  interna `:3000` no campo "Domains for app" (ex.: `https://erp.geniusidiomas.com:3000`).
- **Certificado TLS não gerado**: aguarde alguns minutos (Let's Encrypt pode demorar).
  Se persistir, verifique se o DNS aponta para a VPS e se as portas 80/443 estão abertas.
- **App não sobe**: veja os logs do Coolify (aba "Logs" do Resource). Variáveis obrigatórias
  ausentes bloqueiam o deploy com erro claro.
- **Motor sem conexão**: o serviço `motor` só é acessível na rede interna do
  compose. O app se comunica via `http://motor:4317` (nunca HTTPS público). O motor tem
  healthcheck nativo (`GET /api/health`) e limites de recursos (768MB RAM, 0.75 CPU) adequados
  para um serviço Baileys em VPS compartilhada.
