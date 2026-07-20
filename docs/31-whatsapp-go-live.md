# 31 — WhatsApp: go-live (E5) — deploy, backup, monitoramento e rollout

> Executa a **E5** do [`30`](30-whatsapp-spec-implementacao.md): fecha os gaps **A1–A8**
> do [`28`](28-whatsapp-auditoria-gaps.md) e organiza a burocracia Meta + o rollout
> shadow → piloto → geral do [`26`](26-whatsapp-v1.md). Artefatos: `Dockerfile` ·
> `docker-compose.prod.yml` · `deploy/` · `scripts/backup-producao.sh` ·
> `GET /api/whatsapp/health`.

## 0. Burocracia Meta (dia 1 — corre em paralelo a tudo)

Caminho crítico com prazo de TERCEIRO: a **verificação do negócio leva ~3–5 dias úteis** e
pode voltar para correção. **Começar por ela, antes de qualquer infra** — o resto do go-live
espera nela. Enquanto não sai: o canal roda em **shadow** e o braço manual (wa.me) opera
normalmente, então nada da operação para.

> Esta seção é **execução do dono** (exige a conta Meta da empresa, documentos e verificação
> de identidade). O ERP já está pronto para receber os valores — o mapa está no §0.4.

### 0.1 Antes de começar — tenha em mãos
- [ ] **Meta Business Manager** (business.facebook.com) com a empresa cadastrada e você como
      **administrador**.
- [ ] **Documento da empresa**: registro/CNPJ + comprovante com **nome e endereço idênticos**
      ao cadastro no Business Manager (divergência é a causa nº 1 de rejeição).
- [ ] **Site da escola no ar**, com nome da empresa e forma de contato visíveis; e-mail
      corporativo no mesmo domínio ajuda.
- [ ] **Número NOVO para a cobrança**, capaz de receber **SMS ou ligação**, e que **não esteja
      ativo no app do WhatsApp**. Se já tiver conta WhatsApp, é preciso **excluir a conta
      daquele número** antes de registrá-lo na WABA — o histórico **não migra** (doc 26).
      *Não use o número de vendas atual*: ele continua no Baileys/app do vendedor.
- [ ] **Domínio com HTTPS** para o webhook — depende do deploy (§1). Pode ser feito em
      paralelo, mas o webhook só é configurável depois que a stack estiver no ar.

### 0.2 Ordem de execução (o que trava o quê)
| # | Passo | Depende de | Prazo típico |
|---|---|---|---|
| 1 | **Verificação do negócio** no Business Manager | documentos (§0.1) | **3–5 dias úteis** |
| 2 | **App Meta** + produto **WhatsApp** (developers.facebook.com) | — (pode em paralelo ao 1) | minutos |
| 3 | **WABA** + registrar o número de cobrança (SMS/voz) | 2 (e 1, para limites melhores) | ~1h |
| 4 | **System user** + **token permanente** | 2, 3 | minutos |
| 5 | **Webhook** apontando para o ERP | deploy §1 no ar (HTTPS) | minutos |
| 6 | **Templates** submetidos e aprovados | 4, 5 | horas a dias |

**Token: nunca use o token temporário de teste em produção.** O token de desenvolvedor
expira em 24h e derruba o canal — o de produção é o **system user token** (permanente).
Permissões necessárias: **`whatsapp_business_messaging`** (enviar/receber) **e
`whatsapp_business_management`** (gerir templates). Sem a segunda, o mapeador e o editor de
templates da E4 quebram na Graph API.

### 0.3 Enquanto a verificação não sai
Dá para desenvolver e ensaiar tudo: **número de teste da Meta** (limitado a 5 destinatários
whitelistados) + `WHATSAPP_LIVE` vazio (tudo `SIMULADA`). As telas, o cron, a inbox e as
réguas funcionam ponta a ponta em ensaio.

### 0.4 Mapa: o que a Meta te dá → onde entra no ERP
| Valor | Onde pegar | Onde entra |
|---|---|---|
| Token permanente | System user → *Gerar token* (com as 2 permissões acima) | `META_WA_TOKEN` (`.env`) |
| App Secret | App Meta → *Configurações › Básico* | `META_WA_APP_SECRET` (`.env`) — valida a assinatura do webhook |
| Verify token | **você inventa** (string aleatória) | `META_WA_VERIFY_TOKEN` (`.env`) **e** cola no painel do webhook |
| WABA ID | Business Manager → *Contas do WhatsApp* | `META_WA_WABA_ID` (`.env`) — usado pelos templates |
| `phone_number_id` | WABA → o número registrado | **não é env**: vai no campo de referência do número em `/configuracao/whatsapp` |
| URL do webhook | você configura na Meta | `https://<dominio>/api/whatsapp/webhook/meta` |
| Campos do webhook | assinar na Meta | **`messages`** e **`message_template_status_update`** |

### 0.5 Como validar cada etapa (com o que já existe no ERP)
1. **Webhook**: ao salvar na Meta, ela chama o `GET` de verificação — se o `META_WA_VERIFY_TOKEN`
   bater, a rota devolve o `hub.challenge` e a Meta aceita. Erro aqui = token divergente.
2. **Token/permissões**: na tela do canal, clique em **"Sincronizar com a Meta"** (mapeador da
   E4). Se listar os templates, o token e o `WABA_ID` estão certos; se falhar, falta a
   permissão `whatsapp_business_management`.
3. **Número**: cadastre-o em `/configuracao/whatsapp` com o `phone_number_id` na referência.
4. **Canal**: `GET /api/whatsapp/health` (header `x-cron-secret`) → 200 = saudável.
5. **Primeira mensagem real**: só depois do §6 (rollout), com `WHATSAPP_LIVE=1`.

### 0.6 Armadilhas que causam rejeição/atraso
- Nome/endereço do documento **diferente** do cadastro no Business Manager.
- Site fora do ar, sem nome da empresa ou sem contato.
- Número **ainda ativo no app do WhatsApp** ao tentar registrar na WABA.
- Usar o **token de 24h** em produção (canal cai no dia seguinte).
- Faltar `whatsapp_business_management` (templates não sincronizam).
- Webhook sem HTTPS válido, ou devolvendo **5xx repetido** — a Meta **suspende a entrega**
  (por isso o handler responde 200 mesmo com erro interno — gap A8).
- Submeter template de cobrança como *marketing*: use **categoria `utility`** (os 4 da régua
  já nascem assim no seed).

**Referências oficiais:** [Access Tokens](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/) ·
[Business phone numbers](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers) ·
[Cloud API (Postman)](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api)

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
