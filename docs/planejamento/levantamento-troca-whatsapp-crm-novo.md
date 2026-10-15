# Levantamento — troca completa do WhatsApp + base para o CRM novo

**Data:** 15/10/2026 · **Commit analisado:** `f8a9c0e` (`main`) · **Natureza:** somente análise. Nenhum arquivo do repositório foi alterado. Nenhum install, npm, npx ou pnpm foi executado.

**Método:**
- Leitura estática do código com `grep -n` e `cat -n`. As referências seguem o formato `arquivo:linha`.
- Para a camada SQL, as **438 migrations** de `prisma/migrations/*/migration.sql` foram aplicadas em ordem num **Postgres 16 descartável**:
  - cluster próprio, criado só para isto (`/var/lib/postgresql/levantamento_wa`, porta 55432);
  - fora da lista de perfis de teste e fora do cluster compartilhado.
- Todas aplicaram sem erro. Funções, triggers, FKs, CHECKs e índices foram conferidos em `pg_proc.prosrc`, `pg_trigger`, `pg_constraint` e `pg_indexes`.
- Ao final o cluster foi parado e removido.

> **Documento de referência não encontrado.** `remocao-crm-levantamento-dependencias.md` não existe no `main`, em nenhum dos branches remotos nem nos PRs abertos (#177–#180). O formato aqui segue a descrição do pedido: referências `arquivo:linha`, tabelas, seção "não verificado" e, na Parte 7, riscos e decisões, como a "seção 5" do levantamento anterior. A Parte 6 foi validada direto no código, sem o documento base. O PR #179 (`docs/guia-dev-fluxo-crm.md`) foi usado como apoio.

---

## 0. Resumo executivo

1. **O ponto único de envio já existe.**
   - Toda mensagem que sai pela API passa por `despacharFila()` (`src/server/whatsapp/despachante.ts:79`). A chamada ao provedor fica em `despachante.ts:477-502`, pelo mapa `DRIVERS` (`:31-34`).
   - A porta é a interface `CanalWhatsApp` (`src/server/whatsapp/canal.ts:50-54`), com 3 métodos. Nenhuma automação chama driver direto: todas gravam `IntencaoMensagem` (a outbox).
   - **O motor novo entra como um driver novo dessa porta**, mais uma rota de entrada que normaliza para `InboundNormalizado` e `StatusNormalizado` (`inbound.ts:22-41, 205-212`).
2. **Duas regras de negócio estão presas à Meta e param com um motor só-Baileys:**
   - **Trava S1:** a régua de cobrança automática só roda em `META_CLOUD` (`cron.ts:55-56`, `despachante.ts:192-199`).
   - **Avisos de agenda:** exigem número `META_CLOUD` com template *utility* aprovado (`comunicacoes-agenda/whatsapp.ts:95-96`, `acoes.ts:726`).
   - É uma decisão de negócio (ver §7).
3. **O modelo atual não é "uma conversa por contato".**
   - `ConversaWhatsApp` é única por **(número, contato)** (`schema.prisma:2350`).
   - O Inbox lista **atendimentos**: o `?c=` é o id do atendimento (`acoes.ts:271`, `consultas-inbox.ts:79-120`).
   - Já existem vários atendimentos por conversa, com `contextoChave` (`schema.prisma:429`).
4. **Há regras jurídicas e pedagógicas no banco.** Quatro triggers PL/pgSQL em `AtendimentoWhatsApp` e `IntencaoMensagem` garantem:
   - autorização acadêmica vigente;
   - o WhatsApp atual do aluno;
   - a imutabilidade dos contextos financeiro e pedagógico.

   O motor novo não precisa delas, mas o **novo modelo de Atendimento precisa preservá-las ou reimplementá-las**.
5. **Infraestrutura:**
   - não há tempo real: o Inbox faz polling de 30 s;
   - não há fila externa: tudo roda por cron HTTP a cada 5 min, e é o único agendado;
   - não há outbox de eventos: `Evento` é só auditoria;
   - a instância atende **uma escola** (sem multi-tenant);
   - os arquivos ficam em disco local.
6. **A casca do CRM sai sem tocar em schema nem em SQL.** Mas "só apagar" quebra a compilação. Quatro itens da lista estão presos à base:
   - `linha-comercial.ts` **é base** do Inbox;
   - `src/server/ia` é importada por `comercial/acoes.ts` e `consultas-inbox.ts`;
   - `CockpitLead` é uma função dentro de `InboxCliente.tsx`;
   - o auto-lead mora em `comercial/captura.ts`, não no `inbound.ts`.
7. **Não existe linha de base de testes executável neste ambiente:** não há `node_modules`, e a instalação é vedada pelo `AGENTS.md` (§5.10).

---

## Parte 1 — Inventário do WhatsApp atual

### 1.1 Enums (`prisma/schema.prisma`; os valores foram conferidos em `pg_enum`)

| Enum | Linha | Valores | Origem |
|---|---|---|---|
| `FinalidadeAtendimentoWhatsApp` | 393 | COMERCIAL, FINANCEIRO, SECRETARIA, PEDAGOGICO | `20260907010000_politica_acesso_recebimentos:8` |
| `DriverWhatsApp` | 2260 | META_CLOUD, BAILEYS (a Evolution é a implementação do BAILEYS) | `20260706183913_whatsapp_canal_bimotor:2` |
| `FinalidadeNumero` | 2265 | COBRANCA, VENDAS, AGENDA | bimotor:5; AGENDA em `20260916163000:4` |
| `SessaoNumero` | 2271 | DESCONECTADO, AGUARDANDO_QR, CONECTADO, CAIU | bimotor:8 |
| `DirecaoMensagem` | 2353 | ENTRADA, SAIDA | bimotor:11 |
| `TipoMensagem` | 2358 | TEXTO, IMAGEM, AUDIO, VIDEO, DOCUMENTO, OUTRO | bimotor:14 |
| `StatusMensagem` | 2367 | NA_FILA, ENVIADA, ENTREGUE, LIDA, FALHOU | bimotor:17 |
| `OrigemEnvio` | 2375 | HUMANO, CRON, LOTE, GESTAO | bimotor:20; GESTAO em `20260831150000:5` |
| `StatusIntencao` | 2413 | PENDENTE, ENVIANDO, DESPACHADA, CANCELADA, FALHOU, ADIADA, SIMULADA | bimotor:23; ENVIANDO em `20260713173011:2` |
| `StatusTemplate` | 2500 | RASCUNHO, EM_REVISAO, APROVADO, REJEITADO | bimotor:26 |
| `ModoDegrau` | 2527 | AUTOMATICO, MANUAL, LOTE | bimotor:29 |
| `EstadoPolitica` | 2533 | DESLIGADA, SHADOW, ATIVA (também usado em `ConfigComercial.saudacaoEstado`/`gestaoEstado`) | bimotor:32 |
| `CanalAvisoAlteracaoAgenda` (agenda) | 2122 | EMAIL, WHATSAPP | `20260916154000:1` |

**Não existem** tabelas ou enums de opt-in, janela, fila, webhook, mídia ou provedor:
- **Opt-out:** coluna `ContatoWhatsApp.optOutEm` (`:2321`). O opt-in de agenda é `Aluno.aceitaComunicacoes` (`:1123`).
- **Janela de horário:** `PoliticaRegua.janelaInicio/Fim` e `PoliticaComercial.janelaInicio/Fim`.
- **Fila:** a própria `IntencaoMensagem`.
- **Mídia:** o texto `midiaPath`, que guarda a URL `/api/files/...`.

### 1.2 Models

| Model | Linha | Campos-chave | Unicidades / índices | Observação |
|---|---|---|---|---|
| **NumeroWhatsApp** | 2278 | telefoneE164, rotulo, driver, finalidade, providerRef, sessao, donoId, ativo | `telefoneE164` UNIQUE; `(driver, providerRef)` UNIQUE (2302) | `providerRef` = phone_number_id (Meta) ou nome da instância (Evolution) |
| **ContatoWhatsApp** | 2305 | telefoneE164, waId, nomeExibicao, nomePerfil, nomeEditadoEm, alunoId, responsavelId, leadId, optOutEm | `telefoneE164` UNIQUE; `waId` UNIQUE | **Contato único global por telefone** |
| **ConversaWhatsApp** | 2328 | numeroId, contatoId, ultimaMensagemEm, ultimoInboundEm, inboundTratadoEm, capturadaEm, naoLidas | `(numeroId, contatoId)` UNIQUE (2350) | É uma conversa **por número × contato**, não por contato |
| **AtendimentoWhatsApp** | 400 | conversaId, contextoChave, finalidade, responsavelId (Usuario/operador), leadId, alunoId, matriculaId, autorizacaoComunicacaoAcademicaId, turmaId, encerradoEm, ultimaMensagemEm, ultimoInboundEm, inboundTratadoEm, naoLidas | `(conversaId, contextoChave)` UNIQUE (429); idx leadId, alunoId, matriculaId, autorização | Não tem prazo/SLA nem status além de `encerradoEm` |
| **ParticipanteAtendimentoWhatsApp** | 436 | atendimentoId, usuarioId, concedenteId (sem FK), inicio, fim, revogadoEm, podeEnviar, motivo | idx `(atendimentoId, usuarioId, fim)`; CHECK `Participante_periodo` | **Nenhum código de produção cria participantes**: só os testes |
| **MensagemWhatsApp** | 2382 | atendimentoId, conversaId, numeroId, direcao, tipo, corpo, midiaPath, status, statusEm, driver, origem, providerMessageId, autorId, templateId | `(numeroId, providerMessageId)` UNIQUE (2409, dedupe de webhook); idx `(conversaId, criadoEm)` | É uma tabela, não um Evento (doc 29, regra 3) |
| **IntencaoMensagem** (outbox) | 2425 | origem, status, tipo, corpoRenderizado, variaveis, midiaPath, numeroId, contatoId, atendimentoId, templateId, cobrancaId+passo+cicloCobranca, referenciaCobranca, politicaId, leadId+politicaComercialId+passoComercial+ocorrenciaComercial, avisoAlteracaoAgendaId, reativa, despacharAposEm, validaAte, despachadaEm, motivoFalha, mensagemId, autorId | `(cobrancaId, passo, cicloCobranca)` UNIQUE; `avisoAlteracaoAgendaId` UNIQUE; `mensagemId` UNIQUE; **parcial** `IntencaoMensagem_comercial_degrau_key` (só no SQL); idx `(status, despacharAposEm)`; CHECK `cicloCobranca >= 0` | É a fila única de todas as automações |
| **TemplateWhatsApp** | 2509 | nome, corpo, idioma, categoria, statusMeta, metaTemplateId | `nome` UNIQUE | O ciclo de aprovação é da Meta |
| **PoliticaRegua** / **DegrauPolitica** | 2542 / 2562 | estado, janela, diasSemana, tetoPorContatoDia, silencioPosInboundHoras, killSwitch, numeroRemetenteId / passo, offsetDias, modo, templateId | `nome` UNIQUE / `(politicaId, passo)` UNIQUE | Régua de **cobrança** (fica) |
| **PoliticaComercial** / **DegrauComercial** | 2591 / 2617 | chave, janela, teto, silêncio, modoPiloto, pilotoLeadIds (sem FK) / offsetMinutos, toleranciaMinutos, templateId | `chave` UNIQUE / `(politicaId, passo)` UNIQUE | Réguas comerciais (casca) |
| **ConfigComercial** (singleton `"comercial"`) | 2634 | autoLeadAtivo, saudacao*, checkInToleranciaMinutos, copiloto*, matriculaAutomaticaAtiva, gestao* | — | Mistura campos da casca com campos usados pela base (`checkInToleranciaMinutos`, `matriculaAutomaticaAtiva`) |

Colunas do núcleo com semântica de WhatsApp, **sem FK**:
- `Aluno.whatsapp` (`:1122`), lido pelo trigger 265;
- `Aluno.aceitaComunicacoes` (`:1123`);
- `Lead.waReferral*` (`:1346-1350`);
- `Cobranca.cicloRegua` (`:1919`), com CHECK;
- `Cobranca.linkPagamento/linkEnviadoEm` (`:1943-1944`);
- `Matricula.contratoEnviadoEm` (`:1832`);
- `Lead.aguardandoReagendamentoEm` (`:1373`);
- `TentativaAvisoAlteracaoAgenda.provedorId` (`:2222`), texto com o id do provedor;
- `AvisoAlteracaoAgenda.contatoHash` (`:2149`).

### 1.3 FKs entre o WhatsApp e o núcleo (conferidas em `pg_constraint`)

**(a) Do WhatsApp para o núcleo (16)**

| Origem.coluna | Destino | ON DELETE | Schema |
|---|---|---|---|
| NumeroWhatsApp.donoId | Usuario | SET NULL | 2287 |
| ContatoWhatsApp.alunoId / responsavelId / leadId | Aluno / Responsavel / Lead | SET NULL | 2315 / 2317 / 2319 |
| MensagemWhatsApp.autorId | Usuario | SET NULL | 2402 |
| IntencaoMensagem.autorId | Usuario | SET NULL | 2484 |
| IntencaoMensagem.cobrancaId | Cobranca | SET NULL | 2449 |
| IntencaoMensagem.leadId | Lead | SET NULL | 2457 |
| IntencaoMensagem.politicaId / politicaComercialId | PoliticaRegua / PoliticaComercial | SET NULL | 2452 / 2464 |
| IntencaoMensagem.avisoAlteracaoAgendaId | AvisoAlteracaoAgenda | **RESTRICT** | 2445 |
| AtendimentoWhatsApp.responsavelId | Usuario | SET NULL | 407 |
| AtendimentoWhatsApp.leadId / alunoId / turmaId | Lead / Aluno / Turma | **RESTRICT** | 409 / 411 / 419 |
| AtendimentoWhatsApp.(matriculaId, alunoId) | Matricula(id, alunoId), FK composta | **RESTRICT** / RESTRICT | 413 |
| AtendimentoWhatsApp.autorizacaoComunicacaoAcademicaId | AutorizacaoComunicacaoAcademica | **RESTRICT** | 417 |
| ParticipanteAtendimentoWhatsApp.usuarioId | Usuario | **RESTRICT** | 441 |

Internas ao WhatsApp, todas RESTRICT, exceto template e mensagem, que são SET NULL:
- Conversa → Numero/Contato;
- Mensagem → Numero/Conversa/Atendimento;
- Intencao → Numero/Contato/Atendimento;
- Participante → Atendimento.

**(b) Do núcleo para o WhatsApp (7)**

| Origem.coluna | Destino | ON DELETE | Schema |
|---|---|---|---|
| ConfiguracaoOperacional.numeroAvisosAgendaId | NumeroWhatsApp | **RESTRICT** | 30-31 |
| ConfiguracaoOperacional.templateAvisosAgendaId | TemplateWhatsApp | **RESTRICT** | 32-33 |
| PoliticaRegua.numeroRemetenteId | NumeroWhatsApp | SET NULL | 2554 |
| DegrauPolitica.templateId | TemplateWhatsApp | SET NULL | 2573 |
| PoliticaComercial.numeroRemetenteId | NumeroWhatsApp | SET NULL | 2602 |
| DegrauComercial.templateId | TemplateWhatsApp | SET NULL | 2629 |
| ConfigComercial.gestaoNumeroId | NumeroWhatsApp | SET NULL | 2664 |

**Não existem** `Lead.conversaId`, `Cobranca.mensagemId` nem FKs de agenda, portal ou continuidade para `MensagemWhatsApp`.

O vínculo com a agenda é indireto: `IntencaoMensagem → AvisoAlteracaoAgenda → ItemAvisoAlteracaoAgenda → EncontroAgenda`.

**Impacto do descarte de dados (ambiente de teste):**
- Para apagar as tabelas de WhatsApp é preciso apagar primeiro `IntencaoMensagem` e depois `MensagemWhatsApp`.
- Os RESTRICT de `ConfiguracaoOperacional` exigem anular `numeroAvisosAgendaId` e `templateAvisosAgendaId` antes.
- Nas FKs que saem do WhatsApp, o RESTRICT só bloqueia o apagamento do **núcleo**; não bloqueia o do WhatsApp.

### 1.4 Funções e triggers SQL que leem tabelas de WhatsApp

Conferido em `pg_proc.prosrc`: das 587 funções do schema `public`, só 5 citam o WhatsApp.

| Função (última definição) | Trigger | Lê | Regra |
|---|---|---|---|
| `validar_contexto_financeiro_atendimento_whatsapp` (`20260918180000_autorizacao_atendimento_pedagogico:19`) | BEFORE INSERT OR UPDATE ON `AtendimentoWhatsApp` | ConversaWhatsApp, ContatoWhatsApp, AutorizacaoComunicacaoAcademica, Matricula, AlunoResponsavel | FINANCEIRO exige matrícula explícita e tem contexto imutável. PEDAGOGICO de aluno exige matrícula e, se o contato for responsável, autorização vigente (papel PEDAGOGICO), com `FOR SHARE`. Contexto pedagógico imutável. Proíbe reclassificar para FIN ou PEDAG |
| `validar_destino_direto_pedagogico_atual_265` (`20260918190000_destino_pedagogico_atual:4`) | BEFORE INSERT ON `AtendimentoWhatsApp` | ConversaWhatsApp, ContatoWhatsApp, Matricula, **Aluno.whatsapp/telefoneE164** | Pedagógico direto ao aluno exige que o telefone do contato seja o WhatsApp atual do aluno |
| `validar_intencao_pedagogica_264` (`20260918180000:119`) | BEFORE INSERT OR UPDATE ON `IntencaoMensagem` | AtendimentoWhatsApp, ConversaWhatsApp, ContatoWhatsApp, Autorização, Matricula, AlunoResponsavel | Intenção pedagógica não troca de atendimento, número ou contato. Com status PENDENTE, ADIADA ou ENVIANDO, revalida a autorização e o vínculo |
| `validar_intencao_destino_direto_pedagogico_atual_265` (`20260918190000:50`) | BEFORE INSERT OR UPDATE ON `IntencaoMensagem` | AtendimentoWhatsApp, ConversaWhatsApp, ContatoWhatsApp, Matricula, Aluno | Igual à 265, só que no momento do envio |
| `guard_identidade_destinatario_aviso_agenda` (`20260916174000:15`) | BEFORE INSERT OR UPDATE ON `AvisoAlteracaoAgenda` | (só o literal `'WHATSAPP'`) | No canal WhatsApp, exatamente um destinatário; se for responsável, exige autorização acadêmica |

- **Nenhuma função do financeiro, da agenda, do acesso ou do comercial lê tabelas de WhatsApp.** A dependência é só no sentido inverso: os guards do WhatsApp leem o núcleo.
- O despachante converte erro de trigger em `CANCELADA autorizacao_academica_revogada` (`despachante.ts:445-450, 682-684`).
- **CHECKs:** só `Participante_periodo` (`fim > inicio`) e `IntencaoMensagem_cicloCobranca_check`.
- **Índices parciais relevantes:**
  - `IntencaoMensagem_comercial_degrau_key` (`20260720180000:21-26`);
  - `AvisoAgenda_whatsapp_aluno_unico` e `AvisoAgenda_whatsapp_responsavel_unico` (`20260916174000:8,11`).
- Não há VIEW, RLS nem seed de WhatsApp nas migrations.

### 1.5 Migrations de WhatsApp (31, em ordem)

| Fase | Migrations | Conteúdo |
|---|---|---|
| Base bimotor | `20260706183913_whatsapp_canal_bimotor`, `…184221_provider_ref_variaveis`, `20260713173011_intencao_status_enviando`, `…231338_e3_inbox_midia`, `20260714120000_numero_provider_ref_unico_por_driver`, `…200000_intencao_atualizado_em` | 8 tabelas, 11 enums, outbox, mídia, claim ENVIANDO |
| Comercial (casca) | `20260718120000…200000` (5), `20260720120000…180000` (4), `20260831120000…150000` (4) | auto-lead, saudação, `capturadaEm`, referral, PoliticaComercial/Degrau, idempotência parcial, piloto, SugestaoIA, fechamento C4, gestão C5 |
| Atendimento / acesso | `20260907010000_politica_acesso_recebimentos`, `20260908050000_ciclo_cobranca_retomada`, `20260915141000_atendimento_whatsapp_matricula`, `20260918180000_autorizacao_atendimento_pedagogico`, `20260918190000_destino_pedagogico_atual` | AtendimentoWhatsApp, Participante, ciclo da régua, triggers 264 e 265 |
| Agenda | `20260916154000`, `…163000`, `…174000`, `…176000` | canal WHATSAPP, número AGENDA, unicidade por destinatário |
| Contato | `20260929120000_contato_whatsapp_nome_perfil` (com backfill), `20260929130000_contato_whatsapp_nome_editado` | É a última migration do repositório |

### 1.6 Classificação de `src/server/whatsapp/*`

São 31 arquivos de produção (6.198 linhas) e 12.658 linhas contando os testes.

| Categoria | Arquivos (linhas) | Observações |
|---|---|---|
| **TRANSPORTE** | `canal.ts` (54), `drivers/meta-cloud.ts` (119), `drivers/evolution.ts` (88), `evolution-jid.ts` (51), `sessao.ts` (198), `meta-templates.ts` (288) | `sessao.ts` também grava os eventos `NumeroWhatsAppConectado`/`SessaoBaileysCaiu` (`:60-92`) |
| **DOMÍNIO** | `identidade.ts` (56), `atendimentos.ts` (84), `historico.ts` (111, BAILEYS fixo em `:42, :85`), `nome-contato.ts` (44), `destinatario-atual.ts` (79) | `destinatario-atual.ts` também é usado pela automação |
| **AUTOMAÇÃO** | `despachante.ts` (722), `fila.ts` (195), `cron.ts` (139, só cobrança), `alcance-regua.ts` (95), `elegibilidade.ts` (72), `destinatario-financeiro.ts` (102), `render.ts` (45) | No `despachante.ts`, as linhas `:31-34`, `:417-426` e `:473-502` são transporte; `:263-357` e `:540-548` são comercial |
| **INBOX** | `escopo.ts` (103), `busca-inbox.ts` (84), `consultas-inbox.ts` (255) | `consultas-inbox.ts` mistura `janela24h` (Meta), `leadNaThread` (comercial e IA) e `cobrancaAtivaDoAtendimento` (financeiro) |
| **CASCA COMERCIAL** | `cron-comercial.ts` (463), `cron-gestao.ts` (248) | — |
| **MISTOS** | `inbound.ts` (260), `midia.ts` (215), `acoes.ts` (1091), `operacoes-atendimento.ts` (304), `linha-comercial.ts` (171), `consultas.ts` (162), `saude.ts` (150), `schema.ts` (150) | Detalhe abaixo |

Detalhe dos arquivos mistos:
- **`inbound.ts`:** o domínio fica em `:55-114` e `:178-239`. A automação fica em `:116-127` (conversa viva) e `:187-197` (saudação). O comercial fica em `:146-176`. O opt-out por palavra está em `:43-51` e `:129-144`.
- **`midia.ts`:** armazenamento em `:1-144`; download por provedor em `:146-215`.
- **`acoes.ts`:**
  - cobrança: `:69-232`;
  - Inbox: `:234-591`;
  - comercial: `:375-438`;
  - configuração de número e QR: `:602-787`;
  - templates Meta: `:789-896`;
  - política da régua: `:898-1091`.
- **`linha-comercial.ts`:** roteamento de atendimento em `:26-143` (base); visibilidade por dono em `:150-170`.

Fora do diretório, mas no mesmo fluxo:
- `src/server/comercial/captura.ts` (auto-lead, saudação e C2);
- `src/server/comunicacoes-agenda/whatsapp.ts`;
- `src/server/uploads/autorizacao.ts`;
- as rotas em `src/app/api/whatsapp/*`.

---

## Parte 2 — Tudo que envia mensagem

### 2.1 Caminhos de envio

| # | Caminho | Decisão de enviar | Até o provedor | Regras próprias | Disparo |
|---|---|---|---|---|---|
| 1 | **Régua de cobrança automática** (CRON) | `cron.ts:44` `rodarCronRegua` → `alcance-regua.ts:28` `decidirEnvioCron` | `fila.ts:40` `enfileirarIntencaoCobranca` → `despacharFila` (`cron.ts:137` e de novo em `route.ts:81`) | gates em `cron.ts:49-56` (política DESLIGADA, kill switch, sem número, **só META_CLOUD**); D+15 e degraus não AUTOMATICO ficam de fora (`alcance-regua.ts:36-38`); idempotência `(cobrancaId, passo, cicloCobranca)`; reabre só CANCELADA/SIMULADA (`fila.ts:66-87`) | `/api/whatsapp/cron` (5 min) |
| 2 | **Cobrança: botão "enviar"** (HUMANO) | `acoes.ts:173` `enfileirarCobrancaWhatsApp` (UI em `FilaCobranca.tsx:461`) | `acoes.ts:96` → `fila.ts:40` → `despacharFila({intencaoId})` (`acoes.ts:183`) | papéis FINANCEIRO ou SECRETARIA (`acoes.ts:74`); exige degrau devido (`:115`); HUMANO isento de kill switch, janela, teto, silêncio e shadow (vale só `WHATSAPP_LIVE`) | imediato |
| 3 | **Cobrança em lote** (LOTE) | `acoes.ts:199` `aprovarLoteCobranca` | `acoes.ts:209` → `fila.ts:40` → `despacharFila` por intenção (`:217-222`) | kill switch, janela, teto, silêncio e shadow valem; a trava S1 não vale | imediato; o que for ADIADA sai no tick |
| 4 | **Inbox: texto** | `acoes.ts:257` `enviarTextoInbox` | `intencaoMensagem.create` (`:268`) → `despacharIntencaoInbox` (`:246-247`) | escopo de envio, destinatário atual, número ativo, opt-out (`:259-266`); **sem checagem de 24h no servidor** (só indicador na UI) | imediato |
| 5 | **Inbox: mídia** | `acoes.ts:284` `enviarMidiaInbox` (upload em `/api/whatsapp/upload`) | `:309` → `despacharIntencaoInbox` | posse do arquivo (`midiaSaidaDoAutor`, `:299`); MIME, tipo e 10 MB (`midia.ts:19-51`); só `whatsapp-out/` (`midia.ts:127-143`) | imediato |
| 6 | **Saudação reativa** (1º inbound em número VENDAS) | `comercial/captura.ts:240` `capturarComercial` (chamada em `inbound.ts:149`) | intenção CRON `reativa:true` (`captura.ts:281-294`) → `despacharFila` (`inbound.ts:191-197`) | só VENDAS, só o 1º inbound, sem opt-out; `saudacaoEstado`; isenta de janela, teto, silêncio, S1 e template | webhook (imediato) |
| 7 | **Réguas comerciais** (lead novo, pré-experimental, no-show, contrato, link de pagamento) | `cron-comercial.ts:183/230/267/298/335` | `fila.ts:134` `enfileirarIntencaoComercial` → drenado em `route.ts:81` | política e allowlist do piloto (`:93-118`); `validaAte`; revalidação B7 no despacho (`despachante.ts:268-314`); unicidade parcial | `/api/whatsapp/cron` |
| 8 | **Gestão** (alerta de SLA e relatório do gestor) | `cron-gestao.ts:64` `rodarGestao` | `intencaoMensagem.create` (`:115, :165`) → `route.ts:81` | dedupe por Evento (`:85-97, :145-156`); sem template, **sempre FALHA em META_CLOUD** (`despachante.ts:422`) | `/api/whatsapp/cron` |
| 9 | **Avisos de alteração de agenda** | criação em `comunicacoes-agenda/avisos.ts:38` (chamada por agenda, diário, contratos e pendências); envio em `comunicacoes-agenda/whatsapp.ts:109/158` | `whatsapp.ts:151/154` → `despacharFila({somenteAvisosAgenda})` (`avisos.ts:164`); o tick global também drena | opt-in `aluno.aceitaComunicacoes` (`whatsapp.ts:129`); **número AGENDA + META_CLOUD + template utility APROVADO** (`:95-96`); hash do contato; claim do aviso (`:204-207`); herda janela e shadow da política de **cobrança** (`despachante.ts:165-167, 384-393`) | `/api/agenda/avisos/cron`, **não agendado** no repositório |
| 10 | **Reenvio após revisão de falha** | `operacoes-atendimento.ts:252` `revisarFalhaEnvio` (ADM) | intenção FALHOU volta a PENDENTE/HUMANO (`:273-276`) | exige evidência; cobrança alterada cancela | próximo tick |
| — | Cobrança manual por `wa.me` | `financeiro/cobranca-manual.ts:26-52`, `financeiro/acoes.ts:195-229` | **não usa provedor** | — | grava só o Evento `CobrancaEnviadaWhatsApp` com `canal:"manual"` |

**Não enviam WhatsApp:**
- **Portal do aluno:** `/api/portal-aluno/envios/cron`, `recuperacao` e `token` são só e-mail via Resend (`processar-envios`).
- **Continuidade financeira:** `/api/financeiro/continuidade/cron` → `matricula/continuidade-emissao-cron` só emite cobranças.
- O canal **e-mail** dos avisos de agenda usa outro transporte (`avisos.ts:105-148`). O transporte injetado recusa WhatsApp (`avisos.ts:231`).

### 2.2 O despachante: regras aplicadas a todos (`despachante.ts`)

**Seleção:**
- PENDENTE, ADIADA vencida e ADIADA por comprovante, em `criadaEm asc` (`:103-126`).
- O claim órfão (ENVIANDO vencido) vira `FALHOU envio_interrompido` (`:96-101`).

**Ordem dos guard-rails:**
1. **Revalidação de domínio** (`motivoIntencaoInvalida`, `:586-627`): número ativo, opt-out, aviso de agenda, contexto de gestão, autor ativo e no escopo (fora do CRON), atendimento aberto, snapshot e assinatura da cobrança, política comercial. Se falhar → CANCELADA.
2. Comprovante em conferência → ADIADA (`:145-150`).
3. **Kill switch** (só automação; não vale para agenda nem HUMANO) → fica PENDENTE (`:187-190`).
4. **Trava S1:** CRON não reativo e não comercial em número não-Meta → CANCELADA (`:195-199`).
5. Opt-out → CANCELADA (`:203-207`).
6. `validaAte` vencida → CANCELADA (`:212-216`).
7. **Conversa viva:** inbound posterior à criação cancela a automação (`:232-236`).
8. **Silêncio pós-inbound** (72 h, `politica.ts:50`) → ADIADA (`:254-261`).
9. Revalidação comercial B7 (`:268-314`).
10. **Idempotência por Evento** do degrau ou passo (`:318-357`).
11. **Teto por contato/dia** (2) → ADIADA +24 h (`:364-380`).
12. **Janela de horário e dias** (9–20 h, seg–sex, no fuso do contato; padrão `America/Sao_Paulo`) → ADIADA +1 h (`:384-393, 657-666`).
13. **Shadow:** sem `WHATSAPP_LIVE=1` ou com política não ATIVA → SIMULADA, sem chamar o driver (`:403-415`).
14. **Template Meta** obrigatório para automação não reativa em META_CLOUD → `FALHOU template_nao_aprovado_meta` (`:417-426`). É o único controle de "janela de 24 h" no servidor.
15. **Claim atômico:** ENVIANDO + `despacharAposEm = agora + 15 min` (`:69, :431-451`). Na agenda também há `claimAvisoAgendaTx`. Depois o despachante relê e revalida (`:455-471`).
16. **Envio** (`:477-502`): mídia → `enviarMidia`; META_CLOUD com template → `enviarTemplate`; senão → `enviarTexto`.

**Gravação depois do envio** (uma transação, `:504-560`):
- `MensagemWhatsApp` SAIDA com `status ENVIADA`, driver, origem, `providerMessageId`, autor e template;
- `ultimaMensagemEm` na conversa e no atendimento;
- Evento `CobrancaEnviadaWhatsApp` (`canal:"api"`) ou `ReguaComercialEnviada`;
- intenção → DESPACHADA com `mensagemId`;
- aviso de agenda → ENVIADO com `provedorId`.

**Gravação antes do envio:**
- `ContatoWhatsApp` e `AtendimentoWhatsApp` (`garantirContato`/`garantirAtendimento`);
- `IntencaoMensagem` PENDENTE;
- para a agenda, `AvisoAlteracaoAgenda` PREPARADO → INCERTO + `TentativaAvisoAlteracaoAgenda`.

**Falha:**
- Vira `FALHOU` com o motivo do `ErroDriver` ou `resultado_incerto` (`:562-570, :717-722`).
- **Não há retry nem backoff automático.** `podeReabrirIntencao` não reabre FALHOU (`elegibilidade.ts:7-10`); só a revisão humana reabre.

**Status assíncrono:**
- Os webhooks atualizam só `MensagemWhatsApp.status` (`inbound.ts:223-239`); `IntencaoMensagem` não muda.
- O status só avança ENVIADA → ENTREGUE → LIDA; FALHOU sobrescreve.
- Status de uma mensagem ainda inexistente é descartado.

### 2.3 Crons e agendadores

| Rota | O que faz | Autenticação | Flag | Agendado? |
|---|---|---|---|---|
| `POST /api/whatsapp/cron` (`route.ts:44-81`) | Um tick com 16 etapas: reservas particulares, início de turmas, acesso por vencimento e aulas, **régua de cobrança**, 6 comerciais, copiloto, gestão, fechamento de comissões, fechamentos pendentes, linha comercial e **despacho** | header `x-cron-secret` = `CRON_SECRET` (`!==`; 503 sem segredo) | — | **Sim, é o único.** Serviço `cron` (curl em laço com `sleep 300`) em `docker-compose.prod.yml:111-123` e `docker-compose.coolify.yml:158-169`. O doc 31 (`:145-149`) ainda diz crontab horário: diverge |
| `POST /api/agenda/avisos/cron` | avisos de agenda | idem | `COMUNICACOES_AGENDA_ENVIO_ENABLED=true` | **Não** (só `.env.example:62-65`) |
| `POST /api/portal-aluno/envios/cron` | e-mails do portal | idem | `EMAIL_PORTAL_ENVIO_ENABLED=true` | **Não** |
| `POST /api/financeiro/continuidade/cron` | emissão mensal | idem | `CONTINUIDADE_MENSAL_EMISSAO_ENABLED=true` | **Não** (`docs/planejamento/validacao-incremento-606.md:13`) |
| `GET /api/whatsapp/health` | saúde do canal | idem | — | monitor externo, fora do repositório |

Observação: o tick de 5 min mistura controle acadêmico, cobrança, comercial e despacho na mesma rota HTTP. A troca do WhatsApp **não exige** mexer nos outros jobs, mas a remoção da casca mexe nessa rota (Parte 6).

### 2.4 Conclusão: ponto único e contrato exigido do motor

**Ponto único a substituir:**
- O salto para o provedor em `despachante.ts:477-502`, por meio de `DRIVERS` (`:31-34`) e da porta `CanalWhatsApp` (`canal.ts:50-54`).
- O grep confirma que só `despachante.ts:14-15` importa `drivers/`.

**Abordagem que preserva todas as regras:** um driver `driverMotor` que faz HTTP para o serviço novo, registrado no lugar do `driverEvolution`. Todas as automações continuam iguais.

**Fora do ponto único** (nenhum envia mensagem, mas todos falam com o provedor):
- `sessao.ts`: instância, QR e estado;
- `meta-templates.ts`;
- `midia.ts:146-215`: download de mídia;
- os webhooks;
- `historico.ts`.

**Acoplamentos ao enum `DriverWhatsApp`** que precisam ser revistos:
- `cron.ts:56`;
- `despachante.ts:195, :422, :493`;
- `comunicacoes-agenda/whatsapp.ts:95`;
- `acoes.ts:726, :761, :782, :949`;
- `consultas-inbox.ts:163`;
- `inbound.ts:245-260`;
- `historico.ts:42, :85`;
- `webhook/evolution/route.ts:183-194`.

**Operações que o ERP exige do motor (contrato mínimo):**

| Operação | Sentido | Hoje | Exigência |
|---|---|---|---|
| Enviar texto | ERP → motor | `enviarTexto(numero, paraE164, corpo)` | retorno **síncrono** com `providerMessageId` único por número (`@@unique([numeroId, providerMessageId])`) |
| Enviar "template" | ERP → motor | `enviarTemplate(nome, idioma, variaveis[], corpoRenderizado)`; no Baileys vira texto livre (`evolution.ts:65-71`) | no Baileys basta o corpo renderizado. Variáveis posicionais só no BODY; sem header nem botões |
| Enviar mídia | ERP → motor | `enviarMidia({tipo IMAGEM\|AUDIO\|VIDEO\|DOCUMENTO, mime, nomeArquivo, dadosBase64, legenda})`; áudio como PTT | MIMEs: jpeg, png, webp, ogg, mpeg, mp4 (áudio), webm, mp4 (vídeo), **PDF**; até 10 MB |
| Documento (PDF) | ERP → motor | = mídia DOCUMENTO com `filename` | idem |
| Erro tipado | motor → ERP | `ErroDriver(motivo)` com motivo estável | para separar "falhou" de "resultado incerto" (timeout depois do envio) |
| Mensagem recebida | motor → ERP | `InboundNormalizado` (número, wa_id/telefone, nome do perfil, tipo, corpo, mídia, `providerMessageId`, quando, `fromMe`, referral) | **inclui `fromMe`** (eco do celular), que é a base do takeover comercial |
| Status de entrega/leitura | motor → ERP | `StatusNormalizado` (ENVIADA, ENTREGUE, LIDA, FALHOU) | hoje sem motivo de falha nem horário do provedor; o motor deveria mandar os dois |
| Mídia recebida | motor → ERP | ERP baixa por provedor | o motor entrega os bytes ou uma URL própria autenticada |
| Sessão / QR | ERP ↔ motor | criar instância, `webhook/set`, connect/QR, `connectionState`, eventos `connection.update` e `qrcode.updated` | CONECTADO, AGUARDANDO_QR, CAIU, DESCONECTADO |
| Histórico | motor → ERP | `messages.set` (30 dias, só linha VENDAS) → `MensagemHistorica` | opcional, mas a SPEC-ERP-005 (LC-D01 a D06) depende dele |
| Filtro de JID | motor | `evolution-jid.ts` (grupo, broadcast, status, newsletter, LID) | deveria morar no motor |
| **Não usados hoje** | — | botões, listas, reações, localização, digitando, marcar como lida no provedor | `marcarConversaLida` é só local (`acoes.ts:326-336`) |

---

## Parte 3 — Recebimento e provedores

### 3.1 Webhooks → domínio

**Meta** (`src/app/api/whatsapp/webhook/meta/route.ts`):
- **Handshake:** GET com verify token (`:17-27`).
- **Assinatura:** POST com **HMAC-SHA256 do corpo cru** (`META_WA_APP_SECRET`, `timingSafeEqual`, `:29-42, :100-103`).
- **Erros:** JSON inválido ou erro de processamento sempre respondem 200 (`:105-114, :185-188`).
- **Templates:** `message_template_status_update` → `processarStatusTemplateWebhook` (`:118-121`).
- **Mídia:** `baixarMidiaMeta` + `salvarMidiaInbound` (`:136-141`).
- **Referral CTWA:** `:145-154`.
- **Normalização:** `:156-168`.
- **Status:** `:171-182`.

**Evolution** (`…/webhook/evolution/route.ts`):
- **Autenticação:** header `apikey` = `EVOLUTION_WEBHOOK_TOKEN`, comparado com `!==` (`:101-104`).
- **Histórico:** `messages.set` → `importarHistoricoLinha` (`:115-138`).
- **Sessão:** `connection.update` e `qrcode.updated` (`:144-154`).
- **Filtro de JID:** `:158-165`.
- **Mensagens:** `messages.upsert` com mídia base64 ou `getBase64FromMediaMessage` (`:167-194`).
- **Status:** `messages.update` por ack (`:195-214`).

**Domínio** (`inbound.ts:55-203`):
1. `acharNumero` por `(providerRef, driver)` (`:245-260`).
2. `garantirContato`, que preserva vínculos e nome editado (`identidade.ts:16-56`).
3. Upsert da conversa; claim do 1º inbound em `capturadaEm` (`:71-87`).
4. `MensagemWhatsApp` ENTRADA (ou SAIDA se `fromMe`, com `origem:null`) (`:91-106`).
5. **Dedupe** pelo unique `(numeroId, providerMessageId)`: P2002 vira `"duplicada"` (`:200`).
6. Contadores e `naoLidas++` (`:108-114`).
7. **Conversa viva:** cancela intenções CRON/LOTE pendentes (`:118-127`).
8. **Opt-out por palavra exata** (`:46, :131-144`).
9. **Auto-lead e saudação** (`captura.ts:240-297`, chamada em `inbound.ts:149-164`).
10. C2 "SIM/REAGENDAR" (`inbound.ts:166-176`).
11. Roteamento para atendimento (`atendimentos.ts:57-84`): linha VENDAS → atendimento da linha; 1 aberto → esse; COBRANCA com uma matrícula → FINANCEIRO; senão **triagem do ADM**.
12. Saudação despachada fora da transação (`:191-197`).

**Lacunas do recebimento atual:**
- **Mídia baixada antes do dedupe:** retry do webhook gera arquivo órfão.
- **Tipos sem filtro:** reação, sticker, edição e interativos entram como `OUTRO` e contam como inbound real (cancelam automações e somam não lidas). O doc 32 §3 pede "reação ignorada".
- **Corrida de `fromMe`:** um eco antes do commit do despachante pode virar "takeover" e `FALHOU resultado_incerto`.
- **Processamento inline:** os webhooks processam na própria requisição; o doc 30 S7 pede "200 imediato e async".
- **Não existe teste do webhook Meta.**

### 3.2 O que é específico de Meta ou Evolution

| Item | Meta | Evolution | Onde | Com o motor Baileys próprio |
|---|---|---|---|---|
| Templates aprovados | submissão, sync da WABA, webhook de status; obrigatório para automação | ignorado (template vira texto) | `meta-templates.ts:51-288`; `despachante.ts:417-426`; `acoes.ts:789-896` | `TemplateWhatsApp.corpo` + `render.ts` continuam como modelo de texto. `statusMeta` e `metaTemplateId` e as telas de submissão viram código morto |
| Janela de 24 h | indicador na thread + regra de template | não existe | `consultas-inbox.ts:140,163`; `InboxCliente.tsx:388-398` | já devolve `null` fora da Meta |
| Trava S1 (cobrança automática só oficial) | permitido | **proibido** (D34) | `cron.ts:55-56`; `despachante.ts:192-199`; `acoes.ts:948-953`; doc 30 S1; doc 15 D34 | **decisão** (§7) |
| Avisos de agenda | obrigatório | **proibido** | `comunicacoes-agenda/whatsapp.ts:95-96`; `acoes.ts:726` | **decisão** (§7) |
| Referral click-to-WhatsApp | bloco `referral` | normalmente ausente | `meta/route.ts:145-154`; `captura.ts:15-23,82-86`; `Lead.waReferral*` | sem anúncio CTWA, a origem fica vazia |
| ID de mensagem | `wamid.*` | `key.id` | `meta-cloud.ts:45-47`; `evolution.ts:45-47` | string livre, única por número |
| JID / LID | `wa_id` em dígitos | `@s.whatsapp.net`, `@lid`, `@g.us`, `@broadcast`, `@newsletter` | `evolution-jid.ts:23-46` | regra deveria ir para o motor |
| Status | sent, delivered, read, failed | ack 1–4 / SERVER_ACK… | `meta/route.ts:52-57`; `evolution/route.ts:29-35` | `StatusMensagem` fica |
| `fromMe` | não existe | eco do celular vira SAIDA `origem:null` | `inbound.ts:95-102`; takeover em `cron-comercial.ts:201-211` e `despachante.ts:276-286` | o motor precisa distinguir eco de envio do ERP (por id) |
| Mídia de entrada | `GET /{media_id}` → URL efêmera | base64 no webhook ou `getBase64FromMediaMessage` | `midia.ts:156-215` | o motor entrega os bytes |
| Mídia de saída | upload `/media` e depois o id; áudio sem legenda | `sendMedia` base64; áudio PTT | `meta-cloud.ts:51-118`; `evolution.ts:51-87` | o contrato `EnvioMidia` serve |
| Sessão / QR | não há | `SessaoNumero` + eventos | `sessao.ts`; `saude.ts:117-122`; `NumerosPainel.tsx:276` | vira API do motor |
| Credenciais | `META_WA_TOKEN`, `META_WA_APP_SECRET`, `META_WA_VERIFY_TOKEN`, `META_WA_WABA_ID`, `META_WA_GRAPH_URL` | `EVOLUTION_URL`, `EVOLUTION_APIKEY`, `EVOLUTION_WEBHOOK_TOKEN`, `EVOLUTION_WEBHOOK_PUBLIC_URL` | `.env.example:40-46`; `docker-compose.prod.yml:68-73` | variáveis novas do motor |
| Pacing anti-ban | n/a | prometido no doc 26:41 (jitter, limite por hora) | **não implementado**: só existe o teto por contato/dia | candidato natural para o motor |

### 3.3 Piloto Baileys

**Código:** não existe dependência Baileys. `package.json` e lockfile não citam `baileys` nem `whiskeysockets`. O Baileys roda só **dentro da Evolution API**:
- imagem `evoapicloud/evolution-api:v2.3.7` (`docker-compose.prod.yml:84-106`, `docker-compose.coolify.yml:132-155`);
- banco `evolution` separado (`deploy/initdb/01-banco-evolution.sql`);
- volume `evolution_instances`.

**Doc 32:** é o plano de piloto **comercial** C1/C2 sobre Baileys:
- os bloqueadores B1–B9 aparecem como implementados (`:18-33`);
- os portões de entrada continuam desmarcados, exceto B7 e B8 (`:65-79`);
- o doc 26:22-23 decidiu "não rodar Baileys cru dentro do app". O motor separado respeita essa decisão.

**Dá para aproveitar no motor novo:**
- a porta `CanalWhatsApp` e o `ErroDriver`;
- `InboundNormalizado`, `StatusNormalizado` e `MensagemHistorica` como contrato de eventos;
- as regras de `evolution-jid.ts` e o teste dele, como especificação;
- `historico.ts`, idempotente e sem efeitos colaterais;
- o ciclo `SessaoNumero` e os eventos de sessão;
- o fluxo de QR na tela (`acoes.ts:756-787`, `NumerosPainel.tsx`);
- os cenários de aceite do doc 32 §3 (`:81-107`): retry não duplica, `fromMe` gera takeover, grupo e reação ignorados;
- os runbooks e o backup do estado de autenticação (doc 31 §4).

**É só comercial:**
- B1 (allowlist `modoPiloto`/`pilotoLeadIds`);
- B2/B7 (takeover);
- B3 (`validaAte`);
- B8 (reagendamento);
- B9 (check-in);
- o rollout, as métricas e a migração para WABA (§4, §5, §7 do doc 32).

### 3.4 Mídia

| Aspecto | Onde | Detalhe |
|---|---|---|
| Download na entrada | `midia.ts:156-176` (Meta), `:182-215` (Evolution) | falha devolve `null` e a mensagem fica sem binário |
| Armazenamento | `src/lib/uploads.ts:6` (`data/uploads`); `midia.ts:58-71` (`whatsapp/`), `:79-93` (`whatsapp-out/<usuarioId>/`) | **disco local**, volume docker `uploads:/app/data/uploads`; **sem S3** (doc 30 S12) |
| Limites | `midia.ts:19-33` | 10 MB; MIMEs em lista branca |
| Servir à tela | `src/app/api/files/[...path]/route.ts:16-67` | sessão + proteção contra path traversal + `Cache-Control: private, no-store` |
| Autorização | `src/server/uploads/autorizacao.ts:138-143` | o arquivo precisa estar ligado a uma `MensagemWhatsApp` ou `IntencaoMensagem` dentro de `escopoAtendimentos`; ADM vê tudo |
| Upload para envio | `src/app/api/whatsapp/upload/route.ts:15-68` | `PAPEIS_INBOX` + atendimento visível com permissão de envio |
| Exibição | `InboxCliente.tsx:657, 673-690` | `<img>`, `<audio>`, `<video>` ou link |

---

## Parte 4 — Inbox atual e atendimento

### 4.1 Quem usa e com qual escopo

- **Papéis** (`schema.prisma:455-464`): ADMINISTRADOR, GERENTE_COMERCIAL, VENDEDOR, GERENTE_PEDAGOGICO, PROFESSOR, FINANCEIRO, SECRETARIA_ACADEMICA, ALUNO.
- **`PAPEIS_INBOX`** = todos menos ALUNO (`escopo.ts:11-19`); o menu está em `src/lib/nav.ts:32-46`.
- **Guard da página:** `exigirSessaoPagina` (`page.tsx:22`).
- **Não há matriz de capacidades `whatsapp.*`:** é só proposta no `docs/37:124-133`.
- **ADM passa em qualquer `temPapel`** (`_shared/sessao.ts:108-111`).

**`escopoAtendimentos`** (`escopo.ts:37-82`) é o controle real por linha. **O acesso vem do atendimento, nunca do número** (`:8-9`).

| Papel | Vê atendimentos onde… | Linha |
|---|---|---|
| ADMINISTRADOR | todos | :46 |
| VENDEDOR / GERENTE_COMERCIAL | COMERCIAL com lead na **carteira atual** (vendedor: os seus + coberturas vigentes; gerente: a equipe; `_shared/escopo-comercial.ts:24-50`); COMERCIAL sem lead em que é `responsavelId` e o número não é VENDAS; participante vigente; **linha comercial**: todos os COMERCIAIS dos números VENDAS de que é dono (ou da equipe, no caso do gerente) | :48-64; `linha-comercial.ts:150-170` |
| FINANCEIRO e SECRETARIA_ACADEMICA | FINANCEIRO com aluno | :66-68 |
| SECRETARIA_ACADEMICA | SECRETARIA e PEDAGOGICO | :69-71 |
| GERENTE_PEDAGOGICO | PEDAGOGICO | :72 |
| PROFESSOR | PEDAGOGICO **aberto** com aluno+turma de alocação ativa do docente, ou lead da experimental agendada com ele | :73-80 |

- **Com `enviar=true`:** o atendimento precisa estar aberto, com número ativo; FINANCEIRO só com matrícula (`:42-45`).
- **`escopoNumeros`** (`:21-34`) só serve para listar números na configuração.
- **Pedagógico:** esconde telefone, número e nome do perfil ("Canal institucional"; `consultas-inbox.ts:111-113, 156-159`).

**Filtros da tela:**
- busca `?busca=` com até 6 palavras em AND (`busca-inbox.ts:26-45`);
- canal `?canal=linha|institucional`.
- **Não há** filtro por status, setor, responsável ou não lidas.

### 4.2 Como `AtendimentoWhatsApp` funciona hoje

- **Abertura automática:**
  - `garantirAtendimento` (`atendimentos.ts:8-41`) faz upsert por `contextoChave = finalidade:lead:aluno:turma[:matrícula][:autorização|ALUNO]`, com `update: {}` (nunca reabre, nunca troca o dono).
  - COMERCIAL em número VENDAS usa o atendimento único da linha (`COMERCIAL:LINHA[:n]`, `linha-comercial.ts:26-67`).
  - No inbound, `atendimentoDoInbound` (`atendimentos.ts:57-84`).
- **Abertura manual:** `abrirAtendimentoInstitucional` (`operacoes-atendimento.ts:113-182`).
  - O telefone é resolvido **no servidor** a partir do lead, do pagador da matrícula, da autorização pedagógica ou do WhatsApp do aluno.
  - Grava o evento `AtendimentoInstitucionalAberto`.
- **Transferência: não existe.**
  - A única propagação é `atribuirDono` do lead (`comercial/acoes.ts:849-874`, só GERENTE_COMERCIAL). Ele troca o `responsavelId` dos atendimentos COMERCIAIS abertos e cancela as intenções HUMANO pendentes do dono anterior.
  - O chip "responsável" da thread está morto: `carregarThread` devolve `responsavelId: null` (`consultas-inbox.ts:161`).
- **Encerramento:** `encerrarAtendimentoWhatsApp` (`operacoes-atendimento.ts:286-304`).
  - Alçada por finalidade: COMERCIAL→GC, FINANCEIRO→FIN, SECRETARIA→SEC, PEDAGOGICO→GP ou SEC.
  - Cancela as intenções PENDENTE e ADIADA e grava `AtendimentoEncerrado`.
  - **Nenhuma tela chama essa ação.**
  - Não há reabertura.
- **Prazo/SLA: não existe.** O único SLA é "lead NOVO parado", do `cron-gestao.ts:75-97` (casca).
- **Triagem:** inbound ambíguo vai para o ADM, que classifica com auditoria (`MensagemClassificada`, `operacoes-atendimento.ts:191-238`).
- **Revisão de falha incerta:** só pelo ADM, com evidência (`FalhaWhatsAppRevisada`, `:244-284`).
- **Validações SQL:** os 4 triggers da §1.4, mais a FK composta `(matriculaId, alunoId)`.
  - **Não há** unique parcial do tipo "um aberto por conversa e setor".
  - A regra "1 aberto por vez na linha" existe só em TypeScript (`linha-comercial.ts:55-57`).

### 4.3 Atualização da tela

- **Polling:** `setInterval` de 30 s com `router.refresh()`, só com a aba visível, mais refresh no `visibilitychange` (`InboxCliente.tsx:115-135`).
- **Depois de cada ação:** `revalidatePath("/inbox")` no servidor.
- **Sem SSE, websocket, `LISTEN/NOTIFY` ou Redis:** o grep não encontra `EventSource`, `text/event-stream` nem `WebSocket`. Um inbound só aparece no próximo polling.
- **Limites:**
  - lista com até 200 atendimentos + até 500 com não lidas, sem cursor (`consultas-inbox.ts:79-103`);
  - thread com as **300 mensagens mais recentes do atendimento**, sem "carregar mais".

### 4.4 Regra de negócio que precisa existir no novo Inbox

| # | Regra | Onde |
|---|---|---|
| 1 | O acesso deriva do atendimento (setor + vínculos), nunca do número | `escopo.ts:8-9, 37-82` |
| 2 | Carteira comercial atual (vendedor, cobertura vigente, equipe) | `_shared/escopo-comercial.ts:24-50` |
| 3 | Linha comercial: o dono e o gerente veem toda a linha; a cobertura não dá acesso; o painel do lead segue a carteira | `escopo.ts:60-64`; `consultas-inbox.ts:176-184` |
| 4 | Professor: só pedagógico aberto de turma atual ou de experimental própria | `escopo.ts:73-80` |
| 5 | Pedagógico esconde telefone, número e nome do perfil; não permite editar nome nem vincular | `consultas-inbox.ts:111-113,152-159`; `acoes.ts:446,513` |
| 6 | Responsável legal não aparece no comercial | `nome-contato.ts:38`; `busca-inbox.ts:37` |
| 7 | Telefone resolvido só no servidor; o cliente manda ids | `operacoes-atendimento.ts:112-167` |
| 8 | **Destinatário atual** por setor antes de cada envio | `destinatario-atual.ts:21-79` + triggers 264 e 265 |
| 9 | FINANCEIRO sempre por matrícula; contexto FIN e PEDAG imutável; sem reclassificação | triggers da §1.4; `atendimentos.ts:13-20` |
| 10 | **Opt-out (LGPD):** palavra exata, botão auditado, remoção só pelo ADM com evidência de 12+ caracteres, bloqueio no envio e no despachante | `inbound.ts:46-50,131-144`; `acoes.ts:538-591`; `despachante.ts:203` |
| 11 | Envio = intenção HUMANO + despachante único; kill switch não bloqueia humano | `acoes.ts:234-281`; `despachante.ts:168-199` |
| 12 | Silêncio pós-inbound e "tratar" (promessa, pagamento, retomar régua), com alçada FIN ou SEC | `acoes.ts:340-368`; `despachante.ts:218-261` |
| 13 | **Conversa viva:** inbound cancela automações pendentes | `inbound.ts:118-127` |
| 14 | Contato único por telefone; vincular exige o mesmo telefone e nunca sobrescreve | `identidade.ts:16-56`; `acoes.ts:452-478` |
| 15 | Inbound ambíguo vai para a triagem auditada | `atendimentos.ts:57-84`; `operacoes-atendimento.ts:191-238` |
| 16 | Revisão de envio incerto só com decisão e evidência | `operacoes-atendimento.ts:252-284` |
| 17 | Encerramento por alçada da finalidade, cancelando a fila do atendimento | `operacoes-atendimento.ts:286-304` |
| 18 | Mídia: upload só no atendimento visível; envio só de arquivo do próprio autor; download dentro do escopo | `upload/route.ts:39`; `acoes.ts:299`; `uploads/autorizacao.ts:138-143` |
| 19 | Nenhuma conversa com não lidas fica fora da lista | `consultas-inbox.ts:86-94` |
| 20 | Nota interna nunca vira mensagem | `InboxCliente.tsx:1071-1078`; `inbox.int.test.ts:513` |
| 21 | Auditoria por Evento: `AtendimentoInstitucionalAberto`, `MensagemClassificada`, `FalhaWhatsAppRevisada`, `AtendimentoEncerrado`, `ContatoVinculado`, `ContatoRenomeado`, `OptOutRegistrado`, `OptOutRemovido`, `ReguaRetomada`, `NotaInterna`, `LeadAtribuido` | linhas citadas acima |

**É só apresentação e pode ser refeito livremente:**
- layout mestre-detalhe;
- bolhas, ícones de status e agrupamento por dia;
- chips e pílulas;
- esqueleto e estados de erro;
- gravação de áudio no navegador (a regra continua no servidor);
- posição dos painéis de triagem e revisão.

**Testes que cobrem isso hoje** (servem de regressão ou de especificação):
- `inbox.int.test.ts` (~19);
- `acesso-atendimento.int.test.ts` (~14);
- `linha-comercial.int.test.ts` e `linha-comercial.test.ts` (~27 / ~19);
- `atendimento-pedagogico-autorizacao.int.test.ts`;
- `destinatario-atual.int.test.ts`;
- `financeiro-matricula.int.test.ts`;
- `pagador-contrato.int.test.ts`;
- `escopo*.test.ts`;
- `busca-inbox.test.ts` e `consultas-inbox.test.ts`;
- `uploads/autorizacao.test.ts` (~24);
- os 4 testes de tela em `src/app/(app)/inbox/`.

---

## Parte 5 — Dúvidas técnicas do ERP

1. **Frontend**
   - **Versões:** Next.js **16.3.5** (`package.json:41`, resolvido no lock) e React/react-dom **18.3.1**. Build `output: "standalone"` com Turbopack (`next.config.mjs:6`).
   - **UI:** não usa biblioteca de terceiros (sem shadcn, MUI ou Radix). São ~31 componentes próprios em `src/components`: `Botao`, `Campo*`, `Modal`, `Drawer`, `ConfirmarAcao`, `Paginacao`, `Sidebar`, `EstadoVazio`, `Esqueleto` etc. Ícones `@tabler/icons-react` 3.44.
   - **Estilo:** **Tailwind 3.4** + `globals.css`, sem CSS modules.
   - **Dados:** Server Components + **Server Actions** (273 arquivos `"use server"`), com `useAcaoCliente` no cliente (`src/lib/acao-cliente.ts`). Não há React Query nem SWR.
   - **Formulários:** react-hook-form + zod em poucas telas.
   - **Tokens:** variáveis CSS em `:root` e `.dark` (`globals.css:10-112`), remapeadas no `tailwind.config.ts:10-76`. Travas em `contraste.test.ts` e `paleta.test.ts`.
   - **Modo escuro:** `darkMode: "class"`, `localStorage('tema')` + `prefers-color-scheme` com script anti-FOUC (`layout.tsx:22-29`, `Sidebar.tsx:40-51`). Não fica salvo no servidor.
2. **Autenticação**
   - **Equipe:** NextAuth **5.0.0-beta.32**, Credentials + bcrypt, sessão **JWT** (`src/lib/auth.ts`). Papéis e permissões são relidos do banco a cada ação (`_shared/sessao.ts`).
   - **`src/proxy.ts` não autentica.**
   - **Portal do aluno:** sessão própria no banco (`SessaoPortalAluno`, cookie httpOnly).
   - **Cron:** `x-cron-secret`.
   - **Webhook Meta:** HMAC; Evolution: token em header.
   - **Para o motor:**
     - nas chamadas motor → ERP, seguir o padrão do webhook Meta: segredo dedicado (não reaproveitar `CRON_SECRET`), `HMAC-SHA256(timestamp + "." + corpoCru)`, `timingSafeEqual` e janela anti-replay (hoje nenhuma rota tem);
     - nas chamadas ERP → motor, API key em header;
     - motor só na rede interna do compose, como a Evolution hoje;
     - o doc 37:140 exige identidade de serviço própria.
3. **Eventos**
   - `registrarEvento` só faz `tx.evento.create` na transação (`_shared/evento.ts:79-92`). **Não é outbox:** não há coluna de publicado, despachante nem assinante.
   - As leituras de `Evento` são síncronas (idempotência, timeline, relatórios).
   - **Não há fila** (BullMQ, pg-boss, Redis). As "filas" são tabelas (`IntencaoMensagem`, `SolicitacaoEnvioPortalAluno`, `AvisoAlteracaoAgenda`) drenadas por cron HTTP.
4. **Jobs:** ver §2.3. Só `/api/whatsapp/cron` está agendado (sidecar `curl` a cada 300 s, nos dois composes). Agenda, portal e continuidade **não estão agendados**. O backup (`scripts/backup-producao.sh`) é crontab do host, documentado só em comentário.
5. **Arquivos**
   - **Disco local** (`data/uploads`, volume docker), servido por `/api/files` com autorização por objeto.
   - PDFs contratuais ficam **no banco** (`Bytes`).
   - Gravações de aula ficam no Google Drive.
   - **Sem S3.**
6. **Tempo real:** **não existe.** Só polling. O único `ReadableStream` é o stream de vídeo.
7. **Tenancy:** **uma escola por instância.** Não há `tenantId` nem `escolaId`. As configurações são singletons (`ConfiguracaoOperacional @default("escola")`, `ConfigComercial @default("comercial")`). O sistema é multi-país (`Pais`), não multi-tenant.
8. **Deploy**

   | Serviço | prod | coolify | Notas |
   |---|---|---|---|
   | db (postgres:16-alpine) | ✓ (+ `deploy/initdb` cria o banco `evolution`) | ✓ | healthcheck `pg_isready` |
   | db-init | — | ✓ | `CREATE DATABASE evolution` |
   | migrate (`prisma migrate deploy`) | ✓ | ✓ | one-shot antes do app |
   | app (node:22-alpine, standalone) | ✓ (atrás do Caddy) | ✓ (Traefik :3000; healthcheck `/api/ready`) | volume `uploads`; envs `META_WA_*`, `EVOLUTION_*`, `CRON_SECRET`, `WHATSAPP_LIVE`, `ANTHROPIC_API_KEY` |
   | evolution (evolution-api v2.3.7) | ✓ | ✓ | sem porta publicada; volume `evolution_instances`; `CACHE_REDIS_ENABLED=false` |
   | cron (curlimages/curl) | ✓ | ✓ | laço `POST /api/whatsapp/cron` a cada 300 s |
   | caddy | ✓ (80/443, limite de 12 MB) | — | — |

   **Com o motor novo:** o serviço `evolution` e o banco `evolution` (initdb, db-init, backup) são substituídos pelo serviço do motor.
9. **Regras para schema, permissão e migrations**
   - **`AGENTS.md:11`:**
     - mudanças compartilhadas de permissões, contratos e schema exigem coordenação técnica;
     - **o integrador reserva os IDs de migração**;
     - não reutilizar migração já aplicada.
   - **`AGENTS.md:7`:** agentes não fazem install nem alteram package ou lockfile.
   - **`AGENTS.md:8-9`:** banco de teste por `.erp-test-profile`, da lista fechada.
   - **`AGENTS.md:13-14`:** teste e TS só valem com exit 0; registrar no `quadro-entregas.md`.
   - **`docs/13`:** toda mutação grava `Evento` na mesma transação; sem delete físico.
   - **Antes de merge com migration:** backup do UAT, ensaio de `migrate deploy` numa cópia e suíte de integração completa (`quadro-entregas.md:66`).
   - **Travas automáticas:**
     - `src/app/enums-rotulos.test.ts:47-58` lê o `schema.prisma`: **um valor de enum novo sem rótulo quebra o teste**;
     - `src/test/migrations-encoding.test.ts` exige `migration.sql` UTF-8 e não vazio em cada pasta;
     - `src/lib/nav.test.ts` (menu por papel);
     - `src/deploy/*.test.ts` (leem Dockerfile e compose).
10. **Linha de base de testes: NÃO executada.**
    - O checkout não tem `node_modules` (`ls node_modules` → inexistente), e `AGENTS.md:7` veda install/ci/npx. Sem dependências, `vitest` e `tsc` do projeto não rodam.
    - Para registro: o `tsc` global da imagem (**6.0.2**, diferente do `^5.6` do projeto) terminou com exit 2 e 31.205 erros. Eles são dominados por TS2307, TS7026 e TS7006 (módulos e tipos ausentes). **Isso não é linha de base.**
    - Também não há `.erp-test-profile` neste checkout: o padrão cairia em `erp_genius_test`, que o AGENTS.md proíbe para agentes.
    - Inventário: **646** `*.test.ts` unitários e **193** `*.int.test.ts` (1 é `despachante.live.int.test.ts`).
    - O CI (`.github/workflows/ci.yml:21-25`) não roda os `.int`.
    - **Pendência:** o integrador precisa preparar as dependências e um perfil (por exemplo `tester`) e então rodar `tsc --noEmit`, `vitest run` e `vitest run -c vitest.integration.config.ts`, registrando as falhas pré-existentes.

---

## Parte 6 — Validação da casca do CRM

### 6.1 Conclusão

**Pode ser removida sem tocar em `schema.prisma`, migrations ou funções SQL: SIM.**
- Nenhuma função ou trigger é chamada só pela casca.
- O único SQL cru na casca é `ia/acoes.ts:135-136` (`SELECT … FOR UPDATE` em Lead e SugestaoIA).
- As funções que citam `"Lead"` são 4 do domínio de **desistência e segunda chamada**, e só fazem `PERFORM … FOR UPDATE` (conferido em `pg_proc`):
  - `bloquear_contexto_financeiro_desistencia`;
  - `bloquear_contexto_fonte_segunda_chamada`;
  - `conferir_efetivacao_pedido_desistencia_preparacao`;
  - `validar_decisao_administrativa_desistencia`.

  Todas são base.
- Ficam órfãs, sem dano: `SugestaoIA`, `PoliticaComercial`, `DegrauComercial`, os campos `copiloto*`, `gestao*`, `saudacao*` e `autoLeadAtivo` de `ConfigComercial`, e `Lead.ultimaCobranca` (0 usos).

**Mas não é "só apagar".** Quatro itens da lista estão errados ou presos à base:
- **`whatsapp/linha-comercial.ts` NÃO é casca.** É importado por `historico.ts:5`, `operacoes-atendimento.ts:12`, `acoes.ts:28`, `escopo.ts:6`, `atendimentos.ts:6` e `consultas-inbox.ts:11` (SPEC-ERP-005). **Manter.**
- **`src/server/ia` é importada pela base:**
  - `comercial/acoes.ts:30` + `:398` (`dispararCopilotoMudancaEtapa` dentro de `moverEtapa`);
  - `whatsapp/consultas-inbox.ts:1` + `:204` (`sugestoesPendentesDoLead`).
- **`CockpitLead` não é arquivo:** é uma função em `InboxCliente.tsx:1071-1220`, usada em `:562-563`.
- **O auto-lead está em `comercial/captura.ts:254-276`.** O `inbound.ts:149-164` chama `capturarComercial`, que faz auto-lead **e** saudação juntos. Desligar `ConfigComercial.autoLeadAtivo` (default `false`) já neutraliza o comportamento sem mudar código.

### 6.2 Item a item

| Item | Composição | Quem usa fora da casca | O que quebra | Schema/SQL |
|---|---|---|---|---|
| `/leads` | 20 arquivos (~2,1 mil linhas), inclusive `FichaLead.tsx` (839) e `[id]/contratacao/*` | `nav.ts:26-31`; `trilha.ts:21,110-111`; links em `InboxCliente.tsx:877,1117` e `MatriculaFormulario.tsx:379` | **Some a única tela de "Preparar contratação"** (`matricula/preparacao-comercial.ts:40`) e o único botão de **exportar leads** (a API `/api/exportacoes/leads` continua) | Não |
| `/pipeline` | `page.tsx`, `KanbanBoard.tsx` (427), `colunas.ts` | `nav.ts:20-25`; `trilha.ts:22`; `components/Esqueleto.test.ts:7-8,61-65` | `Esqueleto.test.ts` + travas globais | Não |
| `/carteiras` | `page.tsx`, `CoberturasPainel.tsx` + 3 testes | `nav.ts:18`; `acesso/coberturas.ts:24,39` | **A base fica sem UI para conceder ou revogar `CoberturaCarteira`.** O escopo continua funcionando com as coberturas já gravadas | Não |
| `/comissoes` | `page.tsx` (60) + teste | `nav.ts:14`; link em `alunos/[id]/financeiro/ResumoFinanceiroComercial.tsx:17` | **O VENDEDOR perde "minhas comissões"** (`page.tsx:17` aceita VENDEDOR, GC e FIN). Existe `/financeiro/comissoes` (guard `contextoDaAba`), mas não confirmei se o VENDEDOR enxerga | Não |
| `configuracao/whatsapp/comercial` e `/reguas` | `page.tsx` + `ComercialPainel.tsx` e `ReguaComercialPainel.tsx` (fora das pastas) | `secoes.ts:23-24,79-80,88-89`; `trilha.ts:92-93`; `configuracao/whatsapp/page.test.ts` | O GERENTE_COMERCIAL cai em `AcessoNegado` em `/configuracao/whatsapp` (fica sem nenhuma seção). `checkInToleranciaMinutos` continua sendo lido pela base (`home/consultas.ts:155,213`) sem UI | Não |
| `HomeVendedor` | `home/HomeVendedor.tsx` (171) + `dadosHomeVendedor` (`home/consultas.ts:39-116`) | `home/page.tsx:4-5,21,27-30` | Precisa editar `home/page.tsx`. Travas: `contraste.test.ts:58,929`, `responsivo.test.ts:15`, `estados-vazios-mapa.ts:88,579`, `botoes-mapa.ts:991` | Não |
| `CockpitLead` | `InboxCliente.tsx:1071-1220` | dados em `consultas-inbox.ts:36-38,166,198-209` | `InboxCliente.test.ts:8,22,44`; `botoes.test.ts:49,73` | Não |
| `CopilotoSugestoes` | `src/components/CopilotoSugestoes.tsx` (212) | `InboxCliente.tsx:40,565-573`; `FichaLead.tsx:9,203` | `botoes.test.ts:80,463,1170,1692` (`readFileSync`), `botoes-mapa.ts:1031`, `estados-vazios-mapa.ts:142`, `enums-rotulos.test.ts:1965` | Não |
| `src/server/ia` | 6 arquivos (~790 linhas) + 2 testes | **base:** `comercial/acoes.ts:30,398`; `whatsapp/consultas-inbox.ts:1,204`; `cron/route.ts:17,69` | **Erro de compilação na base.** Exige editar os dois arquivos que ficam | Não |
| `cron-comercial.ts` | 6 exports (`:183-420`) | `cron/route.ts:6-13`; **`matricula/fechamento.int.test.ts:22`** (teste da base); mock em `cobrancas/acesso-aulas.int.test.ts:11` | Ficam órfãos `fila.enfileirarIntencaoComercial`, `elegibilidade.reagendamentoPendente`, `comercial/regua-comercial.ts` e `regua-fabrica.ts` | Não |
| `cron-gestao.ts` | 4 exports | `cron/route.ts:18,71` + testes | só o route | Não |
| `linha-comercial.ts` | 7 exports | **6 módulos da base** | **Quebra o Inbox. Não é casca** | Não |
| "8 etapas CRM do cron" | **Não estão em `cron.ts`**, que é só cobrança: estão em `src/app/api/whatsapp/cron/route.ts` — `:60` leadNovo, `:61` preExperimental, `:62` noShow, `:64` contrato, `:65` linkPagamento, `:67` checkInVencido, `:69` copiloto, `:71` gestão | imports em `:6-18`; resposta em `:89-91`; `route.test.ts:7-14` | Ajustar mocks e o JSON. **Ficam (base):** `:73` comissões, `:76` fechamentos pendentes, `:79` linha comercial, `:81` despacho | Não |
| Auto-lead do inbound | `captura.ts:254-276` (+ saudação em `:278-294`); chamado em `inbound.ts:149-164`; a C2 usa `leadCriadoId` em `:169` | `whatsapp/acoes.ts:29` ("Criar lead" na Inbox usa `captura`) | Editar `captura.ts` ou só desligar a flag | Não |

**Travas globais que falham com arquivo ou pasta ausente** (precisam ser editadas na mesma entrega):
- `borda-rota-mapa.ts` + `borda-rota.test.ts`;
- `botoes.test.ts` (`AREAS_MIGRADAS`) + `botoes-mapa.ts`;
- `estados-vazios-mapa.ts`;
- `contraste.test.ts` + `contraste-mapa.ts`;
- `responsivo.test.ts`;
- `confirmacoes.test.ts` + `confirmacoes-mapa.ts:201`;
- `colunas-ordenaveis.test.ts:53`;
- `fuso-instante.test.ts:345`;
- `formularios-preservados.test.ts:676,762,790`;
- `vazio-paginado*`;
- `paginacao-dois-sentidos.test.ts:671,679`;
- `enums-rotulos.test.ts:1840,1965`;
- `Esqueleto.test.ts`;
- `configuracao/whatsapp/page.test.ts`;
- `home/page.test.ts`;
- `InboxCliente.test.ts`;
- `api/whatsapp/cron/route.test.ts`.

**Menus:** `nav.ts:14,18,20-31`, `secoes.ts`, `trilha.ts` (se forem removidas as entradas, `trilha.test.ts:60,64` falha). `proxy.ts` não lista rotas.

**`Comissao` e o escopo de carteira não dependem da casca.**
- `_shared/escopo-comercial.ts` importa só Prisma e a sessão.
- O código de `Comissao` fica em `financeiro/*`, `matricula/*`, `ajustes/*` e `contratos/aditivo-acerto-taxa-acoes.ts`.
- As funções SQL que leem `"Comissao"` são de acerto de taxa (base).

### 6.3 Mapa do model `Lead` (`prisma/schema.prisma:1313-1391`)

Não há CHECK nem trigger em `Lead`. Os índices são `Lead_codigo_key` (UNIQUE) e `Lead_telefoneE164_idx`.

**FKs que apontam para Lead** (conferido no catálogo):

| Tabela | ON DELETE |
|---|---|
| `Matricula` | SET NULL, @unique |
| `Documento` | **RESTRICT** |
| `ContatoWhatsApp` | SET NULL |
| `IntencaoMensagem` | SET NULL |
| `SugestaoIA` | **RESTRICT** |
| `AtendimentoWhatsApp` | **RESTRICT** |

| Linha | Campo | Tipo | Nulo | Default | Relação / índice | Uso |
|---|---|---|---|---|---|---|
| 1315 | id | String | não | cuid() | PK | ambos |
| 1316 | codigo | String | sim | — | UNIQUE | base (`gerarCodigo`, busca da Inbox) |
| 1317 | nome | String | não | — | — | ambos |
| 1318 | telefoneE164 | String | sim | — | idx | base (captura, Criar lead) |
| 1319-20 | paisId / pais | String? | sim | — | FK Pais SET NULL | ambos |
| 1321 | segmento | Segmento | não | ADULTO | — | ambos |
| 1322 | temperatura | Temperatura | não | MORNO | — | base (`definirTemperatura`, filtros) + casca |
| 1323 | etapa | EtapaLead | não | NOVO | — | ambos (a matrícula move para MATRICULADO) |
| 1324 | b2b | Boolean | não | false | — | ambos |
| 1325-26 | vendedorDonoId / vendedor | String? | sim | — | FK Usuario SET NULL | **base: escopo de carteira** (`escopo-comercial.ts:49`), financeiro, matrícula |
| 1332-33 | professorExperimentalId | String? | sim | — | FK Usuario SET NULL | base (escopo do professor no Inbox, home do professor) |
| 1337-1340 | origemCampanha, origemConjunto, origemAnuncio, origemPalavra | String | sim | — | — | comercial + ficha (casca) |
| 1346-1350 | waReferralSourceType, SourceId, Headline, SourceUrl, CtwaClid | String | sim | — | — | captura (auto-lead) + ficha |
| 1353-1357 | interesse, objetivo, urgencia, orcamento, objecao | String | sim | — | — | comercial (`atualizarResumo`) + casca (ficha, IA) |
| 1358 | proximaAcao | String | sim | — | — | comercial + casca |
| 1361 | proximoFollowUp | DateTime | sim | — | — | só `dadosHomeVendedor` e ficha (casca) |
| 1362 | dataExperimental | DateTime | sim | — | — | base (home, Inbox, despachante, elegibilidade) + casca |
| 1363 | dataProposta | DateTime | sim | — | — | comercial + casca |
| 1368 | experimentalConfirmadaEm | DateTime | sim | — | — | comercial, captura (C2) |
| 1373 | aguardandoReagendamentoEm | DateTime | sim | — | — | comercial, captura, despachante, cron-comercial |
| 1376 | valorPrevisto | Decimal(12,2) | sim | — | — | comercial + casca |
| 1377 | planoPrevisto | String | sim | — | — | comercial + casca |
| 1378 | comissaoPrevista | Decimal(12,2) | sim | — | — | comercial + casca (**não é `Comissao`**) |
| 1380 | motivoPerda | MotivoPerda | sim | — | — | comercial (`marcarPerdido`) + casca |
| 1381 | ultimaCobranca | DateTime | sim | — | — | **ninguém** |
| 1382 | criadoEm | DateTime | não | now() | — | ambos |
| 1384-1388 | matricula, documentos, contatosWhatsApp, intencoesWhatsApp, sugestoesIA, atendimentosWhatsApp (1314) | relações inversas | — | — | ver as FKs acima | — |

**Enums:**
- `EtapaLead` (`:1288`): NOVO, EM_ATENDIMENTO, QUALIFICADO, EXPERIMENTAL_AGENDADA, EXPERIMENTAL_REALIZADA, PROPOSTA, AGUARDANDO_MATRICULA, MATRICULADO, NO_SHOW, PERDIDO.
- `Temperatura` (`:1282`): QUENTE, MORNO, FRIO.
- `MotivoPerda` (`:1301`): 9 valores.
- `Segmento` (`:858`): compartilhado com o catálogo.
- **Não há** enum de origem nem de status.

**Satélites:**
- **Não existem** `InteracaoLead`, `HistoricoLead` nem `TarefaLead`. Histórico, notas, interações e mudanças de etapa são linhas de **`Evento`** (`:2226`, `agregadoTipo="Lead"`): LeadCriado, LeadAtribuido, EtapaAlterada, InteracaoRegistrada, NotaInterna, ExperimentalAgendada, PropostaEnviada, LeadPerdido etc.
- A máquina de etapas está em `_shared/regras.ts` (`TRANSICOES_MANUAIS`) e em `comercial/schema.ts:184,195`.
- Base relacionada: `CoberturaCarteira` (`:264`), `Comissao` (`:1992`, ligada a Matricula e Usuario, **não a Lead**), `Documento` (`:1402`).

**Para a futura Oportunidade:**
- **Renomear `Lead` exige reescrever as 4 funções SQL de desistência e segunda chamada que travam `"Lead"`**, além das FKs listadas acima.
- `Lead.matricula` é 1:1 (`Matricula.leadId @unique`). Uma Oportunidade por matrícula é uma restrição a reavaliar se a mesma pessoa puder ter várias oportunidades.

---

## Parte 7 — Riscos, decisões e perguntas em aberto

### 7.1 Decisões de negócio necessárias

1. **Régua de cobrança automática sem número oficial.**
   - Hoje a S1/D34 (doc 30:11; `cron.ts:56`; `despachante.ts:195`) proíbe o cron de cobrança em Baileys, pelo risco de ban.
   - Com motor só-Baileys, a régua automática **para**; só HUMANO e LOTE funcionam.
   - Manter um número Meta só para cobrança? Ou revogar a S1, aceitando o risco, com pacing no motor?
2. **Avisos de agenda** exigem META_CLOUD + template utility aprovado (`comunicacoes-agenda/whatsapp.ts:95-96`). Mesma pergunta. Hoje a rota nem está agendada.
3. **"Uma conversa contínua por contato":**
   - O contato é por telefone, mas a conversa é por **(número, contato)**.
   - Se a escola tiver mais de um número (vendas, cobrança, agenda), o novo modelo terá **uma conversa por contato atravessando números** ou continuará por número?
   - Isso define a chave única nova e o que fazer com `numeroId` nas mensagens.
4. **Atendimento no modelo novo:**
   - Os setores pedidos (Vendas, Secretaria, Financeiro, Pedagógico) batem com `FinalidadeAtendimentoWhatsApp` (COMERCIAL, SECRETARIA, FINANCEIRO, PEDAGOGICO).
   - Hoje faltam: status (além de encerrado), prazo/SLA, transferência (inexistente), reabertura (proibida) e a tela de encerramento (a ação existe, sem UI).
   - Quem pode transferir entre setores, e o que acontece com as regras imutáveis de FIN e PEDAG (triggers) numa transferência?
5. **O escopo pedagógico e o financeiro continuam?**
   - Professor só vê a própria turma.
   - Pedagógico esconde o telefone.
   - Financeiro só por matrícula, com o pagador atual.
   - Responsável legal exige autorização acadêmica vigente (trigger 264).

   Essas regras são do domínio, não do canal. Confirmar que valem no Inbox novo.
6. **Linha comercial (SPEC-ERP-005):** o vendedor com número próprio no celular, o histórico de 30 dias e a visibilidade do dono e do gerente continuam no motor novo? `linha-comercial.ts` fica como base.
7. **Telas da base que perdem UI** com a casca: "Preparar contratação" (`/leads/[id]/contratacao`), exportar leads, gerir `CoberturaCarteira` (`/carteiras`) e "minhas comissões" do VENDEDOR (`/comissoes`). Recriar no CRM novo ou mover antes?
8. **Copiloto IA, gestão e saudação:** somem com a casca. Confirmar que a saudação reativa no 1º contato (hoje comercial) não vira requisito do Inbox novo.

### 7.2 Riscos técnicos

| Risco | Evidência | Mitigação sugerida |
|---|---|---|
| Duas passadas do despachante por tick | `cron.ts:137` + `route.ts:81` | inofensivo pelo claim; manter uma só no desenho novo |
| Sem retry automático; FALHOU só sai por revisão humana | `elegibilidade.ts:7-10` | o motor deve diferenciar "não enviado" de "incerto" |
| Status não volta para a intenção; status órfão é perdido | `inbound.ts:223-239` | o contrato de eventos deve trazer o id do ERP (idempotency key) além do `providerMessageId` |
| Corrida do eco `fromMe` contra o commit do despachante | `inbound.ts:95-102`; `despachante.ts:504-566` | o ERP gera o id da mensagem antes de enviar; o motor ecoa esse id |
| Mídia salva antes do dedupe (arquivo órfão) | `meta/route.ts:136-141`; `evolution/route.ts:172-181` | dedupe antes de baixar |
| Tipos não suportados contam como inbound real | sem filtro de reação, sticker ou edição | filtrar no motor |
| Webhooks síncronos e sem anti-replay; segredo comparado com `!==` | `evolution/route.ts:101-104`; `cron/route.ts:47` | HMAC + timestamp + `timingSafeEqual` |
| Sem tempo real; um Inbox "WhatsApp Web" com polling de 30 s fica aquém | `InboxCliente.tsx:115-135` | definir SSE/websocket (não há infraestrutura hoje: nem Redis nem `LISTEN/NOTIFY`) |
| Lista sem paginação (200 + 500) e thread limitada a 300 mensagens | `consultas-inbox.ts:79-103,127-170` | cursor no Inbox novo |
| Agendamento de crons fora do repositório | agenda, portal e continuidade não agendados | registrar no compose ao ativar |
| Descarte de dados de WhatsApp | RESTRICT em `ConfiguracaoOperacional` e na cadeia Intencao → Mensagem → Atendimento | ordem de truncate; nova migration reservada pelo integrador |
| A janela da agenda herda a política de **cobrança** | `despachante.ts:165-167` | decidir a política própria da agenda |
| Gestão sempre FALHA em Meta (sem template) | `despachante.ts:422` | — (vai embora com a casca) |
| `Matricula.contratoEnviadoEm` nunca é gravado; a cadência "contrato" talvez nunca dispare | grep sem escrita em `src/` | — (casca) |
| Divergências de documentação | doc 31 (cron horário × 5 min); doc 14 / `vitest.integration.config.ts:23-24` (URL fixa × perfil); doc 44:293 (perfil `claude` fora da lista) | atualizar docs na entrega |

### 7.3 Não verificado

- **Nenhum teste, `tsc` do projeto, build ou app foi executado** (sem `node_modules`, e a instalação é vedada). As quebras listadas na Parte 6 vêm de leitura, não de execução. As contagens de testes são por grep.
- **O documento de referência** `remocao-crm-levantamento-dependencias.md` não foi encontrado (main, branches remotos, PRs #177–#180). A Parte 6 não foi cruzada com ele.
- **Catálogo SQL:** conferido num banco recém-migrado (438 migrations), não no UAT nem na produção. Não sei se UAT ou produção têm divergências (por exemplo, migrations aplicadas e depois editadas).
- **Payload real da Evolution 2.3.7:** LID, `remoteJidAlt`, `messages.set` e eco `fromMe` de mensagens enviadas pela API. O `quadro-entregas.md:122` registra isso como pendente.
- **O que está agendado de fato fora do repositório** (painel do Coolify, crontab do host, monitor do `/api/whatsapp/health`).
- **Dados reais:** quantos atendimentos legados, participantes, templates e números existem.
- **Guard de `/financeiro/comissoes`** (`contextoDaAba`): não confirmei se o VENDEDOR enxerga essa aba.
- **Se `vi.mock` de módulo inexistente** (`acesso-aulas.int.test.ts:11`) quebra no vitest.
- **Uso campo a campo** dos campos genéricos de `Lead` (id, nome, etapa, segmento): classificados por inspeção, sem grep exaustivo.
- **Docs lidos parcialmente:** 07, 08, 15, 27, 33, 34, 36, 37, 44 e o `quadro-entregas.md` inteiro.
- **Aceitação de `audio/webm` pela Meta** (gravação do navegador) num número oficial.
- **Se a corrida do eco `fromMe`** (§7.2) ocorre na prática.
