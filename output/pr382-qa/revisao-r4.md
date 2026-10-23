# PR #382 — R4: contagem anterior e nova entrada oculta

O TESTER rejeitou a R3 em ca9a34d9: após um GET confirmar duas não lidas,
uma entrada oculta nova e falha de leitura/recuperação deixavam o contador
em duas. A fonte não foi mergeada. O caso oficial acrescenta ainda um GET
atrasado com zero após a entrada e reproduziu o defeito: 1 falha / 34 passes.

Agora cada ID oculto novo incrementa a contagem conhecida no recebimento.
GETs não a reduzem enquanto há entradas pendentes; a lista oculta preserva
esse mínimo. Um SSE repetido não incrementa novamente. A conclusão com sucesso
consome somente os IDs observados no começo e ajusta o contador às entradas
posteriores que restam. A falha preserva a contagem e permite nova tentativa
no próximo retorno; não há retry por timer. A alternância sem entrada continua
sem chamada redundante de leitura.

Verificação final em Node 22.23.2, todos com saída 0:

- Recorte dirigido: 4 arquivos / 51 testes. A primeira execução teve 51 passes
  mas quatro rejeições tardias após o harness remover document; capturei a
  referência da página ao iniciar a consulta e reexecutei com saída 0.
- Suíte unitária completa: sessão 35541, 842 arquivos / 6.530 testes, sem filtros
  ou testes ignorados. A fonte já contém main com #383/#384.
- TypeScript: sessão 62642, heap 8192.
- Lint global: sessão 71746, 0 erros / 40 avisos herdados.
- Integração real: sessão 55774, 2 arquivos / 15 testes, sem filtros/ignorados,
  apenas no ci-integracao: preferencias.int.test.ts e motor/presenca.int.test.ts.
  Não é a suíte completa de integração.

Pendente: parecer independente no novo commit e CI do novo head. A aprovação
anterior e o CI de ca9 não cobrem este delta. Sem mudança de servidor, schema,
permissões ou transporte de mensagens.
