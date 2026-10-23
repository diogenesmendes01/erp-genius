# Inbox E0.3 — notas internas na thread (#300)

Estado: implementação em revisão em 22/10/2026; homologação pendente.

## Contrato

- A resposta inicial da thread e a consulta `depois` retornam `notas: NotaInternaThread[]`; a consulta `antes` retorna `notas: null`, pois somente mensagens antigas são acrescentadas nessa direção. Atendimento fora do escopo mantém a resposta `null` da rota.
- Cada nota contém `origem: "atendimento" | "oportunidade"`. Notas do atendimento são visíveis a quem pode ver o atendimento. Notas da oportunidade exigem, além disso, a permissão própria de ver o lead; o acesso pela linha não concede essa permissão.
- As duas origens são mescladas em ordem crescente por `(criadoEm, id)`, inclusive em empate de instante. Para o atendimento, a consulta seleciona primeiro as 50 notas mais recentes com desempate por id e então exclui as arquivadas. O limite não é reposto por notas mais antigas após o filtro.
- A ação `notasDoAtendimento` mantém sua assinatura e confere o escopo antes da consulta. A consulta interna sem conferência de escopo fica em módulo exclusivo do servidor, fora do módulo de Server Actions, e só é chamada após a verificação da ação ou da rota.
- Uma nota nova emite `atendimento.atualizado` na mesma transação que grava o evento. O aviso contém apenas tipo e ids do atendimento/conversa, sem texto da nota ou destinatário. Repetição pela mesma chave de idempotência não grava outra nota nem emite aviso. A transação garante que um rollback também cancela o aviso.
- Notas efetivamente aplicadas pela Aria e seu arquivamento por desfazer também
  avisam o Inbox na transação do evento. Sugestões ainda não aprovadas e SHADOW
  não emitem aviso de nota. O handoff já altera o atendimento, cujo trigger avisa
  após o commit junto com a nota/resumo; não acrescenta um aviso duplicado.

## Aceite técnico

Integração isolada de criação, aviso e repetição; paginação antes/depois, arquivamento, empate e permissões de atendimento/lead; regressão do Inbox, pool, idempotência e Aria. TypeScript, Vitest completo e ESLint global com saída 0 antes de congelar a entrega. Sem migration ou mudança de permissão global.

Referências: issue #300, [quadro único](../planejamento/quadro-entregas.md).

## Rastreabilidade da Task 3 após a revisão #386 C4

Os nomes finais ampliam os exemplos do plano E0; não eliminam os casos pedidos.

| Critério do plano | Caso efetivamente executável | Arquivo |
| --- | --- | --- |
| Página inicial e depois trazem notas; antes devolve null | `notas do atendimento não comercial vêm na carga e em depois; antes devolve null` | `src/server/inbox/consultas-pagina.int.test.ts` |
| Nota arquivada não volta à página | `notas arquivadas não voltam e só as 50 mais recentes são consultadas` | mesmo arquivo |
| Nota do lead tem origem oportunidade somente para quem pode vê-lo | `mescla notas do atendimento e da oportunidade por data/id sem vazar lead pela linha` | mesmo arquivo |
| Nota e aviso transacional somente com IDs | `emite atendimento.atualizado só com ids após gravar a nota` | `src/server/whatsapp/nota-interna.int.test.ts` |
| Repetição idempotente não duplica aviso | `repetição idempotente devolve a mesma nota sem novo aviso` | mesmo arquivo |

`notasInternasDoAtendimento` fica em `src/server/whatsapp/notas-consulta.ts`, módulo interno de servidor, e é chamado por `consultas-pagina.ts` e `acoes-conversa.ts` depois de suas verificações de escopo. As telas #301 e #314 recebem o DTO pela rota/histórico; não importam esse helper de servidor no cliente. O nome e a separação de módulos preservam a fronteira das Server Actions. Este mapa não representa nova execução dos testes históricos.
