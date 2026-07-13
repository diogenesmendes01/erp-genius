# 30 — WhatsApp: spec de implementação (mestre)

> Consolida [`26`](26-whatsapp-v1.md) (escopo) + [`27`](27-comercial-automacoes-ia.md)
> (fase comercial) + [`28`](28-whatsapp-auditoria-gaps.md) (gaps) + [`29`](29-whatsapp-integracao-codigo.md)
> (mapa de integração) num plano executável por etapas. Em divergência de detalhe, vale
> este doc. Iniciado em 2026-07-06, branch `feat/whatsapp-v1`.

## Decisões fechadas nesta spec (pendências resolvidas)
| # | Decisão | Valor |
|---|---|---|
| S1 | **Trava do cron** (doc 26 §Em aberto) | **LIGADA como lei**: régua *automática* exige número driver oficial. Manual e lote-com-aprovação rodam em qualquer driver. Reversível só por código. |
| S2 | **Destinatário da cobrança** (gap 9) | Determinístico: responsável com vínculo `FINANCEIRO` e telefone (o mais antigo, se N); sem responsável cadastrado → `aluno.telefoneE164`; sem telefone algum → intenção **não nasce**, item vai à fila humana com motivo `sem_destino`. |
| S3 | **Fuso da janela de envio** (gap 11) | Janela avaliada em `Aluno.fuso ?? Pais.fuso ?? America/Sao_Paulo` do destinatário. Cron roda em UTC. |
| S4 | **Silêncio pós-inbound** (gap 13) | Inbound não tratado **suspende degraus automáticos do contato por 72h** (config `silencioPosInboundHoras`); tratar = registrar promessa/pagamento ou "retomar régua". |
| S5 | **Teto por contato** (gap 12) | Default **2 mensagens automáticas/contato/dia** somando políticas; intenção suprimida fica `adiada` (re-tenta no próximo dia), nunca descartada em silêncio. |
| S6 | **Vencimento alterado** (gap 14) | Para fins de régua, passos gravados **antes** da última alteração de vencimento são ignorados no replay (a régua "recomeça" da nova data). |
| S7 | **Dedupe inbound** (gap A8) | `providerMessageId` único por número; webhook responde 200 imediato e processa async. |
| S8 | **Shadow mode** | Global `modoShadow` (default **true**) + estado por política (`ativa/shadow/desligada`, default `desligada`). Despachante em shadow marca a intenção como `simulada`, nunca chama driver. |
| S9 | **Mídia (E1)** | Log de mensagem referencia mídia por caminho; download/armazenamento real (S3 vs disco) é decisão da E3 — E1 não trata binário. |
| S10 | **Opt-out (E1)** | Campo `optOutEm` no contato + lei no despachante. Captura (botão/keyword) é UI da E3. |

## Modelo de dados (Prisma — nomes finais)
Enums: `DriverWhatsApp (META_CLOUD, BAILEYS)` · `FinalidadeNumero (COBRANCA, VENDAS)` ·
`SessaoNumero (DESCONECTADO, AGUARDANDO_QR, CONECTADO, CAIU)` · `DirecaoMensagem (ENTRADA, SAIDA)` ·
`StatusMensagem (NA_FILA, ENVIADA, ENTREGUE, LIDA, FALHOU)` · `OrigemEnvio (HUMANO, CRON, LOTE)` ·
`StatusIntencao (PENDENTE, DESPACHADA, CANCELADA, FALHOU, ADIADA, SIMULADA)` ·
`StatusTemplate (RASCUNHO, EM_REVISAO, APROVADO, REJEITADO)` · `ModoDegrau (AUTOMATICO, MANUAL, LOTE)`.

Modelos: `NumeroWhatsApp` (telefoneE164 @unique, driver, finalidade, sessao, donoId?→Usuario,
credencialRef) · `ContatoWhatsApp` (telefoneE164 @unique, waId? @unique, alunoId?/responsavelId?/leadId?,
optOutEm?, nomeExibicao?) · `ConversaWhatsApp` (@@unique numeroId+contatoId, ultimaMensagemEm,
naoLidas) · `MensagemWhatsApp` (conversaId, direcao, tipo, corpo, midiaPath?, status, driver,
origem?, providerMessageId? — @@unique numeroId+providerMessageId, autorId?, templateId?,
timestamps) · `IntencaoMensagem` (numeroId, contatoId, corpoRenderizado, status,
cobrancaId?+passo? — @@unique cobrancaId+passo, politicaId?, origem, criadaEm, despacharAposEm?,
motivoFalha?, mensagemId?) · `TemplateWhatsApp` (nome @unique, corpo, variaveis, idioma, statusMeta,
metaTemplateId?, categoria) · `PoliticaRegua` (nome, escopo `COBRANCA`, estado ativa/shadow/desligada,
janelaInicio/janelaFim, diasSemana, tetoPorContatoDia, silencioPosInboundHoras, killSwitch,
numeroRemetenteId?) · `DegrauPolitica` (politicaId, passo, offsetDias, tipo, templateId?,
modo, ativo, @@unique politicaId+passo).
Índices novos: `@@index([telefoneE164])` em Aluno, Responsavel e Lead.

## Contratos
- **Porta** `CanalWhatsApp`: `enviarTexto(numero, para, corpo)` · `enviarTemplate(numero, para, template, variaveis)` ·
  `enviarMidia(...)` → `{ providerMessageId }` ou lança `ErroDriver(motivo)`. Drivers:
  `meta-cloud` (Graph API, env `META_WA_TOKEN`/`META_WA_PHONE_ID`), `evolution` (env
  `EVOLUTION_URL`/`EVOLUTION_APIKEY`). Só `despachante.ts` importa drivers.
- **Despachante** (ordem dos guard-rails, cada um com motivo auditável): kill switch →
  estado da política → trava S1 (automático⇒oficial) → opt-out → lei do inbound (inbound
  do contato após `criadaEm` ⇒ `CANCELADA`) → silêncio S4 → idempotência (`@@unique` +
  re-check `proximaAcao`) → teto S5 (⇒`ADIADA`) → janela/dias no fuso S3 (⇒`ADIADA`) →
  shadow (⇒`SIMULADA`) → driver → em `$transaction`: `MensagemWhatsApp` +
  `CobrancaEnviadaWhatsApp {modelo, passo, canal:"api"}` (`autorId:null`) + intenção
  `DESPACHADA`. Falha de driver ⇒ `FALHOU` + `motivoFalha` (item volta à fila humana).
- **Eventos**: mesmo `CobrancaEnviadaWhatsApp` com `canal` (versão 2); novos
  `OptOutRegistrado`, `NumeroWhatsAppConectado`, `SessaoBaileysCaiu`,
  `TemplateSubmetido/Aprovado/Rejeitado`, `PoliticaReguaAlterada {antes, depois}` —
  agregados novos no union de `_shared/evento.ts`. Atualizar docs/12 ao final da E1.

## Etapas
- **E1 — Fundação de dados + braço em shadow (esta etapa).** Schema + migration aditiva ·
  seed (política de fábrica = REGUA com D-7/D-3/D0 `AUTOMATICO`, D+3/D+7 `LOTE`, D+15 fora;
  4 templates com os textos migrados do client) · `proximaAcao` ganha `politica` ·
  `PASSOS_VALIDOS` deriva da política · `registrarCobrancaWhatsApp` ganha `canal:"manual"`
  (+ helper sem sessão) · módulo `src/server/whatsapp/` (porta, drivers, despachante,
  fila) · rotas cron (`CRON_SECRET`) e webhooks (assinatura Meta / token Evolution, dedupe,
  200-imediato) · testes. **Aceite:** cron em shadow gera intenções `SIMULADA` corretas
  contra dados reais sem enviar nada; testes verdes.
- **E2 — Fila de cobrança ligada ao braço.** Destinatário S2 na fila · `enfileirar` no
  lugar do wa.me (wa.me vira fallback) · chip "respondeu" · lote-com-aprovação · estado de
  entrega no drawer · regra S6 no replay · textos saem do client.
- **E3 — Inbox + sessão.** Conversas/thread/vínculo contato→pessoa · mídia (decisão de
  storage) · tela do número (QR Evolution, estado de sessão) · captura de opt-out ·
  notificação básica.
- **E4 — Templates ciclo Meta + config UI.** Mapeador (sync WABA) · editor com submissão →
  webhook de status · tela de políticas (estados, ensaio/shadow por política).
- **E5 — Go-live.** Deploy (VPS: app + Evolution + reverse proxy/TLS), WABA + verificação,
  backups, monitoramento mínimo, bancos por ambiente, piloto → geral (gaps A do doc 28).
- **E6 — Fase comercial** ([`27`](27-comercial-automacoes-ia.md), ondas C1+C2+C3): motor
  generalizado por âncora, auto-lead com dedupe (gap 17) e filtro (gap 18), IA copiloto.

## Fora desta spec
Tudo que os docs 26/27 estacionaram + os gaps de LGPD/papéis do doc 28 (D21–D30) que devem
ser resolvidos como pré-condição da E3/E5 — rastreados lá, não aqui.

## Relacionados
[`26`](26-whatsapp-v1.md) · [`27`](27-comercial-automacoes-ia.md) ·
[`28`](28-whatsapp-auditoria-gaps.md) · [`29`](29-whatsapp-integracao-codigo.md) ·
[`13`](13-convencoes-codigo.md) · [`12`](12-catalogo-de-eventos.md).
