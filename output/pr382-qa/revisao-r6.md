# PR #382 — R6: contador e confirmação independentes

A R5 não foi aprovada: um GET fresco zero mantinha uma não lida por causa
do mínimo imposto pelos IDs pendentes. Uma segunda aba pode ter lido a
conversa, ou a gravação pode ter ocorrido apesar da perda da resposta.

O GET da mesma versão de leitura, sem entrada posterior, agora corrige o
contador inclusive em zero. Uma resposta realmente anterior ao SSE preserva
o conhecimento posterior. Os IDs controlam somente a próxima tentativa e
são consumidos apenas pelo sucesso que os observou ao começar. A conclusão
não eleva zero fresco pela existência de IDs restantes. Entradas visíveis
também são registradas para recuperar repetição suspensa ao ocultar a aba.

O oráculo antigo que exigia uma não lida após GET pós-SSE zero foi corrigido
em coordenação com o TESTER: o GET agora começa antes do SSE e termina depois.
Os cenários sem GET válido, contagem conhecida de duas mais uma entrada,
deduplicação, GET que já inclui a mensagem e entrada durante leitura continuam
cobertos. Não há mudança de API, schema ou permissões.

TDD: três casos novos falharam na R5 (37 passes / 3 falhas), cobrindo zero
fresco com retry após falha, GET da mesma versão que termina após falha e
sucesso sem elevar zero. O recorte final passou: 4 arquivos / 65 testes,
sem filtros de nomes ou testes ignorados. Gates completos e parecer do
commit exato serão registrados no quadro.

Gates finais Node 22.23.2, todos encerrados com saída 0: suíte unitária completa
73160, 842 arquivos / 6.535 testes; TypeScript 78883; lint global 45672,
0 erros / 40 avisos herdados; integração 9920, 2 arquivos / 15 testes,
exclusivamente ci-integracao (preferencias e motor/presenca), sem filtro ou
ignorados. Não é suíte completa de integração. Parecer exato e CI pendentes.
