# PR416 C1 — estabilização do teste legado de cancelamento

O workflow Integração40106514674 foi disparado no head55add8ce. O shard1/4 terminou falho no job120909215932:88 arquivos/715 testes,87 arquivos/714 testes aprovados, uma falha. O cenário atendimento-idempotencia “cancelar de novo, por quem cancelou, devolve ok sem outro Evento” construía o agendamento com Date.now()+1dia. Executado no sábado24/10/2026, escolheu domingo25/10, fora da janela padrão de segunda a sexta. O arquivo era idêntico à main239ed17; a falha não veio de alteração produtiva da R1.

Reprodução ROOT `2076/2cdece`, saída1: arquivo completo/11 testes, dez aprovados e a mesma falha de janela. O único ajuste acrescenta o import do helper de testes existente diaUtilAs e usa diaUtilAs(10).toISOString(). Não muda helper, relógio, configuração da escola, regra produtiva, permissões, schema, mocks ou asserts. O cenário continua criando e cancelando um agendamento real no banco descartável e verificando um único Evento.

Gates do ajuste, Node22:

- Integração `37237/85094b`, saída0: **três arquivos completos/27 testes**,103,50 s, maxWorkers1/config integration, sem filtro de casos ou skips. Arquivos whatsapp/atendimento-idempotencia, agendamento e inbox-idempotencia, todos .int.test.ts; inclui recusas da janela e idempotência. Não são27 testes novos.
- TypeScript `18981/2a6623`, saída0, heap8192/noEmit/incrementalfalse.
- Lint do arquivo alterado `f93642`, saída0, zero avisos.
- Restauro ROOT `1aa89a`, saída0:424 hashes, snapshot337B e fixture3mensagens/1nota preservados. Nenhuma atividade externa ou nova nota manual/UI.

A regressão unitária930/7.317 e a QA independente30/431+6INT53 da R1 continuam nominais ao executável ecc/documental55add; somente este arquivo INT e documentos mudam depois. Não se reatribui a primeira CI rápida5/5 ao novo head nem se chama a primeira integração global de aprovada. No último checkpoint remoto, shard4 terminou success, shard1 failure e shards2/3 ainda rodavam. A nova publicação exige novo CI e uma execução Integração no head corrigido; os resultados ficam na conversa da PR, preservando o negativo e sem repetir envio real.

O [parecer independente C1](inbox-337-qa/calendario-c1.md),2917bytes/SHA256 `9f14c93e1ef51dcc582768ddcd2a62684149ce7622cefe6741946a07358889e2`, é favorável ao delta exato b2df: reversão dos dois hunks recupera o arquivo do pai byte a byte, com asserts intactos. Cinco datas puras caracterizaram sexta/sábado/domingo e o próximo dia útil às10hSP; não são casosINT nem prova de feriados/janelas customizadas. Os oito pareceres anteriores foram conferidos antes de acrescentar esse nono (`f83791`, saída0); originais privados preservados.
