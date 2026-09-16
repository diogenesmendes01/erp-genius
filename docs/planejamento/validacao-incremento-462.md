# Incremento 462 — preservar reposições concluídas na correção Q23

Data: 15/09/2026. Meta integral ativa.

## Implementação

A publicação permite preservar reposições concluídas cuja fonte efetiva seja reconhecida pelo leitor de frequência, com confirmação explícita da gestão independente. Não basta a flag `concluida`: a fonte precisa satisfazer a validação da entrega/avaliação ou da particular. A proposta de correção Q54 mais recente sem decisão impede preservar aquela conclusão até sua resolução.

A revisão identifica os pedidos preserváveis a partir do identificador da fonte efetiva (conclusão ou correção aprovada). Essa lista faz parte do hash. A confirmação e os IDs efetivamente preservados ficam na aprovação e no evento; reenvio divergente não substitui a decisão. A interface exige checkbox não selecionado previamente. Fonte original, entrega, conclusão e benefício não são modificados. A frequência continua contando uma única participação por aula original.

## Validação

- Primeira rodada: 30 testes passaram e um identificou associação incorreta entre ID da fonte e ID do pedido. Relatório preservado em `docs/validacao-preservacao-reposicoes-q23-462-2026-09-15.json`.
- Associação corrigida e teste direcionado aprovado. Cenário adicional exercita uma correção Q54 pendente, sua rejeição independente e a preservação subsequente.
- Rodada final Q23/progressão: 38 testes aprovados em `docs/validacao-preservacao-reposicoes-q23-462-final-2026-09-15.json`. Confere preservação explícita de gravação validada, repetição, recusa sem confirmação e correção Q54 pendente que só deixa de bloquear após decisão. A particular usa o leitor efetivo existente; esta rodada não adicionou cenário de publicação com particular concluída.
- Build aprovado (62 páginas), TypeScript, lint direcionado e `git diff --check` aprovados.

## Limites

Continuam pendentes as reposições ainda autorizadas sem conclusão e os efeitos financeiros. Preservar conclusão não é corrigir sua prova: se houver erro nela, mantém-se Q54. Esta etapa não autoriza devolver benefício, cancelar agenda ou produzir ajuste financeiro automaticamente. Não houve deploy nem alteração em produção.
