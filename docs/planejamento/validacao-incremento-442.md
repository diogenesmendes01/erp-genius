# Incremento 442 — conferência das dependências acadêmicas de Q54

Data: 14/09/2026. Meta integral ativa.

O coletor deriva a matrícula, nível e vínculo histórico da aula original da reposição. Exige vínculo único da mesma matrícula/aluno/turma cobrindo o início da aula no intervalo semiaberto; vínculo inativo sem encerramento exige conferência. Seleciona mudanças aprovadas/executadas cuja origem pertença à mesma matrícula e nível, incluindo trocas sem equivalência. Outro contrato do mesmo aluno não entra no alcance.

A consulta da correção apresenta essas dependências, identifica impedimentos e produz um hash da proposta/fonte efetiva/contexto/impactos. A ação de aprovação exige esse hash e recalcula a conferência com os locks mantidos; contexto alterado bloqueia a publicação. O evento registra hash e contexto acadêmico. Rejeição não cria impacto. Correções que mantêm a regularização também são conferidas, pois alteram a fonte usada pelo fechamento.

## Evidências e limites

- Quinze testes de integração aprovados em `docs/validacao-integrada-impactos-442-2026-09-14.json`: isolamento por matrícula/nível, troca sem equivalência, vínculo ambíguo, início inclusivo/fim exclusivo, vínculo sem fim, pedidos aprovados/executados, hash ausente/divergente, revisão obsoleta e regressão do fluxo Q54.
- A suíte do coletor usa registros sintéticos persistidos de fechamento e solicitação para testar seleção de dependências, com os guards do banco ativos. Ela não comprova cálculo ou execução ponta a ponta de fechamento/progressão; essas ações têm suítes próprias e ainda precisam ser combinadas com esta origem de correção.
- Build, TypeScript, lint direcionado e diff check aprovados. Sem alteração de schema e sem implantação em produção.

## Próxima integração obrigatória

Ainda falta ampliar `CasoRevisaoProgressao` e as decisões de correção para persistir a terceira origem, criar casos na mesma aprovação e integrar fila/consulta/resolução. O evento é evidência de conferência, não substitui esses casos. A leitura das decisões antigas não recupera ainda o contexto do evento na interface. Q23, validação interativa e demais frentes da SPEC permanecem pendentes.
