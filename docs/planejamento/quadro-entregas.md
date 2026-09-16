# Quadro único de entregas

Atualização: 16/09/2026. Métrica: funcionalidades concluídas, em andamento e bloqueadas; tempo de ciclo registrado desde início até aceite. Não utilizar 36,9% como progresso global.

| Entrega | Responsável | Estado | Início | Aceite/commit |
|---|---|---|---|---|
| EMAIL — acesso ao portal e operação dos envios | DEV 1 Terra | Implementação/revisão local e regressão global aprovadas | 16/09/2026 | Base 091d103, interface fc69c8e e revisão 8c056f9; homologação externa pendente |
| VIDEO — publicação e reprodução de revisão fixa | DEV 2 Terra | Implementação/revisão local e regressão global aprovadas | 16/09/2026 | Integrações 99741ba/1db9be3; homologação externa pendente |
| Revisão independente EMAIL/VIDEO | TESTER Terra | Rodadas locais aprovadas | 16/09/2026 | Evidências abaixo; integração global e provedores reais não presumidos |
| N01 — avisos de alteração de agenda | DEV 1 Terra | E-mail integrado e validado localmente; WhatsApp em implementação | 16/09/2026 | Base 2df2f4d; fila, escopo e acompanhamento; sem envio real |
| M01 — preparação operacional de migração | DEV 2 Terra | Preparação e entrada CSV/XLSX integradas; ensaio/aplicação/conciliação pendentes | 16/09/2026 | Migração 155, lotes/linhas/pêndencias/colisões e consulta administrativa; sem carga real |
| F07.3 — aplicação conjunta do calendário | DEV 2 Terra | Banco/servidor/tela em implementação | 16/09/2026 | Branch codex/dev-aplicacao-calendario; migração 162 reservada; exige conjunto atômico e revisão independente |

## EMAIL — aceite do DEV

- Secretaria/Administração localiza e acompanha solicitações com paginação e permissões revalidadas. Tela distingue preparado, aceito pelo provedor, incerto e demais estados sem apresentar aceitação como entrega.
- Convite, recuperação e validação de troca usam o despacho existente; operação não revela token/senha/credencial. Contato antigo não ativa convite após alteração; proteção equivalente no banco e testes de concorrência.
- Resultados incertos têm caminho operacional rastreável e seguro, preservando evidências; não reenviar automaticamente, não inventar confirmação do provedor e não reutilizar token vencido. Qualquer decisão de negócio realmente ausente deve ser destacada, sem bloquear trabalho independente.
- Q166 aprovada em 16/09: Secretaria registra evidência; Administração autoriza nova emissão quando necessária. Aprovação independente, novo token/revogação do anterior e preservação da tentativa original. Migração 148 reservada para esse fluxo; não alterar a 146 já aplicada.
- Revisão Q166: separar registro de evidência da elegibilidade de nova emissão; permitir conferências versionadas após rejeição/estado obsoleto; preservar recuperação assistida Q74; validar no SQL autoria, aprovação e vínculo da nova intenção. Migração 148 já aplicada somente no DEV: correções reservadas na 150, preservando 148. TESTER revisará a corretiva antes da aplicação, enquanto DEV avança tela/testes.
- Fluxo banco/servidor/tela/testes e SPEC na mesma entrega. Migração reservada: 146. Código de integração externo permanece desligado até homologação; limites externos ficam separados da implementação local.

## N01 — avisos de alterações da agenda

- Substituição docente aprovada em turma regular encontra somente as matrículas com alocação vigente no instante do encontro. O helper, worker e guards SQL 161/164 usam `criadoEm ≤ início < encerradaEm`; vínculo encerrado no início e matrícula fora da turma ficam fora da fila. A origem de substituição é `ConfiguracaoOperacional/escola` canônica.
- O renderer de substituição tem assunto e texto próprios. O transporte é simulado nos testes: recusa vira `FALHOU`, incerteza é preservada sem reenvio e aceite vira `ENVIADO`, que significa aceite do provedor, não entrega ao aluno.
- O renderer usa exclusivamente itens persistidos do aviso; decisão com turmas distintas não expõe horário da outra turma, identificador arbitrário é recusado e email alterado depois do claim não chega ao transporte. Integração local: `./node_modules/.bin/vitest.cmd run -c vitest.integration.config.ts src/server/agenda/substituicao-avisos.int.test.ts` — 7 testes aprovados. Migrations `20260916161000_guard_substituicao_turma_avisos` e `20260916164000_origem_canonica_avisos_agenda` aplicadas somente em `erp_genius_test_dev_email`; sem envio externo. Revisão independente pendente.

## VIDEO — aceite do DEV

- Publicação fixa uma revisão organizacional do Drive e reprodução usa essa revisão para todos os ranges, com autorização contínua. Adapters 612/613 precisam estar realmente ligados ao fluxo.
- Fontes substitutas são append-only, vinculadas à aprovação independente. Não modificar origem histórica nem inventar revisão para material legado; indicar regularização necessária.
- Integrar publicação, materiais de reposição, rotas de reprodução, estados de erro e telas necessárias. Preservar autoria, permissões, prazos e dados já existentes.
- Migração reservada: 147, independente da 146 de identidade. Rascunho 146 antigo de Drive é referência rejeitada, não migração pronta. Testes devem comprovar troca de head sem mistura de bytes, legado incompleto, aprovação e revogação.
- Provedor real, desempenho/custos e credenciais continuam sujeitos a homologação separada; não enviar PATCH real nem declarar integração homologada com mock.
- Revisão de implementação em 16/09 identificou: fixação usando credencial readonly; substituição de material sem conferir a fonte completa da publicação vinculada; ausência de guard SQL do preparador; chave idempotente sem comparar entrada; aprovação sem reconferir a revisão no Drive. DEV recebeu correções e cenários de teste. Migração 147 já aplicada apenas no banco DEV: preservar seu conteúdo exato e usar a 149 para correções SQL, mantendo 148 reservada para EMAIL.
- A revisão inclui a tela de proposta/consulta/aprovação de fontes substitutas e material legado. Actions e mensagens de erro sem caminho operacional não fecham o aceite. O exemplo de ambiente agora distingue credenciais de publicação/escrita das credenciais de leitura do player.

## Integração e revisão

- Integração N01 e-mail: 11 testes de integração, 3 de rota/codificação e TypeScript passaram no checkout principal. Migrações 154/156/157/159/161/164 aplicadas somente no banco descartável do integrador. Fila acessível pela navegação da Secretaria/Administração. Gate de envio permanece desligado; não houve envio ou homologação externa.

- N01 e-mail até 1182f97 aprovado no TESTER: 11 integrações (7 substituição e 4 fila), 2 testes de rota, TypeScript e migrações 159/161/164 passaram. Revisão confirma itens persistidos por matrícula, origem canônica e recusa de contato alterado após claim. Integração não inclui WhatsApp ou homologação externa.

- Build após integração M01: Next.js passou, com 77 páginas estáticas. O integrador executou 2 integrações XLSX e 6 unitários/SSR do incremento final; a revisão independente desse incremento foi por leitura, distinguida da execução anterior da base.
- Rodada seguinte: DEV 2 em `codex/dev-aplicacao-calendario`, base 8cdcb25 e mesmo banco isolado, implementa F07.3 (migração 162 reservada). DEV 1 permanece em N01: substituição de turma testada em 7b50c1b, em revisão independente; configuração/despacho institucional WhatsApp ainda em implementação (163 reservada). Máximo de duas frentes mantido.

- M01 CSV/XLSX integrado até 23b8359: 6 testes unitários/SSR e 2 integrações de arquivo real até lote persistido passaram no integrador; a base já passou 6 integrações. Parser interno, mapeamento estrito, erros sem sucesso falso e preservação de valores/colunas foram revisados. Removido limite arbitrário de 100 abas na submissão; a aba escolhida precisa existir no arquivo. Isso conclui a preparação local, não a aplicação da migração nem a conferência dos dados reais.

- Regressão global da base EMAIL/VIDEO/Q166 finalizada: 124 arquivos e 1.310 testes de integração aprovados, duração 2.387,72 s. Essa evidência precede M01/N01. Base M01 integrada em dcf8abe/57bf751/7a651f3; migrações 155/158/160 aplicadas no banco descartável do integrador. Sete testes unitários/SSR/codificação SQL passaram; integração direcionada em execução.

- M01: base `8344772` e corretivas `39ba53b`/`0aeef5a` aprovadas pelo TESTER (6 unitários/SSR e 6 integrações; migrações 155/158/160 no banco exclusivo). Integração aguarda a regressão global. A entrada operacional por arquivo/mapeamento segue no DEV 2: a tela de JSON não fecha o uso pela equipe. Preservar zeros iniciais, precisão dos identificadores e todas as colunas, inclusive cabeçalhos repetidos; não inferir consentimento ou aplicar cadastros.
- N01: DEV 1 passou a ser `terra_avisos_validacao_fluxo`, no mesmo worktree/branch, substituindo o agente anterior. Aceite pendente inclui teste de aprovação real da substituição em turma regular, destinatários pelo vínculo histórico da matrícula, conteúdo específico da alteração e resultados distintos de aceitação, recusa e incerteza. Migração 159 aplicada deve permanecer preservada; 161 reservada para a correção do vínculo de turma.
- Próxima dependência de agenda, ainda sem abrir uma terceira implementação: `conferirRevisaoParaDecisao` sempre retorna `aprovacaoDisponivel: false` e `carregarReplanejamentoTx` retorna `revisaoCompleta: false`. Para fechar F07.3, será necessário aplicar a última revisão do conjunto com aprovação independente, revalidar hash/conflitos/reservas/exceções na transação, preservar aulas passadas e produzir os avisos apenas após aplicação. Testes de aceite devem incluir rollback de todo o conjunto quando uma turma ficar inválida, concorrência e repetição sem duplicação; prévia isolada não satisfaz Q20/Q21.

- Revisão da rodada N01/M01: TESTER executou M01 `8344772` (4 unitários e 4 integrações aprovados), mas encontrou imutabilidade SQL incompleta, replay com linha omitida sem conflito e células numéricas/nulas abortando o lote. Correções seguem no DEV 2, com migração 158 reservada; 155 aplicada permanece imutável. A prévia também precisa mostrar os valores originais/conflitantes e colisões dos dois lados. M01 não está aprovado para integração.
- N01 `55b341f` (migração 157) passou 4 integrações independentes: rollback, consolidação, vínculo SQL de origem e concorrência do despacho. O adapter/rota de e-mail `92bce0a` ainda está em revisão. WhatsApp sem vínculo/configuração não deve ser marcado incerto sem tentativa externa; correção e testes seguem no DEV 1. Esses commits ainda não estão integrados neste checkout.
- Build da interface Q166 terminou com sucesso (Next.js, 76 páginas estáticas). A regressão global de integração continua no processo 50868, sem resultado final; não iniciar outra suíte no mesmo banco enquanto estiver ativo.

- N01: conferência dos produtores encontrou prévia/rascunho/conferência do replanejamento global, mas nenhum executor conjunto nesse fluxo. Essa dependência de F07.3 permanece aberta. Recorte inicial de avisos conecta remarcações particulares/reposições e substituições efetivamente aplicadas, com origem transacional e matrícula identificadas. Migração 154 já aplicada somente no DEV; corretiva estrutural 156 reservada, sem reutilizar 155 de M01. Retorno do ID de `registrarEvento` foi autorizado ao DEV 1, preservando os chamadores atuais.

- Próxima rodada: DEV 1 usa branch `codex/dev-avisos-institucionais` no worktree EMAIL; DEV 2 usa `codex/dev-preparacao-migracao` no worktree de gravações. Ambas partem de `2df2f4d`, com dependências próprias, Prisma regenerado e os mesmos perfis de banco exclusivos. Migrações 154 e 155 reservadas respectivamente. EMAIL/VIDEO estão em regressão, sem nova implementação paralela nesses recortes.

- Cada DEV entrega commits autocontidos e lista dos testes executados. TESTER revisa os commits exatos no banco `erp_genius_test_tester`, uma frente por vez.
- Integrador revisa conflitos e schema, reúne alterações e executa regressões pertinentes antes de fechar a entrega.
- Ambiente: worktrees independentes para dev-email, dev-gravacoes e tester; bancos distintos no cluster local descartável localhost:54329. node_modules próprios, lockfile npm preservado.
- Ambientes criados em `C:/Users/Mendes/.codex/worktrees/erp-dev-email`, `erp-dev-gravacoes` e `erp-tester`, cada um na branch `codex/equipe-<perfil>`. Instalação npm ci pelo integrador e geração Prisma concluídas nos três. Consulta real `current_database()` confirmou respectivamente `erp_genius_test_dev_email`, `erp_genius_test_dev_gravacoes` e `erp_genius_test_tester`. Migrações das funcionalidades são aplicadas pelos respectivos DEVs somente nesses bancos.
- Infraestrutura de perfis: três testes passaram (isolamento, recusa de perfil divergente e de destino arbitrário), TypeScript passou. Commit de base: 480c0a3.
- Primeira revisão EMAIL: tester validou fila/página 5/5 e identidade/envio/SQL 12/12. Integração repetiu 5 unitários e 10 integrações de identidade/envio; encontrou diferença de microssegundos no fixture SQL independente, corrigiu para relógio do banco e verificou 2/2 cenários SQL. Guard de convite vigente e preservação Q74 confirmados; tratamento Q166 permanece aberto. Não há homologação externa nem alegação de fluxo completo.
- Build da branch de integração após a fila EMAIL passou em 16/09, incluindo `/secretaria/envios-portal`, com banco descartável explicitamente selecionado e envios desligados. Esse build precede a integração do commit VIDEO 51d4ff8 e não o valida.
- Comandos por worktree: `node scripts/prepare-test-profile.mjs`; executável local Prisma generate; Vitest local com `-c vitest.integration.config.ts`. Preparação/instalação das dependências é exclusiva do integrador.
- Prisma manual seguro: `node scripts/prisma-teste.mjs generate`, `node scripts/prisma-teste.mjs migrate deploy` ou `node scripts/prisma-teste.mjs migrate status`. O comando injeta somente a URL do perfil local, não usa npx e não permite reset. Vitest já aplica migrações automaticamente no mesmo perfil.
- Não abrir terceira funcionalidade. Bloqueios externos não devem aparecer como falta de código nem ser ocultados por testes locais.

## Evidência de base

- Interface Q166 `fc69c8e` e revisão independente `8c056f9` integradas: evidência/autoria/data visíveis, controles por capacidade e pessoa independente, retorno de erro/sucesso e refresh. Sete testes de fila/SSR passaram na integração; tipos e lint passaram. Regressão global de integração iniciada nesta rodada, ainda sem resultado final. Não houve envio externo.

- Q166 integrada até `d0afd53`, com testes independentes `43c579b`/`a351a5d`: 45 unitários, TypeScript e lint passaram. A suíte ampliada do portal teve 63/66 aprovados; os três erros vinham do fixture antigo de gravação sem fonte fixa. Após atualizar esse fixture para a publicação vigente, seus 9/9 testes passaram. Nenhuma proteção foi afrouxada. Interface Q166 segue em ajuste: evidência visível ao aprovador e feedback de cada operação; a frente ainda não está concluída.

- Paginação VIDEO integrada até `63811e4`: alvos e propostas têm limites e cursores, incluindo término independente de cada lista; contexto mostra matrícula/aluno e data da aula. Decisão exige motivo informado e a interface respeita `podeDecidir` por proposta. Na integração passaram 107 testes do recorte, TypeScript e lint. Testes independentes foram preservados e os cenários assimétricos ficaram em arquivo próprio; revisão final do TESTER ainda em conferência.

- Q166: corretivas 152/153 no DEV EMAIL. P3015 da 153 foi causado por arquivo Windows-1252 inválido para UTF-8; integrador confirmou os bytes, converteu antes da aplicação e executou deploy Prisma com sucesso no banco exclusivo DEV. Migrações aplicadas permanecem preservadas. Teste de codificação dos SQL foi acrescentado e passou na integração; testes funcionais da Q166 continuam no DEV/TESTER.

- Integração VIDEO em 16/09: 102 testes unitários/rotas/SSR e 44 integrações passaram na branch principal de trabalho, com migrações 147/149 no banco descartável `erp_genius_test`; TypeScript e conferência de whitespace passaram. Inclui publicação, reposição e regularização docente. Ajustes incrementais da tela seguem no DEV; não houve homologação externa.
- Após `99741ba`, build Next.js passou (76 páginas estáticas, incluindo a rota dinâmica de regularização) e regressão unitária completa passou: 188 arquivos, 1.329 testes. Lint dos novos módulos de fonte fixa e regularização passou. Esta evidência precede os próximos ajustes da tela e a integração Q166.

- Rodada de 16/09: integração do worker EMAIL aprovada em 3 cenários (concorrência sem duplicidade, incerteza sem reenvio automático e rotina desligada sem token/transporte), com provedor simulado; TypeScript passou após ajustar o estreitamento do retorno no fixture. Não comprova entrega externa.
- TESTER validou VIDEO `51d4ff8` + `7bc0f41`: 97 testes unitários/rotas/SSR e 10 integrações; reforços independentes em `2466a48`. Ainda em revisão: paginação da fila, identificação do destino, motivo real de decisão e estabilidade da chave de tentativa na tela. Q166 `523743c` segue em revisão independente, incluindo recuperação assistida Q74 e repetição de decisão após mudança de estado. Nenhuma das duas frentes está encerrada.

Commit consolidado afc9a42. Regressão de integração 611 concluída: 1.292 testes aprovados. Unitária 618: 1.318 aprovados. Essas execuções não comprovam as novas entregas acima nem substituem homologação real. Relatórios e auditorias anteriores são históricos; atualizações futuras de estado ficam neste quadro.
