# #423 — validade UTC das fontes de conhecimento

FonteConhecimento.validoAte é timestamp sem fuso e contém UTC. A busca comparava essa coluna com now(), um timestamptz; PostgreSQL interpretava o valor da coluna no fuso da sessão. Em America/Sao_Paulo, uma fonte vencida ainda entrava; em Asia/Tokyo, uma fonte vigente podia ser excluída.

A correção compara validoAte com (now() AT TIME ZONE 'UTC'), também timestamp sem fuso. O relógio e a regra estritamente maior permanecem os mesmos; validade nula continua sem prazo. Não há parâmetro novo, Db opcional, helper compartilhado, schema, migração ou alteração de fuso do ambiente.

buscarTrechos(consulta, fonteIds, limite=5) preserva o retorno TrechoEncontrado, os IDs informados, status PRONTA, ausência de arquivamento, busca textual parametrizada, ranking e limite entre 1 e 50. Os seis testes anteriores permanecem intactos.

O teste causal novo usa um cliente real com pool1 e uma única transação. As fontes vencida/vigente são construídas com o relógio UTC do banco, menos/mais um segundo, e há controles sem validade, arquivada, PROCESSANDO, ERRO e fora da lista. Um spy apenas encaminha a chamada SQL original ao método real do tx; não altera query, parâmetros ou resultado. A mesma conexão percorre UTC, America/Sao_Paulo e Asia/Tokyo com SET LOCAL (set_config true). PID e TZ são conferidos antes/depois, o spy é restaurado e o mesmo cliente confirma a sessão original após a transação, inclusive no RED antes de comparar a matriz. O cliente é desconectado em finally.

A precisão dos controles é de um segundo em coluna timestamp(3); não se alega igualdade exata de microssegundos ou relógio simulado. O teste não modifica fuso de banco, usuário ou cluster. A API de produção permanece a mesma.

Esta correção é separada da #349 e não resolve nem reclassifica o cenário de orçamento. Não altera uso.ts, orquestrador ou seus testes. Visual N/A, sem nova interface. Evidências e pendências de QA/CI/publicação estão no [relatório](../../output/inbox-423-report.md).


Composição d7e55b06 mantém os dois SRC nominais6ba2 e a API. QA independente4INT/38,3UNIT/16,lint2 aprovada; TypeScript original e lint global ROOT aprovados. [Evidências e limites](../../output/inbox-423-qa/indice.json). CI/revisão final/merge pendentes.
