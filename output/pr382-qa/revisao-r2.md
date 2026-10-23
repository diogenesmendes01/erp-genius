# PR #382 — novo C1 medium da revisão R2

O retorno à aba disparava a ação de leitura mesmo sem mensagens não lidas.
Este delta sobre `5f29c3ce` exige contagem positiva ou uma entrada recebida
enquanto a aba/região da conversa estava oculta. A leitura normal ao abrir
continua igual. O sinal da entrada oculta é consumido ao pedir a próxima
leitura, sem depender de um GET que pode estar atrasado ou de uma leitura
anterior ainda em voo. A repetição descartada durante a aba oculta pode ser
recuperada no retorno quando ainda existe contagem pendente.

TDD: dois testes falharam e 28 passaram antes da correção. Depois, quatro
arquivos / 46 testes dirigidos passaram, incluindo os três casos novos:
alternância sem mensagem não chama a ação, entrada oculta não se perde quando
a leitura anterior zera a contagem e repetição descartada pode ser retomada.

Gates finais com Node 22.23.2, todos com saída 0:

- Suíte unitária completa: sessão 2861, 840 arquivos / 6.503 testes, sem filtros
  ou testes ignorados.
- TypeScript: sessão 63783, heap 8192.
- Lint global: sessão 33022, 0 erros / 40 avisos herdados.
- Integração: sessão 90136, dois arquivos / 15 testes, sem filtro ou ignorados,
  exclusivamente no perfil descartável ci-integracao: preferencias.int.test.ts
  e motor/presenca.int.test.ts. Não é a suíte completa de integração.

Pendente: nova revisão independente do delta e CI do novo head. O CI de
5f29c3ce não substitui o desta correção. Sem mudança de servidor, schema,
permissão, polling ou transporte de mensagens.
