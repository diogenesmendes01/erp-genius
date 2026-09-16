# Quadro único de entregas

Atualização: 16/09/2026. Métrica: funcionalidades concluídas, em andamento e bloqueadas; tempo de ciclo registrado desde início até aceite. Não utilizar 36,9% como progresso global.

| Entrega | Responsável | Estado | Início | Aceite/commit |
|---|---|---|---|---|
| EMAIL — acesso ao portal e operação dos envios | DEV 1 Terra | Preparação de ambiente | 16/09/2026 | Pendente |
| VIDEO — publicação e reprodução de revisão fixa | DEV 2 Terra | Preparação de ambiente | 16/09/2026 | Pendente |
| Revisão independente EMAIL/VIDEO | TESTER Terra | Aguardando commits | — | Pendente |

## EMAIL — aceite do DEV

- Secretaria/Administração localiza e acompanha solicitações com paginação e permissões revalidadas. Tela distingue preparado, aceito pelo provedor, incerto e demais estados sem apresentar aceitação como entrega.
- Convite, recuperação e validação de troca usam o despacho existente; operação não revela token/senha/credencial. Contato antigo não ativa convite após alteração; proteção equivalente no banco e testes de concorrência.
- Resultados incertos têm caminho operacional rastreável e seguro, preservando evidências; não reenviar automaticamente, não inventar confirmação do provedor e não reutilizar token vencido. Qualquer decisão de negócio realmente ausente deve ser destacada, sem bloquear trabalho independente.
- Fluxo banco/servidor/tela/testes e SPEC na mesma entrega. Migração reservada: 146. Código de integração externo permanece desligado até homologação; limites externos ficam separados da implementação local.

## VIDEO — aceite do DEV

- Publicação fixa uma revisão organizacional do Drive e reprodução usa essa revisão para todos os ranges, com autorização contínua. Adapters 612/613 precisam estar realmente ligados ao fluxo.
- Fontes substitutas são append-only, vinculadas à aprovação independente. Não modificar origem histórica nem inventar revisão para material legado; indicar regularização necessária.
- Integrar publicação, materiais de reposição, rotas de reprodução, estados de erro e telas necessárias. Preservar autoria, permissões, prazos e dados já existentes.
- Migração reservada: 147, independente da 146 de identidade. Rascunho 146 antigo de Drive é referência rejeitada, não migração pronta. Testes devem comprovar troca de head sem mistura de bytes, legado incompleto, aprovação e revogação.
- Provedor real, desempenho/custos e credenciais continuam sujeitos a homologação separada; não enviar PATCH real nem declarar integração homologada com mock.

## Integração e revisão

- Cada DEV entrega commits autocontidos e lista dos testes executados. TESTER revisa os commits exatos no banco `erp_genius_test_tester`, uma frente por vez.
- Integrador revisa conflitos e schema, reúne alterações e executa regressões pertinentes antes de fechar a entrega.
- Ambiente: worktrees independentes para dev-email, dev-gravacoes e tester; bancos distintos no cluster local descartável localhost:54329. node_modules próprios, lockfile npm preservado.
- Comandos por worktree: `node scripts/prepare-test-profile.mjs`; executável local Prisma generate; Vitest local com `-c vitest.integration.config.ts`. Preparação/instalação das dependências é exclusiva do integrador.
- Não abrir terceira funcionalidade. Bloqueios externos não devem aparecer como falta de código nem ser ocultados por testes locais.

## Evidência de base

Commit consolidado afc9a42. Regressão de integração 611 concluída: 1.292 testes aprovados. Unitária 618: 1.318 aprovados. Essas execuções não comprovam as novas entregas acima nem substituem homologação real. Relatórios e auditorias anteriores são históricos; atualizações futuras de estado ficam neste quadro.
