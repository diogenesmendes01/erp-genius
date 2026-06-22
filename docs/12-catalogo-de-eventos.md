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
| `agregadoTipo` | Entidade afetada: `Lead · Matricula · Aluno · Cobranca · Comissao · Turma · Pais · Usuario · Idioma · Modalidade · Nivel · Produto · Preco` |
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
| `LeadCriado` | Lead entra no sistema | Sistema/Vendedor | `{ origem, segmento, paisId }` |
| `LeadAtribuido` | Define/troca o dono | Sistema/Gerente | `{ de, para, motivo }` |
| `EtapaAlterada` | Muda a etapa do funil | Vendedor | `{ de, para }` |
| `ExperimentalAgendada` | Agenda aula experimental | Vendedor | `{ data }` |
| `ExperimentalRealizada` | Check-in "Compareceu" | Professor | `{ turmaId, data }` |
| `NoShow` | Check-in "Faltou" | Professor | `{ data }` |
| `PropostaEnviada` | Envia proposta | Vendedor | `{ data }` |
| `LeadPerdido` | Marca perdido (terminal) | Vendedor | `{ motivoPerda, observacao }` |
| `LeadEditado` | Edição de dados do lead | Vendedor | `{ nome, temperatura }` |
| `InteracaoRegistrada` | Registro manual de interação | Vendedor | `{ canal, nota }` |
| `DocumentoAnexado` | Upload de documento ao lead | Vendedor | `{ categoria, nome }` |
| `DocumentoArquivado` | Arquiva documento (soft-delete) | Vendedor | `{ documentoId, nome }` |

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
| `CobrancaEnviadaWhatsApp` | "Abrir no WhatsApp" (wa.me) | Financeiro/Secretaria | `{ modelo }` |

> **Reservados (planejados — gatilho ainda não disparado no código):** `ValorNegociado`,
> `MatriculaAtivadaComPendencia`, `MatriculaCancelada`, `ComissaoEstornada`.
> Mantidos no catálogo porque o roadmap (Fase 1/2) os ativa; ao implementar, manter o padrão.

## Alunos (agregado `Aluno`)
| Evento | Gatilho | Quem | Payload |
|---|---|---|---|
| `AlunoMatriculado` | Matrícula ativada cria/ativa aluno | Sistema | `{ matriculaId, turmaId }` |
| `AlunoEditado` | Edição de dados cadastrais (motivo obrigatório) | Secretaria/Pedagógico | `{ de, para, motivo }` |
| `AlunoImportado` | Carga de alunos Q10 (Listado de alunos) — **persistido como `ALUNO_IMPORTADO`** (ver nota de nomenclatura) | Sistema (docs 19, 21) | `{ origem, codigoQ10?, ... }` |
| `AlunoVinculadoTurma` | Carga de rosters (EstudiantesCurso Q10) | Sistema (doc 21) | `{ turmaId, nivel, ativa }` |
| `TrocaTurma` | Troca de turma | Secretaria/Pedagógico | `{ de, para, motivo }` |
| `AlunoPausado` | Pausa | Secretaria | `{ motivo, dataRetornoPrevista }` |
| `AlunoReativado` | Pausado → Ativo | Secretaria | `{ data }` |
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
| `TurmaImportada` | Carga única do ListadoCursos (Q10) | Sistema (doc 20) |
| `TurmaPlanejada` / `TurmaAberta` / `TurmaEmAndamento` / `TurmaConcluida` | Ciclo de vida da turma | Gerente Pedagógico |
| `AberturaTurmaSolicitada` | Vendedor solicita abertura (sem turma compatível) | Vendedor (agregado `Produto`) |
| `UsuarioCriado` / `UsuarioEditado` / `UsuarioAtivado` / `UsuarioDesativado` | Gestão de usuários | Admin |

> Lista de eventos de configuração é **aberta** — adicione conforme novas telas de backstage,
> mantendo o padrão `tipo · agregado · gatilho · autor · payload`.

---

## Estado de implementação (código vs planejado)
Conferido contra `src/server/**/acoes.ts` (junho/2026):

- **Disparados hoje pelo código (Fase 0):** `LeadCriado · LeadAtribuido · EtapaAlterada ·
  ExperimentalAgendada · PropostaEnviada · LeadPerdido · LeadEditado · InteracaoRegistrada ·
  DocumentoAnexado · DocumentoArquivado · MatriculaCriada · MatriculaAtivada · CobrancaGerada ·
  ComissaoGerada · ComissaoAprovada · PagamentoRegistrado · DescontoSolicitado ·
  AprovacaoDecidida · ComissaoPaga · CobrancaEnviadaWhatsApp · AlunoMatriculado · AlunoEditado ·
  AlunoPausado · AlunoReativado · AlunoEncerrado · TrocaTurma · AberturaTurmaSolicitada ·
  TurmaCriada · TurmaEditada · IdiomaCriado · ModalidadeCriada · ModalidadeEditada · NivelCriado ·
  ProdutoCriado · PrecoDefinido · PaisCriado · PaisEditado · UsuarioCriado · UsuarioEditado`.
- **Só nos scripts de carga Q10 (one-shot, docs 19–23):** `AlunoImportado` (persistido como
  `ALUNO_IMPORTADO`) · `AlunoVinculadoTurma` · `TurmaImportada` · `MatriculaImportada` ·
  `ComissaoImportada`.
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
