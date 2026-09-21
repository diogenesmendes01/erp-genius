# Incremento 465 — correção textual com vínculos financeiros

Data: 15/09/2026. Meta integral ativa.

## Implementação

A revisão distingue `possuiDependenciasFinanceiras` de `exigeConferenciaFinanceira`. O inventário de ocorrências e reservas continua no hash e no snapshot. Quando apenas conteúdo/observação mudam, a publicação preserva os fatos financeiros sem exigir um ajuste que não ocorreu. O esquema Q23 não permite mudar preço, duração ou cobrança por essa alteração textual.

Se a participação mudar e houver dependências financeiras, a publicação permanece pendente de tratamento próprio. A interface mostra os vínculos encontrados e explica a preservação no caso textual; não expõe valores.

## Validação

- TypeScript e lint direcionado aprovados.
- 42 testes Q23 e ocorrência particular aprovados em `docs/validacao-financeiro-textual-q23-465-2026-09-15.json`. O cenário financeiro distingue publicação textual e recusa de mudança de participação, preservando ocorrência, cobrança e recebimentos.

## Decisão pendente

Foi apresentada ao usuário a escolha entre encerrar ou manter como cortesia uma reposição autorizada não concluída cuja origem passe a PRESENTE. Nenhuma alternativa foi presumida nesta etapa. Essa decisão não impede a implementação independente das correções textuais.

## Limites

Não implementa ajuste financeiro de participação nem estorno/refaturamento. Não há cancelamento automático de reposição, deploy ou alteração em produção.
