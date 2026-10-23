# QA independente #321 — aviso e capacidades do painel

**Commit exato:** 9d0225b4da449159e755448945bc1c89f1b61355, pai 1bb721b7e6e72bbfd8f5f8fe7f3f944bef0440b3. **Parecer:** favorável ao escopo de código e integração dirigido; a compilação real de /inbox e os gates agregados pertencem ao integrador. Sem nova UI/captura.

## Fonte e contrato

O delta produtivo tem quatro arquivos: novo helper src/server/inbox/aviso.ts, projeção em permissoes.ts, import/tipo em aria/permissoes-tela.ts e delegação de uma linha em whatsapp/acoes-atendimento.ts. O helper executa UPDATE parametrizado sem mudar id. A migração existente tem trigger AFTER UPDATE FOR EACH ROW, sem condição WHEN; o NOTIFY contém tipo e IDs, e o PostgreSQL só o entrega no commit. O helper não lê dados nem autoriza um usuário; seu único chamador novo é interno e recebe o tx já autorizado de convite/revogação. A inspeção da ordem confirma escopo e alçada antes do toque, preservando idempotência e aviso direcionado ao revogado.

A projeção de dez capacidades usa as matrizes existentes CRM/Aria. Editar contato/tags, criar tag, mover etapa e desfazer Aria exigem finalidade COMERCIAL e veLead já autorizado. D13 não abre ações comerciais a outro setor. verEmpresa corresponde ao guard da ficha Empresa: FINANCEIRO ou ADMINISTRADOR implícito. verContato é apenas sinal de alçada CRM; carregarPainel e as consultas do setor continuam responsáveis por conteúdo sensível. O vendedor responsável de D1 não é inferido de veLead: desfazer depende do contexto/guard futuro #354, sem alterar a matriz global Aria. O tipo de capacidadesAria foi estreitado para Pick de papeis; validarAlteracaoPorPapel permanece igual. Nenhum consumidor usa ainda capacidadesPainel como autorização.

O módulo de permissões é importado em AcoesAtendimento cliente; os testes Vite abaixo exercem esse caminho, mas não substituem a compilação Next de /inbox que o integrador reservou. A importação de ErroPermissao por _shared/sessao mantém a classe original sem barrel.

## Execuções próprias

- Node 22.23.2, unitário: src/server/inbox/permissoes.test.ts, src/server/crm/permissoes.test.ts, src/server/aria/permissoes-tela.test.ts, maxWorkers2. Chunk c94895, terminal **exit 0**, 3 arquivos/77 testes, sem skips reportados.
- Consumidores cliente: AcoesAtendimento.test.ts, MenuConversa.test.ts, useAcoesAtendimento.test.ts, maxWorkers2. Chunk d0cd16, terminal **exit 0**, 3 arquivos/30 testes, sem skips reportados.
- Integração real no perfil tester reservado, vitest.integration.config.ts, maxWorkers1, MOTOR_URL/MOTOR_API_KEY/OPENAI_API_KEY/ANTHROPIC_API_KEY vazios: src/server/inbox/aviso.int.test.ts e src/server/whatsapp/participantes-aviso.int.test.ts completos. Chunk 8d7b30, terminal **exit 0**, 2 arquivos/8 testes, 25,50 s. Inclui listener PG antes da normalização, payload sem campos privados, commit/rollback/ID inexistente e regressão de convite/revogação. Banco liberado ao integrador após a saída; não o restaurei nem iniciei servidor.
- git diff --check do pai ao commit sem saída; não alterei produção, testes ou dependências. Cinco outputs320 que colidiam com arquivos versionados foram preservados no meu output/qa-private-history/checkout-321/manifesto-preservacao.json com bytes e SHA antes do checkout.

Avisos de configuração Vitest MIXED_EXPORTS e vite-tsconfig-paths foram exibidos sem falha. Estes recortes não são suíte global, TypeScript próprio nem prova de bundle Next. Não houve browser, transporte externo, instalação ou mudança de schema/package/lock.
