# PR #406 — conclusão E1 e comentários da revisão

Fonte95fb5e23c017b5c664136d517c4518cc498e14ae, pais8a67cfe1 (cherry-pick SOMENTE d36fe200 sobre1bb) e4053bd14252. O pai futuro323 de d36 não foi incorporado. No conflito do cherry-pick, o quadro local foi mantido e somente as13linhas da entrada406 foram acrescentadas; arquivoINT e relatório são iguais ao patch original. O merge405 preserva ambos os lados de um bloco do quadro. Provas22c71e/47ec52 terminais0, sem antecipar DDL E2.

C1 MEDIUM: composição com pais/main preserva QA280, planejamento297, B2 e todas as correções anteriores. Publicação aguarda405main, CI final em dois fusos e revisão fresca. C2 MEDIUM: a tabela do corpo continua explícita,20estados/100APP/64referências/36N/A, com diferenças justificadas e limites independentes de thread/painel; não foi removida em favor de link genérico. ZIP320 e fontes originais preservados.

C3 LOW: remove somente o caso puramente formatador duplicado de eventos-sse.int.test.ts; a negativa estrutural de paraUsuarioId e IDs públicosu9 continua nos oito casos unitários. Os dez casos reaisINT de escopo/revogação/TTL/destinatário/grupos/formato permanecem. C4 LOW: inventário13saídas (7JSON13046linhas/6MD209linhas) avaliado e mantido por auditoria de aceites320/fontes/hashes, sem novo PNG/dump/credencial/probe.

## Gates próprios da composição

- Unitário15042f terminal0:5arquivos/117testes, America/Sao_Paulo, maxWorkers2. eventos-sse.test.ts, useEventosInbox.test.ts, InboxNovo.interacao.test.ts, InboxNovo.test.ts e dependencias.test.ts. Sem filtro de caso/skips novos; não é global.
- Integração21775/5d3e46 terminal0: eventos-sse.int.test.ts inteiro,1arquivo/10testes,33,05s, America/Sao_Paulo, maxWorkers1, configintegration. Perfil exclusivo ci-integracao/erp_genius_test_ciint em localhost54329, sem suíte simultânea. Setup apenas verifica migrations; nenhum cluster, instalação, migração ou provider real foi alterado/acionado. A redução11→10 é intencional; não é suíte completa de DB.
- Next typegen/TypeScript67467/e912cc e lint global73890/0539f3 terminais0, zero erros/40avisos herdados.
- ProdutorSSE/escopo/schema/migrações iguais8a, patchINT iguald36. Compositor403, busca402/Shift, thread398, Pick401 e manifestos/B2 iguais ao pai405; nenhum contrato foi substituído pelo antigo harness307.

QA independente do patchd36 favorável: teste unitário SSE inteiro1/8,02325f terminal0, inspeção de cobertura/identidade; não executou DB/INT nessa QA. Original SHA256 90c44235b2fab77c82b7e8d8955497cbd80564ec6d732f6214723c29317a2418, em tester-patch-d36.md com apenas EOF normalizado. Os10INT do ROOT em seu snapshot487 permanecem nominais àquele patch, separados da execução própria acima.

QA composta, squash405main e CI final ainda pendentes. Global904/7.103 e264PNG320 pertencem às suas fontes históricas;14pares idênticos foram declarados no aceite, sem nova equivalência visual inferida aqui. Nenhuma nova captura, seed, envio real ou deploy.
