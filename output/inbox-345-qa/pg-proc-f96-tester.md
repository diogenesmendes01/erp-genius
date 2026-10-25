# QA causal #345 — inventário pg_proc no commit f96cb2cb

Favorável à correção mínima do oráculo. O RED e o GREEN foram observados no TESTER492 exclusivo, com o mesmo arquivo completo, configuração original e nenhum DML/DDL. Não é uma nova suíte global ou homologação da composição inteira.

Fonte GREEN exata: f96cb2cbf4c9497baf6e030d1d106a8254cfb3b1; pai b5ef8d61e8c3ac27a0ed683e3686a6e0514ce711. Checkout próprio autorizado61518d EXIT0, tracked limpo/perfiltester/cliente490 preservados. O banco já tinha migration492 aplicada pelo ROOT; não executei migração, instalação ou restauro.

## Causalidade e identidade

O arquivo src/server/whatsapp/pg-proc-whatsapp.int.test.ts em ownf948 tem blob2936af27c48b51d7de87a59a1f18175af8af153f, literal igual ao11f913f2 e ao pai b5ef. Ele contém um caso e duas consultas SELECT: inventário de funções e triggers desabilitados. O comentário existente exige acrescentar nomes novos em NOVAS a cada migration.

O commit muda somente esse arquivo e quatro linhas do quadro. No teste, o único delta adiciona notificar_inbox_acao_ia a NOVAS. A reversão textual dessa adição recompõe integralmente o blob anterior; query, igualdade exata toEqual, BASE, HASH_BASE e asserts de triggers permanecem literais. Novo blobbef48194f874ddc1a8c281746ea051bca3476e39. Prova própria a47c7b EXIT0 em output/inbox-345-pg-proc-f96-resultados-tester.json.

## Execução própria

Comando em ambas as fontes:

    Node22 --max-old-space-size=512 node_modules/vitest/vitest.mjs run src/server/whatsapp/pg-proc-whatsapp.int.test.ts --config vitest.integration.config.ts --maxWorkers=1

- RED em f948/blob2936: b91d0b EXIT1,1arquivo/1caso falhou,3,97s; esperado7nomes/recebido8, único item adicional notificar_inbox_acao_ia. Como falhou na primeira igualdade, os asserts seguintes de HASH_BASE/triggers não foram alcançados nesse RED.
- GREEN em f96/blobbef4: sessão75031/start32d83c, terminal5c0ba1 EXIT0,1arquivo/1caso aprovado,9,38s (468ms do teste). Alcançou igualdade dos oito nomes, hashes de BASE realmente assertados pelo arquivo e triggers ativos. O teste historicamente exclui guard_identidade_destinatario_aviso_agenda do loop de hash; não alterei nem amplio essa cobertura por inferência.

Sem filtros, skips, aumento de timeout ou troca de configuração. Advertências existentes de export misto e vite-tsconfig-paths foram preservadas nos logs; não são falhas dos testes. A mesma sessão GREEN foi acompanhada até terminal0.

Logs preservados:

- output/inbox-345-pg-proc-red-f948-tester.log:1777bytes/SHA256835d558e45dce4f32747ba9a2fc7ae84bfccab9fe66dedb198457a253b8e81d1.
- output/inbox-345-pg-proc-green-f96-tester.log:805bytes/SHA256c67b8ce8818cdee1b848103a6667e383936dc1dcece15acbc2e1032644acba41.

## Escopo e limites

O teste observa o catálogo PostgreSQL e a configuração de triggers; não exerceu nova transação de negócio, provider ou entrega SSE. Não executei UNIT/global/TSC/browser/HTTP/native, não consultei outro banco e não modifiquei SQL, schema, função, snapshot ou dados.

Banco TESTER492 explicitamente liberado ao ROOT após5c0ba1, sem executor ativo. Não atribuo restauro/auditoria de424hashes ao TESTER: não os executei. O integrador controla qualquer conferência posterior com o helperT492, nunca o antigo491.

As provas V3 #328 e geral #350 e seus negativos anteriores continuam privadas e preservadas. A composição345+344 terá parecer estático separado; os testes antigos e CI da11f não viram automaticamente gates da árvore f96.
