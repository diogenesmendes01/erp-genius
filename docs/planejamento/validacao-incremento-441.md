# Incremento 441 — histórico navegável de correções

Data: 14/09/2026. Meta integral ativa.

A consulta de Q54 permite selecionar uma versão de conclusão da própria reposição. Navegação anterior/seguinte cobre todas as versões, substituindo a prévia limitada a 20 conclusões. A paginação de correções conserva a versão selecionada. A tela distingue a fonte histórica do resultado atual, bloqueia preparação/decisão no contexto antigo e oferece retorno à conclusão atual. Parâmetros de versão inválidos são recusados.

A área docente agora apresenta uma lista paginada de reposições com conclusão registrada e designação vigente, com links para consulta/correção. O servidor revalida o professor e limita o DTO a reposição, modalidade e datas da aula; não abre ficha pessoal, contatos ou financeiro. A lista não exige matrícula ativa para consultar o histórico autorizado.

## Evidências

- Nove testes de integração aprovados em `docs/validacao-historico-correcao-441-2026-09-14.json`. Incluem consulta de conclusão anterior com proposta pendente, flags sem aprovação/preparação, paginação sem misturar conclusões, resultado atual preservado, versão inexistente recusada, proibição de nova proposta sobre conclusão antiga, lista docente isolada/paginada e revogação de acesso.
- Build completo, TypeScript e lint direcionado aprovados. Não houve alteração de schema nem implantação em produção.

## Pendências

A validação interativa de interface permanece pendente. Também seguem pendentes os casos persistidos de revisão de progressão por Q54, a correção independente de aulas em Q23 e demais requisitos da SPEC. O mapeamento de impacto de frequência deve respeitar todos os vínculos do nível que participam do fechamento, sem assumir que somente equivalências aplicadas propagam frequência.
