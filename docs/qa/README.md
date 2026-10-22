# QA — índice

Material de teste do ERP Genius (UAT v1), feito sobre a `main` de 21/10/2026 (commit `9e3d1d3c`).

| Arquivo | Para quem | O que é |
|---|---|---|
| [`01-onboarding-qa.md`](01-onboarding-qa.md) | QA | Primeiro dia: o que é o sistema, bloqueadores que vai encontrar, acessos, máquina, ordem de leitura, ciclo |
| [`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md) | QA, gestor | Usuários de teste e apelidos, matriz de acesso por área, menu por papel, alçadas |
| [`03-roteiro-testes-manuais.md`](03-roteiro-testes-manuais.md) | QA | Cenários ponta a ponta na ordem de uso, com resultado esperado, prioridade e referência B/X/R |
| [`04-fluxo-de-bugs.md`](04-fluxo-de-bugs.md) | QA, dev | GitHub Issues + Projects: template, severidade, etiquetas, quadro |
| [`auditoria-consolidada.md`](auditoria-consolidada.md) | Gestor, dev, QA | Código × SPECs: 8 bloqueadores de UAT, 15 bugs prováveis, 14 decisões pendentes, o que não existe, docs desatualizados |
| [`auditoria/`](auditoria/) | Dev, gestor | Os 9 relatórios por área, com critérios de aceite conferidos, máquinas de estado, mapas de tela e cenários, sempre com arquivo e linha |
| [`../../e2e/README.md`](../../e2e/README.md) | QA | Testes automatizados com Playwright contra o UAT |
| [`pdf/`](pdf/) | QA (para compartilhar) | Os 5 guias em PDF com a identidade do produto: guia do projeto e onboarding, usuários e papéis, roteiro de testes, como reportar bugs, automação de testes de front. Fonte em HTML + `brand.css`; regenerar com `node docs/qa/pdf/render.mjs` |

Antes de o QA começar, o gestor precisa:

1. Resolver ou contornar os bloqueadores B1 a B8 de `auditoria-consolidada.md` §2. Os que exigem
   código: B2 (driver de assinatura simulado), B3 (flag do pagamento simulado), B6 (professor na
   experimental). Os que exigem decisão: B4 (como o QA recebe links do portal).
2. Decidir os itens R1 a R14 do §4 e atualizar o roteiro.
3. Preparar o ambiente seguindo o checklist de 19 passos do relatório 09 ("Dados mínimos do UAT"):
   variáveis, `npm run seed`, `npm run seed:qa` com `QA_SEED_PASSWORD`, configuração operacional,
   países, preços, regras de entrada, políticas de comissão, regras de avaliação, calendário,
   turmas, grades, janelas de admissão, modelos contratuais, crons. Passar as senhas por canal
   privado.
4. Criar as etiquetas e o quadro do GitHub Projects (`04-fluxo-de-bugs.md`).
5. Confirmar que o UAT está com `WHATSAPP_LIVE` vazio, flags de e-mail em `false` e nenhum número
   de WhatsApp pareado.

Histórico: a primeira versão deste kit (21/10, manhã) foi feita sobre um checkout de agosto
(`bc858aff`) e foi inteiramente refeita no mesmo dia sobre a `main` atual.
