# Incremento 520 — proposta e aprovação de período integral sem oferta

15/09/2026. Q158 e Q159 registradas na SPEC. Agentes Terra implementaram banco, ações e interface; o orquestrador revisou, corrigiu e integrou os testes.

O Financeiro/Administração pode preparar a escolha documentada do aluno para uma mensalidade cuja cobertura inteira tenha indisponibilidade confirmada. A proposta guarda contrato, cobertura, valores, recebimentos, usos de crédito e fontes pedagógicas. Outra pessoa da Administração ou do Financeiro com permissão de aprovação confere e decide. Acúmulo de papéis não permite autoaprovação.

Na escolha de crédito, a memória separa saldo não pago a retirar, recebimentos e liquidação prévia com crédito. Na cobertura futura, identifica o novo período da mesma mensalidade, preservando os valores e o vencimento. A interface mostra a memória de cálculo antes da decisão. Não apresenta a aprovação como crédito disponível ou reprogramação executada: o estado permanece **“Aprovada; aplicação pendente”**.

A aprovação relê o estado da fonte e recusa alterações de pagamento, contrato ou indisponibilidade posteriores à preparação. Confere novamente sobreposição da cobertura futura com mensalidades, recomposição e relatos de indisponibilidade. Rejeição de proposta obsoleta permanece permitida. Propostas e decisões não podem ser editadas ou apagadas; repetição idêntica é idempotente e chave reaproveitada para outro conteúdo é recusada. Consulta restrita à matrícula e aos papéis financeiros, sem exposição de snapshots ou hashes internos.

## Validação

- Migração 800 aplicada somente ao PostgreSQL descartável em localhost:54329; cliente Prisma gerado.
- Cinco testes unitários da memória de cálculo aprovados.
- Dez integrações aprovadas: seis novas de período integral e quatro de regressão da fonte de compensação. Evidência: `docs/validacao-integracao-520-2026-09-15.json`.
- Casos cobrem pagamento parcial, repetição, autoaprovação, fonte financeira alterada, rejeição posterior, matrícula cruzada, acesso docente, imutabilidade, consulta com memória e conflito futuro bloqueado inclusive por inserção direta no banco.
- ESLint focado e build aprovados (`docs/validacao-build-520-2026-09-15.log`).

## Limites e sequência

A aplicação financeira de Q158/Q159 ainda não foi implementada: não há novo crédito disponível, retirada efetiva do saldo ou alteração efetiva da cobertura nesta etapa. Ela exige registro próprio de aplicação e origem de crédito, integrado às proteções financeiras existentes. A ausência de relato futuro, isoladamente, não comprova oferta disponível. A emissão recorrente também segue incompleta.

Interface sem ensaio interativo. A tentativa anterior de iniciar o servidor local foi rejeitada pela revisão automática, sem motivo detalhado além de “blocked by policy”, conforme incremento 518; não foi contornada. Q157 permanece sem resposta. Nenhuma alteração em produção. A SPEC integral continua em implementação.
