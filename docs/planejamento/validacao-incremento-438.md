# Incremento 438 — preparação de casos históricos

Data: 14/09/2026. Meta integral ativa.

## Implementação

A fila oferece preparação dos casos de uma correção histórica aprovada quando existem impactos sem caso persistido. A ação exige Gestão Pedagógica/Administração ativa e registra quem preparou os casos. Usa exclusivamente os impactos gravados na decisão original; não recalcula a lista de impactos, notas, aprovações ou movimentações.

As fontes são o registro da avaliação regular ou o plano da recuperação original. Antes de criar casos faltantes, o servidor confere matrícula e alcance por equivalências efetivamente aplicadas. Solicitação legada sem matrícula permanece limitada à origem direta. Não filtra pelo estado atual da solicitação: o status preservado é o da correção histórica. JSON incompatível ou vínculo não conferido bloqueia a preparação, sem inventar histórico.

Casos existentes são preservados. A transação cria apenas os faltantes e emite o evento `CasosHistoricosCorrecaoPreparados`; repetir uma operação já atendida retorna zero criações, sem duplicar o evento. Preparar não resolve o caso: a resolução continua seguindo a aprovação independente implementada anteriormente.

## Evidências

- Regular e recuperação históricas legítimas: criação, repetição, evento único e preservação de decisão/pedido. Acesso de Secretaria e Professor negado. Fonte sem equivalência aplicada recusada pelo servidor e banco. Três testes aprovados em `docs/validacao-casos-historicos-438-2026-09-14.json`.
- A extração do coletor de alocações alcançadas preservou os três testes de cadeia e resolução concorrente: `docs/validacao-alcance-historico-438-2026-09-14.json`.
- Build completo com 62 páginas estáticas, TypeScript, lint direcionado e diff check aprovados. O primeiro build apontou uma relação incorreta na fixture nova; corrigida sem alteração dos controles de produção.

## Limites

Esta entrega oferece preparação por decisão, acionada pela equipe; não executou varredura nem migração de dados de produção. O cenário parcialmente preparado é tratado pelo filtro de faltantes, mas ainda não possui teste específico. Validação visual/interativa, tratamento de formatos históricos incompatíveis e demais frentes da SPEC permanecem pendentes. Sem nova migração de schema ou implantação em produção.
