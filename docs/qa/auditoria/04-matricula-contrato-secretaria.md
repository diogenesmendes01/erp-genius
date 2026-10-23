# Auditoria 04: Entrada, matrícula, contrato e Secretaria

> Data: 2026-10-21 · Commit auditado: `9e3d1d3c` (branch `qa/auditoria-e-onboarding`, igual à `main` atual mais o kit de QA).
> Método: leitura do código, das migrations e dos testes, cruzando com as fontes normativas. Nenhum código foi alterado e nenhum teste foi executado.
> Precedência das fontes: SPECs com critérios numerados (`docs/specs/matricula-como-unidade-operacional.md` §9, `docs/specs/documento-contratual.md` §6, `docs/specs/desistencia-preparacao.md`) > `docs/37` > `docs/41` e `docs/planejamento/quadro-entregas.md` > docs 04/05/06/09 (originais, parcialmente obsoletos).
> Regra: **especificação não comprova implementação.** Só código e testes contaram como evidência. Os documentos de planejamento serviram apenas para localizar o código.
> Convenção de papéis: VEND = Vendedor, GC = Gerente Comercial, SEC = Secretaria Acadêmica, FIN = Financeiro, GP = Gerente Pedagógico, PROF = Professor, ADM = Administrador. **ADM passa em qualquer guard de papel** (`src/server/_shared/sessao.ts:120-131`). As regras de "outra pessoa" comparam o autor, não o papel, e por isso valem também para o ADM.

## Resumo

### Contagens

| Conjunto | Atendido | Parcial | Não atendido | Total |
|---|---|---|---|---|
| MAT-01 a MAT-29 (SPEC-ERP-002 §9) | 18 | 11 | 0 | 29 |
| DOC-01 a DOC-19 (SPEC-ERP-003 §6) | 9 | 10 | 0 | 19 |
| **Total de critérios** | **27** | **21** | **0** | **48** |
| Achados da tabela de achados | — | — | — | 24 (3 bloqueadores de UAT, 9 divergências, 12 parciais/lacunas) |

"Atendido" quer dizer que o código e os testes cobrem o critério. Isso não garante que o QA consiga exercitá-lo em UAT: vários critérios atendidos dependem de uma assinatura concluída, e em UAT não existe meio de concluir uma (ver achado 1).

### Os 5 achados mais importantes

1. **Não dá para assinar um contrato em UAT, e por isso nenhuma matrícula da preparação comercial chega a ATIVA.** Não existe driver de fornecedor, nem driver simulado, nem tela, rota ou webhook que crie o processo de assinatura, registre o envio ou registre a conclusão. Essas funções (`src/server/contratos/envio-tx.ts:15-80` e `conclusao-assinatura-tx.ts:11-33`) só são chamadas por testes e pela fixture `src/test/substituicao-contratual.ts:96-99`. A própria tela avisa: "O envio ao serviço de assinatura ainda não está disponível" (`src/app/(app)/matriculas/[id]/contrato/originais/[artefatoId]/page.tsx:42`). A ativação exige o aceite integrado, que por sua vez exige uma conclusão em **PRODUCAO** (`src/server/contratos/aceite-estado.ts:20,54-56`). O aceite por anexo manual está vetado para essas contratações (`src/server/contratos/aceite-legado.ts:7-11`). Pelo mesmo motivo, aditivos, substituição contratual (Q116) e agenda Q117 ficam inacessíveis. O quadro de entregas confirma que o port com driver simulado "não está na `main`" (`docs/planejamento/quadro-entregas.md:397`).
2. **O pagamento simulado está desligado no código, qualquer que seja o ambiente.** `pagamentoSimuladoHabilitado()` retorna `false` fixo (`src/server/financeiro/gateway.ts:42-45`); antes, dependia de `PAGAMENTO_SIMULADO=1`. A página pública `/pagar/[token]` e o webhook simulado ficam inertes. Em UAT, o pagamento só é confirmado pelo Financeiro: lançamento direto em `/alunos/[id]/financeiro`, ou confirmação em `/financeiro` de um informe feito pela Secretaria (`src/server/financeiro/acoes.ts:69-83,130`).
3. **Reserva de turma nunca expira.** Não há rotina automática nem código que leve uma `ReservaVagaMatricula` a `EXPIRADA`. Uma reserva vencida e sem evidência continua `ATIVA` e ocupando a vaga, e o botão "Conferir" só devolve `CONFERIR_ASSINATURA_EXTERNA` (`src/server/matricula/reserva-vencimento-tx.ts:23-25`). A resolução por prorrogação ou liberação só aceita `MANTIDA_PENDENCIA` (`reserva-resolucao.ts:23`), então hoje só uma desistência libera essa vaga. Na particular, a expiração funciona por cron (`reserva-particular-cron.ts:7-26`, chamada em `src/app/api/whatsapp/cron/route.ts:46`).
4. **Há dois fluxos de matrícula paralelos, e o legado é o único que ativa em UAT.**
   - `/matriculas/nova` (VEND/GC) sempre cria um `Aluno` novo (`src/server/matricula/acoes.ts:169`), o que duplica o cadastro de quem já é aluno. Também emite a taxa e a 1ª mensalidade na criação (`:304,:328`), não confere janela nem reserva, e cria comissão `PENDENTE` (`:362-371`).
   - A ativação desse fluxo é por anexo manual do contrato (`src/server/secretaria/acoes.ts:129-160`).
   - O fluxo novo (`/oportunidades/[id]/contratacao`) cumpre Q103–Q123, mas trava na assinatura.
   - A SEC abre `/matriculas/nova` (`page.tsx:23`), mas não consegue salvar: a ação exige VEND/GC (`acoes.ts:629-630`, `permissoes.ts:10`).
5. **A desistência antes da ativação (Q121) está quase completa, exceto o ramo de assinatura.** Já funcionam:
   - o pedido versionado com fotografia;
   - o ramo simples (SEC efetiva);
   - a decisão administrativa independente;
   - o cancelamento de cobranças não pagas (FIN propõe, outro FIN/ADM aprova);
   - o acerto contratual Q165 e a reconferência por delta;
   - a fila `/secretaria/desistencias`.

   Falta o encerramento da solicitação externa de assinatura: a Server Action existe (`desistencia-cancelamento-assinatura.ts:22-30`), mas nenhuma tela a chama, e a observação do resultado só existe como primitiva (`cancelamento-assinatura-tx.ts:89-107`). Em UAT isso não chega a bloquear, porque nenhuma matrícula tem processo de assinatura (achado 1).

Os bloqueadores B1 e B2 de `docs/qa/auditoria-consolidada.md` foram escritos sobre o commit `bc858aff` e estão parcialmente desatualizados:

- **B2 já não procede.** O botão "Concluir matrícula" existe em `/secretaria` (`src/app/(app)/secretaria/SecretariaPainel.tsx:71`) e na ficha financeira (`src/app/(app)/alunos/[id]/financeiro/ConcluirMatriculas.tsx:29`).
- **B1 continua valendo só para o fluxo legado.** O wizard lista apenas turmas `ABERTA` com início futuro (`src/server/matricula/consultas.ts:49`), e `alterarStatusTurma` (`src/server/turmas/acoes.ts:260`) não tem tela. O fluxo novo aceita turma `PLANEJADA`, porque só exclui `CONCLUIDA` (`src/server/matricula/admissao-turma.ts:22`; `preparacao-comercial.ts:76`).

## Fluxo ponta a ponta como está no código

### A. Fluxo novo: oportunidade, preparação comercial e ativação (Q103–Q123)

| Passo | Tela/rota | Papel | Pré-condição | Efeito | Arquivo:linha |
|---|---|---|---|---|---|
| P0.1 Configurar prazo de reserva, exigência da 1ª mensalidade e fuso | `/configuracao/operacao` | ADM | — | `ConfiguracaoOperacional` (`prazoReservaMinutos`, `exigirPrimeiraMensalidade`, `prazoConferenciaHoras`, `fusoInstitucional`) | `src/server/operacao/acoes.ts:10-14` |
| P0.2 Configurar a política de entrada da oferta (forma de agenda, taxa antes da assinatura, adiantamento por hora) | `/configuracao/catalogo` (EntradasOfertas) | ADM | Oferta `ProdutoPais` existente | `ProdutoPais.formaAgenda`, `taxaPreviaAssinatura`, `adiantamentoHoraExigido`, versionados | `src/server/catalogo/entrada-oferta.ts:12-24`; `src/app/(app)/configuracao/catalogo/EntradasOfertas.tsx:19,34` |
| P0.3 Janela de admissão da turma | `/academico/admissoes` e `/[id]` | SEC/GP prepara; GP decide (outra pessoa) | Turma existente | Janela vigente aprovada; sem ela, `LIMITE_NAO_CONFIGURADO` | `src/server/matricula/janela-admissao.ts:20,48,55`; `reserva-disponibilidade.ts:6-7` |
| P0.4 Agenda da turma publicada, com docente apto e encontros futuros | área acadêmica (agenda/calendário, fora desta auditoria) | GP/SEC | Grade e calendário aprovados | Sem isso: `AGENDA_NAO_PUBLICADA`, `PROFESSOR_INAPTO` e `DISPONIBILIDADE_NAO_CONFERIDA` | `src/server/matricula/reserva-disponibilidade.ts:9-19`; `admissao-turma.ts:22-30` |
| P0.5 Modelo contratual publicado (finalidade CONTRATO e regime compatível) | `/configuracao/contratos/novo` e `/configuracao/contratos/[codigo]` | SEC prepara; ADM decide (outra pessoa) | — | Versão proposta e decisão; aprovar é o mesmo que publicar | `src/server/contratos/modelos.ts:12,19,25-26`; `modelos-tx.ts:8-10,27`; `src/app/(app)/configuracao/contratos/[codigo]/page.tsx:52` |
| 1. Abrir a contratação a partir do lead | `/funil`, depois "Contratação", em `/oportunidades/[id]/contratacao` | VEND (só carteira própria), GC, SEC | Lead com `vendedorDonoId`; oferta oferecida em país ATIVO; turma elegível ou agenda particular revisada | Escolha da identidade: candidatos com o mesmo telefone E.164, ou pessoa nova (primeiro nome e país obrigatórios; sobrenome e e-mail opcionais) | `src/app/(app)/oportunidades/[id]/contratacao/page.tsx:9`; `src/server/matricula/preparacao-comercial.ts:12-19,24-26,65-84`; `preparacao-comercial-tx.ts:14` |
| 2. Preparar a contratação | mesma tela | VEND, GC, SEC | Pessoa nova não pode colidir com telefone ou e-mail existente | Matrícula **RASCUNHO**, reserva **ATIVA** com prazo (turma) ou `ReservaAgendaParticular` (particular) e `PreparacaoComercialMatricula`, com regime, taxa e serviço propostos. Nenhuma cobrança ou comissão. Evento `ContratacaoPreparada`. Repetir devolve a mesma matrícula. | `preparacao-comercial.ts:41-62,90-107`; `preparacao-comercial-tx.ts:21-71` (`:42` colisão, `:62` RASCUNHO, `:65` preparação); `reserva-vaga-tx.ts:15-41` |
| 3. Decidir o preço, se fora da alçada | `/matriculas/[id]/preparacao` | GC (outra pessoa que não o preparador) | Preparação com preço pendente | Aprova ou rejeita o preço proposto | `src/server/matricula/preparacao-preco.ts:10-12,20-24,36-41` |
| 4. Assumir a matrícula | `/secretaria` ("Assumir matrícula") | SEC | Não ENCERRADA nem CANCELADA | `secretariaAssumiuEm` e responsável; evento `MatriculaAssumida`. Depois disso, o VEND só pede correção. | `src/server/secretaria/acoes.ts:65-77`; `SecretariaPainel.tsx:70` |
| 5. Registrar o pagador contratual | `/matriculas/[id]/pagador` | SEC registra; FIN só lê | Assumida; RASCUNHO ou AGUARDANDO; sem contrato confirmado; sem nenhuma cobrança | Nova versão em `PagadorPreparacaoMatricula` | `src/server/secretaria/pagador-preparacao.ts:16,21,28-29,61-69` |
| 6. Registrar as condições de entrada | `/matriculas/[id]/condicoes` | SEC registra; FIN só lê | Preço autorizado e pagador registrado | `CondicoesEntradaPreparacao` versionada | `src/server/secretaria/condicoes-entrada.ts:13-15,57-59` |
| 7. Conferir e emitir a entrada (Q112/Q119) | `/matriculas/[id]/emissao` | SEC | Revisão atual (hash), reserva ATIVA dentro do prazo, elegibilidade ou exceção Q110 | Emissão única por etapa: taxa sempre; 1ª mensalidade só se exigida; adiantamento por hora se exigido. Repetir não duplica. | `src/server/secretaria/conferencia-emissao.ts:21-45`; `src/server/matricula/emissao-entrada-tx.ts:21-25,44-72`; `plano-cobrancas-entrada.ts:22-37` |
| 8. Pagar a taxa e os pagamentos exigidos | `/alunos/[id]/financeiro` (FIN lança direto) ou SEC informa e FIN confirma em `/financeiro` (Informes) | FIN confirma; SEC só informa | Cobrança emitida | `Recebimento` confirmado. Informe `A_CONFERIR` não satisfaz nenhum requisito. **Pagamento simulado desligado.** | `src/server/financeiro/acoes.ts:69-83,130`; `src/app/(app)/alunos/[id]/financeiro/page.tsx:130`; `src/server/financeiro/gateway.ts:42-45` |
| 9. Gerar a prévia contratual | `/matriculas/[id]/contrato` | SEC | Modelo publicado compatível com o regime; RASCUNHO/AGUARDANDO assumida; com preparação; sem aceite | `PreviaDocumentoContratual` imutável; PDF em `/api/matriculas/[id]/previas/[previaId]/pdf` | `src/server/contratos/previas.ts:19-39`; `previa-estado.ts:21-43`; `preencher-modelo.ts:12-20` |
| 10. Conferir os participantes | `/matriculas/[id]/contrato/previas/[previaId]/participantes` | SEC | Prévia | `ConferenciaParticipantesContratuais` versionada (maioridade, representante, pagador distinto, empresa) | `src/server/contratos/participantes.ts:12-14`; `exigencias-assinatura.ts:34-38` |
| 11. Preservar o original (PDF) | `/matriculas/[id]/contrato/previas/[previaId]` | SEC | Participantes conferidos | `ArtefatoContratual` com PDF e hash. Falha do gerador não libera arquivo parcial. | `src/server/contratos/originais.ts:18-51` |
| 12. Conferir para assinatura | `/matriculas/[id]/contrato/originais/[artefatoId]` | SEC | Emissão inicial conferida; taxa confirmada se `taxaPreviaAssinatura`; reserva válida; agenda particular conferida | `ConferenciaAssinaturaContratual`; sempre `envioRealizado:false` | `src/server/contratos/assinatura-conferencia.ts:30-50`; `assinatura-estado.ts:24-51` |
| 13. **Enviar ao fornecedor e coletar assinaturas** | **sem tela** | — | — | **Bloqueio de UAT.** Processo, tentativa, resultado e conclusão só existem como primitivas usadas em testes. | `src/server/contratos/envio-tx.ts:15-80`; `conclusao-assinatura-tx.ts:11-33`; `originais/[artefatoId]/page.tsx:42` |
| 14. Aceite do original assinado | mesma tela (`ConferirAceite`, só aparece com conclusão) | SEC | Conclusão em PRODUCAO, íntegra, com processo ENVIADO | `AceiteOriginalContratual`, `Documento` CONTRATO, `contratoOk` | `src/server/contratos/aceite.ts:28-30`; `aceite-tx.ts:11-26`; `aceite-estado.ts:12-31` |
| 15. Concluir a matrícula (ativação) | `/secretaria` ("Concluir matrícula") ou `/alunos/[id]/financeiro` | SEC, FIN (revalidados no banco) | Assumida; aceite integrado; pagamentos exigidos confirmados; reserva da contratação elegível; sem aprovação pendente | Matrícula **ATIVA**; reserva **UTILIZADA**; `AlocacaoTurma` criada (turma) ou `EncontroAgenda` por horário (particular). Emissão da etapa ATIVACAO (1ª mensalidade não exigida antes). Comissão **APROVADA** para o vendedor responsável. `MovimentacaoAluno` MATRICULA. Lead **MATRICULADO**. | `src/server/matricula/acoes.ts:451-453,678-681`; `ativacao-preparacao-tx.ts:16-100` (`:36` aceite, `:44` pagamentos, `:74,:83` UTILIZADA, `:87` ATIVA, `:91` emissão, `:92-94` comissão); `ativacao.ts:10-15` |

### B. Fluxo legado `/matriculas/nova` (ainda ativo)

| Passo | Tela/rota | Papel | Pré-condição | Efeito | Arquivo:linha |
|---|---|---|---|---|---|
| L1. Assistente "aluno, curso e contrato" | `/matriculas/nova` (links em `/alunos` "Cadastrar aluno" e na ficha de empresa) | Página: VEND, GC, SEC. Ação: só VEND, GC | Turma opcional (sem turma = lista de espera); a lista de turmas só mostra `ABERTA` com início futuro | **Sempre cria Aluno novo.** Cria Responsáveis, Matrícula **AGUARDANDO**, alocação (se houver turma), **taxa e 1ª mensalidade já emitidas** e comissão **PENDENTE**. Preço fora da alçada gera `Aprovacao` DESCONTO. Lead vai para AGUARDANDO_MATRICULA. | `src/app/(app)/matriculas/nova/page.tsx:23`; `src/server/matricula/acoes.ts:169,238-258,277-305,304,328,362-371,377,394-403,625-630`; `consultas.ts:49`; `MatriculaFormulario.tsx:794` |
| L2. Assumir, anexar CONTRATO e confirmar o aceite | `/secretaria` | SEC | Assumida; **sem** preparação comercial | `contratoOk`, `confirmacaoContratoEm`, `contratoDocumentoId`; evento `ContratoConfirmado` | `src/server/secretaria/acoes.ts:129-160` (`:140` veto para preparação) |
| L3. Confirmar a taxa (e a 1ª mensalidade, se a configuração exigir) | `/alunos/[id]/financeiro` | FIN | Cobrança emitida | Recebimento confirmado | `src/server/financeiro/acoes.ts:69-83` |
| L4. Concluir a matrícula | `/secretaria` ou `/alunos/[id]/financeiro` | SEC, FIN | Aluno ATIVO; contrato aceito; taxa confirmada; sem aprovação pendente | **ATIVA** (`acoes.ts:518`); cronograma das mensalidades 2..N (`:501-541`) | `src/server/matricula/acoes.ts:439-520,678-681` |

Atalhos legados desligados: `registrarContratoEnviado` e `marcarContratoAssinado` sempre lançam erro (`acoes.ts:778-797`). `criarEAtivarMatricula` (`acoes.ts:695`) existe, mas nenhuma tela a usa.

## Máquinas de estado

### Matrícula (`enum StatusMatricula`, `prisma/schema.prisma:1524-1531`)

Valores: RASCUNHO, AGUARDANDO, ATIVA, PAUSADA, ENCERRADA, CANCELADA. RASCUNHO e AGUARDANDO não são etapas sucessivas. RASCUNHO identifica a preparação comercial (fluxo novo) e AGUARDANDO, o legado.

| De → Para | Gatilho | Onde |
|---|---|---|
| (nova) → RASCUNHO | Preparação comercial | `src/server/matricula/preparacao-comercial-tx.ts:62` |
| (nova) → AGUARDANDO | `/matriculas/nova` | `src/server/matricula/acoes.ts:246` |
| RASCUNHO/AGUARDANDO → ATIVA | Concluir matrícula (preparação) | `ativacao-preparacao-tx.ts:35,87` |
| AGUARDANDO → ATIVA | Concluir matrícula (legado) | `acoes.ts:478,518` |
| ATIVA → PAUSADA | Aplicação da pausa aprovada, por matrícula | `pausa-execucao.ts:45` |
| PAUSADA → ATIVA | Retomada aprovada | `retomada-execucao.ts:46` |
| ATIVA/PAUSADA → ENCERRADA | Efetivação do encerramento | `encerramento-aplicar-estado.ts:11-12` |
| RASCUNHO/AGUARDANDO → CANCELADA | Efetivação da desistência (trigger SQL) | `prisma/migrations/20260915135000_efetivacao_desistencia_preparacao/migration.sql:126`. Reabrir é bloqueado por trigger (`:156-175`). |

### Reserva (`enum StatusReservaVaga`, `prisma/schema.prisma:3648-3654`: ATIVA, MANTIDA_PENDENCIA, EXPIRADA, UTILIZADA, LIBERADA)

**Turma (`ReservaVagaMatricula`, `schema.prisma:3655`)**

| Transição | Onde |
|---|---|
| nasce ATIVA, com prazo `prazoReservaMinutos` | `reserva-vaga-tx.ts:41` |
| ATIVA vencida com evidência (informe, recebimento, cobrança paga, contrato) → MANTIDA_PENDENCIA, só pelo botão "Conferir" da SEC | `reserva-vencimento-tx.ts:26`; `reserva-painel.ts:31-37` |
| ATIVA vencida sem evidência → **continua ATIVA** (`CONFERIR_ASSINATURA_EXTERNA`) | `reserva-vencimento-tx.ts:23-25` |
| MANTIDA_PENDENCIA → ATIVA (prorrogar) ou LIBERADA | `reserva-resolucao.ts:23,70` |
| ATIVA/MANTIDA_PENDENCIA → UTILIZADA | `ativacao-preparacao-tx.ts:83` |
| ATIVA/MANTIDA_PENDENCIA → LIBERADA (desistência) | trigger `20260915135000:122-123` |
| → EXPIRADA | **nenhum código** |

**Particular (`ReservaAgendaParticular`, `schema.prisma:4119`)**

| Transição | Onde |
|---|---|
| nasce ATIVA | `reserva-particular-tx.ts:46` |
| ATIVA vencida → EXPIRADA (sem fato formal) ou MANTIDA_PENDENCIA (com fato formal) | `reserva-particular-vencimento-tx.ts:15-35`, via cron `reserva-particular-cron.ts:7-26`, chamado por `POST /api/whatsapp/cron` (`route.ts:46`, header `x-cron-secret` em `:37-42`) a cada 300 s pelo serviço `cron` de `docker-compose.prod.yml:121-129` |
| MANTIDA_PENDENCIA → ATIVA ou LIBERADA | `reserva-particular-resolucao.ts:73` |
| → UTILIZADA | `ativacao-preparacao-tx.ts:74` |
| → LIBERADA (desistência) | trigger `20260915135000:124-125` |
| EXPIRADA/LIBERADA → nova reserva encadeada | `nova-reserva-particular-tx.ts:64-65` |

Trigger `proteger_reserva_particular`: só `status` e `expiraEm` mudam, e uma reserva encerrada não pode ser reativada (`prisma/migrations/20260912220000_reserva_agenda_particular/migration.sql:58-69`).

### Documento contratual

Não existe um enum único; cada etapa é um registro próprio, e quase todos são imutáveis por trigger.

| Etapa | Modelo Prisma | Como entra | Regras |
|---|---|---|---|
| Modelo: proposta | `VersaoModeloContratual` (`schema.prisma:3827`) | `prepararModeloTx` (`modelos-tx.ts:13-31`) | Nova versão = `versaoEsperada + 1`; imutável (`migration 20260912140000:50-59`) |
| Modelo: publicado ou rejeitado | `DecisaoModeloContratual` (`:3846`), com `aprovada` true/false | `decidirModeloContratual` (`modelos.ts:17-32`) | ADM, outra pessoa, mesmo hash; aprovar é o mesmo que publicar |
| Prévia | `PreviaDocumentoContratual` (`:3857`) | `registrarPreviaContratual` (`previas.ts:19-39`) | Imutável; exige modelo publicado (`migration 20260912150000:40`) |
| Participantes | `ConferenciaParticipantesContratuais` (`:3879`) | `conferirParticipantesContratuais` | Versionada por prévia |
| Original | `ArtefatoContratual` (`:3896`) | `preservarOriginalContratual` (`originais.ts:18-51`) | PDF e hash |
| Conferência para assinatura | `ConferenciaAssinaturaContratual` (`:3949`) | `registrarConferenciaAssinatura` | Revisão por hash |
| Processo de assinatura | `ProcessoAssinaturaContratual`, `enum EstadoEnvioAssinatura` (`:3967-3973`: PREPARADO, ENVIANDO, ENVIO_INCERTO, ENVIADO, CANCELADO) | `prepararProcessoEnvioTx`, depois `iniciarTentativaAssinaturaTx`, depois `registrarResultadoEnvioTx` (`envio-tx.ts:15-80`) | **Só testes chamam.** Não existe estado CONCLUIDO. CANCELADO via Q116 (`substituicao-aplicar-tx.ts:42`) ou desistência (`cancelamento-assinatura-tx.ts:107`). |
| Conclusão | `ConclusaoAssinaturaContratual` (`:4575`) | `preservarConclusaoAssinaturaTx` (`conclusao-assinatura-tx.ts:11-33`) | **Só testes chamam.** Exige ENVIADO e todas as assinaturas. |
| Aceite | `AceiteOriginalContratual` (`:4889`) | `confirmarAceiteOriginalTx` (`aceite-tx.ts:11-26`) | Exige PRODUCAO (`aceite-estado.ts:20`). Cria o `Documento` e marca `contratoOk`, mas não ativa. |

Fornecedor: `ZAPSIGN`, `CLICKSIGN` ou `DOCUSIGN`; ambiente: `SANDBOX` ou `PRODUCAO` (`envio-tx.ts:9`). No schema são `String` (`schema.prisma:3990-3991`). Nenhum fornecedor está implementado, e a escolha Q155 continua pendente (`docs/planejamento/decisoes-2026-09-21.md:25,44`).

### Desistência antes da ativação (Q121)

Não existe enum de status no pedido. O estado se deduz das linhas existentes. A única exceção é `EstadoReconferenciaDeltaDesistencia` (`schema.prisma:8486`).

1. **Pedido.** `PedidoDesistenciaPreparacao` (`:2954`), imutável e versionado (`@@unique([matriculaId, versao])`), com `estadoHash` e fotografia. Criado pela SEC em `desistencia-preparacao.ts:107-137`. Exige RASCUNHO/AGUARDANDO sem `ativadaEm` (`desistencia-conferencia-tx.ts:47`).
2. **Decisão administrativa.** Só existe se houver avanço formal ou assinatura (`desistencia-conferencia-tx.ts:46`). `DecisaoAdministrativaDesistencia` (`:2982`), decidida por um ADM diferente de quem registrou o pedido (`desistencia-administrativa.ts:105,126,137`).
3. **Acerto financeiro.** Há quatro ramos:
   - **Cancelamento de cobranças não pagas:** `PropostaFinanceiraDesistencia` (`:3018`) e `DecisaoFinanceiraDesistencia` (`:3039`). Um FIN propõe e outro FIN (com `financeiro.aprovar_acertos`) ou o ADM decide (`desistencia-financeira.ts:34,61,67`; `desistencia-preparacao.ts:79`).
   - **Acerto contratual Q165:** proposta, decisão e aplicação (`:7923,:7949,:7964`). A aplicação é feita por quem aprovou (`desistencia-acerto-aplicacao.ts:52`).
   - **Reconferência por delta:** `PropostaReconferenciaDeltaDesistencia` (`:8492`).
   - **Assinatura:** `IntencaoCancelamentoAssinatura` (`:4045`) e `ObservacaoCancelamentoAssinatura` (`:4068`), sem tela (`desistencia-cancelamento-assinatura.ts:22-30`).
4. **Efetivação.** `EfetivacaoPedidoDesistenciaPreparacao` (`:2999`), única por pedido e por matrícula, feita pela SEC (`desistencia-efetivacao.ts:34`).
   - Revalida o hash e o último pedido (`desistencia-efetivacao-tx.ts:19-43,106-134`).
   - Uma trigger muda as reservas para LIBERADA e a matrícula para CANCELADA (`20260915135000:119-131`).
   - Depois disso, as cobranças canceladas ficam protegidas contra alteração.

## Critérios MAT-01..29

| Critério | Evidência arquivo:linha | Status |
|---|---|---|
| MAT-01 Aluno existente contrata regular e particular por hora; uma pessoa, duas matrículas, sem mensalidade fictícia | Reuso do `alunoId` conferido: `preparacao-comercial.ts:41-62` (`:55-56`). Regime MENSALIDADE/HORA_PARTICULAR: `preparacao-comercial-tx.ts:15-16`. Hora não vira mensalidade: `entrada-ativacao.ts:12-13`, `ativacao-preparacao-tx.ts:29`. Testes: `reserva-vaga.int.test.ts:355-374,569`. Ressalva: o legado cria pessoa nova (`acoes.ts:169`). | Atendido (fluxo novo) |
| MAT-02 Vínculos simultâneos independentes; duplicidade rejeitada | Índices parciais: `migrations/20260910010000_alocacao_matricula_expansao/migration.sql:10-11`, `20260914140000_alocacoes_contratos_independentes/migration.sql:3-21`. FK composta: `schema.prisma:1305`. Teste: `alocacao.int.test.ts:76,89,103`. | Atendido |
| MAT-03 Pausar só o regular | `pausa-proposta.ts:12-14,41-43`; `pausa-execucao.ts:11-52`; `limite-legado.ts:5-20`. Teste: `ct01-isolamento-contratos.int.test.ts:162`, `pausa-proposta.int.test.ts:266,372`. | Atendido |
| MAT-04 Encerrar só a particular com horas antecipadas | `encerramento-horas.ts:33`; `encerramento-consolidacao.ts:10,16`; `encerramento-aplicar-estado.ts:11-20`. Testes: `encerramento-horas.test.ts`, `compra-horas-encerramento-combinado.int.test.ts:160`. Falta teste do cenário exato "particular encerra, regular fica". | Atendido |
| MAT-05 Selecionar ambos para encerramento | `encerramento-solicitacao.ts:30-31`; `encerramento-previa-tx.ts:19-27`; `encerramento-efetivar-tx.ts:24-26`. Só a solicitação com 2 contratos é testada (`encerramento-solicitacao.int.test.ts:154`). | Parcial |
| MAT-06 Mudança após aprovação ou falha não aplica parcialmente | `pausa-execucao.ts:31-33`; `encerramento-efetivacao-estado.ts:26,34-36`; `encerramento-validade.ts:11-33`. Testes: `pausa-proposta.int.test.ts:323,409,431`, `encerramento-solicitacao.int.test.ts:219-272`. | Atendido |
| MAT-07 IDs trocados em chamada direta | Filtros `alunoId`+`matriculaId` e FKs compostas: `schema.prisma:64,230,1305,1702,1756,1806`; `gravacoes/autorizacao.ts:45-56`. Testes: `alocacao.int.test.ts:23,53,76`, `pausa-proposta.int.test.ts:346`. | Atendido |
| MAT-08 Outro contrato ativo não libera o alvo bloqueado | `gravacoes/autorizacao.ts:49-55,89-96`; `portal-aluno/entregas-reposicao.ts:82,433`. Teste: `gravacoes/autorizacao.int.test.ts:166,229`. | Atendido |
| MAT-09 Transferido com chamada pendente | `diario/chamada-tx.ts:6-30`; `diario/historico-contratual.ts:18`; `alunos/consultas.ts:64-72`. Teste: `diario/diario.int.test.ts:264,285`. | Atendido |
| MAT-10 D13/D14 numa só matrícula | `academico/estado.ts:59,73`; `academico/acoes.ts:72-73,189-190`; `retomada/acoes.ts:37`. Teste: `academico/fluxo.int.test.ts:706,759`. | Atendido |
| MAT-11 Turma/material compartilhados preservados | Por construção: `encerramento-aplicar-estado.ts:20`, `pausa-execucao.ts:38-43`, `gravacoes/autorizacao.ts:58-62`. Sem teste com vários participantes. | Parcial |
| MAT-12 Repetição/concorrência sem duplicar | Idempotência e locks: `pausa-execucao.ts:16`, `encerramento-efetivar-tx.ts:20-23`, `acoes.ts:635-647`, `preparacao-comercial-tx.ts:31-35`. Teste: `criar-idempotencia.int.test.ts`, `reserva-vaga.int.test.ts:1103,1507`. Avisos não são emitidos (não verificável). | Atendido |
| MAT-13 Recebimento único com destinações e crédito sem destino | `schema.prisma:314-366`; `financeiro/recebimentos.ts:30,63,83-84,126`. Teste: `financeiro/recebimentos-destinados.int.test.ts:53,114,129,169`. Um recebimento só destina para o contrato titular (`recebimentos.ts:63`). | Atendido |
| MAT-14 Migração com duas matrículas possíveis | `migracao/aplicar-vinculo.ts:56-58`; `migracao/preparacao.ts:63` (`MATRICULA_ORIGEM_AUSENTE`); `vinculo-legado.ts:16-55`. Teste: `migracao/aplicar-vinculo-adversarial.int.test.ts:69,86`. | Atendido (mecanismo; carga real não verificável) |
| MAT-15 Professor/comercial veem só o autorizado | `alunos/consultas.ts:21-26,64-72,255-262,307-322`. Teste: `alunos/projecao.test.ts:27,44,57,89`. | Atendido |
| MAT-16 Remover permissão do aprovador durante a análise; sem autoaprovação | Decisão revalida o decisor e recusa autoaprovação: `preparacao-preco.ts:20-41`, `janela-admissao.ts:15,55`, `excecao-admissao.ts:43,49`, `reserva-resolucao.ts:19,61`, `desistencia-administrativa.ts:105,126`. **No consumo, preço e exceção não revalidam o decisor:** `preco-autorizado.ts:15-17`, `excecao-admissao-estado.ts:37`. A desistência revalida (`desistencia-efetivacao-tx.ts:106-108`). | Parcial |
| MAT-17 Avançar para taxa/assinatura sem disponibilidade ou admissão | Fluxo novo: `reserva-vaga-tx.ts:36-38`, `emissao-entrada-tx.ts:44-52`, `assinatura-estado.ts:35-51`. Legado: turma opcional, sem janela nem reserva, taxa emitida na criação (`acoes.ts:277-305,304`). | Parcial |
| MAT-18 Duas preparações disputam a última vaga | `pg_advisory_xact_lock` e `FOR UPDATE`: `reserva-vaga-tx.ts:15-24,32-33`. Contagem de alocações e reservas: `reserva-disponibilidade.ts:15`. Trigger de capacidade: `20260912030000_capacidade_com_reservas:2-41`. Teste: `reserva-vaga.int.test.ts:89-129,1240`. | Atendido |
| MAT-19 Vencer reserva com/sem avanço formal | Particular: `reserva-particular-vencimento-tx.ts:22-35`, cron `reserva-particular-cron.ts:7-26`. **Turma: nunca EXPIRADA, sem rotina** (`reserva-vencimento-tx.ts:23-25`). Teste: `reserva-vaga.int.test.ts:166` (confirma que fica ATIVA). | Parcial |
| MAT-20 Turma em andamento dentro/fora da janela | `admissao-turma.ts:22-30` (`:27` JANELA_ENCERRADA, só barra CONCLUIDA); `janela-admissao.ts:46-74`. Teste: `admissao-turma.test.ts:6,9,25`, `janela-admissao.int.test.ts:20,45`. O legado não confere a janela (`acoes.ts:277-300`). | Parcial |
| MAT-21 Exceção Q110 após o limite | `excecao-admissao-estado.ts:8-41`; `excecao-admissao.ts:23-63`; consumo em `emissao-entrada-tx.ts:49-51` e `ativacao-preparacao-tx.ts:57-59`. Teste: `reserva-vaga.int.test.ts:757-1156` (`:897-904`, autoaprovação e SQL direto). | Atendido |
| MAT-22 Particular com grade fixa ou flexível | `schema.prisma:1007-1008`; `agenda-particular-estado.ts:14-17,57-64`; `reserva-particular-tx.ts:31,36-37`. **O servidor trata grade fixa e flexível igual (`encontros.min(1)`)**; a cobertura de todos os horários recorrentes só aparece no texto da tela (`nova-reserva/Formulario.tsx:67`). | Parcial |
| MAT-23 Conferência e emissão automática única da taxa | `conferencia-emissao.ts:23,29-45`; `conferencia-emissao-estado.ts:17-21`; `emissao-entrada-tx.ts:21-25,35,54-72`. Teste: `reserva-vaga.int.test.ts:652,688,720`, `app/(app)/matriculas/[id]/emissao/page.test.ts`. | Atendido (fluxo novo) |
| MAT-24 Vendedor com dados mínimos; Secretaria complementa; correção após assunção | `preparacao-comercial-tx.ts:14,40-46`; `secretaria/acoes.ts:65-125`; `comercial/acoes.ts:131,331`; `pagador-preparacao.ts:28`. Teste: `secretaria/politica.int.test.ts:124-127`, `reserva-vaga.int.test.ts:350-419,585`. | Atendido |
| MAT-25 Prorrogar/liberar reserva protegida | `reserva-resolucao.ts:19-75`; `reserva-particular-resolucao.ts:20-73`; SQL `20260912040000_resolucao_reserva:54-61`. Teste: `reserva-vaga.int.test.ts:191,210,222`. Na turma, o novo vencimento cai no mesmo problema de MAT-19. | Parcial |
| MAT-26 1ª mensalidade/adiantamento exigidos ou não | `plano-cobrancas-entrada.ts:22-37`; `entrada-particular-pagamentos.ts:50-56`; `ativacao-preparacao-tx.ts:29,41-45,91`. Teste: `reserva-vaga.int.test.ts:541,554,569,688`, `entrada-particular-pagamentos.test.ts`. | Atendido |
| MAT-27 Nova negociação de B para aluno vendido por A | `preparacao-comercial-tx.ts:30-38,45,67`; `ativacao-preparacao-tx.ts:64-68,92-94`. Teste: `reserva-vaga.int.test.ts:285,322,429`, `preparacao-escopo.int.test.ts:23,30`. | Atendido |
| MAT-28 Desistir antes da ativação, com/sem avanço formal | Ramos simples, administrativo, financeiro e Q165: `desistencia-conferencia-tx.ts:44-47`, `desistencia-preparacao.ts:86-137`, `desistencia-efetivacao-tx.ts:19-43,106-134`, `desistencia-financeira.ts:34,61,67`, `desistencia-acerto-aplicacao.ts:52,80-82`, trigger `20260915135000:119-131`. Testes: `desistencia-preparacao.int.test.ts`, `desistencia-administrativa.int.test.ts`, `desistencia-efetivacao.int.test.ts`, `desistencia-acerto-contratual.int.test.ts`. **O encerramento da assinatura aberta não tem tela nem receptor de resultado** (`desistencia-cancelamento-assinatura.ts:22-30`). | Parcial |
| MAT-29 Expiração sem avanço formal e nova reserva | Particular: `nova-reserva-particular.ts:40-46`, `nova-reserva-particular-tx.ts:26-68`. **Com processo ou documento de assinatura, a nova reserva é recusada** (`nova-reserva-particular-tx.ts:29`), em vez de encerrar a solicitação. Turma: sem expiração nem nova reserva. | Parcial |

## Critérios DOC-01..19

| Critério | Evidência arquivo:linha | Status |
|---|---|---|
| DOC-01 Contrato mensal e por hora refletem a contratação; sem mensalidade fictícia | `previa-estado.ts:23-26,39-43`. Teste: `preencher-modelo.test.ts`, `reserva-vaga.int.test.ts:569`. | Atendido |
| DOC-02 Sem modelo aprovado ou dado exigido, há pendência | `preencher-modelo.ts:12-14,20`; `previa-estado.ts:23,28`; trigger `20260912150000_previas_contratuais:40`. Teste: `modelos.int.test.ts:104`. | Atendido |
| DOC-03 Alteração posterior preserva o PDF; nova versão identifica as mudanças | Imutabilidade e PDF servido dos bytes guardados: `originais.ts:34-35,69-74`, `migration 20260912150000:38`. Revisão por hash: `assinatura-conferencia.ts:42`. **Não há identificação de diferenças entre versões** (só na Q116). | Parcial |
| DOC-04 Cláusula livre ou preço não aprovado rejeitado | Schema `.strict()`: `previas.ts:10`; `preencher-modelo.ts:5-8`; preço autorizado: `previa-estado.ts:31`. Teste: `reserva-vaga.int.test.ts:509`. | Atendido |
| DOC-05 Liberar sem conferência ou com condições alteradas | `assinatura-conferencia.ts:42,50`; `envio-tx.ts:28,47`. Teste: `reserva-vaga.int.test.ts:946-960,1139`. | Atendido (bloqueio) |
| DOC-06 Taxa prévia exigida com só um informe | `assinatura-estado.ts:26,33-34`. Teste: `reserva-vaga.int.test.ts:758-759,929`. | Atendido |
| DOC-07 Oferta dispensa taxa prévia | Política `SEM_PAGAMENTO_PREVIO`: `assinatura-estado.ts:56`. A conferência passa, mas **não há liberação nem envio operacional**. | Parcial |
| DOC-08 Disponibilidade ou admissão deixam de valer | `assinatura-estado.ts:35-51`; `envio-tx.ts:46`; `reserva-particular-vencimento-tx.ts:27-34`. Teste: `reserva-vaga.int.test.ts:1180-1278`. | Atendido |
| DOC-09 Troca de documentoId/matriculaId | `previas/[previaId]/page.tsx:25`; `participantes/page.tsx:33`; `api/matriculas/[id]/previas/[previaId]/pdf/route.ts:10-12`; `originais.ts:69-74`; `assinatura-conferencia.ts:19`. Teste: `reserva-vaga.int.test.ts:257,303,429`. As rotas de API não têm teste. | Atendido |
| DOC-10 Repetição após resposta incerta | Idempotência: `previas.ts:28`, `originais.ts:34-35`, `assinatura-conferencia.ts:38-45`, `envio-tx.ts:22,45,66-69`. O envio existe só como primitiva. | Parcial |
| DOC-11 Atualização do modelo não toca contrato aceito | Triggers `20260912140000:50,58-59`; aceite único `schema.prisma:4889-4906`; `aceite-tx.ts:22`. Teste: `modelos.int.test.ts:66`, `reserva-vaga.int.test.ts:1067-1083`. Não exercitável em UAT. | Atendido |
| DOC-12 Arquivo parcial, falha ou retorno de outra matrícula | `originais.ts:43,51,74`; `conclusao-assinatura-tx.ts:21-22`; `envio-tx.ts:65,71`. **Não existe receptor de retorno (webhook).** | Parcial |
| DOC-13 Preparar e publicar modelo com aprovador independente | `modelos.ts:12,19,25-26,31`; `modelos-tx.ts:8-10`; triggers `20260912140000:52-53`. Teste: `modelos.int.test.ts:32,48,54,66,76`, `ModeloFormulario.interacao.test.ts`. | Atendido |
| DOC-14 Participantes condicionais; assinatura parcial; retorno errado | `exigencias-assinatura.ts:34-38`; `assinatura-estado.ts:22`; `conclusao-assinatura-schema.ts:15,20`. Teste: `exigencias-assinatura.test.ts`, `conclusao-assinatura.test.ts`. O retorno real não chega ao sistema. | Parcial |
| DOC-15 Substituição durante a assinatura (Q116) | Proposta e decisão com tela: `substituicao.ts:18-27`, `substituicao-tx.ts:49-62`. Cancelamento e aplicação só como primitivas: `cancelamento-assinatura-tx.ts:14-45`, `substituicao-aplicar-tx.ts:13-42`. Exige processo ENVIADO (`substituicao-estado.ts:32`), estado inalcançável em UAT. | Parcial |
| DOC-16 Aditivo com alçadas, assinatura, conferência e aplicação | Cadeia: `aditivo-tx.ts:53`, `aditivo-alcadas-tx.ts:20,33`, `aditivo-condicoes-tx.ts:44,70,88,96-97`. Teste: `aditivo.int.test.ts`, `agenda-aditivo.int.test.ts`. A conclusão existe só como primitiva; a aplicação exige PRODUCAO. | Parcial |
| DOC-17 Desistência com assinatura aberta | `desistencia-cancelamento-assinatura.ts:22-30` (sem tela); `cancelamento-assinatura-tx.ts:89,95-107`; `desistencia-documental.ts:69-95` (só leitura). | Parcial |
| DOC-18 Vários participantes; o cliente assina antes da escola | Etapas CLIENTE/ESCOLA derivadas do modelo: `exigencias-assinatura.ts:34`. Ordem validada só na conclusão: `conclusao-assinatura-schema.ts:24-25`. **Não existe envio em duas etapas.** | Parcial |
| DOC-19 Reserva expira com solicitação aberta | `reserva-particular-vencimento-tx.ts:25-34` (MANTIDA_PENDENCIA); `nova-reserva-particular-tx.ts:29` (recusa). **Não existe encerramento da solicitação por Q123.** | Parcial |

## Mapa de telas

Guards de página: `exigirSessaoPagina` (`src/server/_shared/sessao.ts:163-188`). Sem sessão vai para `/login`; sem papel, para `/acesso-negado`. As abas de `/matriculas/[id]` seguem `SECOES_MATRICULA` (`src/app/(app)/matriculas/[id]/secoes.ts:21-38`), e o layout aceita a união dos papéis: VEND, GC, SEC, FIN, GP, ADM (`secoes.ts:41`; `carregar-cabecalho.ts:12`). **PROF não abre nenhuma tela de matrícula.**

| Rota | Arquivo | Papéis (guard real) | O que faz |
|---|---|---|---|
| `/matriculas` | não existe | — | O menu "Matrículas" leva a `/secretaria` (`src/lib/nav.ts:15`) |
| `/matriculas/nova` | `(app)/matriculas/nova/page.tsx` | Página: VEND, GC, SEC (`:23`). Salvar: VEND, GC (`acoes.ts:629-630`) | Assistente legado: cria aluno novo e matrícula AGUARDANDO. A SEC vê a tela sem o botão salvar (`MatriculaFormulario.tsx:794`). |
| `/matriculas/[id]` (layout e hub) | `matriculas/[id]/layout.tsx`, `page.tsx` | VEND, GC, SEC, FIN, GP (`carregar-cabecalho.ts:12`) | Cabeçalho e abas por papel |
| `…/preparacao` | `[id]/preparacao/page.tsx` | VEND, GC, SEC (`:15`). Decidir preço: GC (`preparacao-preco.ts:12`) | Proposta comercial, política de entrada e pendências |
| `…/reserva` | `[id]/reserva/page.tsx` | VEND, GC, SEC (`:10`; `reserva-comercial.ts:16`) | Turmas compatíveis e reserva |
| `…/nova-reserva` | `[id]/nova-reserva/page.tsx` | SEC (`:7`; `nova-reserva-particular.ts:12,28`) | Nova reserva particular após expiração ou liberação |
| `…/contrato` | `[id]/contrato/page.tsx` | SEC (`:19`; `previas.ts:21`) | Escolher modelo e registrar prévia |
| `…/contrato/previas/[previaId]` | `contrato/previas/[previaId]/page.tsx` | SEC (`:21`); `notFound` para outra matrícula (`:25`) | Prévia e preservação do original |
| `…/previas/[previaId]/participantes` | `…/participantes/page.tsx` | SEC (`:29`; `participantes.ts:14`) | Conferir signatários, maioridade e representação |
| `…/contrato/originais/[artefatoId]` | `contrato/originais/[artefatoId]/page.tsx` | SEC (`:25`; `assinatura-conferencia.ts:32`; `aceite.ts:30`) | Conferência para assinatura; aceite só com conclusão. Mostra o aviso de envio indisponível (`:42`). |
| `…/contrato/aditivos` | `contrato/aditivos/page.tsx` | SEC (`:14`; `aditivos.ts:24`) | Lista e prepara aditivo; exige original concluído (`aditivo-estado.ts:24-39`) |
| `…/contrato/aditivos/[propostaId]` | `aditivos/[propostaId]/page.tsx` | SEC (`:19`). Decidir: ADM (`aditivos.ts:30`). Acertos de taxa: FIN/ADM (`aditivo-acerto-taxa-acoes.ts:41`) | Proposta, efeitos e impactos. Um FIN puro não abre a página. |
| `…/aditivos/[propostaId]/alcadas` | `…/alcadas/page.tsx` | ADM, SEC, FIN, GC, GP (`:14`). Decisão por alçada (`aditivo-alcadas.ts:17-25`) | Alçadas financeira, comercial e pedagógica |
| `…/aditivos/[propostaId]/originais/[artefatoId]` | `…/originais/[artefatoId]/page.tsx` | SEC (`:25`) | Conferência, processo (só PREPARADO), conferência final e aplicação (só com conclusão) |
| `…/contrato/aditivos/agenda` | `aditivos/agenda/page.tsx` | SEC, ADM, GP (`:8`) | Conferência de agenda Q117 (só consulta) |
| `…/contrato/substituicoes` e `/[propostaId]` | `contrato/substituicoes/**` | SEC (`:12`, `:15`). Decidir: ADM (`substituicao.ts:26`) | Substituição Q116; exige processo ENVIADO |
| `…/emissao` | `[id]/emissao/page.tsx` | SEC (`:14`; `conferencia-emissao.ts:23`) | Conferir e emitir a entrada |
| `…/pagador` | `[id]/pagador/page.tsx` | SEC, FIN (`:12`). Registrar: SEC (`pagador-preparacao.ts:16`) | Pagador contratual versionado |
| `…/condicoes` | `[id]/condicoes/page.tsx` | SEC, FIN (`:11`). Registrar: SEC (`condicoes-entrada.ts:15`) | Condições de entrada |
| `…/condicoes-horas` | `[id]/condicoes-horas/page.tsx` | SEC, FIN (`:9`). Decidir: ADM (`condicoes-horas.ts:71`) | Condições por hora |
| `…/continuidade-mensal` | `[id]/continuidade-mensal/page.tsx` | SEC, FIN (`:10`). Decidir: ADM (`condicoes-continuidade-mensal.ts:76`) | Continuidade mensal |
| `…/entrada-particular` | `[id]/entrada-particular/page.tsx` | SEC, FIN (`:13`) | Leitura dos pagamentos de entrada da particular |
| `…/autorizacoes-comunicacao` | `[id]/autorizacoes-comunicacao/page.tsx` | SEC, ADM (`:11`) | Destinatários acadêmicos |
| `…/disponibilidade-oferta` | `[id]/disponibilidade-oferta/page.tsx` | SEC, GP, FIN (`:8`). Decidir: GP (`disponibilidade-oferta.ts:75`) | Confirmação de oferta |
| `…/indisponibilidade-oferta` (com `/[registroId]/correcao` e `/termino`) | `[id]/indisponibilidade-oferta/**` | SEC, GP, FIN, ADM (`:10`, `:17`). Confirmar e decidir: GP | Relatos, correção e término |
| `…/ocorrencias-financeiras` (com `/revisoes-correcao-aula`) | `[id]/ocorrencias-financeiras/**` | FIN (`:10`, `:9`) | Ocorrências e revisões das particulares |
| `…/fechamentos-horas` | `[id]/fechamentos-horas/page.tsx` | FIN (`:36`) | Fechamentos por hora (exige `?aluno=`) |
| `…/compensacoes/[cobrancaId]` (com `/periodo-integral`) | `compensacoes/**` | FIN, ADM (`:12`, `:13`) | Compensação de dias e período integral |
| `…/desistencia` | `[id]/desistencia/page.tsx` | SEC, ADM (`:18`; `desistencia-preparacao.ts:109`; `desistencia-efetivacao.ts:34`) | Pedido e efetivação |
| `…/desistencia/administracao` | `desistencia/administracao/page.tsx` | SEC, ADM (`:16`). Decidir: ADM (`desistencia-administrativa.ts:105`) | Decisão administrativa |
| `…/desistencia/documentos` | `desistencia/documentos/page.tsx` | SEC, ADM (`:16`) | Só leitura de documentos e processos |
| `…/desistencia/financeiro` | `desistencia/financeiro/page.tsx` | FIN, ADM (`:19`) | Cancelamento de cobranças, acerto Q165 e delta |
| `/oportunidades/[id]/contratacao` | `oportunidades/[id]/contratacao/page.tsx` | VEND, GC, SEC (`:9`). VEND e GC só na carteira (`preparacao-comercial.ts:12-19`) | Preparação comercial. Links em `funil/PainelOportunidade.tsx:231` e `funil/FunilCliente.tsx:70` |
| `/secretaria` | `secretaria/page.tsx` | SEC, VEND, GC (`:15`) | Busca de matrículas; assumir; correções; documentos; confirmar contrato (legado); concluir matrícula |
| `/secretaria/reservas` | `secretaria/reservas/page.tsx` | SEC (`:10`) | Reservas de turma e particulares; botão "Conferir" |
| `/secretaria/reservas/[id]` e `/particulares/[id]` | `reservas/**` | SEC (`:10`). Decidir: ADM (`reserva-resolucao.ts:55`) | Propor e decidir prorrogação ou liberação |
| `/secretaria/desistencias` | `secretaria/desistencias/page.tsx` | SEC, ADM (`:12`) | Fila de pedidos aguardando decisão administrativa |
| `/secretaria/envios-portal`, `/secretaria/avisos-agenda` | `secretaria/**` | SEC, ADM (`:19`, `:15`) | Envios de acesso ao portal; avisos de agenda (fora do escopo principal) |
| `/configuracao/contratos` | `configuracao/contratos/page.tsx` | **Sem guard próprio.** O layout aceita GP, GC, SEC (`configuracao/layout.tsx:11`); `listarFamiliasModelos` exige SEC (`modelos.ts:48`). A aba só aparece para ADM e SEC (`_componentes/tabs.ts:13`). | Famílias de modelos |
| `/configuracao/contratos/novo` | `contratos/novo/page.tsx` | SEC (`:5`) | Preparar modelo |
| `/configuracao/contratos/[codigo]` | `contratos/[codigo]/page.tsx` | SEC (`:16`). Decidir: ADM e outra pessoa (`:52`; `modelos.ts:19,25`) | Versões, nova versão e decisão |
| `/financeiro/desistencias` | `financeiro/desistencias/page.tsx` | FIN, ADM (`:11`) | Fila financeira das desistências |
| `GET /api/matriculas/[id]/previas/[previaId]/pdf` | `api/matriculas/[id]/previas/[previaId]/pdf/route.ts` | SEC (`:10`) | PDF da prévia |
| `GET /api/matriculas/[id]/originais/[artefatoId]/pdf` | `…/originais/[artefatoId]/pdf/route.ts` | SEC (`originais.ts:70`) | PDF do original |
| `GET /api/matriculas/[id]/assinaturas/[conclusaoId]/[tipo]` | `…/assinaturas/…/route.ts` | SEC (`conclusao-arquivo.ts:10`) | PDF assinado ou auditoria (só leitura) |
| `GET /api/matriculas/[id]/aditivos/**` (prévia, original, assinaturas) | `…/aditivos/**/route.ts` | SEC (`aditivo-arquivo.ts:12`; `aditivo-original-arquivo.ts:10`); SEC, ADM (`aditivo-conclusao-arquivo.ts:9`) | PDFs do aditivo |

### Testes existentes por módulo

| Diretório | Total | Integração (`.int`) | Interação | Unitários/SSR |
|---|---|---|---|---|
| `src/server/matricula` | 114 | 49 | 0 | 65 |
| `src/server/secretaria` | 1 (`politica.int.test.ts`) | 1 | 0 | 0 |
| `src/server/contratos` | 43 | 7 | 0 | 36 |
| `src/app/(app)/matriculas/**` | 62 | 0 | 16 | 46 |
| `src/app/(app)/secretaria/**` | 12 | 0 | 4 | 8 |
| `src/app/(app)/oportunidades/[id]/contratacao` | 2 | 0 | 1 | 1 |
| `src/app/(app)/configuracao/contratos` | 1 | 0 | 1 | 0 |
| `src/app/(app)/financeiro/desistencias` | 1 | 0 | 0 | 1 |
| `src/app/api/matriculas/**` | **0** | — | — | — |
| `e2e/` | nada de matrícula ou contrato (só `login.spec.ts` e `permissoes.spec.ts`); `e2e/README.md:116` cita um `matricula.spec.ts` que não existe | | | |

Os testes centrais são `reserva-vaga.int.test.ts` (cobre quase todo o fluxo novo, inclusive a assinatura por primitivas), `ct01-isolamento-contratos.int.test.ts`, `desistencia-*.int.test.ts`, `modelos.int.test.ts`, `aditivo.int.test.ts`, `substituicao.int.test.ts`, `criar-idempotencia.int.test.ts`, `ativacao.int.test.ts` e `secoes.test.ts` (abas × guard). Não há teste de servidor dedicado ao `registrarPagadorPreparacao`.

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Assinatura integrada | DOC §6.1, Q106/Q122/Q155; DOC-10/12/14/18 | O ERP envia o PDF, recebe o assinado e as evidências e concilia a incerteza | Sem adaptador, driver simulado, tela, rota ou webhook. Processo, tentativa e conclusão só em testes (`contratos/envio-tx.ts:15-80`; `conclusao-assinatura-tx.ts:11-33`; `src/test/substituicao-contratual.ts:96-99`) | Não implementado (**bloqueador de UAT**) | Na conferência para assinatura, o aviso "O envio ao serviço de assinatura ainda não está disponível" (`originais/[artefatoId]/page.tsx:42`). Não há botão de envio. Não abrir bug; registrar como bloqueio conhecido. |
| 2 | Ativação da preparação comercial | SPEC central §6 (matrícula mensal/por hora); DOC §6.1 | Ativar exige aceite com evidência conferido pela Secretaria | O aceite integrado exige conclusão em PRODUCAO (`aceite-estado.ts:20,54-56`); o aceite manual está vetado (`aceite-legado.ts:7-11`; `secretaria/acoes.ts:140`) | Bloqueado por #1 | "Concluir matrícula" mostra "O contrato precisa estar aceito e confirmado pela secretaria antes da ativação" (`ativacao.ts:12-14`). No painel: "Esta contratação exige assinatura integrada…" (`SecretariaPainel.tsx:76`). **[DEV]** precisa de driver simulado ou fixture para destravar. |
| 3 | Pagamento simulado | Comentário do gateway (Fase 2, `gateway.ts:7-11`); objetivo do UAT | `/pagar/[token]` funcional com `PAGAMENTO_SIMULADO=1` | `pagamentoSimuladoHabilitado()` retorna `false` fixo (`src/server/financeiro/gateway.ts:42-45`) | Divergente | Abrir o link de pagamento mostra pagamento desabilitado. Confirmar pagamentos pelo Financeiro em `/alunos/[id]/financeiro`. **[PO/DEV]** |
| 4 | Expiração da reserva de turma | MAT-19, MAT-29, Q108/Q123 | Sem avanço formal, expira uma vez e libera a vaga | Nunca chega a EXPIRADA; sem rotina; continua ATIVA (`reserva-vencimento-tx.ts:23-25`) | Parcial | Em `/secretaria/reservas`, "Conferir" numa reserva vencida sem pagamento mostra "É necessário conferir o processo de assinatura externa… Esta conferência não liberou a reserva." (`ConferirReserva.tsx:10`). A vaga continua ocupada. **[PO]** |
| 5 | Resolução da reserva de turma vencida sem evidência | Q118, MAT-25 | Proposta da SEC/ADM e aprovação de outra pessoa da ADM para prorrogar ou liberar | A resolução só aceita MANTIDA_PENDENCIA (`reserva-resolucao.ts:23`) | Parcial | Para uma reserva ATIVA vencida, o formulário de resolução recusa ou não aparece. Só a desistência libera a vaga. |
| 6 | Fluxo legado ativo | MAT §2.1, §7; MAT-01/17/20/23 | Reusar a identidade; avançar só com reserva/admissão; taxa só após conferência | `/matriculas/nova` cria aluno novo (`acoes.ts:169`), emite taxa e mensalidade na criação (`:304,:328`) e não confere janela nem reserva (`:277-305`) | Divergente | Cadastrar pela tela de nova matrícula um aluno que já existe gera um segundo cadastro. A taxa aparece logo após salvar. **[PO]** decidir se o legado sai do ar ou fica só para casos sem preparação. |
| 7 | SEC na tela legada | `permissoes.ts:7-10` (criar = VEND/GC) | — | A página abre para a SEC (`nova/page.tsx:23`), mas sem o botão salvar (`MatriculaFormulario.tsx:794`) | Divergente (menor) | A SEC preenche o assistente e não encontra "Salvar matrícula". **[PO]** |
| 8 | Turma ABERTA no legado | B1 (`auditoria-consolidada.md`) | — | O wizard lista só `ABERTA` com início futuro (`consultas.ts:49`); `alterarStatusTurma` não tem tela (`turmas/acoes.ts:260`); turmas nascem PLANEJADA (`schema.prisma:1112`; `turmas/acoes.ts:145`) | Divergente (só no legado) | No legado, a lista de turmas aparece vazia; salvar só funciona sem turma. **[DEV]** abrir a turma no banco de UAT, se o legado for testado com turma. |
| 9 | Pré-requisitos da turma no fluxo novo | Q103/Q107/Q109; MAT-17/20 | Avançar só com disponibilidade real | Exige janela de admissão aprovada, agenda publicada, docente apto, sem conflitos e com vaga (`reserva-disponibilidade.ts:6-19`; `admissao-turma.ts:22-30`) | Conforme | Turmas sem essa preparação aparecem inelegíveis, com códigos (`LIMITE_NAO_CONFIGURADO`, `AGENDA_NAO_PUBLICADA` etc.). O QA precisa preparar a turma antes. |
| 10 | Grade fixa × flexível | MAT-22, Q111 | A grade fixa exige todos os horários recorrentes reservados | O servidor exige só `encontros.min(1)` nos dois regimes (`agenda-particular-estado.ts:14-17`) | Parcial | Na grade fixa, um único horário é aceito sem bloqueio. **[PO]** |
| 11 | Nova reserva particular com assinatura | MAT-29, DOC-19 | Encerrar a solicitação aberta com confirmação e seguir | Recusa se houver processo ou documento de contrato (`nova-reserva-particular-tx.ts:29`) | Parcial | Mensagem "integração … ainda está pendente". Em UAT não ocorre, porque não há processo (#1). |
| 12 | Revalidação do aprovador no consumo | MAT-16 | A aplicação revalida acesso e separação de pessoas | Preço e exceção aprovados são lidos sem revalidar o decisor (`preco-autorizado.ts:15-17`; `excecao-admissao-estado.ts:37`) | Parcial | Desativar o GC depois de aprovar um preço não impede a emissão nem a ativação. **[PO]** |
| 13 | Desistência: encerramento externo | Q121, DOC-17, `desistencia-preparacao.md` "Ainda necessário" item 1 | Encerramento confirmado da solicitação aberta antes de efetivar | Server Action sem tela (`desistencia-cancelamento-assinatura.ts:22-30`); observação só como primitiva (`cancelamento-assinatura-tx.ts:89-107`) | Parcial | `/matriculas/[id]/desistencia/documentos` só lista os processos, sem botão de cancelamento. |
| 14 | Desistência: ramos simples, administrativo, financeiro e Q165 | Q121, Q165, MAT-28 | Sem avanço formal, a SEC efetiva. Com avanço, outra pessoa da ADM decide. O acerto tem aprovação própria. | Implementados com hash, idempotência e triggers (`desistencia-efetivacao-tx.ts:19-43,106-134`; `desistencia-financeira.ts:34,61,67`; trigger `20260915135000:119-131`) | Atendido | Ver os cenários CT-47 a CT-55. |
| 15 | Envio em duas etapas (cliente, depois escola) | Q122, DOC-18 | O cliente assina antes; a escola assina depois de todos | Etapas derivadas; ordem validada só na conclusão (`exigencias-assinatura.ts:34`; `conclusao-assinatura-schema.ts:24-25`) | Parcial | Não testável em UAT. |
| 16 | Diferenças entre versões do documento | DOC-03 | A nova versão identifica as mudanças | Só a substituição Q116 registra diferenças (`substituicao-*.ts`) | Parcial | A nova prévia não mostra o que mudou em relação à anterior. |
| 17 | Guard de `/configuracao/contratos` | `docs/37` (acesso fail-closed) | Quem não tem acesso vai para acesso negado | A página não tem guard; o layout aceita GP e GC; a consulta exige SEC (`configuracao/layout.tsx:11`; `modelos.ts:48`) | Divergente (menor) | GC ou GP que digita a URL vê a página de erro, não `/acesso-negado`. **[PO]** decidir se é bug. |
| 18 | Página do aditivo × Financeiro | DOC §6.3 (alçadas) | FIN decide a alçada financeira | `aditivos/[propostaId]/page.tsx:19` só aceita SEC, mas contém formulários de FIN | Divergente (menor) | Um FIN puro não abre a proposta; usa só `/alcadas`. |
| 19 | Texto de prontidão desatualizado | Incremento 281 (`matricula-como-unidade-operacional.md:483`) | A ativação particular já está integrada | `prontidao-preparacao.ts:32` ainda diz que a ativação da particular "ainda precisa ser concluída" | Divergente (texto) | Mensagem enganosa; abrir bug de baixa severidade. |
| 20 | Comissão: legado × novo | Doc 10 (comissão) e `ativacao-preparacao-tx.ts` | — | Legado: comissão PENDENTE na criação (`acoes.ts:362-371`). Novo: APROVADA na ativação (`ativacao-preparacao-tx.ts:92-94`) | Divergente entre fluxos | No legado, a comissão aparece antes da ativação. **[PO]** |
| 21 | Aditivos, substituição e agenda Q117 | Q116/Q117, DOC-15/16 | Fluxos completos | Dependem de conclusão ou processo ENVIADO (`aditivo-estado.ts:24-27`; `substituicao-estado.ts:32`; `agenda-aditivo-tx.ts:47`) | Inacessível em UAT (#1) | As telas abrem, mas recusam preparar proposta por falta de original assinado. |
| 22 | Doc 05/09 originais | Doc 05 e doc 09 §Matrícula | "Paga primeiro, contrato depois", DocuSign, "Receber pagamento e ativar" na criação | O botão atômico saiu da tela (`criarEAtivarMatricula` sem uso, `acoes.ts:695`); 1ª mensalidade configurável (`operacao/acoes.ts:10`) | Obsoleto | Não testar os passos do doc 05/09; seguir este relatório. |
| 23 | Auditoria anterior (B2) | `docs/qa/auditoria-consolidada.md` B2 | "Ativar matrícula não tem tela" | "Concluir matrícula" existe (`SecretariaPainel.tsx:71`; `ConcluirMatriculas.tsx:29`) | Desatualizado | Atualizar o consolidado e o roteiro 03. |
| 24 | Cobertura de testes | `docs/14` (estratégia de testes) | — | As rotas de PDF da API não têm testes; o e2e não tem matrícula; a Secretaria tem 1 arquivo de integração | Lacuna | Cenários manuais deste relatório; criar `e2e/matricula.spec.ts`. **[DEV]** |

## Cenários de teste para o QA

### Antes de começar

Usuários: `docs/qa/02-usuarios-e-papeis.md`. Use `secretaria@` (SEC puro), `financeiro@` (FIN puro), `gerente@` (GC puro), `gp@` (GP), `joao@` e `vendedor2@` (VEND A e B), `mariana@` (GC+VEND) e `admin@` (o único ADM).

Os fluxos com "outra pessoa da Administração" funcionam com um ADM só desde que a preparação seja feita pela SEC.

Marcações:
- **[PO]**: o resultado esperado depende de decisão do PO.
- **[DEV]**: precisa de passo do dev, como fixture, banco ou cron.
- **(N)**: caso negativo.

Os cenários seguem a ordem do fluxo.

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| CT-01 | ADM | Abrir `/configuracao/operacao`, definir o prazo de reserva em 60 min, deixar "exigir 1ª mensalidade" desligado e salvar. | Salva e grava histórico. |
| CT-02 (N) | SEC | Tentar salvar `/configuracao/operacao`. | Recusado: a ação exige ADM (`operacao/acoes.ts:14`). |
| CT-03 | ADM | Em `/configuracao/catalogo`, nas entradas da oferta de inglês regular, definir "taxa antes da assinatura" = sim e salvar com motivo. | Política salva em nova versão; a preparação mostra "Taxa antes da assinatura: Exigida". |
| CT-04 | SEC | Em `/configuracao/contratos/novo`, preparar o modelo CONTRATO, regime MENSALIDADE, com campos `{{chave}}` e a regra de assinatura ALUNO/SEMPRE. | Versão proposta, ainda não publicada. |
| CT-05 (N) | SEC | Abrir o modelo preparado em `/configuracao/contratos/[codigo]`. | Sem botão de decisão (`[codigo]/page.tsx:52`). |
| CT-06 | ADM | Abrir o mesmo modelo e aprovar. | Modelo publicado; versões anteriores preservadas. |
| CT-07 (N) | SEC | Preparar o modelo com o campo `{{inexistente}}` não declarado. | Erro "Campo não declarado". |
| CT-08 (N) **[PO]** | GC | Digitar `/configuracao/contratos`. | Hoje: página de erro, não `/acesso-negado` (achado 17). |
| CT-09 | SEC, depois GP | SEC prepara a janela de admissão da turma T em `/academico/admissoes`; GP aprova. | Janela vigente; a turma passa a poder ficar elegível. |
| CT-10 (N) | SEC | Tentar decidir a janela que preparou. | Recusado (`janela-admissao.ts:48`). |
| CT-11 **[DEV]** | GP | Garantir a turma T com grade e calendário aprovados, encontros futuros e professor apto (área acadêmica). | Na contratação, T aparece "elegível" com vagas. |
| CT-12 | VEND (`joao@`) | Em `/funil`, abrir o próprio lead e clicar em "Contratação". Escolher pessoa nova (só primeiro nome e país), a oferta e a turma T. Preparar. | Matrícula criada em Rascunho, com reserva com prazo de 60 min; nenhuma cobrança na ficha. |
| CT-13 | VEND | Repetir o envio (duplo clique ou recarregar e reenviar). | A mesma matrícula; sem segunda reserva. |
| CT-14 (N) | VEND B (`vendedor2@`) | Abrir `/oportunidades/[id]/contratacao` do lead do João pela URL. | Acesso negado ou erro de escopo; nenhum dado do lead. |
| CT-15 (N) | VEND | Na contratação, escolher uma turma sem janela ou sem agenda publicada. | Turma inelegível, com o motivo; não deixa reservar. |
| CT-16 | VEND | Lead novo com o mesmo telefone de um aluno existente: a tela mostra o candidato; selecionar e preparar. | Nova matrícula no mesmo aluno; a ficha do aluno lista duas matrículas. |
| CT-17 (N) | VEND | Lead com telefone de aluno existente: escolher "pessoa nova". | Erro "Existe cadastro com esse contato…". |
| CT-18 | VEND e VEND B | Com a turma de capacidade 1, os dois preparam ao mesmo tempo, em dois navegadores. | Só um reserva; o outro vê a turma sem vaga. |
| CT-19 | VEND3 (0%), depois GC (`gerente@`) | VEND3 prepara com taxa abaixo da referência; GC abre `/matriculas/[id]/preparacao` e aprova o preço. | Preço pendente até a decisão; depois, aprovado. |
| CT-20 (N) | GC+VEND (`mariana@`) | Preparar com preço fora da alçada e tentar aprovar o próprio preço. | Recusado (outra pessoa). |
| CT-21 | SEC | Em `/secretaria`, buscar pelo código da matrícula e clicar em "Assumir matrícula". | Marcada como assumida. |
| CT-22 | VEND, depois SEC | Depois da assunção, o VEND usa "Solicitar correção"; a SEC aplica ou rejeita. | O VEND não edita direto; a correção aparece com status. |
| CT-23 | SEC | Em `/matriculas/[id]/pagador`, registrar o pagador RESPONSAVEL (nome, país, motivo). | Versão 1 no histórico. |
| CT-24 (N) | FIN | Abrir `/matriculas/[id]/pagador`. | Só leitura; sem formulário. |
| CT-25 | SEC | Em `/matriculas/[id]/condicoes`, registrar as condições de entrada (dia de vencimento, cobertura). | Condições versionadas. |
| CT-26 (N) | SEC | Registrar condições com o preço ainda pendente (CT-19 antes da decisão). | Bloqueado por preço não autorizado. |
| CT-27 | SEC | Em `/matriculas/[id]/emissao`, conferir e emitir. | A taxa é criada uma vez; a 1ª mensalidade não (configuração desligada). |
| CT-28 | SEC | Repetir a emissão. | Sem segunda taxa. |
| CT-29 (N) | SEC | Emitir numa matrícula com reserva vencida (esperar o prazo). | Bloqueado: reserva vencida. |
| CT-30 (N) | SEC | Tentar alterar o pagador depois da emissão. | Bloqueado: "Alterações exigem revisão documental/financeira". |
| CT-31 | SEC, depois FIN | A SEC informa o pagamento da taxa em `/alunos/[id]/financeiro`; o FIN confirma em `/financeiro` (Informes). | Fica "a conferir" até o FIN confirmar; depois, Pago. |
| CT-32 | FIN | Registrar o pagamento direto em `/alunos/[id]/financeiro` (outra matrícula). | Pago na hora. |
| CT-33 **[PO/DEV]** | qualquer | Abrir um link `/pagar/[token]`. | Hoje: pagamento simulado desabilitado (achado 3). |
| CT-34 | SEC | Em `/matriculas/[id]/contrato`, escolher o modelo publicado e registrar a prévia; abrir o PDF. | Prévia preservada; o PDF abre com os dados da matrícula. |
| CT-35 (N) | SEC | Matrícula de regime por hora sem modelo para HORA_PARTICULAR. | Pendência; nenhuma prévia é gerada. |
| CT-36 | SEC | Conferir os participantes (aluno maior) e preservar o original. | O original aparece; o PDF abre. |
| CT-37 (N) | SEC | Aluno menor sem representante identificado. | A conferência de participantes bloqueia. |
| CT-38 (N) | SEC | Taxa ainda não paga (oferta com taxa prévia): registrar a conferência para assinatura. | Erro "Esta oferta exige taxa integralmente recebida e confirmada…". |
| CT-39 | SEC | Com a taxa paga, registrar a conferência para assinatura. | Registrada; aviso de envio indisponível; sem botão de envio (achado 1). |
| CT-40 (N) | SEC | Trocar o `[id]` da URL do PDF do original pelo de outra matrícula. | 404 ou erro; nenhum PDF de outra matrícula. |
| CT-41 (N) | VEND | Abrir `/matriculas/[id]/contrato`. | Acesso negado. |
| CT-42 (N) | SEC | Na preparação, clicar em "Concluir matrícula" em `/secretaria`. | Erro "O contrato precisa estar aceito e confirmado pela secretaria antes da ativação". O painel não oferece anexar e confirmar o contrato manualmente. |
| CT-43 **[DEV]** | SEC | Depois que o dev registrar uma conclusão de assinatura em PRODUCAO (fixture), confirmar o aceite e concluir. | Matrícula Ativa, reserva Utilizada, aluno na turma, comissão Aprovada, lead Matriculado. |
| CT-44 **[PO]** | VEND | Em `/matriculas/nova`, sem turma, criar a matrícula de um aluno novo. | Aguardando; a taxa e a 1ª mensalidade já aparecem; comissão Pendente. |
| CT-45 (N) **[PO]** | SEC | Abrir `/matriculas/nova`. | A tela abre, mas sem "Salvar matrícula" (achado 7). |
| CT-46 **[PO]** | VEND | Em `/matriculas/nova`, cadastrar uma pessoa que já é aluna. | Hoje: cria um segundo cadastro (achado 6). |
| CT-47 | SEC, FIN, SEC | Legado: a SEC assume, anexa o CONTRATO e confirma o contrato; o FIN registra a taxa; a SEC conclui. | Matrícula Ativa; mensalidades 2..N geradas. |
| CT-48 | SEC | Em `/secretaria/reservas`, clicar em "Conferir" numa reserva de turma vencida com taxa paga. | Reserva "mantida por pendência". |
| CT-49 **[PO]** (N) | SEC | Clicar em "Conferir" numa reserva de turma vencida sem pagamento. | Hoje: continua Ativa, com aviso de assinatura externa; a vaga não é liberada (achado 4). |
| CT-50 | SEC, depois ADM | Em `/secretaria/reservas/[id]`, a SEC propõe prorrogar a reserva mantida; o ADM aprova. | Reserva Ativa com novo prazo; histórico preservado. |
| CT-51 (N) | SEC | Tentar decidir a própria proposta de prorrogação. | Recusado (só ADM e outra pessoa). |
| CT-52 **[DEV]** | SEC | Particular com reserva vencida pelo cron (o cron precisa estar rodando): abrir `/matriculas/[id]/nova-reserva`, revisar e confirmar. | Nova reserva encadeada à anterior; a mesma matrícula. |
| CT-53 | SEC | Desistência simples: numa preparação sem cobrança, registrar o pedido em `/matriculas/[id]/desistencia` (motivo) e efetivar. | Matrícula Cancelada; reserva Liberada; a vaga volta para a turma. |
| CT-54 | SEC | Repetir a efetivação ou recarregar. | Sem segunda efetivação; a tela mostra a aplicação existente. |
| CT-55 | FIN, depois ADM, depois SEC | Desistência com taxa emitida e não paga: o FIN propõe o cancelamento em `/matriculas/[id]/desistencia/financeiro`; o ADM aprova; a SEC efetiva. | Cobranças Canceladas (valores preservados); matrícula Cancelada. |
| CT-56 (N) | FIN | Aprovar a própria proposta financeira. | Recusado (outra pessoa). |
| CT-57 | SEC, depois ADM | Desistência com taxa paga: a SEC registra o pedido; ele aparece em `/secretaria/desistencias`; o ADM decide em `/desistencia/administracao`. | Pedido na fila; a SEC vê, mas não decide; a decisão do ADM fica registrada. A efetivação ainda exige o acerto Q165 do Financeiro. **[PO]** confirmar a regra contratual estruturada. |
| CT-58 (N) | SEC | Depois do pedido registrado, o FIN lança um novo pagamento; a SEC tenta efetivar. | Bloqueado: fontes alteradas; pede novo pedido. |
| CT-59 (N) | FIN puro | Abrir `/secretaria/desistencias`; depois, abrir `/financeiro/desistencias`. | O primeiro dá acesso negado; o segundo lista a fila. |
| CT-60 (N) | PROF | Abrir `/matriculas/[id]` de qualquer matrícula. | Acesso negado. |
