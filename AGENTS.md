# Organização de desenvolvimento

## Regra de trabalho aprovada em 16/09/2026

- Dois DEVs Terra, um TESTER Terra e um integrador. No máximo duas funcionalidades em implementação.
- Cada DEV trabalha somente no worktree atribuído. Não editar o checkout de outro agente nem compartilhar node_modules por junction/symlink.
- O integrador prepara dependências e ambientes. Agentes não executam install, ci, pnpm, npx ou alterações de package/lockfile. Usar executáveis locais em node_modules/.bin ou scripts Node instalados.
- Cada worktree tem `.erp-test-profile` local, apontando para um dos bancos descartáveis da lista fechada. Nunca usar banco de produção. Uma suíte de integração por banco de cada vez. Não iniciar/parar o cluster compartilhado sem coordenação do integrador.
- Scripts antigos de auditoria que fixam `erp_genius_test` não podem ser usados nos worktrees dos agentes; usar vitest.integration.config.ts com perfil isolado.
- DEV entrega banco/servidor/tela/testes/SPEC da funcionalidade. TESTER inspeciona o commit exato em seu worktree e banco, sem substituir a responsabilidade de testes do DEV.
- Mudanças compartilhadas de permissões, contratos e schema exigem coordenação técnica. O integrador reserva IDs de migração; não reutilizar migração aplicada.
- Testar o recorte durante o desenvolvimento. Regressão global após integração relevante, sem reinstalar dependências no meio da execução.
- Commit por funcionalidade, com evidências e pendências no quadro único `docs/planejamento/quadro-entregas.md`. Nada de marcar concluído com partes obrigatórias ausentes ou homologação presumida.
- Não enviar mensagens/e-mails reais nem ativar integrações externas nesta fase. Push e deploy são ações separadas.
