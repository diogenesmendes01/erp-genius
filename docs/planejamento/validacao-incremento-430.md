# Incremento 430 — situação do fechamento no portal

Data: 14/09/2026. Meta integral ativa.

## Implementação

Consulta sem parâmetros usa a sessão opaca do aluno, seleciona somente suas matrículas e o último vínculo de cada nível e confere o fechamento nas fontes atuais. Revalida conta, sessão, revogação, validade e titularidade após os locks acadêmicos. A projeção contém somente matrícula, nível, situação, versão e data; não inclui snapshot, hashes, motivos, evidências ou autores internos.

A consulta adquire o lock institucional antes da primeira leitura acadêmica e usa ReadCommitted. Isso permite enxergar uma correção que comitou enquanto a leitura aguardava, em vez de comparar fontes antigas de um snapshot iniciado antes da espera.

A página distingue ausência de fechamento, confirmação suficiente/insuficiente e revisão. Agrupa uma vez por matrícula/nível, separadamente do acompanhamento por turma. Confirmação suficiente não anuncia progressão. A memória numérica consolidada do fechamento por nível ainda precisa de projeção própria; os números existentes continuam no acompanhamento por alocação.

## Evidências

- 4/4 integrações de fechamento no portal: estados, isolamento de outro aluno, contratos próprios separados, correção e nova versão, sessão real revogada, sessão de funcionário insuficiente e correção concorrente sob lock. Relatório: `docs/validacao-portal-fechamento-430-verificado-2026-09-14.json`.
- 5/5 integrações existentes de acompanhamento no portal passaram na primeira rodada: `docs/validacao-portal-fechamento-430-2026-09-14.json`. Essa rodada também registra falhas iniciais da nova fixture, corrigidas posteriormente.
- Fixtures corrigidas para usar o catálogo sem depender de matrícula prévia, registrar a data de verificação do e-mail e renovar a observação estatística do PostgreSQL ao conferir o lock real.
- ESLint, TypeScript e build completo aprovados, com 62 páginas estáticas. Sem nova migração, produção ou envios externos.

## Limites

Não houve homologação visual no navegador. A consulta utiliza lock institucional amplo, cujo custo em carga real ainda precisa ser medido. Permanecem a memória numérica do fechamento no portal, a resolução das revisões após progressão executada, correção aprovada da chamada concluída e os demais requisitos da SPEC. Os nove testes desta rodada não equivalem à regressão integral do ERP.
