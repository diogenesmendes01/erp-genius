# #322 — vínculo transacional entre tarefa e atendimento

Fonte DEV: `b29b5f4d35c8c8a87f898b2cfef26b7d689e111e`.
Fonte da composição e QA independente:
`cea66f08343fe1b79ef14d70f8e17a88b3195ffd`.
Os sete arquivos de produção/schema/testes da #322 são objetos Git idênticos nas
duas fontes. A composição acrescenta #321 e B2, conforme as dependências.

`Tarefa.atendimentoId` é opcional. A criação humana valida a leitura do atendimento
na mesma transação e inclui o valor recebido no comando idempotente. Omissão
conserva o hash legado; mesma chave com atendimento diferente conflita. A Aria
persiste o contexto confiável do turno, incluindo tarefas sem oportunidade.
Não recebe um atendimento arbitrário do texto gerado. Edição e demais regras
vigentes de escopo/lead/pessoa/responsável permanecem preservadas.

## Validação terminal

| Responsável/fonte | Gate | Resultado |
|---|---|---|
| DEV /b29 | Integração | sessão78268, saída0; 4 arquivos/62 testes/173,05s |
| DEV /b29 | Unitário dirigido | 6 arquivos/43 testes, saída0 |
| DEV /b29 | TypeScript e lint dirigido | saída0; lint sem avisos |
| TESTER /cea | Inspeção exata independente | favorável; OIDs e autorização/idempotência/Aria/FK/índice conferidos |
| TESTER /cea | Unitário próprio | 6 arquivos/43 testes, saída0 |
| TESTER /cea | Integração própria | sessão53653/25856d, saída0; 4 arquivos/62 testes/207,57s |
| ROOT /cea | Unitário global | sessão57484, saída0; 904 arquivos/7118 testes/444,35s; maxWorkers2 |
| ROOT /cea | TypeScript após next typegen | sessão98957, saída0; heap8192 |
| ROOT /cea | ESLint global | sessão91254, saída0; 0 erros/40 avisos existentes |
| ROOT /cea | Integração #321/#322 | 95770, saída0; 5 arquivos/66 testes; 40708, saída0; 3 arquivos/22 testes |

Integrações usaram `vitest.integration.config.ts`, maxWorkers1, arquivos completos
sem filtro de nome ou skips adicionais e somente os bancos descartáveis de cada
responsável. As duas execuções ROOT cobrem oito arquivos/88 testes, não a suíte
de integração global. A primeira chamada tinha três caminhos incorretos; esses
arquivos não foram contados e foram executados depois nos caminhos reais de
`src/server/whatsapp` na sessão40708.

O RED inicial do DEV teve falhas causais da Aria e uma fixture CRM inválida de
finalidade/setor. Só a fixture foi corrigida e um segundo RED demonstrou as nove
falhas causais CRM antes da implementação. Detalhes e limites permanecem no
relatório DEV; a primeira execução não é apresentada como 17 falhas do produto.

## Migrations e preservação dos bancos

IDs exclusivos reservados pelo integrador: `20261023100000_tarefa_atendimento`
e `20261023110000_tarefa_atendimento_indice`. Coluna TEXT nullable, FK
RESTRICT/CASCADE e índice btree `(atendimentoId,status)`, válido/pronto.
CREATE INDEX CONCURRENTLY está em migration própria, sem bloco transacional.
O integrador comprovou a definição real; IF NOT EXISTS isolado não foi o aceite.

Uma tarefa criada antes do DDL no banco B permaneceu com vínculo null e foi
removida após a verificação. As duas migrations foram aplicadas nos bancos B,
ROOT e TESTER, todos com487; o banco A não foi migrado nesta issue.

A primeira geração Prisma TESTER atingiu timeout120s antes das migrations
(87694, saída1). Nova preparação com limite explícito360s terminou0 na sessão
64301, aplicando as duas migrations. Nenhum teste foi liberado antes de confirmar
o término e preservar os dados.

Snapshots E2 novos e separados dos históricos E1: B com424tabelas/1374registros,
TESTER com424tabelas/1388registros. No TESTER,04825a conferiu423tabelas originais,
com Tarefa comparada sem a coluna nova, e todos os dados foram preservados.
Após a QA, ROOT4df8ff terminou0: restauração E2 com todos os hashes e fixture
original conferidos. A restauração final do DEV B foi23337c, saída0. Não houve
banco de produção, transporte externo, envio de mensagens ou mudança do cluster.

## Limites e referências

Não há UI nova nesta issue. Campos extras de tarefa aprovados em D10 pertencem
às respectivas issues seguintes. Sem novo endpoint ou alteração dos contratos
de envio. B2 já aprovada foi preservada na composição.

O merge de main #393 em `d3110c07a3ec4c02c445b0cef4c4f6d329bd7fca`
preservou literalmente src/scripts/prisma/package/lock de cea. O conflito da
tipagem de cabeçalho manteve o Pick mais recente da E1; os gates não foram
repetidos por ancestralidade/documentação com executáveis idênticos.

SPEC: `docs/specs/inbox-tarefa-atendimento.md`. Relatório DEV:
`output/inbox-322-report.md`. QA: `output/inbox-322-review-tester.md`. Original
recebido do TESTER: SHA256
`0e8e7125807e43be43c14586c28c11c5421feb62dc81c835a188a128cb97501d`.
A cópia para Git remove somente a linha vazia extra no final, sem editar o
parecer; arquivo local normalizado:
`d6f6d70b41201106500572d0fe2ae0c3bb85865ff12d7ec7a645abd1663c1850`.
Operação: `docs/planejamento/inbox-e2-reservas-migracoes.md`.
