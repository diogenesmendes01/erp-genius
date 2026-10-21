# Incremento 548 — nota oficial após recuperação de matrícula encerrada

Ampliados os dois cenários de encerramento do incremento 547 até o lançamento, a submissão e a oficialização da nota. Foram exercitados tanto o plano preparado antes do encerramento quanto o plano preparado depois dele com autorização específica.

Os testes conferem repetição idempotente do lançamento, manutenção do resultado anterior enquanto a nota aguarda revisão, rejeição da autoaprovação mesmo quando o professor acumula papel de gestão e atualização do consolidado apenas após aprovação independente. Preservam explicitamente a nota original e comparam integralmente matrícula e alocação com seus estados encerrados anteriores ao fluxo.

Dois testes integrados aprovados, zero falhas, 92 não selecionados (`docs/validacao-nota-encerramento-548-2026-09-15.json`). ESLint e TypeScript aprovados. Não houve mudança de código de produção neste incremento: a evidência ampliou a cobertura sobre o fluxo existente.

Revisão independente Terra confirmou que nota/consolidado partem da realização protegida e mantêm isolamento por matrícula, alocação, nível e regra. Atribuição docente ou designação específica continua necessária; autorização acadêmica não devolve acesso amplo a professor desligado.

Limites: sem ensaio interativo ou validação de provedores externos. A SPEC integral e a auditoria completa de Q151 ainda não estão concluídas.
