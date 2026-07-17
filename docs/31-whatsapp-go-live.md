# 31 — WhatsApp: go-live (E5) — deploy, backup, monitoramento e rollout

> Executa a **E5** do [`30`](30-whatsapp-spec-implementacao.md): fecha os gaps **A1–A8**
> do [`28`](28-whatsapp-auditoria-gaps.md) e organiza a burocracia Meta + o rollout
> shadow → piloto → geral do [`26`](26-whatsapp-v1.md). Artefatos: `Dockerfile` ·
> `docker-compose.prod.yml` · `deploy/` · `scripts/backup-producao.sh` ·
> `GET /api/whatsapp/health`.

## 0. Burocracia Meta (dia 1 — corre em paralelo a tudo)
Caminho crítico com prazo de TERCEIRO (dias a semanas). Iniciar antes de qualquer infra:
1. **Business Manager** verificado (verificação do negócio — 1× por empresa; exige
   documento da empresa e site/telefone verificáveis).
2. **WABA** criada + **número novo de cobrança** registrado (o número sai do app do
   celular; histórico não migra — por isso número NOVO, doc 26 §motores).
3. **System user** com token permanente (`META_WA_TOKEN`) e o app com produto WhatsApp;
   anotar `phone_number_id` (vira `NumeroWhatsApp.providerRef`) e `WABA_ID`.
4. **Templates**: criar/submeter os 4 da régua (`amigavel · dados · vencida · firme`,
   categoria *utility*) pelo editor do ERP (E4) ou importar pelo mapeador se já existirem.
5. Enquanto isso não sai: canal roda em **shadow** e o braço manual (wa.me) segue operando.

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

O compose sobe, em ordem: **Postgres** (interno, SEM porta pública — bancos `erp` +
`evolution`, gap A5) → **migrate** (`prisma migrate deploy`, aditivo) → **app** (Next
standalone) → **Evolution API** (só na rede interna — doc 26: "fora da internet pública")
→ **Caddy** (única borda; TLS automático — o webhook da Meta exige HTTPS).

### 1.1 Instalação nova (banco vazio)
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
O serviço `migrate` cria o schema do zero antes do app subir. Fim.

### 1.2 Migração do banco atual (traz dados)
O restore vai em banco **vazio, ANTES** de qualquer migration (dump completo por cima de
schema já migrado colide em constraints e deixa restauração parcial):
```bash
docker compose -f docker-compose.prod.yml up -d db      # SÓ o banco (cria erp vazio)
pg_dump -Fc "$DATABASE_URL_ATUAL" > antes.dump
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U erp -d erp --no-owner < antes.dump
docker compose -f docker-compose.prod.yml up -d --build  # AGORA a stack: migrate aplica só o delta
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

### 1.3 Webhooks (depois da stack de pé)
- **Meta**: no app da Meta, apontar para `https://<dominio>/api/whatsapp/webhook/meta`
  com o `META_WA_VERIFY_TOKEN` do `.env`; assinar os campos `messages` e
  `message_template_status_update`.
- **Evolution**: configurado sozinho pelo fluxo "conectar via QR" da tela do canal
  (aponta para `http://app:3000/...` na rede interna — evento Baileys nunca sai para a
  internet).

## 2. Cron — modelo de execução do despachante (gap A2)
Uma instância do app; concorrência interna resolvida por **claim atômico** na intenção
(`ENVIANDO` + prazo) com **recuperação de claim órfão** → `FALHOU` p/ fila humana (nunca
re-envia sozinho — o driver pode ter enviado antes da queda). O tick é EXTERNO e
idempotente (idempotência por degrau em banco):
```cron
# crontab de ROOT na VPS — a cada hora; a política decide o resto.
# O crond NÃO herda o .env do compose: a própria linha carrega o arquivo (por isso o
# `. ./.env` — e por isso o .env precisa de chmod 600 e crontab de root, não de usuário).
5 * * * *  cd /opt/erp-genius && . ./.env && curl -sf -X POST -H "x-cron-secret: $CRON_SECRET" https://<dominio>/api/whatsapp/cron > /dev/null
```
Teste na mão antes de confiar no agendamento: rode a linha inteira no shell e confira
`{"executou": ...}` na resposta (401 = segredo não carregou).
Tick horário (não diário): itens `ADIADA` (janela/teto/silêncio) re-tentam na hora certa.
Rodar 2× não duplica nada — testado (`cron.int.test.ts`, `@@unique cobrancaId+passo`).

## 3. Monitoramento (gap A7)
`GET /api/whatsapp/health` (header `x-cron-secret`) → **200** saudável · **503** com a
lista de alertas no corpo. Cada estado da fila tem seu relógio (o contrato vive em
`saude.ts`); uma `ADIADA` esperando a janela abrir **não** é alerta — só o que já venceu:
| Alerta | Gatilho | Significado | Ação |
|---|---|---|---|
| intenção PENDENTE há Xh | PENDENTE parada > 2h | tick não roda | checar crontab e `docker compose logs app` |
| intenção ADIADA venceu há Xh | `despacharAposEm` vencido > 2h sem redespachar | tick não roda | idem |
| envio em claim expirado | `ENVIANDO` além do prazo do claim > 30min | despachante/recuperação parados | idem |
| sessão "X" caiu | número BAILEYS ativo em `CAIU` | Baileys desconectou (fila acumula, nada se perde) | reconectar via QR na tela do canal |
| N envio(s) falharam 24h | transição p/ `FALHOU` nas últimas 24h | itens voltaram à fila humana com motivo | tratar na fila de cobrança |
| kill switch LIGADO | flag ligada | automação congelada de propósito | desligar quando o incidente passar |
Monitor externo (UptimeRobot/Better Stack): keyword/status check no endpoint a cada 5min
com o header. Segundo check no domínio raiz (o webhook da Meta é suspenso após 5xx
repetidos — gap A8; o handler já responde 200 mesmo com erro interno, mas o monitor pega
o app fora do ar).

## 4. Backup (gap A6) — o banco é o arquivo único das conversas
`scripts/backup-producao.sh` (diário via cron, retenção 14d): dumps `erp` + `evolution`
(formato custom) + tar de `data/uploads` (mídia/comprovantes) + tar das instâncias da
Evolution (auth state Baileys — perder = re-parear QR, mensagens não se perdem).
**Backup sem teste de restore não é backup**: antes do go-live, executar o restore
comentado no rodapé do script num compose limpo e conferir login + fila + thread.
Guardar cópia fora da VPS (rsync/rclone para storage externo).

## 5. Segredos (gap A4)
Todos no `.env` da VPS (raiz do repo, fora do git; `chmod 600`). Rotação: trocar valor →
`docker compose up -d` (recria só o app). O auth state Baileys mora no volume da
Evolution + banco `evolution` — vazamento = takeover do número: acesso à VPS só por
chave SSH, Evolution jamais exposta.

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
Freio em 1 clique: **kill switch** (tela do canal) congela a automação sem cancelar nada.

## 7. Runbooks
- **Sessão Baileys caiu**: health alerta → tela do canal → "conectar via QR" → celular
  do dono do número escaneia. Fila drenou sozinha no próximo tick.
- **Desligamento de vendedor (gap D30)**: (1) trocar `donoId` do número na tela do
  canal; (2) desconectar o aparelho vinculado antigo (WhatsApp > aparelhos conectados);
  (3) se o número era pessoal do vendedor, migrar o contato comercial para número da
  escola — números são da escola (doc 08 §governança).
- **Trocar número de driver**: editar o número (tela do canal) — régua/inbox/histórico
  não mudam (o driver é atributo do número, doc 26).

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
