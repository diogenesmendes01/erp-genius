# QA independente — runtime #337 em 7d9

Fonte exata `7d9f565c3b840b64ec6b88dc4d2c4446a95803f5`, executáveis idênticos a `f971a9c84d1bf90981417f8c91f8ca1cffc773ea`, cuja estática independente está no parecer SHA256 `0A4EA772CF9AEA67A63426EFE3B83095286E63E440C62B3FC6CCBA67D3F3B2F2`. Parecer favorável aos recortes executados e à fonte nominal; nenhum blocker identificado nesses gates. Não é suíte global, nova homologação visual ou aceite da composição futura335→336→337.

## Ambiente, fonte e preservação

Checkout detached exato em f04199; schema contém490 migrações SQL. Antes de qualquer execução aguardei READY expresso do ROOT: perfiltester/banco descartável próprio490, restauro f1ebad/EXIT0/424hashes/9msgs4notas/snapshot337, generate30622/6c5712/EXIT0 e typegen/DMMFabaea3/EXIT0. Uma única suíte de integração por vez nesse banco. Não usei integracao487, A, B, produção ou cluster administrativo.

Inventário próprio8c9671→0ce165 confirmou213 pareceres privados preservados antes/depois do checkout, digest `1353eacaaffa184486f01eac9c7b872a2027fc5b6a17f2664f8cf5c998ba6aae`. Pós-gates08c42b/EXIT0 confirmou todos esses213 ainda iguais, um novo parecer offline326 e tracked limpo/HEAD7d9/perfiltester. Src/scripts/prisma/package/lock permanecem byte-identical af971; só quatro MD/JSON mudaram no freeze7d9. Diff-check0.

Preflight textual administrativo preservado: o scriptNode de dafed3 acusou schema físico diferente; o comando composto terminou0 depois de gitstatus, portanto não foi contado como gate. bccc8a mostrou alinhamento de colunas/formatação e37a2bf teve parser inicial incapaz de reconhecer três models indentados. 6e4027 comparou550blocos sem diferença de campos/atributos; a prova oficial ROOTd44020/EXIT0 formatou uma cópia privada do meu schema com Prisma5.22, obtendo igualdade textual ao client físico. Não houve alteração da fonte, DDL ou generate adicional pelo TESTER. Esses diagnósticos não são RED de produto.

## Gates próprios e comandos

Nodev22.23.2/executáveis locais; Vitest local4.1.11. Usei as listas exatas do JSONcurado7d9 `output/inbox-337-evidencias.json`, seção gatesPreparacaoLimpa20261024. Os arrays UNIT46, INT5 e lint24 foram lidos com Get-Content -Raw |ConvertFrom-Json e expandidos como argumentos; nenhum filtro -t ou skip. Comandos executados:

- UNIT: `node node_modules/vitest/vitest.mjs run @recorteUnit337 --maxWorkers=2`.
- INT: `node node_modules/vitest/vitest.mjs run -c vitest.integration.config.ts @recorteInt337 --maxWorkers=1`.
- TSC: `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Lint: `node node_modules/eslint/bin/eslint.js @recorteLint337 --max-warnings=0`.

| Gate | Sessão / terminal | Resultado próprio |
| --- | --- | --- |
| UNIT | 24135 / 9677c0 | EXIT0, **46 arquivos/783 testes**,50,80s |
| INT | 48615 / e1073a | EXIT0, **5 arquivos completos/46 testes**,232,03s;226,98s testes |
| TSC | 9209 / fce50f | EXIT0, nenhum diagnóstico; --noEmit/incrementalfalse/heap8192 |
| Lint | b33ad1, já concluído | EXIT0,24 arquivos, zeroavisos; sem sessão pendente |

As sessões foram preservadas e acompanhadas até terminal; silêncio intermediário não foi tratado como aprovação. UNIT inclui domínio/rota/sino/compositor/caret/scroll/rascunhos/guardas/schema/harness da base; configuração unitária exclui *.int. INT executou cinco arquivos reais completos: `src/server/whatsapp/nota-mencao.int.test.ts`, `nota-interna.int.test.ts`, `inbox-idempotencia.int.test.ts`, `src/server/crm/notificacoes.int.test.ts` e `lembretes.int.test.ts`. Sem filtro de nome ou testes ignorados nos resultados. Não chamo recorte de global ou somo repetições DEV/TESTER como casos distintos.

GlobalSetup padrão só validou status de migrações read-only; nenhuma aplicação de schema ou comandoPrisma manual pelo TESTER. Testes automatizados usaram exclusivamente o banco descartável sob lease; não são novo submitUI/manual nem nova prova visual. Avisos herdados vite-tsconfig-paths/MIXED_EXPORTS não levaram a alteração de tooling/config.

## Liberação e limites

A sessão48615 terminou em e1073a/0 e o bancoTESTER490 foi expressamente liberado ao ROOT para restauro antes deste parecer. Não fiz restauro nem deixei executor de bancoT ativo. Sem instalação/generate/DDL/cluster, UI/nota manual, browser/HTTP externo, preview, recaptura, envio real, push, PR ou merge.

As imagens337 permanecem nominais38d68+2ACKab76, com limite de placeholder/IME e orçamento8positivas+2negativas já esgotado; nenhum gate deste parecer as reatribui ao7d9. A inspeção offline32639PNG ocorreu em paralelo apenas por leitura de arquivos, com parecer e limites próprios; não se executou sua fonte com este client490. Ancestralidade integrada final, regressão global, CI/merge/publicação e aceite final das issues continuam separados.
