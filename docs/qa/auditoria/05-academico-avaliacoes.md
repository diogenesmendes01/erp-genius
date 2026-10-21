# Auditoria 05: Acadêmico e avaliações

> Repositório `erp-genius`, branch `qa/auditoria-e-onboarding` (commit `9e3d1d3c` = `main` + kit de QA). Somente leitura: nenhum código alterado, nenhum teste executado. "Atendido" significa que encontrei código **e** caminho de tela (ou teste de integração) que cumprem o critério, não que rodei o sistema.
>
> Precedência: (1) SPECs com critérios numerados em `docs/specs/`; (2) doc 37; (3) doc 41 e `docs/planejamento/quadro-entregas.md`; (4) docs 06, 07, 40. Regra: especificação não comprova implementação.
>
> Abreviações de caminho: `av/` = `src/server/avaliacoes/` · `ac/` = `src/server/academico/` · `ag/` = `src/server/agenda/` · `tela/` = `src/app/(app)/academico/` · `mig/` = `prisma/migrations/` · `schema` = `prisma/schema.prisma` · `LT` = `av/lancamentos.int.test.ts` · `SCT` = `av/segunda-chamada.int.test.ts`.
>
> Papéis: **PROF** Professor · **GP** Gerente Pedagógico · **SEC** Secretaria Acadêmica · **FIN** Financeiro · **ADM** Administrador. O ADM passa em qualquer guard de papel (`src/server/_shared/sessao.ts:120-123`), mas várias transações reconferem o papel no banco: `av/regras-tx.ts:8-12` aceita GP **ou** ADM; `ac/estado.ts:25-31` não libera o ADM; o lançamento de nota exige papel PROF gravado (`av/lancamento-tx.ts:69`).

## Resumo

### Contagens por status

| Grupo | Itens | Atendido | Parcial | Não atendido | Divergente / doc desatualizado | Decisão do PO |
|---|---|---|---|---|---|---|
| ACA-01 a ACA-34 (`avaliacao-por-habilidades.md` §4) | 34 | 28 | 6 | 0 | — | (ACA-22 pede confirmação) |
| Incrementos 363–366 e 559–561 da mesma SPEC | 7 | 7 | 0 | 0 | — | — |
| Agenda inicial de segunda chamada (SPEC-ACA-AGI-01) | 21 | 18 | 3 | 0 | — | — |
| Remarcação de segunda chamada (SPEC-ACA-REM-01) | 15 | 14 | 1 | 0 | — | — |
| Substituição de segunda chamada (SPEC-ACA-SUB-01) | 10 | 9 | 1 | 0 | — | — |
| Recuperação com autorização especial (Q151) | 11 | 6 | 4 | 0 | — | 1 (Q163) |
| Fechamento e aproveitamento (Q153/Q154 + verificação) | 21 | 19 | 1 | 1 | — | — |
| Doc 40 — mudanças acadêmicas | 9 | 6 | 0 | 0 | 3 | — |
| Progressão Q124–Q154 | 31 | 29 | 2 | 0 | — | — |
| **Total** | **159** | **136** | **18** | **1** | **3** | **1** |

Além dos critérios, a tabela de achados tem 24 itens: 4 bloqueiam ou travam o UAT, 6 precisam de decisão do PO e 6 são docs desatualizados.

### Os 5 achados mais importantes

1. **Segunda chamada sem porta de entrada.** Propor, decidir, disponibilizar e registrar falta acontecem em `/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]`, mas nenhuma tela leva até lá (a tela do vínculo só lista as pendências, `tela/avaliacoes/[alocacaoId]/page.tsx:60-62`). Só se chega digitando a URL. A prorrogação (Q149) e a oportunidade extra (Q150) da segunda chamada existem só no servidor (`av/segunda-chamada-prorrogacao.ts`, `av/segunda-chamada-extra.ts`); nenhuma página as importa.
2. **Recuperação sem falta nem cancelamento pelo aluno** (Q137 / ACA-17). Só existe cancelamento pela escola (`av/recuperacao-cancelamento.ts:11-14`). O campo `recuperacao.antecedenciaCancelamentoMinutos` é configurado na regra e nunca é lido (`av/regra-schema.ts:26`). Quando o prazo vence sem realização, o plano fica aberto e bloqueia o fechamento (`av/pendencias-resultado-tx.ts:20-42`; a própria tela avisa que "o vencimento de um prazo não conclui uma tentativa"). Não há saída pela interface.
3. **O UAT não tem uma segunda pessoa de gestão pedagógica.** Quase toda decisão exige "outra pessoa da GP/ADM": regra, oficialização, correção, planos, agendas, cancelamentos, equivalência e mudança de nível. O seed tem um único GP (`prisma/seed-qa.ts:43-44`), então o segundo decisor acaba sendo o ADM, que passa em todos os guards e mascara erros de papel. Há também três pré-condições escondidas:
   - o lançamento exige o fuso da escola configurado (`tela/avaliacoes/[alocacaoId]/[codigo]/page.tsx:33-34`);
   - a regra só se liga sozinha a turmas criadas **depois** da publicação e com início futuro (`mig/20260913040000_regra_inicial_turma/migration.sql:14-18`);
   - o fechamento exige frequência apurada, com ao menos uma aula concluída e com chamada (`av/frequencia.ts:67`).
4. **O aluno não é informado de nada além da nota oficial e do fechamento.** O portal mostra só notas oficializadas, o consolidado parcial e o selo do fechamento (`src/server/portal-aluno/resultados.ts:98,192`; `src/server/portal-aluno/fechamentos.ts:189-201`). Plano de recuperação, prazos e agendas de segunda chamada ou recuperação não aparecem; "informar o aluno" (ACA-16, ACA-29) é só um campo de texto de evidência (`schema:6751-6763`). A nota aparece no portal no instante da oficialização, sem etapa de divulgação: ACA-22 diz "não presumir divulgação", então o PO precisa confirmar. Vínculos encerrados continuam aparecendo (`resultados.ts:228`).
5. **A documentação está atrasada em relação ao código, e o QA vai abrir bugs falsos se seguir os docs.**
   - Doc 40 (linhas 5 e 38): diz que a transferência equivalente é "direta". Hoje `trocarTurma` sempre recusa (`src/server/alunos/acoes.ts:267-273`) e a transferência passa por proposta, decisão e execução.
   - Doc 40 (linha 27): diz "uma aberta por aluno". O limite real é por matrícula (`mig/20260914143000_solicitacao_academica_por_contrato/migration.sql:8-12`).
   - Doc 40 não menciona que aprovar e executar exigem fechamento suficiente (`ac/acoes.ts:151,186`).
   - A spec de fechamento (linha 5), o topo de `avaliacao-por-habilidades.md` ("até 414") e os planos 358, 413, Q54 e 565 dão como pendentes coisas já implementadas.

## Fluxo ponta a ponta como está no código

| # | Passo | Tela/rota | Papel | Pré-condição | Efeito | Arquivo:linha |
|---|---|---|---|---|---|---|
| 0 | Configurar fuso da escola | `/configuracao/operacao` | ADM | — | Sem fuso, a tela de lançamento mostra só o aviso "Configurar o fuso da escola" | `src/components/AvisoFusoNaoConfigurado.tsx:8`; `tela/avaliacoes/[alocacaoId]/[codigo]/page.tsx:17-20,33-34` |
| 1 | Preparar calendário escolar (FERIADO, RECESSO, FERIAS) | `/academico/calendario/novo` | SEC ou GP | Fuso institucional | Versão proposta; ainda sem efeito | `ag/calendario.ts:13,19,29-31` |
| 2 | Decidir calendário | `/academico/calendario/[id]` | GP/ADM, diferente de quem preparou | Nenhuma versão mais nova; sem encontros PREVISTO afetados (senão, replanejamento conjunto) | Versão vigente. FERIADO passa a contar no SLA da 1ª resposta | `ag/calendario-decisao.ts:10,15,18,24,27,30`; `src/server/crm-config/feriados-escola.ts:15-17` |
| 3 | Preparar regra de avaliação (escala, avaliações, pesos, mínimos, limites, prazos) | `/academico/regras/[nivelId]` | GP | Nível existente | Versão proposta, imutável | `av/regras.ts:12`; `av/regras-tx.ts:11`; `av/regra-schema.ts:12-46` |
| 4 | Publicar ou rejeitar regra | mesma tela | GP/ADM, diferente do preparador | Só a versão mais recente | Passa a ser a regra vigente do nível | `av/regras.ts:19`; `av/regras-tx.ts:42,49-51`; `mig/20260913030000_regras_avaliacao/migration.sql:59,66` |
| 5 | Criar turma | `/configuracao/turmas` | GP | Regra publicada **antes**; turma PLANEJADA/ABERTA com início futuro | Trigger liga a última regra publicada; o painel mostra "Avaliações: versão N" | `src/server/turmas/acoes.ts:66`; `mig/20260913040000_regra_inicial_turma/migration.sql:14-18`; `src/app/(app)/configuracao/turmas/TurmasPainel.tsx:175` |
| 5b | Migrar a turma para a regra nova | `/academico/regras/turmas/[turmaId]` | GP propõe; outra GP/ADM decide | Turma não iniciada, sem registro de avaliação, com agenda ou início futuro | Turma passa à última versão publicada | `av/migracao-regra.ts:24,30`; `av/migracao-regra-tx.ts:32,40-41,45,89` |
| 6 | Grade inicial | `/academico/grades/nova` → `/academico/grades/[id]` | SEC/GP preparam; GP/ADM diferente decide | Turma PLANEJADA sem diário; calendário aprovado; modalidade com quantidade e duração | Cria encontros PREVISTO, pulando períodos não letivos | `ag/grade-proposta.ts:12-14`; `ag/grade-turma-tx.ts:9-17`; `ag/grade-decisao.ts:13,21,37-46`; `ag/grade.ts:51` |
| 7 | Janela de admissão | `/academico/admissoes/[id]` | SEC/GP preparam; GP diferente decide | Turma existente | Define o limite de entrada; reserva nova é barrada com JANELA_ENCERRADA | `src/server/matricula/janela-admissao.ts:20,48,55`; `src/server/matricula/admissao-turma.ts:26-27` |
| 8 | Matrícula ativa e alocação | (área 04) | — | Turma ABERTA (ver bloqueador B1 da auditoria consolidada) | Vínculo `AlocacaoTurma` | — |
| 9 | Lançar notas (rascunho ou submissão) | `/academico/avaliacoes/[alocacaoId]/[codigo]` | PROF titular vigente ou designado | Fuso; regra na turma; data não futura e dentro do vínculo; matrícula ATIVA na data; notas na escala; submissão exige todas as notas | Nova `VersaoLancamentoAvaliacao`; evento `AvaliacaoSubmetida` ou `AvaliacaoRascunhoRegistrado` | `av/lancamentos.ts:23,30`; `av/lancamento-tx.ts:69,80-89,94,104` |
| 10 | Oficializar ou devolver (conferência) | mesma tela | GP/ADM, diferente do autor e do realizador | Versão submetida e mais recente, sem oficial anterior, notas completas | `DecisaoLancamentoAvaliacao`; evento `AvaliacaoOficializada` ou `AvaliacaoDevolvida` | `av/lancamentos.ts:41`; `av/lancamento-tx.ts:111,118-126` |
| 11 | Consultar consolidado | `/academico/avaliacoes/[alocacaoId]` | PROF ou GP | — | Média por habilidade, média geral, mínimos, pendências, frequência | `av/consolidado.ts:12-29`; `av/calculo.ts:102-139`; `tela/avaliacoes/[alocacaoId]/page.tsx:35-99` |
| 12 | Aluno vê o resultado | `/portal-aluno/resultados` | Aluno (sessão do portal) | Nota oficializada | Nota e comentário ao aluno; consolidado marcado como parcial | `src/server/portal-aluno/resultados.ts:63-68,98,192,225-228`; `src/app/portal-aluno/resultados/page.tsx:81-93,118-121` |
| 13 | Correção de nota oficial: propor | `/academico/correcoes/[lancamentoId]` (link "Propor correção" na nota oficial) | PROF com atribuição vigente, ou GP | Nota oficial | Proposta; a nota oficial continua valendo até a decisão | `av/correcao.ts:13`; `av/correcao-tx.ts:25,32` |
| 14 | Correção de nota oficial: decidir | `/academico/correcoes/[lancamentoId]/[propostaId]` | GP/ADM, diferente do proponente | Impactos conferidos (hash) | Nova nota vigente; abre caso de revisão se já houve progressão | `av/correcao.ts:33`; `av/correcao-decisao-tx.ts:30,36,38`; `av/nota-vigente.ts:3` |
| 15 | Segunda chamada: propor | `/academico/segundas-chamadas/[alocacaoId]/[codigo]` (**só por URL**) | PROF ou GP | Matrícula ATIVA; avaliação pendente; saldo > 0 | Proposta | `av/segunda-chamada.ts:19-23,28`; `av/segunda-chamada-tx.ts:20-33` |
| 16 | Segunda chamada: decidir e disponibilizar | mesma tela | GP diferente do autor decide; GP disponibiliza | Proposta aprovada | Prazo = disponibilização + minutos da regra (corridos) | `av/segunda-chamada.ts:45,53`; `av/segunda-chamada-disponibilizacao.ts:17,29,37-38` |
| 17 | Agenda inicial da segunda chamada | `/academico/segundas-chamadas/pendentes-agenda` → `/propostas/[propostaId]/agenda` | SEC/GP/ADM preparam; GP/ADM diferente decide | Disponibilizada; fim dentro do prazo; dia não letivo com justificativa | Trigger cria encontro PREVISTO e reserva RESERVADA | `av/segunda-chamada-agenda-inicial.ts:80-81,123-126,160-161,217,262,304`; `mig/20260915125000_agenda_inicial_segunda_chamada/migration.sql:61-129` |
| 18 | Realizar a segunda chamada | `/academico/segundas-chamadas/minhas/[reservaId]` | PROF do encontro | Encontro PREVISTO; instante em [início, fim) | Reserva CONSUMIDA_REALIZACAO; a nota vai para a avaliação original como submetida (segue no passo 10) | `av/segunda-chamada-realizacao.ts:20,30,37,44,53`; `av/lancamento-tx.ts:47-62` |
| 19 | Plano de recuperação: propor | `/academico/recuperacoes/planos?alocacaoId=` | PROF titular ou GP | Insuficiência comprovada; matrícula ATIVA | Plano com as habilidades abaixo do mínimo | `av/recuperacao-proposta.ts:23,42-47` |
| 20 | Plano: decidir, disponibilizar, reservar | mesma tela → `/planos/[propostaId]` | GP diferente do preparador decide; GP disponibiliza e reserva | Limite por habilidade | Prazo começa na disponibilização; reserva por habilidade | `av/recuperacao-decisao.ts:20,26`; `av/recuperacao-disponibilizacao.ts:19,29-40`; `av/recuperacao-reserva-tx.ts:31-32,53-55` |
| 21 | Recuperação: realizar e lançar nota | `/planos/[propostaId]` ou `/recuperacoes/tentativas/[id]` → `/recuperacoes/[realizacaoId]` | PROF realiza e lança; GP diferente do autor e do realizador oficializa | Dentro do prazo vigente | Consolidado fica com a maior nota | `av/recuperacao-realizacao.ts:19,28,42`; `av/recuperacao-nota.ts:27,57,64`; `av/calculo.ts:88-136` |
| 22 | Exceção de frequência | `/academico/avaliacoes/[alocacaoId]/fechamento` | GP propõe; outra GP/ADM decide | Frequência abaixo do mínimo | Supre só a frequência; o percentual real continua visível | `av/excecao-frequencia.ts:19,31,47,55,63-68`; `av/fechamento-elegibilidade.ts:114-121` |
| 23 | Confirmar fechamento | mesma tela | GP (uma pessoa basta) | Sem pendência de nota, frequência, correção, plano, tentativa ou segunda chamada; hash e versão atuais | `FechamentoAcademico` v+1 (suficiente ou insuficiente); evento `ResultadoAcademicoFechado`; selo no portal | `av/fechamento.ts:33,45-57`; `av/fechamento-elegibilidade.ts:98-136` |
| 24 | Mudança de nível: solicitar | `/alunos/[id]/academico` | SEC, GP ou ADM | Nenhum pedido PENDENTE ou APROVADO na matrícula | Pedido PENDENTE; aluno continua na turma | `ac/acoes.ts:59,64,75-101`; `ac/estado.ts:6` |
| 25 | Mudança de nível: parecer | `/academico` | PROF atual da turma de origem | Pedido PENDENTE | Parecer registrado; status não muda | `ac/acoes.ts:116-126` |
| 26 | Mudança de nível: aprovar ou rejeitar | `/academico` | GP/ADM, diferente do solicitante | Parecer ou dispensa justificada; **fechamento suficiente e atual** | APROVADA (sem mexer na turma) ou REJEITADA | `ac/acoes.ts:136-160`; `ac/regras.ts:160-162`; `av/progressao-fechamento-tx.ts:22-28` |
| 27 | Mudança de nível: executar | `/academico` | SEC ou ADM | Aprovada; sem caso de revisão pendente; fechamento não superado | Encerra a alocação de origem, cria a de destino, grava `MovimentacaoAluno` TROCA_TURMA → EXECUTADA | `ac/acoes.ts:169-204`; `mig/20260915043000_bloqueio_execucao_revisao_progressao/migration.sql:3-29` |
| 28 | Transferência equivalente (mesmo nível) | `/academico/avaliacoes/[alocacaoId]/equivalencia` → `/academico/equivalencias/[propostaId]` | GP prepara; GP diferente decide; SEC/ADM executa | Sem mudança de nível aberta; estado igual ao da proposta | Origem encerrada, destino criado, notas aproveitadas (sem copiar lançamentos) | `av/equivalencia-proposta.ts:48`; `av/equivalencia-decisao.ts:67,72`; `av/equivalencia-execucao.ts:59,93,142-162` |
| 29 | Revisão da progressão após correção | `/academico/correcoes` → `/academico/correcoes/revisoes/[casoId]` | GP propõe; outra GP/ADM decide | Caso aberto por correção, recuperação ou reposição | Reconfirma, registra cancelamento ou encaminha regularização; não desfaz a alocação | `av/resolucao-revisao-progressao.ts:55-88`; `av/resolucao-revisao-progressao-tx.ts:39-43,54-59,96` |

## Máquinas de estado

Só três coisas têm enum: a reserva de segunda chamada, a mudança acadêmica e o encontro de agenda. Os demais estados são deduzidos de registros imutáveis: proposta → linha de decisão com `aprovada: Boolean` → aplicação.

### Regra de avaliação
`VersaoRegraAvaliacao` (`schema:4202`) + `DecisaoRegraAvaliacao.aprovada` (`schema:5316`). Proposta (sem decisão) → Publicada (true) ou Rejeitada (false). Vale a maior versão publicada. Nada é editável (`mig/20260913030000_regras_avaliacao/migration.sql:59`).

### Avaliação e nota (lançamento)
Tabelas: `RegistroAvaliacaoMatricula` (`schema:4236`, um por matrícula + turma + código), `VersaoLancamentoAvaliacao.submetida` (`schema:4979`) e `DecisaoLancamentoAvaliacao.aprovada` (`schema:5006`).
- **Sem lançamento**: pendência NOTA_AUSENTE (`av/calculo.ts:107`). Nunca vira zero.
- **Rascunho** (submetida = false) → **Submetida** (AGUARDANDO_OFICIALIZACAO) → **Oficial** (evento `AvaliacaoOficializada`) ou **Devolvida** (`AvaliacaoDevolvida`; o professor grava nova versão).
- Nota oficial bloqueia novo lançamento: "Nota oficial exige o fluxo de correção" (`av/lancamento-tx.ts:94`).
- Rascunho não pode ser oficializado (`:118`).

### Correção de nota
`PropostaCorrecaoNota` (`schema:5017`) → `DecisaoCorrecaoNota` (`schema:5035`): Aplicada (vira a nota vigente, `av/nota-vigente.ts:3`) ou Rejeitada.
- Quando já houve progressão, a aprovação abre um `CasoRevisaoProgressao` (`schema:5050`; `av/correcao-decisao-tx.ts:38`).
- O caso tem resolução própria (enum `AcaoResolucaoRevisaoProgressao`, `schema:54-58`) e bloqueia a execução de mudanças acadêmicas (`ac/acoes.ts:176-179`).
- A correção de nota de recuperação é paralela (`av/recuperacao-correcao.ts:68,116,121`).

### Segunda chamada
Antes da reserva não há enum. A sequência é:
1. Proposta (`av/segunda-chamada.ts:26-40`).
2. Decisão (`:43-64`).
3. Disponibilização, que fixa o prazo (`av/segunda-chamada-disponibilizacao.ts:15-44`).
4. Proposta de agenda inicial.
5. Decisão da agenda.

Correm em paralelo: designação (Q152), autorização especial (Q151), prorrogação (Q149, sem tela) e extra (Q150, sem tela).

Reserva: `StatusReservaSegundaChamada` (`schema:6699-6707`).

| De → Para | Disparo | Encontro | Quem |
|---|---|---|---|
| — → RESERVADA | Decisão de agenda aprovada (trigger `mig/20260915125000_agenda_inicial_segunda_chamada/migration.sql:121-126`) | cria PREVISTO | GP/ADM, decisor independente |
| RESERVADA → CONSUMIDA_REALIZACAO | `av/segunda-chamada-realizacao.ts:44` | → MINISTRADO | PROF do encontro |
| RESERVADA → CONSUMIDA_FALTA | `av/segunda-chamada-ocorrencia-tx.ts:30,40` (só após o início) | → NAO_REALIZADO | GP |
| RESERVADA → PENDENCIA_ESCOLA | idem (IMPEDIMENTO_ESCOLA) | → IMPEDIDO_ESCOLA | GP; resolução Q164 em `av/segunda-chamada-resolucao-impedimento-tx.ts:23-53` |
| RESERVADA → LIBERADA_CANCELAMENTO_ESCOLA / LIBERADA_CANCELAMENTO_TEMPESTIVO / CONSUMIDA_CANCELAMENTO_TARDIO | Decisão de cancelamento (`mig/20260915116000_cancelamento_aluno_agenda_segunda_chamada/migration.sql:117-126`) | → CANCELADO | GP/ADM propõe; outro GP/ADM decide. **SEC não cancela** |
| RESERVADA (mantida) por remarcação | `mig/20260915121000_remarcacao_agenda_segunda_chamada/migration.sql:320-325` | antigo → CANCELADO; novo PREVISTO | SEC/GP/ADM propõe; GP/ADM diferente decide |
| RESERVADA (mantida) por substituição | `mig/20260915127000_substituicao_docente_agenda_segunda_chamada/migration.sql:186-188` | troca o professor | SEC/GP/ADM propõe; GP/ADM diferente decide |

Ocupam saldo: RESERVADA e as três CONSUMIDA_*. Saldo = limite + extras aprovadas − ocupadas (`av/segunda-chamada-tx.ts:26-33`). Estados terminais são imutáveis (`av/segunda-chamada-ocorrencia-tx.ts:31-38`).

### Recuperação (sem enum)

| Etapa | Persistência | Quem |
|---|---|---|
| (opcional) autorização de preparação após pausa/encerramento | `schema:4419` | GP (`av/recuperacao-autorizacao-preparacao.ts:15,27`) |
| PROPOSTO | `PropostaPlanoRecuperacao` `schema:4253` | PROF titular ou GP (`av/recuperacao-proposta.ts:23`) |
| APROVADO / REJEITADO | `DecisaoPlanoRecuperacao` `schema:4951` | GP diferente do preparador (`av/recuperacao-decisao.ts:20,26`; `mig/20260913150000_decisao_plano_recuperacao/migration.sql:28`) |
| DISPONIBILIZADO (início do prazo) | `schema:4282` | GP (`av/recuperacao-disponibilizacao.ts:19`) |
| Prorrogação proposta → decidida | `schema:4299,4317` | PROF/GP propõe; GP diferente decide; só com matrícula ATIVA (`av/recuperacao-prorrogacao.ts:18,31,45,52,59`) |
| RESERVADO (por habilidade) | `ReservaTentativaRecuperacao` `schema:4328` | GP (`av/recuperacao-reserva.ts:10`) |
| Agenda proposta → decidida (cria encontro) | `schema:4456,4508` | GP; decisor diferente (`av/recuperacao-agenda-proposta.ts:23`; `av/recuperacao-agenda-decisao.ts:16,23`) |
| Cancelamento pela escola | `schema:4346` | GP; bloqueado se houver encontro PREVISTO (`av/recuperacao-cancelamento.ts:14,25`) |
| REALIZADO (consome) | `RealizacaoRecuperacao` `schema:4539` | PROF titular ou designado (`av/recuperacao-realizacao.ts:19,28,42`) |
| Nota submetida → oficial | `schema:4556,4940` | PROF lança; GP diferente do autor e do realizador oficializa (`av/recuperacao-nota.ts:27,57,64`) |
| **Falta / cancelamento pelo aluno (no prazo ou tardio)** | — | **não existe** |

### Mudança acadêmica (mudança de nível)
`StatusMudancaAcademica` (`schema:44-50`).
- **PENDENTE** (o parecer não muda o status) → **APROVADA** ou **REJEITADA** (`ac/acoes.ts:143-160`).
- **APROVADA** → **EXECUTADA** (`:175-204`).
- **PENDENTE** ou **APROVADA** → **CANCELADA**: qualquer SEC/GP/ADM, com motivo (`:219-222`).
- Pedido APROVADO não pode ser rejeitado, só cancelado (`:145`).
- Eventos: `MudancaAcademicaSolicitada`, `ParecerMudancaAcademicaRegistrado`, `MudancaAcademicaDecidida`, `MudancaAcademicaExecutada`, `TrocaTurma`, `MudancaAcademicaCancelada` (`:100,125,158,199,203,221`).
- **Nenhuma notificação**: a ação só chama `revalidatePath` (`:16-19`).

Pausa, retomada e encerramento contratuais pertencem à área de matrícula/financeiro: `StatusPropostaPausaMatriculas` `schema:1533-1538`, `StatusPropostaRetomadaMatriculas` `schema:1768-1773`, `StatusSolicitacaoEncerramento` `schema:1664-1669`. Já pausa e encerramento de aluno **sem contrato** são diretos, sem aprovação (`src/server/alunos/acoes.ts:187-221,231-265`).

### Equivalência (transferência)
Estado deduzido em `av/equivalencia-consulta.ts:25,49`: PENDENTE (`schema:5133`) → APROVADA ou REJEITADA (`schema:5164`) → APLICADA (`schema:5176`, `decisaoId @unique`).

### Fechamento
- A elegibilidade é uma função pura que devolve PENDENTE, SUFICIENTE ou INSUFICIENTE (`av/fechamento-elegibilidade.ts:74-136`).
- A confirmação grava `FechamentoAcademico` v+1 (`schema:5209`; `@@unique` matrícula + nível + versão em `schema:5234`). O registro é imutável: update e delete falham (`av/fechamento-academico.int.test.ts:165-166`).
- No portal: SEM_FECHAMENTO, CONFIRMADO_SUFICIENTE, CONFIRMADO_INSUFICIENTE ou EM_REVISAO, este último quando a fonte mudou depois da confirmação (`src/server/portal-aluno/fechamentos.ts:189-201`).

## Critérios ACA-01..34

Fonte: `docs/specs/avaliacao-por-habilidades.md:136-169`.

| Critério | Evidência arquivo:linha | Status |
|---|---|---|
| ACA-01 Dois contratos: resultado preso ao contrato certo, sem herdar nem expor o outro | Chave matrícula+turma+código `av/lancamento-tx.ts:43`; `av/consolidado-tx.ts:71,74`; portal `src/server/portal-aluno/resultados.ts:89,240-248`. Testes `LT:2795`; `src/server/portal-aluno/resultados.int.test.ts:108,225` | Atendido |
| ACA-02 Consolidado mostra habilidades, frequência e regra de origem | `av/consolidado.ts:12-29`; `tela/avaliacoes/[alocacaoId]/page.tsx:44,73-99`. Testes `LT:2685,827,858` | Atendido (a regra aparece só como "versão N") |
| ACA-03 Término de turma ou resultado favorável não muda nível, contrato nem cobrança | `src/server/turmas/acoes.ts:281-290` (só status e vínculo); `av/progressao-fechamento-tx.ts:22-24`; nenhuma escrita financeira em `av/fechamento.ts`. Teste `av/fechamento-academico.int.test.ts:152` | Atendido (por ausência de efeito; sem teste negativo explícito) |
| ACA-04 Regra incompleta gera pendência e bloqueia cálculo | `av/regra-schema.ts:12-46` (sem valores padrão); `av/lancamento-tx.ts:83`; portal PENDENTE_REGRA `resultados.ts:77-88`. Testes `av/regra-schema.test.ts:28`; `av/regras.int.test.ts:132` | Atendido |
| ACA-05 Nota válida, fora da escala ou ausente; comentário opcional | Escala `av/lancamento-tx.ts:88`; submissão exige notas `:89`; comentário `av/lancamento-schema.ts:5`. Testes `LT:2728,2248,2703` | Atendido |
| ACA-06 Percurso com final sem resultado: sem zero, sem final inventada | `av/consolidado-tx.ts:89-107`; `av/calculo.ts:108-109,130`. Testes `LT:2685`; `av/calculo.test.ts:31` | Atendido |
| ACA-07 Intermediária só de fala; final distribuída cobre as 4 habilidades | `av/regra-schema.ts:24,44-45`; `av/lancamento-tx.ts:86`; `tela/regras/[nivelId]/Formularios.tsx:53,62`. Teste `av/calculo.test.ts:60` | Atendido |
| ACA-08 Média por habilidade = Σ(nota×peso)/Σpesos, sem agrupar por etapa | `av/calculo.ts:45-49,63,69-88,102-109`. Testes `av/calculo.test.ts:21,31,49,66` | Atendido |
| ACA-09 Média geral com pesos das habilidades; frequência não entra como nota | `av/calculo.ts:105,130-131`. Testes `av/calculo.test.ts:21,31` | Atendido |
| ACA-10 Mínimos simultâneos; igualdade atinge; sem compensação | `av/calculo.ts:128,132` (`>=`), `:139`. Testes `av/calculo.test.ts:42,49,119` | Atendido (sem teste nomeado de igualdade) |
| ACA-11 Frequência baixa: exceção independente, sem autoaprovação | `av/excecao-frequencia.ts:19,31,47,55,63-68`; `mig/20260915020000_excecao_frequencia/migration.sql:115-116,146`. Testes `av/excecao-frequencia.int.test.ts:163,189,230` | Atendido |
| ACA-12 Plano cobre as habilidades insuficientes, ou as escolhidas quando só a média falta | `av/recuperacao-proposta.ts:23,43-47`. Testes `LT:2022,2041,2048` | Atendido |
| ACA-13 Recuperação maior atualiza; menor ou igual fica só no histórico | `av/calculo.ts:88-136`. Testes `av/calculo.test.ts:91,119`; `LT:1683,1378` | Atendido |
| ACA-14 Limite por habilidade; esgotar fala não esgota escrita | `mig/20260913160000_reserva_tentativa_recuperacao/migration.sql:53,56`; `av/recuperacao-reserva-tx.ts:53-55`. Testes `LT:1958,1626` | Atendido |
| ACA-15 Plano com aprovador distinto; mudança relevante pede nova aprovação | `av/recuperacao-decisao.ts:20,26,37`; `mig/20260913150000_decisao_plano_recuperacao/migration.sql:28-33`. Testes `LT:1984,2002` | Atendido |
| ACA-16 Prazo começa na disponibilização; prorrogação independente; **aluno informado** | `av/recuperacao-disponibilizacao.ts:17-40`; `av/recuperacao-prorrogacao.ts:16-18,52`. Testes `LT:1884,1819,1862`. Aluno: só o texto `evidenciaComunicacao`, nada no portal | Parcial |
| ACA-17 Reserva, consumo e liberação: realizar, **faltar**, cancelar no prazo e tarde | Realizar `av/recuperacao-realizacao.ts:17-19`; cancelamento só pela escola `av/recuperacao-cancelamento.ts:11-14`. Falta e cancelamento pelo aluno: não encontrado. `antecedenciaCancelamentoMinutos` nunca é lido (`av/regra-schema.ts:26`) | Parcial |
| ACA-18 Progressão bloqueada por nota insuficiente, sem dispensa | `av/progressao-fechamento-tx.ts:22-28`, chamado em `ac/acoes.ts:151,186-188`; exceção não supre nota (`av/fechamento-elegibilidade.ts:123-128`). Testes `src/server/academico/progressao-fechamento.int.test.ts:213,226,259,278` | Atendido |
| ACA-19 Avaliação externa registrada; portal sem prova nem entrega | Registro pelo lançamento comum (`av/lancamento-tx.ts:38`), sem campo "origem externa"; portal de resultados só leitura. Teste `src/server/portal-aluno/resultados.int.test.ts:89` | Atendido |
| ACA-20 **Professor sugere regra**; gestão prepara; outra pessoa publica | Preparar e publicar: `av/regras.ts:12,19`; `av/regras-tx.ts:42`. Testes `av/regras.int.test.ts:29,46,54,86,99`. Sugestão do professor: não encontrado (`/academico/regras` exige GP, `tela/regras/page.tsx:10`) | Parcial |
| ACA-21 Publicar regra com turmas novas, não iniciadas, em andamento e concluídas | Trigger `mig/20260913040000_regra_inicial_turma/migration.sql:14-22`; `av/migracao-regra-tx.ts:32,40-45,89`; tela `tela/regras/turmas/[turmaId]/Formularios.tsx:21,38`. Testes `av/regra-turma.int.test.ts:37-123`; `av/migracao-regra.int.test.ts:38-161` | Atendido |
| ACA-22 Professor submete; não oficializa sozinho; gestão confere; não presumir divulgação | `av/lancamentos.ts:23,41`; `av/lancamento-tx.ts:69,111,118-123`; `mig/20260913060000_lancamento_avaliacao/migration.sql:106,108`. Testes `LT:2703,2721,2756,2777,2788`. A oficialização já publica no portal (`resultados.ts:98`) | Atendido (PO confirma se oficializar = divulgar) |
| ACA-23 Aluno vê só o que é seu: oficial, parcial ou final, sem rascunho nem dados alheios | `src/server/portal-aluno/resultados.ts:89,98,112,119,192,228`; `src/server/portal-aluno/fechamentos.ts:196-201`. Testes `resultados.int.test.ts:89,108,225`; `fechamentos.int.test.ts:257,290,338`; `src/app/portal-aluno/resultados/page.test.ts:83` | Atendido |
| ACA-24 Correção de nota oficial, inclusive para menor e depois da progressão | `av/correcao.ts:13,33`; `av/correcao-tx.ts:25,32`; `av/correcao-decisao-tx.ts:30,36,38`; `ac/acoes.ts:176-179`. Testes `LT:2555,2589,2610,2625`; `progressao-fechamento.int.test.ts:278` | Atendido |
| ACA-25 Responsável financeiro pede consulta acadêmica ou conta no portal | `src/server/comunicacoes-agenda/autorizacoes.ts:10,28,62` (SEC/ADM autorizam); `src/server/whatsapp/operacoes-atendimento.ts:57,78`; portal preso ao aluno (`schema:6378-6380`). Teste `src/server/whatsapp/atendimento-pedagogico-autorizacao.int.test.ts:69-197` | Atendido |
| ACA-26 Aluno falta; escola não oferece; segunda chamada realizada | Servidor completo: `av/segunda-chamada.ts:28,45,53`; `av/segunda-chamada-ocorrencia-tx.ts:30`; `av/segunda-chamada-realizacao.ts:53`. Testes `SCT:82,95,399,977,1019,1157`. A tela de entrada não tem link (`tela/avaliacoes/[alocacaoId]/page.tsx:60-62` só lista) | Parcial |
| ACA-27 Limite por avaliação e por contrato | `av/segunda-chamada-tx.ts:20-31`; `mig/20260915005000_segunda_chamada/migration.sql:408,416`. Teste `SCT:108` | Atendido |
| ACA-28 Disputa pela última vaga; eventos repetidos | `mig/20260915005000_segunda_chamada/migration.sql:416`; `mig/20260915116000_cancelamento_aluno_agenda_segunda_chamada/migration.sql:117-119`. Testes `SCT:684,715,728,755,816,853,898,929,1042,1359` | Atendido |
| ACA-29 Segunda chamada: disponibilizar, prazo, vencimento, **prorrogação**, aluno informado | Disponibilização com tela: `av/segunda-chamada-disponibilizacao.ts:17`. Prorrogação sem tela: `av/segunda-chamada-prorrogacao.ts:19,41,58`. O aluno não é informado no portal | Parcial |
| ACA-30 Oportunidade extra; autoaprovação; reaplicação | Recuperação completa: `av/extra-recuperacao.ts:19-21,44,50`; tela `tela/avaliacoes/[alocacaoId]/extras`; testes `LT:631-752`. Segunda chamada: `av/segunda-chamada-extra.ts:18,35,44`, sem tela e com a decisão sem teste | Parcial |
| ACA-31 Contrato pausado com avaliação antiga e recuperação futura | `av/lancamento-tx.ts:54,67,82`; `av/segunda-chamada-autorizacao-especial.ts:17`; `av/recuperacao-autorizacao-especial.ts:15`; telas de autorização (ver mapa). Testes `SCT:329,511`; `LT:922-1244` | Atendido |
| ACA-32 Professor sai; gestão designa substituto | `av/designacao.ts:17,41,53,61`; `av/lancamento-tx.ts:44-45,69,78`; tela `[codigo]/designacao`. Testes `LT:2056-2236,2739` | Atendido |
| ACA-33 Transferência entre turmas com regras diferentes | `av/equivalencia-proposta.ts:28,48`; `av/equivalencia-decisao.ts:67,72`; `av/equivalencia-execucao.ts:59`. Testes `av/equivalencia-decisao.int.test.ts:109-139`; `av/equivalencia-execucao.int.test.ts:122,152`; `av/aproveitamento-aplicado.int.test.ts:384-691` | Atendido |
| ACA-34 Fechamento com pendências; fechamento insuficiente; versão nova | Pendência NOTAS_INCOMPLETAS `av/fechamento-elegibilidade.ts:98`; `podeFechar` `:132-134`; bloqueio `av/fechamento.ts:46`; versão `:50`; resultado `:54`. Testes `av/fechamento-academico.int.test.ts:124` (bloqueia com notas pendentes e nega o professor), `:140`, `:152`, `:171` | Atendido |

Os incrementos da mesma SPEC estão todos atendidos:

| Incremento | O que entrega | Evidência |
|---|---|---|
| 363 | Recuperação realizada sem nota bloqueia o fechamento | `av/consolidado-tx.ts:23-35`; `LT:1715,1734` |
| 364 | Pendências operacionais | `av/pendencias-resultado-tx.ts:11-43`; `LT:773-814` |
| 365 | Plano aprovado sem tentativa | `av/pendencias-resultado-tx.ts:35-42` |
| 366 | Extras de recuperação | ver ACA-30 |
| 559 | Professor designado regulariza nota de segunda chamada | `av/lancamento-tx.ts:63-66`; `SCT:564` |
| 560 | Designação expirada não restaura a anterior | `schema:7175-7196`; `SCT:612,1482` |
| 561 | Tela de designações | `tela/segundas-chamadas/propostas/[propostaId]/designacao/page.tsx:16`; `SCT:641,1501` |

## Critérios das demais specs acadêmicas

| Spec | Critério | Evidência | Status |
|---|---|---|---|
| AGI (`agenda-inicial-segunda-chamada.md`) | E1 Proposta só depois da disponibilização; preparar não gera efeitos | `av/segunda-chamada-agenda-inicial.ts:80-81,215-257`. Teste `av/segunda-chamada-agenda-inicial.int.test.ts:95` | Atendido |
| AGI | E2 Foto (snapshot) do contexto e do calendário | `av/segunda-chamada-agenda-inicial.ts:114-121,174-190,248-250` | Atendido |
| AGI | E3 Dia não letivo exige justificativa e autorização; calendário alterado pede nova proposta | `:123-126,323-344`; `mig/20260915125000_agenda_inicial_segunda_chamada/migration.sql:38,56`. Testes `:117,131` | Atendido |
| AGI | E4 SEC/GP preparam; outra pessoa (GP/ADM) aprova; autoaprovação recusada | `:45,62-66,217,262,304,336-341`. Testes `:179,194` | Atendido |
| AGI | E5 Aplicação atômica; reenvio idempotente | trigger `mig/20260915125000_agenda_inicial_segunda_chamada/migration.sql:61-129`; `:286-289,317-322` | Atendido |
| AGI | E6 Fluxo legado fora da interface | `mig/20260915125000_agenda_inicial_segunda_chamada/migration.sql:149-159`; teste `:386` | Atendido |
| AGI | Interface: "Preparar agenda inicial" depois da disponibilização | `tela/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx:149` | Atendido |
| AGI | Interface: professor pesquisável | `av/segunda-chamada-agenda-inicial.ts:393-396` (select com os 50 primeiros ativos, sem busca) | Parcial |
| AGI | Interface: prazo com fuso no formulário | `tela/segundas-chamadas/propostas/[propostaId]/agenda/Formulario.tsx:41` (só aparece depois da prévia) | Parcial |
| AGI | Instantes explícitos, sem conversão pelo navegador | `av/segunda-chamada-agenda-inicial-local.ts:27-34` | Atendido |
| AGI | Períodos não letivos com nome e data; controle explícito | `av/segunda-chamada-agenda-inicial.ts:128-137`; `Formulario.tsx:38` | Atendido |
| AGI | Botões seguem `podePropor` / `podeDecidir` | `:416,425-428` | Atendido |
| AGI | CA1 Nada acontece antes da aprovação | reserva só nasce no trigger (`migration.sql:123`) | Atendido |
| AGI | CA2 Quem prepara não aprova | `:304`; SQL `:54` | Atendido |
| AGI | CA3 Fim dentro do prazo; conferência cobre toda a duração | `:144,160-173`; `SCT:1524` | Atendido |
| AGI | CA4 Dia não letivo só com justificativa | ver E3 | Atendido |
| AGI | CA5 Mudança relevante impede a aprovação | `:339-344` | Atendido |
| AGI | CA6 Uma agenda por aprovação | SQL `:103`; `:286-289` | Atendido |
| AGI | CA7 Realização é fluxo docente separado | `av/segunda-chamada-realizacao.ts:18-76` | Atendido |
| AGI | Concorrência com pausa; rejeição de proposta obsoleta | `mig/20260915131000_locks_decisao_agenda_segunda_chamada/migration.sql:3-60`; `mig/20260915132000`. Testes `av/segunda-chamada-agenda-pausa-concorrencia.int.test.ts:257,275`; `av/segunda-chamada-rejeicao-obsoleta.int.test.ts:253` | Atendido |
| AGI | Nova agenda na mesma fonte depois de reserva terminal (falta, cancelamento) | A fila promete: `av/segunda-chamada-fila-agenda.ts:59-60`; `tela/segundas-chamadas/pendentes-agenda/page.tsx:18`. A página esconde o formulário: `av/segunda-chamada-agenda-inicial.ts:385-392,416`. O servidor aceitaria: SQL `:103` | Parcial |
| REM (`remarcacao-segunda-chamada.md`) | 1–2 Conferir a reserva; proposta sem efeito; chave idempotente | `av/segunda-chamada-remarcacao.ts:297-300,326-337,509-623`; `SCT:1329` | Atendido |
| REM | 3 Revalidar sob bloqueio; autoaprovação recusada | `:377,392-394,412-414,462-473`; `mig/20260915121000_remarcacao_agenda_segunda_chamada/migration.sql:263` | Atendido |
| REM | 4 Horário futuro; fim > início; pode cruzar a meia-noite; UTC com fuso | `av/segunda-chamada-remarcacao-schema.ts:59-75`; `:194,258-275`; `av/segunda-chamada-remarcacao-schema.test.ts:33,45` | Atendido |
| REM | 5 Não reinicia o prazo | `:201-204` | Atendido |
| REM | 6 Preserva o encontro anterior (como CANCELADO) e a mesma reserva | `mig/20260915121000_remarcacao_agenda_segunda_chamada/migration.sql:320-325` | Atendido |
| REM | 7 Atômico; concorrência com fato terminal | SQL `:307-327`; `SCT:1359` | Atendido |
| REM | 8 Dia não letivo: justificativa e aprovação explícita | Servidor: `:318,458-461,471-473`. A tela não tem prévia e mostra só a quantidade de períodos (`tela/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx:72`) | Parcial |
| REM | 9 Calendário mudou: nova proposta | `:444-451,471-473`; `SCT:1445` | Atendido |
| REM | 10 Fila e histórico para SEC/GP | `tela/segundas-chamadas/agendas/page.tsx:29-33`; `remarcacao/page.tsx:51-57` | Atendido |
| REM | 11 Q151 no intervalo inteiro | `:214-235`; `av/segunda-chamada-remarcacao-autorizacao.int.test.ts:80,97,115` | Atendido |
| REM | 12 Atribuição docente no intervalo | `:249-256`; `av/segunda-chamada-atribuicao-tx.ts:13-33` | Atendido |
| REM | Troca de professor não entra por campo extra | `av/segunda-chamada-remarcacao-schema.ts:31-41` | Atendido |
| REM | Critérios de aceite gerais | `:148-160,310,412`; `av/segunda-chamada-remarcacao-pagina.test.ts:46,119,157` | Atendido |
| REM | Q164 fica separado | `av/segunda-chamada-resolucao-impedimento-tx.ts:23-53` | Atendido |
| REM | Concorrência com pausa | `av/segunda-chamada-agenda-pausa-concorrencia.int.test.ts:295` | Atendido |
| SUB (`substituicao-segunda-chamada.md`) | 1 SEC/GP/ADM preparam, com prévia | `av/segunda-chamada-substituicao.ts:23,221-253,263-270`; `av/segunda-chamada-substituicao.int.test.ts:121` | Atendido |
| SUB | 2 Sem efeitos; substituto ativo e diferente; conflitos; cobertura contratual | `:117-183`; `av/segunda-chamada-agenda-intervalo.int.test.ts:271,291` | Atendido |
| SUB | 3 Outra pessoa (GP/ADM) decide; SEC não aprova | `:290,297,323,328-335`; SQL `mig/20260915127000_substituicao_docente_agenda_segunda_chamada/migration.sql:143` | Atendido |
| SUB | 4 Troca e designação atômicas | SQL `:186-188` (a designação nasce sem data de fim) | Atendido |
| SUB | 5 Professor anterior não registra | `av/segunda-chamada-realizacao.ts:30`; teste `:193` | Atendido |
| SUB | 6 Idempotência e concorrência | `:308-311,324-327`; testes `:213,267` | Atendido |
| SUB | 7 Interface com histórico | `tela/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx` (link só em `agendas/page.tsx:50`) | Atendido |
| SUB | Integração com banco | `av/segunda-chamada-substituicao.int.test.ts:121-319` | Atendido |
| SUB | Nova versão do calendário permite conferência | `:109-115` | Atendido |
| SUB | Resposta "aplicada" conferida | `:338` devolve `aplicada = d.aprovada` sem ler a aplicação | Parcial |
| Q151 (`recuperacao-autorizacao-especial.md`) | 1 Pausa ou encerramento bloqueiam sem autorização | `av/recuperacao-realizacao.ts:46-50`; `mig/20260915091000_situacao_contratual_recuperacao/migration.sql:124-128`; `LT:1151` | Atendido |
| Q151 | 2 Recusar outra matrícula, outra pendência, prazo vencido e professor sem atribuição | `av/recuperacao-autorizacao-tx.ts:25-26`; `av/recuperacao-autorizacao-schema.ts:89-90`. Faltam testes de "outra matrícula" e de "professor sem atribuição" | Parcial |
| Q151 | 3 Realizada antes da mudança e registrada depois | `av/recuperacao-realizacao.ts:45-50`; `av/recuperacao-operacao.ts:102-104`. Sem teste dedicado | Parcial |
| Q151 | 4 Não aumenta tentativas, não reinicia prazo, não altera contrato | `av/recuperacao-realizacao.ts:42`; `av/recuperacao-reserva-tx.ts:51-55`; `LT:1080,1151` | Atendido |
| Q151 | 5 Histórico respeita acesso; telas coerentes | `av/recuperacao-autorizacao-consulta.ts:11`; `av/recuperacao-preparacao-historico.ts:13`. Validação interativa pendente na própria spec | Parcial |
| Q151 | 6 Repetição e concorrência não duplicam | `schema:4400-4455` (unique); `av/recuperacao-reserva-tx.ts:45`; `LT:1236-1241` | Atendido |
| Q151 | Persistir a autorização completa | `schema:4438`; `av/recuperacao-autorizacao-especial.ts:35-42` (sem revogação explícita) | Atendido |
| Q151 | Autorização não substitui plano nem agenda | `av/recuperacao-autorizacao-especial.ts:30`; agenda e substituição exigem matrícula ATIVA (`av/recuperacao-agenda-tx.ts:31`) | Atendido |
| Q151 | Guardar a autorização usada; separar quem realizou de quem registrou | `schema:4544,4548`; `av/recuperacao-realizacao.ts:51` | Atendido |
| Q151 | Mostrar na operação a pendência liberada, o motivo e o prazo | `av/recuperacao-operacao.ts:95-103` (só a data limite; o motivo aparece só no histórico) | Parcial |
| Q151 | Mesmo alcance entre autorizações (PAUSADA → ENCERRADA) | Reserva e preparação comparam o status (`av/recuperacao-reserva-tx.ts:41-44`); a realização não (`av/recuperacao-autorizacao-tx.ts:25-26`) | Decisão do PO (Q163) |
| Fechamento (`fechamento-e-aproveitamento-academico.md`) | Q153 Gestão prepara o mapeamento | `av/equivalencia-proposta.ts:48,70-76`; `equivalencia-decisao.int.test.ts:109` | Atendido |
| Fechamento | Q153 Outra pessoa (GP/ADM) aprova | `av/equivalencia-decisao.ts:72,88` | Atendido |
| Fechamento | Q153 SEC executa, reconferindo | `av/equivalencia-execucao.ts:59,91,110-131`; `equivalencia-execucao.int.test.ts:122,152` | Atendido |
| Fechamento | Q153 Não copiar lançamentos; não somar requisito duas vezes | `av/equivalencia-transferencia.ts`; `av/aproveitamento-aplicado-tx.ts:171-208`; `equivalencia-transferencia.test.ts:23,40` | Atendido |
| Fechamento | Q153 `trocarTurma` sem escrita direta | `src/server/alunos/acoes.ts:267-273` | Atendido |
| Fechamento | Q153 Disponibilidade pela agenda publicada | `ac/regras.ts:54`; `av/equivalencia-estado-tx.ts:23-32` (escritores externos dependem de Q161) | Parcial |
| Fechamento | Q154 Gestão confirma sem segunda pessoa | `av/fechamento.ts:33,51-56`; teste `:140` | Atendido |
| Fechamento | Q154 Versão guarda contexto, fontes, frequência, pendências e resultado | `av/fechamento-estado-tx.ts:108`; `schema:5209-5238` | Atendido |
| Fechamento | Q154 Leitura e confirmação usam a mesma base | `av/fechamento.ts:45` | Atendido |
| Fechamento | Q154 Pendências impedem o fechamento | `av/fechamento-elegibilidade.ts:98-121`; `av/pendencias-fechamento-tx.ts:32-72`; testes `fechamento-elegibilidade.test.ts:66,77`; `fechamento-academico.int.test.ts:124` | Atendido |
| Fechamento | Q154 Resultado insuficiente pode ser confirmado e não progride | `av/fechamento-elegibilidade.ts:123-134`; `av/fechamento.ts:54` | Atendido |
| Fechamento | Q131 Exceção de frequência preserva a frequência real | `av/fechamento-elegibilidade.ts:114-117`; `av/fechamento-estado-tx.ts:76-93` | Atendido |
| Fechamento | Q154 Correção posterior gera nova versão e preserva a anterior | `schema:5234`; `av/fechamento.ts:50`; teste `:171` | Atendido |
| Fechamento | Q154 Progressão exige fechamento suficiente e atual | `av/progressao-fechamento-tx.ts:22-28`; `ac/acoes.ts:151,186-188` | Atendido |
| Fechamento | Q154 Correção após progressão executada abre revisão sem desfazer | `schema:5050`; `ac/acoes.ts:176-179`; `av/resolucao-revisao-progressao-tx.ts:96`; `av/impactos-progressao-tx.int.test.ts:336,434,645` | Atendido (a spec, na linha 5, ainda diz "pendente") |
| Fechamento | Q154 Não altera mensalidade nem encerra matrícula | Nenhuma escrita financeira em `av/fechamento.ts` nem em `av/equivalencia-execucao.ts` | Atendido (por inspeção) |
| Fechamento | Q154 Portal: sessão própria, EM_REVISAO, isolamento | `src/server/portal-aluno/fechamentos.ts:8-12,34,118,190-212`; `fechamentos.int.test.ts:257-353` | Atendido |
| Fechamento | V1–V4 Integração: contratos, transferência, fechamento, progressão | testes citados acima; `ac/acoes.ts:142` | Atendido |
| Fechamento | V5 Ensaio com portal e equipe "em execução real" | Não encontrado (só testes SSR e de integração) | Não atendido |
| Doc 40 | Solicitar: SEC/GP/ADM | `ac/estado.ts:6`; `ac/acoes.ts:59,64` | Atendido |
| Doc 40 | Parecer do professor atual | `ac/acoes.ts:116-126` | Atendido |
| Doc 40 | Aprovar: outra pessoa (GP/ADM), com fundamentação e parecer ou dispensa | `ac/estado.ts:7`; `ac/acoes.ts:136-150`; `ac/regras.ts:160-162` | Atendido |
| Doc 40 | Executar: SEC/ADM, revalidando | `ac/estado.ts:8`; `ac/acoes.ts:169-204` | Atendido |
| Doc 40 | Cancelar com motivo | `ac/acoes.ts:219-222` | Atendido |
| Doc 40 | Horário compatível é conferência humana | checkbox; não há detecção de conflito (`docs/40-mudancas-academicas-com-aprovacao.md:33`) | Atendido |
| Doc 40 | Transferência equivalente direta (linhas 5 e 38) | `src/server/alunos/acoes.ts:267-273` recusa e remete ao fluxo de equivalência; painel em `tela/MudancasAcademicasPainel.tsx:76-77` | Divergente (doc desatualizado) |
| Doc 40 | Uma solicitação aberta por aluno (linha 27) | Por matrícula: `ac/acoes.ts:76`; `mig/20260914143000_solicitacao_academica_por_contrato/migration.sql:8-12` | Divergente (doc desatualizado) |
| Doc 40 | Condições de aprovação (linhas 13 e 21) | O código também exige fechamento suficiente e atual (`ac/acoes.ts:151-152,186`) | Divergente (doc incompleto) |
| Progressão Q124–Q136, Q138–Q139, Q141–Q154 | Ver `docs/planejamento/progressao-academica.md` | Evidências nas linhas ACA acima. Q148: `mig/20260915116000_cancelamento_aluno_agenda_segunda_chamada/migration.sql:33`. Q152: `av/designacao.ts:39-41`. Q145: o enum Papel não tem "responsável" (`schema:509-518`) | Atendido (29) |
| Progressão Q137 | Consumo por falta e cancelamento na recuperação | ver ACA-17 | Parcial |
| Progressão Q140 | Sugestão de regra pelo professor | ver ACA-20 | Parcial |

## Mapa de telas

Como o acesso é decidido:
- `tela/layout.tsx:11` chama `exigirSessaoPagina()` sem papéis. Ou seja, o layout deixa passar qualquer usuário interno e quem decide é cada página.
- As abas vêm de `tela/secoes.ts:21-39`.
- No menu lateral há uma única entrada, "Mudanças acadêmicas" (`src/lib/nav.ts:13`), visível para ADM, SEC, GP e PROF.
- Quem não tem o papel exigido vai para `/acesso-negado` (`src/server/_shared/sessao.ts:163`).

| Rota | Arquivo | Papéis (guard real) | O que faz |
|---|---|---|---|
| `/academico` | `tela/page.tsx` | SEC, GP, PROF (`:14`) | Fila de mudanças acadêmicas: parecer, decisão, execução, cancelamento |
| `/academico/avaliacoes` | `tela/avaliacoes/page.tsx` | PROF, GP (`:11`) | Vínculos com avaliações; link "Minhas segundas chamadas" para PROF (`:23`) |
| `/academico/avaliacoes/[alocacaoId]` | `.../[alocacaoId]/page.tsx` | PROF, GP (`:35`); links de equivalência e fechamento só para GP (`:46-47`) | Consolidado, pendências, links para planos e extras |
| `/academico/avaliacoes/[alocacaoId]/[codigo]` | `.../[codigo]/page.tsx` | PROF, GP (`:27`). Lançar só PROF (`av/lancamentos.ts:30`); oficializar só GP (`:41`) | Lançar, submeter, oficializar ou devolver; link "Propor correção" (`:71`); aviso de fuso (`:17-20`) |
| `.../[codigo]/designacao` | idem | GP (`:15`) | Designar avaliador substituto |
| `.../[alocacaoId]/equivalencia` | idem | GP (`:10`); `notFound` sem matrícula (`:16`) | Preparar aproveitamento por transferência |
| `.../[alocacaoId]/extras` | idem | PROF, GP (`:11`) | Oportunidades extras de recuperação |
| `.../[alocacaoId]/fechamento` | idem | GP (`:42`) | Revisar e confirmar fechamento; exceção de frequência |
| `/academico/correcoes` | `tela/correcoes/page.tsx` | GP (`:12`) | Fila de revisões após correção; casos históricos |
| `/academico/correcoes/[lancamentoId]` | idem | PROF, GP (`:13`) | Propor correção |
| `.../[lancamentoId]/[propostaId]` | idem | GP (`:10`) | Decidir correção |
| `/academico/correcoes/revisoes/[casoId]` | idem | GP (`:24`) | Resolver caso de revisão de progressão |
| `/academico/equivalencias` | `tela/equivalencias/page.tsx` | GP, SEC (`:17`); exige `?matriculaId` (`:19`) | Propostas de aproveitamento |
| `/academico/equivalencias/[propostaId]` | idem | GP, SEC (`:64`) | GP decide; SEC executa sem ver notas (`av/equivalencia-consulta.ts:56-57`) |
| `/academico/regras` | `tela/regras/page.tsx` | GP (`:10`) | Níveis e regras |
| `/academico/regras/[nivelId]` | idem | GP (`:11`) | Preparar e decidir regra |
| `/academico/regras/turmas/[turmaId]` | idem | GP (`:30`) | Migração de regra da turma |
| `.../turmas/[turmaId]/historica` | idem | GP (`:54`) | Conferência de regra histórica |
| `/academico/recuperacoes` | `tela/recuperacoes/page.tsx` | PROF, GP (`:14`) | Recuperações realizadas |
| `.../recuperacoes/designadas` | idem | PROF (`:13`) | Fila do professor |
| `.../recuperacoes/[realizacaoId]` | idem | PROF, GP (`:13`) | Lançar e conferir nota de recuperação |
| `.../recuperacoes/correcoes/[notaId]` | idem | PROF, GP (`:12`) | Correção de nota de recuperação |
| `.../recuperacoes/planos` | idem | PROF, GP (`:21`) | Preparar e decidir planos; autorizar preparação |
| `.../planos/autorizacoes-preparacao` | idem | GP (`:13`) | Histórico de autorizações |
| `.../planos/[propostaId]` | idem | PROF, GP (`:17`) | Disponibilizar, reservar, realizar, cancelar pela escola, prévia de agenda |
| `.../[propostaId]/autorizacao-reserva` | idem | GP (`:17`) | Autorização especial de reserva |
| `.../[propostaId]/prorrogacoes` | idem | PROF, GP (`:13`) | Propor e decidir prorrogação |
| `.../recuperacoes/reservas/[reservaId]/cancelamento` | idem | GP (`:23`) | Cancelamento da agenda (dupla aprovação) |
| `.../recuperacoes/tentativas/[itemReservaId]` | idem | PROF (`:13`) | Tentativa designada; registrar realização |
| `.../tentativas/[id]/agenda` | idem | GP (`:14`) | Propor e decidir horário |
| `.../tentativas/[id]/autorizacao` | idem | GP (`:15`) | Autorização especial de realização |
| `.../tentativas/[id]/designacao` e `/propostas` | idem | GP (`:15`, `:13`) | Designar avaliador; propor e decidir substituição |
| `/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]` | `tela/segundas-chamadas/...` | PROF, GP (`:10`); gestão só GP (`:15`) | Propor, decidir, disponibilizar, registrar ocorrência. **Nenhum link leva a esta tela** |
| `.../[codigoAvaliacao]/autorizacoes` | idem | GP (`:16`) | Autorização especial Q151 |
| `.../[codigoAvaliacao]/historico` | idem | GP (`:16`) | Histórico de reservas; resolver impedimento Q164 |
| `/academico/segundas-chamadas/pendentes-agenda` | idem | SEC, GP, ADM (`:23`) | Fila sem agenda; link para a agenda (`:50`) |
| `/academico/segundas-chamadas/agendas` | idem | SEC, GP, ADM (`:29-33`) | Reservas agendadas; links de remarcação e substituição (`:50`) |
| `.../propostas/[propostaId]/agenda` | idem | SEC, GP, ADM (`:25`); a decisão o servidor limita a GP/ADM | Agenda inicial |
| `.../propostas/[propostaId]/designacao` | idem | GP, ADM (`:16`) | Designação Q152 |
| `.../reservas/[reservaId]/cancelamento` | idem | GP, ADM (`:29`) | Cancelar (origem ESCOLA ou ALUNO) |
| `.../reservas/[reservaId]/remarcacao` | idem | SEC, GP, ADM (`:37`) | Remarcar (sem prévia) |
| `.../reservas/[reservaId]/substituicao` | idem | SEC, GP, ADM (`:30`) | Trocar professor |
| `/academico/segundas-chamadas/minhas` e `/[reservaId]` | idem | PROF (`:14`, `:13`) | Fila do professor; registrar realização e nota |
| `/academico/reposicoes` | `tela/reposicoes/page.tsx` | SEC, GP, ADM (`:19`); entrega só GP/ADM (`:20`) | Reposição individual **de aula** (não é segunda chamada) |
| `/academico/reposicoes/correcoes/[reposicaoId]` | idem | PROF, GP (`:16`) | Correção da conclusão de reposição |
| `/academico/calendario`, `/novo`, `/[id]` | `tela/calendario/...` | SEC, GP (`:10`, `:10`, `:12`); decidir só GP/ADM e nunca quem preparou (`[id]/page.tsx:22,42`) | Versões do calendário escolar |
| `/academico/calendario/[id]/replanejamento`, `/revisoes`, `/revisoes/[revisaoId]` | idem | SEC, GP (`:10`, `:11`, `:12`) | Replanejamento conjunto dos encontros afetados |
| `/academico/grades`, `/nova`, `/[id]` | `tela/grades/...` | SEC, GP (`:13`, `:13`, `:11`) | Propostas e decisão de grade inicial |
| `/academico/modalidades/quantidade`, `/[id]/quantidade`, `/quantidade/propostas/[propostaId]` | `tela/modalidades/...` | SEC, GP (`:7`, `:7`, `:8`) | Alterar a quantidade de aulas; a aprovação já aplica |
| `/academico/indisponibilidades` | `tela/indisponibilidades/page.tsx` | PROF, SEC, GP (`:16`) | Pedir e decidir ausência docente |
| `/academico/admissoes`, `/[id]`, `/excecoes`, `/excecoes/[reservaId]` | `tela/admissoes/...` | SEC, GP (`:11`, `:10`, `:8`, `:27`) | Janela de admissão e exceção de ingresso (Q110) |
| `/alunos/[id]/academico` | `src/app/(app)/alunos/[id]/academico/page.tsx` | SEC, GP, PROF (`:18`); PROF só vê alunos das próprias turmas (`:24-25`) | Solicitar mudança de nível; links para equivalência |
| `/portal-aluno/resultados` | `src/app/portal-aluno/resultados/page.tsx` | Sessão do portal (`src/server/portal-aluno/sessao.ts:100-102`; redirect em `:118-121`) | Notas oficiais, consolidado parcial, frequência, selo do fechamento |

Grades, admissões e o restante do planejamento:
- **Grade inicial**: proposta de encontros da turma PLANEJADA a partir da modalidade e do calendário. SEC/GP preparam; GP/ADM (outra pessoa) decide. A aprovação cria encontros PREVISTO e checa conflitos e indisponibilidades.
- **Janela de admissão**: data limite para entrar na turma. SEC/GP preparam; outra GP decide. Depois do limite, uma reserva nova é barrada. A exceção individual (Q110) segue o mesmo esquema: SEC/GP preparam e outra GP decide.
- **Indisponibilidade docente**: o PROF pede para si; SEC/GP podem pedir para qualquer professor. Decide GP/ADM, desde que não seja quem preparou nem o próprio professor. A aprovação **só registra** os encontros afetados, não remarca (`ag/indisponibilidade.ts:72-78`).
- **Quantidade de aulas**: a aprovação já altera a agenda futura (`ag/modalidade-quantidade.ts:63,94-120`).

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Entrada da segunda chamada | `avaliacao-por-habilidades.md` ACA-26; `agenda-inicial-segunda-chamada.md` (interface) | Equipe pede segunda chamada a partir da avaliação pendente | A tela existe (`tela/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/page.tsx:10`), mas nenhum link chega a ela; o vínculo só lista as pendências (`tela/avaliacoes/[alocacaoId]/page.tsx:60-62`) | Parcial | Abrir a URL manualmente. Registrar como bug de navegação se o PO confirmar |
| 2 | Prorrogação e extra de segunda chamada | ACA-29, ACA-30; Q149, Q150 | Prazo prorrogável e oportunidade extra, com decisão independente | Só no servidor: `av/segunda-chamada-prorrogacao.ts:17-69`, `av/segunda-chamada-extra.ts:16-51`; nenhuma página importa | Não implementado (tela) | Não há botão. Cenário "não testável" |
| 3 | Nova agenda depois de falta ou cancelamento | `agenda-inicial-segunda-chamada.md` E1/CA6 | Fonte com saldo pode ser reagendada | A fila mostra a fonte com o aviso "a prévia confirmará" (`tela/segundas-chamadas/pendentes-agenda/page.tsx:18`), mas a página esconde o formulário (`av/segunda-chamada-agenda-inicial.ts:385-392,416`) | Divergente | O link da fila abre uma página sem formulário. Abrir bug |
| 4 | Falta e cancelamento pelo aluno na recuperação | ACA-17; Q137 | Falta e cancelamento tardio consomem; cancelamento no prazo libera | Só existe cancelamento pela escola (`av/recuperacao-cancelamento.ts:11-14`); a antecedência é ignorada (`av/regra-schema.ts:26`) | Não implementado | Nenhum botão de "falta" ou de "cancelamento pelo aluno" na recuperação |
| 5 | Prazo de recuperação vencido | ACA-16; Q136 | Vencimento tem consequência definida | Nada conclui a tentativa e o plano aberto bloqueia o fechamento (`av/pendencias-resultado-tx.ts:20-42`). A prorrogação só vale com matrícula ATIVA (`av/recuperacao-prorrogacao.ts:31,59`) | Decisão do PO | O fechamento fica "Plano/Tentativa pendente" sem saída, a não ser por prorrogação |
| 6 | Aluno informado de plano, prazo e agenda | ACA-16, ACA-29; Q136, Q149 | Aluno é informado das condições e do prazo | Existe só o campo `evidenciaComunicacao` (`schema:6751-6763`); o portal não mostra nada | Parcial | No portal só aparecem notas e fechamento; nenhum aviso de prazo |
| 7 | Divulgação da nota | ACA-22 | "Não presumir divulgação" | Oficializar já publica no portal (`src/server/portal-aluno/resultados.ts:98`) | Decisão do PO | A nota aparece no portal logo depois da oficialização |
| 8 | Vínculos encerrados no portal | ACA-23 | Aluno vê o que é seu | A consulta não filtra alocação ativa nem status da matrícula (`resultados.ts:228`) | Sem doc | Depois da transferência, o aluno continua vendo o bloco da turma antiga |
| 9 | Sugestão de regra pelo professor | ACA-20; Q140 | Professor sugere; gestão prepara | Não encontrado; `/academico/regras` é só para GP (`tela/regras/page.tsx:10`) | Não implementado | PROF recebe "acesso negado" em Regras |
| 10 | Segunda pessoa de gestão no UAT | Doc 37; todas as specs de decisão independente | Quem prepara não decide | Seed com um GP só (`prisma/seed-qa.ts:43-44`); ADM passa em tudo (`src/server/_shared/sessao.ts:120-123`) | Bloqueio de UAT (passo do dev) | Pedir ao dev um 2º GP puro (ex.: `gp2@genius.com`). Sem ele, usar o ADM como decisor e anotar a limitação |
| 11 | Fuso da escola obrigatório | Incremento 240; D10 | Lançamento com fuso conferido | Sem fuso institucional, o formulário some (`tela/avaliacoes/[alocacaoId]/[codigo]/page.tsx:17-20,33-34`) | Conforme (pré-condição) | Aviso "Configurar o fuso da escola" no lugar do formulário |
| 12 | Regra só se liga à turma nova | ACA-21 | Turma nova recebe a regra vigente | O trigger só age na criação e com início futuro (`mig/20260913040000_regra_inicial_turma/migration.sql:14-18`); turma antiga vai para migração ou conferência histórica | Conforme (pré-condição) | Publicar a regra **antes** de criar a turma. Turma com data passada mostra "Regras de avaliação pendentes de vinculação" |
| 13 | Frequência apurada para fechar | Q154 | Fechamento considera a frequência | `atendeMinimo` fica nulo quando não há aula base (`av/frequencia.ts:67`), o que gera FREQUENCIA_NAO_APURADA (`av/fechamento-elegibilidade.ts:121`) | Conforme (pré-condição) | É preciso ter grade, encontros concluídos e chamada no diário antes de fechar |
| 14 | Prazo da segunda chamada e feriados | Quadro PR #277 (feriados no SLA) | Feriados do calendário entram no SLA da 1ª resposta | O SLA usa só os FERIADOs da versão aprovada (`src/server/crm-config/feriados-escola.ts:15-17`; `horario-atendimento.ts:73-86`). O prazo da segunda chamada conta minutos corridos (`av/segunda-chamada-disponibilizacao.ts:38`) | Sem doc | O prazo da segunda chamada não pula feriado; só o SLA do WhatsApp pula |
| 15 | Secretaria e segunda chamada | `agenda-inicial-segunda-chamada.md` E4; `remarcacao-segunda-chamada.md` 10 | SEC prepara agenda, remarcação e substituição | A SEC não abre a página da avaliação (`.../[codigoAvaliacao]/page.tsx:10`) nem cancela (`av/segunda-chamada-cancelamento.ts:46`; `reservas/[reservaId]/cancelamento/page.tsx:29`) | Decisão do PO | A SEC vê só "pendentes de agenda" e "agendas"; em cancelamento recebe acesso negado |
| 16 | Remarcação sem prévia | `remarcacao-segunda-chamada.md` 8 | Mostrar o dia não letivo para autorização explícita | Mostra só a quantidade de períodos (`tela/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx:72`) | Parcial | Aparece "N período(s) não letivo(s)", sem nomes nem datas |
| 17 | Professor pesquisável na agenda | `agenda-inicial-segunda-chamada.md` (interface) | Professor pesquisável | Lista os 50 primeiros ativos (`av/segunda-chamada-agenda-inicial.ts:393-396`) | Parcial | Sem busca. Com poucos professores no UAT, o problema não aparece |
| 18 | Alcance das autorizações Q151 | `recuperacao-autorizacao-especial.md` | Mesmo alcance entre autorizações | Reserva e preparação deixam de valer quando a matrícula passa de PAUSADA a ENCERRADA; a realização continua valendo (`av/recuperacao-reserva-tx.ts:41-44` × `av/recuperacao-autorizacao-tx.ts:25-26`). Na segunda chamada, as duas situações são tratadas igual (`av/segunda-chamada-autorizacao-especial.ts:23`) | Decisão do PO (Q163) | Não abrir bug até o PO decidir |
| 19 | Transferência equivalente | Doc 40, linhas 5 e 38 | Operação direta da SEC/GP/ADM | `trocarTurma` recusa (`src/server/alunos/acoes.ts:267-273`); o fluxo é GP → GP → SEC (`av/equivalencia-*.ts`) | Divergente (doc desatualizado) | "Transferência em turma equivalente" abre o fluxo de aproveitamento em 3 etapas, não troca na hora |
| 20 | Limite de pedidos e fechamento | Doc 40, linhas 13, 21, 27 | Um pedido aberto por aluno; aprovação sem menção a fechamento | Limite por matrícula (`mig/20260914143000_solicitacao_academica_por_contrato/migration.sql:8-12`); exige fechamento suficiente (`ac/acoes.ts:151,186`) | Divergente (doc desatualizado) | Aprovar sem fechamento mostra "exige fechamento acadêmico suficiente…" |
| 21 | Docs de planejamento atrasados | `fechamento-e-aproveitamento-academico.md:5`; `avaliacao-por-habilidades.md` (topo, "até 414"); planos 358, 413, Q54, 565 | Revisão pós-progressão, Q153, Q154 e Q164 constam como pendentes | Já implementados: `av/resolucao-revisao-progressao*.ts`; `av/equivalencia-*.ts`; `av/fechamento.ts`; `av/segunda-chamada-resolucao-impedimento*.ts` | Doc desatualizado | Testar o comportamento do código. Esses docs não valem como resultado esperado |
| 22 | Mudança acadêmica sem aviso | Doc 40 (não fala do assunto) | — | Nenhuma notificação (`ac/acoes.ts:16-19`) | Sem doc | Professor, aluno e gestão não recebem aviso; cada um precisa abrir a fila |
| 23 | Indisponibilidade docente | Quadro F07 | Ausência aprovada | Só registra as aulas afetadas, não remarca (`ag/indisponibilidade.ts:72-78`; aviso em `tela/indisponibilidades/page.tsx:27`) | Conforme | Depois da aprovação, as aulas continuam na agenda; a tela avisa |
| 24 | Pausa e encerramento de aluno sem contrato | Doc 40, linha 23 | Alunos legados sem matrícula podem ser movimentados | Diretos, sem aprovação (`src/server/alunos/acoes.ts:187-221,231-265`) | Conforme (legado) | Só aparece para aluno sem matrícula formal |

## Cenários de teste para o QA

### Pré-requisitos do ambiente (fazer antes, com o dev)
- **P1** Rodar `npm run seed` e `npm run seed:qa` (ver `docs/qa/02-usuarios-e-papeis.md`).
- **P2 [DEV]** Criar um 2º Gerente Pedagógico puro (sugestão: `gp2@genius.com`). Se não houver, use `admin@genius.com` onde o cenário diz "GP2" e anote isso no resultado.
- **P3** ADM configura o fuso da escola em `/configuracao/operacao`.
- **P4** Ter um nível com regra publicada (cenários AVA-06 a AVA-08) **antes** de criar a turma de teste. A turma deve ter início futuro, professora Carla e estar aberta para matrícula (ver o bloqueador B1 da auditoria consolidada).
- **P5** Aluno A com matrícula ATIVA nessa turma; aluno B com duas matrículas ativas; credenciais de portal para os dois.
- **P6 [DEV]** Para os cenários de fechamento (AVA-46 a AVA-50): grade aprovada e pelo menos uma aula concluída com chamada no diário. A data da avaliação não pode ser futura nem anterior à entrada do aluno.

Legenda: **[PO]** depende de decisão do PO · **[DEV]** depende de preparo ou correção do dev · **(neg)** caso negativo.

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| AVA-01 | SEC → GP2 | SEC: em `/academico/calendario/novo`, criar versão com um FERIADO e um RECESSO; tentar decidir. GP2 aprova | SEC vê "Outra pessoa da Gerência Pedagógica/Administração deve decidir". GP2 aprova e a versão passa a valer |
| AVA-02 | GP (neg) | Aprovar uma versão de calendário preparada pelo próprio GP | Botão ausente ou recusa. Se houver encontros PREVISTO afetados, a tela exige replanejamento conjunto |
| AVA-03 | SEC → GP | Em `/academico/grades/nova`, preparar a grade da turma PLANEJADA. GP decide em `/academico/grades/[id]` | Encontros PREVISTO criados, nenhum no FERIADO aprovado |
| AVA-04 | SEC → GP2 | Em `/academico/admissoes/[id]`, preparar janela com limite de entrada já passado. GP2 aprova. Tentar uma nova reserva de vaga na turma | Reserva barrada por janela encerrada. A exceção em `/academico/admissoes/excecoes` exige outra GP |
| AVA-05 | PROF → GP | Carla pede ausência num dia com aula em `/academico/indisponibilidades`. GP aprova | Aprovada; a tela lista as aulas afetadas e **não** as remarca. Carla não decide o próprio pedido |
| AVA-06 | PROF, SEC (neg) | Carla e Sofía abrem `/academico/regras` pela URL | `/acesso-negado` para as duas (não existe "sugerir regra", achado 9) |
| AVA-07 | GP | Em `/academico/regras/[nivelId]`, preparar regra com: escala 0–10; I1 intermediária só de Fala; F1 final com as 4 habilidades; pesos; mínimos geral e por habilidade; frequência mínima; limites de recuperação e de segunda chamada. Tentar publicar | Versão proposta. GP vê "A decisão precisa ser registrada por outra pessoa" |
| AVA-08 | GP2 | Publicar a versão do AVA-07. Depois, GP cria a turma de teste em `/configuracao/turmas` com início futuro | Regra publicada. O painel de turmas mostra "Avaliações: versão N" |
| AVA-09 | GP (neg) | Preparar regra sem um campo obrigatório (ex.: sem mínimo geral) | Erro de validação; nada gravado; nenhum valor padrão preenchido |
| AVA-10 | GP → GP2 | Publicar v2. Na turma não iniciada, abrir "Avaliações: versão N" e propor migração; GP2 decide. Repetir numa turma que já tem nota lançada | A turma passa à v2. Na turma com nota: "A turma possui registros de avaliação…" |
| AVA-11 | PROF [DEV] | Num ambiente à parte, sem fuso configurado, Carla abre a avaliação | Aviso com link "Configurar o fuso da escola"; nenhum formulário |
| AVA-12 | PROF | Carla: `/academico/avaliacoes` → vínculo do aluno A → I1 | A I1 mostra só o campo Fala |
| AVA-13 | PROF (neg) | Na F1, tentar: nota 11; data futura; data anterior à entrada do aluno | "Nota fora da escala configurada"; "A data da avaliação precisa estar no vínculo…" |
| AVA-14 | PROF | Na F1, deixar um campo vazio: salvar rascunho e depois submeter | O rascunho salva. A submissão é recusada: "Preencha as notas… sem zero" |
| AVA-15 | PROF | Submeter I1 = 8 com comentário ao aluno. Aluno A abre `/portal-aluno/resultados` | Pendência "aguardando oficialização". No portal a nota ainda não aparece |
| AVA-16 | PROF2, ADM (neg) | Marcos abre a URL da avaliação do aluno A. ADM tenta lançar uma nota | Marcos: vínculo não aparece ou acesso negado. ADM: "Somente o professor com atribuição vigente…" |
| AVA-17 | GP | Abrir a I1 submetida e oficializar com motivo. Aluno A abre o portal | Nota oficial. O portal mostra a nota e o comentário ao aluno, nunca o comentário interno. **[PO]** confirmar se oficializar já equivale a divulgar (achado 7) |
| AVA-18 | GP → PROF | Devolver uma submissão com motivo; Carla grava nova versão. GP tenta oficializar um rascunho. Carla tenta editar uma nota oficial | A devolução aparece para Carla. Rascunho: "não pode ser oficializado". Nota oficial: "Nota oficial exige o fluxo de correção" |
| AVA-19 | GP | `/academico/avaliacoes/[alocacaoId]` com I1 oficial e F1 sem lançamento | F1 "Pendente — nota ausente"; média geral pendente; nenhum zero |
| AVA-20 | PROF + GP | Lançar e oficializar a F1 com uma nota igual ao mínimo da habilidade. Conferir a média na calculadora (Σ nota×peso / Σ pesos) | Valores com 2 casas decimais; "Mínimo atingido" no caso de igualdade |
| AVA-21 | PROF + GP | Com outro aluno: média geral ≥ mínimo, mas Escrita abaixo do mínimo | Resultado insuficiente em Escrita; a média não compensa |
| AVA-22 | Aluno B | Lançar e oficializar nota em só uma das duas matrículas. Aluno B abre o portal | Um bloco por matrícula; a nota aparece só no contrato certo; selo de resultado parcial |
| AVA-23 | Aluno | Aluno de turma sem regra (data passada) abre o portal | Aviso de regra pendente, sem notas |
| AVA-24 | PROF | Na I1 oficial, usar "Propor correção" para um valor menor, com motivo | Proposta pendente. Consolidado e portal continuam com a nota antiga |
| AVA-25 | GP | Em `/academico/correcoes/[lancamentoId]/[propostaId]`, aprovar | A nota nova passa a valer no consolidado e no portal |
| AVA-26 | GP (neg) | GP propõe uma correção e tenta decidir a própria | Recusado: exige outra pessoa |
| AVA-27 | GP [PO] | Aluno A sem F1 (faltou). Procurar o caminho para pedir segunda chamada a partir da avaliação. Depois abrir `/academico/segundas-chamadas/[alocacaoId]/F1` pela URL | Hoje não há link (achado 1). Pela URL, aparecem saldo e histórico |
| AVA-28 | PROF | Na tela acima, propor segunda chamada | Proposta pendente; saldo exibido |
| AVA-29 | GP | Decidir (aprovar) e disponibilizar com data, condições e evidência de comunicação | Prazo exibido = disponibilização + minutos da regra, contados corridos (achado 14) |
| AVA-30 | SEC | Em `/academico/segundas-chamadas/pendentes-agenda`, abrir o item e preparar a agenda: professora Carla, horário dentro do prazo. Testar também um horário em FERIADO | A prévia mostra prazo e conflitos. FERIADO exige justificativa e marcação explícita. SEC não decide |
| AVA-31 | GP (neg + pos) | Aprovar uma agenda com fim depois do prazo. Depois, aprovar uma agenda válida | Fora do prazo: recusada. Válida: reserva RESERVADA, encontro PREVISTO, saldo −1, item listado em `/agendas` |
| AVA-32 | PROF → GP | Carla, em `/academico/segundas-chamadas/minhas`, registra realização e nota. GP oficializa na avaliação original | A nota entra como submetida na F1. O GP (que não é quem realizou) oficializa |
| AVA-33 | GP (neg + pos) | Em outra reserva, registrar falta antes do início. Depois, registrar depois do início | Antes do início: recusado. Depois: falta registrada; nota continua pendente, sem zero; saldo consumido |
| AVA-34 | GP → GP2 | Em `reservas/[id]/cancelamento`, cancelar a pedido do aluno com antecedência suficiente; fazer outro com pouca antecedência. SEC tenta abrir a tela | Cancelamento no prazo devolve o saldo; tardio consome. SEC: acesso negado **[PO]** (achado 15) |
| AVA-35 | SEC → GP | Em `/agendas`, "Abrir remarcação" com novo horário. GP decide | Encontro antigo CANCELADO e novo PREVISTO, mesma reserva, prazo inalterado. Dia não letivo aparece só como contagem (achado 16) |
| AVA-36 | SEC → GP | Em `/agendas`, "Substituir professor" por Marcos. GP decide. Carla tenta registrar a realização | Marcos vê a reserva em "Minhas". Carla não consegue registrar |
| AVA-37 | GP [DEV] | Esgotar o limite de segunda chamada da F1 e propor mais uma. Procurar "prorrogar prazo" e "oportunidade extra" | Nova proposta recusada por falta de saldo. Prorrogação e extra não têm tela (achado 2): marcar "não testável" |
| AVA-38 | PROF (neg + pos) | Em `/academico/recuperacoes/planos?alocacaoId=` do aluno com Escrita insuficiente, preparar plano. Tentar o mesmo para um aluno com nota ausente | Plano criado com Escrita. Com nota ausente: recusado (o caminho é segunda chamada) |
| AVA-39 | GP | Aprovar o plano preparado por Carla; abrir um plano preparado pelo próprio GP | O de Carla é aprovado. No próprio, o botão "aprovar" não aparece |
| AVA-40 | GP | Em `/planos/[propostaId]`, disponibilizar e reservar tentativa de Escrita | O prazo começa na disponibilização. A tela mostra, por habilidade, limite, consumo, reserva e disponível |
| AVA-41 | PROF → GP | Carla registra realização e nota de recuperação maior que a original; GP oficializa. Repetir com nota menor, em outro aluno | Nota maior: o consolidado sobe. Nota menor: o resultado não cai e a tentativa fica registrada na memória de cálculo |
| AVA-42 | PROF → GP | Em `/planos/[propostaId]/prorrogacoes`, Carla propõe e GP decide. GP tenta decidir uma proposta própria | O prazo novo passa a valer. Autoaprovação recusada |
| AVA-43 | GP [PO] | Procurar "falta" ou "cancelamento pelo aluno" na tentativa. Deixar o prazo vencer sem realização | Não existe (achado 4). O vínculo fica em "Tentativa pendente" e bloqueia o fechamento (achado 5) |
| AVA-44 | PROF → GP | Esgotar o limite de recuperação. Em `/avaliacoes/[alocacaoId]/extras`, Carla propõe uma extra e GP decide. GP tenta autoaprovar uma extra | Depois da aprovação, saldo +1. Autoaprovação recusada |
| AVA-45 | GP [DEV] | Pausar a matrícula do aluno A (fluxo da área 04). Tentar lançar avaliação com data dentro da pausa. GP autoriza realização especial de uma pendência | Lançamento recusado ("Confira a situação contratual…"). Só a pendência autorizada pode ser realizada, e dentro do prazo |
| AVA-46 | GP, PROF (neg) | Abrir `/avaliacoes/[alocacaoId]/fechamento` com a F1 pendente. Carla abre a mesma URL | Pendências listadas; confirmar é recusado com "Resolva as pendências…". Carla: acesso negado |
| AVA-47 | GP [DEV] | Abrir o fechamento sem nenhuma aula com chamada | Pendência "frequência não apurada" |
| AVA-48 | GP | Com notas completas e insuficientes, confirmar. Aluno abre o portal | Versão 1 com resultado insuficiente, confirmada por uma pessoa só. Portal: "Fechamento confirmado: resultado insuficiente" |
| AVA-49 | GP → GP2 | Frequência abaixo do mínimo: GP propõe exceção; GP tenta decidir; GP2 decide | Autoexceção recusada. Depois da decisão, o percentual real continua visível e o fechamento pode sair suficiente |
| AVA-50 | PROF + GP | Depois de um fechamento confirmado, aprovar uma correção de nota. Aluno abre o portal. GP revisa o fechamento | Portal mostra "em revisão". A tela exige nova versão (v2); a v1 continua no histórico |
| AVA-51 | SEC (neg + pos) | Em `/alunos/[id]/academico` do aluno A, solicitar mudança para outro nível (motivo e horário confirmado). Tentar uma 2ª solicitação na mesma matrícula | 1ª: PENDENTE; aluno continua na turma. 2ª: recusada |
| AVA-52 | PROF | Carla registra parecer em `/academico`. Marcos tenta o mesmo | Parecer de Carla gravado; status continua PENDENTE. Marcos não vê o aluno |
| AVA-53 | GP (neg + pos) | Aprovar sem fechamento suficiente. Depois do fechamento suficiente, aprovar de novo. Em outro pedido aberto pelo próprio GP, tentar aprovar | 1ª tentativa: "exige fechamento acadêmico suficiente…". 2ª: APROVADA, aluno ainda na turma de origem. Pedido próprio: botão ausente |
| AVA-54 | SEC | Executar a mudança aprovada. Carla abre o aluno | Origem encerrada, destino criado, histórico preservado. Carla perde o acesso operacional (fica só com a leitura do histórico). Ninguém recebe aviso (achado 22) |
| AVA-55 | PROF + GP → GP2 | Corrigir uma nota que embasou uma progressão já executada. GP abre `/academico/correcoes`, entra no caso e propõe resolução; GP2 decide. Antes da resolução, tentar executar outra mudança | Abre caso de revisão, sem desfazer a alocação. A execução fica bloqueada até a resolução |
| AVA-56 | GP → GP2 → SEC | Em `/avaliacoes/[alocacaoId]/equivalencia`, preparar aproveitamento para turma equivalente. GP2 decide em `/academico/equivalencias/[id]`; SEC executa. Tentar também a "troca de turma" direta pela ficha | Aplicada: origem encerrada, destino com notas aproveitadas; SEC não vê notas. Troca direta: mensagem remetendo ao fluxo de equivalência (achado 19) |
| AVA-57 | Aluno [PO] | Depois do AVA-56, o aluno abre o portal | Aparecem os blocos da turma nova **e** da antiga (achado 8). O PO decide se é o esperado |

## Testes existentes por módulo

| Módulo | Arquivos de teste | Destaques |
|---|---|---|
| `src/server/academico` | 6 (4 de integração) | `fluxo.int.test.ts` (~40 casos), `regras.test.ts`, `progressao-fechamento.int.test.ts` (4), `visibilidade.int.test.ts`, `academico.int.test.ts`, `destino-agenda.test.ts` |
| `src/server/avaliacoes` | 49 em 182 arquivos (29 de integração) | `lancamentos.int.test.ts` (~84 casos, cobre também recuperação), `segunda-chamada.int.test.ts` (~47), `migracao-regra.int.test.ts`, `regras.int.test.ts`, `fechamento-academico.int.test.ts`, `equivalencia-*.int.test.ts`, `aproveitamento-aplicado.int.test.ts`, `impactos-progressao-tx.int.test.ts`, `calculo.test.ts`. Os 48 módulos `recuperacao-*` quase não têm `.int` próprio |
| `src/server/turmas` | 6 (3 de integração) | `integridade-academica.int.test.ts` |
| `src/server/agenda` (calendário, grade, quantidade) | 23 (10 de integração) | `modalidade-quantidade.int.test.ts` (14), `ct05-replanejamento-conjunto.int.test.ts`. Sem integração dedicada para `decidirCalendarioEscolar` nem para indisponibilidade |
| `src/server/portal-aluno` | 25 (16 de integração) | `resultados.int.test.ts` (5), `fechamentos.int.test.ts` (4), `fechamentos-transferencia.int.test.ts` |
| SLA e feriados | 2 | `src/server/crm-config/horario-atendimento-feriados.test.ts` (15), `src/server/whatsapp/feriados-sla.int.test.ts` (9) |
| `src/app/(app)/academico` | 85 (SSR e interação) | Recuperações 22, segundas chamadas 19, calendário 7, regras 6, avaliações 6, correções 6, raiz 5, grades 4, equivalências 3, modalidades 3, reposições 3, indisponibilidades 1, **admissões 0** |
| `src/app/(app)/alunos/[id]/academico` | 1 | `page.test.ts` |
| `src/app/portal-aluno` | 12 | `resultados/page.test.ts` (4) |
| E2E (Playwright) | 2 | `e2e/login.spec.ts` e `e2e/permissoes.spec.ts`; nenhum passa por `/academico` ou pelo portal. `login.spec.ts:16-27` espera menus que não batem com `src/lib/nav.ts` (provavelmente desatualizado) |

As próprias specs registram que a homologação interativa e a validação em produção não foram feitas (`docs/specs/agenda-inicial-segunda-chamada.md:3`, `remarcacao-segunda-chamada.md:3`, `substituicao-segunda-chamada.md:3`; incremento 561: "ensaio interativo pendente"). Para quase todo este módulo, o UAT será a primeira execução manual de ponta a ponta.
