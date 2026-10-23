# PR #382 — R5: correlacionar o GET com as entradas observadas

O TESTER rejeitou a R4 em 3ddde99a: um GET já incluía a mensagem e mostrava3;
seu SSE chegava atrasado, a contagem subia para4 e permanecia assim mesmo após
outro GET fresco retornar3. Essa fonte não foi mergeada. O caso foi portado ao
teste oficial e reproduziu o defeito: 1 falha / 36 passes.

O início de cada GET agora captura a época das entradas únicas observadas.
Se uma entrada chega durante a consulta, a resposta não apaga esse mínimo
posterior. Sem entrada posterior e sem leitura em voo, o snapshot fresco
corrige a contagem, respeitando somente o mínimo dos IDs ainda sem confirmação.
Assim, o GET fresco corrige4→3 sem descartar os sinais necessários à tentativa
de leitura após falha. Durante leitura em voo permanecem as travas anteriores
do zero otimista e da contagem para restauração.

Os testes distinguem os casos:

- GET já inclui a mensagem, SSE chega depois e novo GET confirma3: converge3.
- GET começou antes do novo SSE e responde0 depois: preserva a contagem3.
- Duas não lidas conhecidas, nova entrada e GETs falhos: restaura3.
- Entrada oculta com GET0, leitura e recuperação falhos: preserva o mínimo
  do ID não confirmado e permite tentar novamente no próximo retorno.
- Sucesso consome somente IDs observados no início; entradas posteriores e
  deduplicação do mesmo SSE continuam cobertas.

O teste anterior que chamava de atrasado um GET iniciado depois do SSE foi
separado em duas cronologias: falha dos GETs, como no adversarial original do
TESTER, e uma resposta realmente iniciada antes da entrada (Promise diferida).
Isso evita impor uma premissa incompatível com a convergência por snapshot.

O recorte dirigido passou em 4 arquivos / 53 testes com saída0. Os gates
completos e o parecer independente do novo head serão registrados no quadro.
Sem alteração de API, servidor, schema, permissões ou transporte de mensagens.

Gates finais Node22.23.2, todos encerrados com saída0: suíte unitária completa4477,
842 arquivos / 6.532 testes sem filtros/ignorados; TypeScript97106; lint global84654,
0 erros / 40 avisos herdados; integração26219,2 arquivos / 15 testes sem filtro ou
ignorados, exclusivamente ci-integracao (preferencias.int e motor/presenca.int).
Não é suíte completa de integração. Parecer independente e CI do novo head pendentes.
