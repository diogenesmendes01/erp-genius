# PR #399 — comentários, composição e integração do painel

Fonte a5ecee157f5fb274013e9c82d3d6229bce448b2e. O patch isolado461dbf9 foi aplicado sobre62e como c962c250; merge332f3cb1 incorpora as candidatas398/400, main397, QA280/planejamento297 e B2. Nenhuma feature319 ou E2 foi antecipada. Os seis blocos do quadro preservam ambos os lados; README mantém a seção318 e o texto de portabilidade/anonimização consolidado. Provas6927bf, terminal0.

## Comentários

- C1 HIGH: composição com os pais preserva os objetos funcionais do painel318. A publicação aguarda400 na main; retarget/CI final e fresh review seguem gates antes do merge.
- C2 MEDIUM: paineis.int.test.ts completo na fontea5, um arquivo/12casos, configuraçãointegration, America/Sao_Paulo, maxWorkers1, sessão40250/245fd8 terminal0,36,07s. Inclui os três casos de origem/escopo das tags e os nove existentes. Postgres descartável ci-integracao/erp_genius_test_ciint em localhost54329, exclusivamente reservado; setup apenas verifica migrations. Sem filtro/skips novos, sem mensagens reais ou integração externa. Não é suíte completa de DB.
- Complemento separado81795/9f1ea7: três arquivos/30casos,93,38s, mesmo perfil/fuso/config. crm/tags tem10casos; preferencias+motor/presenca têm20. A seleção inicial de tagsCRM era extra e não substitui os12casos do painel, executados em seguida sem concorrência nesse banco.
- C3 LOW: snapshot já recebido só é mantido para o mesmo atendimento após recarga404, compositor bloqueado/AcoesContato removido; servidor continua revalidando a alçada de cada ação. Limites documentados sem prometer retirada universal de controles ou apagar dados retroativamente.
- C4 LOW: SPEC explica fechar no overlay e os cortes960/1400 da casca308. Nenhum breakpoint foi alterado.
- C5 LOW: props/import de triagem e revisões órfãos removidos de ConversaAberta. Único testeSSR sobre prop ignorado retirado; os três casos reais de composição/triagem no Inbox e PainelTriagem permanecem. Contratos de fallback e tags com altura mínima estão justificados na SPEC.
- C6 LOW: inventário das23saídas próprias/6699linhas e vínculos com o ZIP318 preservados. Nenhuma exclusão arbitrária ou reatribuição de captura histórica.

## Gates e QA

Recorte próprio36daee terminal0: nove arquivos/187testes, America/Sao_Paulo, maxWorkers2, sem filtro de caso/skips novos; não é global. A lista de argumentos também incluía PainelContatoAbas.test.ts e DrawerDetalhes.test.ts, inexistentes nesta árvore e não contados. Foram executados os nove caminhos existentes de interaçãoInbox, Conversa, PainelContato, PainelTriagem, Coluna, dias, balão e guardas visual/dependências. Next typegen/TypeScript19125/6fb917 terminal0; lint global27244/7d342a terminal0, zero erros/40avisos herdados.

QA independente do patch461 é favorável com seis arquivos/130testes próprios. QA compostaa5 também favorável, estática: painel/Conversa/testes/backend/schema/migrações iguaisc962; thread398/alias400/deps/planos297 iguais332; triagem preservada, sem antecipar319. Parecer original SHA256 5d5e36ea4332550d3872dcb32eb6a90f7a9ab5d78f3f85e230e9214b3a3c9c1b, copiado em tester-composicao-a5.md com apenas EOF normalizado. Não executou novos testes/DB/browser nessa extensão.

Incorporação posterior do head400db6be284 adiciona documentos e ancestralidade398main sem conflito ou alteração executável. A fontea5 permanece a fonte dos gates acima. Global883/6.926 e capturas318 mantêm suas fontes históricas; não houve recaptura, instalação, migração, seed, envio ou deploy. CI final contra main nos dois fusos e merge após400 ainda pendentes.
