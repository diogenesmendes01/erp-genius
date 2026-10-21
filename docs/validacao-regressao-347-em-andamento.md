# Regressão 347 — acompanhamento histórico, execução concluída

Data: 14/09/2026. A execução completa de integração foi iniciada no banco descartável localhost:54329, com arquivos sequenciais. Não iniciar outro processo de integração enquanto esta execução estiver viva.

- Sessão de execução: 14199. Usar write_stdin para acompanhar; a ausência de novas linhas não indica término.
- Unitários concluídos: 825 testes em 89 arquivos, todos aprovados. Evidência: validacao-regressao-unitarios-347-2026-09-14.json.
- Integração: resultado final ainda pendente. Relatório JSON será gravado em validacao-regressao-integracao-347-2026-09-14.json ao terminar.
- Parciais já observados: reserva-vaga (67) e avaliações/lancamentos (53), aprovados.

## Lacuna estrutural confirmada para implementação após a regressão

A migration 20260622120000 mantém AlocacaoTurma_alunoId_ativa_key. A migration 20260910010000 mantém explicitamente esse índice até migrar os consumidores globais. ativacao-preparacao-tx.ts também bloqueia uma segunda alocação por aluno. Isso ainda impede cumprir integralmente REQ-01/Q102 para contratos simultâneos em turmas.

O fluxo global antigo em alunos/acoes.ts encerra todas as alocações ativas e muda o cadastro inteiro. limite-legado.ts bloqueia esse fluxo quando existe movimentação contratual registrada ou matrícula pausada; não bloqueia somente por existirem contratos ativos independentes. Antes de liberar múltiplas alocações, é necessário revisar esse limite e os consumidores de situação global, transferência, diário, consulta e retomada, com testes que preservem o contrato não selecionado. Não basta remover o índice.

Este registro é acompanhamento parcial; não comprova regressão integral nem conclusão do objetivo.

## Mapeamento adicional durante a execução

- academico/estado.ts aceita matriculaId e restringe alocações/contratos quando informado. academico/regras.ts exige exatamente uma alocação no escopo, mas ainda exige Aluno.status ATIVO. A consulta não deve selecionar silenciosamente o primeiro vínculo quando houver mais de um.
- A página alunos/[id]/academico já apresenta seleção de contrato. A lista de solicitações ainda é consultada por aluno mesmo com matrícula selecionada; revisar a coerência do filtro sem ampliar acesso docente.
- O índice mudanca_academica_uma_aberta_por_aluno (20260908060000) também limita pedidos independentes por contrato. Precisa ser migrado junto com o fluxo, preservando tratamento explícito do legado sem matrícula.
- diario/consultas.ts já distingue matrícula ativa/pausada de vínculo legado dependente do status global. Isso é evidência parcial; não prova toda a chamada histórica nem todos os consumidores.
- Resultados adicionais observados: fluxo acadêmico (55), retomada (36), condições por hora (23), aprovados. Total parcial observado: 234 integrações. Execução ainda ativa na sessão 14199.

## Resultado final

Sessão 14199 concluída com exit code 0: 701 integrações/53 arquivos, sem falhas, em 812,07 segundos. A sessão não está mais em execução. Os registros de andamento acima são históricos. Unitários: 825/89 arquivos aprovados.
