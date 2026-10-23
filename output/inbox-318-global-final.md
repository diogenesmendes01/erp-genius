# #318 — composição final e gates do integrador

Fonte final **`e5941b8c3644370451f3e7a13610cce223adf5c5`**, base
`codex/inbox-e1-base-318@f5349eed` (coluna313/4f, fonte391, leitura automática,
revisão388 e ancestralidade main385). Merge normal do freeze318/D31,
sem315, preserva stableMount, decoração e quarto argumento real temMaisDepois.
PainelContato, LinhaCampo, PainelSetor e consultas de tags continuam com os
mesmos objetos da entrega já validada; hooks de leitura/URL vêm da base313.

Node22.23.2, bins locais. Gates observados até saída terminal **0**:

- Suíte unitária completa `run --maxWorkers=2`, executor **25190**:
  **881 arquivos / 6.886 testes**, 230,26 s; sem filtros ou ignorados
  reportados. Integração DB excluída pela configuração, não é suíte completa
  de integração.
- Next `typegen`: saída0.
- TypeScript `--noEmit`, heap8192, executor **85080**: saída0.
- ESLint global na produção idêntica3ec, executor **1252**: saída0,
  0 erros/42 avisos conhecidos (40 em fontes anteriores e2 em staging privado
  do ZIP318). Lint posterior do único teste ajustado: saída0.

Recorte anterior próprio **32229**,56 arquivos/597 testes, TSC6574 e lint6
fontes de produção:saída0. Global inicial4490 foi **negativo**:1 falha e
6.885 passes, somente registro da chave de navegação `abaDoContato.id`.
E594 acrescenta exceção exata por arquivo/prop/trecho/alvo, motivo tipado e
cópia literal da lista; não altera algoritmo, limites ou UI. RED isolado29
testes/1falha; GREEN3 arquivos/97 testes e lint do arquivo,saída0. Nova suíte
25190 acima confirma o estado corrigido. Logs negativos preservados.

TESTER independente no candidato exato e594: parecer favorável,
13 arquivos/166 testes mais3 arquivos/99 testes próprios,saída0. Conferiu
identidade dos módulos de painel e a exceção específica. Relatório
`output/inbox-318-aggregate-review-tester.md`. Sem novo DB/browser/global
próprio nessa revisão incremental.

QA visual histórica identificada no freeze156:13 arquivos/138 testes,
12 contextos normais/24 PNG,20 passos de resize e6 contextos extremos/18PNG
próprios do TESTER. O ZIP remoto autorizado reúne142PNG positivos de fontes
DEV/TESTER declaradas; não é recaptura de toda a composição posterior.
Upload/download/hash conferidos, release DRAFT421321214, asset667770036:
15.982.197 bytes, SHA256
`c8e08228150f9d09bef0efe100b846cb3fec849987076d9b515cef0cd76fec8b`.

Nenhum envio, integração externa, migração ou pacote alterado. CI/PR/merge
permanecem etapas separadas; não declarar #318 integrada antes do fechamento.
