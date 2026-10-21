# Incremento 397 — entrega autenticada de reposição

Data: 2026-09-14. Integração local de 183 e correções 187/188, somente no banco descartável.

O schema incorpora material oficial Drive por ID, disponibilização, prazo, correção, indisponibilidade, prorrogação e liberação específica. A entrega registra ContaPortalAluno e aluno correspondentes à matrícula. Novos inserts sem conta são recusados; registros anteriores permanecem intactos.

A integração revelou comparação de timestamp UTC com relógio em fuso local no guard174. Migration187 usa clock_timestamp em UTC, preservando validação de data não futura. Também substitui índice parcial equivalente por unique representável no Prisma. A primeira tentativa187 falhou por índice já existente; a definição foi inspecionada, a tentativa marcada rolled-back e a versão corrigida aplicada. Não se editou migration aplicada.

Schema alinhado aos defaults UTC e índices reais; migrate diff vazio após187. Migration188 só retira condição WHEN do trigger de autoria, para impedir bypass por conta nula.

Teste src/server/portal-aluno/entregas-reposicao.int.test.ts: 3 passaram após188 (cross-aluno e tentativa sem conta, prazo vencido, indisponibilidade e retomada com autoria preservada). Relatório docs/validacao-entregas-397-autoria-2026-09-14.json. TypeScript passou após integração183/187.

Limites: testes antigos de entregas precisam atualizar fixtures para conta obrigatória; agente está adaptando. Não foi concluída regressão ampla/build desta integração. Transmissão Drive e operação Resend continuam pendentes. Segunda chamada179 ainda em revisão, sem aplicar. Ciclo185 reprovado na revisão por perda de invariantes e devolvido para correção; não aplicado.
