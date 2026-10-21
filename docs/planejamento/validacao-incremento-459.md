# Incremento 459 — reposição rejeitada na conferência Q23

Data: 15/09/2026. Meta integral ativa.

## Alteração

A conferência da correção de aula agora inclui a identidade e o resultado da decisão de cada reposição. Uma decisão registrada depois da revisão altera o hash e exige nova conferência. Pedidos rejeitados, sem conclusão, deixam de bloquear a publicação da participação; permanecem no snapshot da aprovação e no histórico da reposição. A interface distingue pedido rejeitado, autorizado, aguardando decisão e concluído.

O fluxo reutiliza a decisão independente existente de reposição. Não rejeita pedidos automaticamente e não permite reverter uma autorização. A decisão é única e imutável; agenda e conclusão exigem autorização aprovada nos fluxos e guards existentes. A correção continua preservando a chamada original.

## Verificação

- Quatro testes unitários da comparação aprovados, incluindo rejeição, ausência de decisão, autorização e conclusão contraditória.
- TypeScript e lint direcionado aprovados.
- 35 integrações Q23 e progressão aprovadas em `docs/validacao-reposicao-decidida-q23-459-2026-09-15.json`. Exercitam decisão real, invalidação da conferência anterior, publicação após rejeição, autorização que continua bloqueando e preservação da decisão/participação original. `git diff --check` aprovado.

## Limites

Reposições afetadas ainda autorizadas ou concluídas precisam de tratamento próprio. Efeitos financeiros continuam pendentes. A rejeição de um pedido não significa resolução automática desses outros casos. Sem migration, deploy, envio externo ou validação visual nova nesta etapa.
