# #314 — gate global do agregado final

Fonte executada: `7e71df45377d86bd91798a125659bf600140db59`.
Base: `codex/inbox-e1-base-314@8cf56d0bcc54b9d8fc22c6930030f922cd2639b6`.
Node22.23.2, executáveis locais, sem instalação ou alteração de package/lock.

Executor2194 acompanhado até a saída terminal0, em sequência condicionada ao
sucesso de cada etapa:

- Vitest global `run --maxWorkers=2`: 864 arquivos e6.771 testes, todos aprovados;
  sem filtro de arquivo/nome ou skips reportados. A configuração exclui
  `*.int.test.ts`; esta execução não é suíte completa de integração.
- Next `typegen`: tipos gerados com sucesso.
- TypeScript `--noEmit`, heap8192: saída0, sem diagnósticos.
- ESLint global: saída0, nenhum erro e40 avisos herdados.

Logs privados preservados em `output/inbox-314-r6-global-{unitarios,typegen,tsc,lint}.log`.
Não há processo de teste ou preview do integrador ativo ao registrar este documento.

O merge da R6 preserva o contador independente dos IDs pendentes, a invalidação
do selo #311 em finally e as contagens #310 após sucesso. O recorte dessa
resolução passou antes: 28 arquivos/303 testes, saída0. TESTER aprovou a R6
exata37a78dfe com54 oficiais dirigidos e39 adversariais; o outro chat confirmou
merge do PR382 após cinco checks CI verdes. Isso não reatribui ao TESTER o
gate global realizado pelo integrador.

Os objetos de VirtualList, ConversaAberta e BalaoMensagem são idênticos à
fonte QA243c9348, cujo parecer independente e36 fotos próprias constam no
ZIP remoto verificado. Não se declara nova captura de navegador em7e71.
O commit seguinte altera somente documentação; revisão incremental final e
publicação permanecem etapas separadas.

## Agregado final com foco do opt-out e main

Fonte final executada: `cf1ab4e1591a77937f5afc1c8f4f408dcdebc32d`.
Base final: `codex/inbox-e1-base-314@c207079db14d07ebc1b73de81ebb4a303663647d`.
Desde7e71, entrou somente OptOutContato e seu teste da fonte4818f43e, além
dos merges/documentação. A main3d756 foi integrada por merge normal; seus
três arquivos em conflito eram byteiguais à R637a, já recebida na base,
e foram preservados os contratos mais recentes da composição.

Por essa mudança produtiva, o gate global foi repetido no executor93927,
observado até saída terminal0: 865 arquivos/6.773 testes unitários,
next typegen, TypeScript heap8192 e lint global0erros/40avisos herdados.
Sem filtros de arquivo/nome ou skips reportados; a configuração continua
excluindo integração DB. Logs: output/inbox-314-cf1-global-{unitarios,typegen,tsc,lint}.log.

TESTER independente no candidato exato cf1: parecer favorável, nove arquivos
e93 testes próprios com saída0. Conferiu que os cinco módulos da thread são
byteiguais a243, InboxNovo é igual ao agregado7e e o delta OptOut é igual481.
Relatório: output/inbox-314-incremental-cf1-review-tester.md. Não repetiu
DB/browser/global; a QA visual243 permanece identificada como histórica.
O próximo commit modifica somente documentação/evidências textuais.
