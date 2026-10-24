# #418 — correção isolada da auditoria de números

Base main ae56c00f053e864a3efea35d2f640afe48716cc4, após a #417. A CI da #416 revelou uma falha herdada idêntica em main239/fcea: shard2/job120919087395, run40109847516,85 arquivos aprovados/2 ignorados/1 falho e777 casos aprovados/3 ignorados/1 falho. Os outros três shards passaram. Nenhuma nova execução remota até corrigir esta dependência.

`solicitarLogoutMotor` separa o comando externo da persistência. Somente o helper administrativo muda para esse comando; releitura fresca e auditoria continuam na transação administrativa. `desconectarNumeroMotor` conserva a API anterior. Não muda schema, migrações, dependências, permissões ou transporte. [Contrato e evidências](../docs/specs/whatsapp-desativacao-auditoria.md).

ROOT: reprodução original28 casos com uma falha; RED reforçado32 com sete falhas causais; GREEN11 UNIT/lint4 e40 INT em dois completos, TSC e lint global aprovados. O RED de três UNIT adicionais é ausência da nova API, explicitamente separado. Banco integracao487 restaurado e424 hashes preservados. Os quatro arquivos mantiveram os bytes durante o fast-forward9c98cf que acrescentou a #325 em main.

Os novos testes não retiram asserts anteriores: exigem exatamente um evento de desconexão mais o evento administrativo, autor/payload, repetição sem outro POST/evento, sessão CAIU observada durante o mock do motor e rollback real dos eventos/estado quando o evento final falha. Processamento de sessão e API de desconexão existente permanecem cobertos. Nenhum teste usa motor externo.

Global91717/006c1a:saída0,926 arquivos/7.313 testes,242,24s,maxWorkers2,sem filtro de casos/skips,configuração unitária exclui INT. [QA independente integral](ci-418-qa.md) no código exato d9c1d0bb:2/37 UNIT,2/40 INT,138,00s,maxWorkers1,TSC/lint4,todos saída0. Banco liberado pelo TESTER após7633/f9caa5 e restaurado ROOT3e3048,424 hashes/snapshot494. SHA do parecer A29DD0396BCC52D8417FCA79ABD3D0FEB3AFEA08AFB513F350BD118108264C9F. PR419 aberta,CI/merge pendentes. Esta dependência é adicional às81 issues originais do Inbox; não aumentar o número de entregas originais por resolvê-la.
