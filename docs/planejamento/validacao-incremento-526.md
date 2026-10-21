# Incremento 526 — preservação da retomada no banco

15/09/2026. Reforço da integridade da fonte Q66 identificada no incremento 525. Migração da proposta implementada por agente Terra; proteção dos eventos e integração verificadas pelo orquestrador.

## Escopo

Preservar proposta de retomada, seleção de contratos e histórico das decisões. A fonte preparada não pode ser reescrita depois; uma correção exige nova proposta. A aplicação continua exigindo aprovação independente e reconferência pelas ações existentes.

A rejeição de uma proposta aprovada, mas ainda não aplicada, continua permitida pelo fluxo existente. Os eventos de solicitação, decisão e aplicação passam a impedir alteração ou exclusão; assim, a decisão anterior permanece registrada mesmo quando a situação atual da proposta muda.

## Verificação realizada

O teste de banco tentou alterar fonte, apagar proposta/item/evento, trocar a matrícula selecionada, inserir contrato fora da seleção, pular aprovação, aprovar sem papel permitido e reabrir estado terminal. Todas essas tentativas foram rejeitadas. O fluxo legítimo de aprovação seguida de rejeição permaneceu funcional e manteve as duas decisões registradas.

- Migrações 850 e 860 aplicadas somente ao Postgres descartável em localhost:54329. Sem alteração de registros históricos ou aplicação em produção.
- 27 integrações de pausa/retomada aprovadas: `docs/validacao-integracao-526-2026-09-15.json`.
- Uma regressão mensal com contrato/aditivo aprovada; 34 casos não selecionados nessa execução: `docs/validacao-continuidade-526-2026-09-15.json`. Provedor de assinatura simulado, sem integração externa real.
- ESLint do teste alterado aprovado. Não houve alteração TypeScript de produção nem nova compilação neste incremento; a última compilação aprovada é a do incremento 525.

## Pendências gerais

Q161 continua aguardando decisão. Emissão mensal recorrente, origem de coberturas deslocadas por recomposição, seleção de cobranças canceladas e ensaio interativo permanecem pendentes. A migração protege a imutabilidade e as transições, mas não replica no SQL toda a reconferência da prévia realizada pelas ações nem vincula cada transição a um evento obrigatório por constraint diferida. Este reforço não prova a conclusão integral da SPEC nem impede adulteração por um operador que tenha privilégios para desativar proteções do banco.
