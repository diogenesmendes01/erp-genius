# PR #382 — preservar entradas ocultas após falha de leitura

A revisão independente de a5143f2a encontrou um P2: o início da leitura apagava
o sinal da entrada oculta. Com GET antigo em zero e falha tanto da leitura
quanto do GET de recuperação, a lista restaurava zero e o próximo retorno à
aba não tentava novamente. Essa fonte não foi mergeada.

Os dois adversariais foram portados ao teste oficial e reproduziram o defeito:
2 falhas / 31 passes. A correção mantém as entradas ocultas por ID de mensagem.
Cada leitura copia as observadas no início e só as remove após sucesso. Uma
entrada posterior não é consumida pela conclusão anterior. Em falha, a
contagem conhecida considera os IDs únicos pendentes, preservando o contador
e a nova tentativa sem duplicar o mesmo SSE. Alternar abas sem novas entradas
continua sem chamar a ação. Não há retry por timer.

Verificação final Node 22.23.2, saída 0:

- Suíte unitária completa: sessão 88982, 840 arquivos / 6.507 testes, sem filtros
  ou testes ignorados. Inclui os dois adversariais, entrada durante o voo e
  restauração de duas mensagens únicas com SSE repetido.
- TypeScript: sessão 30482, heap 8192.
- Lint global: sessão 87886, 0 erros / 40 avisos herdados.
- Integração real: sessão 5900, 2 arquivos / 15 testes, sem filtro ou ignorados,
  apenas no perfil descartável ci-integracao: preferencias.int.test.ts e
  motor/presenca.int.test.ts. Não é a suíte completa de integração.

O recorte dirigido anterior ao último teste de duplicidade passou em quatro
arquivos / 49 testes; o global acima cobre a fonte final completa. O parecer
independente e o CI do novo head continuam pendentes. Sem alteração de servidor,
schema, permissões, polling ou transporte de mensagens.
