# Auditoria: Modelo de dados, eventos e regras

Projeto: ERP Genius (`C:\Users\Mendes\Documents\GitHub\erp-genius`, branch `main`, HEAD `bc858aff`).
Docs lidos na íntegra: `docs/11-modelo-de-dados.md`, `docs/12-catalogo-de-eventos.md`, `docs/10-regras-sistema.md`, `docs/13-convencoes-codigo.md`, `docs/02-arquitetura.md` (§"Modelagem orientada a EVENTOS").
Código cruzado: `prisma/schema.prisma` (36 models, 34 enums), `prisma/migrations/` (37 migrations), `src/server/_shared/*`, `src/lib/codigo.ts`, `src/lib/dinheiro.ts`, todos os `registrarEvento(` em `src/server/**` e `src/app/api/**`.
Todas as linhas citadas são do estado atual do repositório. "Não encontrado" = procurado por grep e não existe no repositório.

## Resumo

- **Models/enums (doc 11 vs schema):** 25 models + 23 enums documentados, todos existem no schema. **11 models e 11 enums existem no schema e não estão no doc 11** (todo o canal WhatsApp + automação comercial: `NumeroWhatsApp`, `ContatoWhatsApp`, `ConversaWhatsApp`, `MensagemWhatsApp`, `IntencaoMensagem`, `TemplateWhatsApp`, `PoliticaRegua`, `DegrauPolitica`, `PoliticaComercial`, `DegrauComercial`, `ConfigComercial`). Entre os documentados: 19 CONFORME, 6 PARCIAL/DIVERGENTE (campos a mais no schema em `Lead`, `Matricula`, `Cobranca`, `Usuario`, `Aluno`, `Responsavel`). Nenhum enum documentado diverge em valores.
- **Eventos (doc 12 vs código):** 103 tipos distintos levantados. 90 documentados e emitidos (CONFORME ou PARCIAL no payload), 1 emitido sem doc (`ExperimentalAtribuida` — SEM_DOC), 8 documentados sem emissor no repositório (3 de carga Q10 one-shot + 5 "reservados"), 6 com payload PARCIAL. A seção "Estado de implementação" do doc 12 está **desatualizada**: lista como "planejados" 20 eventos que já são emitidos.
- **Regras (doc 10):** 27 regras avaliadas: 15 CONFORME, 8 PARCIAL, 2 DIVERGENTE (gatilho de ativação da matrícula; status `RASCUNHO` nunca usado), 3 NAO_IMPLEMENTADO (notificações, busca global, regra dos 90 dias do dono).
- **Achado mais relevante para o QA:** a matrícula ativa com **só a taxa quitada** (`primeiraMensalidadeOk` fica `false`, `contratoOk` vira `true` automaticamente) — diferente da regra P7 escrita nos docs 10/11.

---

## Models e enums: doc 11 vs schema

Legenda das colunas: "No doc?" = aparece no doc 11; "No schema?" = aparece em `prisma/schema.prisma` (linha).

### Models

| Model/Enum | No doc? | No schema? | Diferenças | Status |
|---|---|---|---|---|
| `Usuario` | Sim | Sim (L31) | Campos batem. Schema tem relações a mais não citadas: `experimentais` (L48, professor da experimental), `movimentacoes` (L55), `numerosWhatsApp`/`mensagensWhatsApp`/`intencoesWhatsApp` (L56-58). | PARCIAL |
| `Pais` | Sim | Sim (L72) | Campos batem; relação `precos` (L85) não citada. | CONFORME |
| `TipoDocumento` | Sim | Sim (L91) | Relação `alunos` (L97) não citada. | CONFORME |
| `Idioma` | Sim | Sim (L111) | — | CONFORME |
| `Modalidade` | Sim | Sim (L119) | Relação `precos` (L131) não citada. | CONFORME |
| `Nivel` | Sim | Sim (L134) | — | CONFORME |
| `Produto` | Sim | Sim (L145) | Relação `precos` (L152) não citada. | CONFORME |
| `ProdutoPais` | Sim | Sim (L166) | — | CONFORME |
| `PrecoReferencia` | Sim | Sim (L181) | Campos batem. Doc não menciona o **índice único parcial** "um preço ativo por chave" (`prisma/migrations/20260622120000_preco_ativo_unico`, comentado em L196-203). | PARCIAL |
| `Turma` | Sim | Sim (L219) | Campos batem (inclui `online`, `diasSemana`, `horarioInicio/Fim`, `diasHorario`, `rolling`). | CONFORME |
| `Aluno` | Sim | Sim (L284) | Campos batem. Schema tem `contatosWhatsApp` (L339) e `@@index([telefoneE164])` (L341) não citados. | PARCIAL |
| `Responsavel` | Sim | Sim (L344) | `contatosWhatsApp` (L352) e índice de telefone (L354) não citados. | PARCIAL |
| `AlunoResponsavel` | Sim | Sim (L363) | `papel` tem default `FINANCEIRO` (L369), doc não diz. | CONFORME |
| `AlocacaoTurma` | Sim | Sim (L372) | Doc não menciona índice único parcial "uma alocação ativa por aluno" (migration `integridade_alocacao_preco`, comentário L381-383). | PARCIAL |
| `MovimentacaoAluno` | Sim | Sim (L400) | — (doc 11 descreve mas não lista no "Mapa dos módulos"). | CONFORME |
| `Lead` | Sim | Sim (L455) | **Schema tem 7 campos a mais:** `professorExperimentalId` (L473, Issue #13), `waReferralSourceType/SourceId/Headline/SourceUrl/CtwaClid` (L487-491, migration `20260718200000_lead_referral_cru`), `experimentalConfirmadaEm` (L509, migration `20260720160000_lead_experimental_confirmada`); relações `contatosWhatsApp`/`intencoesWhatsApp` (L522-523); `@@index([telefoneE164])` (L525). | DIVERGENTE |
| `Documento` | Sim | Sim (L537) | — (não aparece no "Mapa dos módulos"). | CONFORME |
| `Matricula` | Sim | Sim (L562) | **Schema tem 4 campos a mais:** `precoReferenciaAusente` + `justificativaSemPreco` (L588-589; citados só no doc 10 §3.1), `acessoBloqueado` + `bloqueadoEm` (L599-600, migration `20260626160000_matricula_acesso_bloqueado`). | DIVERGENTE |
| `Cobranca` | Sim | Sim (L626) | Schema tem `comprovanteNome` (L643, migration `20260622120000_cobranca_comprovante_nome`) e relação `intencoesWhatsApp` (L647). | PARCIAL |
| `Comissao` | Sim | Sim (L657) | — | CONFORME |
| `AjusteFinanceiro` | Sim | Sim (L727) | — | CONFORME |
| `Aprovacao` | Sim | Sim (L696) | — | CONFORME |
| `TaxaCambio` | Sim | Sim (L763) | — (`unidadesPorUsd` Decimal(14,6)). | CONFORME |
| `Evento` | Sim | Sim (L777) | — | CONFORME |
| `Contador` | Sim | Sim (L797) | — | CONFORME |
| `NumeroWhatsApp` | **Não** | Sim (L825) | `telefoneE164` unique, `@@unique([driver, providerRef])` (L847). | SEM_DOC |
| `ContatoWhatsApp` | **Não** | Sim (L850) | `telefoneE164` unique (1ª unicidade de telefone do sistema, L852), `waId` unique, vínculos opcionais aluno/responsável/lead, `optOutEm`. | SEM_DOC |
| `ConversaWhatsApp` | **Não** | Sim (L871) | `@@unique([numeroId, contatoId])`, `capturadaEm` (claim atômico C1). | SEM_DOC |
| `MensagemWhatsApp` | **Não** | Sim (L923) | `@@unique([numeroId, providerMessageId])`. | SEM_DOC |
| `IntencaoMensagem` | **Não** | Sim (L964) | Outbox; `@@unique([cobrancaId, passo])` + índice único parcial comercial (migration `20260720180000_ocorrencia_cadencia_comercial`). | SEM_DOC |
| `TemplateWhatsApp` | **Não** | Sim (L1037) | `nome` unique; `statusMeta`. | SEM_DOC |
| `PoliticaRegua` | **Não** | Sim (L1069) | `nome` unique; `killSwitch`; `estado` default DESLIGADA. | SEM_DOC |
| `DegrauPolitica` | **Não** | Sim (L1089) | `@@unique([politicaId, passo])`. | SEM_DOC |
| `PoliticaComercial` | **Não** | Sim (L1118) | `chave` unique. | SEM_DOC |
| `DegrauComercial` | **Não** | Sim (L1137) | `@@unique([politicaId, passo])`; `offsetMinutos`. | SEM_DOC |
| `ConfigComercial` | **Não** | Sim (L1151) | Singleton `id = "comercial"`; `autoLeadAtivo`, `saudacaoEstado`, `saudacaoTexto`. | SEM_DOC |

### Enums

| Enum | No doc? | No schema? | Diferenças | Status |
|---|---|---|---|---|
| `Papel` (7) | Sim | Sim (L21) | — | CONFORME |
| `StatusPais` | Sim | Sim (L65) | — | CONFORME |
| `Segmento` | Sim | Sim (L104) | — | CONFORME |
| `TipoCobranca` | Sim | Sim (L156) | — | CONFORME |
| `StatusTurma` | Sim | Sim (L212) | — | CONFORME |
| `StatusAluno` | Sim | Sim (L252) | — | CONFORME |
| `Genero` | Sim | Sim (L260) | — (sem `OUTRO`, como o doc diz) | CONFORME |
| `Escolaridade` (10) | Sim | Sim (L267) | — | CONFORME |
| `PapelResponsavel` | Sim | Sim (L357) | — | CONFORME |
| `TipoMovimentacao` | Sim | Sim (L392) | — | CONFORME |
| `Temperatura` | Sim | Sim (L424) | — | CONFORME |
| `EtapaLead` (10) | Sim | Sim (L430) | — | CONFORME |
| `MotivoPerda` (9) | Sim | Sim (L443) | — | CONFORME |
| `CategoriaDocumento` | Sim | Sim (L528) | — | CONFORME |
| `StatusMatricula` | Sim | Sim (L554) | Valores batem; mas `RASCUNHO`, `ENCERRADA` e `CANCELADA` **nunca são gravados pelo código** (ver Regras #3). | CONFORME (enum) |
| `OrigemNivel` | Sim | Sim (L607) | — | CONFORME |
| `StatusCobranca` | Sim | Sim (L612) | Valores batem; `ATRASADO` nunca é gravado (só lido) — ver Regras #4. | CONFORME (enum) |
| `FormaPagamento` | Sim | Sim (L619) | — | CONFORME |
| `StatusComissao` | Sim | Sim (L650) | `ESTORNADA` só em `src/lib/labels.ts:81`; nunca gravada. | CONFORME (enum) |
| `TipoAprovacao` | Sim | Sim (L676) | — | CONFORME |
| `StatusAprovacao` | Sim | Sim (L684) | — | CONFORME |
| `Vigencia` | Sim | Sim (L690) | — | CONFORME |
| `TipoAjuste` | Sim | Sim (L719) | — | CONFORME |
| `DriverWhatsApp`, `FinalidadeNumero`, `SessaoNumero`, `DirecaoMensagem`, `TipoMensagem`, `StatusMensagem`, `OrigemEnvio`, `StatusIntencao` (7 valores, `ENVIANDO` adicionado na migration `20260713173011`), `StatusTemplate`, `ModoDegrau`, `EstadoPolitica` | **Não** | Sim (L808-1064) | Criados na migration `20260706183913_whatsapp_canal_bimotor` e seguintes. | SEM_DOC |

### Migrations recentes não cobertas pelo doc 11
Da `20260626120000_taxa_cambio` em diante (18 migrations), o doc 11 cobre só `TaxaCambio`. Não cobertas: `matricula_acesso_bloqueado`, `dinheiro_decimal` (dinheiro virou `Decimal(12,2)` — o doc já descreve como Decimal, ok), `whatsapp_canal_bimotor`, `whatsapp_provider_ref_variaveis`, `intencao_status_enviando`, `whatsapp_e3_inbox_midia`, `numero_provider_ref_unico_por_driver`, `intencao_atualizado_em`, `comercial_c1_autolead_saudacao`, `conversa_capturada_em`, `backfill_conversa_capturada`, `config_comercial_saudacao_estado`, `lead_referral_cru`, `regua_comercial_lead_novo`, `idempotencia_comercial_por_politica`, `lead_experimental_confirmada`, `idempotencia_comercial_indice_parcial`, `ocorrencia_cadencia_comercial`.

---

## Eventos: doc 12 vs código

Infra: `registrarEvento(tx, {...})` em `src/server/_shared/evento.ts:60-74` grava `Evento` com `versao` default 1. O tipo `AgregadoTipo` (`evento.ts:8-32`) já inclui os agregados WhatsApp/comerciais. 88 call sites de `registrarEvento(` fora de `_shared` (contagem por `grep`). Scripts de carga Q10 (docs 19-23) **não estão no repositório** (`scripts/` contém só `backup-producao.sh` e `test-db.mjs`), por isso os eventos "só de carga" constam como não encontrados.

### Comercial (agregado `Lead`)

| Evento | No doc? | Emitido em (arquivo:linha) | Status |
|---|---|---|---|
| `LeadCriado` | Sim | `src/server/comercial/acoes.ts:119` (payload `{codigo, nome, segmento, b2b}` — **sem `origem`**); `src/server/comercial/captura.ts:86` (auto-captura, autor `null`, `{codigo, nome, origem:"whatsapp_inbound", b2b:false}`) | PARCIAL (payload manual sem `origem`) |
| `LeadAtribuido` | Sim | `comercial/acoes.ts:127` (`{de:null, para}`), `comercial/acoes.ts:762` (reatribuição, `{de, para, motivo}`), `comercial/captura.ts:94` (`{de, para, via:"whatsapp_inbound"}`) | CONFORME |
| `EtapaAlterada` | Sim | `comercial/acoes.ts:331` (`{de, para, origem:"manual"}`); `src/server/matricula/acoes.ts:339` (→ AGUARDANDO_MATRICULA) e `:539` (→ MATRICULADO) | CONFORME |
| `ExperimentalAgendada` | Sim | `comercial/acoes.ts:398` (`{data}`) | CONFORME |
| `ExperimentalRealizada` | Sim | `comercial/acoes.ts:550` (check-in, `{data}`) — doc pede `{turmaId, data}` | PARCIAL (payload sem `turmaId`; doc 12 "Estado de implementação" ainda o lista como planejado) |
| `NoShow` | Sim | `comercial/acoes.ts:550` (`{data}`) | CONFORME (doc 12 "Estado" desatualizado) |
| `PropostaEnviada` | Sim | `comercial/acoes.ts:433` (`{data}`) | CONFORME |
| `LeadPerdido` | Sim | `comercial/acoes.ts:456` (`{motivoPerda, observacao}`) | CONFORME |
| `LeadEditado` | Sim | `comercial/acoes.ts:182`, `:221` | CONFORME |
| `ResumoAtualizado` | Sim | `comercial/acoes.ts:254` | CONFORME |
| `DatasAtualizadas` | Sim | `comercial/acoes.ts:291` | CONFORME |
| `InteracaoRegistrada` | Sim | `comercial/acoes.ts:351` (`{canal, nota}`) | CONFORME |
| `NotaInterna` | Sim | `comercial/acoes.ts:159` | CONFORME |
| `DocumentoAnexado` | Sim | `comercial/acoes.ts:481` | CONFORME |
| `DocumentoArquivado` | Sim | `comercial/acoes.ts:503` | CONFORME |
| `ReguaComercialEnviada` | Sim | helper `src/server/cobrancas/eventos.ts:46` (`{chave, passo, ocorrencia, canal:"api"}`, autor `null`); chamado por `src/server/whatsapp/despachante.ts:391`, `src/server/whatsapp/cron-comercial.ts:256`, `comercial/captura.ts:162` | CONFORME |
| `ExperimentalConfirmada` | Sim | `comercial/captura.ts:180` (`{via:"whatsapp_keyword"}`) | CONFORME |
| `ExperimentalReagendamentoSolicitado` | Sim | `comercial/captura.ts:190` | CONFORME |
| `ExperimentalAtribuida` | **Não** | `comercial/acoes.ts:408` (ao agendar, se mudou professor) e `:583` (`atribuirProfessorExperimental`); constante em `src/server/comercial/experimental.ts:13`; payload `{de, professorId}` | SEM_DOC |

### Matrícula (agregado `Matricula`)

| Evento | No doc? | Emitido em | Status |
|---|---|---|---|
| `MatriculaCriada` | Sim | `src/server/matricula/acoes.ts:348` (`{codigo, alunoId, produtoId, leadId}`) — nasce em `AGUARDANDO` (`:218`), não em "rascunho" como diz o gatilho do doc | CONFORME (gatilho descrito com nome de status errado) |
| `MatriculaAtivada` | Sim | `matricula/acoes.ts:548` (`{ativadaEm, lastro:"TAXA_QUITADA", forma, valorRecebido, taxaValor, troco, primeiraMensalidadeVencimento}`) | CONFORME (payload superset) — **gatilho diverge**, ver Regras #3 |
| `CobrancaGerada` | Sim | `matricula/acoes.ts:518` (`{quantidade, tipo:"MENSALIDADE"}`) | CONFORME |
| `ComissaoGerada` | Sim | `matricula/acoes.ts:362` (`{vendedorId, percentual}`) | CONFORME |
| `ComissaoAprovada` | Sim | `matricula/acoes.ts:563` (sem payload) | CONFORME |
| `MatriculaSemPrecoReferencia` | Sim | `matricula/acoes.ts:233` (payload `{produtoId, paisId, justificativa}`) — doc pede também `tiposAusentes, taxaValor, mensalidadeValor` | PARCIAL |
| `MatriculaImportada` | Sim (carga Q10) | não encontrado (script one-shot fora do repo) | NAO_IMPLEMENTADO (no repositório) |
| `ComissaoImportada` | Sim (carga Q10) | não encontrado | NAO_IMPLEMENTADO (no repositório) |
| `ValorNegociado`, `MatriculaAtivadaComPendencia`, `MatriculaCancelada`, `ComissaoEstornada` | Sim (reservados) | não encontrado | NAO_IMPLEMENTADO (conforme o doc) |

### Financeiro (agregados `Cobranca` / `Comissao` / `TaxaCambio`)

| Evento | No doc? | Emitido em | Status |
|---|---|---|---|
| `PagamentoRegistrado` | Sim | `src/server/financeiro/acoes.ts:72` (`{valorRecebido, recebidoAcumulado, forma, saldo, quitada, excedente, comprovante…}`); `matricula/acoes.ts:459` (baixa da taxa na ativação) | CONFORME |
| `CobrancaRenegociada` | Sim | `src/server/ajustes/acoes.ts:145-150` (via `aplicarAjuste`, payload `{de, para, descontoValor, vigencia, motivo, novoVencimento}`) | CONFORME (doc 12 "Estado" o lista como não implementado — desatualizado) |
| `BolsaConcedida` | Sim | `ajustes/acoes.ts:148` | CONFORME (idem) |
| `CobrancaPerdoada` | Sim | `ajustes/acoes.ts:147` (também marca a cobrança `CANCELADA` em `:111`) | CONFORME (idem) |
| `DescontoSolicitado` | Sim | `ajustes/acoes.ts:251` (`{percentual, vigencia, aprovacaoId}`) | CONFORME |
| `AprovacaoDecidida` | Sim | `ajustes/acoes.ts:299` (REJEITADA, `{status, motivo}`), `:332` (APROVADA, `{status}`) | CONFORME |
| `ComissaoPaga` | Sim | `financeiro/acoes.ts:135` (`{pagaEm, valor}`) | CONFORME |
| `CobrancaEnviadaWhatsApp` | Sim (v2) | helper `src/server/cobrancas/eventos.ts:25` (`versao: 2`, `{modelo, passo, canal}`); chamado em `financeiro/acoes.ts:108` (`canal:"manual"`) e `whatsapp/despachante.ts:382` (`canal:"api"`) | CONFORME |
| `PromessaPagamento` | Sim | `src/server/cobrancas/acoes.ts:51` | CONFORME |
| `AcessoBloqueado` | Sim | `cobrancas/acoes.ts:78` (agregado Matricula; papel `GERENTE_COMERCIAL`+Admin, `:20`) | CONFORME |
| `AcessoDesbloqueado` | Sim | `cobrancas/acoes.ts:100` | CONFORME |
| `TaxasCambioDefinidas` | Sim | `financeiro/acoes.ts:168` (manual, `{entradas, vigenteEm}` — sem `fonte`), `:229` (busca automática `open.er-api.com`) | CONFORME |

### Canal WhatsApp / automação comercial

| Evento | No doc? | Emitido em | Status |
|---|---|---|---|
| `OptOutRegistrado` | Sim | `src/server/whatsapp/acoes.ts:426` (`{via:"botao"}`); `src/server/whatsapp/inbound.ts:134` (`{via:"keyword", palavra}`) | CONFORME |
| `OptOutRemovido` | Sim | `whatsapp/acoes.ts:453` (`{}`) | CONFORME |
| `ContatoVinculado` | Sim | `whatsapp/acoes.ts:395` | CONFORME |
| `ReguaRetomada` | Sim | `whatsapp/acoes.ts:337` (`{conversaId}`) | CONFORME |
| `NumeroWhatsAppCriado` | Sim | `whatsapp/acoes.ts:564` (`{telefoneE164, driver, finalidade}`) | CONFORME |
| `NumeroWhatsAppAlterado` | Sim | `whatsapp/acoes.ts:525` | CONFORME |
| `NumeroWhatsAppConectado` | Sim | `src/server/whatsapp/sessao.ts:75` (`{via, de}`) | CONFORME |
| `SessaoBaileysCaiu` | Sim | `whatsapp/sessao.ts:83` (`{via}`) | CONFORME |
| `TemplateCriado` | Sim | `whatsapp/acoes.ts:664` (`{nome, idioma, categoria}`) | CONFORME |
| `TemplateAlterado` | Sim | `whatsapp/acoes.ts:646` | CONFORME |
| `TemplateSubmetido` | Sim | `whatsapp/acoes.ts:701` (`{metaTemplateId}`) | CONFORME |
| `TemplateAprovado` / `TemplateRejeitado` | Sim | `src/server/whatsapp/meta-templates.ts:107-115` (`{via, de, motivo}`, autor `null`) | CONFORME |
| `PoliticaReguaAlterada` | Sim | `whatsapp/acoes.ts:857` (salvar política, `{antes, depois}`), `:884` (kill switch, `{antes:{killSwitch}, depois:{killSwitch}}`) | CONFORME |
| `ConfigComercialAlterada` | Sim | `comercial/acoes.ts:611` | CONFORME |
| `PoliticaComercialAlterada` | Sim | `comercial/acoes.ts:731` | CONFORME |

### Alunos (agregado `Aluno`)

| Evento | No doc? | Emitido em | Status |
|---|---|---|---|
| `AlunoMatriculado` | Sim | `matricula/acoes.ts:355` (`{matriculaId, turmaId}`) — disparado na **criação** da matrícula, não na ativação como diz o gatilho do doc | PARCIAL (gatilho) |
| `AlunoEditado` | Sim | `src/server/alunos/acoes.ts:146` (`{de, para, motivo}` com diff só do que mudou) | CONFORME |
| `AlunoImportado` | Sim | `src/app/api/alunos/importar/route.ts:186` (`{origem:"xlsx", linha, codigo}`) | CONFORME (`ALUNO_IMPORTADO` legado: não encontrado no repo) |
| `AlunoVinculadoTurma` | Sim (carga Q10) | não encontrado | NAO_IMPLEMENTADO (no repositório) |
| `TrocaTurma` | Sim | `alunos/acoes.ts:300` (`{de, para, motivo}`) | CONFORME |
| `AlunoPausado` | Sim | `alunos/acoes.ts:191` (payload só `{motivo}`; `dataRetornoPrevista` vai para `MovimentacaoAluno.observacao` em `:185`) | PARCIAL (payload) |
| `AlunoReativado` | Sim | `alunos/acoes.ts:221` (**sem payload**; doc pede `{data}`) | PARCIAL (payload) |
| `AlunoEncerrado` | Sim | `alunos/acoes.ts:254` (`{motivo, observacao}`) | CONFORME |
| `AvancoNivel` | Sim (reservado) | não encontrado | NAO_IMPLEMENTADO (conforme o doc) |

### Configuração / Mercado

| Evento | No doc? | Emitido em | Status |
|---|---|---|---|
| `PaisCriado` / `PaisEditado` | Sim | `src/server/paises/acoes.ts:67` / `:109` | CONFORME |
| `PaisAtivado` / `PaisPausado` / `PaisEncerrado` / `PaisRascunho` | Sim | `paises/acoes.ts:152` via mapa `EVENTO_STATUS` (`:121-126`), payload `{de, para}` | CONFORME (doc 12 "Estado" diz planejado — desatualizado) |
| `ProdutoHabilitadoPais` / `ProdutoDesabilitadoPais` | Sim | `paises/acoes.ts:34` | CONFORME |
| `IdiomaCriado` | Sim | `src/server/catalogo/acoes.ts:37` | CONFORME |
| `IdiomaAtivado` / `IdiomaDesativado` | Sim | `catalogo/acoes.ts:58` | CONFORME (doc "Estado" desatualizado) |
| `ModalidadeCriada` / `ModalidadeEditada` | Sim | `catalogo/acoes.ts:87` / `:120` | CONFORME |
| `NivelCriado` | Sim | `catalogo/acoes.ts:146` | CONFORME |
| `ProdutoCriado` | Sim | `catalogo/acoes.ts:175` | CONFORME |
| `PrecoDefinido` | Sim | `catalogo/acoes.ts:219` (inativa irmãos em `:208`) | CONFORME |
| `PrecoDesativado` / `PrecoReativado` | Sim | `catalogo/acoes.ts:267` | CONFORME (doc "Estado" desatualizado) |
| `TurmaCriada` / `TurmaEditada` | Sim | `src/server/turmas/acoes.ts:94` / `:136` | CONFORME |
| `TurmaImportada` | Sim | `src/app/api/turmas/importar/route.ts:217` (`{origem:"xlsx", linha, codigo}`) | CONFORME |
| `TurmaPlanejada` / `TurmaAberta` / `TurmaEmAndamento` / `TurmaConcluida` | Sim | `turmas/acoes.ts:165` via `EVENTO_STATUS` (`:148-153`) | CONFORME (doc "Estado" desatualizado) |
| `AberturaTurmaSolicitada` | Sim | `turmas/acoes.ts:55` | CONFORME |
| `UsuarioCriado` / `UsuarioEditado` | Sim | `src/server/acesso/acoes.ts:43` / `:84` | CONFORME |
| `UsuarioAtivado` / `UsuarioDesativado` | Sim | `acesso/acoes.ts:111` (`{de, para}`) | CONFORME (doc "Estado" desatualizado) |

### Observações sobre o doc 12
1. A seção **"Estado de implementação (junho/2026)"** está defasada: lista como "planejados / sem gatilho" `ExperimentalRealizada`, `NoShow`, `CobrancaRenegociada`, `BolsaConcedida`, `CobrancaPerdoada` e os ciclos de status de `Pais`/`Idioma`/`Preco`/`Turma`/`Usuario`, todos emitidos hoje. Também não cita `PromessaPagamento`, `AcessoBloqueado/Desbloqueado`, `ResumoAtualizado`, `DatasAtualizadas`, `MatriculaSemPrecoReferencia` nem os eventos WhatsApp na lista de "disparados hoje".
2. `ExperimentalAtribuida` é emitido (2 pontos) e não consta no catálogo.
3. Convenção "mesma transação": todos os 88 pontos de `registrarEvento` recebem um `tx` de `prisma.$transaction` (inclusive `registrarInteracao`, `comercial/acoes.ts:347-356`, e `enviarCobrancaWhatsApp`, `financeiro/acoes.ts:107-114`, que abrem transação só para o evento). CONFORME.

---

## Regras do doc 10

| # | Regra | Implementada em (arquivo:linha) | Status | Impacto para o QA |
|---|---|---|---|---|
| 1 | §1 Máquina de estados do **Lead** (quem dispara cada transição; Perdido/No-show como saídas) | Transições manuais: `src/server/_shared/regras.ts:354-385` (`TRANSICOES_MANUAIS`, `transicaoManualPermitida`); etapas manuais `src/server/comercial/schema.ts:145-150` (`NOVO, EM_ATENDIMENTO, QUALIFICADO, EXPERIMENTAL_AGENDADA`); recusa no servidor `comercial/acoes.ts:315-327`; etapas por ação: agendar `:385-398`, proposta `:420-433`, perdido `:445-456`, check-in `:521-553` (só `PROFESSOR` atribuído, `regras.ts:184-199`); matrícula → `AGUARDANDO_MATRICULA` `matricula/acoes.ts:334-343`, → `MATRICULADO` `:535-544` | CONFORME | O Kanban aceita **retrocessos** não descritos no doc (`EM_ATENDIMENTO→NOVO`, `EXPERIMENTAL_REALIZADA→QUALIFICADO`, `NO_SHOW→EXPERIMENTAL_AGENDADA`, `AGUARDANDO_MATRICULA→PROPOSTA`). Saltos para `PROPOSTA`/`MATRICULADO`/`PERDIDO` por arraste devem falhar com `ErroRegra`. |
| 2 | §1 Máquina do **Aluno** (`Ativo ⇄ Pausado`, `Ativo → Encerrado`) | `src/server/alunos/acoes.ts:174` (pausar só ATIVO), `:207` (reativar só PAUSADO), `:237` (encerrar: qualquer status ≠ ENCERRADO, i.e. **PAUSADO → ENCERRADO também é aceito**); grava `MovimentacaoAluno` + `Evento`; pausa/encerramento **cancelam mensalidades futuras** (`:157-165`, não descrito no doc 10) | PARCIAL | Testar: pausar aluno pausado (erro), reativar aluno ativo (erro), encerrar aluno pausado (aceito), e conferir que cobranças `PENDENTE` com vencimento futuro viram `CANCELADA` após pausa/encerramento. |
| 3 | §1 Máquina da **Matrícula** (`Rascunho → Aguardando → Ativa → Encerrada`; ATIVA exige `contratoOk && pagamentoTaxaOk && primeiraMensalidadeOk`; Admin/Gerente ativa com pendência) | Criação direta em `AGUARDANDO` (`matricula/acoes.ts:218`); ativação em `:395-495`: exige **apenas taxa quitada** (`alocarPagamento` `:417-427`), grava `contratoOk:true`, `pagamentoTaxaOk:true`, **`primeiraMensalidadeOk:false`**, **`ativadaComPendencia:false`** (`:485-495`). `RASCUNHO`, `ENCERRADA`, `CANCELADA` **nunca são gravados** (grep `StatusMatricula.(RASCUNHO|ENCERRADA|CANCELADA)` em `src/` sem resultado). Nenhum fluxo "ativar com pendência". | DIVERGENTE | A regra P7 do doc não é o comportamento real: matrícula fica ATIVA com 1ª mensalidade PENDENTE; `contratoOk` é marcado sem ninguém confirmar contrato. Não há como encerrar/cancelar matrícula pela UI. Cenários de "ativar com pendência" não existem. |
| 4 | §1 Máquina da **Cobrança** (`Pendente → Paga`, `Pendente → Vencida → Paga`, `Cancelada`) | Baixa: `financeiro/acoes.ts:42-63` (recusa PAGO/CANCELADA; parcial mantém PENDENTE); `CANCELADA` por perdão `ajustes/acoes.ts:111` e por pausa/encerramento `alunos/acoes.ts:164`. `ATRASADO` **nunca é escrito** — "vencida" é derivada por `vencimento < agora` (`alunos/consultas.ts:88`, `ajustes/consultas.ts:100`, `cobrancas/consultas.ts:196`) | PARCIAL | Na UI o status "Atrasado" é calculado na leitura; no banco a cobrança vencida continua `PENDENTE`. Checagens de dados devem olhar `vencimento`, não `status`. |
| 5 | §1 Máquina da **Comissão** (`Pendente → Aprovada → Paga`, `Estornada`) | PENDENTE na criação `matricula/acoes.ts:326-332`; APROVADA na ativação `:525-530`; PAGA no fechamento `financeiro/acoes.ts:120-140`. `ESTORNADA`: não encontrado (só label `src/lib/labels.ts:81`) | PARCIAL | Não existe caminho para estornar comissão. Fechar mês paga **todas** as aprovadas de uma vez (sem filtro de período). |
| 6 | §1 Máquina da **Turma** (`Planejada → Aberta → Em andamento → Concluída`) | `turmas/acoes.ts:155-170`: aceita **qualquer** transição (inclusive `CONCLUIDA → PLANEJADA`), só ignora se igual. Situação operativa na UI é derivada por datas (doc 11) | PARCIAL | Status manual não valida ordem; "Aceitando matrícula" no wizard depende de `dataInicio` futura, não do status. |
| 7 | §2 Matriz de permissões | Comercial: `comercial/acoes.ts:67` (`VENDEDOR, GERENTE_COMERCIAL`); matrícula: `src/server/matricula/permissoes.ts:10-11` (criar = VENDEDOR/GERENTE_COMERCIAL; ativar = FINANCEIRO/SECRETARIA); exceção de preço = GERENTE_COMERCIAL/ADMIN (`matricula/acoes.ts:53`); movimentação de aluno: `alunos/acoes.ts:35` (SECRETARIA + GERENTE_PEDAGOGICO); baixa: `financeiro/acoes.ts:26`; comissão/câmbio: FINANCEIRO (`:27-28`); aprovação: GERENTE_COMERCIAL (`ajustes/acoes.ts:283`); check-in: PROFESSOR (`comercial/acoes.ts:525`); bloqueio de acesso: GERENTE_COMERCIAL (`cobrancas/acoes.ts:20`); usuários: ADMIN (`acesso/acoes.ts:103`). Admin passa sempre (`_shared/sessao.ts:70-73`); papéis relidos do banco a cada ação (`:43-52`) | CONFORME | "Gerente Comercial aprova comissão" (doc) não existe como ação — aprovação é automática na ativação. Desativar usuário derruba a sessão na próxima ação (papéis frescos). Financeiro também cria/ativa matrícula? Não: só ativa. |
| 8 | §3 Comissão = taxa × %; recalcula só se taxa mudar; estorno < 30 dias; fechamento manual | `regras.ts:72-74` (`calcularComissao`, sem arredondamento); recálculo em ajuste da taxa `ajustes/acoes.ts:137-143` (perdão zera); fechamento `financeiro/acoes.ts:120-140`; estorno: não encontrado | PARCIAL | Percentual default 20 (`matricula/schema.ts:91`). Valor gravado em `Decimal(12,2)` — o Postgres arredonda (ex.: taxa 100,01 × 7,5% = 7,50075 → 7,50). |
| 9 | §3.1 Matrícula sem preço de referência (exige justificativa, bloqueio `ErroRegra`, evento) | `src/server/matricula/validacao.ts:107-130` (sem justificativa → `ErroRegra`; sem papel autorizado → erro); chamada `matricula/acoes.ts:121-124`; flags `:224-225`; evento `:233` | CONFORME (payload do evento PARCIAL) | Só GERENTE_COMERCIAL/ADMIN podem usar a exceção (doc 12 diz "Vendedor/Gerente"). Vendedor com país sem preço é bloqueado mesmo com justificativa. |
| 10 | §4 Sem cron na Fase 0 (inadimplência/fila on-the-fly) | Confirmado: nenhum job altera status; cron existente é só do WhatsApp (`src/app/api/whatsapp/cron/route.ts`) | CONFORME | — |
| 11 | §5 Notificações (lista fechada) | Não encontrado. Único "badge" é contagem de não-lidas da inbox (`src/components/Sidebar.tsx:67`, `src/app/(app)/layout.tsx:9`) | NAO_IMPLEMENTADO | Nenhuma notificação de lead novo / desconto aprovado / cobrança vencida / comissão aprovada para testar. |
| 12 | §6 Ninguém apaga nada (soft-delete) | Sem `delete` de entidade de negócio em `src/server` (grep `delete(|deleteMany(`): único é `tipoDocumento.deleteMany` (`paises/acoes.ts:95`), exceção prevista. Documento arquivado `comercial/acoes.ts:495-503`; preço inativo `catalogo/acoes.ts:208,260`; usuário inativo `acesso/acoes.ts:107`; produto-no-país `oferecido=false` `paises/acoes.ts:34` | CONFORME | Editar país recria tipos de documento — alunos que apontam para o `tipoDocumentoId` antigo podem ficar com FK órfã; vale testar edição de país com alunos cadastrados. |
| 13 | §7 Códigos legíveis `L-/A-/M-/C-/T-000001` via `Contador` | `src/lib/codigo.ts:5-32` (upsert atômico, `padStart(6,"0")`); seed `prisma/seed.ts:56-58`; chamadas: lead `comercial/acoes.ts:98`, `captura.ts:67` (única que passa `tx`), aluno/matrícula/cobranças `matricula/acoes.ts:130-134`, `:440`, turma `turmas/acoes.ts:74`, importações `api/alunos/importar/route.ts:149`, `api/turmas/importar/route.ts:196` | CONFORME | Como a maioria chama `gerarCodigo` com o singleton (fora do `tx`), uma criação que falha após gerar o código **deixa buraco** na numeração (comentário `codigo.ts:18-19`). Sequência pode ter saltos — não é bug. Uma matrícula consome 1 A-, 1 M- e 2 a 3 C- na criação e mais `mesesPlano-1` C- na ativação. |
| 14 | §8 Busca global (nome·telefone·email·documento·código) | Não encontrado (sem componente/rota de busca em `src/components`, `src/app/(app)/layout.tsx`, `src/app/api`) | NAO_IMPLEMENTADO | Não há cenário de busca global para testar. |
| 15 | §9 Evento obrigatório (etapa, troca de turma, pausa, reativação, encerramento, pagamento, desconto, bolsa, perdão, comissão, sem preço) | Ver tabela de eventos: `EtapaAlterada`, `TrocaTurma`, `AlunoPausado`, `AlunoReativado`, `AlunoEncerrado`, `PagamentoRegistrado`, `DescontoSolicitado`/`CobrancaRenegociada`, `BolsaConcedida`, `CobrancaPerdoada`, `ComissaoGerada/Aprovada/Paga`, `MatriculaSemPrecoReferencia` — todos emitidos | CONFORME | Após cada ação listada, conferir 1 linha nova em `Evento` com `autorId` do usuário logado. |
| 16 | §10 Métricas (conversão, SLA, receita prevista, inadimplência) | Conversão `src/server/home/consultas.ts:164`; SLA `:102`; receita do mês por moeda `:171-176`; inadimplência como fórmula "vencido ÷ faturado": não encontrado (grep `inadimpl` em `financeiro/consultas.ts` sem resultado; há só contagens de atraso em `cobrancas/consultas.ts:325-332`) | PARCIAL | KPIs de Home são inteiros arredondados (`Math.round`). Receita nunca soma moedas diferentes. |
| 17 | Dono do lead (um dono; 90 dias; gerente redistribui) | `regras.ts:50-69` (`resolverDonoLead`: vendedor é sempre o próprio dono; gerente/admin escolhem); reatribuição `comercial/acoes.ts:762`; regra dos **90 dias**: não encontrado | PARCIAL | Vendedor que envia outro `vendedorDonoId` no form é ignorado pelo servidor. Nenhuma devolução automática à fila. |
| 18 | Multi-moeda (doc 13 regra 5 / doc 11 `TaxaCambio`): cada cobrança na sua moeda; consolidação só em relatório | `src/lib/dinheiro.ts:75-84` (`somarPorMoeda`), `:108-127` (`consolidar` via pivô USD, moedas sem taxa vão para `faltando`); `TaxaCambio` append-only `financeiro/acoes.ts:160-166`; busca automática `:190-230` (arredonda 4 casas, `:215`) | CONFORME | Totais na tela aparecem "₡ x · US$ y"; consolidação precisa de taxa cadastrada para cada moeda, senão a moeda fica de fora do total (não zera, mostra "faltando"). |
| 19 | Arredondamento / precisão monetária | Banco `Decimal(12,2)` (`schema.prisma:633-636`, migration `20260702100000_dinheiro_decimal`); domínio em `number` convertido na borda (`_shared/decimal.ts:11-45`); exibição `formatarMoeda` (`dinheiro.ts:54-64`): CRC/CLP/PYG/COP **sem centavos**, demais 2 casas, agrupamento pt-BR. Sem regra de arredondamento explícita no domínio | PARCIAL (sem doc) | Valores digitados com 3+ casas são arredondados pelo Postgres ao gravar; a tela de CRC esconde centavos. Comparar o que foi digitado vs. o que o banco guardou. |
| 20 | Unicidade de e-mail / documento | `Usuario.email @unique` (`schema.prisma:34`) + checagem com mensagem em `acesso/acoes.ts:28` e `:66`. `Aluno.email`, `Aluno.documento`, `Lead.telefoneE164` **não são únicos** (schema L308-309, L459; sem dedupe em `comercial/acoes.ts:98-120`). `ContatoWhatsApp.telefoneE164 @unique` (L852) | CONFORME (doc só exige e-mail de usuário) | É possível cadastrar 2 alunos com o mesmo documento/e-mail e 2 leads com o mesmo telefone — não é erro segundo os docs, mas vale registrar como risco. E-mail de usuário duplicado deve falhar com mensagem. |
| 21 | Validação: telefone/e-mail bloqueiam; documento avisa mas salva (doc 13 / doc 04) | `src/server/_shared/validacao.ts:9-13` (E.164 regex, e-mail Zod); `:102-112` (normaliza para E.164 com DDI do país); `:149-171` (`validarDocumento` só tem `cpf` real; `passaporte` sempre `false`; validador desconhecido = `false`); aplicação: `matricula/acoes.ts:154`, `alunos/acoes.ts:78` | CONFORME | Qualquer documento não-CPF é salvo com `documentoValido=false` (Cédula CR, CURP, DNI não têm validador). Telefone é salvo sempre com `+DDI`. |
| 22 | Turma: nº de dias = frequência da modalidade; `dataFim > dataInicio` obrigatórios (doc 11) | `src/server/turmas/schema.ts:23-35` (datas obrigatórias, refine `dataFim > dataInicio`); `turmas/acoes.ts:20-31` (`validarAgenda`: exatamente N dias, sem duplicados; Particular sem nº fixo) | CONFORME | Modalidade "3x/semana" com 2 dias marcados → erro com mensagem indicando a quantidade. |
| 23 | Um preço ativo por país+produto+modalidade+tipo (doc 11 P5) | `catalogo/acoes.ts:208` (inativa irmãos ao definir), `regras.ts:36-43`; índice único parcial em migration `20260622120000_preco_ativo_unico` | CONFORME | Definir novo preço desativa o anterior (histórico fica). Reativar um antigo desativa o atual. |
| 24 | Vaga de turma = capacidade − alocações ativas | `regras.ts:392-399`; `alunos/acoes.ts:276-282`; `matricula/acoes.ts:263-266` | CONFORME | Trocar de turma libera a vaga anterior (alocação vira `ativa=false`). |
| 25 | Pagamento parcial acumula; excedente só com flag (doc 09) | `regras.ts:262-280`; `financeiro/acoes.ts:49-55` | CONFORME (não está no doc 10) | Baixa acima do saldo sem marcar "crédito" → erro. 2ª baixa parcial soma à 1ª. |
| 26 | Dia de vencimento | `matricula/schema.ts:74`: só `5, 10, 15, 20, 25` | SEM_DOC | Doc 11 diz só "default 5". Outros dias devem ser recusados pelo Zod. |
| 27 | Limite de desconto / aprovação | `regras.ts:332-342`: para quem não é Financeiro/Admin, `limiteDescontoPct = null` significa **sem autonomia (0%)**; doc 11 diz "`null` = sem limite (Admin)". Direção do ajuste (só `ALTERACAO_VALOR` aumenta) `regras.ts:307-316` | PARCIAL (semântica do `null` diverge por papel) | Vendedor sem limite cadastrado: qualquer desconto vira pedido de aprovação. Admin sem limite: aplica direto. |

---

## Convenções do doc 13 que afetam o QA

| Convenção | Onde está no código | O que o QA vai ver |
|---|---|---|
| Códigos legíveis `X-000001` | `src/lib/codigo.ts:30` (6 dígitos, zero à esquerda) | `L-`, `A-`, `M-`, `C-`, `T-`; sequência global por entidade, pode ter buracos (ver Regra #13). |
| Datas "date-only" ancoradas no meio-dia local | `src/server/_shared/validacao.ts:23-48` | Data digitada = data exibida (sem recuo de 1 dia por fuso). Campos com hora (`datetime-local`) preservam a hora (`:57-74`, experimental). |
| Exibição de datas | 20 usos de `toLocaleDateString("pt-BR")` e 17 de `toLocaleString("pt-BR")` em `src/app` | Formato `dd/mm/aaaa` e `dd/mm/aaaa hh:mm`, mesmo em telas de países hispânicos. |
| Moeda na tela | `src/lib/dinheiro.ts:54-64` (`formatarMoeda`), `:90-93` (`formatarValores`) | Símbolo por moeda (`₡`, `US$`, `R$`, `MX$`…), milhar com ponto e decimal com vírgula; CRC/CLP/PYG/COP sem centavos; totais multi-moeda separados por "·". **Inconsistência:** `valorPrevisto`/`comissaoPrevista` do lead ainda usam `toLocaleString("pt-BR")` sem símbolo (`src/app/(app)/leads/[id]/FichaLead.tsx:254,262`; `src/app/(app)/pipeline/KanbanBoard.tsx:81,123`). |
| Telefone sempre E.164 | `validacao.ts:93-112` | Salvo como `+50688887777`; máscara só na UI. Número sem DDI recebe o DDI do país do cadastro. |
| Rótulos de enums (sentence case, pt-BR) | `src/lib/labels.ts` (`ETAPA_LABEL`, `STATUS_*_LABEL`, `GENERO_LABEL` "Prefiro não informar"…) | Status na tela: "Pendente/Pago/Atrasado/Cancelada", "Aguardando/Ativa", etc. |
| Erros de regra e permissão | `_shared/sessao.ts:14-35` (`ErroAutenticacao`, `ErroPermissao`, `ErroRegra`), `_shared/resultado.ts` (`{ok:false, erro}`) | Mensagens de `ErroRegra` são legíveis e aparecem na UI; permissão negada = "Você não tem permissão para esta ação."; páginas sem papel → `/acesso-negado` (`sessao.ts:113`). |
| Permissão no servidor com papéis frescos | `sessao.ts:43-67` | Revogar papel/desativar usuário vale na ação seguinte, sem relogar. |
| Evento na mesma transação | `_shared/evento.ts:60-74` | Se a ação falha, nenhum evento fica gravado; se passa, há exatamente 1 evento por fato (2-4 na matrícula). |

---

## Cenários de teste sugeridos para o QA

1. **Códigos sequenciais:** criar lead → `L-000NNN`; converter em matrícula → aluno `A-`, matrícula `M-`, cobranças `C-` (taxa + 1ª mensalidade; + certificado se informado). Conferir 6 dígitos e que a sequência é global por entidade. Provocar uma falha de criação (ex.: lead já com matrícula) e confirmar que o próximo código **pula** um número (comportamento esperado, Regra #13).
2. **Kanban — saltos inválidos:** arrastar lead de `Novo` direto para `Qualificado`, ou qualquer lead para `Proposta`/`Matriculado`/`Perdido` → deve falhar com mensagem de transição inválida. Arrastar `Em atendimento → Novo` e `No-show → Experimental agendada` → deve aceitar (retrocessos permitidos).
3. **Check-in da experimental:** logar como Professor **não atribuído** → "Esta experimental não está atribuída a você."; lead fora de `EXPERIMENTAL_AGENDADA` → "Não há experimental agendada". Com professor atribuído: "Compareceu" → etapa `Experimental realizada` + evento `ExperimentalRealizada`; "Faltou" → `No-show` + evento `NoShow`.
4. **Lead perdido com motivo "Outro"** sem observação → bloqueado pelo Zod (`comercial/schema.ts:127-129`); com observação → etapa `Perdido`, `motivoPerda` gravado, evento `LeadPerdido`.
5. **Ativação da matrícula (divergência P7):** criar matrícula (status `Aguardando`), receber valor **menor que a taxa** → erro "não cobre a taxa"; receber valor ≥ taxa → status `Ativa`, taxa `Pago`, 1ª mensalidade continua `Pendente`, `contratoOk=true`, `primeiraMensalidadeOk=false` no banco, comissão `Aprovada`, lead `Matriculado`, `mesesPlano-1` mensalidades geradas com `competencia` `AAAA-MM` e vencimento no dia escolhido.
6. **Dia de vencimento:** tentar `diaVencimento` = 1, 7 ou 30 → recusado; só 5/10/15/20/25 passam. Conferir que o vencimento da 1ª mensalidade = `Turma.dataInicio + 30 dias` ajustado ao dia escolhido (`regras.ts:99-109`); sem turma, usa data de criação + 30.
7. **Matrícula sem preço de referência:** país/produto sem `PrecoReferencia` ativo: como Vendedor → bloqueado mesmo com justificativa; como Gerente Comercial sem justificativa → "Cadastre o preço ou informe uma justificativa"; com justificativa → cria, `precoReferenciaAusente=true`, evento `MatriculaSemPrecoReferencia`.
8. **Baixa parcial acumulada:** cobrança de 100: baixar 40 → `Pendente`, `valorRecebido=40`, `saldo=60`; baixar 60 → `Pago`, `pagoEm` preenchido; tentar baixar de novo → "Cobrança já está paga". Baixar 70 numa de 60 sem marcar excedente → erro; com excedente → aceita e evento registra `excedente=10`.
9. **Cobrança vencida sem cron:** criar mensalidade com vencimento passado (ou aguardar): na UI aparece "Atrasado"/fila de cobrança, mas no banco `status` continua `PENDENTE` (Regra #4).
10. **Pausa/reativação/encerramento do aluno:** pausar (motivo obrigatório) → `Pausado`, mensalidades futuras `Cancelada`, dívidas passadas mantidas, linha em `MovimentacaoAluno` tipo `PAUSA` + evento `AlunoPausado`; reativar → `Ativo` (mensalidades canceladas **não** voltam — verificar expectativa de negócio); encerrar aluno pausado → aceito; encerrar com motivo "Outro" sem observação → bloqueado.
11. **Troca de turma:** turma destino lotada → "Turma de destino sem vaga"; com vaga → alocação antiga `ativa=false`, nova ativa, vaga da turma de origem liberada, evento `TrocaTurma` + movimentação `TROCA_TURMA`.
12. **Desconto por limite:** Vendedor com `limiteDescontoPct` vazio pede 5% → vira pedido de aprovação (evento `DescontoSolicitado`), cobrança inalterada; Gerente Comercial aprova → `AjusteFinanceiro` criado, `valorNegociado` reduzido, eventos `AprovacaoDecidida` + `CobrancaRenegociada`; rejeitar → só `AprovacaoDecidida` com status `REJEITADA`. Tentar "Desconto" com valor **maior** que o atual → "Este ajuste não pode aumentar o valor"; só "Alterar valor" aceita aumento.
13. **Perdão de cobrança:** aplicar perdão na taxa de matrícula → cobrança `Cancelada`, comissão recalculada para **0** (`ajustes/acoes.ts:139`); perdão em mensalidade não mexe na comissão.
14. **Fechar mês de comissões:** com comissões `Aprovada` → todas viram `Paga` com `pagaEm` igual, 1 evento `ComissaoPaga` por comissão; sem aprovadas → "Nenhuma comissão aprovada para pagar". Não há como estornar (Regra #5).
15. **Preço de referência único:** definir novo preço para a mesma chave (país+produto+modalidade+tipo) → o anterior fica `ativo=false`; reativar o anterior → o atual é desativado. Nunca dois ativos na mesma chave.
16. **Turma — agenda e datas:** modalidade "2x/semana" com 1 ou 3 dias marcados → erro informando "selecione exatamente 2 dia(s)"; `dataFim` ≤ `dataInicio` → erro; turma com `dataInicio` no passado **não aparece** no wizard de matrícula (filtro por data, não por status); mudar status manualmente para qualquer valor (ex.: Concluída → Planejada) é aceito.
17. **País — ativação:** ativar país sem moeda, sem tipo de documento ou sem preço cadastrado → bloqueado com a mensagem correspondente (`paises/acoes.ts:140-146`); editar país recria os tipos de documento (verificar alunos que já apontavam para um tipo).
18. **Usuário — e-mail único e soft-delete:** criar usuário com e-mail existente → mensagem de duplicidade; desativar usuário → `ativo=false` (não some do banco), evento `UsuarioDesativado`; usuário desativado logado tenta qualquer ação → "Não autenticado"; tentar desativar a si mesmo → bloqueado.
19. **Moeda e arredondamento:** matrícula em CRC com taxa 50.000,50 → tela mostra "₡ 50.001" (sem centavos) enquanto o banco guarda 50000.50; comissão 7,5% sobre 100,01 → banco 7,50. KPI de receita com cobranças em CRC e USD → duas linhas, nunca somadas; consolidar sem taxa cadastrada para uma moeda → moeda listada em "faltando".
20. **Documento "avisa, não bloqueia":** aluno da Costa Rica com cédula válida → salva com `documentoValido=false` (não há validador para `cedula_cr`); aluno do Brasil com CPF inválido → salva com `documentoValido=false`, CPF válido → `true`; telefone fora do E.164 (ex.: "abc") → bloqueado; telefone local sem DDI → salvo com `+DDI` do país.
