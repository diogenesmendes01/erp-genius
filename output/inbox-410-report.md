# #410 — claim SLA independente do fuso da conexao

Branch propria: codex/inbox-sla-fuso-410. Base congelada #337: 9a9bfdc8a74cb6d2abc8487fd8b1fb766066aec2. Issue https://github.com/diogenesmendes01/erp-genius/issues/410 lida pelo conector GitHub read-only; criterios compatíveis com a atribuicao do integrador. Sem operacao remota de escrita.

## Causa e delta

Produtor anterior blob 9a16145433dfa241829488441d7f9bdb1916541b, igual ao diagnosticado antes de337. Colunas TIMESTAMP(3) UTC-sem-fuso comparadas/atribuidas com parametros Date timestamptz sofriam a interpretacao de TimeZone. Diagnostico previo TESTER em output/inbox-sla-fuso-investigacao-tester.md foi leitura; este report acrescenta prova PostgreSQL executada.

Somente tres parametros no SQL de src/server/whatsapp/alertas-sla.ts recebem (::timestamptz AT TIME ZONE 'UTC'). Novo blob bbe2e40f27f67c2f55cfef2e15e5cef3af734290. NOT EXISTS/Aria, janela, destinatarios, claim, eventos e API inalterados. Schema e migrations337, scripts, deps/package/lock e fuso global sem delta para a base. Nenhuma nova DDL, Prisma generate, instalacao ou envio pelo DEV.

## TDD real e cronologia

Antes de alterar o produtor, novo arquivo src/server/whatsapp/alertas-sla-fuso.int.test.ts com 4 casos parametrizados. Wrapper apenas no teste delega callback/SQL reais, aplica fuso local dentro da propria transacao, confirma fuso e PID antes/depois e usa finally/mockRestore. Nenhum retorno de SQL e fabricado. A consulta tipada confirma valor timestamp bruto gravado dentro dessa conexao; o Date Prisma e conferido depois.

RED sessao 86523: terminal 1, 12,78s; 4 casos/2 passes UTC/2 falhas SP. Janela esperava3 alertas e recebeu2; Aria enviada depois do prazo esperava1 e recebeu0. Sao falhas causais de assertions reais, nao fixture/import. O primeiro teste tambem protege IDs exatos, limites 1ms, segunda execucao, notificacoes/eventos e SET UTC; o caso Aria preserva a comparacao entre colunas. Nao chamar este RED de verde.

Depois do terminal RED, aplicados exatamente os tres parametros. Fonte mantida imovel durante GREEN/TSC/lint/unit. O proprio teste nao mudou entre RED e GREEN.

GREEN sessao 77354: config vitest.integration.config.ts, --maxWorkers=1, dois arquivos completos (alertas-sla-fuso4 e alertas-sla14), 18/18, terminal 0, 64,58s. Sem -t, filtros ou skips. Suite legada inclui concorrencia/replay, respondido/encerrado, Aria no prazo/depois/fila/status, responsavel/gerentes/admin e janela. Nao e suite global.

Recorte unitario: execucao 51a714, 5 arquivos/57 testes, terminal 0, 3,33s, maxWorkers 2, sem filtro/skips: alertas-sla.test.ts, api/whatsapp/cron/route.test.ts, schema-sla.test.ts, dependencias.test.ts e identificacao-registro.test.ts.

TSC sessao 33847: TypeScript noEmit/incremental, heap8192, terminal 0 apos GREEN; cache privado output/inbox-410-private.tsbuildinfo. Lint 52987b: somente produtor e novo teste, max-warnings0, terminal 0/zero avisos. MIXED_EXPORTS e vite-tsconfig-paths preexistentes mantidos; nenhuma configuracao relaxada.

## Evidencias privadas

Logs nao entram no Git/ZIP:

- output/inbox-410-red-private.log — SHA256 2837664795af89cc9ef1e406730024c16df418dadf22d594e876506e1ee9f81b.
- output/inbox-410-green-private.log — SHA256 796fc9d221320791772813c0ac832c414115268e0cb5975d6091b3651d97b48a.
- output/inbox-410-unit-private.log — SHA256 2795879e5ea8680bc57212dc43312d94d1f9bea474661f613653a9f28807adb2.
TSC/lint nao emitiram diagnosticos; os terminais 0 foram observados, sem inventar log vazio.

## Ambiente, isolamento e limites

Perfil dev-gravacoes/banco B 490 exclusivo, cliente 490 preparado antes pelo ROOT, sem preview/browser. Uma invocacao INT de cada vez; banco liberado ao integrador depois de 77354. Restauracao cabe exclusivamente ao helper 337/snapshot 490, nunca ao 322. Este report nao alega restauracao da #410 antes de receber seu terminal externo.

A branch #337 permanece apontada em 9a9bfdc8. A futura PR #410 devera conter apenas o patch desta issue sobre main 487; este commit descendente nao autoriza levar a implementacao de mencoes junto. QA independente e gates na fonte/main 487 serao coordenados pelo ROOT. Nenhuma publicacao/push/merge, suite DB extra, mudanca de schema ou prova visual realizada. UI N/A para o patch de SQL.

O P2 do sino #337 (take: 20 antes de revalidar ACL) foi recebido durante estes gates e nao foi alterado nesta branch. Sera investigado com RED proprio ao voltar a #337, separado desta dependencia.
