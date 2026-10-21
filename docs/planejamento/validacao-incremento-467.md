# Incremento 467 — acesso pontual ao diário (Q24)

Data: 15/09/2026. Meta integral ativa. O incremento anterior produziu código e evidências; esta etapa continua sua integração.

## Implementação

O helper transacional `exigirAcessoRegularizacaoAulaTx` permite o professor original ativo com papel docente ou o responsável ativo designado para aquele encontro, com papel de Professor/Gestão Pedagógica/Administração. Usa a trava do calendário compartilhada com designação/revogação e confere os papéis atuais. A chamada usa ReadCommitted depois da trava, evitando reutilizar uma autorização anterior à revogação.

As ações de diário de turma e particular preservam `professorId` do encontro no diário. O evento identifica quem regularizou e a designação. Atribuição pontual não concede acesso a outras aulas nem permite reescrever aulas ministradas, trocar contrato ou modificar dados financeiros. O diário sem encontro continua exigindo atribuição docente normal.

A solicitação de conclusão sem gravação reconhece a designação. A decisão continua exigindo outra pessoa e nova conferência do estado; regularização não dispensa a aprovação Q07. A página do encontro aceita os papéis de gestão, enquanto a ação restringe os dados ao encontro autorizado.

## Evidências

- TypeScript e lint direcionado aprovados.
- 26 testes aprovados em `docs/validacao-acesso-q24-467-2026-09-15.json`: regressão de diário e designação com três perfis, criação/edição, isolamento de aula, contatos não expostos, revogação e conclusão independente.
- Rodada adicional de 7 testes aprovada em `docs/validacao-acesso-particular-q24-467-2026-09-15.json`, acrescentando regularização de particular e preservação do contrato, professor e financeiro. Há testes repetidos entre as rodadas; são 27 cenários distintos no conjunto.

## Limites

Falta a interface de gestão para consultar, criar e revogar designações e a descoberta das pendências atribuídas. A integração de gravação oficial da aula também permanece pendente; a exceção Q07 não substitui esse requisito. Sem deploy ou alteração em produção. A SPEC integral não está concluída.

Build Next.js aprovado com 62 páginas estáticas geradas; não substitui validação visual nem comprova a entrega integral.
