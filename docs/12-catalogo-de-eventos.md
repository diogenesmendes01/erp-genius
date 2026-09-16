# Catálogo de Eventos de Domínio

> Referência canônica de **todo evento de negócio** gravado na tabela `Evento`
> (ver [`11-modelo-de-dados.md`](11-modelo-de-dados.md) e [`02-arquitetura.md`](02-arquitetura.md)).
> Consolida o que estava espalhado entre os docs 02 (§Eventos de domínio) e 10 (§9 Auditoria).

## Por que eventos
Telas mudam; **eventos de negócio não**. Cada mutação relevante grava um `Evento`
append-only — que **é** a trilha de auditoria e a fonte das projeções (timeline do lead,
histórico do aluno, motivos de perda/encerramento). Regra de ouro:
**Evento = auditoria; tabela tipada = relatório** (ex.: `AjusteFinanceiro`).

## Anatomia de um evento (`Evento`)
| Campo | Significado |
|---|---|
| `tipo` | Nome do evento em PascalCase (ex.: `MatriculaAtivada`) |
| `agregadoTipo` | Entidade afetada: `Lead · Matricula · Aluno · Cobranca · Comissao · Turma · Pais · Usuario · Idioma · Modalidade · Nivel · Produto · Preco · TaxaCambio` |
| `agregadoId` | `id` da entidade |
| `autorId` | Usuário que disparou (`null` = sistema/cron) |
| `versao` | Versão do formato do `payload` (começa em 1) |
| `payload` | Json com o **antes→depois** + contexto (`{ de, para, motivo, ... }`) |
| `criadoEm` | Timestamp |

> **Convenção:** toda mutação grava o `Evento` **na mesma transação** da mudança de estado
> (ver [`13-convencoes-codigo.md`](13-convencoes-codigo.md)).

### Padrão de nomenclatura (canônico)
- **`tipo` em PascalCase**, no formato `AgregadoVerboParticípio` (ex.: `MatriculaAtivada`,
  `AlunoEncerrado`). É o padrão de **todo** evento gravado pelas Server Actions em `src/server/**`.
- **Exceção histórica:** os scripts de **carga Q10** (docs 19 e 21) gravaram o evento de
  importação de aluno como **`ALUNO_IMPORTADO`** (CAIXA ALTA com `_`), divergindo do padrão.
  O nome **canônico** é **`AlunoImportado`**; `ALUNO_IMPORTADO` permanece **apenas** como o valor
  realmente persistido por aquela carga one-shot (não usar em código novo). Se houver nova carga,
  usar `AlunoImportado`.

> **Como esta lista foi conferida:** os eventos abaixo refletem as strings `tipo: "…"` reais
> nas Server Actions (`src/server/**/acoes.ts`) e nos docs de carga (19–23). Itens sem gatilho
> ativo no código estão explicitamente marcados como **reservados/importação**.

---

## Comercial (agregado `Lead`)
| Evento | Gatilho | Quem | Payload (essencial) |
|---|---|---|---|
| `LeadCriado` | Lead entra no sistema — formulário OU **auto-captura no 1º inbound de um número de vendas** (fase doc 27 C1; autor `null` = sistema, `payload.origem="whatsapp_inbound"`) | Sistema/Vendedor | `{ codigo, nome, origem, segmento?, b2b }` |
| `LeadAtribuido` | Define/troca o dono (auto-captura: dono = dono do número, `via="whatsapp_inbound"`) | Sistema/Gerente | `{ de, para, motivo?, via? }` |
| `EtapaAlterada` | Muda a etapa do funil (manual no Kanban e também no fluxo de matrícula: → Aguardando matrícula / Matriculado) | Vendedor/Secretaria | `{ de, para }` |
| `ExperimentalAgendada` | Agenda aula experimental | Vendedor | `{ data }` |
| `ExperimentalRealizada` | Check-in "Compareceu" | Professor | `{ turmaId, data }` |
| `NoShow` | Check-in "Faltou" | Professor | `{ data }` |
| `PropostaEnviada` | Envia proposta | Vendedor | `{ data }` |
| `LeadPerdido` | Marca perdido (terminal) | Vendedor | `{ motivoPerda, observacao }` |
| `LeadEditado` | Edição de dados do lead | Vendedor | `{ nome, temperatura }` |
| `ResumoAtualizado` | Atualiza o resumo executivo (interesse, objetivo, urgência, orçamento, objeção, próximo passo) | Vendedor | `{ interesse, objetivo, urgencia, orcamento, objecao, proximaAcao }` |
| `DatasAtualizadas` | Atualiza datas / próximos passos (follow-up, experimental, proposta) | Vendedor | `{ proximoFollowUp, dataExperimental, dataProposta }` |
| `InteracaoRegistrada` | Registro manual de interação (contato REAL com o cliente) | Vendedor | `{ canal, nota }` |
| `NotaInterna` | Comentário da equipe sobre o lead — **nunca enviado ao contato** (cockpit da inbox) | Vendedor | `{ nota }` |
| `DocumentoAnexado` | Upload de documento ao lead | Vendedor | `{ categoria, nome }` |
| `DocumentoArquivado` | Arquiva documento (soft-delete) | Vendedor | `{ documentoId, nome }` |
| `ReguaComercialEnviada` | Degrau da cadência comercial cumprido (lead-novo, pré-experimental, no-show — doc 27 C1/C2); o motor conta como passo feito. `ocorrencia` = âncora em ISO, a identidade do CICLO: sem ela uma experimental reagendada herdaria os passos da anterior | Sistema/cron | `{ chave, passo, ocorrencia, canal: "api" }` |
| `ExperimentalConfirmada` | O lead confirmou presença na experimental (botão no oficial / "SIM" no Baileys — doc 27 C2) | Sistema (o próprio lead) | `{ via: "whatsapp_keyword" }` |
| `ExperimentalReagendamentoSolicitado` | O lead pediu para remarcar; só SINALIZA — quem remarca é o vendedor (a máquina de funil é uma só) | Sistema (o próprio lead) | `{ via: "whatsapp_keyword" }` |

> A timeline do lead e a fila da Home são **projeções** desses eventos + dos campos de data
> do `Lead` (`proximoFollowUp`, `dataExperimental`, `dataProposta`).

## Matrícula (agregado `Matricula`)
| Evento | Gatilho | Quem | Payload |
|---|---|---|---|
| `MatriculaCriada` | "Converter em matrícula" (rascunho) | Vendedor | `{ codigo, alunoId, produtoId, leadId }` |
| `MatriculaAtivada` | `contratoOk && pagamentoTaxaOk && primeiraMensalidadeOk` | Financeiro/Secretaria | `{ ativadaEm, forma }` |
| `CobrancaGerada` | Cronograma (meses 2..N) gerado na ativação | Financeiro/Secretaria | `{ quantidade, tipo }` |
| `ComissaoGerada` | Criação da matrícula (comissão Pendente) | Vendedor/Sistema | `{ vendedorId, percentual }` |
| `ComissaoAprovada` | Ativação da matrícula | Financeiro/Secretaria | — |
| `MatriculaSemPrecoReferencia` | Matrícula criada sem preço de referência ativo (exceção auditável, issue #22) | Vendedor/Gerente | `{ paisId, produtoId, tiposAusentes, justificativa, taxaValor, mensalidadeValor }` |
| `MatriculaImportada` | Carga financeira Q10 (Planilha de cobrança) | Sistema (doc 22) | `{ aluno, pais, moeda, mensalidade, diaVencimento, statusCobranca }` |
| `ComissaoImportada` | Carga Q10: comissão histórica já paga (vendedor Henrique) | Sistema (doc 23) | `{ vendedor, status, obs }` |

## Financeiro (agregados `Cobranca` / `Comissao`)
| Evento | Gatilho | Quem | Payload |
|---|---|---|---|
| `PagamentoRegistrado` | Baixa manual (taxa/mensalidade/parcial) | Financeiro/Secretaria | `{ valorRecebido, forma, quitada, saldo }` |
| `CobrancaRenegociada` | Renegociação/alteração de valor | Financeiro/Admin | `{ de, para, descontoValor, vigencia, motivo }` |
| `BolsaConcedida` | Ajuste tipo Bolsa | Financeiro/Admin | `{ de, para, descontoValor, vigencia, motivo }` |
| `CobrancaPerdoada` | Perdão de cobrança (só Admin) | Admin | `{ de, para, descontoValor, motivo }` |
| `DescontoSolicitado` | Vendedor pede acima do limite | Vendedor | `{ percentual, vigencia, aprovacaoId }` |
| `AprovacaoDecidida` | Aprova/rejeita ajuste | Gerente Com./Admin | `{ status, motivo? }` |
| `ComissaoPaga` | Fechar mês de comissões | Financeiro | `{ pagaEm, valor }` |
| `CobrancaEnviadaWhatsApp` | Degrau da régua cumprido (doc 24) — braço humano (wa.me) OU despachante da API (docs 26/30). **v2**: payload ganhou `canal`; autor `null` = cron. O evento **não** carrega driver — driver mora no log `MensagemWhatsApp` (doc 29 regras 2/3) | Financeiro/Secretaria · Sistema | `{ modelo, passo?, canal: "manual"\|"api" }` (v2) |
| `PromessaPagamento` | Aluno prometeu pagar até uma data — adormece a cobrança na fila (doc 24) | Financeiro/Secretaria | `{ ate }` |
| `AcessoBloqueado` | Bloqueio de acesso à aula (degrau D+15, **aprovação humana**) — agregado `Matricula` | Gerente Com./Admin | `{ cobrancaId?, motivo? }` |
| `AcessoDesbloqueado` | Reversão do bloqueio — agregado `Matricula` | Gerente Com./Admin | `{ motivo? }` |
| `TaxasCambioDefinidas` | Cotação de câmbio salva (manual ou auto) — agregado `TaxaCambio` | Financeiro/Admin | `{ fonte?, entradas:[{moeda, unidadesPorUsd}], vigenteEm }` |

> **Reservados (planejados — gatilho ainda não disparado no código):** `ValorNegociado`,
> `MatriculaAtivadaComPendencia`, `MatriculaCancelada`, `ComissaoEstornada`.
> Mantidos no catálogo porque o roadmap (Fase 1/2) os ativa; ao implementar, manter o padrão.
>
## Canal WhatsApp (agregados `ContatoWhatsApp` · `NumeroWhatsApp` · `TemplateWhatsApp` · `PoliticaRegua`)

Implementados nas etapas E3/E4 do doc 30. `Conversa`/`Mensagem` **não** são agregados de
Evento: tabelas operacionais (doc 29 regra 3).

| Evento | Gatilho | Quem | Payload |
|---|---|---|---|
| `OptOutRegistrado` | Contato pediu para não receber: keyword exata no inbound (sair/parar/stop/baja…) ou botão da thread (S10) | Sistema · quem vê a conversa | `{ via: "keyword"\|"botao", palavra? }` |
| `OptOutRemovido` | Reativação manual (contato pediu para voltar) | Quem vê a conversa | `{}` |
| `ContatoVinculado` | Vínculo contato → aluno/responsável/lead na inbox (D26) | Quem vê a conversa (lead respeita `escopoLeads`) | `{ alvo: {tipo, id}, antes }` |
| `ReguaRetomada` | "Retomar régua" na thread — libera o silêncio pós-inbound (S4) sem promessa/pagamento | Financeiro/Secretaria | `{ conversaId }` |
| `NumeroWhatsAppCriado` | Cadastro de número na config | Admin | `{ telefoneE164, driver, finalidade }` |
| `NumeroWhatsAppAlterado` | Edição do número — inclui **troca de driver** (D26) | Admin | `{ antes, depois }` |
| `NumeroWhatsAppConectado` | Sessão Baileys abriu (QR lido) — via webhook `connection.update` ou poll | Sistema | `{ via, de }` |
| `SessaoBaileysCaiu` | Sessão que estava CONECTADO caiu — fila degrada p/ "acumula + alerta" | Sistema | `{ via }` |
| `TemplateCriado` / `TemplateAlterado` | Editor de template (edição de aprovado volta a rascunho) | Admin | `{ nome, ... }` / `{ antes, depois }` |
| `TemplateSubmetido` | Submissão à revisão da Meta (Marco 2) | Admin | `{ metaTemplateId }` |
| `TemplateAprovado` / `TemplateRejeitado` | Transição de status vinda da Meta (webhook `message_template_status_update` ou mapeador/sync) | Sistema | `{ via: "sync"\|"webhook", de, motivo? }` |
| `PoliticaReguaAlterada` | Salvar política / kill switch (D26) | Admin | `{ antes, depois }` (snapshot; `antes: null` na 1ª materialização) |
| `ConfigComercialAlterada` | Salvar a config comercial (auto-lead / saudação — fase doc 27 C1); agregado `ConfigComercial` | Gerente Com./Admin | `{ antes, depois }` (`antes: null` na 1ª materialização) |
| `PoliticaComercialAlterada` | Salvar a régua comercial (lead-novo: estado/remetente/degraus — doc 27 C1); agregado `PoliticaComercial` | Gerente Com./Admin | `{ antes, depois }` |

## Alunos (agregado `Aluno`)
| Evento | Gatilho | Quem | Payload |
|---|---|---|---|
| `AlunoMatriculado` | Matrícula ativada cria/ativa aluno | Sistema | `{ matriculaId, turmaId }` |
| `AlunoEditado` | Edição de dados cadastrais (motivo obrigatório) | Secretaria/Pedagógico | `{ de, para, motivo }` |
| `AlunoImportado` | Cadastro de alunos em **lote por XLSX** (tela de Alunos → "Cadastrar por lote", só Admin) **e** carga Q10 inicial (esta **persistida como `ALUNO_IMPORTADO`** — ver nota de nomenclatura) | Admin / Sistema (docs 19, 21) | `{ origem, linha?, codigo?, codigoQ10?, ... }` |
| `AlunoVinculadoTurma` | Carga de rosters (EstudiantesCurso Q10) | Sistema (doc 21) | `{ turmaId, nivel, ativa }` |
| `TrocaTurma` | Transferência equivalente direta ou execução de mudança acadêmica aprovada | Secretaria/Pedagógico/Admin na equivalente; Secretaria/Admin na execução excepcional | `{ de, para, motivo, horarioCompativel, solicitacaoId? }` |
| `MudancaAcademicaSolicitada` | Pedido de mudança de nível, sem alterar alocação | Secretaria/Pedagógico/Admin | `{ solicitacaoId, alocacaoOrigemId, turmaOrigemId, turmaDestinoId, motivo, horarioCompativel }` |
| `ParecerMudancaAcademicaRegistrado` | Professor atual registra parecer | Professor da turma de origem | `{ solicitacaoId, parecerId, turmaOrigemId, conteudo }` |
| `MudancaAcademicaDecidida` | Aprovação ou rejeição independente; aprovação aguarda execução | Pedagógico/Admin diferente do solicitante | `{ solicitacaoId, status, solicitanteId, motivo, justificativaDispensaParecer }` |
| `MudancaAcademicaExecutada` | Aplica alocação aprovada e preserva a anterior | Secretaria/Admin | `{ solicitacaoId, solicitanteId, aprovadorId, turmaOrigemId, turmaDestinoId, alocacaoOrigemId, alocacaoDestinoId, movimentacaoId, motivo, horarioCompativel }` |
| `MudancaAcademicaCancelada` | Cancela pedido pendente/aprovado sem alterar alocação | Secretaria/Pedagógico/Admin | `{ solicitacaoId, statusAnterior, motivo }` |
| `AlunoPausado` | Pausa com identificação das parcelas suspensas | Secretaria/Pedagógico/Admin | `{ motivo, pausaId, protocoloRetomada }`; retorno previsto fica na movimentação |
| `RetomadaSolicitada` | Proposta, sem aplicação do calendário | Secretaria/Financeiro/Admin | `{ propostaId, pausaId, opcao, motivo, parcelas }` |
| `RetomadaDecidida` | Aprovação ou rejeição por outra pessoa | Financeiro/Admin | `{ propostaId, pausaId, opcao, status, solicitanteId, motivo }` |
| `AlunoReativado` | Proposta aprovada muda Pausado → Ativo | Financeiro/Admin diferente do solicitante | `{ propostaId, pausaId, opcao, solicitanteId, motivo }` |
| `CobrancaRetomada` | Restauração ou reprogramação de uma parcela aprovada (agregado Cobrança) | Aprovador da retomada | `{ propostaId, pausaId, opcao, de, para }`; inclui datas, status, versão e ciclo |
| `AlunoEncerrado` | Encerramento (motivo obrigatório) | Secretaria/Pedagógico/Admin | `{ motivo, observacao }` |

> `ExperimentalRealizada` / `NoShow` (check-in do professor) são do agregado **Lead** — ver seção
> Comercial. **Reservado:** `AvancoNivel` (progressão A1→A2…) — Fase 3 (Acadêmico).

> Esses eventos são a fonte do **histórico de movimentações** da Ficha do Aluno
> ("por que a Maria está nessa turma?"). A tabela tipada **`MovimentacaoAluno`** (decisão P6 —
> ver [`11`](11-modelo-de-dados.md) e [`15`](15-decisoes-adr.md)) **coexiste** com o Evento:
> tabela tipada = relatório/operação; Evento = auditoria. Toda movimentação grava **os dois**.

## Configuração / Mercado (agregados `Pais`, `Idioma`, `Modalidade`, `Nivel`, `Produto`, `Preco`, `Turma`, `Usuario`)
| Evento | Gatilho | Quem |
|---|---|---|
| `PaisCriado` / `PaisEditado` | Cadastro/edição de país | Admin |
| `PaisAtivado` / `PaisPausado` / `PaisEncerrado` / `PaisRascunho` | Mudança de status do mercado | Admin |
| `ProdutoHabilitadoPais` / `ProdutoDesabilitadoPais` | Liga/desliga produto no país (`ProdutoPais.oferecido`) | Admin |
| `IdiomaCriado` / `IdiomaAtivado` / `IdiomaDesativado` | Catálogo: idiomas | Admin |
| `ModalidadeCriada` / `ModalidadeEditada` | Catálogo: modalidades (inclui mínimo p/ abrir) | Admin |
| `NivelCriado` | Catálogo: níveis (CEFR) | Admin |
| `ProdutoCriado` | Catálogo: produto (idioma × modalidade) | Admin |
| `PrecoDefinido` / `PrecoDesativado` / `PrecoReativado` | Catálogo: preço de referência (supersede/histórico) | Admin |
| `TurmaCriada` / `TurmaEditada` | Cadastro/edição de turma | Gerente Pedagógico |
| `TurmaImportada` | Importação de turmas em **lote por XLSX** (Configuração → Turmas → "Importar turmas", só Admin) **e** carga única do ListadoCursos (Q10) | Admin / Sistema (doc 20) |
| `TurmaPlanejada` / `TurmaAberta` / `TurmaEmAndamento` / `TurmaConcluida` | Ciclo de vida da turma | Gerente Pedagógico |
| `AberturaTurmaSolicitada` | Vendedor solicita abertura (sem turma compatível) | Vendedor (agregado `Produto`) |
| `UsuarioCriado` / `UsuarioEditado` / `UsuarioAtivado` / `UsuarioDesativado` | Gestão de usuários | Admin |

> Lista de eventos de configuração é **aberta** — adicione conforme novas telas de backstage,
> mantendo o padrão `tipo · agregado · gatilho · autor · payload`.

---

## Estado de implementação (código vs planejado)
Conferido contra `src/server/**/acoes.ts` (junho/2026):

- **Disparados hoje pelo código (Fase 0):** `LeadCriado · LeadAtribuido · EtapaAlterada ·
  ExperimentalAgendada · PropostaEnviada · LeadPerdido · LeadEditado · InteracaoRegistrada · NotaInterna ·
  DocumentoAnexado · DocumentoArquivado · MatriculaCriada · MatriculaAtivada · CobrancaGerada ·
  ComissaoGerada · ComissaoAprovada · PagamentoRegistrado · DescontoSolicitado ·
  AprovacaoDecidida · ComissaoPaga · CobrancaEnviadaWhatsApp · TaxasCambioDefinidas · AlunoMatriculado · AlunoEditado ·
  AlunoPausado · AlunoReativado · AlunoEncerrado · TrocaTurma · AberturaTurmaSolicitada ·
  TurmaCriada · TurmaEditada · IdiomaCriado · ModalidadeCriada · ModalidadeEditada · NivelCriado ·
  ProdutoCriado · PrecoDefinido · PaisCriado · PaisEditado · UsuarioCriado · UsuarioEditado`.
- **`AlunoImportado` / `TurmaImportada`:** disparados pelo código na **importação por XLSX** (Admin —
  rotas `/api/alunos/importar` e `/api/turmas/importar`), em **PascalCase canônico**. A carga Q10
  inicial (one-shot) gravou `AlunoImportado` como `ALUNO_IMPORTADO` (caixa alta) — valor histórico,
  não usar em código novo.
- **Só nos scripts de carga Q10 (one-shot, docs 19–23):** `AlunoVinculadoTurma` ·
  `MatriculaImportada` · `ComissaoImportada`.
- **Planejados / ainda sem gatilho no código (ciclos de status e Fase 1+):** os demais eventos
  de status de `Pais`/`Idioma`/`Preco`/`Turma`/`Usuario`, `ExperimentalRealizada` · `NoShow` ·
  `CobrancaRenegociada` · `BolsaConcedida` · `CobrancaPerdoada`, além dos reservados acima
  (`ValorNegociado`, `MatriculaAtivadaComPendencia`, `MatriculaCancelada`, `ComissaoEstornada`,
  `AvancoNivel`). Ao implementar, gravar em PascalCase.

## Eventos que EXIGEM registro (doc 10 §9)
Obrigatório gravar `Evento` em: **troca de etapa · troca de turma · pausa · reativação ·
encerramento · pagamento · desconto · bolsa · perdão · comissão**.

## Notificações derivadas (lista fechada — doc 10 §5)
Apenas estes eventos geram notificação: **Lead novo · Experimental realizada ·
Desconto aprovado · Cobrança vencida · Comissão aprovada**.


### Modelos contratuais — incremento 193

Agregado `ModeloContratual`, identificado pela versão imutável:

- `ModeloContratualProposto`: código, versão, hash de conteúdo e motivo; autor da preparação.
- `ModeloContratualPublicado`: decisão, versão, hash e motivo; outro administrador aprovador.
- `ModeloContratualRejeitado`: decisão, versão, hash e motivo; outro administrador decisor.

Eventos são gravados na mesma transação da proposta/decisão. Publicação não comprova geração de PDF, envio, assinatura ou ativação da matrícula.


### Prévia contratual — incremento 195

`PreviaContratualRegistrada`, agregado `Matricula`: prévia, modelo, condições, hash do conteúdo e confirmação de aplicação. Autor/data no evento; texto e valores completos no snapshot protegido da prévia. Evento transacional não representa assinatura nem aceite.


### Conferência de participantes — incremento 198

`ParticipantesContratuaisConferidos`, agregado `Matricula`: prévia, conferência, versão e papéis. Registro na mesma transação da conferência imutável; identidades/evidências ficam no snapshot protegido, sem cópia no evento. Não comprova envio ou assinatura.


### Regras de avaliação — incremento 232

Agregado `RegraAvaliacao`, identificado pela versão imutável:

- `RegraAvaliacaoProposta`: nível, versão, hash do conteúdo e motivo; autor da preparação.
- `RegraAvaliacaoPublicada`: decisão, nível, versão, hash e motivo; outro gestor pedagógico/administrador.
- `RegraAvaliacaoRejeitada`: mesma referência com decisão negativa independente.

Eventos são gravados na transação da proposta/decisão. Publicação não aplica regra a turma existente, oficializa nota ou aprova progressão.


### Migração de regra de avaliação da turma — incremento 234

Agregado `Turma`: `MigracaoRegraTurmaProposta`, `MigracaoRegraTurmaAplicada` e `MigracaoRegraTurmaRejeitada`. Registram proposta, origem/destino, hash e motivo; aplicação/rejeição inclui decisão. Autor/data no evento, snapshot na proposta protegida. Decisão e efeito são atômicos; evento não aprova progressão ou muda cobrança.

### Lançamento de avaliações — incremento 236

Agregado `Matricula`: `AvaliacaoRascunhoRegistrado` e `AvaliacaoSubmetida` identificam registro, lançamento, turma, regra, código da avaliação e versão. `AvaliacaoOficializada` e `AvaliacaoDevolvida` identificam registro, lançamento, decisão e motivo. Autoria e data ficam no evento; notas e comentários permanecem nas versões protegidas, sem cópia no payload. Eventos e persistência são atômicos. Oficialização não fecha o resultado do nível nem aprova progressão.

### Proposta de correção de nota — incremento 241

`CorrecaoNotaProposta`, agregado `Matricula`, identifica proposta, lançamento oficial de origem, registro, versão e motivo. Autoria/data no evento; valores propostos na proposta imutável. Evento e proposta são atômicos. O evento não aplica notas ou registra aprovação.

Incremento 242: `CorrecaoNotaAplicada` e `CorrecaoNotaRejeitada` identificam proposta, decisão, lançamento e motivo, no agregado `Matricula`. `CorrecaoNotaRevisaoNecessaria` identifica decisão e solicitações acadêmicas aprovadas/executadas afetadas, sem desfazer movimentações. A decisão preserva o snapshot desses impactos; fila operacional de resolução ainda pendente.


### Designação de avaliador — incremento 248

`AvaliadorDesignado` e `DesignacaoAvaliadorRevogada`, agregado `Matricula`, identificam designação, registro de avaliação, professor (nulo na revogação), motivo e versão. Autor/data ficam no evento. Evento e designação são gravados na mesma transação; o evento não altera autoria de notas, titularidade da turma ou oficialização. Neste incremento, a conexão da designação às permissões de acesso ainda está pendente.


Incremento 251: eventos `AvaliacaoRascunhoRegistrado`/`AvaliacaoSubmetida` passam a identificar `realizadaPorId` e `regularizacao`. O autor do evento é o registrador; motivo/evidências da regularização permanecem na versão imutável da nota. Designação vigente passa a permitir lançamento no alcance das avaliações regulares descrito na SPEC, com conferência independente do registrador e do realizador.


### Plano de recuperação — incremento 253

`PlanoRecuperacaoProposto`, agregado `Matricula`, identifica proposta, nível, regra, versão e habilidades. Autor/data ficam no evento; estratégias, avaliações propostas e snapshot de notas ficam na proposta imutável. Evento e proposta são atômicos. Não representa aprovação, reserva de tentativa, disponibilização ou alteração de nota.


Incremento 254: `PlanoRecuperacaoAprovado` e `PlanoRecuperacaoRejeitado`, agregado `Matricula`, identificam proposta, decisão, versão e motivo, com autoria/data do decisor independente. Não reservam ou consomem tentativa, iniciam prazo ou alteram nota.


Incremento 255: `TentativaRecuperacaoReservada`, agregado `Matricula`, identifica reserva, proposta aprovada, nível e habilidades. Autor/data no evento; reserva e itens são persistidos atomicamente. Não comprova realização, consumo definitivo, nota, presença ou disponibilização.


Incremento 256: `TentativaRecuperacaoCanceladaPelaEscola`, agregado `Matricula`, identifica cancelamento, reserva, proposta, habilidades e motivo. Autor/data no evento; evidência fica no cancelamento imutável. Libera a reserva na cota sem lançar nota, presença, consumo ou cobrança.


Incremento 257: `PlanoRecuperacaoDisponibilizado`, agregado `Matricula`, identifica disponibilização, proposta, instante inicial, prazo em minutos e limite calculado. Autor/data no evento; condições e evidência de comunicação no registro imutável. O evento não comprova envio automático pelo ERP nem aplicação da avaliação.


Incremento 258: `ProrrogacaoRecuperacaoProposta` identifica proposta, disponibilização, versão e prazos anterior/novo. `ProrrogacaoRecuperacaoAprovada`/`ProrrogacaoRecuperacaoRejeitada` identificam proposta, decisão, motivo e novo prazo proposto. Agregado `Matricula`, com autoria/data. Somente decisão positiva válida altera o prazo efetivo; nenhum desses eventos modifica cota ou confirma comunicação ao aluno.


Incremento 259: `RecuperacaoRealizada`, agregado `Matricula`, identifica realização, item reservado, reserva, habilidade e instante da avaliação. Professor/data no evento; evidência no registro imutável. Consome a oportunidade daquela habilidade sem criar nota, frequência ou progressão. Cancelamento institucional passa a relacionar somente habilidades pendentes liberadas.


Incremento 260: `NotaRecuperacaoRascunhada`, `NotaRecuperacaoSubmetida`, `NotaRecuperacaoOficializada` e `NotaRecuperacaoRejeitada`, agregado `Matricula`. Identificam realização, nota e versão ou decisão; autoria no evento. Resultado oficial entra na consolidação pelo melhor resultado por habilidade, sem alterar frequência, cobranças ou executar progressão.


Incremento 266: `ProfessorRecuperacaoDesignado` e `DesignacaoRecuperacaoRevogada`, agregado `Matricula`, identificam designação, item reservado, professor, versão e motivo. Não alteram autoria da realização, prazo ou saldo; não concedem acesso amplo ao plano.


Incremento 270: `RecuperacaoRealizada` passa a identificar `realizadaPorId`, `registradaPorId` e eventual `motivoRegularizacao`. O autor do evento é quem registra; a autoria da avaliação permanece no realizador. Eventos históricos não são reescritos.


Incremento 271: `CorrecaoRecuperacaoProposta`, `CorrecaoRecuperacaoAplicada` e `CorrecaoRecuperacaoRejeitada`, agregado `Matricula`, identificam proposta, nota e versão/decisão. `CorrecaoRecuperacaoRevisaoNecessaria` identifica decisão e solicitações acadêmicas aprovadas/executadas afetadas. Não consomem tentativa, regularizam frequência ou movimentam o aluno.


Incremento 275: `ConclusaoAssinaturaPreservada`, agregado `Matricula`, identifica processo, conclusão, original, ambiente e hashes dos arquivos. Não expõe bytes ou identidades no evento, não confirma a conferência da Secretaria e não ativa matrícula.

Incremento 278: ContratoConfirmado passa a identificar aceiteOriginalId, conclusaoId e artefatoId no fluxo integrado, preservando documentoId e condicoesMensais. Autor é quem conferiu pela Secretaria/Administração; o evento não ativa a matrícula nem confirma pagamento. Bytes e identidades de signatários não são copiados ao evento.

### Incremento 280 — Ativação de preparação em turma

MatriculaAtivada, para a preparação comercial em turma, exige aceite integrado conferido, pagamentos exigidos pela versão contratada e ingresso válido. O payload contém preparacaoId, reservaId, alocacaoId, condicoesId, emissaoAtivacaoId, contratoDocumentoId, excecaoAdmissaoId e ativadaEm. A primeira mensalidade pode ser emitida nessa transação quando seu pagamento não é requisito prévio; portanto primeiraMensalidadeOk não é condição universal deste evento. ComissaoAprovada identifica comissaoId, vendedorId e memória da política aplicada. Os eventos são gravados na mesma transação da ativação e não são repetidos em nova chamada de conclusão.

### Incremento 281 — Encontros particulares na ativação

MatriculaAtivada inclui reservaParticularId e encontros, lista de pares horarioReservaId/encontroId, quando o ingresso ocorre por agenda particular. reservaId e alocacaoId ficam nulos nesse caso. Cada encontro preserva matrícula, professor, início/fim e fuso do horário reservado. Matrículas por hora não exigem primeiraMensalidadeOk: o requisito financeiro é a taxa e o adiantamento quando exigido nas condições registradas. A ativação não registra aula ministrada, presença ou consumo de horas.

### Incremento 282 — Diário particular

AulaDiarioRegistrada e AulaDiarioAtualizada utilizam agregado Matricula quando o encontro é individual. Identificam aulaId e encontroId, conteúdo, registros e, na edição, estadoAnterior, conteudoAnterior e registrosAntes. O contexto da conclusão por exceção inclui matriculaId para encontros particulares; decisão conserva a revisão independente e não cria cobrança ou consumo de horas.

### Incremento 285 — HorasCompradasReservadas

Evento da matrícula com reservaId, compraId, encontroId e minutos. Identifica comprometimento de horas já pagas; não registra recebimento, aula ministrada ou consumo definitivo.

### Incremento 286 — HorasCompradasConsumidas

Evento da matrícula com consumoId, reservaId, minutos, diarioId e estadoDiario. Identifica conferência financeira da realização, sem alterar status acadêmico ou recebimentos. O consumo é único por reserva.

### CancelamentoParticularProposto / CancelamentoParticularDecidido (incremento 288)

Agregado Matricula. Proposto: propostaId, encontroId, motivo. Decidido: propostaId, decisaoId, encontroId, aprovada, motivo, reservasHorasIds, acertoFinanceiroAutomatico=false. Autoria no envelope; decisão e alteração de agenda na mesma transação. Eventos não confirmam recebimento, não liberam reserva de horas e não executam crédito/devolução. Ajuste financeiro e notificações externas permanecem pendentes.

### LiberacaoHorasRemarcacaoProposta / LiberacaoHorasRemarcacaoDecidida (incremento 289)

Agregado Matricula. Proposta: propostaId, reservaId, cancelamentoId, minutos. Decisão: propostaId, decisaoId, reservaId, aprovada, minutos, motivo. Autoria no envelope. Aprovação independente libera a reserva para reutilização na mesma compra; decisão rejeitada não muda saldo. Não representa crédito monetário, devolução, recebimento, consumo nem publicação de agenda. A evidência da escolha do aluno permanece na proposta financeira.

### RemarcacaoParticularProposta / RemarcacaoParticularDecidida (incremento 290)

Agregado Matricula. Proposta: propostaId, encontroOriginalId, inicio, fim, professorId. Decisão: propostaId, decisaoId, encontroOriginalId, encontroNovoId (nulo se rejeitada), aprovada, motivo. Autoria no envelope. Aprovação cria encontro e decisão atomicamente; preserva o encontro cancelado e não emite cobrança, pagamento ou reserva financeira. Entrada da proposta conserva escolha do aluno e eventual exceção não letiva. Notificações externas ainda não integradas.

### CreditoHorasCanceladasProposto / CreditoHorasCanceladasDecidido (incremento 291)

Agregado Matricula. Proposta: propostaId, reservaId, cancelamentoId, minutos, valorCredito, moeda. Decisão: propostaId, decisaoId, reservaId, aprovada, minutos, motivo; se aprovada, creditoId/valorCredito/moeda. Autoria no envelope. Decisão e crédito imutáveis na mesma transação. Conversão exclui remarcação das mesmas horas e não registra recebimento, utilização do crédito ou devolução. Memória e evidência da escolha permanecem na proposta.

### UtilizacaoCreditoProposta (incremento 292)

Agregado Matricula de origem. Payload: propostaId, creditoId, cobrancaId, versao, valor, moeda, aplicada=false. Autoria no envelope. Proposta imutável com concordância e snapshot. Não implica reserva de saldo, aprovação, abatimento, recebimento ou devolução. Aprovação/aplicação e seus eventos ainda pendentes.

### Incremento 293 — UtilizacaoCreditoDecidida

Agregado: matrícula de origem. Registra proposta, decisão, crédito, cobrança, valor, aprovação/rejeição e motivo. Emitido na transação da decisão independente; aprovação aplica liquidação por crédito sem Recebimento ou entrada de caixa. Repetição idempotente não cria outra decisão. Rejeição preserva saldo. Não comprova devolução de dinheiro.

### Incremento 299 — AcertoEncerramentoDecidido

Agregado Aluno; identifica pedido, rascunho, decisão e aprovação/rejeição. A decisão pertence aos contratos selecionados do pedido e não comprova encerramento, recebimento, emissão de crédito ou devolução. Emitido junto da decisão independente, sem duplicação na repetição idempotente.
