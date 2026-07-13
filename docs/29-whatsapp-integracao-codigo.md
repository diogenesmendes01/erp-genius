# 29 — WhatsApp: mapa de integração com o código existente (anti-duplicação)

> Varredura de 2026-07-06 (6 leitores sobre o código + docs 26/27). Responde: **o que se
> reusa, o que muda, onde o sistema atualiza sozinho, e o que NÃO pode ser duplicado**.
> Complementa [`26`](26-whatsapp-v1.md)/[`27`](27-comercial-automacoes-ia.md) (o quê) com o
> *onde* no código. Paths/linhas refletem o código em 2026-07-06.

## Tese: a integração é cirúrgica
O doc 24 prometeu que trocar o braço não mudaria o cérebro — e o código cumpre. A régua
inteira já funciona como **projeção sobre eventos**: quem grava `CobrancaEnviadaWhatsApp
{ passo }` "avança" a fila, a ficha e o cérebro **sem tocar em nenhuma UI**. O WhatsApp
entra como: **1 parâmetro novo numa função, 1 campo novo num payload, ~8 arquivos
retocados, e 1 módulo novo isolado** (`src/server/whatsapp/`). Todo o resto acontece
sozinho, por projeção.

## O que NÃO se reescreve (fonte única, já testada)
| Peça | Onde | Papel no WhatsApp |
|---|---|---|
| `proximaAcao(entrada, hoje)` | `src/server/cobrancas/regua.ts:87` | O cron chama **exatamente esta função** para decidir disparos. Ganha 3º parâmetro `politica` (default = `REGUA` p/ compat; a `entrada` já embute o histórico). Backlog, degrau superado, promessa dormente: tudo já tratado e testado (`regua.test.ts`). |
| `montarReguaPorCobranca` | `src/server/cobrancas/consultas.ts:83` | Replay dos eventos → `passosFeitos`/`promessaAte`. Cron, fila e ficha do aluno leem **a mesma** projeção. |
| `registrarEvento(tx, …)` | `src/server/_shared/evento.ts:50` | Único caminho de gravação de evento; `autorId: null` = sistema/cron (já suportado). |
| `normalizarTelefoneE164` | `src/server/_shared/validacao.ts` | Única regra E.164 do sistema; o `wa_id` da Meta é o mesmo formato sem `+`. |
| Máquina de estados do lead | `src/server/_shared/regras.ts` (`transicaoManualPermitida`, `podeCheckinExperimental`) | Automação/IA **nunca** seta `lead.etapa` direto — passa pelas ações existentes. |
| `bloquearAcesso`/`desbloquearAcesso` | `src/server/cobrancas/acoes.ts:66/90` | Único caminho do D+15. O despachante **nunca** toca `Matricula.acessoBloqueado`. |
| Row-level do vendedor | `escopoLeads` (`comercial/consultas.ts:16`) e `exigirLeadVisivel` (privado em `comercial/acoes.ts:69` — **exportar** para reuso) | A inbox reusa para visibilidade de conversa vinculada a lead. |
| Pipeline de mídia | `lib/uploads.ts` + `/api/files/[...path]` + `podeLerArquivo` | Mídia de mensagem = 3º ramo em `podeLerArquivo`, não pipeline novo. |

## Módulo novo e fronteiras (docs/13)
```
src/server/whatsapp/
  schema.ts        Zod: política, template, número, intenção
  consultas.ts     inbox (conversas, thread), fila de intenções
  acoes.ts         "use server": enviar da inbox, aprovar lote, conectar QR, editar política
  canal.ts         porta CanalWhatsApp (enviarTexto/enviarMidia/enviarTemplate + eventos normalizados)
  drivers/meta-cloud.ts · drivers/evolution.ts
  despachante.ts   ÚNICO importador dos drivers; guard-rails; grava eventos de domínio
src/app/api/whatsapp/
  webhook/meta/route.ts       GET hub.challenge + POST c/ X-Hub-Signature-256
  webhook/evolution/route.ts  token compartilhado
  cron/route.ts               protegida por CRON_SECRET (header)
src/app/(app)/inbox/          UI (exigirSessaoPagina; entrada em src/lib/nav.ts)
```
**Fronteiras:** `whatsapp` importa *funções* de `cobrancas` (`proximaAcao`,
`montarReguaPorCobranca`) e `comercial` (criação de lead extraída); `cobrancas`/
`comercial`/`financeiro` **nunca** importam drivers/porta — só gravam intenção via função
pública (`enfileirarIntencao(tx, …)`). Webhooks/cron são as **primeiras rotas
machine-to-machine** do app: autenticação por assinatura/segredo, nunca sessão; handler só
normaliza e grava — regra de negócio fica no server/, como nas rotas atuais.

## Mudanças no código existente (a lista completa)
| Arquivo | Mudança |
|---|---|
| `cobrancas/regua.ts` | `proximaAcao` ganha `politica` (:87); `REGUA` (:21-28) vira **default de fábrica/seed** da entidade PoliticaRegua; `DegrauRegua.template` passa a referenciar a entidade Template; `ULTIMO_OFFSET` deriva da política. |
| `cobrancas/consultas.ts` | `PASSOS_VALIDOS` (:74) deriva da política; `montarReguaPorCobranca` (:83) carrega/recebe política; destino (:199) troca `aluno.telefoneE164` pela resolução responsável-financeiro (gap 9 do doc 28); `precisaBloqueio` `>=15` (:141) **fica hardcoded** (lei). |
| `financeiro/acoes.ts` | `registrarCobrancaWhatsApp` (:92-116): payload ganha `canal:"manual"`, `versao: 2`; **extrair o miolo** (gravação do evento) para helper sem `exigirSessaoComPapel` — o despachante grava o MESMO evento com `canal:"api"`, `autorId: null`. |
| `financeiro/schema.ts` | `MODELOS_WHATSAPP` (:46) vira seed da entidade Template (obs.: `promessa` nunca é usado pela régua — só os 4 entram no mapeador). |
| `FilaCobranca.tsx` | `mensagem()` (:48-57, textos hardcoded **no client**) morre — textos migram para a entidade Template no servidor; `enviar()` (:118-124) troca `window.open(wa.me)` por action `enfileirarCobrancaWhatsApp` (wa.me vira fallback secundário); chip **"respondeu"** (novo campo `respondeuEm` no `FilaCobrancaItem`); checkboxes + `aprovarLoteCobranca(ids, passo)`; **parar de importar `REGUA`** (:8) — a timeline do drawer (:408-424) passa a receber a régua do servidor, senão exibe régua diferente da que o cron executa. |
| `_shared/evento.ts` | Union `AgregadoTipo` (:8-22) ganha `NumeroWhatsApp`, `ContatoWhatsApp`, `TemplateWhatsApp` (Conversa/Mensagem **não** — ver regra 3). |
| `comercial/acoes.ts` | Extrair miolo de `criarLead` (:88-126) para `criarLeadDeInboundWhatsApp` (sem sessão, `autorId: null`): `gerarCodigo("lead")` + `LeadCriado`/`LeadAtribuido` + referral → `origemCampanha/Conjunto/Anuncio` (campos **já existem**, schema :468-470); dono = dono do NumeroWhatsApp. |
| `uploads/autorizacao.ts` | `podeLerArquivo` ganha 3º ramo: mídia referenciada por Mensagem → autorizado se dono do número da conversa ou papel financeiro/gerente/admin. |
| `lib/nav.ts` | Entrada "Inbox" role-aware. |
| `prisma/schema.prisma` | 7 entidades novas (abaixo) + `@@index` em `telefoneE164` de Aluno/Responsavel/Lead (hoje **sem índice** — matching seria full scan). |
| `docs/12` | Novos tipos de evento (opt-out, ciclo de template, sessão, auditoria do canal). |

## Entidades novas (tabelas próprias, não Evento)
`NumeroWhatsApp` (driver, finalidade, estadoSessao, donoId→Usuario) ·
`ContatoWhatsApp` (**telefoneE164 @unique — a primeira unicidade de telefone do sistema**,
waId, FKs opcionais aluno/responsavel/lead, optOutEm; é o embrião da entidade Pessoa que o
próprio schema anuncia no comentário da linha 5) ·
`ConversaWhatsApp` (@@unique numeroId+contatoId) ·
`MensagemWhatsApp` (status mutável na_fila→…→lida/falhou, driver, origem, providerMessageId
único = dedupe dos retries de webhook) ·
`IntencaoMensagem` (outbox; `@@unique([cobrancaId, passo])` = idempotência por degrau em
banco; `criadaEm` vs último inbound = lei do despachante) ·
`TemplateWhatsApp` (corpo, variáveis, idioma — casar com `Pais.idioma`, status do ciclo Meta) ·
`PoliticaRegua`/`DegrauPolitica` (a const REGUA como dado + janela/dias/kill switch/remetente).

## Onde o sistema atualiza SOZINHO (por projeção — zero código novo)
1. **Cron envia D-3** → despachante grava `CobrancaEnviadaWhatsApp {passo, canal:"api"}` →
   a fila humana (`listarFilaCobranca`), a timeline do drawer e a **ficha do aluno**
   (`ajustes/consultas.ts:120`) avançam sozinhas — todas leem a mesma projeção.
2. **Humano mandou ontem pelo wa.me** → o evento com `canal:"manual"` entra em
   `passosFeitos` → o cron de hoje **não repete o degrau** (idempotência de graça:
   `proximaAcao` nunca devolve passo já feito).
3. **Promessa registrada na inbox** (ação rápida chama `registrarPromessaPagamento`) →
   `proximaAcao` já trata `promessaAte` (regua.ts:91-97) → régua pausa sozinha, fila mostra
   "promessa" sem código novo.
4. **Pagamento dá baixa** → status PAGO tira da régua (filtro PENDENTE/ATRASADO).
5. **Qualquer evento novo no agregado Lead** → timeline da FichaLead projeta sem mudança
   (`comercial/consultas.ts:95` renderiza o log inteiro).
O que **não** atualiza sozinho (código novo consciente): chip "respondeu" na fila (consulta
ao log de Mensagem), estado de entrega no drawer, e a mescla mensagens+eventos na timeline
do lead.

## Fluxos ponta a ponta
- **F1 cron:** `cron/route.ts` (CRON_SECRET) → query de cobranças abertas (mesmo where de
  `listarFilaCobranca`) → `montarReguaPorCobranca` → degraus `modo=automático` e
  `tipo!=='bloquear'` → grava `IntencaoMensagem` → **despachante**: re-checa (inbound
  posterior? opt-out? teto? janela no fuso `Aluno.fuso ?? Pais.fuso`?) → driver do número →
  em transação: `MensagemWhatsApp` + `CobrancaEnviadaWhatsApp {passo, canal:"api"}`.
- **F2 inbound:** webhook valida assinatura → 200 imediato + processa async → dedupe por
  `providerMessageId` → `normalizarTelefoneE164` → resolve/cria `ContatoWhatsApp` +
  `ConversaWhatsApp` → grava `MensagemWhatsApp` → cancela intenções pendentes do contato
  (lei do despachante) → chip "respondeu"/não-lida.
- **F3 clique na fila:** action `enfileirarCobrancaWhatsApp` grava intenção
  (origem humano, prioridade imediata) → mesmo despachante, mesmos guard-rails.
- **F4 lote:** `aprovarLoteCobranca(ids, passo)` grava N intenções (o popup-block que
  adiava o lote no doc 24 morreu).
- **F5 lead novo (fase 27):** inbound sem contato → filtro não-conversacional →
  `criarLeadDeInboundWhatsApp` (referral→origem*) → política "lead novo" no **mesmo motor**.

## As 10 regras anti-duplicação (o contrato da implementação)
1. **Um cérebro.** O cron nunca recalcula "quem dispara hoje" com SQL próprio — importa
   `proximaAcao`/`montarReguaPorCobranca`. (Doc 27 idem: generalizar a âncora **neste**
   arquivo, nunca um "followUpEngine" paralelo.)
2. **Um evento.** Nunca criar `CobrancaEnviadaApi`/`MensagemEnviadaCobranca` — é o MESMO
   `CobrancaEnviadaWhatsApp` + `canal`. Evento paralelo = cron reenvia o que o humano já fez.
3. **Mensagem é tabela, não Evento.** Regra do docs/12 ("Evento = auditoria; tabela tipada
   = operacional"): status de mensagem é **mutável** e de alto volume — viola o append-only.
   Evento grava só fatos de negócio (degrau cumprido, opt-out, ciclo de template).
4. **Uma fonte de texto.** Os textos hoje estão **no client** (`mensagem()`,
   FilaCobranca.tsx:48-57 — o doc 24 dizia FinanceiroPainel/schema e está desatualizado).
   Migram para a entidade Template; wa.me manual e API renderizam **do mesmo** template.
5. **Uma identidade.** `normalizarTelefoneE164` única; destino sempre via FK
   `ContatoWhatsApp`, nunca telefone copiado como string em Cobranca/Intenção; a resolução
   responsável-financeiro é **uma função compartilhada** (fila, inbox, despachante).
6. **Um caminho de lead.** Nunca `tx.lead.create` solto no webhook — pula `Contador`
   (código L-), normalização e auditoria.
7. **Uma máquina de funil.** IA/automação mudam etapa via ações existentes (que emitem
   `TIPOS_MUDAM_ETAPA`) — update direto deixa `etapaDesde`/timeline mentirosas. IA escreve
   nos campos que **já existem** no Lead (resumo/temperatura/segmento, comentados "IA na
   Fase 1") via `atualizarResumo`/`editarLead` — nada de `resumoIA` paralelo.
8. **Guard-rails persistidos.** Idempotência (`@@unique cobrancaId+passo`), teto por
   contato e fila em **banco** — nunca o padrão `Map` em memória do `rate-limit-login.ts`
   (o próprio arquivo avisa que só vale em nó único).
9. **Um pipeline de evento.** Sempre `registrarEvento` na mesma transação; estender o
   union `AgregadoTipo` — nunca `tx.evento.create` com string livre.
10. **Um caminho de bloqueio e de mídia.** D+15 só via `bloquearAcesso` (alçada existente);
    mídia só via UPLOAD_DIR + `/api/files` + ramo novo em `podeLerArquivo`.

## Achados da varredura que corrigem os docs
- **Doc 24 desatualizado:** os textos dos templates estão em `FilaCobranca.tsx` (client),
  não em "FinanceiroPainel/schema". O modelo `promessa` existe no enum mas nenhum degrau o
  usa.
- **Gap 33 (doc 28) é menor do que parecia:** `dataExperimental` já tem hora +
  `professorExperimentalId`, e `agendarExperimental`/`checkinExperimental` já movem o funil
  com guardas. O que falta para o C2 é só estado de confirmação + histórico de
  reagendamento — não a entidade inteira.
- **Gap 9 confirmado no código:** o destino hoje é `aluno.telefoneE164`; o responsável
  financeiro aparece na ficha **só como nome** (`ajustes/consultas.ts:115`) e o vínculo
  `AlunoResponsavel FINANCEIRO` não tem unicidade — a regra determinística é obrigatória.
- **Gap 11 confirmado:** `Aluno.fuso` já existe com o comentário literal "envio de
  mensagens"; `Pais.fuso/idioma/ddi` idem. A janela por fuso do contato é implementável já.
- **`registrarCobrancaWhatsApp` não é idempotente hoje** (grava sem checar passo repetido)
  — a idempotência pertence ao despachante/`@@unique`, não a cada produtor.
- **`registrarInteracao`** (canal texto-livre) será substituído pelo log real de mensagens
  no canal WhatsApp; a timeline mescla, mantendo interação manual para ligação/presencial.

## Relacionados
[`26`](26-whatsapp-v1.md) · [`27`](27-comercial-automacoes-ia.md) ·
[`28`](28-whatsapp-auditoria-gaps.md) (gaps que este mapa localiza no código) ·
[`13`](13-convencoes-codigo.md) (fronteiras que o módulo novo segue) ·
[`12`](12-catalogo-de-eventos.md) (regra evento×tabela aplicada na regra 3).
