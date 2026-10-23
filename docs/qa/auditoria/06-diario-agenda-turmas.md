# Auditoria 06: Diário de aulas, agenda, reposições e turmas

> Escopo: diário de aulas, agenda de encontros (grade, calendário, replanejamento), frequência, pendências do diário, regularizações, exceções e gravações de aula, cancelamento/remarcação/correção de encontros, reposições individuais (particular e gravação, inclusive entrega pelo portal), turmas (alocação, vagas, professor) e visão do professor.
> Somente leitura do código. Linhas citadas são do branch `qa/auditoria-e-onboarding` (= `main` atual + kit de QA), em 21/10/2026. Caminhos relativos à raiz `C:\Users\Mendes\Documents\GitHub\erp-genius`.
> Precedência usada: (1) SPECs com critérios (`docs/specs/avisos-pendencias-diario.md`, `docs/specs/avisos-alteracoes-agenda.md`, `docs/specs/erp-educacional.md` §5 e §8); (2) `docs/37`; (3) registros de entrega (`docs/41`, `docs/planejamento/quadro-entregas.md`); (4) especificação original (`docs/06`, `docs/09`). Planejamento normativo: `docs/planejamento/f07-agenda-aulas.md`, `integracao-frequencia-reposicoes.md`, `gravacoes-revisao-fixa-611.md`, `validacao-reposicao-ciclo-agenda.json` e os fragmentos `reposicao-*.prisma`.
> Regra aplicada: especificação não comprova implementação. "Integrado e validado localmente" nos registros de entrega significa testes automatizados em banco descartável, não homologação em tela.

Legenda de status:

- **CONFORME**: o código faz o que a fonte normativa diz e há caminho pela interface.
- **PARCIAL**: parte da regra existe; falta um pedaço visível ao usuário.
- **DIVERGENTE**: o código faz diferente da fonte (ou a fonte de QA está desatualizada).
- **NAO_IMPLEMENTADO**: não existe nem no servidor nem na tela.
- **SEM_UI**: a regra existe no servidor (com testes), mas nenhuma tela chama a ação.
- **BLOQUEADO_UAT**: implementado, mas depende de integração externa que o UAT não tem (Google Drive, Resend).
- **SEM_DOC**: o código faz algo que nenhuma fonte trata.

## Resumo

**54 itens auditados: 28 CONFORME · 5 PARCIAL · 6 DIVERGENTE · 5 NAO_IMPLEMENTADO · 4 SEM_UI · 4 BLOQUEADO_UAT · 2 SEM_DOC.**

Os 5 achados mais importantes para o UAT:

1. **Sem Google Drive configurado, nenhuma aula de turma fica "Ministrada" pelo caminho normal.** Publicar a gravação chama o Drive antes de gravar qualquer coisa (`src/server/diario/gravacao-aula.ts:38-39`); sem as variáveis `GOOGLE_DRIVE_*`/`DRIVE_ORGANIZACAO_ID` a credencial lança um erro que não é de regra (`src/server/gravacoes/credenciais.ts:12-16,91-95`) e a tela mostra só "Erro inesperado. Tente novamente." (`src/server/_shared/resultado.ts:35-36`). O único caminho no UAT é a **exceção de gravação** (professor pede, outra pessoa da gestão aprova: `src/server/diario/excecao-gravacao.ts:11-56`). Tudo o que exige aula ministrada (reposição, correção, conclusão da turma) depende desse passo. Reposição por gravação, troca de fonte e player ficam inteiros sem teste (#20, #21, #41, #51).
2. **A turma não muda de status pela interface (bloqueador B1 continua).** `alterarStatusTurma` existe (`src/server/turmas/acoes.ts:260-298`), mas nenhuma tela a chama; o seletor de turma da matrícula só lista turmas `ABERTA` (`src/server/matricula/consultas.ts:45-49`). A passagem para "Em andamento" só acontece pelo cron (`src/server/agenda/inicio-turmas.ts:5-27`, chamado em `src/app/api/whatsapp/cron/route.ts:47`) e a **conclusão da turma** (Q48) não tem tela (#3 a #6).
3. **Reposição particular não pode ser agendada pela interface.** O agendamento exige benefício do plano (Q14) ou autorização excepcional aprovada (Q34) (`src/server/diario/reposicao-agenda.ts:233-240`); as ações que criam os dois (`reposicao-agenda.ts:31-97,147-186`) não são chamadas por nenhuma tela. A reposição por gravação depende do Drive (material) e de conta do portal ativada por e-mail (Resend, desligado). No UAT, o ciclo de reposição só é testável **até "Autorizada"** (#36, #37, #41, #42).
4. **Cancelamento e remarcação de encontro de turma não seguem o F07.3.** Não existe pedido de cancelamento de aula de turma pelo professor com reposição escolhida pela gestão (Q08); o cancelamento existe só para particular contratada (`src/server/agenda/cancelamento-particular.ts:16,24-25`) e não gera aviso ao aluno; remarcação de turma só pelo replanejamento global do calendário; substituição temporária de professor (Q56) só no servidor (#26, #27, #30, #32).
5. **O teste do diário exige esperar o fim real de um encontro publicado.** A publicação da grade recusa encontro no passado (`src/server/agenda/grade-decisao.ts:40-41`), a chamada só abre depois do fim (`src/server/diario/chamada-encontro.ts:22`) e a duração da aula tem de ser igual a `horasAula` da modalidade (padrão 2 h: `src/server/turmas/acoes.ts:50-57`, `prisma/schema.prisma:951`). Sem uma modalidade curta de UAT preparada pelo Admin/DEV, cada cenário de chamada custa horas de espera. Também: "Reposta em [data]" não aparece na aula original do diário (`src/app/(app)/diario/DiarioAulas.tsx:165`) e o roteiro de QA atual (CFG-13/14/15) descreve um comportamento antigo de turmas (#12, #44).

## Fluxo ponta a ponta como está no código

Pessoas de teste (seed `prisma/seed.ts` + `prisma/seed-qa.ts`): ADM (admin), GP (`gp@genius.com`, único Gerente Pedagógico: `prisma/seed-qa.ts:43-44`), SEC (`secretaria@genius.com`), PROF (carla, do seed), PROF-2 (`professor2@genius.com`: `seed-qa.ts:79-80`). Toda aprovação independente exige **outra pessoa**: use SEC ou GP para preparar e GP ou ADM para decidir.

| Passo | Tela/rota | Papel | Pré-condição | Efeito | arquivo:linha |
|---|---|---|---|---|---|
| 0a | `/configuracao/operacao` | ADM | nenhuma | Fuso institucional, prazos do portal e prazos de entrega da reposição (1ª entrega e resposta à correção, em minutos) | `src/app/(app)/configuracao/operacao/page.tsx:10-12`; `src/server/portal-aluno/configuracao.ts:39-41` |
| 0b | `/configuracao/operacao/avisos-diario` | ADM | nenhuma | Prazo de regularização e intervalo de lembretes do diário (minutos inteiros positivos) | `src/app/(app)/configuracao/operacao/avisos-diario/page.tsx:8`; `src/server/diario/avisos-pendencias-diario.ts:11-15,244-259` |
| 1 | `/academico/calendario/novo` → `/academico/calendario/[id]` | SEC ou GP prepara; GP ou ADM (outra pessoa) decide | fuso institucional igual ao do calendário | Publica a versão do calendário (feriados/recessos). Se já houver encontros previstos, a decisão simples é recusada e exige replanejamento | `src/server/agenda/calendario.ts:11-13`; `src/server/agenda/calendario-decisao.ts:8-30` |
| 2 | `/configuracao/turmas` › Nova turma | GP (Admin passa) | modalidade com frequência e `horasAula` | Cria a turma em `PLANEJADA`; professor e data final opcionais; duração precisa bater com a modalidade; abre o link "Preparar grade" | `src/server/turmas/acoes.ts:65-67,103-162`; `src/server/turmas/schema.ts:42,53`; `src/app/(app)/configuracao/turmas/TurmaFormulario.tsx:57,81` |
| 3 | `/academico/grades/nova?turmaId=…` | SEC ou GP | turma `PLANEJADA`, sem diário/agenda publicada; `aulasPorNivel` configurado; calendário aprovado | Proposta de grade com os N encontros (pula dias fora da grade e não letivos) | `src/server/agenda/grade-proposta.ts:12-35`; `src/server/agenda/grade-turma-tx.ts:7-26`; `src/server/agenda/grade.ts:41-56` |
| 4 | `/academico/grades/[id]` | GP ou ADM (não quem preparou) | professor definido, sem conflito/indisponibilidade, todos os encontros no futuro | Cria os encontros `PREVISTO` da turma (agenda publicada) | `src/server/agenda/grade-decisao.ts:11-53` |
| 5 | (sem tela) | — | — | Mudar a turma para `ABERTA` só pelo banco [DEV] (B1). Alternativa: janela de admissão em `/academico/admissoes` + reserva da Secretaria | `src/server/turmas/acoes.ts:260-298`; `src/server/matricula/reserva-disponibilidade.ts:5-21` |
| 6 | `/matriculas/nova` (ou preparação da Secretaria) | VEND/GC (ou SEC) | turma `ABERTA` com vaga (caminho legado) ou agenda publicada + janela (caminho de reserva) | Cria a `AlocacaoTurma` com `matriculaId` | `src/server/matricula/acoes.ts:276-300`; `src/server/matricula/validacao.ts:62-73`; `src/server/matricula/ativacao-preparacao-tx.ts:82-85` |
| 7 | (cron a cada 5 min) | sistema | 1º encontro `PREVISTO`/`MINISTRADO` já começou | Turma `PLANEJADA`/`ABERTA` → `EM_ANDAMENTO` | `src/server/agenda/inicio-turmas.ts:5-27`; `src/app/api/whatsapp/cron/route.ts:47`; `docker-compose.coolify.yml:154` |
| 8 | `/diario/encontros` › "Abrir chamada" | PROF do encontro | encontro `PREVISTO` já terminado | Lista de chamada pelos vínculos vigentes no início da aula | `src/app/(app)/diario/encontros/page.tsx:26`; `src/server/diario/chamada-encontro.ts:12-44`; `src/server/diario/chamada-tx.ts:6-31` |
| 9 | `/diario/encontros/[id]` › Salvar | PROF do encontro (ou designado) | mesma | Cria/atualiza `AulaDiario` + `RegistroAulaAluno` (Presente, Falta, Impedido por restrição com observação) | `src/server/diario/acoes.ts:17-109`; `src/server/diario/schema.ts:15-16` |
| 10a | `/diario/encontros/[id]` › Publicar gravação | PROF do encontro (ou designado) | diário completo, todas as presenças | Fixa a revisão no Drive e marca `MINISTRADO`. **No UAT sem Drive: erro genérico** | `src/server/diario/gravacao-aula.ts:18-66`; `src/server/diario/conclusao-contexto.ts:10-29` |
| 10b | `/diario/encontros/[id]` › Gravação irrecuperável | PROF do encontro (ou designado) | diário completo | Solicitação de conclusão sem gravação | `src/server/diario/excecao-gravacao.ts:11-30` |
| 11 | `/diario/excecoes-gravacao` › Decidir | GP ou ADM (não o solicitante) | diário igual ao da solicitação | Aprova → `MINISTRADO`; rejeita → continua `PREVISTO` | `src/server/diario/excecao-gravacao.ts:32-56` |
| 12 | `/diario/pendencias` | PROF, GP, ADM | encontro `PREVISTO` terminado | Lista pendências; cria/atualiza ciclos de aviso ao consultar; encerra ciclos de aulas resolvidas | `src/server/diario/avisos-pendencias-diario.ts:152-242` |
| 13 | `/diario/regularizacoes` | GP/ADM designa; designado regulariza | aula prevista terminada | Designação com motivo para outro professor ou gestor (Q24); revogação | `src/server/diario/regularizacao-designacao.ts:14-68`; `src/server/diario/regularizacao-acesso.ts:12-41` |
| 14 | `/diario/encontros/[id]/correcao` | PROF ainda vinculado ou GP propõe; outro GP/ADM aprova | aula `MINISTRADO`, todos os registros com matrícula e participação | Proposta com antes/depois; publicação após conferência de impactos (financeiro, reposições) | `src/server/diario/correcao-aula.ts:39-169`; `src/server/diario/correcao-aula-tx.ts:20-38` |
| 15 | `/academico/reposicoes?matriculaId=…` | SEC ou GP solicita; GP ou ADM (outra pessoa) decide | aula original de turma `MINISTRADO`, aluno com Falta/Impedido conferido, matrícula ativa | Pedido de reposição (particular ou gravação) e decisão | `src/server/diario/reposicao-individual.ts:50-152` |
| 16a | `/academico/reposicoes` › Agendar | SEC (ou ADM) | benefício do plano com saldo ou autorização excepcional aprovada (**sem tela**) | Cria encontro `REPOSICAO` e reserva da cota | `src/server/diario/reposicao-agenda.ts:188-292` |
| 16b | `/diario/reposicoes` | PROF do encontro de reposição | encontro de reposição terminado | Registra presença/falta (encontro vira `MINISTRADO`) e conclui | `src/server/diario/reposicao-individual.ts:154-247` |
| 17a | `/academico/reposicoes` (painel operacional) | GP ou ADM | reposição gravada autorizada; prazo da 1ª entrega configurado; **gravação oficial no Drive** | Publica material, define prazo, designa avaliador, prorroga, libera, confirma indisponibilidade | `src/server/diario/reposicao-entrega-operacional.ts:124-253`; `src/server/portal-aluno/entregas-reposicao.ts:186-260` |
| 17b | `/portal-aluno/reposicoes/[id]` | Aluno (conta do portal) | material disponível, prazo aberto | Envia resumo e atividade; relata material indisponível; assiste ao vídeo | `src/server/portal-aluno/entregas-reposicao.ts:133-176,269-290`; `src/app/portal-aluno/reposicoes/[id]/page.tsx:15-84` |
| 17c | `/diario/reposicoes` | PROF designado avaliador | entrega registrada | Valida (informa data da validação) ou pede correção | `src/app/(app)/diario/reposicoes/ReposicaoDocente.tsx:34-58`; `src/server/diario/reposicao-individual.ts:179-247` |
| 18 | (sem tela) | GP | meta de aulas ministradas cumprida, sem previstos, diário completo | Turma → `CONCLUIDA` | `src/server/turmas/conclusao-agenda.ts:6-18`; `src/server/turmas/acoes.ts:281` |

## Máquinas de estado

**Turma** (`prisma/schema.prisma:1063-1068`, `StatusTurma`)

| De → Para | Como | Regra | arquivo:linha |
|---|---|---|---|
| (nova) → PLANEJADA | Nova turma | sempre nasce Planejada | `src/server/turmas/acoes.ts:145` |
| PLANEJADA → ABERTA | `alterarStatusTurma` (**sem tela**) | não confere professor nem agenda | `src/server/turmas/acoes.ts:260-298` |
| PLANEJADA/ABERTA → EM_ANDAMENTO | cron `iniciarTurmasDaAgenda` ou `alterarStatusTurma` | exige 1º encontro de AULA já iniciado | `src/server/agenda/inicio-turmas.ts:9-24`; `src/server/turmas/acoes.ts:279-280` |
| EM_ANDAMENTO → PLANEJADA/ABERTA | bloqueado | "A turma já iniciou; não pode retornar…" | `src/server/turmas/acoes.ts:275-278` |
| * → CONCLUIDA | `alterarStatusTurma` (**sem tela**) | meta aprovada cumprida, nenhum previsto, diários completos | `src/server/turmas/conclusao-agenda.ts:6-18` |
| CONCLUIDA → * | bloqueado | "Uma turma concluída não pode ser reaberta…" | `src/server/turmas/acoes.ts:272` |

Observação: a grade inicial só é gerada com a turma `PLANEJADA` (`src/server/agenda/grade-turma-tx.ts:9`). Uma turma aberta pelo DEV antes da grade fica sem caminho de grade inicial.

**Encontro** (`prisma/schema.prisma:2870-2884`; finalidades `AULA`, `REPOSICAO`, `RECUPERACAO`, `SEGUNDA_CHAMADA`)

| De → Para | Como | arquivo:linha |
|---|---|---|
| (novo) → PREVISTO | aprovação da grade; agendamento de reposição; ativação de particular contratada | `src/server/agenda/grade-decisao.ts:42-47`; `src/server/diario/reposicao-agenda.ts:248`; `src/server/matricula/ativacao-preparacao-tx.ts:76-78` |
| (novo) → RASCUNHO | rascunho avulso de encontro (SEC/GP) | `src/server/agenda/rascunho.ts:10-12` |
| PREVISTO → MINISTRADO | gravação publicada; exceção aprovada; diário da reposição individual | `src/server/diario/gravacao-aula.ts:61`; `src/server/diario/excecao-gravacao.ts:50`; `src/server/diario/reposicao-individual.ts:166` |
| PREVISTO → CANCELADO | cancelamento de particular aprovado; redução de quantidade; cancelamento/remarcação de reposição | `src/server/agenda/cancelamento-particular.ts:80`; `src/server/agenda/modalidade-quantidade.ts:115`; `src/server/diario/reposicao-agenda.ts:349,438` |
| PREVISTO → PREVISTO (outro horário) | replanejamento global aprovado | `src/server/agenda/replanejamento-decisao.ts:21-31` |
| NAO_REALIZADO, IMPEDIDO_ESCOLA | usados só pela segunda chamada (fora desta área) | `prisma/migrations/20260915117000_encontro_segunda_chamada_nao_realizado/migration.sql:2` |

A passagem do horário não muda o estado: aula passada continua `PREVISTO` e gera pendência.

**Frequência** (registro por aluno: `RegistroAulaAluno.presente` + `participacao`, `prisma/schema.prisma:219-241`)

| Estado | Como aparece | Origem |
|---|---|---|
| sem registro / `presente = null` | "Não informado" / "Presença não informada" | chamada não preenchida |
| PRESENTE | "Presente" | chamada |
| FALTA | "Falta" (na chamada) / "Ausente" (no histórico) | chamada |
| IMPEDIDO_POR_RESTRICAO | "Impedido por restrição" (exige observação; só com matrícula identificada) | `src/server/diario/schema.ts:16`; `src/app/(app)/diario/encontros/[id]/ChamadaEncontro.tsx:39` |
| regularizada por reposição | não muda o registro; a apuração soma a reposição concluída uma única vez | `src/server/avaliacoes/frequencia-reposicoes-tx.ts:41`; `src/server/avaliacoes/frequencia.ts:24` |

**Reposição individual** (`ReposicaoIndividual` e satélites, `prisma/schema.prisma:6176-6355,6540-6545`)

Solicitada → (decisão) Autorizada ou Rejeitada (rejeição permite novo pedido) → Particular: agenda `RESERVADA` ou `ISENTA_EXCECAO` → cancelamento (`DEVOLVIDA`/`CONSUMIDA`, decidido pela gestão) ou remarcação (mantém a reserva) → encontro de reposição `MINISTRADO` com Presente (conclui) ou Falta (consome, não conclui; nova tentativa exige novo pedido) → Concluída ("Reposta em [data de realização]"). Gravação: material publicado (início do prazo) → entrega v1 → correção solicitada (`PENDENTE` → `RESPONDIDA`) → entrega vN → validação do professor designado → Concluída ("Reposta em [data da validação]"). Após concluída: correção da conclusão (proposta → decisão independente). Fontes: `src/server/diario/reposicao-individual.ts:50-317`, `src/server/diario/reposicao-agenda.ts:223-447`, `src/server/portal-aluno/entregas-reposicao.ts:133-176`.

**Gravação da aula**

Sem fonte → `PublicacaoGravacaoAula` com revisão fixa do Drive (OFICIAL) **ou** `ExcecaoGravacaoEncontro` (pendente → aprovada/rejeitada) → regularização de fonte (proposta → decisão; nova `FonteRevisaoGravacao` versão n+1, sem apagar a anterior). Legado sem revisão não reproduz: "A revisão da gravação exige regularização antes da reprodução." Fontes: `prisma/schema.prisma:7299-7432`, `src/server/gravacoes/fonte-revisao-tx.ts:8-14`, `src/server/gravacoes/regularizacao-fonte.ts:73-152`.

**Pendência do diário** (`AvisoPendenciaDiario`, `prisma/schema.prisma:3053-3073`, único por encontro + destinatário + tipo)

Não existe → aberta ao consultar o painel (DOCENTE: primeiro lembrete no fim da aula; GESTAO: primeiro alerta no vencimento) → lembretes a cada intervalo, um por consulta, sem fila retroativa → encerrada `RESOLVIDO` (aula ministrada) ou `CANCELADO` (fonte inválida: perdeu atribuição, aula cancelada) no próximo acesso → reaberta se a fonte voltar a valer (evento `AvisoPendenciaDiarioReaberto`). Fonte: `src/server/diario/avisos-pendencias-diario.ts:75-143`.

## Critérios das specs

| Spec | Critério | Evidência arquivo:linha | Status |
|---|---|---|---|
| avisos-pendencias-diario | Configuração ausente: painel mostra pendências e indica a configuração | `src/server/diario/avisos-pendencias-diario.ts:169,207-211`; `src/app/(app)/diario/pendencias/page.tsx:30` | CONFORME |
| avisos-pendencias-diario | Configuração inválida recusada (minutos positivos e inteiros) | `avisos-pendencias-diario.ts:11-15` | CONFORME |
| avisos-pendencias-diario | Só a Administração atual configura; autoria e valores anterior/novo | `avisos-pendencias-diario.ts:246-259` | CONFORME |
| avisos-pendencias-diario | Docente autorizado vê; outro docente não | `avisos-pendencias-diario.ts:47-71,172` | CONFORME |
| avisos-pendencias-diario | Designação vigente dá acesso; revogada retira | `avisos-pendencias-diario.ts:49,187,203-204` | CONFORME |
| avisos-pendencias-diario | Gestão acompanha antes e recebe alerta depois do vencimento | `avisos-pendencias-diario.ts:111-112,226-227`; `pendencias/page.tsx:31` | CONFORME |
| avisos-pendencias-diario | Repetição no mesmo intervalo não duplica; vários intervalos sem consulta não criam fila retroativa | `prisma/schema.prisma:3070`; `avisos-pendencias-diario.ts:125-142` | CONFORME |
| avisos-pendencias-diario | Resolução da aula encerra os avisos, preservando o ciclo | `avisos-pendencias-diario.ts:75-105` | CONFORME |
| avisos-pendencias-diario | Paginação | `avisos-pendencias-diario.ts:10,190` | CONFORME |
| avisos-pendencias-diario | Sem dados pessoais, financeiros ou ID de gravação | `avisos-pendencias-diario.ts:182-188,212-232` | CONFORME |
| avisos-pendencias-diario | Avisos só dentro do ERP, sem job em segundo plano | `avisos-pendencias-diario.ts:145-151` | CONFORME |
| avisos-pendencias-diario | Datas com a referência de fuso do encontro | `pendencias/page.tsx:37-41` (preferência pessoal; sem ela, fuso de origem) | CONFORME |
| avisos-pendencias-diario | Papel de gestão sozinho não preenche diário de outra pessoa | `src/server/diario/regularizacao-acesso.ts:26-40` | CONFORME |
| avisos-alteracoes-agenda | Aviso criado na mesma transação da alteração aprovada (remarcação, substituição, replanejamento, quantidade) | `src/server/agenda/remarcacao-particular.ts:72`; `src/server/diario/reposicao-agenda.ts:442`; `src/server/comunicacoes-agenda/avisos.ts:39`; testes `src/server/comunicacoes-agenda/avisos.int.test.ts:39,48` | CONFORME |
| avisos-alteracoes-agenda | Vínculo da matrícula no instante do encontro (alocação encerrada no início não recebe) | `src/server/agenda/substituicao-avisos.int.test.ts` (7 testes, quadro N01 `docs/planejamento/quadro-entregas.md:601-603`) | CONFORME (só teste automatizado) |
| avisos-alteracoes-agenda | Rejeição e rollback não criam avisos | `remarcacao-particular.ts:72` (só com `aprovar`); `avisos.int.test.ts:39` | CONFORME |
| avisos-alteracoes-agenda | Transições RECUSADO→FALHOU, INCERTO→INCERTO, ACEITO→ENVIADO | worker com transporte simulado; envio desligado por padrão `src/server/comunicacoes-agenda/envio-gate.ts:4`, `.env.example:73-75` | CONFORME (não testável em UAT) |
| avisos-alteracoes-agenda | Pendência por evento/matrícula/motivo (`SEM_DESTINATARIO_AUTORIZADO`, `CONTATO_SEM_OPT_IN`…) | `src/server/comunicacoes-agenda/pendencias.ts:25-36`; `prisma/schema.prisma:2281-2292`; tela `src/app/(app)/secretaria/avisos-agenda/page.tsx:15,33` | CONFORME |
| avisos-alteracoes-agenda | Reconferência pela Secretaria/Administração com observação | `src/server/comunicacoes-agenda/pendencias.ts:106-108`; `src/app/(app)/secretaria/avisos-agenda/ReconferirPendencia.tsx` | CONFORME |
| avisos-alteracoes-agenda | Responsável só com autorização explícita registrada | `src/server/comunicacoes-agenda/autorizacoes.ts:10,28-60`; tela `/matriculas/[id]/autorizacoes-comunicacao` | CONFORME |
| avisos-alteracoes-agenda | Q38 cobre toda alteração aplicada (F07 §2) | cancelamento de particular aprovado não chama `criarAvisosAlteracaoAgendaTx` (`src/server/agenda/cancelamento-particular.ts:60-86`) | PARCIAL |
| integracao-frequencia-reposicoes | 1. Particular `REPOSICAO` ministrada com presença regulariza uma falta sem aumentar a base | `src/server/avaliacoes/frequencia-integracao.int.test.ts:93` | CONFORME (teste) |
| integracao-frequencia-reposicoes | 2. Gravação só regulariza após entrega e validação do docente designado ativo | `frequencia-integracao.int.test.ts:101`; `src/server/diario/reposicao-individual.ts:233` | CONFORME (teste) |
| integracao-frequencia-reposicoes | 3. Correção aprovada substitui a fonte; pendente/rejeitada não | `frequencia-integracao.int.test.ts:115` | CONFORME (teste) |
| integracao-frequencia-reposicoes | 4. Encontro contratado, recuperação, pedido só aprovado, presença original e fonte futura não regularizam | `src/server/avaliacoes/frequencia-reposicoes-tx.ts:41`; `src/server/diario/reposicao-individual.ts:91-96` | CONFORME (teste) |
| gravacoes-revisao-fixa-611 | Dois ranges seguem na revisão publicada mesmo com cabeça nova | `src/server/gravacoes/drive-revisao-stream.ts:13,26`; teste `drive-revisao-stream.test.ts:10` | CONFORME (BLOQUEADO_UAT) |
| gravacoes-revisao-fixa-611 | Publicação recusa `keepForever` falho, revisão divergente ou resposta incerta | `src/server/gravacoes/drive-revisao.ts:151,164-182`; testes `drive-revisao.test.ts:26,55,101` | CONFORME (BLOQUEADO_UAT) |
| gravacoes-revisao-fixa-611 | Legado sem revisão não cai para a cabeça | `src/server/gravacoes/fonte-revisao-tx.ts:14`; `drive-revisao-stream.test.ts:35` | CONFORME |
| gravacoes-revisao-fixa-611 | Token não exposto, sem URL pública, redirect recusado | `drive-revisao-stream.ts:27` (`redirect: "error"`); `src/app/api/diario/encontros/[id]/video/route.ts:10-43` | CONFORME |
| erp-educacional §5 REQ-04 | Grade por data mínima, dias, fuso, duração e quantidade; primeira aula e término; meia-noite; sem professor só rascunho | `src/server/agenda/grade.ts:41-56`; `src/server/turmas/schema.ts:16-21`; `grade-decisao.ts:35` | CONFORME |
| erp-educacional §5 REQ-04 | Publicação/alocação exige disponibilidade real do professor | publicação sim (`grade-decisao.ts:37-39`); alocação pelo caminho legado não (`src/server/matricula/validacao.ts:62-73`) | PARCIAL |
| erp-educacional §5 REQ-05 | Cancelamento, remarcação, exceção, substituição e mudanças globais com aprovação de outra pessoa | global e quantidade sim; cancelamento de turma não existe; substituição sem tela | PARCIAL |
| erp-educacional §5 REQ-06 | Aula prevista até chamada e gravação ou exceção; chamada histórica; pendências configuráveis; correção com aprovação; regularização limitada | `conclusao-contexto.ts:18-26`; `chamada-tx.ts:6-31`; `avisos-pendencias-diario.ts`; `correcao-aula.ts:70-138`; `regularizacao-designacao.ts:14-68` | CONFORME |
| erp-educacional §5 REQ-08 | Reposição particular pelo plano ou gravação avaliada; regularizar uma vez | servidor completo; benefício e exceção sem tela | PARCIAL |
| erp-educacional §5 REQ-09 | Portal com histórico, entregas e avaliações; reprodução pelo servidor sem download | `src/app/portal-aluno/reposicoes/[id]/page.tsx:15-84`; `video-gravacao.tsx:15` | CONFORME (BLOQUEADO_UAT) |
| erp-educacional §6 Turma | Início automático no 1º encontro; gestão conclui após meta e pendências | início só por cron; conclusão sem tela | PARCIAL |
| erp-educacional §8 | Fuso institucional, de origem e preferência pessoal separados; telas mostram "exibido em X; origem Y" | `src/app/(app)/diario/encontros/page.tsx:24`; `src/app/(app)/diario/encontros/[id]/page.tsx:23` | CONFORME |
| erp-educacional §8 | Conflito docente considera encontros efetivos e indisponibilidades aprovadas | `src/server/agenda/grade-disponibilidade.ts:10`; `grade-decisao.ts:37-39` | CONFORME |
| erp-educacional §8 | Mutação e evento na mesma transação; falha de envio não desfaz agenda | `registrarEvento(tx, …)` em todas as ações citadas; avisos como intenção (`avisos.ts:39`) | CONFORME |
| erp-educacional §9 | Erro diferencia validação, permissão, conflito, versão… | sem Drive: "Erro inesperado. Tente novamente." (`resultado.ts:35-36`) | DIVERGENTE |
| validacao-reposicao-ciclo-agenda.json | 10/10 testes de `src/server/diario/reposicao-agenda.int.test.ts` (reserva, última cota, dia não letivo, rejeição terminal, SQL direto, cancelamento no prazo, remarcação) | arquivo JSON (resultado de teste local, não homologação) | CONFORME (teste) |
| reposicao-*.prisma | Todos os modelos previstos existem no schema (`ReposicaoIndividual`, `AgendaReposicaoIndividual`, `BeneficioReposicaoParticularMatricula`, `PropostaCancelamentoAgendaReposicaoIndividual`…) | `prisma/schema.prisma:6176-6355,6530-6698,7196-7270` | CONFORME |

## Mapa de telas

Administrador passa em todo guard (`src/server/_shared/sessao.ts`, `temPapel`). Usuário só do portal (papel ALUNO) é negado nas telas internas.

| Rota | Arquivo | Papéis (guard real) | O que faz |
|---|---|---|---|
| `/diario` | `src/app/(app)/diario/page.tsx:10` | PROF, GP | Histórico do diário (50 por página, busca), "Registrar aula" avulsa do professor, links para completar encontro, correção e gravação |
| (layout) `/diario/*` | `src/app/(app)/diario/layout.tsx:11-14`; abas `secoes.ts:14-22` | qualquer sessão interna | Barra de abas por papel; com uma aba só, sem barra (Secretaria) |
| `/diario/encontros` | `src/app/(app)/diario/encontros/page.tsx:10` | PROF, GP, SEC | Encontros de AULA; PROF vê só os seus (`src/server/agenda/encontros-docente.ts:16-18`); "Abrir chamada" só para o próprio, previsto e terminado |
| `/diario/encontros/[id]` | `src/app/(app)/diario/encontros/[id]/page.tsx:15` | PROF, GP (+ designação ou ser o professor do encontro) | Chamada, Publicar gravação, Gravação irrecuperável, ocorrências de particular |
| `/diario/encontros/[id]/cancelamento` | `.../cancelamento/page.tsx:11` | PROF, GP, SEC | Só particular contratada: propor e decidir cancelamento |
| `/diario/encontros/[id]/remarcacao` | `.../remarcacao/page.tsx:9` | SEC, GP | Só particular cancelada: propor e decidir remarcação |
| `/diario/encontros/[id]/correcao` | `.../correcao/page.tsx:10` | PROF, GP | Proposta, conferência de impactos, aprovação/rejeição e histórico de correção de aula ministrada |
| `/diario/encontros/[id]/gravacao` | `.../gravacao/page.tsx:4-13` | **sem guard de página**; a autorização vem de `autorizarVideoAulaInstitucional` (PROF, GP) | Player da gravação oficial; qualquer falha mostra "Gravação indisponível para este acesso." |
| `/diario/pendencias` | `src/app/(app)/diario/pendencias/page.tsx:18` | PROF, GP, ADM | Painel de pendências e lembretes (Q22) |
| `/diario/regularizacoes` | `src/app/(app)/diario/regularizacoes/page.tsx:17` | PROF, GP | Aulas pendentes; GP designa/revoga responsável (Q24) |
| `/diario/reposicoes` | `src/app/(app)/diario/reposicoes/page.tsx:13` | PROF | Fila do professor: particular a realizar, gravação a validar, histórico e correções |
| `/diario/reposicoes/[id]/troca-fonte` | `.../troca-fonte/page.tsx:14` | GP, ADM | Troca da fonte de material de reposição gravada |
| `/diario/excecoes-gravacao` | `src/app/(app)/diario/excecoes-gravacao/page.tsx:15` | PROF (só as próprias), GP | Fila de exceções de gravação; GP decide as de outras pessoas |
| `/diario/regularizacoes-gravacao` | `.../regularizacoes-gravacao/page.tsx:13` | GP, ADM | Regularização da fonte de gravação de aula/material |
| `/academico/calendario` (+ `/novo`, `/[id]`, `/[id]/replanejamento`, `/[id]/revisoes/[revisaoId]`) | `src/app/(app)/academico/calendario/page.tsx:10` e filhas | SEC, GP | Calendário escolar, decisão e replanejamento conjunto |
| `/academico/grades` (+ `/nova`, `/[id]`) | `src/app/(app)/academico/grades/page.tsx:13`, `nova/page.tsx:13`, `[id]/page.tsx:11` | SEC, GP | Preparar e decidir a grade inicial da turma |
| `/academico/indisponibilidades` | `src/app/(app)/academico/indisponibilidades/page.tsx:16` | PROF, SEC, GP | Solicitar e decidir ausência docente (Q39) |
| `/academico/modalidades/quantidade` (+ `[id]/quantidade/...`) | `src/app/(app)/academico/modalidades/quantidade/page.tsx:7` | SEC, GP | Alteração da quantidade de aulas por modalidade (Q41-Q43) |
| `/academico/admissoes` | `src/app/(app)/academico/admissoes/page.tsx:11` | SEC, GP | Janela de admissão da turma |
| `/academico/reposicoes` | `src/app/(app)/academico/reposicoes/page.tsx:19` | SEC, GP, ADM | Busca de matrícula, ausências elegíveis, solicitar/decidir, agendar particular (SEC), painel operacional da gravação (GP/ADM) |
| `/academico/reposicoes/correcoes/[reposicaoId]` | `.../correcoes/[reposicaoId]/page.tsx:16` | PROF, GP | Correção de reposição concluída (Q54) |
| `/secretaria/avisos-agenda` | `src/app/(app)/secretaria/avisos-agenda/page.tsx:15` | SEC, ADM | Fila de avisos de alteração de agenda e pendências operacionais (N01) |
| `/alunos/turma/[id]` | `src/app/(app)/alunos/turma/[id]/page.tsx:17-24` | SEC, GP, FIN, PROF (PROF só turma própria; senão 404) | Ficha da turma: modalidade, nível, código, horário, professor, ocupação, alunos; diário/progressão só para GP e PROF |
| `/configuracao/turmas` | `src/app/(app)/configuracao/turmas/page.tsx:12` | GP (importar: só ADM, `:20`) | Lista, criar, editar turma; "Preparar grade" em turma Planejada |
| `/configuracao/operacao/avisos-diario` | `.../operacao/avisos-diario/page.tsx:8` | ADM | Prazo e intervalo das pendências do diário |
| `/portal-aluno` e `/portal-aluno/reposicoes/[id]` | `src/app/portal-aluno/page.tsx:16-20`; `reposicoes/[id]/page.tsx:25-28` | conta do portal; reposição de outro aluno → 404 | Lista de reposições, situação, prazos, entregas, correções, relato, player |
| `GET /api/diario/encontros/[id]/video` | `src/app/api/diario/encontros/[id]/video/route.ts:18-43` | PROF, GP (revalidado a cada trecho) | Vídeo da aula por revisão fixa; 403 genérico |
| `POST /api/portal-aluno/reposicoes/[id]/entregas` | `src/app/api/portal-aluno/reposicoes/[id]/entregas/route.ts:8-19` | aluno do portal, mesma origem | Registra entrega; 422 genérico se bloqueada |
| `POST /api/portal-aluno/reposicoes/[id]/indisponibilidades` | `.../indisponibilidades/route.ts:10-23` | aluno do portal, mesma origem | Relato de material indisponível |
| `GET /api/portal-aluno/reposicoes/[id]/video` | `.../video/route.ts:18-44` | aluno do portal | Vídeo do material autorizado |

Menu: "Diário de aulas" aparece para ADM, GP e PROF (`src/lib/nav.ts:17`); a Secretaria chega a `/diario/encontros` pelo acadêmico.

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Criação de turma | docs/09 §3 Turmas; F07 Q44; SPEC §5 (F07.2/Q47/Q48) | GP cria; sem professor só como rascunho; data final vem da agenda | `src/server/turmas/acoes.ts:103-162` (GP `:65-67`, sempre `PLANEJADA` `:145`); professor e data final opcionais `src/server/turmas/schema.ts:42,53` | CONFORME | Turma nova aparece "Planejada", com "Previsão de término pendente da grade." e link "Preparar grade" (`TurmasPainel.tsx:201-218`) |
| 2 | Duração/frequência própria da turma | F07 Q37 | Proposta justificada de duração/frequência diferente, aprovada por outra pessoa antes da publicação | Criação exige exatamente os dias da frequência e a duração de `horasAula` (`src/server/turmas/acoes.ts:45-57,121-128`); nenhuma proposta de exceção na criação | NAO_IMPLEMENTADO | Horário com duração diferente da modalidade é recusado: "A aula da modalidade X dura N hora(s)…" |
| 3 | Mudança de status da turma | docs/09 §3 (Planejada → Aberta → Em andamento → Concluída) | Ciclo de vida com abertura para matrícula | `alterarStatusTurma` existe (`acoes.ts:260-298`) e não é chamado por nenhuma tela (busca em `src/app` sem resultado) | DIVERGENTE (B1) | Não há botão de status em Configuração › Turmas. Pedir ao DEV para pôr a turma em ABERTA no banco de UAT |
| 4 | Início automático | F07 Q48; SPEC §6 Turma | No início do 1º encontro oficial a turma passa a em andamento | Só pelo cron `iniciarTurmasDaAgenda` (`src/server/agenda/inicio-turmas.ts:5-27`) dentro de `/api/whatsapp/cron` (`route.ts:47`), a cada 5 min no compose (`docker-compose.coolify.yml:154`) | PARCIAL | Até ~5 min após o início do 1º encontro a turma aparece "Em andamento", **se** o cron estiver ativo no UAT [DEV] |
| 5 | Conclusão da turma | F07 Q48 | Gestão confirma após meta cumprida e pendências resolvidas | Regra completa em `src/server/turmas/conclusao-agenda.ts:6-18`; sem tela | SEM_UI | Não há como concluir turma pela interface |
| 6 | Seletor de turma na matrícula | docs/09 §3 ("só Aberta com vaga") | Turmas abertas com vaga | `src/server/matricula/consultas.ts:45-49` lista só `ABERTA` com início futuro; `validacao.ts:62-73` | DIVERGENTE (efeito do B1) | Sem o ajuste do DEV, o seletor de turma da matrícula vem vazio |
| 7 | Vagas | docs/09 §3 e §Ficha da Turma | "8 matriculados · 4 vagas" | Lista desconta alocações e reservas (`TurmasPainel.tsx:170,207`); ficha da turma desconta só alocações (`src/app/(app)/alunos/turma/[id]/page.tsx:25,48`) | PARCIAL | Com reserva de vaga ativa, a lista e a ficha mostram números de vagas diferentes. Abrir issue citando o item |
| 8 | Próxima aula e status na turma | docs/09 §3 e §Ficha da Turma | Próxima aula, início, status e situação financeira por aluno | Não encontrado em `TurmasPainel.tsx` nem em `alunos/turma/[id]/page.tsx:41-80` | NAO_IMPLEMENTADO | Gap conhecido (roteiro ALU-14); não há "próxima aula" em nenhuma das duas telas |
| 9 | Mínimo para abrir | docs/09 §3 Decidido; docs/06 | Mínimo vive na modalidade e a turma herda | `minimoAbrir` só é cadastrado e exibido no catálogo (`src/app/(app)/configuracao/catalogo/ModalidadesPainel.tsx:65`); nenhuma regra usa | NAO_IMPLEMENTADO | Nada impede iniciar turma com menos alunos que o mínimo [PO] |
| 10 | Escopo do professor | docs/37; docs/09 §Visão do Professor; SPEC §4 | Só turmas, encontros e alunos atribuídos | `src/server/diario/permissoes.ts:4-5` (vínculo docente vigente, turma não concluída); `src/server/alunos/consultas.ts:359-383` (404 fora do escopo); `encontros-docente.ts:18` | CONFORME | PROF não vê turma, encontro nem pendência de outro professor; URL direta de turma alheia dá 404 |
| 11 | Home do professor | docs/09 §Home do Professor | Próxima aula em destaque, agenda de hoje/amanhã | Home mostra "Próxima aula experimental" e "Minhas turmas" (`src/app/(app)/home/HomeProfessor.tsx:87,162`; `src/server/home/consultas.ts:52`); nenhuma aula da agenda | DIVERGENTE | A Home não mostra a próxima aula de turma. Registrar e citar o item [PO] |
| 12 | Roteiro de QA de turmas | `docs/qa/03-roteiro-testes-manuais.md` CFG-13/14/15/17 | "Situação calculada pelas datas", "Aceitando matrícula", data de fim obrigatória | Lista mostra o status canônico (`TurmasPainel.tsx:43-50`); data de fim é opcional (`schema.ts:53,57-60`) | DIVERGENTE (roteiro desatualizado) | Esperar "Planejada", não "Aceitando matrícula"; data de fim vazia é aceita. Atualizar CFG-13/14/15/17 |
| 13 | Calendário escolar | F07.1 Q05/Q19-Q21/Q45 | Único, no fuso institucional, aprovado por outra pessoa; mudança com agenda publicada vai para revisão conjunta | Preparo SEC/GP (`calendario.ts:11-13`); decisão GP/ADM, não o preparador, fuso igual, recusa se há encontros previstos (`calendario-decisao.ts:15-30`) | CONFORME | Quem preparou não consegue aprovar; com agenda publicada aparece "Há encontros publicados. Revise os impactos…" |
| 14 | Geração e publicação da grade | F07.2 Q04/Q46/Q47; SPEC REQ-04 | Encontros por quantidade de aulas, primeiro dia válido, término previsto, sem duplicar | `grade-turma-tx.ts:9-22`; `grade.ts:41-56`; `grade-decisao.ts:21-47` (outra pessoa, professor, sem conflito, encontros futuros, chave por índice) | CONFORME | Prévia mostra data informada, primeira aula e término; feriado é pulado; aprovar duas vezes não duplica |
| 15 | Turma sem professor | F07 Q44; F07.2 aceite | Rascunho sem professor; publicar e alocar exigem professor disponível, inclusive no servidor | Publicação bloqueada (`grade-decisao.ts:35`); caminho de reserva confere professor e agenda (`reserva-disponibilidade.ts:11-19`, `admissao-turma.ts:22-25`); caminho legado da matrícula só confere `ABERTA` e vaga (`validacao.ts:62-73`) | PARCIAL | Aprovar grade sem professor: "Defina o professor antes de publicar a grade." Matrícula legada em turma ABERTA sem professor é aceita [PO] |
| 16 | Indisponibilidade e conflito docente | F07 Q39; SPEC §8 | Solicitação, aprovação de outra pessoa, bloqueio de novos agendamentos | `src/server/agenda/indisponibilidade.ts:15-75` (decisor não pode ser o preparador nem o próprio professor `:66`); conflito na grade `grade-decisao.ts:37-39` | CONFORME | Aprovar grade sobre ausência aprovada ou aula de outra turma do mesmo professor: "Resolva os conflitos ou a indisponibilidade docente…" |
| 17 | Aula passada continua prevista | F07 §1 "Aula prevista"; Q48 | Passar o horário não torna ministrada | Chamada só após o fim (`chamada-encontro.ts:22`; `acoes.ts:44`); status não muda pelo relógio | CONFORME | Antes do fim não há "Abrir chamada"; depois, o encontro segue "Previsto" até a conclusão |
| 18 | Chamada histórica | F07 Q53 | Lista pelo vínculo na data da aula | `chamada-tx.ts:6-31` (vigência; vínculos sobrepostos exigem conferência); `acoes.ts:65-69` | CONFORME | Aluno alocado depois do início da aula não aparece; aluno que saiu depois aparece; com vínculo ambíguo: "Há vínculos que precisam de conferência da gestão…" |
| 19 | Impedido por restrição | F07 Q59; docs/41 #361 | Situação própria, distinta de falta, sem dado financeiro | Opção só com matrícula identificada (`ChamadaEncontro.tsx:39`); exige observação (`schema.ts:16`) | CONFORME | "Impedido por restrição" sem observação é recusado: "Registre a ocorrência do impedimento, sem dados financeiros" |
| 20 | Conclusão normal com gravação | F07 §1 e Q77/Q81; F07.4 | Presenças + gravação no Drive concluem a aula | Regra em `conclusao-contexto.ts:18-26`; publicação chama o Drive antes de gravar (`gravacao-aula.ts:38-39`) | BLOQUEADO_UAT | Sem Drive no UAT, "Publicar gravação e concluir aula" sempre falha e o encontro segue Previsto |
| 21 | Mensagem do erro de Drive | SPEC §9 (erros diferenciados) | Distinguir configuração indisponível de erro inesperado | `ErroCredenciaisDrive` estende `Error` (`credenciais.ts:12-16`), não `ErroRegra`; `executarAcao` responde "Erro inesperado. Tente novamente." (`resultado.ts:35-36`) | DIVERGENTE | Ao publicar gravação: "Erro inesperado. Tente novamente." Abrir bug P3 de mensagem (esperado: "Configuração de gravações indisponível.") |
| 22 | Exceção de gravação | F07 Q07; F07.4 aceite | Professor justifica; outra pessoa da gestão decide; histórico identificável | `excecao-gravacao.ts:11-56` (solicitante não decide `:42`; diário mudado invalida `:49`); fila `excecao-consulta.ts:12-48` | CONFORME | Caminho principal de conclusão no UAT. PROF não vê botão de decidir; GP aprova e a aula vira "Ministrado" |
| 23 | Pendências do diário | SPEC avisos-pendencias-diario; F07 Q22 | Painel interno, prazo/intervalo configuráveis, alerta à gestão após vencimento | `avisos-pendencias-diario.ts:152-242` | CONFORME | Ver critérios acima e cenários DIA-28 a DIA-31 |
| 24 | Regularização após saída do professor | F07 Q24 | Gestão designa responsável com acesso só àquela aula; preserva professor original | `regularizacao-designacao.ts:14-68`; acesso `regularizacao-acesso.ts:26-40`; autoria original `acoes.ts:81` | CONFORME | Designado salva a chamada e o diário continua no nome do professor original; após revogar, perde o acesso |
| 25 | Correção de aula concluída | F07 Q23; SPEC §6 | Proposta com motivo, antes/depois, aprovação de outra pessoa, efeitos conferidos | `correcao-aula.ts:140-169` (PROF vinculado ou GP); aprovação/rejeição `:39-138` (autor não decide `:52,100`; dependência financeira `:107`); exige aula ministrada e contratos identificados (`correcao-aula-tx.ts:20-38`) | CONFORME | Resultado vigente só muda após aprovação; autor não aprova; proposta sem mudança: "A proposta precisa identificar uma alteração na aula." |
| 26 | Cancelamento de aula de turma | F07 §1 "Cancelamento", Q08; F07.3 | Professor solicita com justificativa; gestão aprova e escolhe reposição na grade ou extraordinária | Não encontrado. O único cancelamento de encontro de AULA exige encontro particular sem turma (`cancelamento-particular.ts:16,24-25`) | NAO_IMPLEMENTADO | Encontro de turma não tem link de cancelamento; URL `/diario/encontros/<id>/cancelamento` mostra "Escolha um encontro particular contratado." [PO] |
| 27 | Cancelamento de particular contratada | F07 Q95, Q38 | Aprovação de outra pessoa; após aplicar, aviso ao aluno | Propor: PROF do encontro, SEC, GP (`cancelamento-particular.ts:9,26`); decidir: GP/ADM, não o preparador (`:62,68,70`); aplica CANCELADO (`:80`); sem aviso | PARCIAL | Cancelamento aprovado não aparece em Secretaria › Avisos de alterações na agenda [PO] |
| 28 | Remarcação de particular | F07 Q95/Q21/Q38 | Proposta, aprovação de outra pessoa, aviso | `src/server/agenda/remarcacao-particular.ts:23-76` (outra pessoa `:54`; aviso `:72`) | CONFORME | Após aprovar, aviso "Preparado" na fila da Secretaria; nada é enviado |
| 29 | Replanejamento global | F07 Q20/Q21; SPEC §5 F07.3 | Proposta conjunta, revisão, aprovação de outra pessoa, aplicação atômica | `replanejamento-decisao.ts:21-31` (preparador do calendário ou da revisão não decide); telas `/academico/calendario/[id]/replanejamento` e `/revisoes/[revisaoId]` | CONFORME | Encontros futuros previstos mudam de data só depois da aprovação; avisos aparecem na fila da Secretaria |
| 30 | Remarcação pontual de aula de turma | F07 Q08 (data na grade ou extraordinária) | Reposição da turma escolhida na decisão do cancelamento | Não encontrado; só replanejamento global | NAO_IMPLEMENTADO | Não há como mover um único encontro de turma [PO] |
| 31 | Quantidade de aulas da modalidade | F07 Q41-Q43; SPEC §5 | Aumento alcança não finalizadas; redução só não iniciadas; aprovação conjunta | `src/server/agenda/modalidade-quantidade.ts:30,66,75,115`; catálogo recusa edição direta (`src/server/catalogo/acoes.ts:140`) | CONFORME | Editar "aulas por nível" no catálogo é recusado e manda para Acadêmico › Quantidade de aulas |
| 32 | Substituição temporária de professor | F07 Q56 | SEC/GP propõe; outra pessoa aprova; acesso limitado | `src/server/agenda/substituicao.ts:12`; `substituicao-decisao.ts:10-20`; nenhuma tela chama | SEM_UI | Não há tela de substituição de professor em aula de turma [DEV/PO] |
| 33 | Avisos de alteração (modo simulado) | SPEC avisos-alteracoes-agenda; F07 Q38 | Intenção durável; transporte desligado até homologação | Flag `COMUNICACOES_AGENDA_ENVIO_ENABLED` (`envio-gate.ts:4`; `.env.example:73-75`); fila `consultas.ts:19-21` | CONFORME | Avisos ficam "Preparado"; pendência "Sem destinatário autorizado" quando não há contato autorizado; nenhum e-mail/WhatsApp sai |
| 34 | Solicitar reposição | F07 Q10/Q11; SPEC §6 | Ligada à falta conferida; não regulariza | `reposicao-individual.ts:50-107` (SEC/GP `:52`; uma por falta `:84`; matrícula ativa `:91`; aula ministrada `:93`; falta/impedimento `:96`) | CONFORME | Só aparecem ausências de aulas ministradas; segunda solicitação para a mesma falta: "Esta falta já possui reposição…" |
| 35 | Decidir reposição | F07 Q11 | Outra pessoa da gestão aprova | `reposicao-individual.ts:109-152` (GP `:111`; não o solicitante `:133`) | CONFORME | SEC não vê decisão; GP que solicitou recebe "Outra pessoa deve decidir a reposição." |
| 36 | Benefício de particular por plano | F07 Q14/Q49/Q50 | Configurar por plano quantidade, período e prazo de cancelamento | Servidor: `reposicao-agenda.ts:31-97`; nenhuma tela | SEM_UI | Prévia do agendamento mostra "Sem benefício normal vigente." e não deixa confirmar [DEV para dados] |
| 37 | Particular excepcional | F07 Q34 | Gestão escolhe particular excepcional com aprovação de outra pessoa | Servidor: `reposicao-agenda.ts:147-186`; tela só seleciona autorização já aprovada (`ReposicoesEquipe.tsx:155`) | SEM_UI | Sem benefício e sem autorização, agendar dá "Sem benefício vigente, a particular exige autorização excepcional aprovada." |
| 38 | Agendamento da particular | F07 Q11/Q14/Q19; SPEC §5 F07.6 | Secretaria agenda após prévia de saldo e conflitos | `reposicao-agenda.ts:188-292` (só SEC/ADM `:190,225`; dia não letivo exige exceção `:244`) | CONFORME | Prévia mostra cota, conflitos e dia não letivo; GP não agenda (só SEC/ADM). Bloqueado na prática por #36/#37 |
| 39 | Cancelamento/remarcação da reposição particular | F07 Q16/Q26 | Devolve ou consome conforme prazo; remarcação não consome duas vezes | `reposicao-agenda.ts:293-447` (SEC/ADM propõe; GP/ADM decide; aviso na remarcação `:442`); testes `validacao-reposicao-ciclo-agenda.json` | CONFORME | Testável só depois de existir agendamento [DEV] |
| 40 | Realização da particular | F07 Q13/Q16/Q55 | Presença conclui; falta consome e não conclui | `reposicao-individual.ts:154-177` (professor do encontro, encontro terminado); conclusão `:179-247` | CONFORME | Depende de #36/#37 |
| 41 | Material da reposição gravada | F07 Q35/Q77/Q81 | Material autorizado; prazo começa na disponibilidade real | `entregas-reposicao.ts:186-187` (exige gravação oficial da aula), `:222` (prazo configurado), `:238` (Drive) | BLOQUEADO_UAT | "Configure o prazo da primeira entrega…" se o prazo faltar; "A aula original não possui gravação oficial disponível…" para aula concluída por exceção |
| 42 | Entrega pelo portal | F07 Q33/Q35/Q52; F07.7 | Aluno envia resumo e atividade nas próprias reposições, dentro do prazo | `entregas-reposicao.ts:78-83,133-176`; conta do portal só por convite por e-mail, desligado (`src/server/portal-aluno/processar-envios.ts:34-36`) | BLOQUEADO_UAT | Sem conta do portal ativada [DEV], o aluno não entra; com conta e sem material: "O material oficial ainda não está disponível para esta reposição." |
| 43 | Avaliação, correção e avaliador | F07 Q13/Q40 | Professor designado valida ou pede correção; gestão troca avaliador com motivo | `ReposicaoDocente.tsx:34-58`; designação exigida `reposicao-individual.ts:233`; troca `reposicao-entrega-operacional.ts:124-205` | CONFORME | Professor sem designação: "Sem designação vigente para validar esta gravação." |
| 44 | "Reposta em [data]" | F07 Q10/Q55; F07.6 | Mostrar na aula original após conclusão | Aparece em `ReposicoesEquipe.tsx:110` e no portal (`src/app/portal-aluno/page.tsx:20`); o histórico do diário mostra "Ausente" (`DiarioAulas.tsx:165`) | PARCIAL | No diário a falta reposta continua "Ausente", sem "Reposta em" [PO] |
| 45 | Frequência regularizada | integracao-frequencia-reposicoes; docs/41 #359-362 | Conta a aula original uma vez; preserva falta | `src/server/avaliacoes/frequencia.ts:24`; `frequencia-reposicoes-tx.ts:41`; testes `frequencia-integracao.int.test.ts:93,101,115` | CONFORME | Visível em Acadêmico › Avaliações › fechamento; no UAT só com reposição concluída (bloqueada por #36/#41) |
| 46 | Revisão fixa da gravação | gravacoes-revisao-fixa-611; quadro "VIDEO — aceite do DEV" | Publicar e reproduzir sempre a mesma revisão | `drive-revisao.ts:51,164-182`; `drive-revisao-stream.ts:13,26`; colunas `prisma/schema.prisma:7299-7356` | CONFORME | Não testável sem Drive |
| 47 | Player sem download | F07 Q82 | Só assistir no ERP | `controlsList="nodownload"` (`gravacao/page.tsx:11`; `src/app/portal-aluno/reposicoes/[id]/video-gravacao.tsx:15`); `Cache-Control: private, no-store` (`video/route.ts:10-15`) | CONFORME | Sem botão de baixar (não é proteção contra captura) |
| 48 | Página de gravação sem guard | docs/37 (bloqueio por papel) | Página nega acesso por papel | `gravacao/page.tsx:4-13` não chama `exigirSessaoPagina`; o layout só exige sessão (`layout.tsx:11`) | SEM_DOC | FIN/SEC/VEND que abrirem a URL veem "Gravação indisponível para este acesso." (não "acesso negado"); nenhum dado vaza |
| 49 | Registro avulso de aula | F07.4 ("vincular registro ao encontro") | Diário ligado ao encontro previsto | "Registrar aula" ainda existe (`DiarioAulas.tsx:125`); aceita qualquer instante passado sem encontro publicado nele (`acoes.ts:45-46,54-56`) | DIVERGENTE | PROF consegue registrar uma aula fora da agenda; no horário de um encontro: "Identifique o encontro da agenda para registrar esta aula." [PO] |
| 50 | O que o aluno vê no portal | F07.7; SPEC §4 Aluno | Próprias reposições, avaliações e material | Lista e detalhe só de reposições (`portal-aluno/page.tsx:20`; `reposicoes/[id]/page.tsx:65-82`); sem data/horário da particular agendada nem agenda de aulas | SEM_DOC | O aluno não vê quando é a particular agendada [PO] |
| 51 | Troca e regularização de fonte | F07 Q23/Q57; quadro VIDEO | Fonte substituta com aprovação independente | `troca-fonte-reposicao.ts:106-197`; `regularizacao-fonte.ts:73-152` | BLOQUEADO_UAT | Telas abrem vazias (não há publicação no UAT); testar só acesso |
| 52 | Abas do diário por papel | docs/42 E2 | Abas iguais aos guards | `src/app/(app)/diario/secoes.ts:14-22` | CONFORME | PROF: 6 abas sem "Regularizações de gravação"; GP: 6 abas sem "Reposições"; SEC: sem barra |
| 53 | Pausa/encerramento e entrega | F07 Q36 | Leitura do histórico; novo envio só com liberação específica | `estadoEntregaPortalAluno` (`src/server/portal-aluno/reposicoes.ts:260-272`); liberação exige conta do portal ativa (`reposicao-entrega-operacional.ts:223-237`) | CONFORME | Matrícula pausada: SEC não vê "Solicitar"; liberação sem conta: "A matrícula não possui conta de portal ativa…" |
| 54 | Prazos da reposição | F07 Q35/Q52 | Configuráveis, sem valor presumido; prorrogação com motivo | `src/app/(app)/configuracao/operacao/page.tsx:12`; `entregas-reposicao.ts:222,376-419` | CONFORME | Sem prazo configurado, publicar material é recusado |

## Cenários de teste para o QA

Marcações: **[DEV]** depende de passo do desenvolvedor no UAT; **[PO]** o resultado esperado depende de decisão do PO (registrar o observado, não abrir bug); **(neg)** caso negativo. Antes de começar, o DEV precisa:

- P1 [DEV] Ter o cron `/api/whatsapp/cron` rodando no UAT (início automático de turma, #4).
- P2 [DEV] Criar uma **modalidade de UAT curta** (ex.: "QA 15 min", `horasAula` 0,25, "5x/semana", 3 aulas por nível) com produto e preço, para que a aula termine 15 min depois de começar. Sem isso, cada chamada exige esperar a duração da modalidade (2 h por padrão).
- P3 [DEV] Pôr as turmas em ABERTA no banco depois da grade publicada (B1), ou configurar janela de admissão e usar o caminho de reserva.
- P4 Confirmar com o DEV que o Drive **não** está configurado (cenários de gravação oficial são negativos) e que `COMUNICACOES_AGENDA_ENVIO_ENABLED` está `false`.
- P5 [DEV] Para cenários do portal: ativar uma conta de aluno no portal (o convite por e-mail está desligado).

| ID | Papel | Passos | Resultado esperado | Marca |
|---|---|---|---|---|
| DIA-01 | PROF, depois ADM | 1) PROF abre Diário › Pendências antes de qualquer configuração<br>2) ADM abre o mesmo painel | Aviso "Os prazos de regularização e lembrete do diário ainda não foram configurados."; só o ADM vê o link "Configurar avisos" | |
| DIA-02 | ADM | Configuração › Operação › Configurar avisos do diário: 1) prazo 0 → salvar<br>2) intervalo -5 → salvar<br>3) prazo 60, intervalo 30 → salvar | 1 e 2 recusados; 3 gravado e mantido após recarregar | (neg) |
| DIA-03 | ADM | Configuração › Operação: definir o fuso institucional e os prazos de 1ª entrega e de resposta à correção da reposição | Valores gravados após recarregar | |
| DIA-04 | SEC, depois GP | 1) SEC: Acadêmico › Calendário › Novo, com um feriado numa data futura<br>2) SEC tenta decidir<br>3) GP aprova com motivo | 2: sem opção de decisão para quem preparou (ou "Outra pessoa deve decidir o calendário.")<br>3: calendário publicado | (neg) |
| DIA-05 | PROF | Abrir `/academico/calendario` e `/academico/grades` pela URL | Acesso negado nas duas | (neg) |
| DIA-06 | GP | Configuração › Turmas › Nova turma na modalidade de UAT, **sem** professor e **sem** data de fim | Turma criada, status "Planejada", "Previsão de término pendente da grade." e link "Preparar grade". NÃO É BUG: data de fim vazia é aceita (roteiro CFG-14 desatualizado) | |
| DIA-07 | GP | Nova turma com horário de fim cuja duração difere da modalidade | Recusada: "A aula da modalidade … dura … hora(s). O horário informado precisa corresponder a essa duração." Não existe exceção por turma (Q37) | (neg) [PO] |
| DIA-08 | GP | Nova turma em modalidade de 2 h com 23:00–01:00 | Aceita; o rótulo mostra o horário atravessando a meia-noite | |
| DIA-09 | SEC, depois GP | 1) SEC: "Preparar grade" da turma do DIA-06 (sem professor) com motivo<br>2) GP abre a proposta e aprova | 1: prévia com data informada, primeira aula e término, pulando o feriado do DIA-04<br>2: recusado "Defina o professor antes de publicar a grade." | (neg) |
| DIA-10 | GP, SEC, ADM | 1) GP edita a turma e define PROF<br>2) SEC prepara nova versão da grade com o 1º encontro daqui a ~30 min<br>3) GP aprova | Grade publicada; Diário › Encontros mostra os encontros como "Previsto" com "exibido em …; origem …" | |
| DIA-11 | GP, ADM | 1) GP prepara a grade de outra turma<br>2) GP tenta aprovar a própria<br>3) ADM aprova | 2: "Outra pessoa deve decidir a grade."; 3: publicada | (neg) |
| DIA-12 | SEC, GP | Preparar e aprovar grade de uma 2ª turma do mesmo PROF com horário sobreposto ao do DIA-10 | Aprovação recusada: "Resolva os conflitos ou a indisponibilidade docente antes de publicar a grade." | (neg) |
| DIA-13 | SEC, GP | Preparar grade com o 1º encontro já no passado (data inicial hoje, horário que já passou) e aprovar | "A publicação inicial exige encontros futuros; confira a data inicial da turma." | (neg) |
| DIA-14 | GP | Editar professor ou horário da turma do DIA-10 (agenda publicada) | Recusado: "A turma possui agenda publicada. Mudanças de professor, nível, modalidade, datas ou horários exigem revisão e aprovação da agenda." | (neg) |
| DIA-15 | GP | Procurar em Configuração › Turmas uma ação para Abrir ou Concluir a turma | Não existe (B1, #3 e #5). Pedir ao DEV o ajuste P3; não abrir bug novo | [DEV] |
| DIA-16 | PROF, GP | 1) PROF: Acadêmico › Indisponibilidades, solicitar ausência num período futuro com motivo<br>2) PROF procura decidir<br>3) GP confere o impacto e aprova<br>4) SEC prepara grade de outra turma do PROF nesse período e GP tenta aprovar | 2: sem decisão para o próprio professor<br>3: aprovada<br>4: recusada por indisponibilidade | (neg) |
| DIA-17 | VEND/ADM | Matrícula com turma na turma do DIA-10 depois do ajuste P3 (ver MAT-14/16 do roteiro) | Aluno alocado; lista de turmas: "1 matriculados · 0 reservas · N-1 vagas" | [DEV] |
| DIA-18 | SEC | Abrir a ficha da turma (Alunos › turma) e comparar vagas com Configuração › Turmas, com e sem reserva ativa | Ocupação e lista de alunos corretas; sem status e sem próxima aula (#8). Se houver reserva ativa, as vagas divergem entre as duas telas (#7): abrir issue citando o item | |
| DIA-19 | PROF, PROF-2 | 1) PROF: Home e Alunos<br>2) PROF-2 abre pela URL a ficha da turma do PROF | 1: "Minhas turmas" com a turma; a Home mostra "Próxima aula experimental", não a próxima aula da turma [PO] (#11)<br>2: 404 | (neg) [PO] |
| DIA-20 | Sistema/ADM | Esperar o início do 1º encontro do DIA-10 + 5 min e abrir Configuração › Turmas | Turma "Em andamento" | [DEV] (P1) |
| DIA-21 | PROF | Antes do fim do 1º encontro: 1) Diário › Encontros<br>2) abrir `/diario/encontros/<id>` pela URL | 1: sem "Abrir chamada"; 2: "A chamada exige encontro previsto já terminado." | (neg) |
| DIA-22 | PROF | Após o fim: Abrir chamada; marcar um aluno "Não informado" e salvar com conteúdo | Salvo. Pendências continua com "Complete as presenças da chamada." e "Registre a gravação oficial ou solicite exceção." | |
| DIA-23 | PROF | Completar a chamada: um Presente, um Falta, um "Impedido por restrição" sem observação → salvar; depois com observação | Sem observação: "Registre a ocorrência do impedimento, sem dados financeiros"; com observação: salvo | (neg) |
| DIA-24 | PROF | Publicar gravação com um ID qualquer (ex.: `abc123`) | Falha e o encontro continua "Previsto". Hoje a mensagem é "Erro inesperado. Tente novamente." (#21): abrir bug P3 de mensagem | (neg) |
| DIA-25 | PROF | Gravação irrecuperável: justificativa com 3 letras; depois justificativa válida | Botão desabilitado com menos de 5 caracteres; com justificativa válida: "Solicitação enviada." e item em Exceções de gravação | (neg) |
| DIA-26 | PROF, GP | 1) PROF em Exceções de gravação<br>2) GP aprova com motivo | 1: vê a própria solicitação sem botão de decidir<br>2: encontro "Ministrado"; no próximo acesso a Pendências o item some | |
| DIA-27 | PROF, GP | Em outro encontro: PROF solicita exceção, depois altera a chamada; GP tenta aprovar | GP vê o aviso de diário divergente e a aprovação é recusada: "O encontro ou diário mudou. Prepare uma nova solicitação para conferência." | (neg) |
| DIA-28 | GP | GP rejeita uma exceção com motivo | Encontro continua "Previsto"; o professor pode pedir de novo | |
| DIA-29 | GP | Abrir `/diario/encontros/<id>` de um encontro do PROF (sem designação) | "Sem designação vigente para regularizar esta aula." | (neg) |
| DIA-30 | PROF | Pendências: anotar lembretes; recarregar duas vezes seguidas; recarregar de novo depois do intervalo do DIA-02 (30 min) | Prazo = fim da aula + 60 min; no mesmo intervalo a contagem não sobe; depois do intervalo sobe 1 (não acumula lembretes atrasados) | |
| DIA-31 | GP | Pendências antes e depois do prazo de 60 min | Antes: lista sem "atrasada"; depois: "Prazo: … — atrasada". GP não tem "Abrir diário para regularizar" | |
| DIA-32 | PROF-2 | Pendências e Encontros | Não aparece nenhum encontro da turma do PROF | (neg) |
| DIA-33 | GP, PROF-2 | 1) GP: Regularizações de aula, designar PROF-2 para um encontro pendente, com motivo<br>2) PROF-2 abre a chamada pelo painel e salva<br>3) GP revoga<br>4) PROF-2 tenta abrir de novo | 2: salvo; o diário fica no nome do PROF (professor original)<br>4: "Sem designação vigente para regularizar esta aula." | |
| DIA-34 | PROF, GP | Em aula "Ministrado" (DIA-26): 1) PROF › Propor correção, trocando Falta por Presente, com motivo<br>2) PROF procura aprovar<br>3) GP confere impactos e aprova | Até a aprovação o histórico mostra o valor antigo; PROF não aprova; após aprovar, "Correção publicada · versão 1" | |
| DIA-35 | GP, ADM | GP propõe correção e tenta aprovar a própria; ADM rejeita com motivo | "Outra pessoa da gestão deve decidir a proposta, mesmo com acúmulo de papéis."; após rejeição a aula fica como estava | (neg) |
| DIA-36 | PROF | Propor correção sem mudar nada | "A proposta precisa identificar uma alteração na aula." | (neg) |
| DIA-37 | PROF | Encontro de turma: procurar "cancelar"; abrir `/diario/encontros/<id>/cancelamento` | Sem opção; a URL mostra "Escolha um encontro particular contratado." (#26) | (neg) [PO] |
| DIA-38 | SEC, GP | 1) SEC: nova versão do calendário com feriado sobre um encontro previsto; GP tenta aprovar direto<br>2) SEC prepara a revisão de replanejamento; GP aprova<br>3) SEC abre Secretaria › Avisos de alterações na agenda | 1: "Há encontros publicados. Revise os impactos…"<br>2: encontro remarcado<br>3: avisos "Preparado" ou pendência "Sem destinatário autorizado"; nada é enviado | |
| DIA-39 | SEC, GP | Acadêmico › Quantidade de aulas: SEC propõe aumentar de 3 para 4; SEC tenta aprovar; GP aprova | Autor não aprova; após aprovação a turma não concluída ganha 1 encontro | (neg) |
| DIA-40 | SEC | Acadêmico › Reposições: buscar a matrícula do aluno com Falta e a do aluno Presente da aula do DIA-26 | A falta aparece em "Solicitar a partir de ausência conferida"; o aluno presente não tem ausência elegível | |
| DIA-41 | SEC | Solicitar reposição por gravação com motivo e evidência; tentar solicitar de novo para a mesma falta | 1ª: criada "Aguardando autorização"; 2ª: "Esta falta já possui reposição pendente, autorizada, agendada ou concluída." | (neg) |
| DIA-42 | SEC, GP | SEC procura decidir; GP aprova uma e rejeita outra (de outra falta) | SEC sem decisão; aprovada vira "Autorizada"; na rejeitada a falta volta a ser elegível com aviso de pedido anterior rejeitado | |
| DIA-43 | SEC | Reposição particular autorizada: prévia de agendamento com PROF-2 e horário livre | Prévia: "Sem benefício normal vigente." e "A prévia não permite confirmar este horário." (#36/#37) | [DEV] [PO] |
| DIA-44 | GP | Reposição gravada autorizada › painel operacional › publicar material usando a gravação da aula original | Recusado ("A aula original não possui gravação oficial disponível…", porque a aula foi concluída por exceção). Sem prazo configurado: "Configure o prazo da primeira entrega…" | (neg) [DEV para Drive] |
| DIA-45 | PROF | Diário › Reposições | Sem designação de avaliador: fila vazia. Com designação (GP pelo painel): "Aguardando entrega gravada" | |
| DIA-46 | SEC | Pausar a matrícula de um aluno com falta elegível e abrir Acadêmico › Reposições dessa matrícula | "A matrícula não está ativa…"; sem formulário de solicitação | (neg) |
| DIA-47 | Aluno | Portal: abrir a reposição autorizada; trocar o ID na URL por reposição de outro aluno | Própria: "Autorizada" e "O material oficial ainda não está disponível…", sem campo de entrega; de outro aluno: página não encontrada | [DEV] (P5) (neg) |
| DIA-48 | PROF, GP, SEC, FIN | Abrir `/diario` | PROF e GP veem as abas do #52; SEC vê só Encontros; FIN: acesso negado | (neg) |
| DIA-49 | PROF, FIN | Abrir `/diario/encontros/<id>/gravacao` de uma aula concluída por exceção | Os dois veem "Gravação indisponível para este acesso." (sem acesso negado para FIN, #48) | (neg) |
| DIA-50 | PROF | Diário › Registrar aula: 1) num dia/horário passado sem encontro<br>2) no horário exato de um encontro publicado | 1: aceito como aula avulsa (#49) [PO]<br>2: "Identifique o encontro da agenda para registrar esta aula." | [PO] (neg) |

## Testes existentes por módulo

| Módulo | Unitários/SSR | Integração (banco descartável) | Destaques |
|---|---|---|---|
| `src/server/diario` | 9 | 12 | `diario.int.test.ts` (18), `correcao-aula.int.test.ts` (29), `avisos-diario.int.test.ts` (11), `reposicao-entrega-operacional.int.test.ts` (15), `reposicao-agenda.int.test.ts` (13), `regularizacao-designacao.int.test.ts` (6), `m01-chamada-historica.int.test.ts` |
| `src/server/agenda` | 13 | 10 | grade, replanejamento (adversarial, concorrência, avisos, sem remarcações), quantidade, cancelamento particular, substituição com avisos, finalidade |
| `src/server/gravacoes` | 13 | 3 | revisão fixa, stream autorizado, credenciais, troca de fonte (5), regularização docente |
| `src/server/turmas` | 3 | 3 | `integridade-academica.int.test.ts` (11, inclui conclusão), criação noturna Q47, idempotência |
| `src/server/comunicacoes-agenda` | 7 | 5 | avisos (4), reconferência (inclusive adversarial), pendências, consultas |
| `src/server/portal-aluno` | 9 | 16 | entregas (7), identidade, sessão, conclusão de reposições, envios |
| `src/server/avaliacoes` (frequência) | — | 3 diretamente ligados | `frequencia-integracao.int.test.ts` (3 critérios do plano de integração), `frequencia-nivel-tx`, `frequencia-reposicoes-historico` |
| `src/app/(app)/diario` | 19 | — | SSR/interação de páginas, abas, troca de fonte, reposições |
| `src/app/(app)/configuracao/turmas` | 5 | — | formulário, painel, página |
| `src/app/(app)/academico` (calendário, grades, reposições) | 14 | — | SSR |
| `src/app/portal-aluno` + `src/app/api/portal-aluno` | 17 | 1 | páginas e rotas |
| `src/app/(app)/alunos/turma` | 0 | 0 | sem teste da ficha da turma |
| `e2e/` (Playwright) | — | — | só acesso: Professor não abre Configuração › Turmas (`e2e/permissoes.spec.ts:102-103`); nenhum fluxo de diário, agenda ou reposição |

Nenhum desses testes é homologação em navegador; os registros de entrega (`docs/41`, quadro) dizem o mesmo ("sem homologação interativa").

## Só documentado (sem código ou sem tela)

- Cancelamento de aula de turma pedido pelo professor e reposição da turma escolhida na decisão (Q08, F07.3).
- Remarcação pontual de um encontro de turma.
- Exceção de duração/frequência por turma na criação (Q37).
- Substituição temporária de professor (Q56): só servidor.
- Configuração do benefício de particular por plano (Q14/Q49/Q50) e particular excepcional (Q34): só servidor.
- Abertura e conclusão de turma pela interface (Q48, doc 09 §3).
- Mínimo para abrir turma (doc 09 §3).
- Próxima aula na turma e na Home do professor (doc 09).
- "Reposta em [data]" no histórico do diário (Q10/Q55).
- Avisos reais por e-mail/WhatsApp, reprodução real do Drive e convite do portal por e-mail: implementados com transporte simulado e desligados; homologação externa pendente (quadro: VIDEO, EMAIL, N01).
