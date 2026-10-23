# QA independente #323 — 0c61fb628ad3a2c63b1963f943b6d8e159c9b9b2

Parecer favorável ao backend #323 no SHA corrigido. O P2 encontrado na fonte nominal `6076cd818fc397d0aedc6059e09ecac775255edc` foi corrigido e rechecado: o catálogo de tags só é consultado quando há pessoa autorizada e capacidade editarTags.

## Fonte e revisão

- Worktree TESTER destacado em `0c61fb628ad3a2c63b1963f943b6d8e159c9b9b2`, perfil `tester`, rastreados limpos. Dois relatórios privados que colidiam no checkout inicial foram preservados com hashes idênticos em `output/qa-private-history/checkout-323`; nenhum código DEV foi editado.
- O commit nominal #323 não altera schema, migrations, package, lock ou scripts. A nova rota /painel/[aba] exige sessão e papel antes de validar aba ou consultar domínio; inválida400, foraescopo404, Detalhes autorizado200/no-store, futuras oportunidades/atividade404 sem produtor.
- `contextoPainel` restringe atendimento antes da ficha. No lead comercial autorizado usa a pessoa principal salvo responsável legal; só sem lead busca a pessoa do contato sob `escopoPessoas`. O Db opcional passa pela autorização na mesma transação. Interlocutor B2B é pessoa do contato se participante autorizado, distinto da principal. DTO monetário usa valor decimal em string e moeda do país/null; outros setores não recebem dados de pessoa. A consulta SQL da marca IA projeta apenas campoId/autorId do último evento por pessoa/campo com ordem estável, sem payload completo.
- P2 nominal: `tagsDisponiveis` usava apenas `capacidades.editarTags`. Com lead visível sem pessoa ou responsável legal, o catálogo ativo era consultado e devolvido apesar de `pessoaId:null`, contrariando a SPEC. O delta corrigido é somente `pessoa && capacidades.editarTags` em produção e dois arquivos de testes. O teste unitário afirma ausência de consulta; a integração cria catálogo ativo não vazio e confirma `tagsDisponiveis:[]` nos dois casos, preservando a projeção `editarTags:true`. Nenhuma matriz de permissões mudou.

## Execuções próprias

- Fonte nominal 6076: Node 22, Vitest unitário/rotas em seis arquivos completos, **33/33 testes, exit 0**, chunk `84dd04`. Inclui Detalhes, dispatcher, tags, passagem de Db e rotas E1/E2.
- Fonte nominal 6076: banco descartável exclusivo `tester` com schema 487/snapshot E2 preparado pelo integrador, `vitest.integration.config.ts`, `--maxWorkers=1`, transportes externos vazios, três arquivos completos `painel-detalhes.int.test.ts`, `paineis.int.test.ts` e `paineis-envio.int.test.ts`: **26/26 testes, exit 0**, sessão executor **43688**, chunk `56246c`, 110,07 s. Sem filtros/skips nessa execução.
- Fonte corrigida 0c61: `paineis-tags.test.ts` completo **11/11, exit 0**, chunk `2b2e3c`. Integração dirigida `painel-detalhes.int.test.ts -t ''catálogo de tags exige identidade autorizada''`: **2 passaram, 11 filtrados/ignorados, exit 0**, chunk `7f2ee1`, 8,71 s. Esses dois casos cobrem semPessoa e responsável legal com catálogo não vazio. O banco foi liberado ao integrador após o terminal; não fiz restauração.
- Inspeção do delta 6076→0c61 e `git diff --check`: somente `painel-detalhes.ts`, `paineis-tags.test.ts` e `painel-detalhes.int.test.ts`, sem outro arquivo produtivo.

## Limites

Não repeti a suite completa nem o global após o patch de uma guarda; os 11 casos filtrados na rechecagem não são contados como aprovação nova. TSC/lint, migrações, verificação física de índices/DDL no catálogo do PostgreSQL, smoke de bundle, browser e futura UI E2 pertencem aos respectivos executores e não são atribuídos à minha QA. Este parecer cobre apenas o SHA exato 0c61.
