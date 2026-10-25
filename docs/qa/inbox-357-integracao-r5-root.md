# Inbox #357 — composição com tarefas e atividade

Base local `6ca4d8a865727b028cb4893910ae6675fb0c10ba`, candidata `f34711635f77406dfce17a3e33af1d5c2b8c11f0` (filha de `07312678`). A composição preserva o backend da #357 e os três arquivos da correção SSE/ACK literais à candidata. Os conflitos compartilhados mantêm também criação/edição de tarefa, nota, tarefas no fio e Atividade das #332–#334.

As assinaturas de AcoesAtendimento/ConversaAberta unem os callbacks de tarefa à capacidade contextual `podeAssumirAria`. A aba Oportunidades mantém Adicionar nota junto da geração de Assumir. Ambos os blocos de testes anexados foram preservados. As quatro expectativas nativas de painel conservam `tarefasNoFio` e acrescentam a capacidade obrigatória, sem remover asserções. A fixture tipada de Aria ganha `podeAssumirAria: false`; o mock de tarefas permanece correto nesta composição, que já contém #330.

Verificação composta `20680/e3a7e2`, EXIT0: 14 arquivos completos/349 testes, UTC/w1/2048, sem filtro de caso ou novos skips. Consumidores de InboxNovo, conversa, tarefas/notas, menções, cabeçalho, aba e handoff. Houve avisos SSR legados de useLayoutEffect; a saída terminal confirmou o total e código0. A saída extensa foi truncada pela interface, sem log completo separado; não se afirma ausência de avisos.

QA independente da candidata: oráculo original byteigual8/8 `65f21b`, UNIT22/553 `84745/896d62`, adicionais qualificados10/10 `a91995`, todos EXIT0. Parecer SHA256 `deac34eb962f0a35637e7b3f18a94fa5966d787dc08507ff312ec633cac11967`. O negativo de uma asserção extra de apresentação indevida permaneceu registrado; o oráculo original não foi alterado. Integrações nativas29 e DTO28 continuam atribuídas à073, cujo backend/DTO é literal na filha; não foram repetidas por uma correção UI.

O global anterior da #334 com worker limitado a1024 MiB teve OOM e foi interrompido (`13588/b811df`, EXIT1), sem total completo nem aprovação. PID1653596 ausente confirmado em9557bd EXIT0. A próxima regressão usará o teto habitual2048 e dois workers, após congelar a composição relevante. TSC/global/lint/build/CI e aceite visual desta composição continuam pendentes.
