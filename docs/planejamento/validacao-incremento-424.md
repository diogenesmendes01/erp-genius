# Incremento 424 — retomada e fontes acadêmicas

Data: 14/09/2026. Meta consultada com estado `active`; implementação retomada no worktree local, com agentes Terra.

## Alterações e evidência

- O acompanhamento acadêmico da equipe passou a consultar as pendências de segunda chamada, incluindo realização ainda sem nota oficial e pedido de oportunidade extra sem decisão. A página apresenta as categorias separadamente.
- Teste de integração chama `consultarConsolidadoAvaliacoes` e confirma que essas pendências chegam à resposta utilizada pela tela.
- Fontes de equivalência preservam avaliações regulares e incluem recuperação somente após oficialização e melhora efetiva. A suíte confere tentativa inferior, correção aprovada que altera o hash e isolamento entre matrículas.
- Rodada corrigida: **6/6 testes de integração**, banco local descartável. Relatório: `docs/validacao-retomada-424-corrigido-2026-09-14.json`.
- A primeira rodada teve 5/6: a fixture de outra matrícula já atingia o mínimo e, corretamente, não podia solicitar recuperação. A fixture foi ajustada para insuficiência real; a regra de produção não foi relaxada. Relatório inicial preservado em `docs/validacao-retomada-424-2026-09-14.json`.

## Limites

A integração do aproveitamento aplicado no cálculo de destino segue em implementação e terá validação própria. Persistência do fechamento Q154 e integração dos critérios na progressão continuam pendentes. Esta rodada não comprova conclusão global do ERP nem inclui validação visual em navegador, produção ou serviços externos.
