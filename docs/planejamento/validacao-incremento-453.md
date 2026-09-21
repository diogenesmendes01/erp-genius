# Incremento 453 — rejeição independente de proposta Q23

Data: 15/09/2026. Meta integral ativa.

## Implementado

`RejeicaoCorrecaoAula` registra uma decisão terminal de rejeição por proposta, com decisor, motivo, hash da proposta e instante UTC. A migration 205 (`20260915035000_rejeicao_correcao_aula`) protege o fato contra alteração/exclusão e exige gestor pedagógico/administrador ativo, pessoa diferente do autor, hash correspondente e proposta mais recente. A rejeição não altera diário, presenças, encontro, frequência ou financeiro.

A ação `rejeitarCorrecaoAula` revalida a autorização dentro da transação. Repetição exata pela mesma pessoa retorna a decisão existente; mudança de motivo não a reescreve. Proposta superada não pode ser rejeitada como se fosse atual. Nova proposta pode ser preparada após a rejeição, sem perder versões anteriores.

A interface oferece a ação somente à gestão independente na proposta atual. Mostra decisor, data e motivo da rejeição persistida, recarrega o histórico após sucesso e remove a ação de conferência de impactos da proposta rejeitada. O servidor também recusa essa conferência. Nenhuma opção de aprovação/publicação fictícia foi adicionada.

## Validação

- 14 testes de integração Q23 aprovados, incluindo quatro novos cenários de rejeição, preservação dos originais, papéis, hash, versão, SQL direto, replay e concorrência.
- Evidência: `docs/validacao-rejeicao-aula-453-2026-09-15.json`.
- O teste concorrente usa identidade de sessão simulada e relê atividade/papéis no PostgreSQL real. O adaptador evita uma falha de importação concorrente de `next-auth` no runner; não substitui as regras de autorização do servidor ou do banco.
- Prisma generate, build, TypeScript, lint direcionado e diff check aprovados. Não houve validação visual em navegador.

## Ainda pendente

A rejeição está implementada; a aprovação que publica a correção não está. Ela exige projeção efetiva consistente para diário, frequência e reposições, cadeia de snapshots sucessivos, tratamento dos fatos financeiros e dos casos de progressão. A ausência de publicação não foi convertida em requisito final: o objetivo continua sendo completar esse fluxo.

A migração foi aplicada somente no banco descartável de testes. Nenhum deploy ou envio externo.
