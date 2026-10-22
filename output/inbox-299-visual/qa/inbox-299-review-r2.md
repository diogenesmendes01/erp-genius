# Re-review TESTER R2 — #299

SHA exato `208b993dcb172bb60c8eda50c5600c6a486a744a`, sobre `91e554d0` e baseline Windows `3dbd3df8`. Escopo desta rodada: somente a correção do GET antigo depois de falha da leitura.

## Parecer

**P2 residual corrigido; sem novo achado bloqueante no diff R2.** Em `src/app/(app)/inbox/InboxNovo.tsx:142-149`, quando a leitura está em fase `falha`, uma resposta só é aplicada se a consulta começou com o mesmo atendimento, a mesma versão de leitura e já na fase `falha`. O teste novo em `InboxNovo.interacao.test.ts` segura um GET anterior com contador 0, faz uma nova mensagem falhar e restaurar 1, comprova que esse GET antigo não apaga o 1 e então comprova que um GET fresco iniciado depois da falha pode atualizar o contador para 2. A verificação precede `consultasRef.aplicada = pedido`, de modo que o GET descartado não impede a consulta fresca de aplicar. A alteração não introduz repetição automática da ação nem loop de SSE.

O descarte é da resposta inteira, inclusive mudanças de outras linhas, quando ela antecede a falha da conversa aberta; isso é transitório e uma consulta posterior reobtém a lista. Não há evidência de perda persistente de outro atendimento neste patch.

## Evidência

Recorte TESTER no próprio checkout: `vitest run` em `marcar-lida.test.ts`, `InboxNovo.interacao.test.ts`, `InboxNovo.test.ts` e `sem-polling.test.ts`: **4 arquivos, 36 testes, exit 0**, nenhum ignorado na saída. DEV B reportou integração dirigida 2 arquivos/13 testes, lint dos dois arquivos e `diff --check`, todos exit 0 neste SHA; não repeti integração durante a janela da fixture visual. A revisão anterior cobriu escopo no servidor, leitura pessoal/compartilhada, MOTOR conectado e coalescência; este patch não os modifica.

Revisão de código favorável para #299 neste SHA. Continuam pendentes aceite visual 2→0 em seis combinações e gates globais finais do SHA de integração; não considero a issue homologada apenas por este parecer.
