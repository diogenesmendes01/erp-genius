# PR416 — parecer independente final R1

**Favorável ao delta C2/C3/C4/C5/C6 na fonte exata `ecc92d4781c5fe0f94f06920442769e8ad37b999`, sem bloqueio identificado no recorte revisado.** Árvore Git `d9039ff57475f089bb8e003fddc8cf6776f63b7f`. Gates próprios finais: **30 arquivos/431 UNIT, seis arquivos completos/53 INT, TypeScript e lint11, todos EXIT0**. Não é regressão global, homologação visual ou autorização de publicação/merge.

## Fonte, ambiente e preservação

Preflight17c209 EXIT0: checkout exato detached no worktree TESTER, perfiltester, schema490 Git OID `7365328d336ff6ae5892e46f1e595f25923e3f1e`, tracked limpo e inventário dos1.031 arquivos privados anteriores. Nenhuma fonte foi alterada durante os executores. A preparação ROOT READY490 registrou generate64461/d6e53f EXIT0 (65,83s), Next/typegen e comparação física com cópia oficial formatada490; restauro679a75 EXIT0,424hashes/9mensagens/4notas. Essas operações são evidência do ROOT, não geração/DDL pelo TESTER.

2cd184 EXIT0 confirmou os quatro blobsC2 idênticos a540fa42f, os seteC3/C4 idênticos a d38c7811268e58f488a27bc18f59ed3ca7ae2196 e schema/migraçõesSQL/scripts-harness/package/lock inalterados contra419b. Dos sete blobs observados antes no freezeA, somente o UNIT mencoes.test.ts mudou para acrescentar cobertura; os três executáveis e as duas INT permaneceram idênticos. O extrator legado extrairMencoes foi conferido byte a byte em LF contra419b e permanece intacto.

Manifesto próprio dos11 paths: output/inbox-337-r1-final-fontes-tester.json,2.999bytes, SHA256 `3EF59C4B9E74EF8361AFFC811F0A5087AF5CDC5B84F9C453D8FF06E48AC28CF5`. Os hashes GitLF estão abaixo para que este parecer seja autossuficiente.

| Path R1 | SHA256 do blob GitLF |
| --- | --- |
| `src/app/(app)/inbox/ConversaAberta.mencoes.interacao.test.ts` | `6c29cfa15ffff82dfd2c2bc5325ed9e5819af31f8b7a5d3dec901c40d767e811` |
| `src/app/(app)/inbox/ConversaAberta.tsx` | `74a199b54219bad5e8c39c6638f7383bdc24003b025f31329216017877e62d73` |
| `src/components/conversa/Compositor.mencoes.interacao.test.ts` | `92e4dde72165a5a944cbcd99922716f82712ba713ca3e41869784800a35362a7` |
| `src/components/conversa/Compositor.tsx` | `7f8794a9a4db12ced7cae3ab1a3ef8f858540500c5e224735c746565de9ed956` |
| `src/lib/mencoes-nota.ts` | `f17df300feabdcc17146e436fda24a7a41276154a8518dda8f45d207b13b5842` |
| `src/server/crm/notificacoes-mencoes.test.ts` | `0403280f43a6dffb0f471fb2250570085afbcd72a9d54ef28a377bdf766bb657` |
| `src/server/crm/notificacoes.ts` | `c9d3949c09610db0aa9988270a45b0bdf29ca80311aa5855757dc2ba384b1277` |
| `src/server/inbox/mencoes.test.ts` | `86a2a254bab65ef731ca094ba092c6569ad7e6282414c13556f4d0cc8cf4831a` |
| `src/server/inbox/mencoes.ts` | `4f4fdcd8302e7570987d84ac5d0a0280ce0c33742dea4868e75f74dad352ec81` |
| `src/server/whatsapp/nota-mencao-pool1.int.test.ts` | `de3d550b25fc711794fae85fdaae6a382d763a0db82ebd3219104df0f9144a16` |
| `src/server/whatsapp/nota-mencao.int.test.ts` | `0515edb43c93913062d04e9ab474144b38344e0e9ad873372766b1ea37cf388b` |

## Execuções próprias finais

Executável em todos: `C:/Users/Mendes/AppData/Local/hermes/node/node.exe`.

| Gate | Sessão/início → terminal | Resultado |
| --- | --- | --- |
| UNIT frontend+domínio, recorte único | 8605/69cdf7 → f4840a | EXIT0,30arquivos/431testes,20,46s |
| INT seis arquivos completos | 43384/0e00d3 → 7d1293 | EXIT0,6arquivos/53testes,221,10s; testes215,31s |
| TypeScript | 34056/1862a1 → 678604 | EXIT0,sem diagnóstico |
| ESLint11 pathsR1 | 485fed | EXIT0,zero avisos |

Comandos após o executável Node:

```text
node_modules/vitest/vitest.mjs run src/components/conversa/ 'src/app/(app)/inbox/ConversaAberta' 'src/app/(app)/inbox/RodapeConversa' src/app/feedback-separado.test.ts src/app/estados-vazios.test.ts src/components/EstadoVazio.test.ts src/lib/mencoes-nota.test.ts src/server/inbox/mencoes.test.ts src/server/inbox/consultas-mencoes.test.ts src/server/crm/notificacoes-mencoes.test.ts --maxWorkers=2

node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts src/server/whatsapp/nota-mencao.int.test.ts src/server/whatsapp/nota-mencao-pool1.int.test.ts src/server/whatsapp/nota-interna.int.test.ts src/server/whatsapp/inbox-idempotencia.int.test.ts src/server/crm/notificacoes.int.test.ts src/server/crm/lembretes.int.test.ts --maxWorkers=1

--max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --incremental false
node_modules/eslint/bin/eslint.js <11 TS/TSX do diff419b..ecc listados na tabela de fontes> --max-warnings=0
```

Sem -t ou skips nas saídas; os seis arquivos INT foram completos, uma suíte por banco, mesma sessão acompanhada até terminal0. Avisos herdados vite-tsconfig-paths e MIXED_EXPORTS da configintegration mantidos. Banco TESTER490 liberado ao ROOT somente após7d1293; restauro posterior cabe ao integrador e não é presumido neste parecer.

Prova C2 anterior, separada e nominal a1a99919f: dois completos/20 c27455 EXIT0(846ms);26completos/376 sessão6370/058141 EXIT0(18,52s); TSC2343/6b6c26 e lint4/16e6ae EXIT0. Esses dois arquivos estão dentro dos26, que também estão dentro dos30 finais. Não somar execuções como arquivos/testes distintos, nem atribuir gates DEV/ROOT ao TESTER.

## C2 — aquisição e contexto

ConversaAberta estabiliza buscarMencoes por ID primitivo do atendimento com useCallback incondicional. Mantém URL codificada, URLSearchParams, no-store/same-origin e repassa AbortSignal opcional. Re-render do pai com mesmoID não reinicia a busca; trocarID altera destino. Compositor espera200ms da última consulta; cleanup limpa timer, aborta o GET em voo e invalida resposta mesmo se o consumidor ignorar signal.

Arquivos completos verificaram199/200ms, última consulta, Escape antes do GET, URL/signal, rerender do pai, troca de conversa e resposta antiga; os recortes também conservam caret pós-commit, rascunho, Enter/IME/Tab, owner/revisões e ACK A→B→A. Não houve nova prova visual/nativa desses fluxos.

## C3 — ACL em fases e equivalência da união

Grupos lexicais conservam todos os membros dos aliases completos/primeiro nome, em comprimento decrescente, com normalização/limites do parser original. Tokens são mascarados antes da análise livre. Sentinel201 decide completos ANTES dos grupos; amostra truncada não se torna nome único após filtro. Mapa final une relevantes+selecionados porID; tokens selecionados sempre recebem ACL e validação original posterior, preservando mismatch visível→erro/rollback e revogado→sem aviso/fallback indevido.

Cache true/false é local porID nesta invocação/tx. AtendimentoVisivel(p,id,false,tx) continua a regra de leitura; não se usa escopo do autor, prisma global ou permissão nova. Todos os membros do grupo são verificados antes de parar no primeiro com>=1 autorizado, inclusive ambíguo. Só nenhum visível permite descer ao alias curto.

A uniãoU de autorizados é subconjunto do conjuntoS de ACLtrue e contém todos os membros visíveis do maior alias de cada ocorrência. Nenhum grupo superior ficou sem checagem. Outras ocorrências só acrescentam membros deS, sem criar alias maior omitido ou completar uma ambiguidade antes incompleta. Por isso a chamada final ao extrairMencoes original preserva resolução e ambiguidade entre visíveis.

O novo diferencial executado cobre128subconjuntos de sete pessoas ×12textos ×3ordens específicas =4.608 comparações dentro de um caso Vitest; não são4.608 testes independentes nem todas as entradas possíveis. Inclui selected também citado livre, repetição, longo oculto→curto visível e homônimos. Reforços pedidos na revisão estática entraram: grupo longo ambíguo consulta exatamente a,b sem curta; cache não consultaID duas vezes; token incompatível e sentinel201 preservados.

Ganho depende do texto: caso nominal com200 candidatos reais/nome completo consulta um destinatário; @Ana livre pode continuar com200ACLs. União com50tokens pode chegar250IDs. Não há promessa de lote/custo constante. INT reais cobrem ACL/revogação, idempotência, rollback, aviso/NOTIFY e clientpool1 exclusivo do arquivo, sem nova conexão global dentro da tx.

## C4 — lazy sem mudar paginação

Escopo é Promise memoizada somente nesta invocação e resolvida no primeiro lote com referência MENCAO_NOTA/AtendimentoWhatsApp válida. Vazio, SLA/lembrete e refTipo inválido não pedem escopo. Nova chamada recalcula, permitindo revogação. Permanecem lote100, cursor estrito criadaEm/id, última linha SQL examinada, ordem original, IDs deduplicados/ACL batch por página e busca até20visíveis ouEOF, sem cap global.

UNIT/INT completos cobrem escopo zero para casos sem referência, primeiro lote relevante tardio, revogação entre chamadas,205revogadas até os20visíveis, empates/cursor e contratos legados. Não se atribui acesso de um usuário a outro.

## C5/C6 — rastreabilidade e históricos

D20 do índice foi alinhado à decisão humana aprovada, sem confundir aprovação com homologação. SPEC liga os três nomes do checklist aos casos existentes, sem duplicá-los. A nota SQL conserva índice único parcial manual nas mesmas quatro colunas/predicado tipo<>MENCAO_NOTA, antes da retirada do global; não houve migração/DDL nova.

Os dois legados foram reduzidos a índices com links imutáveis9fa, bytes/SHA/blob do conteúdo GitLF, mantendo completo o objeto gatesPreparacaoLimpa20261024 e arrays46/5/24 para o consumidor PowerShell documentado. DeepEqual ao9fa e hashes/URLs contra objetosGit/remote foram conferidos, sem alegar downloadHTTP. Os três blobs C6 permanecem iguais a c0aef9b9. Pareceres originais/allowlists/hashes não mudaram; nenhum arquivo privado foi apagado.

## Negativos e limites

Nenhum dos quatro gates próprios finais falhou. RED C2 cf09e8 e RED C3 d95366 pertencem ao desenvolvimento original, não são REDs independentes desta rodada. Negativos históricos, inclusive recorte6/58 com12falhas, filtro de zero testes, diagnósticoSLA/fixture temporal e TSCheap134, continuam recuperáveis no9fa e explicitados nos índices; não foram reclassificados como verdes.

As40 imagens seguem nominais:38d68+2ACKab76. Não há recaptura da integração9fa/R1, validação de todos os IMEs ou promessa de cabimento integral do placeholder. Oito notas positivas/duas negativas manuais esgotaram a autorização; esta QA não criou nota manual/UI, Save, browser/HTTP de produto ou envio externo. As notas automatizadas das INT pertencem ao banco descartável autorizado.

ZIP permanece privado/DRAFT; upload/anexoPR está bloqueado pela revisão automática, com pergunta específica ao usuário sobROOT. Nenhuma publicação/reenviar por outra via decorre deste parecer. Não executei install, Prisma/generate, DDL, cluster, push ou merge. C1workflow, regressão global ROOT, CI e decisão final de integração/publicação são provas separadas do integrador. Este parecer não substitui essas etapas.
