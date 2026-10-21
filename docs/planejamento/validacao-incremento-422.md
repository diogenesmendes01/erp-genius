# Incremento 422 — substituição do caminho direto

2026-09-14. A ação legada `trocarTurma` não altera mais alocações: orienta o fluxo de aproveitamento aprovado. A interface acadêmica não a chama; gestão segue para preparação, e a Secretaria acompanha/executa propostas pela fila da matrícula. Foram acrescentados permissão de preparação, listagem paginada e navegação para detalhe com decisão/aplicação.

**82/82 integrações** passaram nas suítes de mudanças acadêmicas (63) e diário (19). Evidência: `docs/validacao-legado-equivalencia-422-2026-09-14.json`. Expectativas antigas de transferência direta foram substituídas por recusa sem mutação. Cenários de chamada/histórico usam fixture explícita de vínculos históricos; não simulam autorização do novo fluxo.

Build Next.js passou, com 62 páginas estáticas e rotas de preparação/lista/detalhe de equivalência. TypeScript e lint direcionado passaram. Não houve homologação visual.

O coletor de fontes recebeu recuperação efetiva por habilidade, mantendo avaliações regulares separadas e usando o motor Q133; essa extensão ainda precisa de integração específica contra o banco. Aproveitamentos sucessivos, consumo das fontes no consolidado do destino, fechamento persistido e gates de progressão continuam pendentes. A passagem pelo fluxo aprovado não comprova conclusão integral de Q153/Q154 nem do produto.
