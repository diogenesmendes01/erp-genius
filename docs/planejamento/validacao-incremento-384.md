# Incremento 384 — retomada e paginação das reposições

Data: 14/09/2026.

A meta foi consultada e consta como ativa. As três frentes Terra seguem em andamento: agenda/benefícios de reposição, identidade do portal do aluno e consultas/interface de reposições.

Foi acrescentada uma verificação de integração para percorrer as ausências elegíveis com cursor independente dos pedidos, preservando a aula anterior sem repetição ou perda de registros.

Validação executada: `src/server/diario/reposicao-permissoes.int.test.ts`, sete testes aprovados. Relatório: `../validacao-consulta-reposicoes-384-2026-09-14.json`. A execução inclui isolamento de contratos, permissões atuais, histórico de matrícula pausada, correções aprovadas e paginação.

Esta validação não constitui regressão completa nem conclusão da SPEC. Agenda/benefícios e identidade permanecem em desenvolvimento; suas migrações ainda estão em rascunho, sem aplicação em produção. Está em revisão o filtro de origens com pedidos anteriores para preservar novas tentativas autorizadas conforme Q51.
