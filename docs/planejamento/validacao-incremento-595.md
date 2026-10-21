# Incremento 595 — Desistência com cobranças ainda não pagas

16/09/2026. Objetivo integral em andamento. [SPEC do fluxo](../specs/desistencia-preparacao.md).

## Implementação

Proposta financeira versionada e imutável, decisão independente e efetivação pela Secretaria/Administração. O Financeiro precisa da permissão de aprovação de acertos para decidir; Administração pode aprovar. Autoaprovação permanece proibida. A decisão não cancela a matrícula: a aplicação revalida proposta, pedido, fontes e permissões, cancela as cobranças pendentes/atrasadas e libera as reservas na mesma transação.

Valores, saldo histórico e vencimento são preservados, sem recebimento fictício. Cobranças já canceladas permanecem intactas. Dados monetários aparecem somente nas consultas Financeiro/Administração; Secretaria recebe a autorização operacional. Fila com cursor e conferência financeira próprias, histórico de propostas e formulários de decisão/efetivação.

A implementação é limitada a cobranças integralmente não pagas, sem recebimentos, créditos, documentos/assinaturas, alocação ou outros ajustes. Q121 com avanço formal continua pendente, assim como homologação interativa.

## Revisão e correções

Migração 137 introduziu modelos, proteções, conferência de fontes e aplicação atômica. Migração 138 preserva também cobranças já canceladas antes da desistência, sem inventar novo cancelamento: impede alteração/exclusão e novas baixas/informes. Revisão Terra identificou a lacuna antes da conclusão desta rodada; o orquestrador adicionou cenários de integração. Ambas foram aplicadas somente no banco local de testes, sem alteração posterior do SQL aplicado.

A primeira rodada financeira teve 11/12 testes aprovados: a tentativa de autoaprovação falhava antes, pela ausência de alçada do preparador. A fixture agora concede a alçada ao preparador para provar especificamente a separação de pessoas. Depois, 30/30 integrações dos quatro arquivos passaram.

O ensaio de preservação tem nome de arquivo “inicial”, mas é **posterior à migração 138**: o globalSetup aplica as migrações locais antes dos testes. Seus dois casos passaram; oito outros foram filtrados, não são falhas nem casos adicionais executados.

A rodada ampliada executou 38 cenários, com 37 aprovados e uma falha de expectativa da fixture: o código da matrícula é opcional e estava nulo, mas o teste de listagem esperava texto. A expectativa foi corrigida para o cadastro usado; o comportamento de listagem não foi alterado. O arquivo de evidência dessa rodada permanece preservado, sem ser apresentado como aprovação integral.

## Evidências

- Rodada inicial: `docs/validacao-integrada-inicial-595-2026-09-16.json` (11/12).
- Quatro suites após ajuste da autoaprovação: `docs/validacao-integrada-revisao-595-2026-09-16.json` (30/30).
- Preservação pós138: `docs/validacao-regressao-preservacao-inicial-595-2026-09-16.json` (2/2 selecionados).
- Rodada ampliada: `docs/validacao-integrada-final-595-2026-09-16.json` (37/38, expectativa de fixture corrigida depois).
- Reexecução das consultas após corrigir a expectativa: `docs/validacao-integrada-consultas-595-2026-09-16.json` (6/6). Os 38 cenários têm resultado aprovado nas últimas execuções aplicáveis; não houve uma nova execução conjunta dos 38 depois dessa correção de fixture.
- Renderização: `docs/validacao-unitaria-595-2026-09-16.json` (12/12).
- Tipos: `docs/validacao-tipos-final-595-2026-09-16.log`; build: `docs/validacao-build-595-2026-09-16.log`, ambos aprovados.
- Lint focado: `docs/validacao-lint-595-2026-09-16.log` e `docs/validacao-lint-complementar-595-2026-09-16.log`, aprovados.

Não somar reexecuções como novos cenários. Estes testes não comprovam o fluxo complexo, todas as combinações concorrentes nem a operação em produção. Não houve importação de dados reais ou envio externo.

Q160 segue registrada em FIN-02.3: referência expressa no contrato para vencimentos novos pelo mês da cobertura, sem alterar vencimentos existentes. Configuração e cálculo estão implementados; emissão recorrente integral ainda pendente.
