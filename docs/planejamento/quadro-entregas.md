# Quadro único de entregas

Atualização: 16/09/2026. Métrica: funcionalidades concluídas, em andamento e bloqueadas; tempo de ciclo registrado desde início até aceite. Não utilizar 36,9% como progresso global.

| Entrega | Responsável | Estado | Início | Aceite/commit |
|---|---|---|---|---|
| EMAIL — acesso ao portal e operação dos envios | DEV 1 Terra | Fila/guard SQL validados; Q166 em implementação | 16/09/2026 | Integração parcial revisada; aceite completo pendente |
| VIDEO — publicação e reprodução de revisão fixa | DEV 2 Terra | Servidor/SQL integrado e validado; ajustes da tela em implementação | 16/09/2026 | 51d4ff8 + 7bc0f41 + testes 2466a48; aceite completo pendente |
| Revisão independente EMAIL/VIDEO | TESTER Terra | EMAIL parcial validado; revisão VIDEO encaminhada ao DEV | 16/09/2026 | Q166 e VIDEO aguardam commits completos |

## EMAIL — aceite do DEV

- Secretaria/Administração localiza e acompanha solicitações com paginação e permissões revalidadas. Tela distingue preparado, aceito pelo provedor, incerto e demais estados sem apresentar aceitação como entrega.
- Convite, recuperação e validação de troca usam o despacho existente; operação não revela token/senha/credencial. Contato antigo não ativa convite após alteração; proteção equivalente no banco e testes de concorrência.
- Resultados incertos têm caminho operacional rastreável e seguro, preservando evidências; não reenviar automaticamente, não inventar confirmação do provedor e não reutilizar token vencido. Qualquer decisão de negócio realmente ausente deve ser destacada, sem bloquear trabalho independente.
- Q166 aprovada em 16/09: Secretaria registra evidência; Administração autoriza nova emissão quando necessária. Aprovação independente, novo token/revogação do anterior e preservação da tentativa original. Migração 148 reservada para esse fluxo; não alterar a 146 já aplicada.
- Revisão Q166: separar registro de evidência da elegibilidade de nova emissão; permitir conferências versionadas após rejeição/estado obsoleto; preservar recuperação assistida Q74; validar no SQL autoria, aprovação e vínculo da nova intenção. Migração 148 já aplicada somente no DEV: correções reservadas na 150, preservando 148. TESTER revisará a corretiva antes da aplicação, enquanto DEV avança tela/testes.
- Fluxo banco/servidor/tela/testes e SPEC na mesma entrega. Migração reservada: 146. Código de integração externo permanece desligado até homologação; limites externos ficam separados da implementação local.

## VIDEO — aceite do DEV

- Publicação fixa uma revisão organizacional do Drive e reprodução usa essa revisão para todos os ranges, com autorização contínua. Adapters 612/613 precisam estar realmente ligados ao fluxo.
- Fontes substitutas são append-only, vinculadas à aprovação independente. Não modificar origem histórica nem inventar revisão para material legado; indicar regularização necessária.
- Integrar publicação, materiais de reposição, rotas de reprodução, estados de erro e telas necessárias. Preservar autoria, permissões, prazos e dados já existentes.
- Migração reservada: 147, independente da 146 de identidade. Rascunho 146 antigo de Drive é referência rejeitada, não migração pronta. Testes devem comprovar troca de head sem mistura de bytes, legado incompleto, aprovação e revogação.
- Provedor real, desempenho/custos e credenciais continuam sujeitos a homologação separada; não enviar PATCH real nem declarar integração homologada com mock.
- Revisão de implementação em 16/09 identificou: fixação usando credencial readonly; substituição de material sem conferir a fonte completa da publicação vinculada; ausência de guard SQL do preparador; chave idempotente sem comparar entrada; aprovação sem reconferir a revisão no Drive. DEV recebeu correções e cenários de teste. Migração 147 já aplicada apenas no banco DEV: preservar seu conteúdo exato e usar a 149 para correções SQL, mantendo 148 reservada para EMAIL.
- A revisão inclui a tela de proposta/consulta/aprovação de fontes substitutas e material legado. Actions e mensagens de erro sem caminho operacional não fecham o aceite. O exemplo de ambiente agora distingue credenciais de publicação/escrita das credenciais de leitura do player.

## Integração e revisão

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

- Paginação VIDEO integrada até `63811e4`: alvos e propostas têm limites e cursores, incluindo término independente de cada lista; contexto mostra matrícula/aluno e data da aula. Decisão exige motivo informado e a interface respeita `podeDecidir` por proposta. Na integração passaram 107 testes do recorte, TypeScript e lint. Testes independentes foram preservados e os cenários assimétricos ficaram em arquivo próprio; revisão final do TESTER ainda em conferência.

- Q166: corretivas 152/153 no DEV EMAIL. P3015 da 153 foi causado por arquivo Windows-1252 inválido para UTF-8; integrador confirmou os bytes, converteu antes da aplicação e executou deploy Prisma com sucesso no banco exclusivo DEV. Migrações aplicadas permanecem preservadas. Teste de codificação dos SQL foi acrescentado e passou na integração; testes funcionais da Q166 continuam no DEV/TESTER.

- Integração VIDEO em 16/09: 102 testes unitários/rotas/SSR e 44 integrações passaram na branch principal de trabalho, com migrações 147/149 no banco descartável `erp_genius_test`; TypeScript e conferência de whitespace passaram. Inclui publicação, reposição e regularização docente. Ajustes incrementais da tela seguem no DEV; não houve homologação externa.
- Após `99741ba`, build Next.js passou (76 páginas estáticas, incluindo a rota dinâmica de regularização) e regressão unitária completa passou: 188 arquivos, 1.329 testes. Lint dos novos módulos de fonte fixa e regularização passou. Esta evidência precede os próximos ajustes da tela e a integração Q166.

- Rodada de 16/09: integração do worker EMAIL aprovada em 3 cenários (concorrência sem duplicidade, incerteza sem reenvio automático e rotina desligada sem token/transporte), com provedor simulado; TypeScript passou após ajustar o estreitamento do retorno no fixture. Não comprova entrega externa.
- TESTER validou VIDEO `51d4ff8` + `7bc0f41`: 97 testes unitários/rotas/SSR e 10 integrações; reforços independentes em `2466a48`. Ainda em revisão: paginação da fila, identificação do destino, motivo real de decisão e estabilidade da chave de tentativa na tela. Q166 `523743c` segue em revisão independente, incluindo recuperação assistida Q74 e repetição de decisão após mudança de estado. Nenhuma das duas frentes está encerrada.

Commit consolidado afc9a42. Regressão de integração 611 concluída: 1.292 testes aprovados. Unitária 618: 1.318 aprovados. Essas execuções não comprovam as novas entregas acima nem substituem homologação real. Relatórios e auditorias anteriores são históricos; atualizações futuras de estado ficam neste quadro.
