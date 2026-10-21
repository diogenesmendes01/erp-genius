# Incremento 406 — integridade de entregas e liberação pontual

2026-09-14. Migration `20260915016000_guardrails_portal_reposicao` integrada e aplicada somente no banco descartável de testes. Protege autoria e preservação dos relatos, vínculo da etapa de prorrogação e conta/matrícula da liberação específica. Prorrogações conferem versão, prazo anterior efetivo e novo prazo futuro, serializando pelo registro da reposição. Pausas sobrepostas são unidas; pausas iniciadas após o vencimento não reabrem a etapa.

A ação de liberação agora exige explicitamente matrícula PAUSADA/ENCERRADA, conta ativa do aluno e reposição GRAVACAO aprovada. Antes, qualquer status diferente de ATIVA passava pela validação da ação. A liberação não reativa matrícula nem cobrança.

## Evidência

- Nove testes de entregas passaram antes da integração: `docs/validacao-liberacao-406-2026-09-14.json`.
- Primeira regressão integrada: 17 passaram e um falhou por fixture que tentava duas alocações ativas na mesma matrícula. A fixture foi separada por matrícula, preservando o teste de ausência de aprovação.
- Regressão final: **18/18**, três arquivos: entregas, relatos e controles SQL. Relatório: `docs/validacao-portal-406-final-2026-09-14.json`.
- TypeScript, lint dos três arquivos alterados e `git diff --check` passaram. Prisma `migrate diff` contra o banco de testes retornou vazio.
- A frente de remarcação confirmou **10/10** em execução separada: `docs/planejamento/validacao-reposicao-ciclo-agenda.json`.

## Trabalho restante

Painel operacional de material/prazos em implementação por agente Terra. Reprodução autenticada do Drive ainda não implementada. Não houve validação visual do painel nem alteração de produção. Estas verificações não comprovam conclusão da SPEC inteira, que mantém o escopo de ERP, CRM, WhatsApp e acadêmico.
