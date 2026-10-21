# Incremento 501 — decisões específicas de alçada no aditivo

15/09/2026. Implementação com três agentes Terra e integração pelo orquestrador. O incremento anterior produziu código e evidências de validação; a meta integral segue ativa.

## Entrega

Decisões financeira, comercial e pedagógica ficam vinculadas à proposta exata de aditivo e ao seu hash, separadas da aprovação administrativa geral. O servidor deriva as alçadas dos campos alterados: valores monetários requerem financeira/comercial; vencimentos, cobertura e minutos requerem financeira; moeda requer financeira/comercial; agenda requer pedagógica; regime requer as três.

Financeiro exige a permissão existente `financeiro.aprovar_acertos`; gerências decidem suas áreas; Administração pode decidir cada alçada explicitamente. O preparador não pode decidir a própria proposta, mesmo acumulando papéis. A Secretaria pode acompanhar, mas consultar não concede aprovação. Decisões são imutáveis; repetição exata é idempotente, e uma decisão diferente exige nova proposta.

A preparação dos signatários passa a exigir todas as alçadas aplicáveis aprovadas. A migração 660 também impede avançar por inserção direta de conferência de participantes, original ou conferência de assinatura quando faltam essas decisões. Propostas cadastrais não recebem alçadas adicionais sem necessidade. Os demais guards de integridade e versão permanecem.

A nova página de alçadas mostra somente os campos permitidos ao papel atual, com valores anteriores/novos, vigência e decisão. A ação de consulta confere a matrícula/proposta exatas e recalcula separadamente as capacidades de leitura e decisão.

## Validação

28/28 testes de integração aprovados na rodada final, incluindo as verificações adicionais de capacidades e projeção de campos: `docs/validacao-aditivo-501-final-2026-09-15.json`. Três unitários aprovados em `docs/validacao-aditivo-unitarios-501-2026-09-15.json`. Lint direcionado, TypeScript e build aprovados; log `docs/validacao-build-501-2026-09-15.log`. A primeira checagem de TypeScript identificou campos de consulta sem tipos suficientes para a tela; a projeção foi tipada no servidor antes do build final.

Testes usam PostgreSQL descartável, com sessão e transporte externo simulados. Migração 660 aplicada somente a esse banco. Os cenários pedagógicos estão cobertos na derivação pura e no código de permissão; a rodada de integração percorre as alçadas financeira/comercial e os fluxos anteriores de aditivo, não uma alteração operacional de agenda.

## Limites

As decisões não aplicam condições, não recalculam cobranças e não constituem assinatura do cliente. Aprovação comercial deste aditivo é um fato específico de revisão; ainda é necessário integrar a memória dos efeitos financeiros, políticas de desconto e demais condições pertinentes antes da aplicação operacional. Agenda estruturada, formalização, fornecedor operacional e aplicação transacional permanecem pendentes. Não houve publicação em produção ou envio externo. Interface ainda sem ensaio interativo no navegador.
