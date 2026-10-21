# 31 — WhatsApp: go-live (E5) — deploy, backup, monitoramento e rollout

> Executa a **E5** do [`30`](30-whatsapp-spec-implementacao.md): fecha os gaps **A1–A8**
> do [`28`](28-whatsapp-auditoria-gaps.md) e organiza o rollout
> shadow → piloto → geral do [`26`](26-whatsapp-v1.md). Artefatos: `Dockerfile` ·
> `docker-compose.prod.yml` (VPS com Caddy) · `docker-compose.coolify.yml` (Coolify/Traefik) ·
> `deploy/` · `scripts/backup-producao.sh` · `GET /api/whatsapp/health`.
>
> **Atualizado em 21/10/2026 para o estado do código.** O canal roda num único driver, o
> **motor** (`whatsapp-web-baileys` em modo serviço, serviço `motor` dos composes). Meta Cloud
> (WABA, `META_WA_*`) e Evolution API saíram do código na Fase 4 — a antiga §0 (burocracia Meta)
> e os passos de webhook da Meta/Evolution não se aplicam mais (ficam no histórico do git).
> Passo a passo do Coolify e variáveis: `SETUP.md` §Deploy no Coolify.

## 0. Pré-requisitos do canal (motor)

Sem prazo de terceiro: não há verificação de negócio nem aprovação de template. O que precisa
estar pronto antes do deploy:
- [ ] **Imagem publicada do motor** (`whatsapp-web-baileys`) — vai em `MOTOR_IMAGE`. O compose
      recusa subir sem ela (`${MOTOR_IMAGE:?…}`).
- [ ] **Segredos do motor**, cada um com no mínimo 32 caracteres (`openssl rand -hex 32`):
      `MOTOR_API_KEY` (o ERP chama o motor com ela) e `MOTOR_WEBHOOK_SECRET` (HMAC dos eventos
      que o motor manda ao ERP). Os dois entram no `app` **e** no `motor` do compose.
- [ ] **Aparelho com o WhatsApp de cada número** à mão para parear (QR ou código, §1.3).
      *Não use o número pessoal de um vendedor*: números são da escola (doc 08 §governança).
- [ ] `CRON_SECRET` definido: protege todos os crons do compose e o `/api/whatsapp/health`.

O motor envia o texto dos templates como está (sem aprovação externa); a régua preenche as
variáveis. Enquanto `WHATSAPP_LIVE` estiver vazio, tudo que passaria vira `SIMULADA` (§6).

## 1. Deploy (VPS) — gap A1
Pré-requisitos: VPS Linux com Docker + compose plugin; DNS do domínio → IP da VPS.
```bash
git clone https://github.com/diogenesmendes01/erp-genius /opt/erp-genius
cd /opt/erp-genius
cp deploy/env.production.example .env   # preencher (segredos: openssl rand -hex 32 — HEX é URL-safe)
```
> **Escolha o caminho AGORA — não rode os dois.** Vai trazer o banco atual? Pule o `up`
> abaixo e siga direto para **§1.2** (o quickstart migra um schema vazio e o restore
> posterior colidiria). Instalação limpa (sem dados a importar): use o **§1.1**.

O compose sobe: **Postgres** (interno, SEM porta pública — só o banco `erp`; gap A5) →
**migrate** (`prisma migrate deploy`, aditivo) → **app** (Next standalone) → **motor**
(`image: ${MOTOR_IMAGE}`, `MOTOR_MODE: servico`, porta 4317 só na rede interna — doc 26: "fora
da internet pública"; dados em volume `motor_data:/data`) → os quatro laços de cron (§2) →
**Caddy** (única borda; TLS automático, `reverse_proxy app:3000` — o motor não passa por ele).
No Coolify (`docker-compose.coolify.yml`) é igual, sem Caddy: o Traefik do Coolify faz a borda.

### 1.1 Instalação nova (banco vazio)
```bash
docker compose -f docker-compose.prod.yml up -d
```
O serviço `migrate` cria o schema do zero antes do app subir. A imagem já foi construída no CI. Fim.

### 1.2 Migração do banco atual (traz dados)
O restore vai em banco **vazio, ANTES** de qualquer migration (dump completo por cima de
schema já migrado colide em constraints e deixa restauração parcial):
```bash
docker compose -f docker-compose.prod.yml up -d db      # SÓ o banco (cria erp vazio)
pg_dump -Fc "$DATABASE_URL_ATUAL" > antes.dump
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U erp -d erp --no-owner < antes.dump
docker compose -f docker-compose.prod.yml up -d  # AGORA a stack: migrate aplica só o delta (imagem do CI)
```
O dump carrega a tabela `_prisma_migrations`, então o `migrate deploy` aplica apenas as
migrations mais novas que o backup — fluxo determinístico. **Validar**: login + fila de
cobrança + contagem de alunos/cobranças contra o banco de origem.

Depois (em qualquer um dos caminhos, se o banco veio de um ambiente de teste do canal):
**reset do canal** (doc 26 §motores: "banco será resetado no go-live" = as tabelas do
CANAL, não o ERP) — truncar `MensagemWhatsApp`, `ConversaWhatsApp`, `IntencaoMensagem`,
`ContatoWhatsApp` e recadastrar os números reais na tela do canal. O banco antigo vira o
de DEV (ou é desligado) — dev e produção nunca mais compartilham banco (gap A5; em dev,
sem `WHATSAPP_LIVE=1` nada dispara de verdade).

### 1.3 Motor e conexão dos números (depois da stack de pé)
- **Webhook do motor**: nada a configurar à mão. O compose passa ao motor
  `ERP_WEBHOOK_URL: http://app:3000/api/whatsapp/webhook/motor` (rede interna — evento do
  WhatsApp nunca sai para a internet) e o ERP confere o HMAC com `MOTOR_WEBHOOK_SECRET`.
  O app fala com o motor em `MOTOR_URL: http://motor:4317` usando `MOTOR_API_KEY`.
- **Números**: em **Configuração › WhatsApp › Números** (só Administrador), cadastrar o número
  (todo número novo nasce com driver `MOTOR`) e usar **Conectar**: o modal tem as abas **QR** e
  **Código** (código de pareamento) e acompanha a sessão até `CONECTADO`.
- **Número legado** (`META_CLOUD`/`BAILEYS` vindos de antes da Fase 4): não envia nem recebe;
  converter ou desativar conforme `SETUP.md` §Números legados.

## 2. Cron — modelo de execução do despachante (gap A2)
Uma instância do app; concorrência interna resolvida por **claim atômico** na intenção
(`ENVIANDO` + prazo) com **recuperação de claim órfão** → `FALHOU` p/ fila humana (nunca
re-envia sozinho — o driver pode ter enviado antes da queda). O tick é EXTERNO e
idempotente (idempotência por degrau em banco).

> **Superado:** a versão anterior desta seção pedia um crontab **horário** de root na VPS
> (`5 * * * *` com `. ./.env`). Isso não é mais necessário nem recomendado: os próprios
> composes (`docker-compose.prod.yml` e `docker-compose.coolify.yml`) sobem os laços abaixo.
> Se a VPS ainda tiver aquela linha no crontab, remova-a (ela só duplicaria chamadas, que são
> idempotentes).

Serviços `cron*` do compose (imagem `curlimages/curl:8.10.1`, `restart: unless-stopped`,
`POST` com header `x-cron-secret: $CRON_SECRET` para `http://app:3000` na rede interna):
| Serviço | Rota | Intervalo | O que faz |
|---|---|---|---|
| `cron` | `/api/whatsapp/cron` | 5 min (`sleep 300`) | etapas de base: régua de cobrança, acesso, início de turmas, reservas, fechamento de comissões, lembretes de tarefas, alertas de SLA, Aria, dreno dos eventos do motor e uma passada do despachante |
| `cron-despacho` | `/api/whatsapp/despacho` | 1 min (`sleep 60`) | só drena a fila (inclui mensagens agendadas vencidas) |
| `cron-portal-envios` | `/api/portal-aluno/envios/cron` | 1 min (`sleep 60`) | e-mails do portal do aluno; com `EMAIL_PORTAL_ENVIO_ENABLED` ≠ `true` responde `{executou:false}` |
| `cron-avisos-agenda` | `/api/agenda/avisos/cron` | 5 min (`sleep 300`) | avisos de alteração de agenda; com `COMUNICACOES_AGENDA_ENVIO_ENABLED` ≠ `true` responde `{executou:false}` |

Cada laço fica numa linha só no compose (trava em `src/deploy/cron-despacho.test.ts`) e loga
`<nome> tick <status HTTP>`: `docker compose logs cron` (ou a aba Logs do Coolify) mostra
`cron tick 200`; `401` = `CRON_SECRET` divergente. `/api/financeiro/continuidade/cron` **não**
é agendado pelo compose (ver `SETUP.md`).
Com tick de 5 min (e despacho de 1 min), itens `ADIADA` (janela/teto/silêncio) re-tentam logo
que vencem. Rodar 2× não duplica nada — testado (`cron.int.test.ts`, `@@unique cobrancaId+passo`).

## 3. Monitoramento (gap A7)
`GET /api/whatsapp/health` (header `x-cron-secret`) → **200** saudável · **503** com a
lista de alertas no corpo. Cada estado da fila tem seu relógio (o contrato vive em
`saude.ts`); uma `ADIADA` esperando a janela abrir **não** é alerta — só o que já venceu:
| Alerta | Gatilho | Significado | Ação |
|---|---|---|---|
| intenção PENDENTE há Xh | PENDENTE despachável parada > 2h | tick não roda | checar os serviços `cron`/`cron-despacho` e `docker compose logs app` |
| intenção ADIADA venceu há Xh | `despacharAposEm` vencido > 2h sem redespachar | tick não roda | idem |
| envio em claim expirado | `ENVIANDO` além do prazo do claim > 30min | despachante/recuperação parados | idem |
| sessão do número "X" caiu | número `MOTOR` ativo em `CAIU` | WhatsApp desconectou (fila acumula, nada se perde) | reconectar (QR/código) em Configuração › WhatsApp › Números |
| número "X" ativo em driver legado | número ativo com driver ≠ `MOTOR` | não envia nem recebe | `SETUP.md` §Números legados |
| Motor WhatsApp inalcançável | consulta ao motor falhou | eventos recebidos não chegam | `docker compose logs motor`; um 503 isolado na janela do backup é esperado (§4) |
| N evento(s) falharam no motor | `GET /v1/eventos/falhos` do motor devolve eventos | eventos esgotaram as tentativas no motor | reenviar em `/v1/eventos/falhos` do motor |
| N envio(s) falharam 24h | transição p/ `FALHOU` nas últimas 24h | itens voltaram à fila humana com motivo | tratar na fila de cobrança |
| kill switch LIGADO | flag ligada | automação congelada de propósito | desligar quando o incidente passar |
Monitor externo (UptimeRobot/Better Stack): keyword/status check no endpoint a cada 5min
com o header, e um segundo check no domínio raiz (pega o app fora do ar).

## 4. Backup (gap A6) — o banco é o arquivo único das conversas
`scripts/backup-producao.sh` (diário via cron às 03:15, retenção 14d): dump do `erp`
(formato custom) + tar de `data/uploads` (mídia/comprovantes) + tar do volume do motor
(`/data`: PGlite, cofre e credenciais — perder = re-parear QR, mensagens não se perdem).
O motor fica parado só durante esse tar; um **503 isolado** de "Motor WhatsApp inalcançável"
em `/api/whatsapp/health` nesse horário é esperado (ver `SETUP.md` §backup). Só um 503 que se
repete depois da janela pede investigação.
**Backup sem teste de restore não é backup**: antes do go-live, executar o restore
comentado no rodapé do script num compose limpo e conferir login + fila + thread.
Guardar cópia fora da VPS (rsync/rclone para storage externo).

## 5. Segredos (gap A4)
Todos no `.env` da VPS (raiz do repo, fora do git; `chmod 600`) ou nas variáveis do Resource
no Coolify. Rotação: trocar valor → `docker compose up -d` (recria os serviços afetados; ao
trocar `MOTOR_API_KEY`/`MOTOR_WEBHOOK_SECRET`, app e motor juntos). As credenciais das sessões
do WhatsApp e a chave do cofre do motor moram no volume `motor_data` — vazamento = takeover do
número: acesso à VPS só por chave SSH, motor jamais exposto (sem `ports:` nos composes).

## 6. Rollout (doc 26 §rollout) + F34
1. **Shadow** (estado atual): `WHATSAPP_LIVE` vazio OU política em `SHADOW` — cron gera
   intenções `SIMULADA`; conferir 1 semana de "o que TERIA sido enviado" na fila.
2. **Apresentar o número (F34)**: antes do primeiro D-7 real, avisar as famílias pelo
   canal atual + pedir "salve este contato" — protege entrega/leitura (as métricas do
   V1) e o quality rating do número novo.
3. **Piloto**: `WHATSAPP_LIVE=1` + política `ATIVA` com **N alunos** (selecionar na fila
   e usar lote-com-aprovação; o cron desassistido só depois) · acompanhar `health` +
   métricas por degrau.
4. **Geral**: degraus D-7/D-3/D0 em `AUTOMATICO` na tela de políticas.
Freio em 1 clique: **kill switch** (Configuração › WhatsApp › Política da régua) congela a
automação sem cancelar nada.

## 7. Runbooks
- **Sessão do número caiu**: health alerta → Configuração › WhatsApp › Números → **Conectar**
  (QR ou código de pareamento) no celular do número. A fila drena sozinha no próximo tick.
- **Desligamento de vendedor (gap D30)**: (1) trocar `donoId` do número na tela do
  canal (Números → Editar); (2) desconectar o aparelho vinculado antigo (WhatsApp > aparelhos conectados);
  (3) se o número era pessoal do vendedor, migrar o contato comercial para número da
  escola — números são da escola (doc 08 §governança).
- **Número legado (Meta/Evolution)**: não há troca de driver pela tela — todo número novo
  nasce `MOTOR`. A conversão de um registro legado (mantendo conversas e histórico) está em
  `SETUP.md` §Números legados.

## 8. Pré-condições NÃO técnicas (decidir antes do geral — dono)
- **D23 base legal**: cláusula de comunicação/cobrança por WhatsApp no contrato de
  matrícula (novas matrículas) + registro de opt-in por finalidade para a base atual.
- **D25 retenção**: prazo de expurgo/anonimização de conversas de lead que nunca virou
  cliente (append-only ≠ conversa comercial eterna).
- **D21 matriz papéis × canal**: os papéis aplicados no código (doc 12 §WhatsApp) valem
  como default; revisar com o dono na semana do piloto.

## Relacionados
[`26`](26-whatsapp-v1.md) · [`28`](28-whatsapp-auditoria-gaps.md) (gaps A/D) ·
[`30`](30-whatsapp-spec-implementacao.md) (E5) · [`15`](15-decisoes-adr.md) (D33) ·
[`24`](24-cobrancas-regua-fluxo.md) (fila humana que recebe as falhas).
