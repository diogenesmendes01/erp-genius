# QA — índice

Material de teste do ERP Genius (UAT v1).

| Arquivo | Para quem | O que é |
|---|---|---|
| [`01-onboarding-qa.md`](01-onboarding-qa.md) | QA | Primeiro dia: acessos, máquina, ordem de leitura, como é um ciclo |
| [`02-usuarios-e-papeis.md`](02-usuarios-e-papeis.md) | QA, gestor | Usuários de teste por papel, matriz do que cada papel pode, menu e URLs por papel |
| [`03-roteiro-testes-manuais.md`](03-roteiro-testes-manuais.md) | QA | Cenários ponta a ponta, na ordem de uso, com resultado esperado e prioridade |
| [`04-fluxo-de-bugs.md`](04-fluxo-de-bugs.md) | QA, dev | GitHub Issues + Projects: template, severidade, etiquetas, quadro |
| [`auditoria-consolidada.md`](auditoria-consolidada.md) | Gestor, QA | Código × docs: bloqueadores, divergências a decidir, o que não existe |
| [`auditoria/`](auditoria/) | Dev, gestor | Os 6 relatórios detalhados por área, com arquivo e linha |
| [`../../e2e/README.md`](../../e2e/README.md) | QA | Testes automatizados com Playwright contra o UAT |

Antes de o QA começar, o gestor precisa:

1. Resolver ou contornar os bloqueadores B1 a B3 de `auditoria-consolidada.md` §2.
2. Decidir cada item R1 a R16 do §3 (é bug ou é a regra nova) e atualizar o roteiro.
3. Criar os usuários de UAT (`npm run seed:qa` com `QA_SEED_PASSWORD` definida) e passar as
   senhas por canal privado.
4. Criar as etiquetas e o quadro do GitHub Projects (`04-fluxo-de-bugs.md`).
5. Confirmar que o UAT está com WhatsApp em modo simulado (`WHATSAPP_LIVE` vazio).
