# PR #394 — C1/C4/C5/C6

A primeira página e suas cinco contagens usam uma fila com janela fixa de
50 ms, um GET físico incluindo o corpo e uma única atualização pendente.
Novos avisos não adiam a fronteira. O fim da leitura pessoal continua pedindo
reconciliação fresca; falha sem novo aviso não provoca repetição automática.
Thread, painel e leitura mantêm seus caminhos imediatos. Não há polling novo.

O checkpoint82 falhou na revisão independente: props SSR equivalentes durante
o corpo invalidavam o snapshot sem manter atualização pendente. O b233 corrige
isso por época do voo; idle e contexto A→B→A não reabilitam consultas antigas.
TESTER favorável no b233, com reprodução negativa preservada e recorte próprio
de cinco arquivos / 66 testes. O porte moderno3a foi usado só para confrontar
o executor; nenhum código da #313 entrou nesta PR.

Merge4696b422 concilia main8d00124 com b233. Preservados os IDs de mensagens
pendentes, versão de entradas, região visível, retomada ao voltar à aba e
autoridade do GET fresco inclusive em zero da R6. Os testes R6 continuam com
as mesmas expectativas. Três testes exigiram avançar exatamente50ms e afirmar
que o GET começou antes do próximo SSE/resultado; a primeira execução falhou
nesses marcos, sem falha de regra. Depois: três arquivos / 81 testes, saída0.

Gates do4696, Node22.23.2, saída0:

- Global unitário33127: 848 arquivos / 6.628 testes, maxWorkers2, sem filtro
  ou ignorados. A configuração exclui integração DB.
- TypeScript64771, heap8192; lint global10790, zero erros / 40 avisos herdados.
- Integração31266 no perfil ci-integracao, banco erp_genius_test_ciint:
  consultas-pagina.int.test.ts e opcoes-filtro.int.test.ts, dois arquivos /
  26 testes, sem filtro ou ignorados. Sem outra suíte simultânea nesse banco.

Mergec71068de incorpora mainb287f904/#391. Só os oito arquivos de tokens,
fonte e testes da #391 mudam em src; Inbox e servidor da #310 permanecem
idênticos ao4696. Recorte da composição: oito arquivos / 135 testes, saída0;
TypeScript29938, saída0. Não se atribui o global4696 ao novo head. A regressão
global final será executada pelo CI contra main. Quadro conciliado por trechos
literais, preservando ambos os registros. Parecer do head final e CI ainda
são gates. Nenhum novo browser próprio, pacote, lockfile, schema ou envio.
