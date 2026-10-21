# Quadro único de entregas

Atualização: 21/09/2026. Este resumo e a tabela representam o estado corrente; as notas de verificações abaixo preservam etapas anteriores. Medir funcionalidades concluídas, em andamento e bloqueadas, sem reutilizar 36,9% como progresso global.

## Pendências da revisão do #227 e do #231 (18/10/2026)

Branch `claude/pendencias-227-231`. Três pendências de revisão de PRs já mergeados.

- **#231 C1, aviso direcionado no `npm test`**: o caminho de permissão do aviso com `paraUsuarioId` só tinha cobertura em `*.int.test.ts`. Agora `src/server/inbox/eventos-sse.test.ts` (prisma e escopo mockados, ambos "fora do escopo") cobre: o destinatário recebe sem consultar o escopo; outro usuário não recebe, nem com o atendimento no escopo dele; `mensagem.nova` e `mensagem.status` com `paraUsuarioId` são barrados; o aviso comum fora do escopo é barrado; `formatarSSE` não emite `paraUsuarioId` nem o id do destinatário. Só teste; o código já fazia isso.
- **#227 C1, escrita de cache registrada**: a coluna `ChamadaIA.tokensEscritaCache Int @default(0)` (migration `20261018070000_chamada_ia_escrita_cache`, só `ADD COLUMN ... DEFAULT 0`) é gravada por `registrarChamadaIA` (0 nas falhas). O valor já entrava em `custoMicroUsd`. Testes: `src/server/aria/uso.test.ts` (mapeamento com prisma mockado) e `uso.int.test.ts` (coluna lida do banco, padrão 0).
- **#227 C2, fator conforme o ttl**: `fatorEscritaCache(ttl)` devolve 1,25× para o cache efêmero de 5 min (sem `ttl` ou `"5m"`) e 2× para `ttl: "1h"`. O `cache_control` do sistema virou `CACHE_CONTROL_SISTEMA` em `custo.ts`, usado por `provedor/anthropic.ts`, e o fator sai do `ttl` dele: trocar o ttl muda o custo junto. Hoje segue sem ttl (1,25×). Testes em `custo.test.ts`.
- `tsc --noEmit`: saída 0. `eslint .`: 0 erros (40 avisos já existentes, nenhum nos arquivos tocados). `npm test`: 734 arquivos, 5454 testes verdes.
- Banco descartável `erp_genius_test_pend227`: todas as migrations aplicadas em sequência num banco limpo, e `ChamadaIA` sem diferença em relação ao schema. Integração de `src/server/aria` e `src/server/inbox`: 13 arquivos, 127 testes verdes.
- **Estado**: implementado, aguarda revisão.

## Inbox novo — pendências da revisão do #223 (18/10/2026)

Branch `claude/pendencias-223`. Duas pendências da revisão do #223 (mergeado em 31304a7e).

- **C1, a revogação chega ao ex-convidado**: depois da revogação o ex-convidado sai do `escopoAtendimentos`, e o filtro do SSE descartava o `atendimento.atualizado`. Agora `revogarParticipante` também emite, na mesma transação, um `pg_notify` direcionado. Ele leva só ids (`tipo`, `atendimentoId`, `mensagemId: null`, `conversaId`) e `paraUsuarioId` = o revogado. `criarFiltroDeAvisos` deixa esse aviso passar só para esse usuário, sem consultar o escopo, e só no tipo `atendimento.atualizado`. Os demais usuários não recebem o aviso direcionado, e `formatarSSE` não repassa o `paraUsuarioId`. No cliente, a recarga do painel que volta 404 (fora do escopo) mantém o último painel com `podeEnviar: false` e sem ações, e o compositor trava sem reabrir. Um 404 na carga inicial continua como erro com "Tentar de novo". Sem migration.
- **C2, paginação do encaminhar**: `buscarDestinosEncaminhar` aceita o `cursor` e devolve `{ itens, proximo }`. O diálogo mostra "Carregar mais" (o padrão da lista do Inbox novo) enquanto houver `proximo`. O botão segue a busca aplicada, acrescenta sem repetir linhas e mantém a lista se a página falhar. Uma página que fica vazia depois do filtro de origem, grupo e opt-out não mostra o estado vazio enquanto houver próxima página.
- Testes: integração em `participantes-aviso.int.test.ts` (o ex-convidado recebe só o aviso direcionado, um terceiro fora do escopo não recebe nada e o responsável recebe só o aviso comum) e em `eventos-sse.int.test.ts` (o filtro do aviso direcionado e o quadro sem o destinatário). Componente em `InboxNovo.interacao.test.ts` (404 na recarga e na carga inicial) e em `AcoesMensagem.test.ts` (cursor, "Carregar mais" e falha ao carregar mais).
- `tsc --noEmit`: saída 0. `eslint .`: 0 erros (40 avisos, já existentes, nenhum nos arquivos tocados). `npm test`: 732 arquivos, 5423 testes verdes.
- Integração no banco descartável `erp_genius_test_pend223`: `src/server/inbox` (7 arquivos) e os 8 arquivos de atendimento e participante de `src/server/whatsapp`, ao todo 15 arquivos e 114 testes verdes. `src/app/api/inbox` não tem `.int.test.ts`; os testes de rota dela rodam no `npm test`.
- **Estado**: implementado, aguarda revisão.

## Pendências do #226 (Fase 5B), revisão R2 — N2 (18/10/2026)

Branch `claude/pendencias-226`. A regra `uploadLivreDoAutor` (`src/server/uploads/autorizacao.ts`), que libera um upload para a base de conhecimento da Aria, só tinha cobertura em `*.int.test.ts`, fora do CI. Agora `autorizacao.test.ts` (prisma mockado, roda no `npm test`) cobre: upload de outro autor → `null`; vínculo por lead, aluno, cobrança ou matrícula → `null`; referência como comprovante de cobrança, informe de pagamento, documento, mídia de mensagem ou de intenção de WhatsApp → `null`; upload livre do próprio autor → aceito. Cinco mutações da regra (autoria, vínculos, matrícula, referências, intenção) fazem o teste falhar.

- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros (40 avisos já existentes). `npm test`: 726 arquivos, 5386 testes verdes.
- **Estado**: só teste; nenhuma mudança de código de produção. Aguarda o merge.
## Auditoria de regras atualizada para as APIs atuais (18/10/2026)

Branch `claude/auditoria-atualizada`, base `main` (após o #222). A suíte `scripts/auditoria/cenarios.test.mjs` passou de 18 verdes, 10 falhas e 1 pulado para **28 verdes e 1 pulado (F03, inconclusivo por mocks, como antes)**. Nenhuma das 10 falhas era defeito do produto: todas vinham de contrato de API ou regra nova intencional. Nenhum critério auditado foi afrouxado.

- **F01, F02, F05, F06, W06**: `registrarPagamento` exige `chaveIdempotencia` (16 caracteres ou mais) e evidência da destinação (`comentario`, 5 caracteres ou mais). O helper `pagamento()` passou a enviar os dois campos.
- **F01**: um ajuste pedido pela administração agora gera `Aprovacao` (alçada nova). O cenário confere `{ aprovacao: true }` e faz uma segunda pessoa da direção aprovar (`decidirAprovacao`) antes de medir o saldo.
- **F05, F06**: a ativação exige um contrato vigente confirmado pela secretaria e a cobertura da primeira mensalidade conferida. O helper `contratoConfirmado()` monta essas pré-condições no banco, como faz `comissao-aprovada-em.int.test.ts`. A ativação também exige evidência (`comentario`).
- **F07** (regra nova): o recebimento já não ativa a matrícula sem contrato confirmado. O cenário prova que a ativação é recusada e que a matrícula continua `AGUARDANDO`, com `contratoOk=false` e sem quem confirmou.
- **F08** (regra nova): a retomada direta foi desativada. O cenário prova que `reativarAluno` recusa e que a própria solicitante não aprova a retomada. A retomada passa por `solicitarRetomada` e pela aprovação de outra pessoa do Financeiro (`decidirRetomada`), e a cobrança futura volta a `PENDENTE`.
- **F11** (regra nova): os tipos de documento são editados por id. O cenário prova que excluir um tipo em uso é recusado e que renomear pelo id preserva o `tipoDocumentoId` do aluno.
- **A01** (e C03): o escopo docente exige `VinculoDocente` vigente. O helper `turma()` cria esse vínculo, e o C03 deixou de passar sem testar nada.
- **A06** (contrato novo): a busca fora do escopo devolve listas vazias em vez de um erro. O cenário usa um atendimento real da secretaria e faz uma contraprova: o administrador encontra o aluno e o professor não, com ou sem o `atendimentoId`.
- O `vitest.config.ts` da auditoria passou a usar o banco do perfil de teste (`DATABASE_URL_TESTE`, o mesmo do `globalSetup`) e a apagar `MOTOR_URL` e `MOTOR_API_KEY`.
- Verificação: auditoria com 28 verdes e 1 pulado (banco descartável). `tsc --noEmit` com saída 0. `npm run lint`: 0 erros e 40 avisos. `npm test`: 715 arquivos e 5308 testes verdes.
- **Estado**: implementado; aguardando revisão.
## Inbox novo — encaminhar e aviso de convite (18/10/2026)

Branch `claude/inbox-encaminhar-convite`. Pendências deixadas pela Fase 4D (#219) e pelo #220.

- **Encaminhar**: o comando entra em `COMANDOS_MENSAGEM_LIGADOS`. Ele exige a capacidade do número (`encaminhar` entra em `RECURSOS_MOTOR`: MOTOR ativo e sessão CONECTADO), o envio liberado (`envioLiberado === true`) e a mensagem não apagada. Abre o diálogo `EncaminharMensagem` (`Modal`), que lista o destino pela lista do Inbox novo (`GET /api/inbox/atendimentos?numeroId=…&envio=1&busca=…`). Com `envio=1`, a lista usa o escopo de envio. Ficam de fora a própria origem, os grupos e os contatos em opt-out. O envio roda no `ConfirmarAcao`, que entra na lista fechada de `confirmacoes-mapa.ts`. A action `encaminharMensagemWhatsApp` já revalidava no destino o envio, o encerramento, o opt-out, o mesmo número e a sessão do motor. Novos testes de integração cobrem o convidado só com leitura, o destino encerrado, a sessão caída e a mensagem apagada.
- **Aviso no SSE**: `convidarParticipante` e `revogarParticipante` fazem, na mesma transação, um UPDATE sem mudança no `AtendimentoWhatsApp`. O trigger `notificar_inbox` já existente emite `atendimento.atualizado`, sem migration. O ID reservado 20261018500000 não foi usado.
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros (os avisos já existiam). `npm test`: 719 arquivos, 5334 testes verdes.
- Integração no banco descartável `erp_genius_test_encaminhar`: `src/server/inbox` com 7 arquivos e 67 testes; `src/server/whatsapp` com 53 arquivos e 414 testes. Tudo verde, motor simulado.
- **Estado**: implementado, aguarda revisão.

## Decisões do dono 17/10/2026

Registro completo em [decisoes-dono-2026-10-17.md](decisoes-dono-2026-10-17.md). Branch `claude/decisoes-dono-17-10`.

| Tema | Decisão | Efeito no quadro |
| --- | --- | --- |
| Q7 (comissão) | O estorno continua manual, feito por FINANCEIRO ou ADMINISTRADOR, com motivo obrigatório e auditoria. O estorno automático no cancelamento fica descartado por enquanto (desistência no prazo, troca de turma, reativação). Uma sugestão automática para o Financeiro confirmar pode ser avaliada no futuro. | Resolve a pendência bloqueante da Q7 no bloco F2-I (gate da Task 35): a Task 35 fica no PR, com a matriz da Task 4. |
| Q6 (React) | A Fase 3 fica no React 18.3. A migração para o 19 vira um PR separado, depois das Fases 3 e 4. | `decisao-react-inbox.md`: "Status: decidido pelo dono em 17/10/2026". |
| LC-D02 × doc 36 | Vale a LC-D02. O dono da linha vê todas as conversas da própria linha; o painel e o cockpit do lead de outro vendedor continuam fechados. | Doc 36 atualizado. O `c265d904` recebe o aval do produto e não precisa ser revertido. |
| Fuso | `US/Eastern` sai das sugestões e é trocado por `America/New_York`. Apelidos legados (`US/*`, `Brazil/*`) são convertidos para o nome canônico IANA ao salvar a preferência. | Mapa `APELIDOS_FUSO_LEGADOS` com teste. Migration de dados `20261017150000_fuso_exibicao_canonico` para `Usuario."fusoExibicao"` e `ContaPortalAluno."fusoExibicao"`. `fuso-exibicao.int.test.ts` passa no Postgres do sistema (sem `tzdata-legacy`). |
| Transferência e `AULA_FORA_DE_VINCULO_CONFERIDO` | A transferência não deve travar o fechamento do nível. | Implementação em outro PR, que precisa da validação da secretaria acadêmica. Só citada aqui. |

- **Estado**: decisões registradas; a parte de fuso está implementada nesta branch e aguarda o merge.

## Fase 3, bloco D — tempo real e paginação (17/10/2026)

Branch `claude/fase3-d-tempo-real` (PR empilhado sobre `claude/fase3-b-escopo-roteamento`). Tarefas 21 (aviso no banco, migration `20261017100000_inbox_tempo_real`, e barramento `LISTEN`), 22 (rota SSE `/api/inbox/eventos` filtrada por escopo) e 23 (lista e thread paginadas por cursor, filtros da URL).

- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 670 arquivos, 4831 testes verdes.
- `npm run lint`: saída 0; 0 erros (43 avisos já existentes).
- Integração, recorte por `vitest related -c vitest.integration.config.ts` nos arquivos do bloco (migration aplicada só no banco do perfil de teste): 18 arquivos, 157 testes; 17 arquivos verdes (151 testes) e 6 falhas em `academico/visibilidade.int.test.ts`, preexistentes na linha de base (falham igual no `main`). Nenhuma falha nova. Não é a suíte completa.
- **Estado**: implementado; aguarda o merge do bloco B e o integrador. Não concluído.

## Fase 3 — IDs de migration (16/10/2026)

Branch `claude/fase3-a-modelo-atendimento` (PR #197, base `main`). Os cinco IDs foram **confirmados pelo integrador** (o controlador da sessão) em 16/10/2026, com registro no ledger de execução, sem renomear (ordem coerente: depois de 20261001/20261002 da #194). Estado por ID:

| Migration | Task | Pasta | Estado do ID |
| --- | --- | --- | --- |
| M1 `numero_setor_whatsapp` | 2 | `20261016090000_numero_setor_whatsapp` | Confirmado pelo integrador |
| M2 `atendimento_status_prazos` | 4 | `20261016100000_atendimento_status_prazos` | Confirmado pelo integrador |
| M3 `grupos_whatsapp` | 6 | `20261016110000_grupos_whatsapp` | Confirmado pelo integrador |
| M4 `origem_celular_client_message_id` | 7 | `20261016120000_origem_celular_client_message_id` | Confirmado pelo integrador |
| M5 `preferencias_inbox_usuario` | 8 | `20261016130000_preferencias_inbox_usuario` | Confirmado pelo integrador |

- Os cinco IDs são posteriores à última migration do `main` mesclado e foram aplicados com `prisma migrate deploy` num banco descartável próprio (`erp_genius_test_fix197`, apagado depois). As próximas migrations da Fase 3 partem de um ID posterior a `20261016130000`, reservado pelo integrador.
- Regra de status (revisão final do bloco A): responsável preenchido conta como assumido. Backfill da M2, `garantirAtendimento`, `atendimentoComercialDaLinha` (linha VENDAS nasce `EM_ATENDIMENTO` quando há dono) e `atribuirDono` (reatribuição tira de `ABERTO_SEM_RESPONSAVEL`; `AGUARDANDO_CLIENTE` se mantém) seguem a mesma regra.
- Evidências da correção: `tsc --noEmit` saída 0; integração (recorte, não suíte completa) `linha-comercial`, `acesso/politica`, `atendimento-status` e `reabertura` `.int.test.ts`: 4 arquivos, 48 testes verdes; unitários `vitest related` de `linha-comercial.ts` e `comercial/acoes.ts`: 82 arquivos, 717 testes verdes (inclui o ajuste de `linha-comercial.test.ts` ao filtro `grupoId: null` de `baa2e7ed`); eslint 0 nos arquivos tocados.
- **Estado**: IDs confirmados pelo integrador em 16/10/2026 (ordem coerente: depois de 20261001/20261002 da #194). Não concluído: o bloco aguarda o merge.

## Design system, bloco DS-A — fundação (Fase 0, Tasks 1–4; 15/10/2026)

### Solução implementada (branch `claude/fase0-ds-a-fundacao`)
- Tokens WDS claro/escuro nos blocos `:root` e `.dark` de `src/app/globals.css` (tabela de tokens do plano
  `00-fase-design-system.md`), com `--surface-raised`, `--highlight`, `--pressed`, `--border-soft`, `--text-disabled`,
  `--brand-strong`, `--on-brand-solid`, `--cold-text`, `--entry`, `--entry-accent`, `--composer` e as duas sombras de
  camada. Spec copiado para `docs/planejamento/design-system-referencia.md`.
- `src/app/contraste.test.ts` recalcula pelo `globals.css` o texto de cada fundo sólido (par de `TEXTO_SOBRE_SOLIDO`,
  ≥ 4,5:1), a borda de controle (≥ 3:1) e o `--brand-solid` sobre as superfícies, nos dois temas.
- `tailwind.config.ts`: cores novas (`on-brand`, `surface-raised`, `highlight`, `pressed`, `border-soft`, `disabled`,
  `entry`, `entry-accent`, `composer`, `cold-700`, `brand-800`), raios (`rounded-item`, `rounded-dialog`) e só
  `shadow-popover`/`shadow-dialog`.
- Roboto variável (`src/app/fonts/roboto-variable.woff2`, licença Apache 2.0 oficial do `googlefonts/roboto` em
  `LICENSE-Roboto.txt`) por `next/font/local`; pesos 400, 500 e 600 (`tipografia.test.ts`).
- Fundo sólido da marca usa `text-on-brand` (branco no claro, preto no escuro); `Botao.primario` e o doc 18 atualizados.

### Verificação
- Na HEAD `ce4895c` (revisão final): `tsc --noEmit` saída 0; `npm test` saída 0, 647 arquivos e 4.573 testes;
  `npm run lint` saída 0, 0 erros e 44 avisos. O único aviso em arquivo alterado é `Sidebar.tsx:43` (setState em
  effect), que já existia em `f8a9c0e`.
- Depois das correções da revisão (só doc 18, licença e este quadro): `npm test` saída 0, 647 arquivos e 4.573 testes.
- Verificação do integrador (15/10/2026, HEAD `93bcba3`): `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0
  (647 arquivos, 4.573 testes; linha de base da main: 646 e 4.560); `npm run lint` saída 0 (0 erros, 44 avisos).
- Sem schema nem migração; `*.int.test.ts` não alterados.

### Pendências
- Componentes base (botões em pílula, camadas com sombra, alvos de 44 px) e telas: blocos seguintes da Fase 0.
- Conferir no navegador (UAT) os dois temas com a Roboto.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Fase 1A — verificação do bloco (15/10/2026)

- Branch `claude/fase1-a-linha-de-base`; tarefa 1 do plano (E0: fontes da fase 1 e linha de base de testes). Só `docs/` mudou em relação à `main`; `src/`, `prisma/` e `package*.json` sem diferença.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 646 arquivos, 4560 testes, 0 falhas (igual à linha de base).
- `npm run lint`: saída 0; 0 erros, 44 avisos preexistentes.
- `npm run test:int` (perfil `dev-email`): saída 1, 16 arquivos com falha, 174 passaram, 3 pulados; 44 testes falharam, 1712 passaram, 4 pulados. Mesmos totais e mesmas 44 falhas da LB_FALHAS abaixo; nenhuma falha nova. Duração 7139 s.

## Fase 1B — aceite parcial do bloco (PR 2, 16/10/2026)

- Branch `claude/fase1-b-jobs`; tarefas 2 a 5 do plano (jobs e entrada automática da casca), commits `9e5d7bd`, `53c69b4`, `ea28099` e `ccd3015` sobre `d771ad1`. Perfil `dev-email` (banco `erp_genius_test_dev_email`), a mesma exceção ao `tester` registrada na linha de base.
- `git diff --stat main -- prisma/ package.json package-lock.json`: vazio.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test` (`vitest run --reporter=json`, suíte completa, sem filtro): saída 0; 646 arquivos, `numTotalTests` 4561, `numFailedTests` 0, `success` true. `comm -13 tmp/lb-unit-falhas.txt tmp/b-unit-falhas.txt`: vazio.
- `npm run test:int` **somente em recorte** (não é a suíte completa): os 8 `*.int.test.ts` alterados no bloco (`cobrancas/acesso-aulas`, `comercial/captura`, `matricula/fechamento`, `whatsapp/acesso-atendimento`, `whatsapp/confirmacao-experimental`, `whatsapp/fila-comercial`, `whatsapp/linha-comercial`, `whatsapp/piloto-bloqueadores`): saída 0, 8 arquivos, 80 testes, 0 falhas. Os que importam `inbound`, `historico` ou os webhooks (`whatsapp/saude`, `whatsapp/cron`, `whatsapp/inbox`, `whatsapp/despachante-comercial`): saída 1, 4 arquivos, 49 testes, 1 falha, que é `inbox.int.test.ts › cockpit do vendedor na thread … (escopo row-level P1)`, já na LB_FALHAS. `comm -13 tmp/lb-int-falhas.txt tmp/b-int-recorte-falhas.txt`: vazio. As 4 falhas de `whatsapp/cron-gestao.int.test.ts` da LB_FALHAS somem porque o arquivo foi removido na tarefa 4.
- **Pendente para o integrador antes do merge:** rodar o `npm run test:int` completo (leva mais de 2 h, e a regra desta faixa proíbe rodá-lo), comparar com `comm -13 tmp/lb-int-falhas.txt tmp/b-int-falhas.txt`, registrar aqui código de saída e totais e abrir o PR 2 em rascunho.
- **Pendência registrada: `scripts/auditoria/cenarios.test.mjs:30`.** O script ainda importa `rodarLeadNovoSemResposta` e `rodarPreExperimental` de `@/server/whatsapp/cron-comercial`, removido na tarefa 3. Como fica fora do `tsc` e do `vitest`, quebra só quando alguém o executa. Ele deve ser ajustado ou retirado no bloco que tratar `scripts/auditoria`, ou antes disso, se alguém precisar rodar o script.
- `vitest related --run -c vitest.integration.config.ts` sobre os .ts/.tsx do bloco (16/10/2026, sem os removidos): saída 1; 17 arquivos, 15 passaram, 2 falharam; 7 testes falharam, 151 passaram. As 7 falhas (1 em `whatsapp/inbox.int.test.ts` e 6 em `academico/visibilidade.int.test.ts`) estão todas na LB_FALHAS; nenhuma falha nova. `tsc` 0, `npm test` 646 arquivos/4561 testes saída 0, `npm run lint` saída 0 (0 erros, 44 avisos).
- Evidência local não versionada: `tmp/b-tsc.txt`, `tmp/b-unit.json`, `tmp/b-unit-falhas.txt` (vazia), `tmp/b-int-recorte.json`, `tmp/b-int-recorte2.json` e `tmp/b-int-recorte-falhas.txt` (1 linha).

## Fase 1C — aceite do bloco (PR 3, 16/10/2026)

- Branch `claude/fase1-c-telas`; tarefas 6 a 10 do plano (telas da casca), commits `b2a63e3` (/pipeline), `e81f5e5` (/carteiras), `358d17c` (/comissoes), `1f6c1b2` (configuração e régua comercial do WhatsApp) e `25365ac` (HomeVendedor) sobre `4472e76`, mais o commit de correção da revisão final. Perfil `dev-email`, a mesma exceção ao `tester` registrada na linha de base.
- `git diff 4472e76..HEAD -- prisma package.json package-lock.json`: vazio.
- Conferido na revisão final no HEAD `25365ac`:
  - `node_modules/.bin/tsc --noEmit`: saída 0.
  - `vitest run` (suíte unitária completa, sem filtro): saída 0; 4524 testes, 0 falhas. A queda em relação aos 4561 do Bloco B vem dos testes das telas removidas.
  - `npm run lint`: 0 erros, 44 avisos (a mesma contagem do Bloco B).
- Verificação do PR (16/10/2026, HEAD `bad3803`): `tsc --noEmit` saída 0; `npm test` saída 0 (636 arquivos, 4524 testes); `npm run lint` saída 0. `vitest related --run -c vitest.integration.config.ts` sobre os 27 .ts/.tsx existentes do diff `4472e76...HEAD`: saída 0, "No test files found" (nenhum `*.int.test.ts` depende dos arquivos tocados). Sem falhas novas em relação à linha de base.
- Reverificação antes do PR (16/10/2026, HEAD `61d19cd`): `tsc --noEmit` saída 0; `npm test` saída 0 (635 arquivos, 4519 testes); `npm run lint` saída 0 (0 erros, 44 avisos); `vitest related --run -c vitest.integration.config.ts` sobre o diff contra `origin/claude/fase1-c-telas`: saída 1, 7 falhas em 165 testes. As mesmas 7 falham em `origin/claude/fase1-c-telas` (rodado em `whatsapp/inbox.int.test.ts` e `academico/visibilidade.int.test.ts`): falhas da linha de base, nenhuma nova.
- A suíte `npm run test:int` completa **não foi rodada** (mais de 2 h). **Pendente para o integrador antes do merge:** rodar a suíte de integração completa, comparar com a LB_FALHAS e registrar aqui código de saída e totais.
- **Pendências registradas (Fase 2/4):**
  - Resolvido no `684af0b3` (C2 da R1 da #191): saíram os `revalidatePath` de `/pipeline`, `/carteiras` e `/comissoes` (comercial, matrícula, IA e coberturas) e as consultas órfãs de `src/server/comercial/consultas.ts` (`carregarReguasComerciaisConfig`, `listarNumerosVendasResumo`, `listarTemplatesResumo` e `carregarEnsaioComercial`, com suas interfaces). Na Fase 2, bloco I, o `revalidatePath("/comissoes")` de `revalidar()` em `src/server/matricula/acoes.ts` voltou no merge da `main`, porque a rota `/comissoes` do CRM foi recriada.
  - ~~Comentários que ainda citam `/comissoes`: `src/server/financeiro/consultas.ts:36,46` e `src/server/financeiro/ordem-comissoes.ts:5-6`.~~ Resolvido na Fase 2, bloco I: os comentários passaram a citar `/financeiro/comissoes`, para não confundir com o painel do CRM em `/comissoes`.
  - Ainda pendentes, já listados no plano: `salvarConfigComercial` e `salvarReguaComercial` (`src/server/comercial/acoes.ts`) e `carregarSaudacoesSimuladas` (`src/server/comercial/consultas.ts`), que seguem usados por testes de integração. Remover na Fase 2/4.
  - `scripts/validacao/http-acesso.mjs`: as entradas `/carteiras` e `/comissoes` da lista de páginas do Administrador foram retiradas no commit de correção, porque as duas rotas saíram nas tarefas 7 e 8. O script fica fora do `vitest` e do `tsc`; só `node --check` foi rodado nele (saída 0). Na Fase 2, bloco I, `/comissoes` (painel do CRM, título "Comissões" para o Administrador) voltou à lista.

**Estado**: Implementado; aguardando o integrador (suíte de integração completa). Não concluído.

## Fase 1D — aceite do bloco (PR 4, 16/10/2026)

- Branch `claude/fase1-d-inbox-ia`; tarefas 11 a 13 do plano (Inbox, copiloto e `src/server/ia`), commits `1253134` (cockpit do lead da Inbox), `4cc8115` (copiloto da Inbox e da ficha do lead) e `b192710` (`src/server/ia` e importadores) sobre `630841c`, mais o commit de correção da revisão final. Perfil `dev-email` (banco `erp_genius_test_dev_email`), a mesma exceção ao `tester` registrada na linha de base.
- `git diff --stat main -- prisma/ package.json package-lock.json`: vazio (e também vazio contra `630841c`).
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test` (`vitest run --reporter=json`, suíte unitária completa, sem filtro): saída 0; 635 arquivos, `numTotalTests` 4519, `numFailedTests` 0, `success` true. `comm -13 tmp/lb-unit-falhas.txt tmp/d-unit-falhas.txt`: vazio. A queda em relação aos 4524 do Bloco C vem dos testes do cockpit, do copiloto e de `src/server/ia` removidos.
- `npm run lint`: saída 0; 0 erros, 44 avisos (a mesma contagem dos Blocos B e C).
- Grep de aceite do Bloco D (e da fase): `grep -rnE "server/ia|cron-comercial|cron-gestao|CopilotoSugestoes|CockpitLead|HomeVendedor|KanbanBoard|CoberturasPainel|ComercialPainel" src --include=*.ts --include=*.tsx | grep -v casca-crm-removida`: nenhuma linha (saída 1 do grep). As duas linhas que restavam eram comentários em `src/app/campos-texto.test.ts` e `src/app/enums-rotulos.test.ts`, reescritos sem os nomes no commit de correção.
- `npm run test:int` **somente em recorte** (não é a suíte completa):
  - Recorte do plano (Task 13, Step 4): `whatsapp/acesso-atendimento`, `whatsapp/inbox`, `whatsapp/linha-comercial` e `src/server/comercial`: saída 1; 7 arquivos, 89 testes, 88 passaram, 1 falha. A falha é `src/server/whatsapp/inbox.int.test.ts › cockpit do vendedor na thread (funil sem sair da conversa) lead de OUTRO vendedor vinculado ao número de A não vaza o cockpit (escopo row-level P1)`, que está na LB_FALHAS (já registrada pelo Bloco B). `comm -13 tmp/lb-int-falhas.txt tmp/d-int-recorte-falhas.txt`: vazio.
  - `vitest related --run -c vitest.integration.config.ts` sobre os 15 .ts/.tsx existentes do diff `630841c..HEAD`: saída 1; 17 arquivos, 15 passaram, 2 falharam; 165 testes, 158 passaram, 7 falharam. As 7 falhas (a de `whatsapp/inbox.int.test.ts` acima e 6 em `academico/visibilidade.int.test.ts`) estão todas na LB_FALHAS. `comm -13 tmp/lb-int-falhas.txt tmp/d-int-related-falhas.txt`: vazio. Nenhuma falha nova.
- A suíte `npm run test:int` completa **não foi rodada** (mais de 2 h, proibida nesta faixa). **Pendente para o integrador antes do merge:** rodar a suíte de integração completa, comparar com `comm -13 tmp/lb-int-falhas.txt <falhas>` e registrar aqui código de saída e totais.
- Evidência local não versionada: `tmp/d-tsc.txt`, `tmp/d-unit.json`, `tmp/d-unit-falhas.txt` (vazia), `tmp/d-lint.txt`, `tmp/d-int-recorte.json`, `tmp/d-int-recorte-falhas.txt` (1 linha), `tmp/d-int-related.json` e `tmp/d-int-related-falhas.txt` (7 linhas).
- **Pendências deixadas para fases seguintes** (tabela do plano):

| Pendência | Onde | Fase |
|---|---|---|
| `CoberturaCarteira` sem UI: `concederCobertura`/`revogarCobertura` sem tela; o escopo continua lendo as coberturas gravadas | `src/server/acesso/coberturas.ts` | 2 (Carteira) |
| ~~VENDEDOR sem "minhas comissões" (`/financeiro` só para FINANCEIRO e GC)~~ Resolvido na Fase 2, bloco I: `/comissoes` mostra "Minhas comissões" ao VENDEDOR | `src/app/(app)/comissoes/page.tsx` | 2 (Comissões) |
| Inbox sem nota interna (`registrarNotaInterna` sem tela na thread; a ficha do lead ainda tem) e sem etapa/temperatura do lead | `InboxCliente.tsx` | 3 |
| `ThreadConversa.lead` ainda calculado e não lido pela tela | `consultas-inbox.ts` | 3 |
| Código órfão sem chamador: `fila.enfileirarIntencaoComercial`, `elegibilidade.reagendamentoPendente`, `comercial/regua-comercial.ts`, `comercial/regua-fabrica.ts` (ainda usada por `prisma/seed-whatsapp.ts:4`), ramos COMERCIAL/GESTAO/reativa do `despachante.ts`, `salvarConfigComercial`, `salvarReguaComercial`, `carregarSaudacoesSimuladas`, `checkinExperimental`, `EsqueletoColunas` | `src/server/**` | 2/4 |
| ~~`revalidatePath("/pipeline")` e `("/comissoes")` inofensivos~~: resolvido na main pelo `684af0b3` (C2 da R1 da #191), trazido para esta branch no merge da main; o `("/comissoes")` de `matricula/acoes.ts` voltou com a rota do bloco I | `matricula/acoes.ts`, `comercial/acoes.ts` | — |
| Scripts fora do `tsc`/vitest quebrados: `scripts/auditoria/cenarios.test.mjs:30` (cron-comercial) e `scripts/validacao/http-acesso.mjs:47` (`/carteiras`; entrada já retirada no Bloco C) | `scripts/` | 2 |
| `@dnd-kit/*` sem uso (remover só com o integrador) e `ANTHROPIC_API_KEY` nos composes | `package.json`, `docker-compose.*.yml` | 5 |
| Campos de `ConfigComercial` órfãos (`autoLeadAtivo`, `saudacao*`, `copiloto*`, `gestao*`), `SugestaoIA`, `PoliticaComercial`/`DegrauComercial`: schema intocado | `prisma/schema.prisma` | 2 (migration reservada) |
| Docs que descrevem a casca (08, 27, 32, SPEC-ERP-005, 09) | `docs/` | 2 |
| Itens 3-4 da E0 do doc 02: decisão React 19 (Q6) e reserva dos IDs de migration pelo integrador | dono e integrador | antes das Fases 2 e 3 |

**Estado**: Implementado; aguardando o integrador (suíte de integração completa). Não concluído.

## Fase 1 (E0) — linha de base em 15/10/2026

- Commit medido: `f8a9c0e7b95f2d60e60952f8dac8e6b0ceaf3305` (`main`).
- Perfil de teste: `dev-email` (banco `erp_genius_test_dev_email`, `localhost:54329`). **Exceção registrada ao `tester` da Global Constraint:** em 15/10/2026, seis worktrees da fase 0 usavam `tester` ao mesmo tempo, e a suíte de integração trunca tabelas (`fileParallelism: false`); por isso o integrador atribuiu `dev-email` a este worktree. O banco é descartável, está na lista fechada de `scripts/test-profile.mjs`, não é `erp_genius_test` nem produção, e tem as 438 migrations aplicadas (`prisma migrate status` em dia). Os Blocos B, C e D usam o mesmo perfil e o mesmo banco. O texto da constraint no plano, a cargo do integrador, precisa ser atualizado com a aprovação do dono antes do merge.
- Todas as medições foram feitas neste worktree, no commit `a51d07b` sobre `f8a9c0e`; só `docs/` mudou em relação à `main`.
- Suíte completa, sem filtro.
- `tsc --noEmit`: saída 0.
- `npm test` (`vitest run`): saída 0; 646 arquivos, 4560 testes, 0 falhas (`--reporter=json`: `numTotalTests` 4560, `numFailedTests` 0, `success` true).
- `test:int` (`vitest run -c vitest.integration.config.ts`, perfil `dev-email`): **saída 1**. 193 arquivos (16 com falha, 174 passaram, 3 pulados); `numTotalTests` 1760, `numFailedTests` 44, `numPassedTests` 1712, `numPendingTests` 4; `success` false. Executado de 20:38 a 22:27 UTC de 15/10/2026, 6520 s, com outras suítes rodando na máquina ao mesmo tempo. A medição anterior no checkout do integrador (banco `erp_genius_test`) não vale como linha de base.
- Evidência local não versionada: `tmp/lb-unit.json`, `tmp/lb-int.json`, `tmp/lb-int.txt`, `tmp/lb-unit-falhas.txt` (vazia) e `tmp/lb-int-falhas.txt` (44 linhas, igual à lista abaixo). Os blocos seguintes comparam com `comm -13 tmp/lb-int-falhas.txt <novas>`.

### LB_FALHAS

- Unitários: nenhuma.
- Integração (44, preexistentes, formato `arquivo › nome completo do teste`):

```
src/server/academico/progressao-fechamento.int.test.ts › autoriza a exceção de nível somente com fechamento suficiente atual, parecer dispensado de forma justificada e execução da Secretaria
src/server/academico/progressao-fechamento.int.test.ts › mantém a solicitação aprovada sem execução quando uma correção oficial torna o fechamento anterior obsoleto
src/server/academico/progressao-fechamento.int.test.ts › não troca o fechamento aprovado por uma versão final posterior durante a execução
src/server/academico/progressao-fechamento.int.test.ts › registra o pedido, mas nega sua aprovação sem uma versão suficiente de fechamento
src/server/academico/visibilidade.int.test.ts › mudança acadêmica revoga vínculos atuais e preserva o diário diário relê a atribuição docente alterada enquanto aguardava o aluno
src/server/academico/visibilidade.int.test.ts › mudança acadêmica revoga vínculos atuais e preserva o diário diário revalida desativação revogado enquanto aguardava o aluno
src/server/academico/visibilidade.int.test.ts › mudança acadêmica revoga vínculos atuais e preserva o diário diário revalida papel revogado enquanto aguardava o aluno
src/server/academico/visibilidade.int.test.ts › mudança acadêmica revoga vínculos atuais e preserva o diário mensagem humana pendente do professor anterior é cancelada no despacho após a execução
src/server/academico/visibilidade.int.test.ts › mudança acadêmica revoga vínculos atuais e preserva o diário solicitar/aprovar preserva acesso; executar revoga ficha, conversa e mídia do professor anterior
src/server/academico/visibilidade.int.test.ts › mudança acadêmica revoga vínculos atuais e preserva o diário transferência concorrente preserva chamada anterior e recusa aula ocorrida após a saída
src/server/agenda/replanejamento-concorrencia.int.test.ts › serializa duas aprovações da mesma revisão sem duplicar os fatos aplicados
src/server/agenda/substituicao-avisos.int.test.ts › enfileira somente contatos acadêmicos no número AGENDA e confirma apenas o aceite Meta
src/server/agenda/substituicao-avisos.int.test.ts › não troca responsável autorizado por outra pessoa com o mesmo telefone antes do driver
src/server/agenda/substituicao-avisos.int.test.ts › resultado incerto do driver preserva INCERTO e não reenvia automaticamente
src/server/avaliacoes/aproveitamento-aplicado.int.test.ts › ACA/V01 transfere a recuperação oficial, fecha o destino e mantém isoladas duas matrículas da mesma aluna no portal
src/server/avaliacoes/aproveitamento-aplicado.int.test.ts › correção oficial na origem torna o requisito de destino pendente, sem atualizar a nota aplicada
src/server/avaliacoes/aproveitamento-aplicado.int.test.ts › executa a cadeia aprovada e usa a nota de origem no consolidado sem lançamento no destino
src/server/avaliacoes/aproveitamento-aplicado.int.test.ts › preserva a cadeia A→B→C e não duplica a fonte aproveitada no consolidado BASE_PLANO
src/server/avaliacoes/aproveitamento-aplicado.int.test.ts › usa fontes aproveitadas na base de recuperação e conserva a melhor tentativa oficial posterior
src/server/avaliacoes/impactos-progressao-tx.int.test.ts › correção publicada abre revisão da progressão executada e exige novo fechamento para reconfirmar
src/server/avaliacoes/impactos-progressao-tx.int.test.ts › não executa aprovação antiga com revisão pendente mesmo após restaurar a presença
src/server/avaliacoes/impactos-progressao-tx.int.test.ts › persiste a revisão da progressão em C quando uma correção aprovada alcança A→B→C
src/server/avaliacoes/impactos-progressao-tx.int.test.ts › preserva o formato e localiza a mesma progressão depois de EXECUTADA
src/server/avaliacoes/impactos-progressao-tx.int.test.ts › reconfirma progressão real após corrigir a fonte da reposição, exigindo novo fechamento
src/server/avaliacoes/impactos-progressao-tx.int.test.ts › segue A→B→C por aplicações reais e retorna a progressão APROVADA, sem proposta não aplicada ou outra matrícula
src/server/diario/calendario-reposicao.int.test.ts › usa apenas calendário aprovado vigente; feriado removido=true
src/server/diario/reposicao-agenda.int.test.ts › a prévia autenticada informa período, saldo e conflitos antes de confirmar a agenda
src/server/diario/reposicao-agenda.int.test.ts › a última cota é reservável uma vez e bloqueia outra origem no mesmo período
src/server/diario/reposicao-agenda.int.test.ts › dia não letivo exige exceção aprovada e Q34 agenda isenta sem consumir benefício
src/server/diario/reposicao-agenda.int.test.ts › rejeição Q19 permanece possível e idempotente quando a proposta fica indisponível ou passada
src/server/diario/reposicao-agenda.int.test.ts › remarcação normal consome benefício ao registrar diário, conclui uma única fonte e não usa o encontro cancelado
src/server/diario/reposicao-agenda.int.test.ts › reserva benefício de oferta aprovada e cria encontro REPOSICAO ligado ao pedido exato
src/server/diario/reposicao-agenda.int.test.ts › serializa duas agendas distintas na última cota e preserva o replay vencedor
src/server/diario/reposicao-permissoes.int.test.ts › fila Q19 expõe a exceção exata à gestão e a aprovação não cria agenda
src/server/matricula/consumo-ocorrencia.int.test.ts › consome falta e cancelamento tardio com reserva sem caixa e bloqueia escrita SQL
src/server/portal-aluno/fechamentos-transferencia.int.test.ts › agrega frequência A→B no mesmo nível e exige nova versão de fechamento após a transferência
src/server/portal-aluno/resultados.int.test.ts › conferência da transferência liga fontes oficiais e requisitos da regra de destino
src/server/portal-aluno/sessao-capturada.int.test.ts › recusa a sessão expirada depois da captura
src/server/preferencias/fuso-exibicao.int.test.ts › recusa IANA inválido, usuário desativado e Factory no backstop SQL
src/server/whatsapp/cron-gestao.int.test.ts › alerta de SLA leads estourados viram UMA mensagem agregada + evento por lead (idempotente)
src/server/whatsapp/cron-gestao.int.test.ts › despachante × origem GESTAO SHADOW da gestão simula; ATIVA sem WHATSAPP_LIVE também simula (ambiente)
src/server/whatsapp/cron-gestao.int.test.ts › despachante × origem GESTAO alteração do destino/configuração após enfileirar cancela a intenção
src/server/whatsapp/cron-gestao.int.test.ts › despachante × origem GESTAO mensagem de gestão é isenta da janela de horário (madrugada despacha mesmo assim)
src/server/whatsapp/inbox.int.test.ts › cockpit do vendedor na thread (funil sem sair da conversa) lead de OUTRO vendedor vinculado ao número de A não vaza o cockpit (escopo row-level P1)
```

## Situação em 13/10/2026 — publicação no UAT e auditoria de UX

Base conferida: `main` em `e5418550` (merge da #161, 10/10/2026). Esta seção é a fotografia de 13/10; as seções abaixo continuam sendo os registros de 21/09 e anteriores. Análise PR a PR no doc 44 (§3 para publicação, §7 para as PRs) e remedição da auditoria de UX no doc 43 §7.

### Publicação no UAT

- **Como a `main` vai para o UAT.** O UAT é o único ambiente; não há produção separada. Cada merge na `main` dispara o deploy pelo Coolify, que roda `prisma migrate deploy` antes de subir o app (o `app` só sobe se o `migrate` terminar com sucesso). O deploy **não espera o CI**: o CI do GitHub só verifica typecheck, lint e testes unitários, e não roda `*.int.test.ts`.
- **O repositório não registra qual commit está no UAT.** Não há registro de deploy no GitHub, e `/api/health` e `/api/ready` não expõem o SHA. Uma falha de `migrate deploy` impede o app novo de subir e pode deixar o anterior no ar. Isso só se confere no painel do Coolify.
- **A #62 não está publicada.** Ela foi mergeada em `codex/consolidacao-specs-20260916` depois de a #61 levar essa branch para a `main`. Os 21 commits e as 9 migrations estão fora da `main`, então o UAT não tem:
  1. resolução, pela gestão, do impedimento de segunda chamada causado pela escola (Q164);
  2. correção do período de um relato de falta de oferta já confirmado (Q157);
  3. aditivo de adiantamento aplicado à cobrança (Q172), aditivo de moeda (Q173) e recusa do aditivo de regime com a orientação "nova contratação" (Q174);
  4. aula particular não cobrável: reduzir ou cancelar a cobrança, gerar crédito ou devolver horas pré-pagas (Q175);
  5. destino negociado do excedente de permuta e uso do saldo restrito a serviços (Q171/Q167C);
  6. contrato legado (em papel) como origem de aditivos (origem contratual histórica);
  7. envio, conciliação e cancelamento de assinatura eletrônica pelo port com driver simulado (mesmo portado, o driver simulado é recusado com `NODE_ENV=production`);
  8. validadores de Cédula CR, CURP, DNI AR, DUI SV e passaporte (hoje esses documentos ficam como "não validado");
  9. régua de cobrança e bloqueio D+30 virando o dia no fuso da escola (Q176);
  10. Q161 ampliada: transferência no meio do ciclo e alterações de quantidade de aulas na comprovação de oferta;
  11. fuso pessoal nas telas restantes, que está parcial: a #159 cobriu parte, com outro desenho.
- **A #65 está publicada via #66.** O merge da #65 foi para a branch da #64, já fechada; a #66 reaplicou o mesmo commit na `main` (mesmo `patch-id`). Nada da #65 falta na `main`.

As linhas "Vencimento no caixa" (Q176), Q165, Q167, DCT03 e ACA (Q164) da tabela "Fila corrente de implementação local — 18/09/2026", abaixo, ficaram desatualizadas em 13/10, porque as decisões de 21/09 tinham sido implementadas só na #62, que não foi publicada (doc 44 §3). Em 20/10/2026 elas foram reescritas com o estado da `main` (#164). A lista acima continua sendo a fotografia de 13/10; o que já entrou está em [decisoes-2026-09-21.md](decisoes-2026-09-21.md), seção "Situação na `main` em 20/10/2026".

### Entregas desde a #133

Uma linha por PR, de #133 a #161. Os números #139–#142, #152 e #162 são issues e não entram na tabela. Datas em UTC. Nenhuma revisão aparece como `APPROVED` no GitHub, porque autor e revisor são a mesma conta; o veredito é o escrito no texto da revisão. "Regra pós-R3" é a regra aprovada pelo usuário: blocker só de teste, com conserto especificado pelo revisor, é aplicado, verificado com CI verde e mergeado sem R4. A partir da R3 da #154 as revisões passaram ao "modo leve" (CI verde e leitura do diff, sem mutações do revisor). Esta tabela cumpre a regra do AGENTS.md: "commit por funcionalidade, com evidências e pendências no quadro único".

| PR | Entrega | Merge (commit, data) | Verificação | Pendências |
|---|---|---|---|---|
| #133 | Suíte verde na `main`: nota do cadastro do `InboxCliente` com `role="note"` e `catch` com `MSG_RESULTADO_INCERTO_SEM_CHAVE`; trava do `db-init` do Coolify normaliza CRLF e confere o script inteiro | `20872f66`, 06/10/2026 18:33 | Suíte 483 arquivos e 2649 testes; R2 com 28 mutações mortas; R3 com N1–N6 e R3a–R3h mortas. **APPROVE** escrito na R3 | Sem issue: C6/N9, valores de `image` e `depends_on` sem trava (`coolify-db-init.test.ts:94`); C1, `anuncios.test.ts:33` aceita qualquer `role=` e o detector de resultado incerto não resolve texto em variável ou template |
| #134 | Estado vazio paginado: a página 1 diz o vazio concreto; as seguintes dizem "nesta página" com "Ir para a primeira página" (43 estados vazios) | `5f28b7ea`, 06/10/2026 20:42 | Integração local `main` + #134 + #135: `tsc` 0; vitest 492/492 arquivos, 2708/2708 testes. R3 em REQUEST CHANGES com 12 sobreviventes novas. **Sem APPROVE**: merge autorizado pelo responsável, follow-up #139 | #139 fechada pela #147; limites da #147 (retorno antecipado sem `else`, palavra partida, texto que não nasce de literal); textos de página 1 em migração, acertos de taxa e cobertura e reserva |
| #135 | Botões dos componentes no design system; variante `perigo` nas ações destrutivas; `aria-pressed` e `role="group"` nas alternâncias | `ab21a068`, 06/10/2026 20:43 | Mesma integração local da #134 (`tsc` 0; 492 arquivos, 2708 testes). R1 com 23 mortas e 15 sobreviventes; R3 com cerca de 20 sobreviventes. **Sem APPROVE**: merge autorizado, follow-up #140 | #140 fechada pela #148 ("Anular" e "estorno" sem caso de teste). Sem issue: "Alternar tema" sem `aria-pressed` (`Sidebar.tsx:59`); wizard de matrícula sem `aria-current="step"`; chip de temperatura com `disabled` (`InboxCliente.tsx:1087-1088`) |
| #136 | `ColunaOrdenavel`: ordenação no servidor em `/comissoes`, `/alunos`, `/empresas` e na aba do `/financeiro` | `6978127b`, 06/10/2026 20:50 | Suíte final 496 arquivos e 2787 testes; R1 com 39 mutações (13 sobreviventes); R4 com 9/9 mortas no B10. **Sem APPROVE**: merge autorizado, B9 e B2 para a #141 | **#141 aberta** (B2, collation do Postgres; o B9 foi fechado pela #149). Sem issue: `/empresas` sem volta à ordem padrão; `PADRAO` sem uso em `ordem-comissoes.ts:14`; coluna "Previsão de pagamento" ausente em `/comissoes` (doc 42 L2259) |
| #137 | Campo de data do início da cobertura abre preenchido (`SecretariaPainel.tsx:61`), regressão da #111; datas da Secretaria travadas | `602e20b4`, 06/10/2026 18:33 | Mutações M0–M16 e N1–N13: todas as não equivalentes morrem no pool padrão. **APPROVE** escrito na R3 | C2: `datas-civis.test.ts` não trata `toLocaleDateString` sobre campo civil (candidatos em `TurmasPainel.tsx:195-196`, `FichaEmpresa.tsx:190` e `PagarCliente.tsx:53`; formato dos dados não verificado); C6: `pool: "forks"` não fixado |
| #138 | Enums com rótulo do mapa central: 46 mapas novos em `labels.ts` e 43 mapas locais retirados | `6b105093`, 06/10/2026 21:04 | Suíte final 497 arquivos e 2873 testes; R3 com 123 mutações (83 mortas, 40 sobreviventes, 34 blockers). **Sem APPROVE**: R4 parcial e merge autorizados, follow-up #142 | #142 fechada pela #150, mas C7, C8 e C9 continuam abertos sem issue; `ETAPA_LABEL` em Title Case (`labels.ts:84-95`); fornecedor CLICKSIGN/ZAPSIGN cru (L718, parcial); `o.resultado`; badges `{label, cls}` |
| #143 | Abas de área em `/academico` e `/diario` (`SubTabs`, prefixo aninhado); no E6 nenhuma tela mudou, só os detectores de `responsivo.test.ts` | `f504a359`, 07/10/2026 18:04 | Integrador antes do merge: `tsc` 0; 504/504 arquivos, 2.986/2.986 testes. Revisor na R3: 23 mutações (16 KILLED, 7 SURVIVED). **Sem APPROVE**: merge após a R3 por decisão do usuário, B7–B9 na #152 | **#152 aberta**. Sem issue: C2, `ariaLabel` padrão "Sub-navegação" (`SubTabs.tsx:11`); C3, 14 e 16 abas quebram em várias linhas a 375 px; C5, `matriculas/[id]/secoes.test.ts` ainda lê o guard por regex textual |
| #144 | Fila de cobrança com filtro na URL (`filtros-fila.ts`, contadores por `contarIndicadoresFila`) e busca por beneficiário em `/comissoes` | `b64e1a7a`, 07/10/2026 22:16 | Integrador em `8584e27c`: 501 arquivos, 2.946 testes; CI com os 4 jobs verdes; N9, N10, N11 e N14 KILLED. Revisor na R3: 10 mutações (6 KILLED). **Sem APPROVE**: regra pós-R3, conserto aplicado pelo integrador | Fila sem paginação nem `take` (`listarFilaCobranca`, `src/server/cobrancas/consultas.ts:212`); busca por aluno ou matrícula em `/comissoes` fora; `*.int.test.ts` de cobrança não rodados |
| #145 | `Campo` único (rótulo, dica, erro e obrigatoriedade ligados) em `/matriculas/nova` (46 campos) e `/alunos/[id]` (26 da edição, mais pausa e encerramento) | `4f6aad16`, 07/10/2026 23:33 | Integrador na R3, com a `main`: 512/512 arquivos, 3.114/3.114 testes; 10/10 KILLED. Revisor: R1 94 mutações (47 KILLED), R2 64 (60), R3 23 (16). **Sem APPROVE**: regra pós-R3 | Só `FichaAluno.tsx` e `MatriculaFormulario.tsx` usam o `Campo`; as demais áreas não foram migradas; justificativa sem tabela de preço validada só no servidor (achado #6); confirmação ao descartar edições do Drawer (achado #3) |
| #146 | Doc 43 (medição da auditoria de UX), scripts `scripts/medicao-ux/*` e `src/test/medicao-ux.test.ts` | `d20bda06`, 07/10/2026 15:44 | Integrador: `tsc` 0; 498/498 arquivos, 2.904 testes; `medicao-ux.test.ts` 31/31; 9 mutações KILLED. Revisor na R2: 20/20 KILLED. **APPROVE** escrito na R2 | Métricas de fluxo da 7.7 sem medir (dependem de operador real); amostra Média/Baixa com outra semente (item 11 da §6) não feita; remedição de 13/10 no doc 43 §7 |
| #147 | Trava do vazio paginado falha fechado; render da reserva compara o texto lido (`src/test/texto-lido.ts`); fecha a #139 | `23b54768`, 07/10/2026 23:39 | Integrador na R3, com a `main` + #145: `tsc` 0; 513/513 arquivos, 3.152/3.152 testes; 20/20 KILLED. Revisor na R3: 30 mutações (20 KILLED, 3 equivalentes, 7 blockers). **Sem APPROVE**: regra pós-R3 | Sem issue: retorno antecipado sem `else`; texto que não nasce de literal (dado do servidor, `String.fromCharCode`) |
| #148 | Trava de botões: evasões B1–B6 e A16f do follow-up #140; fecha a #140 | `ebe4109c`, 07/10/2026 22:24 | Integrador em `f2acc5bf`: 504 arquivos, 3.003 testes; 8 mutações KILLED e controle; CI verde. Revisor na R3: 9 mutações (7 KILLED). **Sem APPROVE**: regra pós-R3, conserto aplicado pelo integrador | "Anular" e "estorno" sem caso de teste |
| #149 | Trava de `aria-sort` falha fechada (B9 da #141), com reconhecimento do render-prop do `Campo` | `cf82be2c`, 07/10/2026 23:54 | Integrador em `3fc690b5`, com a `main` + #145: 513/513 arquivos, 3.164/3.164 testes; 20/20 KILLED. Revisor na R3: 43 mutações (23 KILLED). **Sem APPROVE**: regra pós-R3 | **#141 aberta** (B2). Sem issue: parâmetro reatribuído e alias de objeto fora da análise de valor da trava |
| #150 | Trava de enum cru com checker de tipos; `PAPEL_LABEL` em `labels.ts` (três papéis em sentence case na tela de usuários); `ETAPA_EXTENSO_LABEL` no relatório diário de gestão por WhatsApp; fecha a #142 | `5b418b11`, 08/10/2026 01:45 | Integrador em `17c696bf`: 506/506 arquivos, 3.011/3.011 testes; 24/24 KILLED. Revisor na R2: 42 mutações (34 KILLED, 8 SURVIVED). **Sem R3, sem APPROVE e sem comentário de merge** | C7, C8 e C9 da #138 sem issue; o último delta teve só a verificação do integrador; `cron-gestao.int.test.ts` não rodado |
| #151 | CI no GitHub Actions: typecheck, lint e testes unitários em UTC e America/Sao_Paulo; lint zerado; `testTimeout: 30_000` | `c3685565`, 07/10/2026 15:38 | Autor em `056f0553`: `tsc` 0; 497 arquivos, 2.878 testes; `eslint .` 0 erros. CI da própria PR no head final: 4/4 jobs, 497/497 arquivos e 2.878/2.878 testes nos dois fusos. Revisor na R3: 12/12 KILLED. **APPROVE** escrito na R3 | Sem `--max-warnings` (`ci.yml:61`); `no-explicit-any` desligada em todos os testes; `testTimeout` global (`vitest.config.ts:15`); troca prometida do `TypeError` por `ErroRegra` em `aditivo-cobertura.ts:84`; o CI não roda `*.int.test.ts` |
| #153 | Erro e sucesso separados em 56 componentes de formulário (`useAcaoCliente` + `FeedbackAcao`), item 2 da §6 do doc 43 | `0dc4d092`, 08/10/2026 05:21 | Integrador em `6d8456e4`: 552 arquivos, 3.708 testes; 9/9 KILLED nas evasões da R3 na tela real (N2–N7 e N10 ficaram só no autoteste). Revisor na R3: 51 mutações (32 KILLED, 16 SURVIVED). **Sem APPROVE**: regra pós-R3 | Sem issue: C3, texto de erro fora da lista de prefixos e `useReducer` como estado de mensagem; callback `on<Palavra>` para componente de biblioteca não conferido |
| #154 | `ConfirmarAcao` e confirmação em 12 ações de efeito externo ou financeiro (fatia A), item 1; sai o único `window.confirm` | `14dd30b7`, 08/10/2026 11:47 | Integrador em `9528e648`, já com a #153: 566/566 arquivos, 3.867 testes; 19/19 KILLED. **APPROVE** escrito na R3, em modo leve; os blockers B1, B2 e B8 da R2 foram rebaixados a comentário | Fatia B sem issue: encerrar país, "Faltou" no check-in, vincular contato e opt-out na inbox, replanejamento, quantidade de aulas, presença histórica, desativar usuário, preço ou idioma e inativar empresa; `enviarLote` sem `try/catch` em `FilaCobranca.tsx`; alcance numérico ao ativar a régua (L2517) |
| #155 | Não perder o digitado: `key` sem versão, página nem filtro; `useAvisoAoSair` (`beforeunload`) em `contratos/novo`, `calendario/novo` e nos templates do WhatsApp; `lancamentos.ts` devolve `anterior` em qualquer página; item 3 | `c1b3a62c`, 08/10/2026 12:02 | Integrador em `7f7d0c35`: `tsc` 0; 581/581 arquivos, 3.968/3.968 testes; 21/21 KILLED. **APPROVE** escrito na R2, em modo leve | 22 exceções em `formularios-preservados.test.ts` (17 `VERSAO_PENDENTE`); L1059 e L2367 parciais (navegação interna do Next, rascunho do modelo contratual); a busca GET de `grades/nova` continua recarregando a página |
| #156 | Contraste: seleção em `bg-brand-solid` em 6 elementos; `--border-control` acima de 3:1; item 5 | `fbada6a2`, 08/10/2026 12:41 | Integrador em `17366b8e`: 583/583 arquivos, 3.987 testes; 11/11 KILLED. **APPROVE** escrito na R1, em modo leve | Família `#fff/--brand` ainda contada por token em `paresReprovados`; `--border` e `--brand-border` reprovando (1,25–1,56:1); o C1 (seleção pouco destacada no escuro) foi resolvido na #157 |
| #157 | `--brand-solid` próprio do escuro (`#6264ec`), ≥ 3:1 sobre as superfícies | `c107da32`, 08/10/2026 12:59 | Integrador em `b1477a48`: 583 arquivos, 3.988 testes; 7/7 KILLED. **APPROVE** escrito na R1 (revisão leve; o revisor recalculou os números de WCAG) | Nenhuma: C1 e C2 resolvidos na #159 |
| #158 | Paginação nos dois sentidos: 28 telas e 24 consultas de servidor passam a página numerada; item 4 | `60f14790`, 10/10/2026 15:57 | Integrador em `a7ca2ad3`: 591/591 arquivos, 4.065 testes; 11/11 KILLED. **APPROVE** escrito na R1 e na R2, em modo leve. Os 13 `*.int.test.ts` alterados **não foram executados** | **#162 aberta**; 26 telas (27 links) ainda só para frente, ancoradas como `PENDENCIA`; L431 e L1709 parciais; favoritos com `?cursor=` antigo abrem a página 1 |
| #159 | Fuso e instante: 20 campos pelo `CampoFuso`; `PaisSchema` valida fuso IANA; `AvisoFusoNaoConfigurado`; `PreviaConversao`; item 6 | `b59744b9`, 10/10/2026 15:44 | Integrador em `c406fff7`, suíte sem banco configurado: 593/593 arquivos, 4.062 testes; 11/11 KILLED. **APPROVE** escrito na R1, em modo leve | L1566, L1747, L406 e L1256 parciais; `fusoIanaValido` recusa `EST5EDT` (`src/server/operacao/fuso.ts:9`); ramo `fuso === ""` sem efeito (`src/server/paises/schema.ts:29`); validade só no `onChange` |
| #160 | Becos sem saída e identificação do registro (`IdentificacaoRegistro`) fora de `/matriculas/[id]`; item 7 | `19be34de`, 10/10/2026 17:10 | Integrador em `a51d4e1e`: 591/591 arquivos, 4.057 testes; 12/12 KILLED. **APPROVE** escrito na R2. O último commit (`f50608f5`, merge com a #158) teve só a verificação do integrador: 609/609 arquivos, 4.208 testes | 66 IDs crus e 12 telas de detalhe sem identificação (tetos em `identificacao-registro.test.ts:378` e `:421`); link para `/financeiro` sem `abreFinanceiro` em `matriculas/[id]/emissao/page.tsx:23`; L934 e L1709 |
| #161 | Filas de trabalho por cursor nos dois sentidos: 12 filas e 11 consultas, `PaginacaoFila` e `cursor-fila.ts` | `e5418550`, 10/10/2026 17:18 | Integrador em `8c697968`, suíte sem banco configurado: 604/604 arquivos, 4.194 testes; 15/15 KILLED. **APPROVE** escrito na R1 e na R2 (review leve). Os 8 `*.int.test.ts` alterados **não foram executados** | **#162 aberta**; C1, subselect da âncora sem escopo em `segunda-chamada-fila-agenda.ts`; decisões de produto em aberto (`autorizacoes-preparacao` como histórico; link no vazio em vez de redirect) |
| #163 | Docs de 13/10: o que está e o que não está publicado no UAT, remedição da auditoria de UX (doc 43 §7) e análise das PRs #63–#161 (doc 44) | `e864ef4d`, 13/10/2026 15:47 | Só documentação. **APPROVE** escrito na R1 | As pendências do doc 44 §5 viraram as issues #164–#170 |
| #171 | Trava `guard-pagina`: B7, B8 e B9 da R3 da #143 (carga dinâmica do módulo do guard, contaminação por chave e desestruturação, recusa branda sob laço, `switch` e operador lógico); fecha a #152 | `4cb396b7`, 13/10/2026 16:13 | Integrador em `824ab622`, com o TS2345 corrigido: `tsc` 0; 612/612 arquivos, 4.271/4.271 testes; 10/10 KILLED e controle. **APPROVE** escrito na R1 | #170: atribuição a membro (`obj.p = sessao.papeis`) e chave não literal ainda escapam |
| #172 | Item 8 (portal público): `/portal-aluno/ativar` (token na aba, regra e confirmação da senha), `/recuperar` sem falso "enviado", `/pagar/[token]` com os 6 casos e `noindex`, `/login` com `callbackUrl` só interno (`src/proxy.ts` novo) | `77fe6f1e`, 13/10/2026 16:42 | Integrador em `5e870be9`: `tsc` 0; 626/626 arquivos, 4.366/4.366 testes; 17/17 KILLED (X3 equivalente) e controle; R1 C1 (`router.refresh()` depois de pagar) aplicado. **APPROVE** escrito na R2 | #170: `maxLength` em caracteres; aviso `set-state-in-effect`; troca de e-mail em "link indisponível"; 422 genérico; `/login` #1, #3, #5 e #6 |
| #173 | Moeda: `parseMoeda` recusa ponto ambíguo (`1.23`); CRC/CLP sem arredondamento, com aviso neutro; dica do ponto no `CampoMoeda`; permuta sem moeda mostra "moeda não definida"; fecha a #167 | `02444a1d`, 13/10/2026 16:53 | Integrador em `28a8a55a`: `tsc` 0; 630/630 arquivos, 4.405/4.405 testes; 13/13 + 9/9 KILLED e controles. **APPROVE** escrito na R2 | #170: a dica do ponto é anunciada (`role="alert"`) durante a digitação |
| #174 | Item 10 (borda de rota): `loading.tsx` com o formato da tela em 8 rotas, `error.tsx` em 15 áreas (`ErroArea`), `<Suspense>` em `/academico/reposicoes` e na preparação da matrícula, trava `borda-rota.test.ts`; C3 da #170 (esqueleto do financeiro em dobro) | `4c4f526a`, 13/10/2026 17:27 | Integrador em `c5e17404`, com o `key` do `<Suspense>` só pela matrícula e a trava aceitando segmento com páginas filhas: `tsc` 0; 633/633 arquivos, 4.478/4.478 testes; 20/20 KILLED e controle. **APPROVE** escrito na R1 | Conferir no UAT o esqueleto do financeiro e os `<Suspense>`; #170: volta do erro do hub da matrícula; `matriculas/nova`, `configuracao/whatsapp` e `/portal` sem `loading.tsx` |
| #175 | Fatia B do `ConfirmarAcao` (13 ações, digitação do nome ao encerrar país, alcance numérico ao ativar a régua com `estimarAlcanceRegua`, `definirSituacaoEmpresa` com estado-alvo); regra do cron extraída para `decidirEnvioCron`; fecha a #169 | `f8a9c0e7`, 13/10/2026 18:09 | Integrador em `5009916b`, com travas de enum e de estado vazio, TS2345 e `cron.test.ts` novo: `tsc` 0; 646/646 arquivos, 4.560/4.560 testes; 19/19 KILLED e 2 controles. `cron.int.test.ts` **não executado** (#162). **APPROVE** escrito na R2 | #170: botão da ativação habilitado durante a estimativa; alternadores de usuário, idioma e preço invertem o estado; "Desvincular" na inbox; L325, L1479, L2019 e L2142 sem confirmação |
| #176 | Item 11: amostra Média/Baixa com a semente 20261013 na `main` `4c4f526a` (doc 43 §7.6) | `d1f2c03f`, 13/10/2026 17:59 | Só documentação. Integrador: sorteio reproduzido (126 achados = as 126 linhas da tabela), contagens por estrato conferidas e estimativa recalculada (66,8% abertos, IC 58,7–74,9%). **APPROVE** escrito na R1 | Os padrões com mais abertos: layout e hierarquia, texto e validação de campo |

### Tarefas operacionais pendentes

- **Rodar os testes de integração.** Os 13 `*.int.test.ts` da #162 (alterados pelas #158 e #161), mais os que também não têm registro de execução: `src/app/api/exportacoes/[tipo]/route.int.test.ts` (alterado pelas #92, #93 e #95), os da inbox (`inbox`, `acesso-atendimento`, `linha-comercial` e `destinatario-atual`, das #102, #128 e #130) e os do diário (`diario`, `correcao-aula` e `academico/visibilidade`, da #104). Seguir o AGENTS.md: `vitest.integration.config.ts` com `.erp-test-profile` de banco descartável, uma suíte por banco, cluster coordenado com o integrador.
- **Redeploy da #127.** Confirmar no Coolify o container `healthy`, o `migrate` com saída 0 e `/api/ready` com 200. O registro abaixo continua "Não concluído"; o `tsc` hoje passa no CI da `main`.
- **Script de reparo dos nomes de contato (#131/#132) no UAT.** Rodar `scripts/reparar-nome-contato-whatsapp.ts` em modo leitura, conferir com o usuário e só então `--aplicar`; renomear os leads listados com o nome da linha. Os registros abaixo continuam "Não concluído".
- **Revisar as migrations da #131 e da #132**, que entraram sem nenhuma revisão no GitHub e já foram aplicadas no UAT pelo `migrate deploy`. A `20260929120000_contato_whatsapp_nome_perfil` tem, além do `ALTER TABLE`, um `UPDATE` de dados sem volta automática; a `20260929130000_contato_whatsapp_nome_editado` é aditiva.
- **Decidir como portar a #62.** Recomendação do doc 44 §3: cherry-pick por recurso de servidor, schema e migration, em PRs pequenas e na ordem original; UI reescrita no padrão atual (27 telas conflitam com as PRs de UX); fuso pessoal refeito sobre a #159. O integrador decide os IDs das 9 migrations. Antes de cada merge com migration: backup do banco do UAT, ensaio do `migrate deploy` numa cópia e suíte de integração completa.
- **Collation com acento (#141, B2).** A ordenação no Postgres é por bytes ("Álvaro" depois de "Zoila"). Corrigir exige schema ou infra e depende do integrador.

### Auditoria de UX, issues abertas e próximos itens

Remedição de 13/10 na `main` `e5418550` (doc 43 §7):
- **Achados Alta (145):** antes 37 resolvidos, 21 parciais e 87 abertos; agora **79 resolvidos, 26 parciais e 40 abertos**.
- **Média/Baixa (727):** antes 71,1% abertos (IC 63,1–79,2%, ≈ 517); agora **58,9% (IC 50,3–67,5%, ≈ 428)**.

Issues abertas:
- **#141** (origem: #136): só a parte B2, collation com acento no Postgres. O B9 foi resolvido pela #149.
- **#152** (origem: #143): B7, B8 e B9 da R3 da trava `guard-pagina`; sem risco nas páginas atuais.
- **#162** (origem: #158 e #161): rodar os 13 `*.int.test.ts`, que nunca rodaram; o código já está no UAT.

Fechadas: #139 (pela #147), #140 (#148) e #142 (#150; os C7–C9 da R3 da #138 ficaram sem issue).

Próximos itens do doc 43, não iniciados (ver doc 43 §7.5):
- **Item 8:** portal público.
- **Item 9:** consultas e dados no servidor.
- **Item 10:** borda de rota restante (`<Suspense>` e `loading.tsx`).
- **Item 11:** Média e Baixa, repetir a amostra com outra semente.

**Atualização de 13/10/2026, fim do dia (integrador):**
- **Itens 8, 10 e 11:** entregues (#172, #174 e #176). O item 9 está em andamento (`claude/e9-consultas-servidor`).
- **Issues fechadas:** #152 (pela #171), #167 (#173) e #169 (#175).
- **#170:** em andamento por grupos (`claude/fu170-grupo-a`); o C3 foi resolvido pela #174.
- **Abertas sem frente:** #141 (collation, depende do integrador), #162 (testes de integração, depende do banco de teste isolado), #164 (portar a #62), #165 (operação no UAT), #166 (idempotência, exige migração) e #168 (inbox).
- **Média e Baixa na semente 20261013:** 66,8% abertos (IC 58,7–74,9%, ≈ 486), contra 58,9% na semente 42. Os intervalos se sobrepõem (doc 43 §7.6).

## Integração da main na PR #61 — 21/09/2026

Integração de main `78ea0028` sobre a consolidação `28f3e4b9`. Os 29 conflitos de conteúdo foram resolvidos preservando a matrícula como unidade de autorização, o ledger financeiro, as aprovações e a identidade própria do portal. Modelos e migrações históricas da main foram mantidos; a migração270 remove a unicidade legada por competência, preservando as identidades de emissão contratual e permitindo cobranças complementares legítimas.

Revisão independente no commit de merge `eeee7801`: 37/37 integrações em cinco arquivos no banco `tester`, saída0. A revisão identificou o caso de participante temporário do inbox fora da carteira: o complemento preserva a abertura da conversa e retorna copiloto desabilitado/sugestões vazias; o titular mantém suas sugestões. Validação do complemento: 15/15 integrações de acesso ao atendimento (92502), TypeScript e lint saída0. Auditoria de comissão preserva moeda/política no evento; 6/6 integrações do gateway/comissões (77086), saída0. Não houve ampliação da carteira por participação na conversa.

Compatibilidade explícita: atalhos legados de assinatura/ativação, lançamento acadêmico direto, criação de senha pela equipe, matrícula corporativa em lote e conciliação do gateway simulado não estão liberados. As telas direcionam aos fluxos da SPEC; empresas permanecem como pagadoras de contratos individuais. Leituras históricas não comprovam nova entrega acadêmica. Consultas de IA preservam carteira/equipe e cobertura vigente; mensagens automáticas de gestão conferem remetente e destinatário configurados antes do despacho.

Validação local desta integração: regressão unitária 2.073/2.073, 396 arquivos, zero ignorados, saída0 (JSON local `node_modules/.implementation/unitarias-merge-main-final.json`). Build Next e TypeScript saída0, 90 páginas geradas (sessão78238). Integrações dirigidas: 52/52 em fechamento, gestão, bloqueadores do piloto e despachantes WhatsApp (53646); 12/12 após os negativos de gestão e locks de fatura (26633); 6/6 no bloqueio dos atalhos acadêmicos (3689). Outros arquivos aprovados nas rodadas combinadas: fluxo acadêmico, gateway e configuração comercial, além de 63 testes de acesso ao atendimento, IA, barreira do portal, recebimentos destinados, continuidade mensal SQL e condições por hora. As primeiras rodadas detectaram fixtures legadas e o conflito no despacho de gestão; os arquivos com falha foram corrigidos e reexecutados. Estes são recortes, não a suíte integrada completa. Nenhuma integração externa foi ativada. Pendências anteriores de Q161 e demais entregas continuam abertas; resolver a PR não significa concluir a SPEC.

Estado corrente: Q170 e Q151 integrados e revisados; Q168/Q169 implementados e validados localmente. Q165 continua parcial: correção255 de fotografia posterior integrada em896c5564 e aplicada no banco descartável principal. Validação atual do recorte:36/36 integrações de acerto, delta e efetivação;20/20 testes de consulta/página; TypeScript saída0. Revisão independente aprovada com22/22 integrações; homologação visual pós255 aprovada no percurso de aplicação, bloqueio sem fato novo e retomada após crédito posterior. Regressão unitária no snapshot a67af640: 2.054/2.054 em 392 arquivos, nenhum ignorado, saída 0 (33637/a61537; JSON c55c94). Build no snapshot a67af640 aprovado com 87 páginas e TypeScript, saída 0 (94584/f38334). Complementos posteriores têm validações dirigidas nas notas abaixo; não integram esses resultados globais. Inclui exportação corrigida e primeira entrega de preferência pessoal; complementos posteriores de fuso e vencimento seguem em revisão, sem aceite funcional global. Cancelamento externo depende da integração de assinatura Q155. Q167C permanece aprovada: destinação do excedente de permuta negociada caso a caso, com concordância e aprovação; cálculo/fontes testados, destinos operacionais aguardam Q171. Aditivo de adiantamento aguarda delimitação Q172. A SPEC permanece em andamento; testes locais não equivalem à conclusão integral.

19/09/2026 — Destinos acadêmicos: a fotografia v3 passa a exigir agenda futura publicada, professor apto e cadeia de calendário verificável; `dataFim` manual não decide a oferta. Integrações dirigidas cobrem fluxo 65/65, decisão de equivalência 3/3 e execução 2/2; TypeScript segue dirigido. Replanejamento aplicado, inclusive revisão conjunta sem remarcações, exige nova conferência da proposta anterior e permite preparar a fotografia atual. Memórias v1/v2 preservam replay histórico, mas não aprovação/execução. A cadeia ainda não reconhece escritores posteriores aprovados fora do replanejamento; essa fonte precisa ser compartilhada com Q161. Portanto a transferência não está declarada integralmente concluída.

18/09/2026 — Exceções de agenda de reposição: o histórico mostra início/fim, criação e decisão na preferência válida da equipe; sem preferência, preserva o fuso registrado na própria exceção. A prévia e os campos civis do agendamento continuam inalterados. SSR dirigido 2/2 cobre preferência, fallback, ambos os tipos de instante e inputs; o controle unitário 1/1 confirma o payload. TypeScript saída0.

18/09/2026 — Portal do aluno: a confirmação institucional do fechamento acadêmico passa a exibir o instante UTC na preferência válida da própria conta; sem preferência, usa UTC. A preferência é lida somente após a projeção autorizar sessão e matrículas. SSR dirigido 3/3 cobre mudança de dia, fallback, guarda e isolamento de duas matrículas; TypeScript saída0. Resultados, notas, históricos e escopo por contrato não foram alterados.

18/09/2026 — Equivalências de aproveitamento: listagem e detalhe exibem criação, decisão e execução administrativas no fuso pessoal válido; sem preferência, preservam `America/Sao_Paulo`, o fallback anterior. O rótulo informa somente o fuso de exibição. Fotografia/mapeamento pedagógico, ações e payloads permanecem intactos. SSR dirigido 6/6 cobre mudança de dia em Costa Rica, fallback, guarda e links/ação; TypeScript saída0. Este recorte não altera regras de aproveitamento ou dados civis.

18/09/2026 — Regras acadêmicas: histórico por nível, migração da turma e conferência histórica mostram criação/decisão administrativas no fuso pessoal válido, com UTC como fallback e origem identificada. Fotografia de turma preserva datas civis e formulários/parâmetros de regra continuam sem conversão. SSR dirigido 9/9 cobre mudança de dia, fallback, guarda e apresentação preservada; TypeScript saída0. Este recorte não fecha consumidores de calendário ou equivalências.

18/09/2026 — Cobranças e informes: envio, resposta, suspensão de conferência e prazo de informe são mostrados na preferência válida da equipe, com UTC como fallback e origem identificada. Datas de pagamento/vencimento, competência, promessa, valores, cálculos e régua continuam civis. Página SSR e drawers reais 6/6 cobrem mudança de dia, fallback, guarda e preservação de campos; TypeScript saída0.

18/09/2026 — Desistência: criação do pedido, decisão administrativa e efetivação são exibidas na preferência válida da equipe, com UTC como fallback e origem identificada. Contrato, valores, pendências, documentos, permissões, ações e fluxo Q165 permanecem inalterados. SSR dirigido 14/14 cobre mudança de dia, fallback, guarda, escopo por matrícula e decisão; TypeScript saída0.

18/09/2026 — Permuta: somente `aplicadaEm` da compensação efetivada é mostrado na preferência válida da equipe; sem preferência, a referência é UTC. Vigência, período comprovado, vencimentos, valores e cálculos continuam civis e inalterados. Página SSR 5/5 e componente 8/8 cobrem mudança de dia, fallback, guarda e preservação dos campos; TypeScript saída0.

18/09/2026 — Recuperação: propostas de agenda, cancelamento institucional e substituição passam a apresentar instantes no fuso pessoal válido da equipe. Sem preferência, horários publicados/conferidos mantêm o fuso de origem da agenda; criação e decisão administrativas usam UTC. O snapshot legado do cancelamento é normalizado como UTC apenas na projeção, com fuso obtido pelo encontro vinculado, sem alterar JSONB ou hash. Formulários locais e payloads permanecem intactos. Cobertura dirigida de SSR/componentes, vínculo exato e mudança de dia inclui Pacific/Kiritimati; validação independente e revisão visual seguem separadas.

18/09/2026 — Recuperação: quatro históricos administrativos (preparação, pré-reserva, prorrogação e realização especial) passam a formatar instantes ISO UTC na preferência pessoal da equipe, exibindo também a origem UTC. Os formulários `datetime-local` e seus fusos explícitos não foram alterados. SSR dirigido 12/12 cobre mudança de dia, fallback e guarda antes das consultas; TypeScript saída0. A validação independente e a revisão visual permanecem separadas.

| Entrega | Responsável | Estado | Início | Aceite/commit |
|---|---|---|---|---|
| SPEC-ERP-005 — linha comercial do WhatsApp | Claude / integrador | Fases 0–4 codificadas; TypeScript, ESLint e unitários aprovados; **integração não executada** | 26/09/2026 | Origem: teste em produção — número de vendas atribuído ao vendedor não aparecia na inbox dele. Decisões LC-D01–D06 aprovadas pelo responsável do produto. Sem migração de schema/dados. `tsc` saída 0 (29 arquivos, client gerado do schema do worktree, controle negativo conferido); ESLint saída 0; Vitest unitário 2519 aprovados, 10 arquivos com falha de ambiente fora do WhatsApp (pacotes `pdfkit`/`google-auth-library` ausentes no checkout principal, CRLF no compose) — detalhes na SPEC §9. Todo o código das Fases 0–4 está na PR (nada adiado). Verificação a cargo do integrador/tester: rodar `linha-comercial.int.test.ts` + suítes de WhatsApp ajustadas (sem banco descartável nesta sessão) e build; conferir payload real da Evolution 2.3.7 (LID/`messages.set`). Checklist por fase na descrição da PR. |
| Q170 — conjunto de impactos de taxa por aditivo | DEV1 / TESTER / integrador | Implementado e validado localmente, incluindo homologação visual | 18/09/2026 | Migrações232–237; principal9/9 direcionados e arquivo26/26 anterior aos3novos negativos; TESTER26/26+3novos negativos; rotas e callbacks com saídas0. Evidências abaixo. |
| Q168/Q169 — acerto de cobertura e ciclo futuro | DEV2 / TESTER / integrador | Implementado e validado localmente | 18/09/2026 | SQL238/240, interface e emissão real integrados; revisão independente e recortes aprovados. Ensaio combinado real e homologação visual aprovados; arquivo completo53/53 no TESTERb8ac3a80,saída0. |
| Q165 — acerto contratual da desistência | DEV1 Terra / TESTER Terra / integrador | Reconferência na `main`; envio e cancelamento de assinatura pendentes | 20/10/2026 | Até255 integrada em896c5564: principal36/36 integrações,20/20 consulta/página eTS0; TESTER22/22 integrações e revisão aprovada. Limites e evidências abaixo. Em 20/10 (#266): a fotografia delta em SQL reconhece o crédito da Q175. Não está na `main`: o port da assinatura com driver simulado (`EnviarAssinatura`, `CancelarAssinatura`, lote 5 da #164); a tela de documentos da desistência só consulta. O driver real (Q155) é dívida assumida. Fluxo integral permanece parcial. |
| Q167 — destinação do excedente da permuta | DEV2 Terra / integrador | Cálculo e fontes na `main`; destinos decididos (Q171) e não portados | 20/10/2026 | Cálculo14/14 com matriz625; fontes7unitários/2integrações,TS0. A Q171 foi decidida em 21/09 (os dois destinos, por acordo caso a caso) e implementada só na #62. Na `main` não há proposta, concordância, decisão, saldo de serviços nem tela; aguarda o lote Q171 da #164. |
| M01 — conferência inicial de regra histórica | DEV 1 Terra | Integrada e validada localmente | 16/09/2026 | Integrada até b254ba81, migrações 188/190/191 aplicadas no banco descartável; aprovação independente e revisão explícita da versão. Evidências do conjunto M01 abaixo; não equivale à carga real homologada |
| M01 — navegação para regra histórica mapeada | DEV 2 Terra | Implementação local validada | 18/09/2026 | O detalhe do vínculo migrado aponta somente para a turma canônica da correspondência vigente; não aplica vínculo/regra nem altera as permissões da conferência. SSR dirigido 1/1 e TypeScript concluíram com saída 0; não representa conclusão de M01. |
| EMAIL — acesso ao portal e operação dos envios | DEV 1 Terra | Implementação/revisão local e regressão global aprovadas | 16/09/2026 | Base 091d103, interface fc69c8e e revisão 8c056f9; homologação externa pendente |
| VIDEO — publicação e reprodução de revisão fixa | DEV 2 Terra | Implementação/revisão local e regressão global aprovadas | 16/09/2026 | Integrações 99741ba/1db9be3; homologação externa pendente |
| Revisão independente EMAIL/VIDEO | TESTER Terra | Rodadas locais aprovadas | 16/09/2026 | Evidências abaixo; integração global e provedores reais não presumidos |
| N01 — avisos de alteração de agenda | DEV 2 Terra | Diagnósticos e reconferência operacional integrados; homologação externa pendente | 16/09/2026 | Até 188a13d3; reconferência com 7 integrações independentes e TypeScript aprovados; build 6170 aprovado; sem envio real |
| M01 — preparação operacional de migração | DEV 2 Terra | Quatro tipos de entrada previstos implementados localmente; carga real fora do aceite | 16/09/2026 | Cadastro, vínculo, financeiro e presença são os únicos tipos do enum/SPEC. Preparação, ensaio e aplicação têm fluxos próprios; a auditoria abaixo não cria uma quinta categoria histórica. |
| M01 — entrada financeira histórica | DEV 1 Terra; TESTER Terra; integrador | Integrada e validada localmente | 17/09/2026 | Migrações 195/202; principal: 29 integrações/3 arquivos, 8 testes de schema/interface/callbacks e TypeScript, todos exit 0. Aprovação independente, replay, concorrência, data civil e rejeição de destinos divergentes; sem recebimento fabricado |
| M01 — presença histórica | DEV 1 Terra; TESTER Terra; integrador | Integrada e validada localmente | 17/09/2026 | Até `8c8e4215`, migrações 203/206/208/210 nos bancos descartáveis DEV1, TESTER e integração. Principal e TESTER: 28/28 integrações M01/impactos; 2 callbacks e TypeScript aprovados. Aceite independente em `7ecf3db2`. Vigência histórica, fotografia e projeção Q23 preservadas; não representa conclusão dos demais históricos de M01 |
| M01 — conciliação financeira da migração | DEV 1 Terra; TESTER Terra; integrador | Integrada e validada contra cobrança e pagador existentes | 16/09/2026 | 6a3b04d2 / 41556778; migrações 192–194 nos bancos descartáveis. TESTER cd37904b: revisão estática, 18 integrações e 13 testes de interface; principal: 18 integrações e 28 testes de interface/fotografia. Entrada operacional de pagador/obrigação históricos concluída na entrega M01 de entrada financeira acima |

| F07.3 — aplicação conjunta do calendário e modalidade | DEV 2 Terra | Calendário, quantidade, detalhes Q37 e avisos Q38 integrados e validados localmente | 16/09/2026 | Q38 integrado em 93d7bddf. TESTER independente: 19 integrações, 23 unitários e TypeScript; principal: 39 integrações, 17 unitários e TypeScript. Migrações 196–198 somente nos bancos descartáveis. Canais externos desligados; homologação externa pendente |
| REM-01 — conferência de segunda chamada | DEV 2 Terra | Integrada e validada localmente | 17/09/2026 | 47f8953b + correção tipada 717c95af. Exibe reserva, avaliação, professor do encontro e prazo vigente com fuso; contexto obsoleto preserva os dados originais. TESTER: SSR 4/4, consulta 1/1 (57 filtrados), rejeição histórica 1/1 (2 filtrados), TypeScript terminal aprovado após a correção. Principal: 9 testes de página/schema. Sem migração |
| DCT/Q117 — aplicação explícita dos tipos suportados | DEV 2 Terra; TESTER Terra; integrador | Integrada e validada localmente; Q117 completo ainda pendente | 17/09/2026 | Principal até 99e3d239: aplicação imutável, consumidores mensal/hora, ação atômica, histórico visível com revisão obsoleta. SQL 199/200 somente nos bancos descartáveis. TESTER: 37 integrações do checkpoint, 34 unitários, SSR e complementos de rollback/replay; TypeScript final aprovado em f53199f6. Principal: 7 integrações (31 filtradas), 35 unitários/interface e TypeScript. A integração M01 agora prova que, sem origem assinada importada, o aditivo não cria proposta/aplicação/evento nem toca outro contrato (1/1 `b8cad7`, TS `aa418e`, saídas 0); Q177 decide a futura origem apta. Agenda e tipos sem consumidor permanecem pendentes |
| DCT/Q117 — agenda particular vinculada ao aditivo | DEV 2 Terra; TESTER Terra; integrador | Integrada e validada localmente | 17/09/2026 | Fotografia pode ser preparada por Secretaria/Gestão e selecionada pela Secretaria na proposta contratual, sem ampliar a preparação do aditivo. A aplicação formalizada revalida fonte, pendências e fotografia, atualiza todos os encontros junto das condições ou reverte tudo; alçada pedagógica, participantes, PDF, assinatura e conferência final seguem o fluxo existente. Avisos Q38 são criados somente após a aplicação e revalidam aplicação, versão/hash, fotografia e estado atual também no e-mail/WhatsApp; proposta/agenda obsoleta não é enviada. Migração 201 aplicada nos bancos descartáveis DEV2, TESTER e integração; 204/205 integradas e aplicadas nos três bancos descartáveis, com aceite descrito na fila residual. DEV: 17 integrações Q117, 39 regressões Q38, 10 testes de UI/efeitos/formatação e TypeScript com saída 0. Reposições individuais permanecem no fluxo próprio; grade flexível não ganha recorrência implícita e Q111 não limita alterações futuras a um único encontro |
| F07.6 — agendamento inicial de reposição particular | DEV 1 Terra | Implementado, integrado e validado localmente | 16/09/2026 | 37c9a22f/952dbceb; TESTER: 22 integrações, 15 controles/SSR e TypeScript; principal: 22 integrações e 2 controles/SSR. Sem homologação operacional presumida |
| F07.6 — realização docente da reposição particular | DEV 1 Terra | Integrada e validada localmente | 16/09/2026 | 4c4e6470/17151ea8; DEV e TESTER: 50 integrações cada; principal: 3 controles/SSR. Sem homologação operacional presumida |
| F07.6/Q19 — exceção pontual de agenda | DEV 1 Terra | Integrada e validada localmente | 16/09/2026 | dcf7f763/a3448cc2; TESTER: 12 integrações e 2 controles/SSR; principal: 28 integrações de agenda/permissões. Aprovação não cria agenda nem altera calendário |
| ACA/V01 — recuperação, transferência, fechamento e portal | TESTER Terra | Cenário integrado validado localmente | 17/09/2026 | Commit deste worktree: recuperação oficial da origem, equivalência proposta/aprovada, execução pela Secretaria, fechamento e consulta do portal. Duas matrículas da mesma aluna permanecem isoladas. Integração dirigida 5/5 e TypeScript, ambos exit 0 no banco descartável TESTER; não equivale a homologação externa ou à conclusão integral de V01 |
| CT08 — comprovante em conferência, régua e acesso D+30 | TESTER Terra | Cenário composto validado localmente | 17/09/2026 | Duas matrículas e duas cobranças: o informe real da primeira congela somente seu lembrete por 48h, a segunda é despachada, o prazo retoma a primeira sem rejeição artificial ou baixa, e ambas preservam a restrição automática de aulas D+30. Relógio fixo, ações reais e banco descartável TESTER. Integração dirigida `conferencia.int.test.ts`: 9/9, sessão 542356, saída 0; TypeScript na mesma sessão, saída 0 |
| CT09 — particular, conferência e fechamento de horas | TESTER Terra | Cenário integrado validado localmente | 17/09/2026 | Particular sem `AulaDiario`: ocorrência real da primeira aula, prévia e conferência financeira, decisão parcial e emissão; a segunda ocorrência conferida entra somente no complemento. Cada conferência origina exatamente um item/cobrança, sem recebimento ou duplicação. Integração dirigida `condicoes-horas.int.test.ts -t CT09`: 1/1, 22 testes fora do filtro, sessão 26c4a0, saída 0; TypeScript sessão 697e78, saída 0 |
| CT11 — gravação indisponível, pausa e avaliador | TESTER Terra | Concluído e validado localmente | 17/09/2026 | Cenário real79b16776 aprovado independentemente:1/1,21fora do filtro. Preserva entrega/autoria e prazo restante após indisponibilidade/troca; pausa bloqueia envios sem liberação específica. Q40/Q54 completos32/32 noTESTER; callbacks finais11/11 incluindo DCT03. Evidênciad8166ad4 integrada em62fd30a2. |

### M01 — auditoria de completude local (18/09/2026)

| Requisito da SPEC | Implementação e prova local | Situação/pendência real |
|---|---|---|
| Preparar fonte por origem/ID, prévia, pendências, colisões e reenvio | `src/server/migracao/preparacao.ts`, `acoes.ts`, `consultas.ts` e `preparacao*.test.ts` preservam fotografia, origem/chave, conflitos e autoria. | Implementado localmente. Carga real continua separada; nenhuma fonte real foi inferida ou importada. |
| CSV/XLSX até 5 MB, aba e mapeamento manual, sem associação automática | `planilha-leitura.ts`, `planilha.ts`, `planilha-acoes.ts` e `PreparacaoMigracaoPainel.tsx`; testes `planilha*.test.ts` e `planilha-acoes*.test.ts`. | Implementado localmente; CSV conserva texto/zeros e cabeçalhos repetidos, XLSX respeita o limite. |
| Tipos de linha permitidos | Enum `TipoEntradaPreparacaoMigracao`, schemas e painel limitam a `CADASTRO`, `VINCULO_MATRICULA`, `FINANCEIRO_HISTORICO` e `HISTORICO_PRESENCA`. | Implementado. A SPEC não define quinto tipo de histórico; não há lacuna local a preencher por inferência. |
| Cadastro e vínculo histórico | `aplicacao-cadastro.ts`, `ensaio-vinculo.ts`, `aplicar-vinculo.ts` e suas integrações/adversariais cobrem mapa origem→destino, revisões vigentes, ensaio, fatos/termos, replay e divergência. A navegação para a turma canônica está em `b38d0fb0`. | Implementado localmente. Produção exige fontes reais revisadas, correspondências e corte próprios. |
| Regra/consumidores acadêmicos de vínculo migrado | `conferencia-regra-historica*.ts`, `m01-lancamento-historico.int.test.ts`, `m01-frequencia-historica-aplicada.int.test.ts`, `m01-chamada-historica.int.test.ts` e `m01-intervalo-segunda-migrado.int.test.ts`. | Implementado localmente; a conferência mantém proposta, decisão independente e revalidação. |
| Histórico financeiro e conciliação | `entrada-financeira-historica.ts`, `conciliacao-financeira.ts`, consultas/telas financeiras e `entrada-financeira-historica.int.test.ts`, `conciliacao-financeira.int.test.ts`, `consultas-financeiras.int.test.ts`. | Implementado localmente: obrigação pendente ou conciliação evidenciada, sem fabricar recebimento, quitação ou crédito. Carga real continua pendente. |
| Histórico de presença e divergência Q23 | `presenca-historica.ts`, rota/tela de presença e integrações de presença/impactos; migrações 203/206/208/210 e aceite `7ecf3db2`. | Fluxo local implementado. A divergência textual de papéis identificada nesta auditoria foi corrigida em `PresencaHistorica.tsx`, sem alterar guardas; o teste de componente confirma a orientação para os três papéis autorizados. |
| Operação externa e carga real | Ações M01 não chamam avisos, cobranças recorrentes ou transporte externo; o checklist de dados exige fonte e conferência reais. | Deliberadamente fora do aceite local: requer dados reais, corte, reconciliação e homologação operacional; não é lacuna de código local. |

## Fila corrente de implementação local — 18/09/2026

Esta fila substitui os checkpoints históricos preservados abaixo. Implementação local não exige envios reais, contas externas, carga real ou deploy; exige os adaptadores e caminhos de falha previstos na SPEC. Pendência de fornecedor não é homologação externa: ainda falta implementar o adaptador escolhido.

| Frente | Situação atual | Próximo passo / limite |
|---|---|---|
| Q20/Q21 — revisão de calendário sem remarcações | Integrada e validada localmente em103e25d4/1588ebd1 | Migração268; cinco arquivos de integração9/9 e TypeScript saída0. Publica revisão válida sem mudar encontros ou gerar avisos inexistentes; preserva aprovação independente e recusa de fotografia obsoleta. |
| Transferências — destino comprovado pela agenda | DEV2 implementando; revisão do integrador em andamento | Checkpoint4638a43f ainda não integrado. Revalidação de retryv3 e provas de alterações passadas/futuras pendentes; alterações posteriores aprovadas precisam permitir nova preparação sem reutilizar aprovação antiga. Não declarar aceite pelo recorte de calendário vazio. |
| Q161 — comprovação de oferta após replanejamento | Integrada em0914a7a1/a9d97763; revisão funcional pendente | Integração solicitada em21/09. Unitários19/19 e TypeScript0; integração com banco não iniciou por ambiente indisponível. Ainda corrigir evolução legítima PREVISTO→MINISTRADO após a revisão e tratar alterações individuais posteriores aprovadas, preservando conferência pedagógica quando necessário. |
| Ambiente — convergência da preservação de cobranças | SQL269 integrada em e9c8de93; complemento19a82cda validado | Corpo instalado e checksum da269 conferidos; arquivo financeiro10/10 antes do complemento e recorte3/3 após,8filtrados; TypeScript0. Divergência histórica138000 registrada e preservada, sem edição de checksum. |
| Q23 — docente propõe correção de gravação | Integrada em cbac91a9/db47fe0b; revisão independente aprovada em 38d169a9 | Principal e TESTER: 4/4 integrações docentes (incluindo particular e dupla função), 10/10 de autorização, 5/5 unitários/SSR e TypeScript saída 0. Teste adicional 17f353f0 integrado em f9399dd6; DEV2 conferiu a navegação contextual e os guards sem identificar bloqueio. Correção financeira da aula e propagação a materiais já fixados não recebem aceite por esta entrega. |
| Q23 — revisão financeira da correção de presença | Fluxo sem alteração de valores integrado e validado independentemente, incluindo concorrência | Base 257 e corretiva 259, ações e tela financeira próprias. Principal: 59 testes de condições/correção e TS aprovados antes da 259. TESTER em 193f6cef: 25/25 integrações de condições (58004/ee662c), 4/4 testes de página/callback (aeb50d) e TypeScript (942b5f), todos com saída 0. Prova concorrente com bloqueios PostgreSQL observados integrada em 9a20a270: principal 1/1 (24 fora do filtro), saída 0 em 2b02d0; TESTER em 1139de50, mesmo recorte 1/1 (24 fora do filtro), saída 0 em 2e883b. Ambas as ações aguardam bloqueio real antes da liberação; informe posterior invalida a fotografia e exige nova decisão. Reserva/consumo antecipado e efeitos monetários diferentes continuam fora deste recorte e pendentes. |
| Q23/Q57 — troca aprovada da fonte de reposição | Implementado e validado localmente, com revisão independente aprovada | Migração260 aplicada. Root1148f45a/73946978: 5/5 integrações novas (71356/c60fd9) e 8/8 testes de interface/callbacks (3ffd93), saídas0. Preserva entregas/prazos e comprova disputa real com mudança da publicação. TESTER aprovou d2479444: 5/5 integrações, 8/8 interface/callbacks e TypeScript saída0; revisão final confirma histórico, rejeição, elegibilidade, preservação dos registros e concorrência. |
| Q23 — correção após consumo antecipado | Implementada e validada localmente em 2f5a857d | DEV: 3/3 integrações completas (54931), 3/3 callbacks e TypeScript, saídas 0. Cobertura de ambas as fontes, preço original, preservação financeira, negativas de aprovação e concorrência real. Root: callbacks 3/3 (aa5f83) e TypeScript (65485/21384c), saídas 0. TESTER aprovou o commit exato 00183825: 3/3 integrações completas (18699), 3/3 callbacks e TypeScript (11934), saídas 0. Revisão confirmou projeção restrita e aprovação bloqueada se a memória financeira não puder ser apresentada. Não inclui correções com mudança de valor, pendentes da Q175. |
| Q145 — autorização do atendimento pedagógico por matrícula | Implementada e validada localmente até 27994006/802cf94a | Migrações 264/265, servidor, interface e avisos integrados. TESTER aprovou d9522359: novos 7/7 (b0de95), regressão de acesso 14/14 (720427) e TypeScript (c5482b), saídas 0. Aprovações anteriores de avisos/reconferência preservadas. Telefone alterado/removido e WhatsApp desativado bloqueiam novo envio sem apagar histórico; responsável exige autorização por matrícula. Sem envio real ou homologação de provedor. |
| CT-01 — isolamento completo entre contratos | Comprovado localmente em 51ded488/ac8a3095 | DEV: 2/2 e TypeScript aprovados; complemento 2/2 (9a76ac). TESTER aprovou c060e81c: 2/2 (18a205), saída 0. Acesso de A autorizado antes e bloqueado após pausa/encerramento; financeiro e acesso de B preservados, replay idempotente. Drive fictício, sem transporte externo; não exigiu correção de produção. |
| CT-03 — exportação durante transferência | Correção validada localmente em f154e7d9/e5266af8 | Bug corrigido: aluno permanece visível por B, mas XLSX não pode conservar turma A fora do escopo. Assinatura canônica por IDs evita rejeição espúria de homônimos. DEV: 12/12 (108280) e TS (dfef39); TESTER 3d7db418: 12/12 (3327bd) e TS (8e51da), saídas 0. Perda total/parcial e revogação de visão ampla bloqueiam resposta sem evento de sucesso. |
| CT-04 — primeira chamada histórica por responsável pontual | Comprovado localmente em 678cb91b/f4032e8b | DEV: 1/1 integração (99f56f) e TypeScript (9a7f03), saídas 0. TESTER em f1d2e48f: 1/1 (190b5a) e TypeScript (931931), saídas 0. Guard real, vínculo docente encerrado, titular substituto distinto do regularizador, aluno transferido e autoria histórica preservada; replay da designação e escopo por encontro conferidos. |
| CT-05 — conflito resolvido e aplicação conjunta do calendário | Comprovado localmente em 18d0bcd0 | DEV: 1/1 (9e8f04) e TypeScript (b272d5), saídas 0. TESTER ec9f7bf6: 1/1 (9b7e9f) e TypeScript (22d2cc), saídas 0. Conflito bloqueia ambas as turmas; cancelamento do encontro conflitante por fixture permite nova fotografia/revisão; aplicação preserva encontro ministrado e diário, replay conserva aplicação única. Não homologa o fluxo de cancelamento usado na preparação. |
| CT-06 — composição de datas e fusos | Integração comprovada; apresentação ainda incompleta | TESTER: 1/1 (339cfd), TypeScript (459542), reexecução após restauração de ambiente 1/1 (f83342), saídas 0. Continuidade calcula fevereiro dia 28 e março dia 31 sem sobreposição/duplicação. Auditoria das telas encontrou fuso implícito no histórico do diário e no caixa; o teste Intl não comprova essas telas. |
| Preferência de fuso de exibição | Perfil de equipe/portal e consumidores acadêmicos integrados; auditoria dos demais consumidores em andamento | Migrações 266/267 integradas e aplicadas no integracao, dev-email e tester; domínio validado para Intl. Calendário, avaliações, recuperações, segundas chamadas, regras, equivalências, mudanças acadêmicas, ficha por matrícula e fechamento do portal possuem entregas com testes dirigidos nas notas. Últimos complementos 4a1c448f/12891802. Preservados dados civis, fusos de entrada e snapshots; não declarar cobertura de todos os consumidores por este recorte. |
| Vencimento no caixa | Projeção civil e Q176 na `main` | Caixa, fila de cobrança, ficha e conciliação usam fontes persistidas, com precedência por versão e pendência quando insuficientes. Pausa/retomada e aditivo cobertos por integrações reais descritas nas notas. Q176 (régua de dias e D+30 no fuso da escola) entrou pela #239 e foi completada pelas #243, #247, #253 e #255. Sem fuso configurado, `fusoDaEscola()` usa `America/Sao_Paulo`. |
| Q165 — desistência em preparação | Fluxo contratual e reconferência na `main`; assinatura pendente | Fornecedor Q155 necessário para envio/cancelamento autenticado. Novo crédito delta e ajuste material cobertos por cenário real com ajuste aprovado, recebimento, reconferência e efetivação. O port da assinatura com driver simulado da #62 (lote 5 da #164) não está na `main`. |
| Q167 — excedente de permuta | Cálculo e fontes na `main`; destinos decididos e não portados | Q167C confirmada: acordo por caso e aprovação independente. Q171 decidida em 21/09: o acordo escolhe entre saldo restrito a serviços e crédito financeiro. Implementada só na #62; na `main` faltam proposta, aplicação e interface. |
| DCT03 — aditivos | Agenda, taxa Q170, cobertura/ciclo Q168/Q169, adiantamento Q172 e recusa de regime Q174 na `main`; moeda Q173 e origem histórica não | Q172 (#261, #264, #270, #272; migration `20261020100000`): só enquanto o adiantamento não foi pago nem usado. Q174 (#260): recusa na preparação, só no servidor. Q173 e a origem contratual histórica foram decididas em 21/09 e implementadas só na #62. Não aplicar condições sem consumidor operacional. |
| ACA — impedimento da escola | Q164 na `main` | #265 e #268, migration `20261020200000`. A gestão pedagógica confirma, com justificativa, que uma realização posterior com nota oficial resolveu o impedimento; a reserva em `PENDENCIA_ESCOLA` continua no histórico e nada é presumido sem essa confirmação. |
| M01, Q69, Q87, Q40/Q54 e CT12 | Recortes locais implementados e validados | As antigas pendências de UI/revisão/reinicialização nos checkpoints abaixo estão superadas pelas evidências posteriores. Carga real e provedores reais não compõem este aceite local. |
| Q102 — identificação de contratos legados | Integrado em 264ee4dc e 9cf0d946; validação local dirigida aprovada | Dois contratos sem código do mesmo aluno/produto precisam de identificação estável distinta. Os handlers já enviam a seleção explícita correta; não há mudança de regra ou schema. |
| Q92 — consumo de horas antecipadas por falta/cancelamento tardio | Código, tela, schema e testes integrados; revisão independente aprovada | Migração 258 aplicada em dev-email, integracao e tester. Principal: 29 integrações e TS aprovados; TESTER: 29 integrações e TS aprovados antes do complemento 7400f940. Negativos adicionais de cancelamento sem consumo, XOR e vínculo cruzado aprovados pelo TESTER: 2/2 em30850/f7cc50, saída0. Não inclui correção posterior do consumo, tratada na frente Q23. |
| V01 — verificação final da SPEC | Em andamento | Conferir critérios restantes por domínio e executar regressão após a integração relevante; não transformar testes de um recorte em conclusão global. |

## Histórico de verificações (estados anteriores)

### Resumos anteriores preservados — não usar como fila atual

Revisão corrente Q117/Q38: código DEV `5f560343` integrado em `837c88a9`; corretiva 205 integrada em `05ce348b` vincula o evento canônico à aplicação. Migrações 204/205 nos bancos descartáveis DEV2, TESTER e integração. Principal: 17/17 integrações pós-correção (sessão 77933), incluindo regressão independente de clone fiel e fuso; 10/10 unitários/interface e TypeScript após correção tipada `0dae0e17`, todos saída 0. TESTER aprovou o conjunto corrigido: 17 integrações de agenda, 38 de aditivos, 6 testes de interface e TypeScript, todos saída 0. M01 presença histórica possui interface, resolução e testes locais; a orientação dos papéis autorizados foi alinhada ao servidor/SPEC sem alterar guardas. DEV2 iniciou B02/Q69 após essa correção; não declarar essas frentes concluídas apenas pelos testes anteriores.

Conciliação financeira integrada até `41556778`: fonte e complementos preservados, decisão independente, recebimento histórico ou vínculo a recibo existente, pendência resolvível e proteção contra duplicidade. Migrações 192–194 aplicadas apenas nos bancos descartáveis. Testes do TESTER foram executados novamente pelo integrador após recuperação do cluster: 18/18 integrações com relatório JSON terminal e 13 testes de interface. No principal: 18/18 integrações e 28 testes de interface/fotografia. Build DEV1 aprovado (81 páginas), TypeScript e revisão estática independentes aprovados.

Entrada financeira histórica M01 integrada e validada localmente: o Financeiro prepara pagador e obrigação pendente, outra pessoa aprova e aplica; não depende de criar esses pré-requisitos diretamente no banco. Migrações 195/202 somente nos bancos descartáveis DEV1, TESTER e integração. Principal: 29 integrações dirigidas, 8 testes de schema/interface/callbacks e TypeScript aprovados. A SPEC define quatro tipos de entrada M01, todos mapeados na auditoria abaixo; carga real e homologação externa continuam fora do aceite local. Avisos Q38 integrados e validados localmente em 93d7bddf. O núcleo Q117 de agenda por aditivo está integrado: fotografia persistida, alçadas e assinatura existentes, formalização e aplicação atômica revalidada. Migração 201 nos bancos descartáveis DEV2, TESTER e integração. TESTER: 54 integrações; principal: 16 integrações, 11 unitários e TypeScript. Interface operacional e avisos Q38 continuam com DEV2; não declarar Q117 completo. Carga real e homologação externa permanecem pendentes.

### Fila residual para aceite local — revisão de 17/09/2026

DCT03 — ambiente DEV1 preparado: merge coordenado `c4d7520f` reuniu base financeira/Q87 e schema do acerto de taxa; conflitos resolvidos preservando relações de ambos. Após corrigir a unicidade da origem de crédito por cobrança (`de91e466`), cadeia 201/204/205/207/209/211/212 aplicada somente no banco descartável `erp_genius_test_dev_email`; Prisma Client gerado, sessão 76120 saída 0. SQL 212 agora imutável, SHA-256 `BFCDB32957B69C1028FCAC2B35E5DAC678AA726B0AB352F5E9B961C85EEF4CDD`. Ensaio transacional com rollback anterior aprovado. Ações/interface ainda em revisão e testes de integração pendentes; não representa aceite da funcionalidade.

Q87 — ambiente DEV2 atualizado: migração 211 do commit `6d0dc240` aplicada somente em `erp_genius_test_dev_gravacoes` (localhost:54329); Prisma Client gerado, sessão 4560 saída 0. SHA-256 imutável do SQL aplicado: `09F93FCFA25C51EE7E2FE2A1114458F98852447E03B96C5DBB676471276C1AF1`. Ensaio anterior com rollback detectou e permitiu corrigir uma referência inválida no UPDATE de conciliações; segundo ensaio passou. Após aplicação, baseline local confirmou preservação de todos os campos originais do único recebimento existente e destinação legada 1:1 com mesmo valor/cobrança. Consumidores, interface e testes de fluxos Q87 seguem com DEV2; esta aplicação não declara Q87 concluída nem altera o banco principal/TESTER.

Checkpoint de revisão após `24049fa3`: regressão unitária completa com 1.481/1.481 testes, zero falhas e zero pendentes, após a correção de mocks `e9789aeb`; relatório local `node_modules/.cache/regressao-unitaria-1da79db0-corrigida.json`, execução terminal com saída 0. A regressão integrada independente em `eccdd9b2` continua em execução na sessão 95634, confirmada pelo TESTER; ainda sem resultado terminal. Esses números não comprovam conclusão das funcionalidades pendentes.

Revisão das próximas migrações: 211/Q87 (`13c04a1d`) e 212/taxa por aditivo (`e74608af`) permanecem não aplicadas. Q87 precisa preservar também os bloqueios de destinação para cobranças em desistência ou regularização de período sem oferta. A 212 precisa permitir aditivos sucessivos da mesma taxa, validar permissões e correspondência integral entre proposta/decisão/aplicação e oferecer tratamento aprovado para valores já liquidados. Os DEVs seguem nesses ajustes antes da integração; schema validado não equivale ao fluxo implementado.

Build local em `03bc900c`: `next build` com `DATABASE_URL` resolvida pelo perfil descartável `integracao`, telemetria desativada, sessão 81424 finalizada com saída 0. Compilação, TypeScript e geração de 81/81 páginas concluídos. Não houve publicação nem envio externo. O build confirma a compilação do código integrado, sem antecipar aceite das migrações 211/212 ou dos fluxos ainda em desenvolvimento.

Q69 — revisão complementar de acesso: cancelamento e conciliação agora verificam a capacidade vigente antes de devolver o resultado de uma repetição já registrada. O usuário que perdeu a capacidade, mas conserva o papel Financeiro, não recebe sucesso pela antiga autorização. Teste dirigido `compra-horas.int.test.ts -t 'reserva devolução aprovada'`: 1 aprovado, 27 fora do filtro, saída 0; verifica ambos os retornos recusados sem novos eventos ou alteração do estado financeiro. TypeScript não incremental, sessão 97252, saída 0. Sem alteração de schema.

O objetivo solicitado é concluir a implementação local. Configuração de contas externas, envios reais, carga real e deploy não compõem o aceite local; adaptadores, estados de erro e testes simulados continuam obrigatórios. Esta fila registra lacunas confirmadas, sem substituir a conferência dos demais critérios da SPEC e sem gerar um percentual global.

| Frente | Situação local | Evidência / próximo aceite |
|---|---|---|
| DCT03/Q117 — agenda particular | Recorte local concluído | Interface e Q38 integrados em `837c88a9`; evento canônico em `05ce348b`. Principal: 17 integrações; TESTER: 55 integrações, 6 testes de interface e TypeScript, saída 0. Demais tipos de aditivo permanecem na frente abaixo |
| M01 — histórico de presença | Concluída e validada localmente | Até `8c8e4215`, migrações 203/206/208/210 nos bancos descartáveis. Principal: 28/28 integrações M01/impactos, sessão 8157 saída 0; callbacks 2/2. TESTER independente: 28 integrações, 2 callbacks e TypeScript, saída 0; evidência `eccdd9b2` integrada em `7ecf3db2`. Não equivale à carga real nem à conclusão de todos os tipos de histórico M01 |
| B02/Q69 — devolução de crédito | Concluída e validada localmente | Até `10b6926f`, migrações 207/209. TESTER independente: 28 integrações de compra de horas, 18 de período integral, 4 UI/capacidades e TypeScript, saída 0; evidência `2cd6ef02` integrada em `bec044b0`. Proposta, aprovação independente, reserva, execução manual, cancelamento, conciliação e concorrência Q68×Q69. Não inclui transferências bancárias automáticas nem Q87 |
| B02/Q87 — recebimento com destinações e antecipação | Integrado e validado localmente | Núcleo52bdf51f, autoria/prova054385e9, interface0fa78a18 e reserva f17fc0f8. Principal:6/6 recebimentos,28/28 compra-horas,42/42 unitários/interface/permissões e TypeScript saída0. TESTER:6/6 recebimentos,4/4 callbacks,TypeScript e cenário real Q108 1/1 (67 fora do filtro). Não inclui operação externa |

| M01 — histórico de presença | Integrada parcialmente; aceite pendente | Até `79995e44`, migrações 203/206 nos bancos descartáveis DEV1 e integração. Corrigidos leitura de vigência Q23/Q54 e replay da resolução. Principal: 67/68 testes em quatro arquivos; falha era mensagem de recusa antecipada de vínculo inválido, expectativa ajustada e cenário reexecutado com sucesso. TypeScript saída 0. Corretiva 208 reservada para revalidar fotografia da aula/vínculo; negativos temporais e revisão independente ainda pendentes |
| B02/Q69 — devolução de crédito | Integrada; validação final pendente | Até `693440db`, migrações 207/209 aplicadas no DEV2 e integração. Proposta, aprovação independente, reserva, execução manual, cancelamento e conciliação de incerteza implementados. Principal: 45 integrações em compra de horas/M01, depois 22 cenários financeiros dirigidos (24 fora do filtro), todos saída 0. `5b28e89b` habilita concessão da capacidade na tela administrativa; 2 testes e TypeScript aprovados. TESTER concluiu revisão estática; callbacks e validação independente executável do conjunto ainda pendentes |
| B02/Q87 — recebimento com destinações e antecipação | Fixtures e consumidores em integração; aceite pendente | Migração 211 aplicada no banco descartável separa o fato de caixa das destinações, preserva o legado 1:1 e impede duplicar crédito. As fixtures agora usam o writer transacional com cobrança pendente, capacidade financeira e evidência; TypeScript e integrações dirigidas de fluxo acadêmico, M01 e preparação de desistência passaram localmente. UI, regressão ampliada e revisão independente continuam pendentes |
| Q40 — substituição de avaliador de reposição gravada | Implementado e validado localmente; revisão independente pendente | `fc28a968`, com migração 215 já aplicada pelo integrador. Gestão designa o primeiro avaliador ou substitui o vigente por transação append-only, preservando autoria e prazo. Integração dirigida `reposicao-entrega-operacional.int.test.ts`: 20/20, sessão 14712, saída 0; callbacks da tela 3/3 e Q54 pós-substituição 1/1; TypeScript, sessões 70425, 98890 e 60776, saída 0. Cobertura inclui replay, concorrência, rotação de chave após sucesso, retry congelado após erro, fronteira de milissegundo, retirada de acesso do anterior, ciclo entre IDs rejeitado, retorno A→B→A e continuidade após fim histórico |
| P02/Q89/Q98 — permuta | Aplicação local em revisão | Migrações219/221/222/223 aplicadas na integração; ledger próprio separado de caixa/crédito, interface com múltiplos destinos, saldo atual e concorrência testados. Restam consumidores de acertos, Q167, revisão independente e homologação visual. |
| DCT03 — demais alterações operacionais | DEV1 implementa taxa por aditivo; demais tipos pendentes | Migrações212/213/216/217 integradas e aplicadas nos bancos locais; proposta, decisão, aplicação e invalidação com interface validadas nos recortes abaixo. Aumento após crédito exige corretiva218 e atualização dos consumidores em andamento; sem aceite completo. Acerto sobre cobrança de matrícula real, com cadeia Q117 e aprovação financeira independente, preservando pagamentos e original. Cobertura, primeira mensalidade, adiantamento, moeda e regime continuam na fila; PDF assinado sozinho não comprova aplicação |
| V01 — cenários integrados e regressão final | Pendente após integração das frentes | Conferir CT-01–CT-12 e demais critérios por domínio; executar regressão apropriada, build e fluxos locais. Auditoria 609 é histórica e não comprova o estado corrente |

Critérios B02/Q69 já atendidos no aceite local registrado acima: pedido do aluno e destino conferido; proposta financeira versionada; aprovação por outra pessoa com capacidade de aprovação; reserva de saldo ao aprovar; execução por usuário com capacidade própria, que pode ser o preparador; evidência da saída e conciliação de resultado incerto. A reserva e a saída confirmada devem descontar uma única vez do saldo disponível tanto em TypeScript quanto nos guards SQL, impedindo uso e devolução concorrentes. Rejeição não executa saída; resultado incerto não libera saldo nem autoriza repetição automática. A interface deve permitir percorrer o fluxo e consultar os estados. Recebimentos e cobranças originais ficam preservados. Q87, com destinações de um recebimento para vários períodos, é uma entrega distinta posterior; não considerar Q69 como implementação de Q87. Nenhuma operação real com provedor está autorizada nesta validação local.

Aceite técnico B02/Q87 confirmado no código em 17/09/2026: migrar o vínculo financeiro sem duplicar fatos de caixa; cada recebimento legado deve conservar ID, valor e data e ter sua destinação anterior preservada. As destinações não podem superar o valor original, misturar moedas ou transferir titularidade. Atualizar consumidores que hoje somam diretamente `cobranca.recebimentos`, incluindo compra de horas, conferências e acertos; o relatório de caixa continua contando o recebimento original uma única vez. Antecipação sem destino precisa de origem rastreável de crédito, com uso/devolução pelos fluxos aprovados, sem cobrança fictícia. Testar um pagamento destinado a dois períodos, saldo sem destino, concorrência/repetição, preservação do legado e saldo após uso/devolução. Esta definição prepara a próxima tarefa; não declara implementação.

17/09/2026 — integração M01/B02 em `5bf1a0a4`: 207/208/209/210 aplicadas no banco descartável principal; cliente Prisma gerado, sessão 47762 saída 0. A 208 exigiu a corretiva 210 porque variável SQL `record` não atendia ao parâmetro composto `AlocacaoTurma`; nenhuma migração aplicada foi editada. Regressão dirigida principal em `5bf1a0a4`: 45/45 em dois arquivos, sessão 70820 saída 0. Após integrar concorrência Q68×Q69 e acesso à conciliação em `693440db`: 22 aprovados e 24 fora do filtro em compra de horas/período integral, sessão 23030 saída 0; TypeScript sessão 47296 saída 0. Isso não é regressão global nem aceite final dos dois fluxos. CT10 também reexecutado no principal com sucesso; Q165 permanece aguardando decisão específica, sem impedir trabalhos independentes.

17/09/2026 — ambiente DEV2: identificada divergência de checksum da migração 204 no banco descartável `erp_genius_test_dev_gravacoes`. A versão aplicada previamente não estava preservada nos commits disponíveis; origem dessa aplicação não confirmada. O integrador reconstruiu exclusivamente esse banco, conferindo host `localhost`, porta `54329` e nome exato pelo perfil, com `migrate reset --force --skip-seed`. Cadeia revisada e Prisma Client concluídos na sessão 99146, saída 0. A base 204 passa a ser o commit `c332eaf8`, SHA256 `4849EB9D4F42DEC4358985FE5D68332019032BA530B4C80CF88584A828758A9A`, imutável após essa aplicação. Não houve alteração manual de checksums, dados reais ou outro banco. Testes Q117/Q38 novamente liberados para DEV2; entrega ainda não aceita.



### Rastreabilidade dos cenários transversais — auditoria de 17/09/2026

Esta auditoria identifica testes existentes, sem declarar que um teste isolado comprova todo o cenário. A conclusão integral exige conferir o percurso composto e a evidência terminal correspondente.

| Critério da SPEC central | Evidência localizada / trabalho restante |
|---|---|
| CT-01 — contratos independentes | `pausa-proposta.int.test.ts` e `portal-aluno/resultados.int.test.ts`; percurso acadêmico composto validado em `aproveitamento-aplicado.int.test.ts`. Ainda conferir o percurso financeiro completo pausa/encerramento de somente um contrato |
| CT-02 — alteração coletiva atômica | `pausa-proposta.int.test.ts`: alteração de contexto impede aplicação parcial. Incorporar essa evidência à rodada integrada final |
| CT-03 — troca de identificadores | Negativos em alocação, encerramento e exportações; falta consolidar evidência de leitura, mutação e arquivo no mesmo escopo |
| CT-04 — chamada histórica e responsável pontual | `diario/regularizacao-designacao.int.test.ts` e avaliações; M01 histórico em complementação. Não inferir autoria ou elegibilidade pelo vínculo atual |
| CT-05 — conflito em mudança global | `agenda/replanejamento-conjunto-adversarial.int.test.ts`; verificar conjunto sem aplicação parcial na rodada final |
| CT-06 — datas e fusos | Cobertura, calendário e fuso têm testes dirigidos; Q117 inclui meia-noite e sessão SQL com outro fuso. Falta reunir evidências do vencimento/cobertura sem confundi-los com agenda |
| CT-07 — reservas e dinheiro concorrentes | Benefícios e uso de crédito têm cobertura; devolução Q69 está em implementação e falta comprovar concorrência entre uso e devolução |
| CT-08 — comprovante e lembretes | Cenário composto integrado em `05425e1c`: prazo de 48h, duas cobranças, retomada específica sem baixa e bloqueio D+30 preservado. TESTER e principal: 9/9 integrações, principal sessão 18551 saída 0; TESTER TypeScript aprovado |
| CT-09 — apuração sem gravação | Cenário integrado em `53f2eb05`: ocorrência financeira sem diário/gravação, emissão parcial e complemento sem duplicação. Reexecutado no principal: `condicoes-horas.int.test.ts -t CT09`, 1/1 aprovado, 22 fora do filtro, saída 0 em 17/09/2026. Não equivale à regressão completa |
| CT-10 — encerramento e acerto | Cenário de matrícula ativa integrado em `df395b72`: proporcional, desconto, multa contratual separada, recebimento preservado, autoaprovação recusada e outro contrato intocado. Reexecutado no principal com sucesso. Não abrange a desistência antes da ativação da Q165 ainda pendente |
| CT-11 — indisponibilidade e avaliação | Cenário composto concluído localmente em79b16776, aceite independente d8166ad4; preserva material, prazo, autoria e permissões após substituição e pausa |
| CT-12 — falha e repetição | Envio Resend, processamento do portal e conciliação M01 têm testes; falta evidência transversal de reinício/reenvio e repetição de migração sem duplicação |

17/09/2026 — continuação local com dois DEVs Terra: migração 195 revisada até o checkpoint DEV `944df249` e aplicada somente em `dev-email`, com geração do Prisma Client e saída terminal 0. Hash SHA-256 aplicado: `D0C17EA5E68C1EAA7DAE1C55177D2E46C0930EB95F71A4A6FBBEAA9014BD125F`; SQL aplicado é imutável. A primeira integração do DEV encontrou divergência no guard da aplicação e reverteu a transação; entrega ainda não aprovada nem integrada. Corretiva 202 reservada (`20260917110000_correcao_entrada_financeira_historica`), dependente de diagnóstico, sem aplicação. Migração 201 de agenda permanece em revisão, sem aplicação: conferir vínculo com a formalização existente, aplicação conjunta obrigatória e revalidação sem invalidar a própria versão de aditivo. Schemas Prisma dos dois DEVs validados com saída 0. Nenhum envio real ou deploy.

17/09/2026 — complemento do formulário Q117 revisado: a versão inicial 1c08fced não foi aceita como prova de interação; sua correção 86c9ea09 exercita callbacks do componente real, com hooks/FormData simulados. Principal: dois testes de callbacks e um SSR aprovados (3/3), verificando docente atual no select, payload UTC na action, horário DST inválido sem chamada, limpeza do resultado e fieldset desabilitado. Não equivale a ensaio em navegador. A correção b78d9bb6 de substituição docente pendente também recebeu revisão independente sem achado.

17/09/2026 — revisão independente da interface DEV 490c6b87 aprovada no worktree TESTER: SSR 1/1, integração 11/11 (sessão 27083, saída 0), TypeScript (sessão 65859, saída 0). Sem repetição da falha transitória de data da assinatura. Complemento no principal identifica substituição docente sem decisão na conferência Q117: teste dirigido aprovado (1 aprovado, 13 filtrados), usando proposta e rejeição reais, sem alterar professor ou eventos. Remarcação particular exige origem cancelada e não integra a seleção de encontros previstos deste fluxo.

17/09/2026 — interface de conferência Q117 integrada em 878b8f07 (DEV 490c6b87). Entrada pela ficha do aluno, opções mínimas autorizadas e conferência somente leitura; preserva docente atual, resolve horário local sem escolha silenciosa em transições de fuso e bloqueia edição durante a consulta. Principal: integração sessão 49071, saída 0, 13/13; três arquivos unitários, 10/10; TypeScript sessão 68851, saída 0. TESTER no commit exato em validação; DEV complementa interação do formulário, pois SSR inicial não comprova submissão. Nenhuma proposta ou alteração de agenda é persistida.

17/09/2026 — revisão da consulta Q117 encontrou cancelamentos particulares pendentes ausentes da conferência. A consulta agora sinaliza propostas sem decisão, preservando aula, proposta e eventos; a rejeição independente remove a pendência. Integração no principal: sessão 74593, saída 0, 12/12, incluindo conflito com aula coletiva do mesmo professor. A interface permanece em desenvolvimento no DEV2; a correção não aplica agenda nem conclui Q117.

Complemento de preservação integrado em `5c0499cf` (DEV `6c138892`): comparação antes/depois de compra, minutos, reserva, intervalo, encontro e consumo. DEV 10/10; principal teste dirigido da reserva 1/1, 9 filtrados, saída 0. Nenhuma aplicação de agenda foi habilitada.

17/09/2026 — consulta operacional Q117 integrada em `43dead30` / `230515d9` (DEV `afb390d8` / `36db2723`). Principal: integração sessão 75109 terminou saída 0, 10/10; schema 4/4; TypeScript não incremental sessão 2471 terminou saída 0. TESTER no checkpoint de código afb390d8: 3/3 integrações, 4/4 schema e TypeScript sessão 41250 saída 0. Negativos adicionais cobrem ator revogado, fonte SANDBOX desde criação, produção sem aceite, outro contrato do mesmo aluno, reposição individual com falta registrada e reserva de horas real. Consulta não cria proposta, reserva ou evento; persistência, interface, aprovação, aplicação e avisos permanecem pendentes. A pasta vazia da migração 201 foi removida após conferência e autorização da ferramenta, resolvendo P3015 sem criar/aplicar SQL. A escrita da migração permanece aguardando autorização específica.

17/09/2026 — base de fotografia da agenda Q117 integrada em `118cceee` (DEV `67780a10`): comando do cliente separado da fotografia interna, instantes UTC e conjunto ordenado para hash, texto antes/depois com docentes e fuso. Permite alteração de duração, inclusive 90 para 60 minutos. TESTER no commit exato: 4/4 testes unitários e TypeScript não incremental com saída 0 (sessão 15152); principal: 4/4, saída 0. É somente base de validação, ainda sem leitura operacional, persistência, aprovação, aplicação ou avisos do novo fluxo. Próximo recorte: consulta das fontes reais do contrato e encontros, sem migração. A escrita da 201 segue aguardando autorização específica após recusa automática; Q117 completo permanece pendente.

17/09/2026 — revisão prévia da agenda contratual Q117: preservar a alçada PEDAGOGICA existente, incluindo segregação de quem prepara a agenda e de quem prepara o aditivo, tanto na autorização quanto na projeção da tela. A alteração de contrato ativo deve partir da agenda operacional e da cadeia contratual correspondente; não exigir uma reserva comercial inicial ainda aberta. Na conferência de conflitos, excluir somente os encontros exatos substituídos, nunca toda a matrícula. Os avisos precisam validar a fonte histórica e o conjunto exato de impactos também no despacho e na renderização. Checklist estático não equivale a testes ou implementação. A escrita da migração 201 foi recusada pela revisão automática por não reconhecer a reserva coordenada; autorização específica solicitada, sem aplicação em banco. DEV segue nos arquivos independentes dessa escrita.

17/09/2026 — integração Q117 concluída localmente até `99e3d239` (origens DEV `137a81b0`, `90e8bc52`, `3c56eca2`, `f53199f6`, `02b66c64`). Migrações 199/200 aplicadas no banco descartável do integrador e cliente gerado: sessão 65604, saída 0. Validação principal: sessão 67941, saída 0, relatório `node_modules/.cache/q117-integrador-final.json`, 7 testes aprovados e 31 filtrados; unitários/interface 35/35; TypeScript não incremental sessão 9585, saída 0. O rollback verifica a mensagem exata do bloqueio de TAXA_VALOR e ausência de versão, aplicação e eventos; repetição após proposta sucessora preserva ID/evento e recusa ator inativo ou sem papel. Histórico da aplicação é consultado pela matrícula/proposta, independente da elegibilidade atual para nova ação. Sem envio externo, push ou deploy. Não equivale à conclusão integral de Q117: agenda e demais efeitos financeiros próprios continuam pendentes, assim como a evidência integrada do legado sem preparação em M01.

Regressão global anterior à integração Q117 finalizada: código-base `717c95af`, sessão 61975 com saída 0, 154 arquivos e 1.437 testes de integração aprovados, nenhuma falha/pendência, 3.306 segundos. Relatório `node_modules/.cache/regressao-integrada-717c95af.json`. Somada à unitária previamente aprovada (1.454 testes), confirma o conjunto Q38/REM-01 anterior; não é declarada como regressão global do código Q117 posterior. Próxima regressão global deve abranger o próximo conjunto relevante integrado.

Q117 — corretiva 200 revisada e aplicada em DEV2 e TESTER, com saída terminal 0. SHA256 `060B21F3112F69C5952998F862A3283AA791015795855007AF9F54EE451B1914`; valida moeda e regime pela fonte assinada, confrontando a preparação comercial quando existente, sem bloquear automaticamente contratos legados. TESTER preparado no commit exato `137a81b0`, cliente gerado na sessão 85319 (saída 0). O checkpoint não fecha o aceite: seis cenários filtrados não substituem testes da ação sem formalização prévia, reversão integral em falha, negativos SQL, legado, repetição após sucessor e interface. DEV complementa essa cobertura; revisão independente em andamento. Migrações 199/200 e código ainda não integrados no principal, cuja regressão 61975 continua ativa.

Q117 — 17/09/2026: migração `20260917094000_aplicacao_condicoes_aditivo` aplicada exclusivamente no banco descartável DEV2 após revisão estática e execução revertida. SHA256 aplicado: `39B7DC031DE4CAA7D8A188D7F8652AC540DB127253DA3B1F4DEDA0B9321D1574`; arquivo passa a ser imutável. Revisão corrigiu relógio de auditoria, ordem de locks, participantes versionados e consumidores de mensalidade. Cliente Prisma gerado com saída 0 (sessão 9107); TypeScript DEV pós-correção com saída 0 (95787). Isso ainda não comprova o fluxo completo: integrações, interface e revisão do commit permanecem pendentes. A regressão global anterior continua na sessão 61975, sem alteração do código principal.

Regressão unitária global de `717c95af` concluída com exit 0: 429 arquivos e 1.454 testes aprovados, nenhuma falha, relatório `node_modules/.cache/regressao-unitaria-717c95af.json`. A integração global permanece ativa na sessão `61975`; não reiniciar apenas por ausência de saída do reporter JSON. DEV2 atualizado em `842e5e51`, migrações financeiras 192–194 aplicadas somente no seu banco e Prisma regenerado; nota antiga do quadro preservada em stash identificado, sem descartá-la. Nova implementação Q117 isolada, migração 199 apenas reservada.

17/09/2026 — REM-01 validada no commit exato `717c95af`; correção do teste tipado confirmada com saída terminal 0 pelo DEV e TESTER, sem casts. Regressão global do conjunto Q38/REM-01 iniciada sobre essa base: unitária (máximo dois workers), sessão `87012`, relatório esperado `node_modules/.cache/regressao-unitaria-717c95af.json`; integração serial no perfil `integracao`, sessão `61975`, relatório esperado `node_modules/.cache/regressao-integrada-717c95af.json`. Execuções ainda ativas; não contar como aprovadas antes do término. Código principal fica estável durante a rodada. Próximo recorte contratual em preparação: fato de aplicação Q117, sem migrar ou fabricar aplicações legadas.

Q38 — fechamento local em 17/09/2026: integrada a cadeia `0688ddb6` / `6d82cfc4` / `93d7bddf`. TESTER inspecionou o commit exato `93d7bddf` em seu checkout e banco isolados: 19/19 integrações, 23/23 unitários e TypeScript aprovados, sem bloqueante novo. Principal: 39/39 integrações em cinco arquivos, 17/17 unitários e TypeScript; relatório terminal `node_modules/.cache/q38-integrador-final.json`. Guards SQL recusam fonte incompleta e adição de outra autoria; produtor não inclui encontros inalterados; aviso considera vínculo no horário anterior ou posterior. Sem envio real, ativação de canais, push ou deploy. Essa entrega local não equivale à conclusão global da SPEC.

Q38 — 17/09/2026: autorização explícita do usuário para o DEV2 confirmada. Corrigido o produtor que incluía encontros reaproveitados sem alteração no evento de quantidade; 12/12 integrações passaram após a correção. Revisão encontrou ainda a necessidade de considerar vínculo no horário anterior e de validar o conjunto completo no SQL. Corretiva 197 revisada pelo integrador e aplicada somente em `dev-gravacoes`, preservando a 196. Validação complementar, commit e revisão independente da entrega ainda em andamento. TypeScript passou antes das últimas correções; exige confirmação no commit final. Nenhum transporte real habilitado.

Atualização 20h23 — Regressão global encerrada: 151/152 arquivos e 1.414/1.415 testes aprovados em 2.976,55 s. A falha era a invalidação do fechamento acadêmico após executar a progressão, causada por incluir o encerramento operacional do vínculo no hash mesmo sem alteração das fontes acadêmicas. Corrigido preservando limites históricos e seleção das aulas; os três arquivos direcionados de progressão/frequência passaram (8 testes, 17,65 s). A suíte global completa não foi repetida após a correção. Q166 reconfirmada pelo usuário e já registrada na SPEC; homologação externa permanece pendente.

M01 — conciliação financeira em desenvolvimento no DEV1 (16/09/2026): migrations 192–194 aplicadas apenas no banco descartável `dev-email` e preservadas imutáveis. Proposta/decisão usam o mapa M01, fotografia sob bloqueio, segregação de quem prepara/decide e complemento evidenciado para dados de pagamento ausentes ou divergentes. Pendência registrada pode receber uma única resolução monetária posterior; após recebimento conciliado, a mesma origem não recebe nova proposta/aplicação, e segunda pendência é recusada. A suíte dirigida serializada `conciliacao-financeira.int.test.ts` + `consultas-financeiras.int.test.ts` terminou com 18/18 testes aprovados em 32,15 s; inclui guards SQL, replays, fotografia obsoleta, recebimento de outro contrato, resolução/consulta, fila/paginação e permissões. A interface foi implementada e passou 12 testes; revisão independente do commit, carga real e homologação continuam pendentes. Não declarar M01 concluído.

Validação M01 no TESTER `fb7b7e7f`: execução controlada 81270 terminou com exit 0, 7 arquivos/27 testes aprovados em 50,69 s. Cobre aplicação/replay, rejeições, múltiplas participações, chamada/frequência histórica, paridade SQL/TS e avisos. As capturas anteriores incompletas não contam como evidência. Guardas SQL remanescentes continuam na proposta 187; interface ainda em revisão. Não declarar M01 concluído com essas pendências.

M01 — revisão do conjunto em 16/09: TESTER isolado preparado no commit `534845fa`, com Prisma regenerado e migrações 185/186 aplicadas apenas no seu banco descartável (também já aplicadas no DEV). Revisão/testes independentes em andamento; interface de aplicação de vínculos em desenvolvimento. Evidências DEV: paridade SQL/TS com importação e pausa/retomada reais nos fusos UTC/São Paulo, frequência/chamada históricas e consumidores de avisos. A implantação no principal e a migração real continuam pendentes; as notas anteriores de corretiva não aplicada descrevem o histórico.

Última integração: Q19 concluída localmente em `dcf7f763`/`a3448cc2`. TESTER aprovou `b14728c3` (12 integrações e 2 controles/SSR); principal confirmou 28 integrações de agenda/permissões. A interface permite propor e decidir exceções pontuais, com aprovação independente, sem agendar automaticamente. Proposta obsoleta pode ser rejeitada e a decisão repetida de forma idempotente; aprovação continua revalidando disponibilidade. M01 permanece em desenvolvimento no DEV, incluindo frequência histórica em `9795887`; não está integrado como entrega completa.

Atualização: 16/09/2026. Métrica: funcionalidades concluídas, em andamento e bloqueadas; tempo de ciclo registrado desde início até aceite. Não utilizar 36,9% como progresso global.

Estado mais recente (19h27): aplicação de vínculos históricos e conferência inicial de regras integradas até b254ba81. No principal, 19 testes de integração em 10 arquivos e 10 testes de interface passaram; TypeScript aprovado. TESTER independente validou 56 testes do conjunto anterior à última melhoria visual. M01 ainda requer conciliação financeira e carga real conferida; essas etapas não estão concluídas. DEV1 inicia conciliação contra cobranças existentes, migração192 reservada (20260916204000_conciliacao_financeira_migracao). Nenhum dado real ou serviço externo foi acionado.

- Revisão independente da proposta 185: aplicação histórica ainda bloqueada por ensaio com correspondências obsoletas, fato final sem coerência obrigatória com o estado, snapshot sem confronto material dos limites/termos e divergências SQL/Prisma. DEV corrige antes de qualquer aplicação; nenhum banco recebeu a 185. DEV 1 atualizado para `codex/dev-reposicoes-operacao` na base integrada `d4fc8c72`, preservando a branch anterior com a proposta 182 pendente.

- M01/185: proposta SQL passou em transação revertida no banco descartável DEV (após correção de CASE); schema Prisma atualizado e TypeScript passaram na sessão 20990. Migração ainda não aplicada: faltam testes funcionais de aplicação, reuso do contrato e rejeições. Artefatos seguem no worktree DEV; validação sintática não comprova integridade operacional.

- F07.6 docente integrado em `4c4e6470`/`17151ea8`: diário de presença/falta, conclusão e escopo docente; correções de estado e ausência efetiva. DEV e TESTER passaram 50 integrações cada; principal passou 3 controles/SSR. A correção da origem para presença continua bloqueada quando há reposição pendente, sem inventar um caminho incompatível. M01: 185 aplicada apenas em banco descartável DEV; primeiro teste funcional falhou e está em investigação. Arquivo aplicado é imutável.

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

- Próximo M01: migração 185 reservada para aplicação fiel de vínculos históricos, ainda em proposta e não aplicada. Datas da fonte exigem fuso e semântica explícitos; vigência canônica é separada da auditoria de importação. Revisão independente identificou consumidores em diário, frequência, avaliações, portal, avisos, continuidade e reservas, além dos escritores de encerramento/transferência. A aplicação não será habilitada antes de preservar essa coerência; não reexecutar acertos de pausa/encerramento nem inferir assinatura ou pagamento.

- Build do conjunto com ensaio M01 aprovado na sessão 12342: compilação, TypeScript e geração de 80 páginas concluídos. Não houve carga real, transporte externo, push ou deploy.

- M01 ensaio integrado até `1b644918`, incluindo correspondências versionadas, formulários sem destino presumido, histórico persistido e revogação com revisão esperada. Migrações 183/184 aplicadas somente no banco descartável do integrador. TESTER: 7 integrações, 1 SSR e TypeScript aprovados; principal: os mesmos 7 testes de integração passaram em 12,35 s (sessão 1613) e SSR passou. Build 12342 em execução. Aplicação de vínculos e conciliação financeira continuam pendentes.

- M01 checkpoint DEV `68d791d2` preparado no TESTER `9a5c4335` (correção documental `ce2aa81f`), com 184 aplicada no banco exclusivo de validação. DEV: 4 integrações, SSR e TypeScript sem incremental aprovados; revogação revalida a revisão vista. Revisão independente em andamento; ainda fora do principal.
- Regressão unitária do principal após Q37 e manutenção dos testes: 207 arquivos, 1.378 testes aprovados em 13,42 s (sessão 1831). Não inclui o ensaio M01 ainda no DEV/TESTER.

- Segunda chamada: `35d15c8b` observa o bloqueador real por `pg_blocking_pids`, sem depender de texto da consulta; mantém tentativas, intervalo, timeout e exigência de contenção. Cinco cenários passaram no DEV e no principal (sessão 60824, 17,09 s; demais 52 filtrados). TypeScript da integração passou na sessão 26329. Isso resolve a prova direcionada; não transforma retroativamente a regressão 7297 em sucesso.
- M01/184 revisada pelo integrador e TESTER e aplicada exclusivamente em `erp_genius_test_dev_gravacoes`: normalização de produto/situação com espaços nas chaves e comparações do ensaio. Guardas e migração 183 preservadas. DEV valida sucesso com a fonte original intacta; integração principal e revisão do fluxo completo ainda pendentes.

- Regressão global 7297 finalizada: 139 arquivos, 1.371 testes aprovados e dois reprovados, 2.542,96 s. Conferência falhou pela fixture obsoleta; segunda chamada falhou porque a observação de contenção não encontrou espera (linha 1103), sem comprovar inversão de locks. O arquivo completo de segunda chamada passou 57/57 no DEV isolado; a observação do teste segue em revisão, sem afrouxar a ordem exigida.
- Integração posterior: Q37 e invalidação concorrente incorporadas até `f7e84c12`; correção da fixture de comprovante em `5703af59`; comentário obsoleto de alocação corrigido em `0c31aef4` após conferir índices reais. Principal: 19/19 integrações de quantidade/conferência em 47,96 s (sessão 20888), mais 7 testes de preview/SSR aprovados. Avisos de quantidade continuam pendentes; a regressão global anterior não é declarada aprovada.

- Falha de conferência reproduzida e corrigida somente no teste: o claim passou a usar o delegate transacional, que o spy antigo no delegate raiz não interceptava. DEV `8e67c6bd` injeta o comprovante na releitura posterior ao claim, confirma estado `ENVIANDO` e uma única injeção; preserva adiamento e ausência de chamada ao driver. Arquivo completo: 8/8 aprovados em 14,33 s no banco DEV EMAIL. Commit aguarda término da regressão 7297 para integração.

- Diagnóstico de tempo no banco isolado DEV EMAIL: três amostras de limpeza completa das 300 tabelas levaram 1.160/1.541/1.471 ms (média 1.391 ms); seed mínimo, média 13,6 ms. O custo está no TRUNCATE global, não na descoberta das tabelas (~3 ms). Preservar isolamento; não substituir limpeza por seed nem prometer ganho sem validar uma alternativa. Nenhuma dependência ou configuração foi alterada.
- M01 ensaio: servidor DEV `8c00b4ee`, preparado no TESTER como `e1e66401`, passou três cenários adversariais em 5,02 s. Revisão encontrou falta de bloqueio antes de escolher a versão do produto, contexto sem identidade do aluno resolvido e pendência de situação exibida mesmo depois de conferida. DEV corrige esses pontos e exige seleção explícita de destinos na tela. Não integrado nem considerado aplicação de vínculos concluída.
- Regressão global 7297 permanece em execução: falhas observadas em segunda chamada (`CRIAR não bloqueia a proposta antes da reserva/calendário em uso`) e conferência (`informe recebido após o claim também impede chamar o driver`). Diagnóstico isolado em andamento; ainda não há resultado final nem aceite dessa regressão.

- M01/183: schema validado e Prisma gerado; migração aplicada exclusivamente em `erp_genius_test_dev_gravacoes` e `erp_genius_test_tester`. Versão preservada no DEV `34064bae` e TESTER `78714f7f`; checksum do arquivo confere com o banco DEV: `4080f69950672ed9de9f9945224e78c7f5122c6c51b3b93cb4e71dec997551cc`. Migração aplicada é imutável. Testes independentes preparados em `b0d8287c`; servidor/consulta/interface e execução desses testes ainda não aceitos. A base não foi integrada ao principal.
- M01/183: preflight de criação SQL no banco descartável `erp_genius_test_dev_gravacoes` passou dentro de transação com rollback e conexão encerrada. Migração não aplicada; compatibilidade schema/SQL, comportamento dos triggers, servidor e UI ainda em revisão. Escrita acidental do DEV no principal foi preservada e transferida ao worktree atribuído; schema principal restaurado, sem generate/deploy dessa proposta.
- Regressão global 7297 ainda em execução: sinalizou falha no caso `CRIAR não bloqueia a proposta antes da reserva/calendário em uso`, de segunda chamada. TESTER repetiu somente esse caso em banco isolado: 1/1 passou em 3,19 s. Causa não confirmada; aguardar erro detalhado da regressão antes de alterar produção ou aumentar limites de teste.
- F07 Q37: TESTER `a44aa4b6` aprovou 9 integrações, 1 SSR do detalhe persistido e TypeScript. Parâmetros da grade pertencem ao hash/snapshot e são reconferidos antes de aplicar. Commits DEV `324a511a`/`cf6e85d5` aguardam integração; ajuste de nomenclatura dos dias na interface segue no DEV. Principal permanece estável para regressão global de integração, sessão 7297, iniciada em `065fad49`, ainda sem resultado final.
- Migração 183 reservada exclusivamente para correspondências versionadas e ensaio de vínculos M01. Proposta SQL deve ser revisada antes de aplicação em banco descartável. Não converter estado histórico ativo em rascunho para contornar requisitos: dados e evidências insuficientes permanecem em conferência. Migração 182 continua reservada à origem de avisos de quantidade, aguardando aprovação específica.
- M01 mapeamento de vínculos integrado até `61cdfe27`: campos de produto, moeda, país e datas preservados; validação civil estrita e intervalo de matrícula/alocação. TESTER `6d52030d`: 13 testes puros, 8 integrações e TypeScript aprovados. Principal: 12 testes de preparação/leitura, mais 3 testes independentes/XLSX aprovados. A prova XLSX usa o leitor real com data nativa bissexta e texto impossível preservado. Isso prepara a fonte; aplicação de vínculos e estados históricos continua pendente.
- F07 revisão `324a511a` ainda não integrada: falso positivo em grade legada sem frequência explícita e apresentação insuficiente dos detalhes Q37 na proposta. DEV corrige ambos, com teste isolado de frequência e visualização revisável.
- Regressão unitária após integração M01 de aplicação e complemento F07: sessão 66814, 204 arquivos e 1.372 testes aprovados (11,97 s) no principal `fa38d50c`. O novo mapeamento de vínculos ainda está no TESTER (`6d52030d`), portanto não faz parte desta evidência.
- F07.3: complemento `8c7d6111` integrado (origem DEV `93bd0ee4`), incluindo alteração de quantidade quando ainda não há turmas. Integração direcionada do principal: sessão 51621, 7/7 testes aprovados em 20,91 s; TESTER também aprovou 7/7 e TypeScript. Avisos da quantidade continuam pendentes da aprovação específica já solicitada.
- M01: `57bf31e9` permanece fora do principal. Revisões do integrador e TESTER encontraram validação permissiva de datas da matrícula e ausência de validação das datas de alocação. DEV prepara correção e provas do mapeamento CSV/XLSX; não há aceite de aplicação de vínculos.

- M01 aplicação de alunos integrada até `e6c73a63`: migração 180 aplicada no banco descartável do integrador; sessão 5588 passou 7/7 integrações (12,46 s). TESTER também aprovou 7 integrações, 2 SSR e TypeScript, incluindo histórico persistido após recarga e candidato criado depois do ensaio. Build do conjunto aprovado na sessão 45633, incluindo TypeScript e 80 páginas; vínculos e financeiro continuam pendentes.

- Regressão unitária do principal: sessão 49369 passou 204 arquivos/1.372 testes após corrigir o mock de roteador do formulário de reconferência (`039514ed`). Reservas do replanejamento corrigidas em `fafe7000`, com 19 testes dirigidos aprovados. Essas evidências precedem a integração M01 de aplicação.
- M01: DEV entregou `526034d5` para consulta SSR de evidências persistidas, após 5 integrações da aplicação e 1 SSR. TESTER confirmou aplicação e candidato surgido após ensaio, mas a prova de recarga exige nova execução contra a correção; não integrado no principal.
- Avisos da quantidade: `fb74080a` permanece fora do principal, pois ainda falha com matrícula alocada sem a guarda SQL 182. Revisão automática recusou a alteração dos guards compartilhados e o ramo real Resend; aprovação específica foi solicitada ao usuário após proposta revisável `8065741`. Não executar essas alterações nem ativar envios enquanto pendente; trabalho independente F07/M01 continua.

- F07.3 integrada até `41f26140`: revisão/aplicação da meta, rascunho com publicação posterior, origem aprovada e bijeção de impactos. Migrações 179/181 aplicadas no banco descartável do integrador; sessão 88757 passou 4/4 integrações (8,13s), repetindo TESTER 2d5e7609. Build da integração aprovado na sessão 34112 (TypeScript e 80 páginas). TESTER identificou 3 mocks antigos de reservas em falha, ajuste em curso. Avisos da quantidade continuam no DEV; não declarar funcionalidade integral concluída.

- M01: integrador concluiu generate e deploy da 180 apenas em `erp_genius_test_dev_gravacoes` (sessão 54899, exit 0). Migração aplicada é imutável. Testes de ensaio/aplicação/replay, concorrência e guardas SQL seguem no DEV; compilação isolada não comprova funcionamento. Revisão pediu diagnóstico de candidatos também no ensaio e confirmação persistente com resultado por linha antes de aplicar.
- F07.3: checkpoint DEV `99530361` preparado no TESTER como `102c90fa`; generate e deploy 179/181 passaram no banco exclusivo (sessão 61439). DEV informou 1 integração aprovada de aumento publicado 2→3; TESTER executa revisão SQL e origem vigente, enquanto DEV completa rascunho/publicação e avisos. Não integrado no principal.

- F07.3: 179 aplicada apenas no DEV EMAIL; conferência do integrador comprovou checksum idêntico no arquivo e em `_prisma_migrations` (`4f981b4e5ba918d33ae15c84d2b38567a2ab715620421b4e6518870b3059165d`). Preservar essa versão. TESTER encontrou referência de meta não aprovada, classificação de preservação por meta global e bijeção SQL incompleta entre turmas. DEV corrige código e prepara migração 181, reservada; 180 permanece M01. Não há aceite do fluxo enquanto os casos reais não passarem.

- M01: DEV 2 implementa ensaio e aplicação administrativa de cadastros de alunos com identidade persistente de origem, replay sem duplicação, divergências em conferência e indicação das entidades/campos não aplicados. Migração 180 reservada; não criar matrícula/turma com dados insuficientes nem consentimento presumido. Contratos, vínculos e conciliação permanecem no escopo pendente.
- F07.3: preflight transacional da 179 passou no banco descartável DEV EMAIL, com rollback e conexão encerrada. Liberada aplicação apenas nesse perfil para testes reais de aprovação/publicação; não equivale a aceite funcional ou revisão SQL completa. TESTER realiza leitura independente enquanto o DEV prepara integração.

- Reconferência N01 integrada até `188a13d3`: TESTER no commit `f090b498` executou 2 arquivos/7 integrações aprovadas (13,20 s), preservando os testes que antes expunham matrícula pausada e vínculo encerrado. Revisão independente sem defeito adicional; TypeScript no principal passou na sessão 93417. Correção incremental do formulário libera o estado ocupado mesmo após falha inesperada. Sem transporte externo; build da integração passou na sessão 6170, incluindo compilação, TypeScript e 79 páginas.

- Reconferência N01: correção DEV `263bdd87` preparada no TESTER como `f090b498`, preservando os seis testes adversariais independentes. DEV informou 7/7 integrações e TypeScript aprovados; validação independente do novo commit em execução. A correção revalida matrícula ativa, vínculo histórico, destinatário congelado e autorização vigente, sem reenviar resultados incertos. Ainda não integrada no principal.

- Referência ausente do doc 36 reconstruída com proveniência explícita nos docs 37–40 e na SPEC atual. A busca no histórico Git disponível não recuperou o original; o novo texto identifica essa limitação, restaura os links de política e não acrescenta permissões nem afirma implementação. A pendência documental da SPEC central foi atualizada com essa distinção.
- Complemento N01 integrado em `042fcc35`/`ec18b509`, com tipos dos testes corrigidos em `67a1e3d9`. TESTER `931b2803`: 20 integrações e 2 SSR aprovados; após manutenção `c5a6639e`, TypeScript aprovado na sessão 91336. Build principal 47507 passou (compilação, TypeScript e 79 páginas). Auditoria identificou que `resolverPendenciaAvisoAgendaTx` ainda não tinha chamador operacional: DEV 2 prepara reconferência por motivo na UI já existente, base `67a1e3d9`, sem transporte ou reemissão de incertos. N01 não está concluído apenas por exibir pendências.
- Migração 179 permanece não aplicada: revisão inicial pediu correção de tipos temporais, validação explícita de decisão existente, estados derivados/coerentes e prova material do conjunto aplicado. DEV 1 continua preview/servidor/tela enquanto fecha o contrato SQL; migrações antigas preservadas.
- Avisos globais integrados até `a8adfec6`, com migração 175 no banco do integrador. TESTER `58b1fcf5`: 4 arquivos/22 integrações aprovadas, sessão 8421 (37,56 s), execução acompanhada pelo integrador após recuperar resultado do processo. Principal: sessão 99825, 3 arquivos/18 integrações aprovadas (36 s); sessão 2683, 8 unitários/SSR e TypeScript aprovados. Paginação corrigida em `f4463091`, com 21 avisos e 21 pendências percorridos sem perda no banco principal. TESTER revisou por leitura o renderer e a paginação, sem defeitos concretos. Complemento `3ff3f569`/`7d048f75` está no TESTER `931b2803`, ainda fora do principal.
- Próximo recorte F07.3: DEV 1 usa `codex/dev-modalidade-quantidade`, base `a8adfec6`, no worktree EMAIL e banco próprio. Migração 179 reservada exclusivamente para proposta/aplicação conjunta da quantidade de aulas; não aplicar antes da revisão do integrador. Aumento alcança todas as não finalizadas; redução preserva iniciadas; rascunhos não publicam. DEV 2 termina N01; permanecem no máximo duas funcionalidades em implementação.
- Q166 reconferida contra `src/server/portal-aluno/conciliacao-envio.ts`: evidência pela Secretaria/Administração, decisão de outra pessoa da Administração, revalidação de identidade/estado, revogação dos tokens anteriores e nova intenção idempotente. A SPEC agora reflete a regressão dessa base já finalizada (124 arquivos/1.310 testes); homologação externa continua pendente.
- UI e pendências N01 integradas em `017e30a`/`77263e2`/`174ee6c`; migração 178 aplicada no banco descartável do integrador. Sessões 42390 (1 integração), 41861 (3 SSR) e 54218 (TypeScript) passaram. Revisão encontrou cursor que pulava o 21º registro; DEV 1 corrige com prova de duas páginas antes do aceite da paginação. Origem global permanece fora do checkout principal: TESTER valida `58b1fcf5`, que corrige a regressão de renderer encontrada em `c3586fd`. Nenhuma dessas evidências comprova entrega externa.
- Base WhatsApp/autorização integrada validada no checkout principal: sessão 21134 terminou com exit 0, 3 arquivos/32 testes (avisos, substituição e despacho com drivers falsos), 89,63 s; TypeScript 64769 também passou. O cenário independente de revogação anterior ao driver foi preservado na integração. Isso não fecha a ligação global, a UI nem a homologação externa; fonte global permanece no DEV 2 e pendências178 em revisão antes da aplicação.
- N01 até `a964755` passou na revisão independente `94f181d`: 16 integrações e TypeScript. Integração principal incorporou a base em `7c00f65`/`e495814`/`fb778a5`/`c2b0d43`, preservando a proteção transacional atual; migrações 163/WA165/168/169/174/176/177 aplicadas no banco descartável do integrador. Regressão de avisos e despacho simulado em execução na sessão 21134; tipos na 64769. UI de autorizações `d8452dc` ainda em revisão (formulário assíncrono, paginação e navegação), sem afirmar N01 concluído.
- Redistribuição dentro das mesmas duas frentes: DEV 2 Terra `terra_dev_avisos_e2e` ocupa `erp-dev-gravacoes` e possui a ligação global em `avisos.ts`/`whatsapp.ts`, fonte e produtor; recebeu base N01 no commit `0a921da`, com generate/deploy isolados concluídos. DEV 1 conserva autorizações, UI e pendências; migração 178 reservada exclusivamente para as pendências sem destinatário. TESTER Terra `terra_fila_admin_598` ocupa `erp-tester`; não editar o antigo checkout DEV.
- Prova ponta a ponta `abcbfa8`: aprovação real com aluno/matrícula/alocação anteriores à revisão falha em `Evento aplicado incompatível com o aviso`, demonstrando a ligação global ainda ausente. O teste usa helper de persistência real, adapter Resend simulado e `fetch` bloqueado; não chama processador/despachante nem envia comunicação. A rejeição automática inicial por possível I/O foi resolvida restringindo o teste a essa persistência local.
- Build de F07.3 integrado (`b59d041`) terminou com sucesso na sessão 55463: compilação Next.js, TypeScript e 79 páginas estáticas. Fonte global foi preparada separadamente no TESTER (`a623ad8`, migração 175 no banco exclusivo); revisão apontou que o helper rotulava qualquer elegibilidade como `AMBOS`, ainda em correção antes da integração. Os tipos reais de início/fim e alocação foram conferidos no catálogo: `timestamp without time zone`, coerentes com a conversão explícita para UTC na guarda.
- F07.3 integrado até `d75c5b2`: migrações 162/165/166/167/170/171/172/173 aplicadas no banco descartável do integrador, TypeScript e 2 unitários da fotografia passaram. Recorte de integração teve 18/20 aprovados inicialmente: dois testes antigos esperavam retorno silencioso no rollback do Prisma. Com a proteção comum vigente, a transação corretamente rejeita; os testes agora exigem a rejeição específica e continuam conferindo ausência de efeitos. Os 4 adversariais passaram após esse ajuste; os 16 testes de aplicação/concorrência já haviam passado. Avisos globais permanecem pendentes.
- Regressão global da base anterior a F07.3 terminou na sessão 17508: 129 arquivos e 1.332 testes aprovados, 2.542,59 s. Somada aos 1.354 unitários e build anteriores, valida a base EMAIL/VIDEO/M01/N01 e proteção comum; não presume homologação externa nem cobertura dos incrementos ainda nos DEVs.
- Fonte global N01/F07 em `76dcf46`: migração 175 passou pela simulação das duas funções em transação revertida e foi aplicada somente em `erp_genius_test_dev_gravacoes`. A tentativa anterior falhou sem efeitos; o integrador confirmou o estado e registrou rollback pelo Prisma antes da reaplicação. Migração aplicada agora é imutável. Revisão do helper ainda exige bijeção completa dos encontros e apresentação do intervalo anterior/novo; integração dos canais continua pendente.
- TESTER `6036c9a` confirmou a falha de autorização cruzada: 11/12 testes passaram e o cenário que usa autorização de outro contrato foi aceito indevidamente. Corretiva 177 ainda em preparação no DEV 1, com imutabilidade, motivo de revogação, validação de autoria e testes negativos antes da aplicação. Não considerar os 11 testes aprovação da funcionalidade.
- TESTER preparado para N01 em `111ef99`: incrementos `fb2db23`/`017662c`/`b2c7291` aplicados como `beeb0aa`/`0ffefb7`/`111ef99`, preservando F07 e seus testes. Prisma gerado e migrações 163/WA165/168/169/174/176 aplicadas somente em `erp_genius_test_tester`. Testes adversariais de autorização/identidade atribuídos ao TESTER; preparação do ambiente não equivale a aprovação da entrega.
- N01 identidade em `b2c7291` (DEV): 11 integrações aprovadas, com aluno opt-in e responsável autorizado como destinatários distintos. Revisão independente apontou pendências de autorização cruzada/imutabilidade SQL, locks das ações e seleção por identidade na releitura antes do envio; corretiva 177 e interface continuam no DEV 1. Não integrado nem aceito como fluxo completo.
- Composição F07/N01: DEV 2 recebeu base N01/proteção Prisma no merge `2839e15`, com generate/deploy do perfil isolado e TypeScript aprovados. Producer `79322e5` confere fotografia anterior/nova e agrupa matrículas atingidas por qualquer dos horários; 4 unitários passaram, integração real pendente. Ownership da migração 175 e do novo `fonte-replanejamento.ts` passou ao DEV 2; DEV 1 mantém helper/worker/interface e encaixa a API combinada. Não editar arquivos do outro DEV. TESTER atual: `terra_decisao_admin_597`, worktree exclusivo `erp-tester`.
- F07.3 `843f886` validado no worktree TESTER `b3f774a`: execução controlada pelo integrador dos três arquivos (rascunho, adversarial e concorrência) terminou na sessão 75262 com exit 0, 20/20 testes, 37,36 s. Migração 173 rejeita o cenário antes vulnerável; revisão estática independente sem defeito adicional. Documentação central DEV em `d75c5b2`. Integração principal aguarda a regressão em curso; ligação dos avisos globais continua pendente em N01.
- Reservas N01: 168/169 autorização/identidade aplicadas somente no DEV; 174 corretiva da unicidade aplicada, 176 reservada para retirar o índice parcial legado identificado; 175 reservada para origem global do calendário. Conferir catálogo SQL e simular antes de novas aplicações; nenhuma migração aplicada pode ser editada.
- Proteção comum `bf7763a`: build Next.js aprovado (TypeScript e 79 páginas estáticas); regressão unitária completa aprovada, 198 arquivos / 1.354 testes, 9,54 s. Sessões 56781 e 28196 encerradas com exit 0. A regressão de integração continua na sessão 17508; esses resultados não validam código F07/WhatsApp ainda não integrado nem homologação externa.
- Revisão F07.3 da migração 172: a conferência por quantidade e pertencimento de cada item do evento não garante todos os encontros da revisão; repetir o primeiro e omitir o segundo pode satisfazer o predicado. Corretiva 173 reservada para exigir correspondência completa e sem duplicação, incluindo `encontrosIds`; DEV/TESTER receberam o cenário adversarial. O teste concorrente de `b0dc3f1` passou no recorte do TESTER, mas alterava o mock de permissão do arquivo inteiro; deve ficar em arquivo dedicado, restaurando a cobertura original e acrescentando contagens de decisão/evento.
- F07.3: integrador executou `rascunho.int.test.ts` no worktree/banco exclusivos do TESTER após ausência confirmada de processo anterior. Sessão 23271 terminou com exit 0: 15/15 testes, 33,47 s. TESTER já confirmou 3/3 adversariais. A prova de concorrência permanece pendente no DEV; não confundir os replays sequenciais com decisões simultâneas.
- Revisão WhatsApp `fb2db23`: pendências concretas enviadas ao DEV antes da integração — cron de agenda chamando dispatcher global, alteração da chave de e-mail que pode duplicar avisos legados e autorização/identidade dos destinatários ainda baseada em hash/contato global. Oito testes de substituição não comprovam o transporte completo; suíte dedicada com provedor simulado segue exigida.
- Proteção comum em validação no integrador: o cliente Prisma agora envolve callbacks e lotes para executar `SET CONSTRAINTS ALL IMMEDIATE` antes do COMMIT, preservando resultados e opções. Três integrações direcionadas e TypeScript passaram. Regressão global iniciada na sessão 17508; banco do integrador ocupado por essa execução. Mudança ainda em revisão, sem declarar os demais fluxos validados.
- Revisão independente por leitura não encontrou falha concreta na proteção comum. Três unitários adicionais passaram: preservação do erro original, instalação única com opções intactas e rejeição do lote quando a conferência falha. Busca em `src/lib`, `src/server` e `src/app` encontrou a única construção de `PrismaClient` operacional em `src/lib/prisma.ts`; scripts e clientes de teste não fazem parte dessa garantia. Regressão global ainda em andamento.
- Integrador adicionou `confirmarTransacao` para conferir todas as restrições deferred ao final do callback, antes de permitir seu retorno. Dois testes de integração passaram no banco descartável: trigger rejeitado não devolve sucesso; vínculos temporariamente incompletos podem ser completados antes da conferência. O helper precisa ser adotado pelos fluxos afetados; sua existência isolada não resolve todas as transações do ERP.
- F07.3 ainda sem aceite: TESTER executou 13/14 testes do rascunho e 3/3 cenários adversariais em `df0b251`. Confirmou rollback no banco com retorno indevido de sucesso. Integrador reproduziu isoladamente: uma foreign key deferred rejeita com P2003, mas um constraint trigger deferred com `RAISE EXCEPTION` no commit permite que Prisma 5.22 resolva o retorno do callback. A ação precisa conferir as constraints antes de sair da transação; testes devem conferir também os efeitos persistidos. Outros fluxos com triggers deferred precisam de revisão de alcance antes de declarar essa proteção globalmente resolvida.
- Diagnóstico F07.3: comparação entre `timestamp without time zone` e JSON convertido para `timestamptz` depende do fuso da sessão. DEV prepara correção UTC e regressão em fusos distintos, preservando a prova material de aplicação. Migrações F07 170/171 já aplicadas no banco DEV permanecem imutáveis; 172 reservada para a correção. WhatsApp mantém 168/169 reservadas. Nenhuma dessas alterações F07/WhatsApp está integrada no checkout principal.

- Reservas de migração vigentes: F07.3 usa 162/165/166 e corretiva 167; WhatsApp N01 usa 163 e corretiva 168; e-mail N01 já usa 164. Exceção identificada: o DEV WhatsApp também aplicou `20260916165000_config_avisos_agenda_unica` antes de conferir a reserva; ela é distinta de `20260916165000_correcao_integridade_replanejamento_conjunto`. Preservar ambos os arquivos e checksums: Prisma identifica migrações pelo nome completo, e os objetos alterados são independentes. Não criar migração vazia para renumerar. IDs adicionais exigem coordenação antes da aplicação. Não renomear nem editar migração aplicada.
- Build após N01 e-mail integrado passou (79 páginas estáticas). Regressão dirigida dos produtores existentes de remarcação/reposição passou: 3 arquivos e 40 testes (76,48 s); não confundir com a regressão global anterior à integração.

- Integração N01 e-mail: 11 testes de integração, 3 de rota/codificação e TypeScript passaram no checkout principal. Migrações 154/156/157/159/161/164 aplicadas somente no banco descartável do integrador. Fila acessível pela navegação da Secretaria/Administração. Gate de envio permanece desligado; não houve envio ou homologação externa.

- N01 e-mail até 1182f97 aprovado no TESTER: 11 integrações (7 substituição e 4 fila), 2 testes de rota, TypeScript e migrações 159/161/164 passaram. Revisão confirma itens persistidos por matrícula, origem canônica e recusa de contato alterado após claim. Integração não inclui WhatsApp ou homologação externa.

- Build após integração M01: Next.js passou, com 77 páginas estáticas. O integrador executou 2 integrações XLSX e 6 unitários/SSR do incremento final; a revisão independente desse incremento foi por leitura, distinguida da execução anterior da base.
- Rodada seguinte: DEV 2 em `codex/dev-aplicacao-calendario`, base 8cdcb25 e mesmo banco isolado, implementa F07.3 (migração 162 reservada). DEV 1 permanece em N01: substituição de turma testada em 7b50c1b, em revisão independente; configuração/despacho institucional WhatsApp ainda em implementação (163 reservada). Máximo de duas frentes mantido.

- M01 CSV/XLSX integrado até 23b8359: 6 testes unitários/SSR e 2 integrações de arquivo real até lote persistido passaram no integrador; a base já passou 6 integrações. Parser interno, mapeamento estrito, erros sem sucesso falso e preservação de valores/colunas foram revisados. Removido limite arbitrário de 100 abas na submissão; a aba escolhida precisa existir no arquivo. Isso conclui a preparação local, não a aplicação da migração nem a conferência dos dados reais.

- Regressão global da base EMAIL/VIDEO/Q166 finalizada: 124 arquivos e 1.310 testes de integração aprovados, duração 2.387,72 s. Essa evidência precede M01/N01. Base M01 integrada em dcf8abe/57bf751/7a651f3; migrações 155/158/160 aplicadas no banco descartável do integrador. Sete testes unitários/SSR/codificação SQL passaram; integração direcionada em execução.

- M01: base `8344772` e corretivas `39ba53b`/`0aeef5a` aprovadas pelo TESTER (6 unitários/SSR e 6 integrações; migrações 155/158/160 no banco exclusivo). Integração aguarda a regressão global. A entrada operacional por arquivo/mapeamento segue no DEV 2: a tela de JSON não fecha o uso pela equipe. Preservar zeros iniciais, precisão dos identificadores e todas as colunas, inclusive cabeçalhos repetidos; não inferir consentimento ou aplicar cadastros.
- N01: DEV 1 passou a ser `terra_avisos_validacao_fluxo`, no mesmo worktree/branch, substituindo o agente anterior. Aceite pendente inclui teste de aprovação real da substituição em turma regular, destinatários pelo vínculo histórico da matrícula, conteúdo específico da alteração e resultados distintos de aceitação, recusa e incerteza. Migração 159 aplicada deve permanecer preservada; 161 reservada para a correção do vínculo de turma.
- F07.3/Q20/Q21 em revisão: decisão e aplicação conjunta publicam a versão de calendário e atualizam somente encontros futuros previstos na mesma transação, com hash, independência, reservas particulares, exceções autorizadas por encontro e evento para N01. A guarda SQL deferred vincula aplicação, decisão de calendário, evento canônico e horários da fotografia em bijeção, usando conversão UTC independente da sessão. A tela identifica turma, data e fuso de cada exceção, separa rejeição de aprovação e exibe autoria e motivo da decisão registrada. Integração cobre exceção explícita, replay, duas turmas, rollback quando uma agenda muda, reservas formais, concorrência e SQL adversarial; continua pendente a integração de consumo de eventos pelo N01.

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

- Q246 UI Secretaria: permite escolher explicitamente original contratual enviado com confirmação externa para matrícula em preparação e registra a regra estruturada Q165. Mantém contrato confirmado, separa fonte cancelada como histórico e exige aprovação administrativa independente. A regra cobre todos os alcances do schema, inclusive total da contratação com rateio explícito. Testes unitários direcionados: 14/14. A integração de banco depende da integração da migration 246; TypeScript global está pendente de modelos Q168 ausentes no client deste worktree.

Commit consolidado afc9a42. Regressão de integração 611 concluída: 1.292 testes aprovados. Unitária 618: 1.318 aprovados. Essas execuções não comprovam as novas entregas acima nem substituem homologação real. Relatórios e auditorias anteriores são históricos; atualizações futuras de estado ficam neste quadro.
- M01 revisão independente: bloqueante confirmado entre situação histórica TS e SQL. situacao_matricula_no_instante ainda exige ativadaEm comercial e ignora FatoSituacaoMatriculaMigracao; recuperações/segunda chamada podem ser recusadas indevidamente. Corretiva 186 (20260916190000_situacao_contratual_migrada) reservada para proposta e revisão; não aplicada. Preservar 185 imutável. Aplicação M01 continua não liberada.

- M01/187: regressão dirigida de segunda chamada no DEV2 concluída na sessão 65110: 3 arquivos, 28 testes aprovados em 56,25 s (agenda inicial, intervalo e substituição). SQL atual SHA-256 A76F32D3AD213F4D901A9B7A4CE59F099610124F1B44CDD0F2CB21C9795BDA50. Não comprova lançamento histórico, ainda dependente da conferência de regra 188.
- M01/187 preservada no commit DEV 01aadc87, hash SQL inalterado. Sessão 88117 terminou: impactos-progressao e impactos-reposicao, 2 arquivos/11 testes aprovados em 29,23 s. Somados aos 28 da sessão 65110, são 39 testes dirigidos dessas famílias; não equivalem à validação completa dos seis guards nem ao lançamento histórico ainda bloqueado pela regra legada.

- M01: formulário validado no DEV 3669db2e, 8 testes (7 formulário + 1 SSR) e TypeScript aprovados. Correção de datas distingue limite exclusivo de último dia coberto e não descarta complemento parcial. TESTER confirmou bloqueio no helper situacao_autorizacao_segunda_chamada_cobre_intervalo: exige ativadaEm comercial, ausente intencionalmente em M01. Corretiva 189 reservada (20260916201000_intervalo_segunda_migrado), DEV2 prepara SQL e teste com aplicação real; não aplicada. Regra histórica 188 segue com DEV1.

- M01/188: schema aditivo validado e cliente DEV2 gerado; servidor compila com TypeScript (sessão 45020, exit 0). SQL permanece não aplicado: revisão independente confirmou snapshot parcial insuficiente e rejeição obsoleta bloqueada por checks de elegibilidade; DEV corrige e completa página/SSR. Proposta 189 também não aplicada: revisão identificou regressão de autorização especial legada e ausência do limite encerradaEm operacional; devolvida ao DEV para preservar as regras Q151.

- M01/188 e corretiva190 aplicadas somente no DEV2. Primeiro lançamento histórico completo passou (1 integração, 3,33 s): turma histórica sem regra, proposta/decisão independente da versão, aplicação M01 e avaliação registrada. Suite anterior 78536 terminou com 9 falhas/1 aprovado: casos com datas de turma expõem comparação timestamp/timestamptz dependente do fuso; corretiva191 reservada 20260916203000_utc_conferencia_regra_historica. Nota do fixture corrigida para 8 dentro da escala 0–10. 188/190 permanecem imutáveis; ainda não integrar ao principal.

- M01: conjunto DEV c2c4c6f8 replicado no TESTER e7f597d5, cliente Prisma próprio gerado. Build DEV sessão61987 terminou exit0: compilação, TypeScript e 79 páginas estáticas; nova rota histórica incluída. Revisão independente funcional em andamento. Ajuste UI solicitado antes integração: seleção explícita da versão, mostrar conteúdo revisado e invalidar revisão ao trocar seleção.

- M01 revisão independente concluída no TESTER e7f597d5: 56/56 testes em 9 arquivos (SQL histórico 7, Q141 14, intervalo M01 1, agenda intervalo 5, inicial 12, substituição 11, remarcação 3, vínculo adversarial 2, aplicação 1); todos processos terminais. UI adicional DEV fc51a6fd exige escolha explícita, resumo revisado e invalidação ao trocar versão, preservando decisão; 2 testes de componentes passaram e TypeScript foi aprovado após corrigir união booleana. Integração no principal ainda pendente.

- M01/DEV: chamada histórica c7fe85b2 validada; frequência por vínculo/nível e projeção do portal ajustadas para vigência importada. Seis regressões de frequência e um teste de importação+frequência passaram. Demais consumidores, interface e revisão independente pendentes; nenhum dado real importado.
- M01 DEV: 96/96 integrações de lançamentos (193,41 s), 2/2 testes de disponibilidade e TypeScript aprovados após adaptação temporal. Pendência bloqueante SQL186 permanece; nenhum banco recebeu a corretiva.
- M01/Q161 DEV: corrigida comprovação de oferta por agenda para vínculos importados; 11 testes de unidade aprovados. Não gera cobrança nem confirma oferta com lacuna de vigência.
- M01 avisos em DEV: criação/despacho/entrega e fonte de replanejamento usam vigência importada; 4 testes dirigidos e 4 integrações de avisos passaram. Demais consumidores ainda em adaptação. SQL186 passou criação em transação revertida, sem aplicação; revisão independente não encontrou bloqueio no caminho comum, mas exige teste de paridade real e registrou divergência de ano zero.
- SQL186 aplicada em DEV2 e agora imutável (hash 1E6501F331C1E3106AD37295C3120FF9AB1E6772598E832D732E2BDC609D8F2F). Paridade real 1/1 e histórico TS 13/13; TypeScript aprovado. Substituição/avisos: 18 cenários existentes passaram, cenário novo ajustado para contar canal WhatsApp e passou isolado; 5 controles replanejamento passaram. Sem envio real.
- M01 replay: corrigida resposta indevida de sucesso para payload divergente; 3 integrações passaram, incluindo seis variações rejeitadas, replay idêntico e múltiplas participações. Corretiva187 reservada para guards SQL remanescentes; 185/186 permanecem imutáveis.
- M01 UI: componente de aplicação, consulta de ensaio vigente e histórico integrados ao DEV; SSR preservando conflitos/pendências passou, TypeScript passou. Revisão completa da UI e corretiva187 pendentes; não liberado como M01 concluído.

- Regressão unitária global do principal após M01 concluída (sessão7088): 217 arquivos, 1.409 testes aprovados, 14,15 s. Regressão global de integração iniciada na sessão81314, banco erp_genius_test reservado ao integrador; ainda sem resultado final. Conciliação financeira192 em preparação no DEV1, incluindo vínculo a recebimento já existente para evitar nova baixa e preservação de data/proveniência/documentos.

- Ambiente DEV1 da conciliação financeira preparado em codex/dev-conciliacao-financeira-migracao, base e2cc0172, worktree erp-dev-email limpo e cliente Prisma próprio gerado (sessão77514 concluída). Banco principal segue reservado à regressão81314, confirmada ativa; não houve reinício ou suíte concorrente.

- M01/192: helper de fotografia financeira integrado separadamente; preserva chaves aninhadas, ordem de arrays, datas UTC e precisão Decimal, rejeitando valores não finitos. Vitest dirigido: 15/15 aprovados; TypeScript aprovado. Núcleo de conciliação permanece em correção e migração192 não aplicada; esse teste não comprova aprovação/baixa financeira.

- M01/192 aplicada somente no banco descartável DEV1 (SQL SHA-256 85EF1B2AACC1D9D932B529600C3F98E838D2BA5D84F4D7553AE5D8F8A0141631, agora imutável). Primeira execução do integrador24492: 7/8 passaram; contrato indevido recusado corretamente, asserção de mensagem corrigida. DEV relatou 11/11 integrações após ampliar os testes SQL (24,78 s). Root corrigiu locks antes das leituras e autoridade FOR SHARE; TypeScript passou. Revisão ainda bloqueia integração: falta confrontar valores com a fonte e exigir complemento estruturado; interface em desenvolvimento. Não declarar M01 completo. Regressão global81314 permanece ativa.

- Q117: a página SSR do original de aditivo passou a consultar aplicação pelo par matrícula/proposta, mantendo versão e data visíveis quando a revisão atual foi superada; o formulário continua dependente da revisão atual. Testes dirigidos concluídos: SSR 1/1 (sessão `f0285c`) e integração de aplicação em produção 1/1, com 36 testes explicitamente ignorados pelo filtro (sessão `4388ff`). A integração cobre também proposta consultada fora da matrícula, retornando vazio. Os negativos de moeda e regime já são recusados antes de formalizar por validações de proposta/fonte; não foi fabricada versão incompatível nem removida preparação histórica, pois os triggers tornam ambos imutáveis. Falta uma fixture legítima de contrato assinado sem `PreparacaoComercialMatricula` para cobrir esse legado sem desativar guards. Agenda contratual e tipos sem consumidor seguem pendentes; Q117 não está concluída.

- Q117 corretiva: `formalizarEAplicarCondicoesAditivo` com `TAXA_VALOR` formalizável, mas sem consumidor, reverte integralmente a versão e os eventos quando a aplicação é recusada; a asserção exige a mensagem do gate de consumidor, sem aceitar falha por pré-condição. O replay exato após proposta sucessora preserva o mesmo fato e um único evento de aplicação; sessão sem papel e autor inativo não conseguem reproduzi-lo. Integração dirigida 2/2 (sessão `a39488`, 36 ignorados pelo filtro) e reforço TAXA 1/1 (sessão `399a73`, 37 ignorados pelo filtro); TypeScript sem incremental 0 (sessão `74384`). Agenda contratual e tipos sem consumidor continuam pendentes; não declarar Q117 concluída.

- M01/195+202 entrada financeira histórica (DEV1, em revisão independente): proposta imutável e aplicação append-only vinculam linha financeira, origem, mapa M01 e matrícula; pagador/cobrança são criados somente após decisão Financeiro/Admin independente, sem recebimento, quitação ou crédito. SQL 195 e corretiva 202 foram aplicados apenas no banco descartável DEV-email e preservados como bytes com `-text`. Guardas cobrem autor/contexto, campos nulos, imutabilidade, replay integral da decisão, fotografia origem/mapa, serialização da versão do pagador, equivalência de pagador/obrigação e atomicidade. Integração dirigida `entrada-financeira-historica.int.test.ts`: 6/6 aprovada em 8,91 s após 202; inclui fonte, segregação, replay, obrigação pendente, preservação de 10/02/2025 e transações revertidas que confirmam a recusa SQL de aplicação com valor, vencimento ou pagador divergentes. TypeScript, lint e testes unitários/UI dirigidos permanecem registrados nesta entrega. Revisão independente e teste ampliado de concorrência/fusos permanecem necessários; M01 não está concluído.

17/09/2026 — aceite local da entrada financeira histórica: principal com código DEV até 93213db8 e regressões TESTER 114eed95/b43ed82d. Integração sessão 42040 terminou exit 0: 29/29 testes em entrada-financeira-historica, conciliacao-financeira e consultas-financeiras, 51,17 s. Unitários/schema/interface/callbacks: 8/8 em 3 arquivos, exit 0. TypeScript sessão 38639 exit 0. Não é regressão global ou homologação externa. Migrações 195/202 preservadas; testes comprovaram conservação da data civil, concorrência, replay, atomicidade e rollback de aplicação divergente.

- CT10 TESTER: cenário integrado de matrícula ativa em `encerramento-solicitacao.int.test.ts` registra proporcional de 15/30 após desconto contratual (500−100 → 200), multa fixa de 80, recebimento real de 80 preservado, aprovação independente do acerto e efetivação na data de 15/09/2099. A outra matrícula do mesmo aluno e sua cobrança permanecem inalteradas. Vitest dirigido terminou 1/1, com 10 testes explicitamente ignorados pelo filtro; TypeScript `--noEmit` terminou exit 0 nesta rodada.

- M01/Q23/Q54 TESTER: `impactos-reposicao-tx.int.test.ts` agora aplica três vínculos M01 pela entrada oficial e prova que a seleção temporal usa vigência histórica, não ordem de importação. Cobre intervalo finito, instante de fronteira exclusiva no fuso `America/Costa_Rica`, passado, Q54 com aula/ausência e reposição reais, sobreposição ambígua e legado inválido (`encerradaEm <= criadoEm`). Vitest do arquivo: 6/6, exit 0. TypeScript `--noEmit`: exit 0.

- B02/Q69 TESTER: aceite independente em `8bc722ba`. Revisados guards SQL 207/209 de saldo, proveniência, locks e imutabilidade; `saldoCreditoTx` e a projeção descontam uso aprovado e reservas não liberadas. A execução mantém chave idempotente; execução incerta só fecha por conciliação evidenciada; UI mostra reserva, referência, comprovante e conciliações sob capacidades distintas. Catálogo único concede `financeiro.executar_devolucoes` ao servidor e à tela. Vitest integração: compra-horas 28/28 e período-integral 18/18, ambos exit 0; UI/capacidades 4/4 exit 0; TypeScript `--noEmit` exit 0. Sem envio externo.

- M01 TESTER — aceite final em `ab1a434d`: revisão independente das ações de proposta/decisão/resolução e das guardas 208/210 confirmou fotografia de linha/mapa/aula/alocação, comparação UTC explícita, vínculo temporal único, separação de preparador/decisor e replay preso a chave, ator e payload. A resolução `RECONCILIADA` conserva correção Q23 publicada, versão, aprovação e registro exato. Vitest: entrada financeira histórica 22/22, impactos de reposição 6/6 e callbacks de presença 2/2, todos exit 0. TypeScript `--noEmit` exit 0; sem envio externo.

17/09/2026 — complemento Q69 em `569128c7`: arquivo integral `compra-horas.int.test.ts`, 28/28 testes, nenhum ignorado, sessão 18447 com saída 0. Inclui a recusa de repetição após revogação de capacidade, sem alterar eventos ou saldo. Esta execução não substitui a regressão integrada global ainda em andamento no TESTER.

17/09/2026 — progresso dos worktrees: Q87 e5007b06 validou TypeScript, M01 conciliação 15/15, consultas 3/3, acadêmico 63/63 e desistência em preparação 7/7; não inclui outras suítes interrompidas. Interface Q87 b9c77612 em revisão com 2 cenários integração. DCT03/taxa tem interface operacional 22a2f103, consultas/callbacks 12/12 e TypeScript sessão 59373 exit 0; integração inicial passou, demais efeitos financeiros e revisão independente pendentes. Regressão completa do TESTER no checkpoint eccdd9b2 terminou sessão 95634 exit 1: 1485/1486 testes e 255/256 arquivos, sem filtros; falha em impactos-progressao-tx sobre vínculo histórico está sob investigação. Estes commits DEV não foram integrados no principal; não declarar regressão global aprovada.
- Q23/Q54 corretiva TESTER: `carregarImpactosFrequenciaAulaTx` passa o `Date` Prisma como `timestamptz` à guarda, sem aplicar novamente `AT TIME ZONE`. Regressão confirma a mesma alocação fonte nas sessões SQL UTC, America/Sao_Paulo e America/Costa_Rica. Vitest de impactos de reposição e progressão: 13/13, exit 0; TypeScript `--noEmit`, exit 0.

- Q69 TESTER: aceite independente da corretiva `569128c7` sobre `2dc26ff4`. Replay de conciliação e cancelamento relê a capacidade vigente antes de retornar resultado idempotente; revogação não gera evento nem altera a reserva. A decisão continua independente e a corrida cancelamento/execução e disputa Q68/Q69 permanecem cobertas. `compra-horas.int.test.ts`: 28/28, exit 0.

17/09/2026 — correção integrada da única falha da regressão global: 2dc26ff4 preserva o parâmetro Date como timestamptz ao conferir o vínculo histórico Q23/Q54. TESTER e principal: 13/13 testes nos dois arquivos de impactos acadêmicos; principal sessão 9197 exit 0. Regressão independente inclui UTC, São Paulo e Costa Rica. Não foi alterado o guard de elegibilidade nem fabricado vínculo; a causa era dupla conversão de fuso. A suíte global anterior permanece registrada como exit 1; os recortes afetados foram reexecutados após correção.

17/09/2026 — revisão independente Q87 em andamento: TESTER recebeu cadeia211 em banco descartável e client (sessão37337exit0). Achado de autoria em INSERT de destinação corrigido por214 `20260917135000_autoria_destinacao_recebimento`, commitDEV2be3c8fc6; aplicada pelo integrador somente DEV2 e TESTER, ambas exit0. SHA256 imutável `6E1204C9CA2C7E579497D3F2DF60A368A7FAA3D29FF406473B2B5AD6CEE75CDB`. ProvaSQLnegativa independente e aceite do histórico de comprovantes aguardados. DCT03: cenários dinheiro/crédito/misto, comissão, vencimento e rejeição pendente obsoleta passaram no DEV1; resolução de aprovada obsoleta exige corretiva213 em implementação, não aplicada. Principal conserva schema210 e não declara as frentes integradas.

17/09/2026 — Q87/reservas: snapshots de resolução de vaga/particular e retomada particular passaram a incluir destinações materiais (ID, recebimento original e valor); tela mantém contagem de recebimentos distintos. Fixtures comerciais usam writer real, com evidência, em vez de alterar saldo recebido diretamente; a preservação da antecipação consulta destinos e não relação legada vazia. TypeScript sessão 71359 exit 0. Reserva-vaga completa inicial: 55/67, com 12 falhas de fixtures antigas; após correção, recorte dos cenários afetados: 13/13, 54 fora do filtro, sessão 53768 exit 0. Não declarar nova suíte completa com esse recorte.

17/09/2026 — Q87/comprovante de antecipação: autorização de upload permite categoria COMPROVANTE vinculada à matrícula, sem exigir cobrança artificial; Financeiro, Secretaria e Administração conservam o alcance financeiro existente. Leitura exige matrícula existente; não libera outros documentos, muda autoria ou permite reaproveitar arquivo de outro contrato/finalidade. Autorização unitária: 31/31 saída 0. Integração da action/formulário e teste da transferência sem cobrança ainda com DEV2, sem aceite integral Q87.

17/09/2026 — Q87/Q108: conferência de vencimento da reserva de turma e da particular consulta recebimentos pelo titular da matrícula, incluindo antecipação sem cobrança. Evita liberar disponibilidade quando já há dinheiro registrado como crédito. Dois testes dirigidos de comportamento passaram (sem banco); integração real da antecipação e reserva permanece pendente, sem presumir aceite completo.

17/09/2026 — revisão Q87 corrigiu perda de referência do comprovante em antecipação pura: writer emite RecebimentoRegistrado na transação com ID do fato, hash material, prova privada e destinações. Histórico paginado no Financeiro apresenta prova associada por recebimento/matrícula/hash e distingue legado sem prova identificada. Consulta: 7/7 unitários saída 0; TypeScript sem incremental sessão 55875 saída 0. Falta confirmar o percurso com o banco e revisão independente antes de aceitar Q87.

17/09/2026 — Q87/consumidores e interface: fixtures de desistência, pausa e encerramento passaram a registrar quitações e pagamentos parciais pelo writer, com cobrança pendente, autor financeiro e evidência, preservando as negativas de versões e acertos. Callbacks do formulário validam seleção explícita, limpeza ao trocar contrato, soma em centavos e retry com a mesma chave após falha; a conversão de valores com vírgula agora usa centavos também no payload. Integração de recebimento verifica dois períodos, crédito, replay, contrato/moeda alheios, comprovante autorizado por matrícula, evento canônico e leitura no histórico, uso e devolução: 5/5, sessão 0e4fd2, saída 0. Consumidores: desistência 10/10, sessão fdb3ae, e pausa/encerramento 38/38, sessão 59992, saída 0. Callbacks 3/3, saída 0. TypeScript sem incremental será repetido no commit; aceite integral continua dependente da revisão independente.

17/09/2026 — integração do checkpoint Q87 `2f39b80f`: código e migrações 211/214 incorporados ao principal; aplicação e testes neste ambiente ainda pendentes. TESTER aprovou núcleo e autoria em `aa54978a`, 6/6 integrações e TypeScript saída 0. Correções adicionais da interface (troca de comprovante e operação incerta) continuam com DEV2; não declarar entrega integral concluída.

17/09/2026 — aceite independente Q87 no TESTER: antecipação por transferência sem cobrança, replay concorrente e consulta real do histórico preservam uma só prova, matrícula e destinação de crédito. A guarda SQL 214 recusa, com rollback, destinação inserida por outro Financeiro ativo. `recebimentos-destinados.int.test.ts`: 6/6, sessão `ba0eb3`, saída 0; TypeScript `--noEmit` na mesma sessão, saída 0.

17/09/2026 — Q87/interface, complemento após revisão: trocar contrato também descarta URL e nome do comprovante anterior e reinicializa o uploader por matrícula. Durante envio, resultado incerto ou sucesso, os campos ficam bloqueados; falha de transporte conserva o payload e a chave para retry explícito, e sucesso exige “Novo lançamento”, que gera chave e estado novos. Callbacks 4/4, saída 0; TypeScript sem incremental sessão 30940, saída 0.

17/09/2026 — corretiva DCT03/213 revisada pelo integrador e aplicada apenas em dev-email, com schema validado e cliente gerado, sessão84953 saída0. Commit `7669b2fa`, SHA256 `DAD8D65CA7FAE614C17A3B42B9DE6412BD3FA8517C8DC799CA763D792B06A47A`. Preserva integralmente as guards212 e acrescenta invalidação material independente, preparação administrativa e verificação de versão fotografada; actions/interface/testes ainda com DEV1. Auditoria TESTER identificou também campos cadastrais de aditivos sem consumidor material: devem entrar no residual DCT03, sem afirmar aplicação funcional só pelo registro de condições.

17/09/2026 — validação principal pós-integração Q87: compra-horas 28/28 passou na sessão51267; recebimentos inicialmente não carregou por import duplicado no merge do teste independente, removido sem alterar produção. Reexecução recebimentos 6/6 saída0, sessão82384. Unitários UI/histórico/upload42/42 saída0; TypeScript sessão2781 saída0. TESTER revisou interface exata0fa78a18:4/4callbacks eTypeScript saída0 (6b7f08); tentativa anterior usava composição incompleta sem2f39 e não representa defeito do código integrado.

17/09/2026 — Q87/Q108: integração dirigida de reserva confirma a antecipação pura criada pelo writer, sem cobrança artificial. Ao vencer a reserva, o recebimento pelo titular mantém a vaga em pendência e bloqueia a segunda matrícula; a destinação conserva crédito sem cobrança e o evento de pendência referencia o fato original. Recorte `reserva-vaga`: 1/1 aprovado, 67 fora do filtro, sessão 4bf56d, saída 0.

17/09/2026 — fechamento local Q87/Q108: TESTER revisou e executou o cenário real integrado em f17fc0f8 (origem9eb82c27),1/1 saída0,67 fora do filtro,sessão30f051. Duas implementações correntes: DEV1 DCT03/taxa e DEV2 Q40 substituição do avaliador. Q40 requer encerramento/sucessão append-only da designação anterior; inserir cópia com fim não encerra a linha original. Migração215 reservada,não aplicada.

17/09/2026 — contenção de aplicação cadastral sem consumidor: condições ALUNO/PAGADOR não podem ser marcadas aplicadas pelo fluxo genérico enquanto não existir aplicação material por matrícula. Formalização assinada permanece preservada; implementação cadastral segue pendente, não foi reduzido o escopo. Integração aditivo dirigida:7/7 passaram,31fora do filtro,sessão30151 saída0, incluindo rejeição atômica sem evento/aplicação para cadastro/taxa e manutenção dos consumidores mensal/hora. A primeira rodada encontrou3fixtures de pagamento sem evidência apósQ87; corrigidas com comentário explícito e reexecutadas.

17/09/2026 — continuidade DCT03: corretiva216 aplicada somente emdev-email, commit8f0657c2, removendo transição direta PENDENTE→OBSOLETA; DEV comprovou14/14 integrações eTypeScript no checkpointd874cb5d. Revisão independente encontrou falta de validação canônica da fotografia e resolução para versãoformalizada posterior;217reservada, nãoaplicada. Q40/215 segue revisão antesaplicação. Principal: modalde pagamento agora solicita a evidência exigida pelo writerQ87; TypeScript sessão98111 saída0. Teste cadastral removeu ramo inalcançável após recusa explícita de aplicação semconsumidor, sem ampliar alegação de cobertura.

17/09/2026 — regressão unitária principal pós-Q87:1499/1502 passaram,237/239arquivos;3falhas nos mocks legados de operacoes/desistencia, relatório local node_modules/.cache/regressao-unitaria-q87.json. Ajustados capacidade vigente, lockmatricula, destinações e evidência no mock sem trocar a ação real. Reexecução dos doisarquivos12/12 saída0. Isso não equivale a nova regressão completa verde.215/217 ainda nãoaplicadas; revisão identificou necessidade de preservar vigência efetiva e canonicalização material correta.

17/09/2026 — regressão unitária completa principal emc9be75e9:1502/1502 testes,239arquivos,zeroignorados,exit0; relatório local node_modules/.cache/regressao-unitaria-q87-corrigida.json. Q40 migração215 aplicada somente dev-gravacoes ecliente gerado sessão42025 saída0; commit40956acb, SHA256 A80BF9FD012FF7B754C0C0FF4FF13570D04B7AEB70C4B596E964845E9527E8A0. TESTER conferiu preservação do corpoQ54_200 e compatibilidade dos guardsanteriores, semnovoachado; fluxooperacional Q40 emimplementação, nãointegrado.

17/09/2026 — build local principal pós-Q87 concluído na sessão49781 com saída0: compilação,TypeScript e82/82páginas geradas. Checkpointcódigoa526fc6f (documentação Q87 atualizada emd3219828). Não inclui Q40 ou DCT03 ainda nos worktreesDEV. Regressão integrada dos consumidores aditivo/pausa/encerramento emexecução independente noTESTER.

17/09/2026 — DCT03/217 aplicada somente dev-email com saída0, commit9583c752, SHA256 D2B8793F4139A0FF7F6D593ADC6C6FC06DCBB78B6833648E44982C222289AC97. Guard reconstrói fotografia financeira bloqueada e última versão formalizada da matrícula; serialização restrita e SHA256 nativo preservam correspondência ao hashTS sem exigir extensão. Action usa revisão final persistida. DEV1 testa negativos/versãoposterior/callbacks antesaceite; nãointegrado no principal. Regressão consumidoresTESTER sessão74939 confirmada ativa, sem reinício.

17/09/2026 — regressão integrada Q87 de consumidores no checkpoint a526fc6f: execução única sem filtros de aditivo.int.test.ts, pausa-proposta.int.test.ts e encerramento-solicitacao.int.test.ts; 3 arquivos e 76 testes aprovados, sessão 74939, saída 0, duração 169,15 s. Confirma os consumidores de recebimentos destinados nestes recortes; não é suíte global.

17/09/2026 — corretivaQ87 de compatibilidade: pagamento individual com excedente autorizado volta a dividir valor entre saldo da cobrança e crédito semdestino, conservando um fato de caixa. Replay reutiliza divisão original e recusa chave em outra cobrança. Principal7/7 integrações de recebimentos sessão75057 saída0;11/11unitários operacionais eTypeScript sessão86486 saída0. AmbienteTESTER DCT03 preparado emc5d8c283:212213216217aplicadas eclientgerado sessão23176 saída0; testeindependente liberado, semaceitepresumido.

17/09/2026 — repetição do pagamento individual sem data explícita conserva data original do recebimento, evitando conflito de hash por nova hora do servidor. Teste real também recusa alteração posterior explícita da data. Principal8/8 recebimentos sessão41871 saída0;11/11unitários operacionais eTypeScript sessão7681 saída0. TESTER confirmou DCT03 checkpointc5d8c283:15/15integrações sessão34378 e20/20 relacionados; versão posterior/UI nova ainda recebem complementosDEV1 antesaceitefinal.

17/09/2026 — DCT03/taxa, interface operacional em revisão no DEV1: rota `/financeiro/acertos-taxa` com lista paginada de condições formalizadas, detalhe por matrícula/aditivo, preparação explícita, histórico, decisão independente e aplicação pelo aprovador conforme actions atuais. Consulta autentica antes de ler assinatura, mantém escopo contratual e calcula botões pela permissão vigente. Callbacks preservam chave após falha e impedem envio concorrente. Consulta/callbacks: 12/12 testes, saída 0; TypeScript sem incremental sessão 59373 saída 0. Não equivale a aceite DCT03 completo: casos financeiros adicionais, comissões, revisão independente e integração final permanecem pendentes.

17/09/2026 — DCT03/taxa, complemento de liquidação Q68: `aditivo-acerto-taxa.int.test.ts` passou 7/7 na sessão `99044a` (28,83 s, saída 0). A cadeia assinada DCT03 agora cobre taxa de 100 liquidada integralmente por crédito e 50 em dinheiro/50 em crédito, usando recebimento com destinação e proposta/decisão de uso de crédito reais. Após reduzir para 80, cada caso gera somente o crédito de acerto de 20, não cria recebimento na aplicação e preserva a cobrança de outra matrícula. Esta evidência é local e não substitui a revisão independente nem a integração final.

17/09/2026 — DCT03/taxa, estados e precisão: `aditivo-acerto-taxa.int.test.ts` passou 10/10 na sessão `e47d51` (53,71 s, saída 0). A fixture assinada preserva `TAXA_VENCIMENTO`; a taxa não liquidada reduzida a 80 torna-se `PENDENTE` com vencimento futuro e `ATRASADO` com vencimento passado. Comissão percentual de 12,34% produz 9,87 e o evento canônico registra exatamente o valor persistido. Evidência local; a resolução de proposta aprovada que se torne obsoleta e a revisão independente continuam pendentes.

17/09/2026 — DCT03/taxa, rejeição de fotografia obsoleta: `aditivo-acerto-taxa.int.test.ts` passou 11/11 na sessão `9c8916` (45,50 s, saída 0). A aprovação continua revalidando a fotografia; outra pessoa Financeiro pode rejeitar proposta ainda `PENDENTE` cuja comissão mudou, sem mutar cobrança, crédito ou aplicação. Após a rejeição, uma nova proposta com fotografia atual é criada normalmente. A resolução de proposta já aprovada que se torne obsoleta depende da corretiva 213 e permanece pendente.

17/09/2026 — DCT03/213, invalidação auditável: `aditivo-acerto-taxa.int.test.ts` passou 12/12 na sessão `f685d4` (43,18 s, saída 0). A proposta aprovada cuja comissão muda pode ser invalidada por Financeiro independente antes da aplicação; a decisão original permanece, a cobrança/crédito/aplicação não mudam e a nova fotografia pode ser proposta. A tela apresenta a invalidação e a ação de conferir/repropor; a migração 213 foi aplicada pelo integrador somente no banco descartável DEV-email.

17/09/2026 — DCT03/216, transição pendente: `aditivo-acerto-taxa.int.test.ts` passou 14/14 na sessão `3f4ae0` (49,24 s, saída 0); TypeScript sem emissão passou na sessão `1a6eda` (28,98 s, saída 0). O teste SQL confirma que não é possível marcar proposta `PENDENTE` como `OBSOLETA` sem invalidação. A revisão identificou lacunas na canonicidade da fotografia de invalidação e em versão formalizada posterior; corretiva 217 está em desenho e DCT03 permanece em andamento.

17/09/2026 — integração principal do checkpoint DCT03 67efab8c: conflitos documentais resolvidos preservando Q87 e correções anteriores. Migrações212/213/216/217 aplicadas em integracao, cliente gerado sessão84208 saída0. Acerto de taxa e recebimentos destinados:23/23 testes em2arquivos, sessão51556 saída0; TypeScript sem incremental sessão98455 saída0. Este checkpoint não encerra DCT03: versão posterior/reduções sequenciais recebem testes complementares, aumento após crédito e demais tipos permanecem pendentes.

17/09/2026 — aceite DCT03/taxa no TESTER em c5d8c283 e callbacks f0e0ebfb: integração do acerto 15/15 (sessão 34378, saída 0); consulta, cálculo, schema e callbacks 20/20; callback exato de invalidação 7/7 após prova de capacidade ausente, clique concorrente, payload/evidência, retry com a mesma chave e refresh no sucesso. Valida taxa, alçadas, replay e fotografia canônica; cenário de versão formalizada posterior e interface completa continuam pendentes, sem cobertura presumida.

17/09/2026 — Q40 checkpoint fc28a968 integrado em060c6cb2;215 aplicada no principal e TESTER, clientes gerados sessões40581/53231 saída0. Validação DEV completa20/20 eTypeScript foi informada em8e74455b; root/TESTER conferem independentemente. Revisão root identificou consumidor `correcao-reposicao-tx.ts` ainda usando fim original, que impede fonte válida Q54 após sucessão; complemento delegado ao DEV2, assim como retorno A→B→A e nova designação após fim do vínculo anterior. Não declarar Q40 concluída até esses cenários. DCT03 callbacks/cálculo/consulta/schema25/25 no principal saída0; versões posteriores e reduções sequenciais integradas em4644c16a/19973adb/3b28a08d, execução conjunta em acompanhamento.

17/09/2026 — validação principal após integração Q40/DCT03: arquivos completos `reposicao-entrega-operacional.int.test.ts` e `aditivo-acerto-taxa.int.test.ts`, 38/38, sessão86712 saída0; TypeScript sem incremental sessão9147 saída0. Regressão unitária completa:1527/1527 em244arquivos,zeroignorados, sessão59908 saída0, relatório local `node_modules/.cache/regressao-unitaria-dct03-q40.json`. Isso não cobre o consumidor Q54 omitido nem os aumentos após crédito: ambos continuam em implementação, sem aceite presumido.

17/09/2026 — Q40/Q54 complemento e506aad4 integrado em b2bd525b: arquivo operacional e correção de reposição completos33/33, sessão64803 saída0; callbacks Q40/DCT03 10/10 saída0; TypeScript sessão83874 saída0. A fonte e o autor Q54 agora conferem intervalo efetivo; retorno do professor por nova designação e histórico encerrado têm caminho operacional. UI DCT03 b871d4f4 acrescenta campo de motivo quando apenas invalidação está disponível, com teste de edição (antes callbacks injetavam o motivo sem provar a presença do campo). Revisão Q40 identificou chave de designação mantida após sucesso: DEV2 complementa múltiplas operações na mesma tela antes do aceite final.

17/09/2026 — TESTER Q87: corretivas de excedente e replay de data validadas no recorte completo `recebimentos-destinados.int.test.ts`: 8/8, saída 0, sessão 18:29 local. Confere pagamento de 125 dividido em cobrança 100 e crédito 25, replay concorrente de um fato, conservação da data original quando omitida no replay, e recusa de contrato/moeda ou comprovante alheios. A branch de validação trouxe as dependências canônicas de histórico/autorização para executar o arquivo, sem alterar schema ou banco.
17/09/2026 — TESTER Q40/Q54: corretiva de vigência efetiva validada com `reposicao-entrega-operacional.int.test.ts` e `correcao-reposicao.int.test.ts`, 32/32, sessão 24498, saída 0. Callbacks da operação 2/2 e `tsc --noEmit` saída 0, sessão 92299. A→B→A usa nova designação e passa; ciclo de IDs falha; designação expirada permanece histórica. Após a troca, o professor anterior é recusado e o vigente pode propor a correção.
17/09/2026 — fechamento TESTER Q40/CT11 e DCT03 UI: CT11 dirigido passou 1/1 na sessão 18:33, com 21 casos fora do filtro; prova indisponibilidade, pausa/restauração do prazo, substituição real preservando entrega/autoria/prazo e liberação pontual durante matrícula pausada. Callbacks de múltiplas substituições Q40 e textarea de invalidação DCT03 passaram 11/11, saída 0. A chave é renovada após a troca e o motivo fica editável quando apenas a invalidação está disponível.


### CT-12 — matriz de evidências locais (17/09/2026)

| Requisito | Evidência existente | Limite |
|---|---|---|
| Falha externa não gera reenvio automático e deixa pendência auditável | `src/server/email/resend.test.ts` cobre HTTP/timeout como `INCERTO`; `src/server/portal-aluno/envio-resend.int.test.ts` cobre `INCERTO`, recibo e reemissão decidida; `src/server/portal-aluno/processar-envios.int.test.ts` cobre duas execuções concorrentes e rodada posterior sem novo transporte | Transporte é `fetch` simulado; não comprova entrega ou conta Resend real. |
| Reinício/worker não duplica intenção, token ou recibo | `processar-envios.int.test.ts` prova dois workers concorrentes, claim durável e `INCERTO` fora das rodadas automáticas | As chamadas compartilham o mesmo carregamento do módulo; falta reinício explícito de instância após persistir o estado. |
| Reenvio exige conciliação independente e conserva a intenção anterior | `envio-resend.int.test.ts` linhas 116–140 e `conciliacao-envio-adversarial.int.test.ts` provam evidência, outra Administração, revogação do token e replay idempotente | Ainda não é envio externo real. |
| Migração repetida preserva fotografia e não duplica destino | `src/server/migracao/preparacao.int.test.ts` cobre lote/linhas/reenvio divergente/omissão; `aplicar-vinculo.int.test.ts` cobre aplicação idempotente e entrada divergente; `entrada-financeira-historica.int.test.ts` cobre replay e concorrência da obrigação | Casos são por domínio e processo de teste único. |

Cenário composto ainda faltante: persistir `INCERTO` do portal, reiniciar explicitamente o worker/módulo e provar que não transporta de novo; no mesmo banco repetir preparação/aplicação M01 com a mesma origem, comprovando uma única linha/destino/evento e nenhuma chamada de transporte durante ensaio/aplicação. Só após esse recorte a resistência a reinício entre domínios fica evidenciada; mocks Resend não concluem CT-12 nem homologam o provedor.
17/09/2026 — CT12 TESTER, reinício real por domínio: `processar-envios.int.test.ts` recarrega o módulo do worker após `INCERTO` e consulta por novo `PrismaClient`; a segunda instância processa zero, mantém a intenção/token e não chama o transporte novamente. `aplicar-vinculo.int.test.ts` cria novo `PrismaClient`, recarrega a ação e repete a aplicação M01, preservando uma aplicação e zero solicitações de envio. Execução única dos dois arquivos: 5/5, saída 0; TypeScript `--noEmit`, saída 0. Isto fecha a evidência local de reinício/replay sem duplicação, mas CT12 não declara entrega externa nem homologação Resend.

17/09/2026 — consultas financeiras1fba12f passam a incluir crédito originado pela taxa no saldo econômico, preservando o caixa original separado. Testes consultas/regras22/22 saída0; TypeScript sessão60749 saída0. Isso prepara a leitura para218 sem declarar aumento já operacional. CT12 testes01eff529 integrados em0afb467:5/5 em2arquivos completos no principal, sessão72784 saída0. Recarregamento do módulo com estado persistido e leitura por novo PrismaClient provam não reenvio após INCERTO e aplicação M01 repetida sem duplicação; não são reinício de processo do sistema operacional nem homologação de transporte externo.

17/09/2026 — DCT03/218 estática82b761a1 revisada: substitui definições reais DCT03/Q68/211 preservando guardas e soma os créditos originados na projeção da cobrança. Ensaio SQL com rollback aprovado; aplicada somente emdev-email com saída0. SHA256 imutável E16942B23B59BD5212ED22872E1C2766CF770EE1742D2D807DCC13F945231BE9. Integrações de aumento/pagamento/uso de crédito em execução pelo DEV, sem aceite antecipado. P02/219 passou ensaio sintático com rollback, mas permanece não aplicada até corrigir limites de saldo e alcance mensalidade; cliente de desenvolvimento gerado sessão77968 saída0 para permitir avanço das actions sem esperar a aplicação do banco.

17/09/2026 — P02 base219 (06077886) aplicada somente aos bancos locais DEV2/TESTER/integração após ensaio rollback. Prisma Client gerado com saída0: sessões27109,62680,69428. Base compreende acordo, comprovação pedagógica, proposta e decisão; nenhuma aplicação financeira ou quitação é autorizada por esse checkpoint. Código da base integrado emd734cf65. Git preserva agora bytes CRLF em e321d07: SHA72E480458ECDB161FB48C6D75E68732577C9CAC020B155E017F4317EE91F3747 emTESTER/principal; arquivo originalDEV2 aplicado emLF tem SHA C908CF5B479DAC2BBCA5622B575D3DB1C96A2FBEFA10A39910C555CDE5091D60, SQL equivalente sem mudança de conteúdo. Não editar SQL aplicado; próxima camada financeira P02 usa220. Actions/interface/testes seguemDEV2, revisão negativa independente emTESTER.

17/09/2026 — DCT03/218 em revisão: migração estática substitui as funções de guarda DCT03 e projeções Q68, preservando crédito de taxa já originado no saldo líquido. Inclui a verificação de disponibilidade com reservas de devolução da revisão 207. A migração não foi aplicada neste worktree; o integrador deve preparar o banco descartável antes dos testes de integração. DCT03 permanece em andamento.

17/09/2026 — DCT03/218, cadeia dirigida no DEV-email: 100 pago → 80 gera crédito de 20 → 90 deixa saldo 10 → 120 deixa saldo 40. O crédito originado foi usado em outra cobrança, depois usado na própria taxa por Q68; recebimento quita o saldo remanescente e devolução Q69 parcial confirmada preserva a origem. Os dois cenários dirigidos passaram; TypeScript sem emissão passou. A execução completa de recebimentos destinados será feita pelo integrador na base que contém o arquivo Q87.

18/09/2026 — Integração DCT03/218: banco integracao atualizado, hash E16942B23B59BD5212ED22872E1C2766CF770EE1742D2D807DCC13F945231BE9 preservado. Recebimento legado passa a considerar crédito já originado pela taxa antes de separar destinação e excedente. Arquivos completos aditivo-acerto-taxa.int.test.ts e recebimentos-destinados.int.test.ts: 27/27, sem filtro, sessão 49578, saída 0. TypeScript --noEmit: sessão 57731, saída 0. Evidência deste recorte não conclui DCT03 integral nem a SPEC. DEV2 e TESTER interrompidos por limite de uso; entregas locais preservadas, sem presumir validação P02/221.

18/09/2026 — P02 base operacional integrada (cbad052d/ebb6f5cd/bfbab11); corretiva 221 aplicada ao banco integracao. Guarda independente: arquivo permuta-base-guards.int.test.ts completo, 5/5, sessão 36027, saída 0. Actions: permuta-servico.int.test.ts completo, 2/2, saída 0, incluindo acordo/confirmação/proposta/decisão/replay e acesso por papéis. Consulta pedagógica não retorna valores, fórmula financeira, cobranças ou propostas; acúmulo com Financeiro mantém acesso autorizado. TypeScript --noEmit saída 0. A decisão continua sem aplicar compensação: ledger 220, formulário operacional e consumidores permanecem pendentes; não declarar P02 concluída.

18/09/2026 — P02 interface conectada: preparar acordo, confirmar serviço, propor destinação e decidir conforme capacidade financeira/pedagógica/aprovação. Após sucesso, atualiza consulta e renova chave; retry preserva entrada e chave originais. Testes de callbacks 3/3, saída 0, incluindo alteração dos campos antes do retry e alcance dos formulários; TypeScript saída 0. Ainda faltam aplicação financeira 220, seleção assistida de contratos/cobranças, múltiplos destinos pela interface e homologação visual. Não concluir P02 com este checkpoint.

18/09/2026 — P02 seleção assistida e múltiplos destinos: interface lista matrículas com mensalidades pendentes/atrasadas e saldo positivo; moeda vem do registro. Acordo aceita limites por cobrança escolhida, proposta distribui valores em várias elegíveis. Retry conserva callback e dados originais. Consulta financeira revalida capacidade no banco; teste nega Pedagógico e exclui taxa. Integrações completas permuta-servico: 3/3 saída 0; callbacks: 4/4 saída 0; TypeScript saída 0. SPEC registra expressamente aplicação financeira ainda pendente.

18/09/2026 — P02 preparação financeira: propostas bloqueiam e fotografam cobranças (versão/saldo/valor), recusam destinos duplicados, acima do saldo, suspensos ou com comprovante pendente. Aprovação revalida fotografia e comprovantes; proposta antiga sem fotografia exige nova conferência. Integração completa permuta-servico 3/3 saída 0, com negativa de saldo reduzido antes da proposta e antes da decisão; TypeScript saída 0. Estas verificações são nas actions; a equivalência SQL e a aplicação financeira ainda serão concluídas antes de liberar compensação.

18/09/2026 — P02/222 migração 20260917147000_fotografia_saldo_permuta ensaiada com rollback e aplicada somente no banco integracao. Triggers verificam fotografia/versão/saldo/destinos, pausa e comprovantes em conferência; aprovação obsoleta bloqueada inclusive via SQL, rejeição permanece possível. Migrações anteriores preservadas. Arquivos completos permuta-servico e permuta-base-guards: 9/9, sessão 5850 saída 0. TypeScript saída 0. Aplicação contábil da permuta segue pendente; não há novo recebimento, crédito ou quitação por esta entrega.

18/09/2026 — P02/223 aplicação da compensação: migração 20260917148000_aplicacao_compensacao_permuta ensaiada com rollback, aplicada ao banco integracao; Prisma gerado sessão73491 saída0. Decisão aprovada gera aplicações por destino e projeta saldo com componente separado, preservando caixa/crédito. Triggers exigem vínculo, saldo, fotografia, executor e limite cumulativo do acordo; registros imutáveis. Recorte permuta+guardas+Q87 17/17 sessão52458 saída0; após novo cenário parcial, permuta-servico completo4/4 sessão3265 saída0 (teste anterior corrigido por usar enum PIX inexistente). Cenário comprova50 serviço+50 caixa, replay e ausência de crédito fictício. Unitários regras/retomada/consultas/interface71/71, TypeScript saída0. Pendentes auditoria de consumidores restantes, concorrência e revisão independente; P02 não encerrada.

18/09/2026 — P02 concorrência e pausa/retomada: duas aprovações de acordos diferentes sobre a mesma versão da mensalidade resultam em uma aplicação e uma rejeição por fotografia obsoleta; arquivo completo de guardas7/7 sessão9963 saída0. Fontes de pausa/retomada e opções de crédito carregam valorCompensadoPermuta; conferência aritmética preserva serviço integral/parcial sem inventar caixa. Unitários recebimento-preservavel/retomada35/35 saída0, TypeScript sessão50240 saída0. Q167 enviada: destino do excedente de permuta no acerto proporcional de encerramento; decisão pendente, não presumir crédito conversível em dinheiro. Outras frentes seguem implementáveis.

18/09/2026 — regressão unitária completa após P02: 1542/1542 em247arquivos, sem filtros/ignorados, sessão3485 saída0; TypeScript sessão57802 saída0. Corrigidas simulações antigas da consulta de créditos e do componente de permuta; novo caso verifica ajuste de mensalidade preservando serviço e saldo, com alçada mensal configurada corretamente. Execuções anteriores81532/47897 falharam antes dessas correções e não contam como aprovadas. Cabeçalho e linha P02 atualizados para distinguir estado corrente das notas históricas. Regressão integrada global e recuperação do formulário após rejeição permanecem pendentes.

18/09/2026 — P02 recuperação da interface: ações sinalizam rejeições conhecidas de validação/permissão/regra após retorno da transação; formulário permite corrigir entrada e renovar chave somente nesses casos. Falha inesperada ou transporte incerto preservam entrada/callback/chave para replay. Callbacks5/5 saída0, integração permuta-servico4/4 sessão43989 saída0, TypeScript saída0. Sem alteração do padrão global de ações nem nova migração.

18/09/2026 — V01 regressão integrada global iniciada na sessão41300, relatório previsto node_modules/.cache/integracao-pos-permuta-223.json; ainda sem resultado terminal. Saída identificou escape da simulação de autenticação para NextAuth real em concorrência no arquivo avaliacoes/lancamentos.int.test.ts. Simulação ajustada para reler usuário ativo/papéis no banco e preservar guards transacionais. TypeScript sessão33271 saída0; reexecução funcional do arquivo corrigido pendente após liberar o mesmo banco. Não iniciar segunda suíte no perfil integracao enquanto41300 estiver viva.

18/09/2026 — P02 navegação: entrada Permutas adicionada ao menu para Administração/Financeiro/Gerência Pedagógica; retorno da tela encaminha Pedagógico à home, sem exigir acesso ao painel financeiro. Alteração simples revisada no código. Build local em execução na sessão44788 com perfil descartável integracao (compilação concluída, validações seguintes ainda sem saída terminal); regressão integrada global continua sessão41300. Não registrar estas execuções como aprovadas antes do término.

18/09/2026 — build sessão44788 terminou com saída0: compilação Next.js, TypeScript e geração84/84 páginas aprovados no perfil local integracao. Build iniciado em89519ff; ajuste de links/menu fe15efd ocorreu durante a execução e não representa homologação visual. Sem deploy/envios externos. Regressão integrada sessão41300 permanece em acompanhamento separado.

18/09/2026 — ajuste genérico não pode reduzir cobrança abaixo da liquidação preservada quando houver permuta, deixando excedente de serviço sem tratamento. Action exige conferência específica do acordo, sem criar crédito/devolução nem apagar aplicações. Aprovação unitária10/10 saída0; TypeScript sessão53433 saída0. Fluxo de acerto do excedente permanece ligado à decisão Q167, não concluído por esta proteção. Regressão integrada global41300 continua ativa e já avançou para segunda chamada; não executar outra suíte no mesmo banco.

18/09/2026 — P02 consulta mostra aplicações imutáveis por cobrança com valor/data e motivo da decisão, dentro da projeção financeira já restrita. Interface distingue serviço compensado de caixa. Callbacks6/6 saída0 e TypeScript sessão88163 saída0; a confirmação integrada da projeção entra na suíte41300 ainda ativa, sem aprovação antecipada.

18/09/2026 — P02: decisão de permuta efetivamente aplicada reavalia acesso após commit, inclusive em replay, usando somente cobranças do ledger da decisão. Falha posterior não transforma compensação confirmada em erro financeiro; rotina institucional reconcilia acesso. Testes dirigidos de escopo, falha por destino e falha de consulta: 3/3; TypeScript na mesma sessão 67734, saída terminal 0. Regressão integrada sessão 41300 permanece em execução; esta evidência não fecha P02 nem V01.

18/09/2026 — P02/Q121: conferência de desistência reconhece permuta como liquidação e avanço formal, preservando valor separado de recebimento; cancelamento sem movimento a rejeita. Fila administrativa inclui o valor corrente e a fotografia histórica. Campo da fotografia é incluído apenas quando positivo, preservando hashes sem permuta. Unitários da fotografia 2/2 e TypeScript sessão70268 saída0; integração da fila ainda pendente após liberação do banco pela regressão41300. Não encerra o acerto de desistência/Q165.

18/09/2026 — M01/P02: fotografia da conciliação financeira registra compensação por serviço separada de caixa quando positiva. Conferências sem permuta conservam a estrutura/hash anterior; nenhuma origem de recebimento é fabricada. Testes de leitura/fotografia e canonização 17/17, TypeScript sessão3471 saída0. Integração financeira ampliada permanece pendente após a regressão41300.

18/09/2026 — regressão41300 encontrou falhas em retomada. Reprodução isolada no TESTER em5305fe6: 1 falha/36 filtrados, erro de fixture sem evidência da destinação do recebimento (antes do cenário). Correção98a5afc fornece evidência e consulta caixa pelo titular contratual Q87, exigindo dois recebimentos na preparação. Reexecução integral do arquivo no TESTER iniciada na sessão40843, ainda sem resultado terminal. Worktree TESTER limpo reposicionado em detached HEAD, branch anterior preservada; migrações218/222/223 e geração Prisma concluídas na sessão77214 saída0. Banco de integração continua reservado à sessão41300.

18/09/2026 — TESTER retomada: sessão40843 terminou com36/37 aprovados; única falha restante tentava persistir saldo inválido agora recusado no guard SQL. Correção653f205 valida rejeição e preservação integral de cobrança/caixa; teste unitário de divergência legada permanece. Reexecução dirigida sessão58096:3/3 aprovados,38 fora do filtro, saída0, incluindo permuta real quitando dívida e removendo restrição automática, e permuta parcial entrando na conferência/fila administrativa de desistência sem caixa fictício. Não declarar regressão global aprovada.

18/09/2026 — P02 histórico operacional: consulta paginada em grupos de50, ordenação estável por data/id, página validada no servidor, navegação anterior/próxima e estado vazio. Evita deixar acordos antigos inacessíveis após cinquenta registros. Interface9/9 e TypeScript sessão22401 saída0. Novo cenário de integração51 acordos aguarda banco TESTER ocupado por44301; não presumir validação dessa consulta.

18/09/2026 — regressão unitária completa emebe96a4: sessão88484 saída0,250 arquivos/1554 testes aprovados,zero ignorados; relatório node_modules/.cache/unitarios-pos-consumidores-permuta.json. Abrange os consumidores de permuta, fotografia de migração, desistência e navegação atualizados. Não equivale à regressão integrada41300 ou à revisãoTESTER44301, ambas ainda em execução.

18/09/2026 — TESTER653f205: sessão44301 terminou saída0,112/112 integrações em4 arquivos,zero ignorados: lançamentos acadêmicos96, guardas de permuta7, ações de permuta4, fila administrativa de desistência5. Revisão executada pelo integrador no ambiente TESTER; não atribuir a agente independente indisponível. Após sincronizar04689df, paginação51 acordos passou1/1 com4 fora do filtro (saída0), incluindo páginas sem sobreposição e entradas inválidas. Regressão global41300 continua em execução.

18/09/2026 — M01 após consumidores de permuta: TESTER04689df, sessão54936 saída0,18/18 integrações em conciliação e consultas financeiras,zero ignorados. Valida preservação da fotografia sem permuta, permissões, origem, replay e resolução de pendência. Q165/Q167 reapresentadas no seletor, sem resposta presumida; outras frentes permanecem abertas.

18/09/2026 — regressão global detectou fixture de reposição com dois avaliadores sobrepostos, recusada pela integridade Q40. Correção df98f58 delimita a designação anterior até o início do avaliador vigente, preservando o cenário de histórico sem acesso atual. Arquivo completo de permissões em reexecução no TESTER, sessão53716; resultado ainda pendente. Não houve alteração da regra de acesso ou relaxamento do guard SQL.

18/09/2026 — permissões de reposição Q40/Q36: TESTER df98f58, sessão53716 saída0,16/16 integrações sem ignorados após correção da fixture histórica. Preserva avaliação de entrega anterior em matrícula pausada/encerrada, recusa dois contratos trocados e mantém revogação/atribuição vigente. Não representa encerramento de V01.

18/09/2026 — DCT03 cadastro contratual: iniciada projeção por versão aplicada, ligada à matrícula e ao hash da aplicação; somente oito campos cadastrais, sem alterar Aluno/portal/outros contratos. Consulta de aplicação passa a fornecer essa projeção, distinguindo vigência futura/iniciada sem afirmar que uma versão histórica seja a última vigente. Quatro unitários e TypeScript sessão77348 saída0 (antes da renomeação literal do estado). Aplicação dos tipos cadastrais continua bloqueada: falta completar conferência dos signatários, consumo e interface com validação integrada. Não declarar DCT03 cadastral concluído.

18/09/2026 — TESTER aditivos/agenda, sessão57847:54/55 aprovados. Única falha criava cobrança paga sem destinação; be50245 registra o recebimento real antes da compra/reserva de horas. Reexecução do cenário corrigido:1/1 aprovado,16 fora do filtro,saída0. DCT03 cadastral precisa atualizar em conjunto aditivo-participantes-contexto.ts e guard de ConferenciaParticipantesAditivo (migração original20260915060000, imutável); não liberar tipos apenas removendo bloqueio de aplicação.

18/09/2026 — DCT03 identidade: migração224 reservada em20260917149000_identidade_contratual_aditivo, bytes preservados por.gitattributes. Servidor/SQL conferem identidade a partir da última versão aplicada da mesma matrícula e alterações estruturadas da proposta aprovada; mudança textual legada sem correspondência permanece recusada. Não altera Aluno nem conta de portal. Oito unitários passaram e TypeScript16404 saída0; aplicação/integração no TESTER a seguir. A aplicação cadastral ainda não foi liberada, e a migração não deve ser aplicada na integração durante41300.

18/09/2026 — DCT03/224 no TESTER28c70895: reexecução dirigida sessão47495 terminou saída0, 3/3 integrações,36 fora do filtro. Confere identidade contratual proposta sem alterar aluno compartilhado e preserva recusas de identidade/versão. Tela do original passa a exibir somente campos cadastrais projetados da versão aplicada, com vigência programada/iniciada e aviso de possível substituição por versões posteriores. TypeScript saída0 após correção do caminho de importação; sem homologação visual presumida. Aplicação cadastral permanece bloqueada até completar consumidores e teste integral. Migração224 não aplicada no banco integracao, reservado à regressão41300.

18/09/2026 — DCT03 cadastro:74ea6fa/4b9fe5e habilitam aplicação versionada e ajustam teste de invalidação para documento não substituído pelo aditivo. Cenário completo PRODUCAO1/1 passou,38 fora do filtro: assinatura simulada local, conferência, aplicação, replay, projeção cadastral, aluno/cobranças preservados e cadeia de próxima proposta. Unitários12/12 e TypeScript34871 saída0. Suite completa aditivo.int.test.ts em TESTER4b9fe5e iniciada82092, relatório node_modules/.cache/aditivo-cadastral-224.json; resultado pendente. Integração global41300 ainda viva; não aplicar224 nesse banco. Revisão de consumidores e dos demais campos permanece antes de aceite cadastral integral.

18/09/2026 — DCT03 consulta vigente: lista de aditivos passa a consultar e exibir a última versão aplicada cuja vigência já começou, no escopo da matrícula e dentro da autorização existente. Versões futuras ou apenas formalizadas não substituem o cadastro apresentado. TypeScript79890 saída0; cenário de fronteira temporal e outro contrato acrescentado ao fluxo integrado, aguardando término82092 antes da reexecução no mesmo banco.

18/09/2026 — DCT03/224 TESTER4b9fe5e: arquivo completo aditivo.int.test.ts39/39,zero ignorados, sessão82092 saída0; relatório node_modules/.cache/aditivo-cadastral-224.json. Após b97d30c, cenário cadastral completo1/1 (38 fora do filtro) saída0 confirma consulta vigente antes/no início exato e isolamento de outra matrícula. Não equivale a revisão independente nem homologação visual; integração global41300 permanece separada.

18/09/2026 — DCT03326addd: apresentação/projeção6/6 testes e TypeScript92921 saída0, cobrindo os oito campos, separação financeira e escape de HTML. Integração dirigida da sucessão cadastral1/1 (38 fora do filtro) saída0: segunda proposta aprovada e signatários conferidos sem alterar Aluno ou antecipar a versão aplicada vigente. Cobertura de oito campos é unitária/SSR; não declarar integração individual dos oito nem homologação visual. Agentes DEV2/TESTER continuam em erro de limite de uso confirmado por list_agents; verificações desta rodada foram executadas pelo integrador.

18/09/2026 — DCT03 cadastro07abb7f: cenário integrado dos oito campos aprovado1/1,39 fora do filtro, saída0 no TESTER. Percorre modelo com fontes cadastrais, proposta estruturada, aprovação, conferência, PDF, assinatura simulada, conferência final, aplicação e próxima conferência preservando identidade contratual anterior. Projeção exata dos oito campos conferida; Aluno, registros de pagador e cobranças permanecem iguais. TypeScript73258 saída0 antes das asserções finais. Sem provedor real ou homologação visual.

18/09/2026 — DCT03 revisão de efeitos512770b: corrigida resposta sempre aplicado=false e mensagem de condições nunca aplicadas. Consulta agora verifica registro da proposta/matrícula e integridade da versão, retornando referência da aplicação; tela distingue aplicação registrada de vigência e acertos próprios. TypeScript47802 saída0; TESTER74199 saída0,2/2 integrações,38 fora do filtro (antes/depois da aplicação, autorização e contrato exato). Nenhum efeito é executado pela consulta.

18/09/2026 — DCT03 primeira mensalidade: iniciada identificação do alvo pelo ItemEmissaoEntrada da matrícula, nunca pelo menor vencimento. Revisão dos efeitos e tela mostram proposta de data, cobrança/versão quando inequívoca e pendência quando ausente, múltipla ou cancelada. Três unitários aprovados; TypeScript82807 saída0. Não altera cobrança nem libera aplicação: persistência da proposta financeira, aprovação independente, guardas e aplicação continuam pendentes. Não declarar funcionalidade concluída.

18/09/2026 — DCT03 primeiro vencimento: migração225 reservada em20260917150000_proposta_vencimento_aditivo (NÃO APLICADA). Prisma modela proposta imutável e decisão independente, com cobrança/versão, origem contratual, data anterior/nova, fuso e fotografia. SQL inicial verifica origem inequívoca da emissão, contrato, versão, data contratual e papel/autoaprovação. Schema validado pelo executável local Prisma saída0, sem conexão ao banco. Pendente revisar fotografia material completa, assinatura/finalização, locks e guardas antes de aplicar225; ações, aplicação e interface operacional não entregues. A revisão de alvo930378e continua somente leitura.

18/09/2026 — DCT03/225 (ainda NÃO APLICADA): revisão acrescenta fotografia integral da cobrança e hash SHA256 do JSONB canônico do banco, validação da alteração explícita (não herdada), assinatura/conferência em produção, última proposta e serialização pelo lock de calendário. Ensaio SQL no perfil TESTER criou tabelas/funções/triggers em transação e fez ROLLBACK, saída0. Esse ensaio comprova criação SQL, não execução das guardas. Testes negativos, ações, interface e aplicação continuam pendentes; não liberar emissão nem alterar vencimentos com este checkpoint.

18/09/2026 — DCT03/225 aplicada somente no TESTERaa2bfda, migração20260917150000 agora imutável. Sessão87785 confirmou deploy e geração Prisma; TypeScript continua em execução, não aprovado ainda. Ações proporVencimentoAditivo/decidirVencimentoAditivo implementam autorização fresca, assinatura/revisão exata, transação, idempotência e eventos sem aplicar vencimento. Banco confere fotografia integral e decisão independente. Pendente teste integrado de ações/SQL, consulta operacional, interface e aplicação financeira; schema/client do root não regenerados durante regressão41300. Não declarar funcionalidade entregue.

18/09/2026 — DCT03 vencimento9983fa2: cenário integrado1/1 aprovado,40 fora do filtro, saída0 no TESTER. Abrange emissão inicial real, assinatura/finalização, preparação financeira, repetição, chave divergente, imutabilidade SQL, hash adulterado, autoaprovação negada, aprovação administrativa e cobrança preservada. Investigação corrigiu hipótese inicial: a divergência observada vinha do cast Date/timestamptz para timestamp no fuso da sessão America/Sao_Paulo; agora usa UTC explícito. Hash é calculado sobre JSONB persistido no mesmo INSERT; corretiva226 aplicada somente TESTER e imutável. TypeScript87785 havia terminado saída0 antes dos ajustes posteriores. Aplicação do vencimento e interface continuam pendentes; sem conclusão do recorte.

18/09/2026 — V01 global41300 terminou saída1:160 arquivos,1533 testes,1441 aprovados/92 falhos em18 arquivos, relatório node_modules/.cache/integracao-pos-permuta-223.json. Execução começou antes das correções de retomada, aditivos, agenda e designação de reposição; não representa HEAD atual nem aprovação global. Falhas restantes incluem fixtures sem ledger/evidência, avisos e atribuição docente; auditar antes de concluir. Após término, migrações224/225/226 aplicadas na integração e Prisma gerado (46448 saída0). Correção62d6545 fornece evidência de destinação em quatro arquivos financeiros; reexecução integral desses quatro arquivos iniciada56679, relatório node_modules/.cache/recebimentos-evidencia-regressao.json, ainda em andamento. Banco integracao novamente reservado a essa sessão. Aplicação de vencimento ainda pendente; implementação desviada temporariamente para resolver as falhas confirmadas da regressão.

18/09/2026 — Regularização integral: reexecução financeira disponível confirmou 55/66 aprovados e 11 falhas. Corrigida projeção em periodo-integral-estado.ts que enviava recebimentoId não aceito pelo schema estrito do cálculo; snapshot preserva a origem do recebimento. Cinco unitários da apuração passaram, saída0. Reexecução integrada não iniciou: setup reportou banco descartável indisponível, saída1; nenhuma integração considerada aprovada. Handles anteriores56679/66867 inexistentes nesta retomada. Aplicação de vencimento e demais pendências permanecem abertas.

18/09/2026 — Fixtures de ativação/política financeira: pagamentos prévios agora entram via registrarPagamento e preservam dois recebimentos reais; mutação de preço do cenário de aceite mantém saldo coerente; complemento na ativação informa evidência da destinação. TypeScript saída0 antes do último comentário de fixture, diff --check saída0. Auditor Terra confirmou leitura da causa da ativação parcial; sem execução independente. Integração pendente: cluster descartável sofreu encerramento incorreto e está recuperando WAL (processo87128 e log com avanço confirmado); partida55986 excedeu timeout do pg_ctl, não reiniciar servidor durante recuperação. Schema de ativação ainda pode melhorar a validação antecipada da evidência, já exigida pelo ledger.

18/09/2026 — Banco descartável recuperado: log confirmou pronto para conexões e migrate status saída0 confirmou schema atualizado. AtivacaoSchema agora apresenta erro no campo comentario quando recebimento positivo não contém evidência mínima, mantendo ativação sem novo recebimento. Schema11/11 testes saída0; TypeScript67183 saída0. Reexecução integrada de política, ativação e período integral em andamento53024, relatório previsto node_modules/.cache/financeiro-recuperado.json; não marcar aprovada antes da saída terminal.

18/09/2026 — Reexecução53024 terminou saída1:35/43 integrações aprovadas; política20/20 e ativação passaram,8 falhas em período integral. Causa confirmada: guard SQL67 ainda somava Recebimento.cobrancaId legado, incompatível com destinações Q87. Migração227 (20260917152000_periodo_integral_destinacoes) substitui somente a origem da soma e conferência de moeda por DestinacaoRecebimento, preservando demais guardas. Aplicada no perfil integracao, saída0, bytes imutáveis. Arquivo completo período integral em reexecução40386; resultado ainda pendente. Próximo ID de migração livre228.

18/09/2026 — Migração227 validada: sessão40386 saída0,18/18 integrações de período integral,zero ignorados, relatório node_modules/.cache/periodo-integral-227.json. Inclui saldo parcial/crédito, cobertura futura, aprovação obsoleta, preservação de recebimentos, atomicidade e concorrência sem crédito duplicado. Não equivale à regressão global nem conclui DCT03/P02.

18/09/2026 — Acessos financeiros:96710 saída0,36/36 integrações em acesso-aulas, gravacoes/autorizacao e whatsapp/acesso-atendimento,zero ignorados; relatório node_modules/.cache/acessos-financeiros-atual.json. Prévia de pausa ajusta fixture para destinação real, confirma recusa SQL de saldo inconsistente e preservação do saldo80. Recebimento conciliado é preservável e não exige pendência financeira artificial; cobertura ausente e sobreposição continuam sinalizadas. Arquivo pausa-previa4/4 saída0; TypeScript saída0. Não encerra regressão global.

18/09/2026 — Continuidade SQL: fixture de cobrança baixada agora registra recebimento e destinação reais antes de testar a recusa de emissão. Arquivo completo2/2 integrações aprovado, saída0; TypeScript saída0. Preservadas verificações de contrato pausado e proibição de emitir cobrança já baixada. Nova auditoria Terra somente leitura em andamento para atribuição docente nas entregas do portal; não implica validação independente concluída.

18/09/2026 — Portal: auditor Terra identificou pedidos de correção atribuídos indevidamente ao gestor nas fixtures. Cenários agora designam professor vigente exclusivamente para a reposição correta, mantendo recusa de prorrogação cruzada. Entregas e guardrails19016/16 integrações,94220 saída0. Secretaria: preserva verificação de contrato conferido e registra recebimento parcial real antes de testar bloqueio de alteração de cobertura, usando versão corrente; política11/11,7406 saída0. TypeScript saída0; nenhuma permissão de produto relaxada.

18/09/2026 — Avisos de substituição: falhas de driver/incerteza dependiam da janela padrão do relógio real. Fixture define janela explícita0–24/todos os dias apenas no banco descartável; provedores continuam mocks, política de produto intacta. Arquivo completo19/19 integrações,99669 saída0,zero ignorados; TypeScript saída0. Relatório node_modules/.cache/avisos-janela-explicita.json. Revisão Terra da aplicação de vencimento DCT03 em andamento; não declarar esse fluxo entregue.

18/09/2026 — DCT03 aplicação de vencimento iniciada: schema AplicacaoVencimentoAditivo vincula decisão única, executor, chave idempotente, fotografia e versões/datas antes/depois. Migração228 reservada em20260917153000_aplicacao_vencimento_aditivo, NÃO APLICADA: tabela e guarda inicial de autoria/aprovação/fotografia; falta efeito atômico sobre cobrança, revisão de vigência/bloqueios, ação, interface e testes integrados. Schema Prisma validado saída0, sem comprovar execução SQL. Auditor Terra mapeou consumidores e riscos; próximo passo completar228 antes de qualquer deploy local.

18/09/2026 — DCT03/228 aplicada no perfil integracao e Prisma gerado,52794 saída0; migração agora imutável. Trigger aplica vencimento/versão/status em transação e preserva demais valores, recebimentos e cobertura; ação exige aprovador independente e permite replay da chave. Cenário PRODUCAO_MENSAL_VENCIMENTO1/1 passou,40 fora do filtro, saída0: assinatura, proposta, decisão, execução e replay com comparação integral da cobrança. Pendente ampliar negativos (obsolescência/PAGO/SQL), vigência e consumidores de acesso, consulta/interface; não concluir funcionalidade.

18/09/2026 — DCT03 vencimento: testes SQL adicionais recusam fotografia obsoleta com rollback integral, executor preparador e exclusão de aplicação; chave divergente recusada após replay válido. Aplicação/replay reavaliam acesso da cobrança após commit; falha posterior não desfaz nem apresenta como falha a alteração financeira confirmada, com reconciliação institucional. Integração dirigida1/1,40 fora do filtro, saída0; TypeScript saída0 (incluindo39721 anterior). Cobertura PAGO, efeito de acesso específico, vigência e interface continuam pendentes.

18/09/2026 — DCT03 consulta operacional de vencimento: histórico paginado50 por matrícula/versão, com estado de decisão/aplicação, datas/fuso e permissões atuais de solicitação; não expõe fotografia nem chaves de idempotência. Revalida papel financeiro no banco e impede troca de matrícula. Cenário integrado dirigido1/1 aprovado,40 fora do filtro, saída0; TypeScript saída0. Consulta é base da interface ainda pendente e não garante validade da fotografia no momento da execução, que continua reconferida pela ação/SQL.

18/09/2026 — DCT03 interface inicial: página financeira por matrícula/proposta resolve versão formalizada, exibe alvo, histórico paginado e ações de preparar/decidir/aplicar conforme consulta autorizada. Link no aditivo. Formulário conserva chave e entrada em resultado incerto para replay, sem envio externo. TypeScript saída0. Pendente revisão de recuperação após rejeição conhecida, testes de interface/visual, preservação de PAGO e vigência; não considerar recorte concluído.

18/09/2026 — DCT03 formulário: mutações identificam rejeições conhecidas somente após retorno/rollback, liberando correção de entrada e nova chave. Falha inesperada mantém entrada/chave para replay; sucesso financeiro continua preservado se falhar reavaliação posterior. TypeScript saída0; integração dirigida1/1 (40 fora do filtro) saída0, incluindo sinalização de revisão em recusa por permissão/chave. Testes de interação/renderização ainda pendentes.

18/09/2026 — DCT03 vencimento: variante com mensalidade previamente quitada via recebimento/destinação reais passou junto à aberta2/2,40 fora do filtro, saída0. Comparação integral confirma preservação de PAGO, saldo, pagoEm, cobertura, recebimentos e destinações após aplicação/replay. Arquivo completo de aditivos iniciado, relatório previsto node_modules/.cache/aditivos-pos-vencimento-228.json; ainda não aprovado. Interface/recuperação visual e vigência continuam pendentes.

18/09/2026 — DCT03 página financeira:4/4 testes SSR aprovados, cobrindo autorização antes de consulta, matrícula/proposta exatas, paginação, escape de conteúdo, ação de aplicação sem decisão e ausência de preparação sem versão formalizada. TypeScript saída0. SSR usa formulário simulado e não comprova interação ou revisão visual. Regressão integrada90182 permanece acompanhada separadamente.

18/09/2026 — DCT03 regressão90182 terminou saída0:42/42 integrações do arquivo aditivo,zero ignorados; relatório node_modules/.cache/aditivos-pos-vencimento-228.json. Formulário passou3/3 testes de callbacks: mantém entrada/chave em incerteza, libera edição em rejeição conhecida e impede submissão concorrente antes de render. Sucesso conserva tentativa e bloqueia botão até navegação, evitando nova proposta por clique repetido. Ainda não é revisão visual nem regressão global da SPEC.

18/09/2026 — DCT03 vigência: corrigida antecipação possível do vencimento. Migração229 aplicada no integracao, imutável; SQL e ação recusam execução antes da vigência formalizada. Consulta retira ação antes do início e página mostra instante UTC. Preparação/aprovação continuam possíveis antes da vigência. Três integrações dirigidas (aberta/PAGO/futura) aprovadas65731 saída0,40 fora do filtro; futura inclui inserção SQL recusada e cobrança preservada. TypeScript saída0.

18/09/2026 — Regressão unitária completa40d992d:1579/1579 testes,256 arquivos,zero ignorados, saída0; relatório node_modules/.cache/unitarios-pos-vencimento-229.json. SPEC atualizada com implementação/evidências/pendências do primeiro vencimento. Auditor Terra revisa commit40d992d de forma independente e somente leitura; não homologar antecipadamente.

18/09/2026 — Revisão independente Terra do vencimento não encontrou quebra de autorização/idempotência/atomicidade. Corrigida oferta de preparação para cobrança cancelada: consulta identifica elegibilidade e página respeita o bloqueio, mantendo informação para conferência. Origem ausente/ambígua também não oferece preparação. Nove testes direcionados (consulta de alvo e SSR) e TypeScript terminaram com saída 0. Continua pendente fortalecer reconciliação de acesso após falha pós-commit; não declarar DCT03 ou SPEC integralmente concluída.

18/09/2026 — DCT03: consulta de efeitos identifica aplicação histórica do acerto de vencimento pela proposta/matrícula exatas, preservando a distinção da aplicação geral de condições. Variantes aberta/PAGO/futura: 3/3 integrações dirigidas aprovadas, 40 fora do filtro, sessão38487 saída0; TypeScript saída0. Primeira execução falhou nas três fixtures antes do teste por data de assinatura incompatível; repetição sem mudança da regra passou. Instabilidade temporal da fixture permanece a investigar, sem relaxar validação.

18/09/2026 — DCT03 acesso: revisão independente Terra identificou inversão de locks ao mover reavaliação para dentro da aplicação (matrícula/cobranças versus baixa que trava cobrança antes da matrícula). Experimento revertido antes de commit; seus testes verdes não comprovam segurança concorrente. Mantida reavaliação pós-commit. Próxima entrega deve persistir trabalho de reconciliação no commit financeiro e processá-lo após commit, com repetição segura, evidência de falha e recuperação; não adotar reavaliação transacional sem normalizar escritores. P2 permanece aberto.

18/09/2026 — DCT03 reconciliação de acesso: migração230 aplicada no banco descartável integracao, geração Prisma concluída saída0 (sessão66384). Trigger registra intenção no mesmo commit da aplicação e inclui aplicações anteriores. Consumidor pós-commit/cron processa com trava exclusiva SKIP LOCKED; reavaliação e conclusão da tarefa confirmam juntas, falha mantém intenção e registra tentativa sem dados sensíveis. Consulta financeira/tela mostram estado separado da aplicação. Integrações dirigidas3/3 (40 fora do filtro), sessão96734 saída0: falha simulada, efeito financeiro preservado, tarefa pendente, recuperação e repetição sem nova aplicação. Nove testes SSR/cron e TypeScript saída0. Revisão independente Terra solicitada; concorrência ampliada e revisão visual ainda pendentes.

18/09/2026 — Revisão independente Terra da reconciliação apontou inversão legada de locks e prioridade infinita de tarefas novas. Consumidor agora usa NOWAIT nas cobranças e cede com rollback à baixa concorrente; demais callers preservados. Fila ordena COALESCE(última tentativa, criação), eliminando prioridade infinita de null. Revisão RO aprovou a solução; teste com lock real acrescentado, aguardando banco. Unitários completos1582/1582 (256 arquivos,zero ignorados), saída0; TypeScript saída0 antes do novo cenário concorrente. Global integração27121 está ativa e já reportou16 falhas em agenda-aditivo, sem diagnóstico final; não representa aprovação. Relatório previsto node_modules/.cache/integracao-pos-reconciliacao-230.json.

18/09/2026 — Q168 respondida e registrada na SPEC: cobertura iniciada/paga pode ser corrigida com evidências e acerto independente, sem apagar recebimentos/histórico. TESTER isolado9fe11e7 migrações227–230 e cliente atualizados pelo integrador, sessão98953 saída0. Validação independente: vencimento3/3 (40 fora do filtro) com lock real/NOWAIT aprovado; agenda-aditivo17/17, sessão7925 saída0. As16falhas do mesmo arquivo na global27121 não reproduziram; aguardar diagnóstico completo, sem declarar regressão global aprovada. Root TypeScript saída0 após teste concorrente.

18/09/2026 — DCT03 continuidade: identificado bloqueio residual do resolvedor mensal mesmo após aplicação própria do primeiro vencimento. Implementada projeção pura por campo baseada em alterações explícitas e fatos existentes: preserva prova herdada, exige nova aplicação para reasserção idêntica, não transforma acerto próprio em aplicação global e rejeita cadeia/hash divergentes. Sete unitários aprovados; TypeScript saída0 antes da validação adicional dos tipos estruturados. Ainda NÃO ligada ao resolvedor/guardas SQL: continuidade continua pendente até completar integração, heranças e testes reais. Nenhuma migração nova nesta etapa.

18/09/2026 — DCT03 continuidade: resolvedor mensal agora carrega a cadeia, confere snapshot/matrícula/hash e deriva aplicações por campo. Reconhece acerto próprio do primeiro vencimento sem inventar aplicação geral, preservando preço e bloqueando outros campos pendentes. Vinte unitários e TypeScript saída0. Acrescentado teste integrado de preço da próxima cobertura antes/depois do acerto; execução pendente no TESTER. Heranças em aplicação genérica e guardas SQL ainda pendentes; não declarar fluxo misto completo.

18/09/2026 — TESTERc10a361: arquivo completo aditivo43/43, sessão53301 saída0; filtro de vencimento3/3 (40 fora do filtro) saída0. Continuidade após acerto próprio confirmada no resolvedor real. Nova etapa: gate de aplicação direta usa prova por campo, permitindo condição direta da proposta quando campos próprios já têm aplicação, sem aceitar herança pendente. Migração231 preparada, NÃO APLICADA, substitui guarda SQL cumulativa por origem explícita e ledger. Vinte e dois unitários e TypeScript saída0; cenário misto preço+vencimento acrescentado e aguardando deploy/teste isolado.

18/09/2026 — Migração231 aplicada somente no TESTER20ea83e, agora imutável; root integracao continua sem231 enquanto regressão27121 executa. Primeira rodada:3/4 cenários de vencimento passaram; misto recusado corretamente por faltar alçada comercial na fixture. Corrigida fixture em44b5c9c, sem relaxar regra: cenário misto1/1 (43 fora do filtro) passou saída0. Confirma assinatura com alçadas financeira/comercial, aplicação própria de vencimento, bloqueio do preço ainda pendente, aplicação direta posterior pelo gate Node+SQL e resolvedor com novo preço. Sem declarar cadeia herdada ou regressão completa da231 aprovadas.

18/09/2026 — DCT03 apresentação: consulta autorizada projeta aplicação por campo da proposta consultada usando a cadeia preservada; tela distingue condição aplicada/pendente e não mantém aviso de acerto pendente para campo já aplicado. Dois testes SSR e TypeScript saída0. Integração dessa projeção pendente; DEV Terra no worktree dev-email2c9b63c/DBisolado está cobrindo cadeia sucessiva com herança. Migrações até231 e client desse ambiente preparados pelo integrador, sessão80682 saída0. Sem homologação visual presumida.

18/09/2026 — DEV Terra entregou cadeia documental v1 vencimento aplicado → v2 preço: teste integrado1/1,44 fora do filtro, saída0 no dev-email. Commits e0dcce88/f26ed3e9 integrados; corrigida tipagem do helper pelo integrador. TESTER encontrou consumidor legado de ativação ainda usando aplicação global; agora usa resolvedor Tx por campo. Suíte unitária revelou mock antigo sem count: fixture ajustada, conclusão20/20 e TypeScript saída0. Integração específica da ativação legada com aditivo próprio ainda pendente; global27121 continua ativa.

18/09/2026 — Regressão unitária completa após0fb5c3f:1595/1595 testes,zero falhas/ignorados, saída0; relatório node_modules/.cache/unitarios-pos-ativacao-campos-231.json. Banco TESTER0fb5c3f reservado ao agente para aditivos e ativação; banco integracao permanece reservado à global27121, ainda viva. Atualizado resumo do quadro para refletir agentes ativos; não confundir validação de recortes com entrega integral.

18/09/2026 — TESTER independente no commit0fb5c3f/banco até231: ativacao.int.test.ts5/5 (chunk331ca9, saída0) e aditivo.int.test.ts45/45 (sessão82039, saída0), sem ignorados. Isso valida os arquivos executados; não comprova ativação legada com aditivo documental: DEV verificou que o original assinável exige PreparacaoComercialMatricula, que desvia a ativação ao fluxo de preparação. Não fabricar registros imutáveis para alegar essa cobertura. DEV segue com negativos SQL231 e reasserção explícita; revisão apontou relógios Node/DB nas fixtures de conclusão e correção está atribuída ao mesmo DEV. Global27121 continua confirmadamente ativa.

18/09/2026 — Q170 aprovada e registrada na SPEC: conjunto explícito de cobranças afetadas/preservadas com justificativas e aprovação independente; condição só completa após todos os ajustes. Consulta/tela agora distinguem a quantidade de acertos aplicados em alvos específicos da condição global ainda pendente (f61f717); integração nova em validação independente. DEV anterior1344a16 integrado em39a6d033: negativo SQL231 com rollback integral e recusa documental de reasserção idêntica, dois filtros2/2 cada (45 fora do filtro por execução), saídas0. Fixtures usam data persistida da tentativa de envio. TypeScript após integração saída0. DEV1 recebeu Q170 com migração232 reservada; nenhum deploy232 realizado.

18/09/2026 — TESTER f61f717/DB231: arquivo completo acerto de taxa20/20 (sessão76961, saída0) e aditivos47/47 (sessão49723, saída0), zero ignorados. Revisão independente confirmou que contador de acertos por alvo não libera condição global. Migração232 ainda não aplicada: revisão inicial solicitou guardas completas de estado, autoria e conjunto; client Prisma dev-email gerado após corrigir relação sem oposta, sessão62267 saída0. Global27121 segue ativa e reportou1falha/6 em impactos-progressao-tx; diagnóstico dirigido independente em andamento, sem alteração especulativa de regras.

18/09/2026 — TESTER f61f717: filtro exato de impactos-progressao-tx “não executa aprovação antiga” passou1/1,5fora do filtro, chunk7d2f5a saída0. Falha da global não reproduzida; aguardar stack final27121 antes de atribuir causa ou alterar guardas. TESTER iniciou revisão RO das invariantes da migração232 em desenvolvimento; banco TESTER livre, sem nova migração aplicada.

18/09/2026 — TESTER f61f717: arquivo completo impactos-progressao-tx6/6, zero ignorados, chunkb97a00 saída0; relatório erp-tester/node_modules/.cache/impactos-progressao-completo.json. Falha da global continua não reproduzida, sem causa presumida. Revisão232 exigiu vínculo obrigatório decisão/transição e revalidação pós-acerto; correções DEV até2e1f652 ainda não integradas/aplicadas. Nova revisão apontou obsolescência confundida com aplicação incompleta; correção solicitada antes do deploy. Prisma dev-email regenerado30082 saída0; serviços e testes Q170 permanecem em desenvolvimento.

18/09/2026 — Q170: migração232 de2ec95e6 aplicada exclusivamente no dev-email, chunk88d346 saída0; bytes imutáveis. Serviços seguem incompletos no ramo DEV, sem integração presumida. Segundo ambiente DEV preparado em9ac1/erp-genius no commit7360b01 com perfildev-gravacoes (banco exclusivo), migrações até231 e Prisma71817 saída0; dependências atualizadas pelo integrador via npmci70254 saída0, cliente pós-instalação61597 saída0. Worktree antigo erp-dev-gravacoes e suas alterações preservados e não atribuídos. DEV2 recebeu navegação M01 para conferência histórica da turma canônica; TESTER revisa serviçosQ170. Global27121 continua ativa.

18/09/2026 — Integrada navegação M01 b38d0fb0 em760e5826; SSR principal1/1 saída0. Projeção pura Q170 reconhece somente prova de conjunto completo da versão explícita, preserva herança e exige nova prova para alteração posterior;24unitários direcionados e TypeScript42051 saída0. Loader de banco e guarda SQL dessa prova ainda não conectados; alteração pura não libera taxas por conta própria. Root reservou234 para consumidor SQL,233 reservada ao DEV para eventual correção de232.

18/09/2026 — M01 auditoria local e orientação de presença integradas em5e20cd2/0a33615; callbacks principal3/3 saída0. Integração Q170 feita pelo root temporariamente no worktree erp-tester: migração232 aplicada e Prisma72207 saída0; projeção pura04df5b7 e loader/SQL234 em45b330d, TypeScript63628 saída0. Migração234 aplicada somente no TESTER, chunk4543a4 saída0, agora imutável. Root principal ainda não recebeu232/234 nem regenerou client para preservar DB da global27121 ativa. Prova integrada antes/depois do conjunto e UI seguem pendentes; não considerar234 funcionalmente homologada pelo deploy.

18/09/2026 — Global27121 encerrou saída1:1518/1541 testes aprovados,23falhas,160arquivos (156aprovados/4falhos), duração3351.92s; relatório node_modules/.cache/integracao-pos-reconciliacao-230.json. Não é snapshot estável: o código recebeu alterações durante a execução, enquanto DB permanecia até230. Falhas:16agenda-aditivo e1acerto-taxa por data de conclusão;5aditivo (2divergências código/schema e3timeouts10s);1impactos-progressao com frequência histórica pendente antes da correção. Corrigida fixture agenda com instante persistido do envio, reexecução24528 pendente. RootDB atualizado até231 depois do término (c517aa saída0). Migração233 aplicada no DEV-email para data civil sem conversão de fuso, chunk2c5891 saída0, agora imutável. Próxima regressão global deve usar checkout congelado e schema correspondente, sem editar arquivos durante o run.

18/09/2026 — Q170 impactos de taxa: serviço revalida a fotografia de cada cobrança na aprovação/conclusão e só aceita a alteração produzida pela aplicação de acerto vinculada. Integração documental cobre duas taxas (AFETADA e PRESERVADA com justificativas), autoaprovação negada, aprovação independente, vínculo antes da aprovação, aplicação individual, conclusão idempotente sem crédito adicional, replay alterado, vínculo cruzado e mutação da preservada após aprovação. Corretiva233 aplicada no banco dev-email para comparar colunas DATE sem conversão de fuso. `aditivo-acerto-taxa.int.test.ts` 23/23, sessão97084 saída0; TypeScript saída0. Recorte dirigido, não regressão global.
18/09/2026 — Q170 interface operacional: página da proposta permite declarar todas as taxas e justificar AFETADA/PRESERVADA; tela financeira apresenta o conjunto com identificação humana da cobrança, os acertos da própria cobrança nos estados pendente/aprovado/aplicado, vínculo, decisão e conclusão. Vínculo só aparece enquanto o conjunto está PENDENTE; aprovação exige todos os afetados vinculados, e conclusão fica indisponível até as aplicações. Flags de autorização usam papel/permissão atuais e a Secretaria fica apenas em consulta. Testes direcionados dos componentes de taxa e impactos 14/14, saída0; TypeScript saída0. Aguardando teste independente da interface/fluxo integrado antes de declarar Q170 completa.

18/09/2026 — Q170 recuperação pendente: REJEITADO/OBSOLETO não possuem ação operacional de reconstrução. A preparação documental permanece acessível, mas ainda falta uma transição explícita que marque conjunto aprovado obsoleto após fotografia divergente e guie o Financeiro a preparar novo conjunto com chave nova. Não considerar Q170 completa até entregar essa recuperação e sua validação independente.

18/09/2026 — Q170 recuperação implementada: Financeiro/Admin ativo relê o conjunto após lock da matrícula e solicita OBSOLETO somente para APROVADO; o trigger existente aceita a transição apenas diante de fotografia material divergente. A interface preserva o histórico e oferece reconferência de todas as linhas para preparar novo conjunto, sem reabrir ou reutilizar aprovação. Teste de componente 3/3 e TypeScript saída0. Integração Q170 ainda não executada: perfil dev-email bloqueou corretamente porque a migração235 não foi aplicada; solicitado deploy ao integrador.

18/09/2026 — Q170 repreparo: corretiva236 preparada, não aplicada. Remove a unicidade histórica proposta+fotografia e impõe unicidade parcial de conjunto ativo (PENDENTE/APROVADO/COMPLETO), falhando o deploy se já houver ativos duplicados. REJEITADO/OBSOLETO passam a permitir reconstrução idêntica com nova chave, sem alterar justificativa artificialmente. A consulta prioriza conjunto ativo e o serviço bloqueia novo preparo enquanto houver ativo. TypeScript saída0; integração bloqueada corretamente até deploy236 e geração Prisma pelo integrador.

18/09/2026 — Q170 repreparo validado no dev-email após236: recorte integrado 5/5 (20 fora do filtro), saída0. Cobre rejeição, novo conjunto com a mesma classificação e nova chave, proibição de dois ativos, vínculo do acerto já aplicado ao novo conjunto, aprovação/conclusão e conservação do crédito sem nova emissão. Recorte dirigido, não regressão global.
18/09/2026 — Q170: integrados serviços e migrações232–234 no principal, deploy/Prisma62926 saída0. Prova integrada confirma bloqueio do consumidor mensal antes de concluir o conjunto e reconhecimento de TAXA_VALOR somente após conclusão, preservando o preço mensal original; recorte `prepara todas as duas taxas` 1/1 aprovado,22 ignorados, chunk6b42ed saída0. Agenda-aditivo17/17 saída0 sessão24528; impactos-progressao6/6 saída0 no DEV2 após corrigir a fixture para usar o início persistido do vínculo. Tela operacional Q170 e validação independente da entrega completa seguem pendentes.
18/09/2026 — Q170 conclusão relê o conjunto depois do bloqueio da matrícula para não decidir com estado obtido antes de outra transação. Recorte1/1,22ignorados,9bfed1 saída0. Tentativa de teste concorrente de Server Actions encontrou falha do mock dinâmico NextAuth/next-server e não serve como prova de concorrência; mantida validação funcional sequencial, sem alterar autenticação para contornar o teste. TypeScript80743 saída0. TESTER atualizado2aaebc6+schema234, Prisma51092 saída0; DEV-email234+Prisma85133 saída0. UI e revisão independente em andamento.
18/09/2026 — Q170: revisão da tela detectou possibilidade de aprovar conjunto ainda sem vínculos, impossível de completar depois porque as linhas ficam fechadas. Migração235 e serviço passam a exigir acertos identificados para todas as AFETADA antes da aprovação. Banco principal235 aplicado09652f saída0; testes de fluxo e tentativa direta no SQL2/2,22ignorados,8dec95 saída0. TESTER anterior235 aprovou23/23acerto e47/47aditivo apóscad078e; nova rodada235 e cenário duasAFETADA ainda pendentes. UI851e9f6 devolvida ao DEV para corrigir estados/permissões/identificação por cobrança antes de integrar.

18/09/2026 — Q170 interface operacional: página da proposta permite declarar todas as taxas e justificar AFETADA/PRESERVADA; tela financeira apresenta o conjunto com identificação humana da cobrança, os acertos da própria cobrança nos estados pendente/aprovado/aplicado, vínculo, decisão e conclusão. Vínculo só aparece enquanto o conjunto está PENDENTE; aprovação exige todos os afetados vinculados, e conclusão fica indisponível até as aplicações. Flags de autorização usam papel/permissão atuais e a Secretaria fica apenas em consulta. Testes direcionados dos componentes de taxa e impactos 14/14, saída0; TypeScript saída0. Aguardando teste independente da interface/fluxo integrado antes de declarar Q170 completa.
18/09/2026 — Q151 recuperação: projeções da operação e fila docente agora distinguem realização nova de regularização histórica. Em pausa/encerramento, autorização vigente da própria tentativa libera somente a ação nova; sem ela, a tela conserva formulário histórico para fato anterior, que o servidor continua validando por data, vínculo, autoria, prazo e evidência. Não houve schema, contrato ou mudança de regra. Integração de lançamentos96/96, SSR1/1 e TypeScript saídas0; a SPEC Q151 permanece incompleta nos demais cenários e sem ensaio interativo.
18/09/2026 — Integrados Q170 duas taxas afetadas (aec9fd33) e Q151 distinção entre realização atual/histórica (b4c5367). Principal b4c5367: Q1705/5,20fora do filtro, sessão51116 saída0; SSRQ1511/1 saída0. Regressão unitária integral no checkout estável b4c5367:1602/1602,zeroignorados/falhas,5cfbf8 saída0; relatório node_modules/.cache/unitarios-b4c5367.json. Q170 UI integrada34184cf/2efcc54f, mas recuperação de conjuntos permanece em desenvolvimento; corretiva236 reservada para permitir novo preparo após rejeição/obsolescência sem duplicar conjunto ativo. TESTERQ17025/25 no235 e revisãoindependenteQ151emcurso. Nenhuma operação externa.
18/09/2026 — Q151 recuperação: projeções da operação e fila docente agora distinguem realização nova de regularização histórica. Em pausa/encerramento, autorização vigente da própria tentativa libera somente a ação nova; sem ela, a tela conserva formulário histórico para fato anterior, que o servidor continua validando por data, vínculo, autoria, prazo e evidência. A validação dirigida acrescenta gravação real recusada depois do prazo da autorização. Não houve schema, contrato ou mudança de regra. Integração de lançamentos96/96, SSR1/1 e TypeScript saídas0; a SPEC Q151 permanece incompleta nos demais cenários e sem ensaio interativo.

18/09/2026 — Auditoria independente de acesso contratual: guards de download privado, exportação e portal foram revisados contra a política de acesso. Sete arquivos unitários de autorização de uploads/arquivos e de escopo do portal passaram 59/59, chunk `db8a5e`, saída0. Com perfil `dev-gravacoes` atualizado até235, as integrações dirigidas também passaram: exportações 8/8 (`1e1c51`), arquivos privados 9/9 (`d6bfc2`) e resultados/reposições do portal 6/6 (`d13dd1`), todas saída0. A evidência confirma sessão atual, finalidade e objeto nos arquivos; exportação por capacidade, escopo e projeção fixa; e portal limitado à conta→aluno→matrícula, com leitura histórica própria e nova entrega bloqueada sem liberação específica. Não houve correção porque não foi identificada violação confirmada; estes filtros não são regressão global.

18/09/2026 — Q169 respondida C: aditivo escolhe preservar/mudar referência futura e explicita impactos para aprovação independente; sem reescrita automática de cobranças existentes. SPEC atualizada. Q168/Q169 passam à preparação de implementação pelo DEV2, mantendo Q170 com DEV1.
18/09/2026 — Q170 migrações236/237 integradas e aplicadas no principal e DEV-email. A236 permite histórico rejeitado/obsoleto e um conjunto ativo por proposta; a237 restringe vínculos/aprovação a acertos vigentes e permite reconstruir após inviabilidade comprovada do acerto. Principal d88cb371: arquivo completo acerto-taxa26/26,zeroignorados, sessão81255 saída0, relatório node_modules/.cache/taxa-d88cb371.json. Consulta exige matrícula+proposta (61ac0fc); link de repreparo segue na rota FIN (c673d0c), SSR1/1 e TSsaída0. Revisão independente237 e negativos novos em andamento; não declarar Q170 concluída. Q165C e Q169C aprovadas e registradas, implementações próprias pendentes. DEV2 prepara coberturaQ168/Q169 na238 ainda NÃOaplicada; Prisma do schema em desenvolvimento84971 saída0, sem equivalência a aceite funcional.

18/09/2026 — Q167C aprovada: excedente de permuta negociado caso a caso, concordância registrada e proposta com aprovação independente antes de aplicar. Sem crédito/devolução automática. TESTERQ170 pós237: arquivo26/26 +3novosnegativos/26ignorados eSSRrotaFIN1/1, saídas0. RootnovoSSRrotaFIN5/5 evita preparo duplicado e diferencia errodeconsulta de ausência; principalQ1708aprovados/1falha/20ignorados, sessão46227 saída1: expectativa incorporada do DEV exigia string300.00 enquanto a entrada do consumidor principal usa300. Correção da expectativa e reexecução pendentes.

18/09/2026 — Correção da expectativa pós-merge no teste do consumidor mensal: principalQ1709/9,20fora do filtro, sessão21628 saída0. Não houve mudança no cálculo de produção; a fixture fornece string300 e o resultado preserva essa entrada. A anotação anterior de falha46227 permanece como histórico. Q170 possui implementação local integrada, validações dirigidas e revisão independente; regressão global do snapshot e ensaio visual não presumidos.

18/09/2026 — Revisão do integrador sobre Q168/Q169 no commit DEV2 `774f48c`: entrega ainda não integrada. A fotografia da preparação omite as novas datas, permitindo replay com conteúdo diferente; aplicação não revalida o conjunto inteiro; política de ciclo aparece no evento sem aplicação aos consumidores futuros; faltam validação de datas reais/intervalos, conferência de sobreposição e correspondência com condições assinadas e recuperação de conjunto obsoleto. Correções encaminhadas ao DEV2, além dos guards SQL já apontados. Migração238 continua NÃO aplicada; 7 testes unitários informados pelo DEV não provam o fluxo completo. TESTER mantém a global15599 no snapshot c9934f91/DB237. Handle do build83268 não está mais disponível ao integrador e a saída final não foi recuperada: build não registrado como aprovado.

18/09/2026 — Build do principal em 0cf9f70 concluído com saída 0, sessão12011: compilação, TypeScript e geração de 84 páginas estáticas. Nova execução após confirmação de que o handle83268 não existia e nenhum processo next build permanecia ativo. Esta evidência não inclui commits DEV1/DEV2 ainda não integrados, nem substitui a regressão global em andamento.

18/09/2026 — Revisão SQL238 após bff8488: trigger de aplicação ainda compara novas datas somente com a cobrança, permitindo divergir do impacto aprovado; falta prova de versão consecutiva/datas anteriores e impedimento de commit parcial com conjunto APROVADO. Integrador encaminhou casos negativos concretos ao DEV2 e exige constraint deferred ou garantia equivalente antes da aplicação da migração. Também faltam validação do preparador e revalidação dos preservados. Migração permanece sem aplicação; estes achados não afetam a migração237 integrada.

18/09/2026 — Ambiente DEV2: integrador executou SQL238 dentro de BEGIN/ROLLBACK no banco dev-gravacoes, saída0; objetos foram revertidos e a migração NÃO foi aplicada. Evidência limitada à criação/sintaxe, não aos ramos dos triggers. Prisma generate no worktree9ac1 concluído, sessão58161 saída0, liberando cliente tipado para os novos modelos. TESTER confirmou a sessão15599 ativa no próprio executor após observação de60s; o handle não é acessível pelo executor do root, sem motivo para reiniciar a suíte.

18/09/2026 — Prisma DEV1 gerado pelo integrador, sessão69349 saída0, sem aplicar239. Revisão Q165 reproduziu arredondamento indevido: total0,05 rateado50/50 resultava0,03+0,03=0,06; correção encaminhada ao DEV1 com conferência exata do conjunto contratual. DEV2: TS64887 falhou com4datas possivelmente nulas; corrigidas com guarda explícita36895ed. Nova checagem TypeScript do integrador terminou com saída0. Esses resultados não comprovam conclusão dos fluxos Q165/Q168/Q169.

18/09/2026 — Integração do fundamento Q165: commits177a12c8/22e9c912 incluem regra contratual com alcance/rateio e cálculo preservando total e quotas zero. Principal17/17 testes em3arquivos (desistência contratual, encerramento cálculo/multa), saída0; TypeScript sessão87042 saída0. Não integra SQL239 nem serviço de aplicação. Coordenação atual: dev2_cobertura_testes assume9ac1 para testes reais de cobertura; mapear_cobertura_aditivo foi reatribuído exclusivamente ao erp-dev-email para implementar preparação Q165, preservando WIP anterior. TESTER permanece no snapshot congelado. Duas frentes de implementação mantidas.

18/09/2026 — Integrador implementou projeção de prova por campo para Q168: conjuntoCoberturaCompletoId próprio reconhece início/fim, preserva herança e exige prova nova em reafirmação explícita; não libera taxa pendente. Unitário aditivo-aplicacao-campos14/14 saída0 e TypeScript4208 saída0. Consulta transacional ainda não fornece a prova até integrar modelos/guards238, portanto esta fundação não marca cobertura entregue. Arquivos reservados no root para evitar conflito com DEV2.

18/09/2026 — Cálculo Q165 agora deduz créditos já apurados da liquidação disponível, preservando recebimentos originais e discriminando crédito anterior/liquidação líquida. Teste cobre crédito parcial, repetição sem novo excedente, saldo devedor após extração anterior e crédito inválido. Recorte Q165+acertoTaxa16/16 em2arquivos e TypeScript saída0. Serviço ainda precisa agregar origens do banco e preencher valorCreditoJaApurado; não presumir integração financeira completa.

18/09/2026 — Regressão unitária completa do principal edbf869:1618/1618 testes em262arquivos, zero falhas/ignorados, saída0; relatório node_modules/.cache/unitarios-edbf869.json. Inclui cálculo Q165 líquido e prova por campo de cobertura; não inclui serviços/SQL ainda nos worktrees dos DEVs. DEV2 entregou37764a4 com cenários reais de obsolescência, servidor/SQL eTSsaída0; execução no banco depende da revisão/aplicação238. Global integrada do TESTER continua separada.

18/09/2026 — Revisão documental Q169: escolha de ciclo consta em entrada do snapshot DEV2, mas não é renderizada em ADITIVO_ALTERACOES por aditivo-texto.ts; a projeção tenta ler campo na raiz que prepararAditivoContratualTx não cria. Necessário incluir a política no texto destinado à assinatura e na revisão, com testes de correspondência, antes de declarar formalização funcional. Testes reais37764a4 revisados; aguardam SQL238 consolidado e execução no banco isolado.

18/09/2026 — Q169 documental integrado no principal: schema exige política na alteração de cobertura e valida data civil real; texto do aditivo apresenta preservar/mudar, referência e data; contexto preserva a política para revisão e hash do documento. Ausência em aditivos sem cobertura mantém texto anterior. Unitários completos1621/1621 em262arquivos, zeroignorados, saída0 (unitarios-q169-documento.json); TypeScript60385 saída0. Ainda falta homologação integrada de assinatura/consumo e fluxo de cobertura238, sem declaração de entrega completa.

18/09/2026 — SQL238 consolidado2e43c1d aplicado pelo integrador no dev-gravacoes, saída0/chunk9ffd01. Migration238 agora imutável; corretiva240 reservadaDEV2 se necessária. DEV2 autorizado a executar somente recorteQ168 no banco isolado, acompanhando handleterminal. PrincipalUI: formulário de aditivo oferece escolha explícita preservar/mudar referência, data e inclusão no payload/idempotência apenas ao alterar cobertura; TypeScript5831 saída0. Verificação visual/callback ainda pendente; demais fluxosQ168/Q169 não declarados completos.

18/09/2026 — Formulário Q169:3testes de callbacks aprovados, saída0, verificando política/data no payload e identidade da tentativa, bloqueio de escolha ausente/data impossível, chave nova após mudança de conteúdo e ausência de política em aditivo sem cobertura. TypeScript saída0. Testes exercitam submit com hooks simulados; não equivalem à homologação visual no navegador.

18/09/2026 — Integrador validou criação do DDL239 em BEGIN/ROLLBACK no dev-email, saída0/chunk43063f, sem aplicar migração ou alterar dados. Prova limitada à criaçãoobjetos, não execução dos guards. DEV1fa69a57 preserva fotografia completa e nega ativadaEm;3testes da ação informados aprovados (matrícula ativa, documento não aceito e pedido obsoleto). Próximo recorte delegado: decisão financeira independente, com revalidação e replay estrito. Q165 ainda incompleta.

18/09/2026 — Q168 conjunto cobertura integrado seletivamente de cb63a59, preservando237 e regressõesQ170 do principal. SQL238 aplicado na integração saída0/chunk164e80; Prisma55435 saída0. RecorteQ168principal19896 saída0 (q168-integrado.json), TypeScript61213 saída0. DEV2 prepara interfacefinanceira/consulta; ligação da prova por campo e consumidor de continuidade ainda pendentes. Migração239 não aplicada.

18/09/2026 — Consulta da cadeia contratual ligada à prova completaQ168: confere versão/proposta, hash formalizado, política, decisão independente e todas as aplicações afetadas, sem presumir conclusão por aprovação. Teste integrado de antes/depois da aplicação1/1 aprovado,37foraFiltro, saída0/chunk6de089; TypeScript69394 saída0. Mantém prova histórica sem comparar a cobrança corrente que pode sofrer acertos posteriores. UI/continuidadeQ169 ainda em desenvolvimento.

18/09/2026 — Seletor Q169 normaliza MES_CIVIL para RegraCoberturaSchema estrito, evitando carregar dataReferencia indevida no planejador. Valida data civil, recusa vigência ambígua e prova ausente; preserva referência anterior ao escolher PRESERVAR. Recorte seletor+cobertura12/12 em2arquivos, saída0; TypeScript saída0. Seletor ainda não conectado à emissão: faltam leitura temporal das provas e precedência com retomada/recomposição.

18/09/2026 — Q168: decisão repetida exige o mesmo motivo, preservando a justificativa auditada. Aprovação reconsulta todas as mensalidades da matrícula e recusa cobrança surgida após preparo. Integração dirigida 2/2,38 fora do filtro, sessão25752 saída0; TypeScript sessão63075 saída0. Consulta/UI DEV2 em revisão de permissão direta antes de integração.

18/09/2026 — Q168: limites novos de cobertura agora usam validação de data civil real; datas como29/02 em ano não bissexto e31/04 são recusadas antes de conversão, impedindo normalização silenciosa para outro mês. Testes de schema6/6,zero ignorados,saída0.

18/09/2026 — Global independente finalizada: sessão15599 saída0; relatório erp-tester/node_modules/.cache/global-c9934f9.json conferido pelo integrador:1551/1551 testes,263 suítes,160 arquivos,zero falhas/pendentes,success:true. Checkout c9934f91/DB237 preservados. Não cobre commits posteriores nem implica100% daSPEC.

18/09/2026 — Q169 planejador de transição por aditivo: aceita cobertura anterior corrigida, usa referência futura explícita, exige contiguidade sem sobreposição e preserva memória da origem. Mês civil/ciclo e fevereiro verificados;27/27 testes de planejamento,zero ignorados,saída0. TypeScript saída0 após adaptar apresentação das duas origens. Conexão com prova transacional e emissão ainda pendente. Q165 noDEV1:736951e unifica fotografia de preparo/decisão;10testes em3arquivos eTypeScript saída0. SQL239 continua não aplicada até alinhamento da fotografia no banco.
18/09/2026 — Q168/Q169 operação financeira de cobertura: consulta, paginação e rotas exigem Financeiro/Admin com usuário e papéis atuais antes de carregar dados; não há acesso de Secretaria. A interface impede novo preparo com conjunto ativo e revisa política assinada, motivo, evidência e coberturas anterior/proposta antes das operações. Integração dirigida Q168 12/12 (26 fora do filtro), sessão30630 saída0; callbacks, SSR e consulta 10/10, TypeScript saída0. Recortes dirigidos, sem regressão global ou ensaio visual.

18/09/2026 — UI cobertura integrada em5c9f456/2bfcd6c: consulta financeira restrita também em chamada direta, paginação no banco, ausência/erro separados e preparo oculto para conjunto ativo. Principal10/10 UI/consulta saída0; Q16814/14,29fora do filtro,sessão79797 saída0; TypeScript saída0. Auditoria independente5ffd646 encontrouP1: efeitos não vinculados aos limites assinados e ausência de validação de sobreposição/lacuna nova. TESTERc426352 reproduziu3/3 negativas falhando por aceitação indevida,40fora do filtro,saída1 noDB238. Correção240 reservada ao integrador;238 imutável. Fluxo não concluído. DEV2 continua conexãoQ169 à emissão em base2bfcd6c.

18/09/2026 — Correção Q168 integrada:240 aplicada somente no banco descartável de integração,agora imutável; Node e SQL vinculam conjunto ao intervalo assinado e recusam sobreposição/lacuna nova. RecorteQ16817/17,29fora do filtro,sessão53241 saída0,incluindo3regressões vermelhas doTESTER agora verdes. Política/intervalos6/6 eTypeScript saída0. Fixture com mensalidade preservada foi corrigida para dezembro: a antiga preservava novembro e criava sobreposição indevida no próprio caminho positivo. Revisão SQL independente240 pendente; E2E Q169 ainda comDEV2.

18/09/2026 — Q168 recuperação de preparo após aplicação: chave idempotente compara solicitação com a fotografia original antes de consultar estado financeiro posterior. Repetição idêntica recupera o conjunto sem criar outro; mudança de motivo/dados permanece recusada. Integração1/1,46fora do filtro,saída0;TypeScript saída0. TESTERnova tarefaSQL240 usa fotografia/IDs completos; E2EQ169 continua comDEV2, sem considerar simples testeQ168 como prova de emissão.

18/09/2026 — Build local da base b6eb3f2 concluído: sessão51177 saída0, compilação Next, TypeScript e85 páginas estáticas geradas; rotas financeiras de cobertura incluídas. Não corresponde a deploy nem valida consumidorQ169ainda noDEV. DEV1_SQL239 corrigiu fotografia completa em5858b620 e agora implementa validação contratual/cálculo SQL antes da aplicação;239permanece não aplicada. TESTERSQL240monta prova negativa comconjuntointeiro; DEV2_EMISSAO_E2Eencadeia assinatura/acerto/condições/oferta/emissão.

18/09/2026 — Regressão unitária da base cad6cdf:1653/1653 testes em271arquivos,zero falhas/ignorados,saída0,relatório node_modules/.cache/unitarios-cad6cdf.json. TESTER8d1ac8fe trouxe cópiaSQLintegral comfotografia/hash/IDscoerentes: caso válido comita e sobreposição nova falha especificamente na240. Integrador repetiu2/2,47fora do filtro,sessão84211 saída0. Caso SQL de limiteassinado ainda comTESTER. DEV1239validada novamente emDDLtransacionalrollback:6cálculos(incluindoquota zero)+regraincompleta recusada,saída0;commit451b665consolidou schema eíndice,preparação doambienteDEVemcurso.

18/09/2026 — Q165 ambiente DEV-email atualizado pelo integrador: schema451b665 validado,clientgerado e239aplicada,sessão88438 saída0.239imutável;241reservadaDEV1 para conexão/guardas de aplicação eefetivaçãoQ121. DDL/cálculo foram previamente exercitados comROLLBACK (6cálculos+regraincompleta),mas isso não substitui integração preparo/decisão com fotografiaNodeSQL. Essa validação e aplicaçãofinanceira continuam comDEV1;principal ainda sem239.

18/09/2026 — Integrado teste independente 45a43d96: SQL240 rejeita conjunto completo cujo intervalo não corresponde ao aditivo assinado, preservando fotografia/hash coerentes. Integração principal: dois negativos 2/2, 48 fora do filtro, sessão32903 saída0; positivo 1/1, 49 fora do filtro, saída0. Q167C conferida na SPEC: decisão registrada; implementação permanece pendente, com levantamento dos consumidores pelo TESTER enquanto DEV1/DEV2 concluem as duas frentes atuais.

18/09/2026 — Auditoria de preparação Q167 (somente leitura): encerramento-contexto-tx, desistencia-acerto-contratual-calculo e ajustes/acoes mantêm bloqueios conservadores para permuta. Ao implementar, separar excedente de serviço do creditoApurado comum: encerramento-aplicar-creditos cria crédito financeiro e não deve absorver permuta por simples soma no liquidado. Exigir cadeia AplicacaoCompensacaoPermuta → Destino → Proposta → Confirmação → Acordo, concordância, decisão independente, fotografia atual e controle cumulativo da origem. Destinação negociada ainda não implementada; terceira frente não iniciada.

18/09/2026 — Consumidor de prova contratual confere intervalos de conjuntos completos contra o aditivo assinado, incluindo sobreposição. Recorte Q168 21/21, 29 fora do filtro; sessão28504 terminou saída1 por tipo JsonValue nullable na fixture SQL, corrigido com guarda explícita. TypeScript posterior saída0 (2eb0b4); unitários do consumidor 3/3 saída0 (a023ac). Migração241 DEV1 ainda não aplicada: revisão detectou chamada direta inválida de função TRIGGER, devolvida para correção antes de testar Q165/Q121.

18/09/2026 — Confirmação após ajuste de tipo da fixture: aplicação real consumida pela cadeia e cópia SQL íntegra 2/2, 48 fora do filtro, sessão15348 saída0. DEV2 entregou54d2f005 com ensaio de emissão; revisão e integração principal ainda pendentes.

18/09/2026 — Integrado recorte de54d2f005/99df1b2/2a67b5f: consumidor Q169, regra vigente após retomada e prova completa de cobertura no resolvedor mensal. Preservadas proteções e testes posteriores do integrador. Unitários45/45 em5arquivos saída0; E2E emissão real PRESERVAR/MUDAR2/2,50fora do filtro, sessão34482 saída0; TypeScript1423 saída0. Pendente correção DEV2 para cadeia de dois ou mais aditivos após recomposição (findFirst único não atende). Q168/Q169 ainda não marcadas completas.

18/09/2026 — Revisão TESTER013e48b aprovada: E2E2/2(50fora),45unitários,saídas0. Integrada sucessão de57e6ec4: percorre aplicações Q168 completas após recomposição, compara intervalos/versões e estado final, suporta dois aditivos. Root13/13unitários+TypeScript saída0(7569d1); regressão fila/emissãoSQL8/8 em2arquivos,sessão41558 saída0; unitários114/114 em18arquivos antes dessa sucessão. Q241 aplicada somenteDEV-email,d0cb15 saída0; imutável,242reservadaDEV1 se necessário. Q165 ainda aguarda execução real e interface. Q168/Q169 aguardam homologação visual e regressão integrada final.

18/09/2026 — Build principal emfdd67a3: sessão58413 saída0,85páginas. BaseQ165edd44c6b incorporada no working tree para revisão, preservando schemaQ168; Prisma validado com perfil integracao e client gerado, sem aplicar239/241 no banco principal. Revisão achou ramo Q165 sem exigência de decisão administrativa Q121 e sem conferência das solicitações de assinatura abertas; DEV1 corrige242 antes de aceite. Homologação visual Q168: servidor tester sessão65403 porta3018, ambiente só de teste e sem credenciais externas, fixture preparada pelo TESTER; não rodar testes concorrentes nesse banco.

18/09/2026 — TESTER homologou Q168/Q169 via navegador CUA em3018/perfiltester: Secretaria redirecionada a acesso-negado; Financeiro preparador viu lista/detalhe e não teve autoaprovação; outroFinanceiro aprovou/aplicou; tela COMPLETO mostrou afetada outubro→novembro aplicada, dezembro preservada sem aplicação. Servidor65403 encerrado pelo integrador após homologação (CtrlC, saída1 esperada de interrupção). BaseQ165: replay da preparação corrigido no root, preserva pedido/condições/motivo e autorização atual, sem recalcular após efeitos aplicados;41unitários/10arquivos+TS0(1fd167). DEV1 informado para incorporar enquanto finaliza242. Base permanece sem migração principal até correção da aprovação administrativa.

18/09/2026 — Q171 apresentada para delimitar destinos executáveis da negociação Q167: saldo restrito a serviços, crédito financeiro ou ambos explicitamente negociados. Sem resposta presumida; Q167C continua aprovada e nenhuma conversão automática foi autorizada. A dúvida não bloqueia DEV1Q165/242 nem DEV2ensaio combinadoQ168/Q169. TESTER audita consumidores de crédito da nova origemQ165.

18/09/2026 — BaseQ165 em integração: consulta/tela de crédito agora apresentam origem da desistência, aplicação, decisão e cobrança, separando valor original do saldo;3testes de consulta aprovados(8322cb),TS0(b6ab72). Alterações aguardam integração da base239/241/242. Teste DEV2d116ac2 incorporado: recomposição real→dois aditivos→emissão idempotente; execução independente solicitada ao TESTER antes do aceite. DEV2 passa ao desenho técnico Q167, sem presumir respostaQ171 ou prioridade de fontes mistas.

18/09/2026 — Migrações239/241/242 aplicadas no banco descartável principal (6933f1 saída0),242 tambémDEV-email (a9958b saída0). TypeScript principal9c69b3 saída0. IntegraçãoQ165 principal74760 saída1:3/6passaram;2positivos bloqueados pela trigger211 de destinação de recebimento e1negativo bloqueado antes do ponto-alvo por fixture de assinatura direta. DEV1 reproduziu3/6e corrige243 mantendo242imutável; não considerar Q165validado. TESTERexecuta arquivo completo taxa/cobertura53casos no bancoisolado; DEV2implementa calculador puroQ167 sem liberar qualquer destinação pendenteQ171.

18/09/2026 — Aceite localQ168/Q169: TESTERb8ac3a80 arquivo completoaditivo-acerto-taxa53/53,saída0,duração215,57s. Cobertura inclui assinaturas/alçadas, conjunto completo, correção iniciada/paga, política preservar/mudar, recomposição comdoisaditivos, emissão/replay, restrições SQL, autorização e visual Financeiro/Secretaria. AtualizadaSPEC sem afirmar aceiteglobal ou cobertura das migraçõesQ165posteriores.

18/09/2026 — Q167 calculador 72a2576+48ec3dc integrado: revisão corrigiu fonte mista totalmente reduzida (caixa200+permuta100: redução300, excedente serviço100). Principal11/11 saída0 (972547), TypeScript saída0 (3c5a67). Nenhum consumidor ou destino liberado. Q165/243 aplicada também no principal (241fb5); integração82002 terminou4/7,saída1 (3cac1a): coluna SQL incorreta e fixture de assinatura falhando antes do alvo. DEV1 corrige244, incluindo mutação financeira pós-aplicação e segunda aplicação no mesmo pedido identificadas pelo TESTER.

18/09/2026 — Revisão Q165: novos testes de aplicação verificam replay sem efeitos repetidos, usuário inativo, papel/alçada revogados, executor diferente do aprovador e chave vinculada a outra decisão. Principal6/6 (348adc), TypeScript0 (3fa58c). Arquivo aguarda commit conjunto da implementação Q165; estes testes não substituem a integração ainda reprovada. TESTER passa à matriz independente do cálculo Q167; DEV2 prepara fontes reais sem escolher destinos pendentes.

18/09/2026 — TESTER5a192e9 acrescentou matriz independente Q167 com625 combinações de fontes/devido e distribuições múltiplas. Integrador corrigiu tipagem do teste (discriminação da união e Decimal.Value);14/14 em2arquivos (b4e16a) e TypeScript (e5b45c), ambos saída0. Este aceite é do cálculo, não da destinação operacional. DEV1 prepara244; nenhuma nova integração Q165 aprovada ainda.

18/09/2026 — Revisão em curso244: além de preservar fontes pós-aplicação, a unicidade deve valer também no ato de aplicar, inclusive propostas previamente existentes. Fato financeiro posterior precisa de reconferência operacional resolvível, sem reaplicar o acerto original; bloqueio isolado não fecha aceiteQ165. CarregadorQ167 em desenvolvimento deve considerar também origemCreditoAcertoDesistenciaContratual antes de liberar fontes já creditadas. Isolamento do TESTER corrigido:5a192e9 foi executado por engano no root e está identificado como tal, não comprova execução em worktree independente; próximo recorte usará erp-tester explicitamente.

18/09/2026 — Q165c4b6bcac:244 aplicada somente DEV-email (0ecd70 saída0), interface/consulta importadas no principal em revisão. Novo teste de página cobre erro da consulta contratual e origem do crédito sem reaplicar:5/5 (10fbcc),TypeScript0(f33c82). DEV identificou divergência de fuso na funçãoQ242 durante integração;245reservada exclusivamenteDEV1. Resultado integrado completo ainda não aprovado; não confundir renderização com homologação do fluxo.

18/09/2026 —245 aplicadaDEVemail (8e3f49 saída0);244/245 aplicadas principal (1c742b saída0). Q165principal sessão15065 terminou8/10,saída1 (02e104): expectativa antiga permite nova proposta pósaplicação e fixture assinatura aberta falha antes do alvo; DEVcorrige. Q167carregador4b5717d importado e ampliado para origemQ165:6unitários (94d81b),1integração real (265a1c),TypeScript (83617f),todos0. Tentativa anterior de integração (d77092) foi bloqueada por migração local pendente, resolvida por deploy explícito. Carregador permanece sem aplicação financeira; proposta/destinaçãoQ167 ainda pendentes.

18/09/2026 — RevisãoQ165/Q105 revelou lacuna funcional: contexto atual exige contratoOk/conclusão de assinatura e deixa fora taxa paga antes de assinar. O cenário não será removido nem receberá aceite fictício para passar. DEV1 analisa ajuste246 (ID reservado) para condições estruturadas vinculadas/conferidas na preparação e cancelamento externo comprovado antesefetivação. Cobertura atual8/10 continua insuficiente para aceite completo.

18/09/2026 — Q167c67fada integrado preservando extensãoQ165: informes A_CONFERIR e propostas de crédito sem decisão geram pendência, sem entrar nas fontes liquidadas;7unitários(ced710),2integrações(45c4bb),TS0(0565a5). Q165c7fc843 guard Node importado; ajuste do mock de aplicaçãoexistente mantém9/9unitários(442b68).246autorizada para fonte ArtefatoContratual antesaceite; não confundir ativação(comaceite) com desistência(cancelamento comprovado deenvio, sem fabricarassinatura).

18/09/2026 — Build local do estado integrado atual concluído: sessão68154,saída0(1efad2),85páginas geradas. Inclui UIQ165 e carregadorQ167; não comprova aceite dos fluxos ainda pendentes. Q171 reapresentada no seletor para delimitar destinos negociáveis, sem resposta presumida. DEV1continua246 e contratos pré-aceite; permuta não gera efeitos até definição e implementação dos destinos.

18/09/2026 — Regressão unitária completa no principal ffb3fb5:1706/1706 testes em282arquivos,saída0(3da1b9),sem testes de integração. Teste independente consultaQ165 ad84cca revisado: mock de revisão posterior bloqueava todos os cenários; corrigido para zero e incluído controle positivo das duas decisões vigentes. Principal6/6(3b4db1),TS0(9e1c92). ClientDEV246gerado36625saída0(64fab7); migração246 ainda nãoaplicada.

18/09/2026 — 246 integrada em f93c9c1. Deploy DEV-email d52e3d e principal d85c17, ambos saída0; cliente principal e1ff72 saída0. Consulta financeira passou a aceitar fonte pré-assinatura validada pela função SQL, mantendo bloqueio para fonte inválida:8/8 unitários495519 e TypeScript414c56,saída0. O cancelamento Q121 novo ainda só tem consumidores de teste; falta conectar ação/adaptador/interface. Nenhum aceite integral Q165 declarado.

18/09/2026 — Guard administrativo Q165: teste positivo de aplicação nova e negativos para decisão ausente/rejeitada/obsoleta/própria e admin inativo/sem papel.13/13 no arquivo9eb293 e TypeScript2105d5,saída0. Auditoria independente246 não encontrou bypass concreto, mas confirmou falta de consumidor operacional do cancelamento. Regressão DEV1 substituição19/21 revelou bloqueio indevido de retorno externo concorrente;247 reservada para correção,246 preservada. Testes UI entregues pelo DEV2 são SSR; alcance completo e submissão continuam em implementação.

18/09/2026 — UI24691926b57+bde32c9 integrada902b1bb/c15739e5,14/14 testes SSR/parser19d685 e TS60a696,saída0; ainda não é homologação browser.247f15a4b4 integrada812b31a9,aplicada DEV-email2a0942 e principal57bb5f. Corrige retorno de assinatura e aliasSQL p.* ambíguo: regressão anterior69242 terminou18/24+erro,68d777saída1; após correção efetivação48097 terminou11/11,b21372saída0. DEV2 ambiente atualizado ao principal,clienteadb010 e deployba1a8dsaída0;248 reservada para reapresentação. Ação de observação de cancelamento está sob correção para não aceitar confirmação arbitrária do cliente; não declarar operacional antes de adaptador validado.

18/09/2026 — Ação insegura de observação foi removida em19d1c84: cliente não pode informar CONFIRMADO/hash como prova de fornecedor. Q155 continua pendente e foi reapresentada; cancelamento externo não é operacional sem adaptador autenticado. DEV1validouQ16510/10bfe4e7,substituição21/21sessão98055/4516eb e TS28e657,saída0. Principal regressão unitária completa1735/1735 em286arquivos57a2a1saída0 (não inclui integrações). Acrescentado acesso ao PDF preservado na conferência das condições; testeSSR3/3,37a55f.248(em revisão) trata reapresentação;249 reservada para reconferência financeira incremental, ainda não implementada.

18/09/2026 — TESTER atualizado para4fcecde6 preservando cópiasanteriores emstash integrador-preserva-copias-tester-antes-248 e branchcodex/tester-consulta-q165-preservada. Cliente75db9d e deployaté247be357e,saída0. Validaçãoindependente acerto10/10(9a6019) e efetivação11/11(31ae3e),saída0. Buildprincipal45735/7f30c8saída0,85páginas.248revisada antesapply: backfill protege imutabilidade,nomeconstraintcorrigido,memória vinculada à cadeia; hash87D769F57A403E89ECE09695FC861363ACBF77B9CD2956B1C3967C495E412434 aplicado sóDEV2(1f55c5),cliente0f278a,saída0. Código/UI/testes248 ainda emdesenvolvimento;249WIP nãoaplicada.

18/09/2026 — Calculador incremental249 revisto pelo integrador: remove suposiçãoBRL, valida moeda contra obrigação, separa alvos/ajustes e não reabre saldo por crédito jáapurado. Informe rejeitado não apaga recebimento real; crédito semdestino não é rateado implicitamente.14/14 testesprincipal a6936e e TypeScript ef8eda,saída0. Somente cálculo puro integrado, sem consumidor/SQL249 aplicado. Auditoria independente249 encontrou XORorigens, vínculo de origens/efeitos, revalidaçãofotografia, cadeia e aceitação naefetivação ainda incompletos; DEV1corrige. Não declarar reconferência operacional.

18/09/2026 — Revisão249: o teste de fontes f6c754 exercitava apenas o calculador, sem chamar o carregador; não serve como evidência de integração das fontes. WIP preservado e execução transferida a DEV1Terra com tarefa explícita de reescrita/teste do loader. Apenas calculador puro c4946c1 está integrado. Origem por cobrança, créditosdelta e reconhecimento semdestino ainda precisam de prova no carregamento real.

18/09/2026 —248 integrada de875132f4 embf28e7d,preservando correção19d1c84 que remove confirmação arbitrária cliente. Client3005b5 e deployprincipalace69fsaída0. ArquivocompletoQ16512/12integrações sessão31376/7d453d e TypeScript99506/747d1e,saída0. Regressão unitária principal1752/1752em288arquivos75e528saída0; não inclui integrações. DEV2homologa fluxo operacional, incluindo resolução de Q121obsoleta após fato novo.249segueemimplementação semapply.

18/09/2026 — Preservação da migração248 ensaiada no banco descartáveltester: baseline247 executouQ16510/10(session78882/1c4458 saída0), deixando1proposta e1recebimento. Snapshotcanônico/hash antes(be09cc) e depois(3f5e14) idênticos para todoscamposanteriores, excetuando apenas os3novoscamposdaProposta; decisões/aplicações/créditos estavamvazios nesseensaio. Deploy2484b3112saída0, semalteração dosregistroscomparados. Não extrapolar para preservação de cenáriosfinanceiros ausentes nessa base.

18/09/2026 — Reconferência249: integrador acrescentou matriz de48 combinações de obrigação, pagamento anterior e recebimento adicional, conferindo saldo/crédito e repetição após aplicação sem novo efeito. Recorte do cálculo15/15, saída0 (42dae1). Evidência de aritmética e idempotência do cálculo; migração, fluxo operacional e concorrência249 ainda pendentes.

18/09/2026 — Ambiente DEV-email alinhado às migrações238/240/248 (4359b9, saída0), preservando WIP249; schema combinado validado89f113 e cliente gerado na sessão5624/b88fac, saída0.249 continua não aplicada. Homologação browser248 confirmou preparação pela Secretaria e aprovação administrativa independente; encontrou bloqueio Next no reexport de função em arquivo use server, correção atribuída ao DEV2. Não considerar fluxo financeiro homologado antes de corrigir e repetir.

18/09/2026 — Correção Next248 integrada em14d08445: wrapper async substitui reexport incompatível com use server. Build do principal sessão54606 terminou saída0 (6ffb20),85páginas; recorte consulta/decisão/replay15/15 (eb26aa),saída0. Homologação operacional continua: novo fato após proposta aprovada precisa de novo pedido e decisão Q121 atual, sem reaproveitar aprovação anterior. Revisão249 encontrou incompatibilidade entre proposta pendente e trigger que exigia efeitos aplicáveis; DEV corrigindo antes de migração.

18/09/2026 — Revisão operacional248 identificou proteção insuficiente entre pedidos Q121: aplicação base conferia somente a última proposta do mesmo pedido, permitindo tentar aplicar pedido superado. DEV2 autorizado a corrigir consumidor de aplicação e guard SQL; reservado250/20260917175000_pedido_vigente_acerto_desistencia, sem alterar248 já aplicada. Exigir pedido vigente e impedir duas aplicações base por matrícula, com testes Node/SQL. DEV1 mantém249, sem sobreposição de arquivos.

18/09/2026 —250 aplicada exclusivamente no dev-gravacoes (769215, saída0), hashD608C1D8715EBAE5AB531316F983A33B14E2F63B18E97DF5EBDAE1289DAFCED3. Guarda pedido vigente/aplicação única por matrícula; Node alinhado à ordem Matricula→proposta. Runtime53106 encerrado antes da suíte do DEV2.249 teve ensaio DDL transacional no TESTER com rollback (ec86b2, saída0, snapshot0670cc25f5ba669548470a1518f2c0b59e2eb02d721ba7512319720ffe92a324); não aplicada, ainda em revisão de fotografia dos créditos externos e testes de efeitos.

18/09/2026 —249 aplicada somente dev-email (413157, saída0), hashAEDF765AF695C59806D4926822837CD925413A5673B7CEFD7971587333B920B4; testes reais e tela em desenvolvimento. No dev-gravacoes, catálogo mostrou guarda antiga antes da nova250; corretiva251 renomeia a guarda para executar primeiro e manter lock Matricula→proposta.251 aplicada2b3a23 e ordem BEFORE confirmada991abc, saídas0.250/251 copiadas ao principal, ainda sem deploy neste banco; suíte Node/SQL e concorrência do DEV2 pendente. Não há aceite integral antecipado.

18/09/2026 — Integrador acrescentou teste independente de compatibilidade Q121: simula seleção Prisma com novas origens null e compara fotografia inteira/hash com formato persistido anterior. Passou1/1 no principal (2a6fa5) e1/1 no WIP249 do DEV-email (f19d52), saídas0. Isso cobre preservação de decisões sem mudança financeira, não os efeitos delta. DEV2 reportou14/14 integrações250/251 e TypeScript0; aguardando commit para repetir no principal.

18/09/2026 — Integrado DEV2/10028f4: pedido vigente e aplicação única por matrícula no Node e SQL250/251; fato novo depois de memória aprovada orienta novo pedido/memória/Q121. DEV2: arquivo completo14/14 (74018),29unitários e TS66857, saídas0. Browser local cobriu condições pré-aceite, aprovação independente, rejeição/reapresentação e alçada; fixture opt-in preservada. Repetição no principal pendente.

18/09/2026 — Principal961721e:250/251 aplicadas (045450); arquivo completoQ16514/14, sessão22570/21469b, saída0; TypeScript054b41 saída0. DEV2 passa à revisão independente249, enquanto DEV1 prepara prova ponta a ponta no dev-email. Banco principal não possui249; aprovação destes recortes não fecha reconferência nem assinatura externa.

18/09/2026 — Build principal após250/251 concluiu saída0, sessão43529/316f85,85páginas. Primeira integração249 falhou42702 por alias/variável ambíguos; corretiva252 aplicada somente DEV-email (078b6a, saída0), hash3BA81156257D6B9B1C7242E507B4EEB66715B3904BC78DDBEC7488DC1D33ACA5. DEV1 reportou cenário real1/1 com baseQ165 aplicada, crédito externo posterior, preparo/duas decisões/aplicação delta e efetivação pela APIQ121/base original. Ainda faltam negativos, crédito incremental por cobrança, repetição e revisão independente;249/252 não integradas ao principal.

18/09/2026 — CompatibilidadeQ121 ampliada para origem de crédito por taxa de aditivo já preenchida antes249: principal2/2 (4a6439); WIP249 falhou1/2 (af843e, saída1), pois serializa campo anteriormente omitido e muda hash sem fato financeiro novo. DEV1 corrigindo enriquecimento apenas na fotografia249. Revisão independente também exige revalidar créditos/saldos e alçadas do delta na efetivação; corretiva253 reservada, ainda não aplicada.

18/09/2026 — Divisão coordenada249: DEV1 mantém actions/loader/253/testes reais; DEV2 assume consulta e interface próprias, mostrando motivos de decisão, créditos externos e orientação de pendência, sem alterar backend. Snapshot249/schema copiado ao worktree9ac1; cliente16473/367fba saída0;249/252 aplicadas no dev-gravacoes (eacffb, saída0), preservando250/251. Backend permanece WIP, com correções de replay, fotografia posterior e alçadas na253 ainda pendentes. Cópias de ambiente não equivalem a integração principal.

18/09/2026 — Compatibilidade corrigida no DEV-email: fotografiaQ121 preserva origemTaxa omitida; enriquecimento fica no loader249. Recorte independente compatibilidade/fontes7/7 (2ae078),saída0.253 reprovou primeiro ensaio sintático42601 (4e4a14), sem aplicação; versão corrigida passou ensaio transacional70c83a e foi aplicada somente dev-email6cdd86, saídas0, hashF977F96784993CCE49BEF0B10115AED153EF64A75E6C40D36B9419EE801CC6B6. Exige reconhecimento de créditos externos, fotografia vigente, alçadas atuais e saldo intacto de crédito criado pela própria delta. Testes reais desses guardas ainda em execução pelo DEV; não declarar aceite por DDL aprovado.

18/09/2026 — Reconferência integrada: backend ed335b9f, interface 53ddf0b9 e schema 7baa4ca. Migrações249/252/253 aplicadas no banco integracao (59d3dc); Prisma validado e cliente gerado. Recorte integrado acerto+delta18/18, sessão64991/9ae9c5, saída0; unitários dirigidos34/34 em6arquivos08f246 e TypeScript62294/3f3ac6 saída0. Não é regressão global. DEV1 amplia negativos SQL/alçadas; DEV2 corrige caminho de nova preparação após pendência resolvida ou fotografia obsoleta, encontrado pelo integrador. Q167C já registrada, destinos executáveis ainda aguardam Q171; nenhum crédito em dinheiro presumido.

18/09/2026 — Build do conjunto integrado c7ca441 concluído: Next build, sessão14608/8dd408, saída0,85 páginas. Não substitui homologação de interface nem os negativos adicionais em desenvolvimento.

18/09/2026 — Integrados abc3726f/37f3e94c e teste independente3686960. Reconferência9/9 integrações reais (44320/261e1f), consulta/interface14/14 e TypeScript(d6d234), saídas0. Fluxo não bloqueia nova preparação após fotografia/cadeia mudar. DEV2 inicia homologação interativa;253 aplicada também dev-gravacoes(bea05e). DEV1 preparado em nova branch3686960, WIP anterior preservado em stash;250251 aplicadas dev-email e client56484/94d28d saída0. Próxima frente: adiantamento por aditivo antes da emissão; alcance sobre emitidos/pagos/utilizados aguarda Q172. Migration254 reservada20260917183000_aditivo_adiantamento, não aplicada.

18/09/2026 — Regressão unitária completa do principal9b99c3c:1770/1770 testes em292arquivos, zero falhas/ignorados, dc1861 saída0. Não inclui integrações. TESTER preparado no commit3686960, banco tester até253 e client4451/e0882d saída0; recorte independente em execução. Runtime local DEV2porta3100/sessão52473 usa somente dev-gravacoes e credenciais sintéticas para homologação Q249; nenhum envio externo.

18/09/2026 — Correção da próxima frente após verificar o percurso real: aditivo de adiantamento anterior à emissão inicial é inalcançável. assinatura-estado.ts exige conferência/emissão antes de enviar o original; aceite-estado.ts revalida; aditivo requer original assinado. DEV1 confirmou e não criou254 nem alterou schema/código. Efeito sobre adiantamento já emitido depende de Q172; não flexibilizar gates para fabricar cenário positivo. Adiantamento opcional permanece permitido quando minutos são informados mesmo sem exigência para ativação. DEV1 passa a levantamento acadêmico somente leitura enquanto aguardamos a decisão.

18/09/2026 — TESTER3686960: acerto14/14(sessão80426/d7c94e), delta9/9(fc299c), efetivação11/11(6e6a74), saídas0. Revisão independente encontrou defeito não detectado pelos testes: aplicação delta atualiza versão de cobrança mesmo sem ajuste, permitindo nova reconferência artificial sem fato novo; DEV2 reproduziu também no navegador. DEV1 corrige antes do aceite, com fotografia posterior imutável se necessária;255 reservada20260917184000_fotografia_posterior_delta, não aplicada. Aprovação dos recortes anteriores não conclui este fluxo.

18/09/2026 — Homologação browser Q249 no DEV2: preparador criou Delta1, tela exibiu crédito externo CRC25, Financeiro/Administração registraram decisões independentes com motivos, Financeiro aplicou. Defeito de novo preparo sem fato novo confirmado no reload. Após fato sintético CRC10, Delta2 foi preparada pela UI, preservando Delta1 e ambos créditos; Delta2 não aplicada. Runtime52473 encerrado por Ctrl-C (af2009, saída1 intencional), sem transporte externo. Correção255 em desenvolvimento preservará foto pós-aplicação e evitará UPDATE de cobrança sem mudança material; ainda não aplicada nem validada.

18/09/2026 — Fixture de homologação Q249 integrada32b00a5d (origem5bf88171), opt-in inicial e fato posterior1/1 cada, TypeScript0 noDEV2.255 em desenvolvimento: campos posteriores nullable na Aplicacao, sem retropreencher legado; clientDEV1(21952/e1c20d) eDEV2(48130/ae3b5e) gerados, saída0, banco ainda sem255. Revisão identificou recuperação necessária após revogação das alçadas: fonte financeira idêntica não pode impedir nova análise independente quando decisões anteriores perderam validade. Servidor/SQL/consulta devem permitir esse caso sem efeitos financeiros artificiais nem retirada das guardas253. Não declarar correção concluída antes de integração e homologação.

18/09/2026 —255 revisada, hashD2C991134F4358CBA70C8B70C5CC38CFD9112D003427299C7EC78B9999EF92FB, ensaioDDL0f6114 saída0 e aplicada somente dev-email692eb3 saída0. Guard de preenchimento usa identidade MVCC da transação, não coincidência de horário. DEV1 relatou11/11 integrações reais e05945 saída0; cenário material ainda em conferência. Ensaio independente de legado: tester3686960/DB253 executou9/9(68860/014603), aplicação pré255 preservada; DDL255 em transação recusou preencher pós-foto atual nessa linha antiga e foi revertida(28e071 saída0). Hash completo antes/depois b1f93e3264615da305bee6413d4417fc2633813ecfb26158a252b1f935d4d6b5 idêntico. Banco tester continua253; nenhuma preservação de todos os demais cenários inferida. UI255cd6e1b14 entregue, aguardando integração conjunta.

18/09/2026 — Correção255 integrada em f0b1c0b0/896c5564: fotografia posterior completa e imutável por aplicação, comparação com estado posterior para impedir reconferência artificial, atualização de cobrança apenas quando valores/status mudam e nova análise quando alçada anterior perde validade. Migração255 aplicada no integracao e tester, clientes gerados, saídas0 (9811/62c6c9 e44432/72cd70). Principal896c5564: acerto14 + delta11 + efetivação11 =36/36 em3arquivos, sessão64124/7667b1, saída0, sem testes ignorados; consulta12/12 (07b8e3), página8/8 (2f3cec), TypeScript46921/7448f8 saída0. O primeiro comando unitário continha caminho (erp) inexistente e executou apenas consulta; página correta (app) foi executada separadamente. Estes resultados não são regressão global. Fixture cobre créditos reais e reconhecimento externo/SEM_EFEITO; não aciona atualização material de cobrança nem novo creditoDelta. Revisão independente e homologação visual posterior à255 ainda pendentes. Q167C preservada: negociar destino com concordância e aprovação por caso; nenhuma conversão automática em dinheiro.

18/09/2026 — TESTER independente em896c5564 aprovou revisão255 sem achado bloqueante: delta11/11 (f5c705) e efetivação11/11 (4bcdc8), saídas0 no perfil tester, execuções sequenciais. Conferiu fotografia posterior contra fontes no trigger diferido, mesma transação dos efeitos e revalidação de alçadas sem afrouxar Q121. Homologação browser pós255 com DEV2 ainda em andamento; não presumir cenários materiais não percorridos.

18/09/2026 — Homologação visual255 no DEV2/896c5564 concluída: fixture sintética1/1 saída0; Financeiro preparou Delta1, outro Financeiro aprovou, Administração aprovou e Financeiro aplicou pela interface. Reload sem fato novo retirou formulário de preparo e mostrou bloqueio explicativo. Novo crédito fictício CRC10 via opt-in1/1 saída0 liberou nova preparação, preservando Delta1 aplicada e créditoCRC25 histórico. Delta2 não foi preparada nesta rodada; alçada revogada não exercitada no navegador, coberta nas suítes. Runtime22299 encerrado por Ctrl-C(71aa84,saída1 intencional). Sem transporte externo. Próximos recortes: homologação Q170 e auditoria de lacunas locais aprovadas, sem presumir decisões pendentes.

18/09/2026 — Regressão unitária do integrado9d63e820:1778/1778 testes em292arquivos,zero falhas/ignorados,saída0(ad650e); relatório local node_modules/.implementation/unitarias-pos255.json conferido(23aab1). Build Next concluído com TypeScript e85páginas, sessão22112/87776e,saída0. Não equivale à regressão global de integração. Fixture opt-in Q1709834016 integrada9d63e820; assinatura explicitamente simulada, sem fornecedor real; homologação visual em andamento. Auditoria Q97 confirmou consumidor operacional de compra antecipada/encerramento já existente; DEV1 amplia somente prova combinada dinheiro+crédito. TESTER amplia CT10 mensal por ações públicas com desconto, multa, crédito e compensação, sem redefinir regras. Q164 reapresentada para resolução do impedimento escolar após segunda chamada posterior; nenhuma opção presumida.

18/09/2026 — Q170 homologada no navegador DEV2/9834016: FIN classificou duas taxas e justificou cada linha, preparou acertoCRC100→CRC80, outro FIN aprovou, vínculo preparado e conjunto aprovado independentemente. Antes da aplicação a tela manteve pendência e conclusão desabilitada. Aplicar acerto preservou recebimentoCRC100 e apurou créditoCRC20; depois a conclusão marcou conjuntoCOMPLETO. TaxaCRC35 permaneceu preservada,PENDENTE,sem recebimento. Cadeia documental da fixture é SIMULADA_LOCAL, não comprova fornecedor de assinatura. Runtime37143 encerradoCtrl-C(76d70e,saída1 intencional), sem envios reais. Fixture eTS0 noDEV; caminho interativo não alterou código.

18/09/2026 — CT10 completo integrado515aae54/2205c34a. Arquivo dedicado encerramento-ct10-completo.int.test.ts aprovado1/1 noTESTER(3ea1c7,TSefc9f0) e no principal(2c6197),saídas0. Ações públicas executam recebimentos, uso de crédito aprovado, compensação, pedido, prévia, decisão e encerramento; preservam integralmente recebimentos/destinações/créditos/propostas e decisões de uso, além de contratoB/cobrança/créditoB. Mensalidade500−desconto100, proporcional15/30, dia compensável e multa80 geram obrigação mensal186,67/saldo56,67 com caixa80+crédito50; multa separada80. Destinação dos dias distingue COMPENSACAO e PROPORCIONAL, sem dupla compensação; replay idêntico. Contrato/condições são setup sintético; não comprova assinatura/emissão real nem Q165.

18/09/2026 — Q97 combinado integrado7500a092/4ddc2a5: compra antecipada quitada com crédito aprovado150+dinheiro150, consumo real de60min e encerramento público concorrente. Compra-alvo gera crédito200 por120min e fonte anterior100 por60min, duas origens legítimas preservadas; não há duplicidade no replay. Comparação integral preserva recebimentos,destinações,compra,crédito prévio,proposta/decisão de uso e outro contrato. DEV1 recorte1/1(fae8e3),TS5785d3,saídas0; principal reforçado1/1(b9591f),TS092b2f,saídas0. Agenda/contrato são fixtures sintéticas; cobertura mensal e permuta não foram introduzidas em Q97. CT03 portal passa à prova integrada da rota HTTP com guard real para contratoA pausado eB ativo, sem transporte real.

18/09/2026 — CT03 vídeo integrado dd0a784c: rotaGET real com autorização/reprodução e Postgres reais; somente sessão sintética e transporte Drive simulados. ContratoA PAUSADA recusa403 antes do Drive, contratoB ATIVA do mesmo aluno responde200 com bytes esperados, ID de outro aluno recusa403 sem chamada adicional. DEV1/1+TS825eb9; principal1/1(06b1eb),saídas0. Não comprova todo CT03 de exportações/mutações nem o Drive real. Auditoria DCT03 confirmou decisões pendentes de moeda/regime: Q173 pergunta alcance somente futuro versus conversão explicitamente aprovada versus nova matrícula; Q174 pergunta transição após cobertura/saldo anterior versus acerto em qualquer data versus nova matrícula. Nenhuma opção presumida; Q172 mantém alcance de adiantamento pendente. Q23: gap docente confirmado; DEV1 implementa proposta de correção de PUBLICACAO_AULA pelo professor ainda vinculado, preservando MATERIAL_REPOSICAO e decisão na gestão.256 reservada20260918100000_correcao_gravacao_docente, ainda não aplicada.

18/09/2026 — Q23/256 revisada e aplicada somente no banco descartável dev-email(4775f0,saída0), hash2A07A4DE66922636B1ACF93DF9E505A26970B3ADE75DD5EBC96C24DF8E1422AF. Substitui a função149 existente, preservando gestão/material e decisão/imutabilidade147; ramo docente exige aula ministrada passada, autoria/diário coerentes e vínculo atual. Datas comparadas explicitamente emUTC. Nenhuma coluna nova; migração aplicada imutável. Backend/tela/testes ainda em desenvolvimento, sem aceite antecipado.

18/09/2026 — Q23 integrada em cbac91a9; db47fe0b preserva bytes da migração256 aplicada. Validação principal: 3/3 integrações docentes aprovadas no recorte79ba29; autorização inicialmente9/10 por mensagem SQL antiga, expectativas ajustadas e nova execução10/10, sessão86246/763a6e, saída0. Unitários/SSR5/5 e TypeScript saída0 (05d321). Revisão independente em curso no TESTER db47fe0b, migração256 aplicada saída0 cb428b. Q167C reconfirmada pelo usuário: concordância das partes e proposta específica aprovada por caso; destinos operacionais Q171 ainda sem resposta, sem conversão monetária presumida.

18/09/2026 — Q23 revisão independente final38d169a9: docente3/3 (26a67a), autorização10/10 (940d49), unitários/SSR5/5 (7b8465), TypeScript0 (860a91). Complemento particular17f353f0, integrado f9399dd6: TESTER4/4 (3de81a), TypeScript0 (c381da); principal4/4 (c1fec5), todos saída0. Particular preserva matrícula, fonte anterior e decisão independente; dupla função não aprova proposta própria. DEV2 conferiu cadeia diário→correção→action e listagem global restrita. Q87/CT12 não foram reimplementadas: código/evidência posteriores já superavam pendências históricas; DEV2 confirmou CT12 atual4/4 (7a9dfe), sem alteração. Quadro separa agora fila corrente e resumos históricos.

18/09/2026 — Regressão unitária completa pós-Q23 no principal: primeira execução65755e falhou4/1781 por mock de paginação sem método de lock queryRaw; mock alinhado à autorização vigente sem alterar o guard. Nova execução5fb6b1:1781/1781,293arquivos,zeroignorados,saída0; relatório node_modules/.implementation/unitarias-pos-q23.json. Não é regressão de integração. DEV1 corrige gap real Q87: consulta de recebimentos ocultava matrícula AGUARDANDO embora antecipação pré-ativação seja aprovada e suportada pelo writer; status e requisitos de ativação permanecem separados.

18/09/2026 — Build local pós-Q23 em8b6ebd13: sessão7716/d6309b terminou saída0, compilação, TypeScript e85/85páginas. Banco descartável integracao, sem publicação/envios. Não inclui correção Q87 ainda no worktreeDEV1. Gap adicional confirmado pelo DEV2: Q23 bloqueia mudança de participação com dependência financeira, mas não há revisão versionada para resolver a dependência; conteúdo-only é permitido. Desenho em análise, sem relaxar bloqueios nem presumir destino financeiro.

18/09/2026 — Q87, antecipação na preparação: `82d8b9ad` integrado em `0e14624b`. Principal: 9/9 integrações (66393/286aa7), 7/7 unitários/callbacks e TypeScript com saída 0 (09b694). TESTER no commit exato: 9/9 (57bfd1), 7/7 (6f7dfc) e TypeScript com saída 0 (906f69), sem achados bloqueantes. AGUARDANDO aparece sem incluir rascunhos, encerradas ou canceladas. Repetição concorrente conserva recebimento único, crédito e estado; outra matrícula/moeda é rejeitada. DEV1 complementa a identificação dos contratos no seletor. DEV2 inicia conferência financeira Q23 de efeitos comprovadamente inalterados, com proposta, decisão independente e fotografia revalidada. Migração 257 reservada como `20260918110000_revisao_financeira_correcao_aula`, ainda não aplicada. Casos com reservas, consumo ou alteração financeira material permanecem pendentes.

18/09/2026 — Complemento do seletor Q87: `3d27b999` integrado em `4c80024c`. Código da matrícula ou ID completo estável distingue contratos do mesmo aluno e moeda. Principal: 9/9 testes de consulta/callback e TypeScript, saída 0 (d1fe0e). TESTER: 9/9 (501267) e TypeScript, saída 0 (047dcb). O writer permaneceu inalterado; a integração anterior não foi repetida pelo TESTER apenas por mudança de rótulo. DEV confirmou 9/9 integrações no complemento (8b0978).

18/09/2026 — Auditoria DEV1 confirmou lacunas reais Q102 e Q92. ConsumoHorasCompradas só é criado por consumo-horas.ts mediante presença; classificarOcorrenciaHoras e saldo-horas apenas calculam falta/cancelamento tardio em memória. O fluxo persistente será ligado à conferência financeira e à reserva da mesma matrícula, preservando recebimentos e sem duplicar cobrança ou gerar presença. Reserva técnica futura:258/20260918120000_consumo_horas_ocorrencia, ainda sem arquivo ou aplicação;257 permanece exclusiva do DEV2. Rótulos de contratos legados em movimentações seguem primeiro, sem alteração de banco.

18/09/2026 — Primeira revisão da proposta SQL257: não aplicada. O integrador identificou ambiguidade de variáveis PL/pgSQL, possibilidade de resultado NULL escapar do guard, fotografia que não reconstruía todas as fontes atuais e falta de saída operacional para revisão obsoleta. DEV2 revisa antes de qualquer DDL; os hashes de rascunho não são versões aplicadas. O TESTER reforçou separação Financeiro/Pedagógico, independência, locks e comparação canônica. Correções de conteúdo não exigem uma etapa financeira por si sós; propostas pendentes não congelam genericamente o fechamento vigente.
18/09/2026 — Q102 identificação de contratos legados: pausa, retomada, encerramento, prévias e histórico exibem código aparado ou `ID <matriculaId>` estável. A seleção continua explícita e envia somente os IDs marcados. Teste dirigido 2/2 e TypeScript concluíram com saída0; não altera servidor, schema ou regras de cobrança.

18/09/2026 — Q102: complemento 9cf0d946 testa por SSR os componentes reais de pausa, retomada e encerramento com dois contratos legados do mesmo aluno. Validação principal: 2/2 testes e TypeScript, saída 0 (b66a44). A seleção original foi preservada, sem função auxiliar criada somente para o teste. Q23/257 e Q92/258 seguem em elaboração nos worktrees atribuídos; nenhuma das duas migrações foi aplicada. Revisão preventiva exige fotografia dos informes sem reconhecer recebimento e consumo antecipado sem reprecificação ou segunda cobrança.

18/09/2026 — Base Q23/257 integrada em 5ae39510, bytes preservados por e308502d (SHA256 0761A8FEF35FDDB7E77EF1F661F3A463DA6BE28253E96539CF7641AE0446EBC7). Revisão independente de b9eb3c1b concluiu sem bloqueantes SQL após incluir informes na fotografia, fundamento Q92, última versão e locks contra novos efeitos concorrentes. Ensaio SQL com rollback aprovado (d7e54b). Deploy e Prisma Client concluíram com saída 0 no dev-gravacoes (50008/3a306d) e integracao (60626/2b2cde). Servidor, interface e testes funcionais seguem DEV2; base de dados não representa conclusão do fluxo. SQL258 ensaiado com rollback, saída 0 (aec3e5), ainda sem aplicação e sob revisão independente.

18/09/2026 — Q102 recebeu revisão independente de 264ee4dc/9cf0d946 sem achados: rótulos distintos e payloads mantêm IDs originais. TESTER atualizado a 38e6bd47, migração257 aplicada e cliente gerado, saída 0 (37642/4eff52). Principal pós257: TypeScript saída 0 (79985/5d25e9) e regressão de correção de aula 35/35, sem ignorados, saída 0 (87341/06cc8a); ainda não prova o novo percurso financeiro. SQL258 final em dc79d349/bd1f7b79, hash64B87755652CEF149CC7D40FE4B4719594DEE25D89BAE0E411966306E7F94A81, passou revisão e ensaio rollback (e4a4ff). Aplicada somente dev-email, com generate concluído saída 0 (2068/6531c1). TESTER solicitou negativos adicionais de cancelamento e vínculo cruzado; entrega funcional permanece em andamento.

18/09/2026 — Reconferência Q165: novo teste de pagamento posterior identificou erro em receberTx, que incluía destinação COBRANCA de valor zero quando a cobrança já estava quitada. Correção omite a destinação vazia e mantém o excedente autorizado como crédito separado. Teste real confirma recebimentos preservados, crédito anterior de 50, novo crédito de 20 e reconhecimento no delta sem emitir outro crédito; replay concorrente e fotografia posterior conferidos. Principal: arquivo delta 12/12 (90924/476b7b), recebimentos destinados 9/9 (58631/a01887) e TypeScript saída 0 (30f733). Primeira execução expôs a falha; primeiro TypeScript apontou nullabilidade da asserção, corrigida antes da aprovação. O cenário não cria creditoDelta por cobrança: o pagamento posterior corretamente nasce como crédito sem destinação. A antiga pendência desse ramo específico permanece explícita.

18/09/2026 — Correção de excedente 1cfe35c0 revisada independentemente sem bloqueantes. Complemento do teste afirma recebimento posterior com exatamente uma destinação CREDITO_SEM_DESTINO de 20, sem destino COBRANCA. Recorte 1/1, 11 fora do filtro, saída 0 (677ea2); não é nova execução global.

18/09/2026 — Q165, ramo material: novo teste percorre ajuste aprovado de 50 para 70 após base, recebimento destinado de 70, decisões independentes, retorno ao devido contratual de 50, crédito delta de 20, replay sem duplicação, fotografia posterior e efetivação. Revelou P2022: schema OrigemCreditoReconferenciaDeltaDesistencia.criadoEm não mapeava coluna criadaEm existente na migração249. Corrigido com @map, preservando banco/migrações aplicadas; cliente gerado saída 0 (62611/1cbd71). Recorte final 1/1,12 fora do filtro, saída 0 (7932ab); outros12 passaram na execução de arquivo57341/2931cb, cujo único erro era uma asserção que usava vínculo legado do recebimento em vez de DestinacaoRecebimento. TypeScript final saída 0 (a85cb8). Isto fecha a lacuna de evidência desse ramo, não a integração externa de assinatura.

18/09/2026 — Q92 integrado em e12afd60/72e30c6d/081c9164, bytes258 preservados3411c096. Migração258 e cliente aplicados principal22682/074f32 e TESTER53691/9940cb, saídas0. Principal29/29 em consumo+compra (30780/ddac22) e TS86018/b88942; TESTER1/1 consumo93115,28/28 compra47997 e TS68104, saídas0. Complemento d8aca732 integrado7400f940, validação independente ainda em execução. Q23 fluxo d5c28a14/798b7def/c763c54f: principal59/59 condições+correção (77416/03d821),TS8b1fa9 antes259. Teste faturado revelou escala JSON0.00→0; corretiva259 isolada Q23 em c8728555/f2f2b8c6, hashD6CC76263208AD8EF57B737686599AA33E4F322B7C8C7676BB0E7C3D680222A5. Ensaio68cdce e revisão independente aprovados; deploy dev-gravacoes a74239, principal628be7,TESTER322260, saídas0. Sem alteração do canonicalizador Q165 nem reescrita histórica. Testes faturados/obsolescência/concorrência ainda não recebem aceite.

18/09/2026 — Q92/258 complemento aprovado independentemente: TESTER30850/f7cc50,2/2, saída0 após259; somado à regressão compra28/28 já validada, fecha o consumo autorizado e seus negativos no recorte local. Próxima frente DEV1: troca aprovada da fonte de gravação já fixada em reposição,260 reservada, ainda semDDL. Root2b1eee4d: regressão unitária completa1790/1790 em296arquivos,zeroignorados,saída0(beec24), relatório node_modules/.implementation/unitarias-pos-258-259.json; TypeScript3910/19d5260. Q23 novos cenários2/2,23 fora do filtro,saída0(3d2d8c), com cobrança emitida/informe posterior. Build84116/c02394 saída0,85páginas,semdeploy. Prova concorrenteQ23 ainda em reforço de sincronização; não recebe aceite apenas por disparar promises.

18/09/2026 — Checkpoint 260 ainda não aplicado: revisão do integrador identificou necessidade de serializar a cabeça da publicação e revalidar a fotografia na aplicação; TESTER confirmou ausência de revalidação do preparador após retirada do papel. DEV1 corrige antes do DDL. Q164 reapresentada no seletor; nenhuma resposta presumida.

18/09/2026 — Auditoria Q23 de efeitos monetários: o ajuste comercial genérico não comprova vínculo com a correção e não cobre cobranças pagas ou compensadas. Esses efeitos continuam no escopo, sem aceite. Q175 apresentada para decidir a ordem/atomicidade entre publicação acadêmica e acerto financeiro; aguarda resposta. O limite SEM_ALTERACAO_VALORES descreve a implementação atual, não uma redução do requisito original. DEV2 continua no consumo já equivalente, sem presumir essa resposta.

18/09/2026 — Checkpoint 260 revisado em 1a8d5388: ensaio SQL no banco descartável dev-email, dentro de BEGIN/ROLLBACK, concluiu com saída 0 (6138ee), sem migração persistida. Revisão independente confirmou fotografia centralizada, origem exata e bloqueio publicação/material. Antes de aplicar, DEV1 deve completar a revalidação de atores na decisão e a exigência de material disponível. O ensaio de DDL não comprova os testes funcionais ainda pendentes.

18/09/2026 — 260 corrigida em 81845f28, integrada em 551b1faf; bytes preservados em 7bfdd8e. Hash SHA256 1B9004C5E35FF04D85DD5DFC07FF2931FB42DB8C2DAED9AC5419ACDCE0C014BE. Ensaio reversível final 23523a saída 0 e revisão independente do diff aprovados. Aplicada e cliente gerado em dev-email (75125/3102a1) e integração (42788/63a86b), ambos saída 0. Servidor, tela e testes da troca contextual ainda em implementação; migração aplicada não representa funcionalidade concluída.

18/09/2026 — SQL261/e5615228 passou no ensaio sintático BEGIN/ROLLBACK do dev-gravacoes (b58e07, saída 0), mas NÃO foi aplicada. O ensaio confirmou duas divergências na reprodução de estadoDiario: concatenação SQL de campo nulo e formatação dependente do fuso da sessão. DEV2 corrige ambas e deve provar equivalência com o hash Node, incluindo fuso não UTC, antes do congelamento. A elegibilidade financeira da conversão presença→falta também está em revisão.

18/09/2026 — Regressão dirigida após aplicar 260 na integração: regularizacao-fonte-docente.int.test.ts e autorizacao.int.test.ts, 14/14 testes em 2 arquivos, nenhum ignorado, sessão 27465/cec7d2, saída 0. Confirma preservação desses percursos existentes; os testes do fluxo contextual novo continuam com DEV1, sem aceite antecipado.

18/09/2026 — SQL261 final c86a4bab integrada em 0d239e17, atributos ab4c0e9. Hash 28E64C5EFAC383121DB22478692714CDC58DC67FCFF48A2689A71FCDF42F03F5. Revisão independente final aprovada; ensaio reversível 2c88e4 e 4 comparações isoladas Node/SQL com campos nulos e dois fusos (8f821f), saídas 0. Aplicada em dev-gravacoes (f74298), integração (24ccb6) e tester (02cf29), saídas 0. DEV2 completa servidor/tela/testes/SPEC; TESTER verifica regressão do ramo anterior. Não há aceite funcional do novo consumo ainda.

18/09/2026 — Regressão independente pós261 falhou: 23/25 testes, 2 Q23 com SQL42702 por aliases p/e iguais às variáveis PL/pgSQL (TESTER sessão13739, saída1). DEV2 prepara corretiva262; 261 preservada. TypeScript da integração passou em23154/ef787b, sem comprovar comportamento SQL. Auditoria dos checksums revelou conversão autoCRLF no checkout antes de aplicar260/261 em integração/tester: checksums efetivamente registrados são 1996B9E5D42115DB91E7D0307CD71F86E5693407CBEC7FAC712963D1E8666707 (260) e 6B9347A9BBB30F067C6884F87EEBD7E59C5F7A2B75661A255147C1FD9BC45727 (261). DEV1/DEV2 aplicaram os hashes LF publicados anteriormente. Conteúdo SQL igual após normalizar quebras de linha; checkout root/tester alinhado aos blobs versionados (136329), sem editar checksums/histórico dos bancos. A divergência de checksum local permanece registrada; futuros checkouts exigem verificar bytes antes do DDL.

18/09/2026 — Corretiva262 integrada em598e9e09, hash F977E106E1B2E4DB867055D2E39E94C472B383F2B8CF9A6A1F6E2B9BC5C1DEC6 conferido antes do DDL. Aplicada dev-gravacoes447ce8, integração be768c e tester8e319a, saídas0. Regressão independente no tester35003381: condicoes-horas.int.test.ts 25/25, nenhum ignorado, sessão75187/2a593f saída0. Corrige a falha42702 do checkpoint anterior; não substitui os novos testes de reserva consumida. DEV1 entregou4c01abb8, mas revisão encontrou consulta pós-aprovação quebrada, rejeição de proposta obsoleta bloqueada e link para material inelegível; correções e testes adicionais permanecem em desenvolvimento.

18/09/2026 — Regressão pedagógica após262: correcao-aula.int.test.ts passou 35/35, nenhum ignorado, banco integração, sessão61257/4dba54 saída0. Complementa os25/25 financeiros independentes após a corretiva; novos cenários de consumo antecipado continuam comDEV2, sem aceite por esta regressão.

18/09/2026 — Revisão dos testes novos Q23/consumo: TESTER solicitou comparação profunda das fontes financeiras, preço histórico distinto da condição posterior, fotografia obsoleta e negativas de aprovação no ramo consumido. Root identificou risco adicional a verificar: novas CondicoesHorasMatricula usam lock de Matricula, enquanto a fotografia261/262 lê a ausência de versões pendentes sem essa âncora. DEV2 deve comprovar a serialização ou preparar corretiva nova, sem editar migrações aplicadas. As regressões25+35 aprovadas não cobrem esses casos novos.

18/09/2026 — Validação independente da troca de gravação no TESTER d2479444: integração5/5 (6b0e53), SSR/painel7/7 (02f301), callback1/1 (c3d924) e TypeScript53157/13bf61, saídas0. Revisão final de código em fechamento. DEV1 também verificou regressão operacional22/22 (71945/b79f33), sem novos arquivos. Próxima frente será escolhida por lacuna da SPEC ainda autorizada, sem presumir respostas pendentes.

18/09/2026 — Aceite local Q23/Q57 de adoção contextual da gravação concluído após revisão independente d2479444. Corretiva financeira263/8e1d1e6b passou no ensaio reversível da5345, mas NÃO foi aplicada: TESTER identificou que a função de fotografia também é chamada em consulta sem advisory; DEV2 adiciona lock institucional antes de qualquer lock de linha para evitar inversão com reserva de horas.

18/09/2026 — 263 final b28b7b70 integrada7d370fc9: advisory institucional antes de qualquer linha e âncora Matricula antes de ler condições. Hash2007954DCEF460A7CF4233117CE2D535BA6E5E9053F42B83C2B8AC0503648B21 verificado nos3checkouts antes aplicar. DDL dev-gravacoesbc2689, integração464f72 e tester87ffcb, saídas0. Recorte legado Q23 pós263:2/2,23fora do filtro, saída0 em5247b0. DEV2 executa o cenário concorrente específico; não presumir prova desse cenário pela regressão legada.

18/09/2026 — Regressão unitária pós260/263:1795/1795 em299arquivos, nenhum ignorado, saída0 em31b2fb; relatório local node_modules/.implementation/unitarias-pos-260-263.json. Nova frente DEV1 Q145: atendimento pedagógico WhatsApp ainda escolhia responsável pelo vínculo PEDAGOGICO, sem autorização por matrícula. Implementar destino contratual explícito e revalidação da autorização vigente em abertura/envio/retomada, preservando comunicação com aluno e experimental. Branch codex/dev1-q145-atendimento-20260918 preparada em994761fa, ambiente dev-email atualizado636e29; migração264 reservada, não aplicada. DEV2 permanece no consumo Q23; duas frentes em implementação.

18/09/2026 — Build local após integração260 e corretivas financeiras263 concluído em e010c10e: sessão79722/135b13, saída0, compilação/TypeScript e85páginas estáticas. Complementa1795testesunitários; não equivale à validação dos novos fluxos financeiros ainda WIP nem à operação externa. Desenho264 aprovado para FK dedicada de autorização acadêmica, sem reutilizar Atendimento.responsavelId (operador); exige escolha explícita quando houver vários responsáveis, preserva atendimento direto e experimental, sem ampliar acesso legado.

18/09/2026 — SQL 264 validado independentemente no TESTER 582c4aad, hash DD5C273BCC1A73391419772ADFF00D7ED64B705BABA5C7395F40AA9AC6895CFE: cinco cenários em transações com rollback, saída terminal 0. Recusados envelope cruzado, desvinculação pendente, mudança de destino terminal e autorização futura no fuso America/Sao_Paulo; permitido registrar resultado terminal após revogação sem alterar o contexto. Consulta aos três bancos descartáveis confirmou checksum e aplicação (75614c). Não é aceite funcional do atendimento nem execução da suíte WhatsApp.

18/09/2026 — Integração Q145 b6f81551 e revisão financeira Q23 aceita em 1c9818d0: regressão unitária completa 1.797/1.797, 299 arquivos, zero pendentes, saída 0; relatório node_modules/.implementation/unitarias-pos-264-q23.json. Build sessão 65249/c4fee8 saída 0, TypeScript e 85 páginas. TESTER revisa Q145 em 0dff7e42. Próximas frentes CT-01/CT-06 receberam critérios compostos explícitos e branches isoladas; DEV2 foi atualizado com 260/264 e cliente, sessão 2082/0935e5 saída 0. Nenhum envio real.

18/09/2026 — Conferência transversal no integrador a3573f2f: pausa-proposta, replanejamento-conjunto-adversarial, replanejamento-avisos e modalidade-quantidade passaram 46/46 em quatro arquivos, sessão 12328/535e7f, saída 0, sem filtro por nome. Cobrem atomicidade, fotografias alteradas, conflitos e aplicação/avisos; não é a suíte de integração completa. CT-05 ainda exige comprovar a sequência composta de conflito resolvido e aplicação válida preservando aulas passadas. Auditoria independente CT-04 identificou evidências separadas, mas falta o percurso único de saída docente, transferência do aluno e primeira chamada histórica por designação pontual; não foi comprovado defeito no código. Essas provas ficam na fila após as duas frentes atuais.

18/09/2026 — Corretiva 265 integrada em 2d26b398, TESTER a3def037, SHA256 65D8FA556BEBDD98EA873A32E35BD6C5013D284DEB5107815BD5841E2AABA99C. Revisão independente SQL sem bloqueadores; ensaio rollback 50d088 e deploy dev-email b7b37c, integração b711ee e tester 1b3c3b, saídas 0. Protege telefone/WhatsApp atual do aluno direto ao criar atendimento, enfileirar, reativar ou obter claim; resultado terminal continua gravável. Comparação do telefone do responsável continua no Node, não foi acrescentada à SQL264. Commit funcional e testes da correção ainda em desenvolvimento; Q145 não recebe aceite antecipado.

18/09/2026 — Preferência de fuso: corretiva267 integrada em6a345fd9, hash7AF97C9D4A81CB182F7423BBF9E9D99483E7BDBD36DE2698F35C53E73613EF40. Comparação independente do catálogo encontrou Factory incompatível com Intl; SQL agora recusa esse nome e normaliza preferência inválida paraNULL. Ensaio DDL com seis casos e rollback c726bf saída0; deploy dev-email db0577 saída0. Root e TESTER aplicaram266/267 e geraram clientes, sessões69751/c5504d e9113/052444, saídas0. DEV2 permanece265. Fluxo de perfil e consumidores ainda em implementação; não é aceite funcional.

18/09/2026 — Caixa CT06: base integrada em c6919cad. Resolver confere memória imutável de entrada/continuidade/fechamento contra instante atual e formulário usa data civil sem conversão do navegador. DEV relatou12 unitários,10 integrações e TS saída0; evidências detalhadas solicitadas. Sem aceite: complemento deve reconhecer data civil M01 e mudanças aprovadas por aditivo/prorrogação, em vez de tratar todos como origem insuficiente. TESTER revisa fontes com DEV2; nenhum novo fuso presumido.

18/09/2026 — Auditoria de consumidores financeiros: FilaCobranca, FichaFinanceira e ConferenciaFinanceiraMigracao ainda usam fuso implícito do navegador para vencimento; DEV2 reutilizará referência civil após completar fontes. Retomada aplica data civil explícita em UTC quando reprograma, com proposta/snapshot aplicado como fonte. Possível erro adicional a reproduzir após o recorte atual: retomada-estado.ts extrai vencimento original por ISO.slice(0,10), apesar de Cobranca.vencimento ser DateTime; emissão em fuso positivo pode cair no dia UTC anterior. Não corrigir somente apresentação se a prévia também estiver incorreta. Máximo de duas frentes mantido.

18/09/2026 — Preferência pessoal de fuso: checkpoint23111a36 integrado em0afccae1. Inclui perfil próprio equipe/portal com seletor pesquisável, fallback preferência/origem/UTC, agenda docente, histórico do diário e detalhe de reposição portal. Writer portal usa Conta→Sessão e valida após locks; DEV comprovou revogação concorrente enquanto aguardava lock. Evidências DEV:15 unitários,21 integrações e TS saída0(6b501f). TESTER fará revisão independente. Ainda faltam consumidores de reposição equipe, pendências, regularizações, correções/troca-fonte e segunda chamada; DEV1 continua mesma frente, sem aceite integral.

18/09/2026 — Regressão unitária global no snapshot5bfb6ecf:1.803/1.803 testes,301 arquivos,zero falhas/ignorados, saída0(102d67); relatório JSON node_modules/.implementation/unitarias-pos-preferencia-fuso.json reconferido em7e4ab3. Inclui exportação corrigida, base de vencimento civil e primeira entrega de preferência de fuso; não inclui complementos WIP nem equivale à integração completa/aceite das frentes.

18/09/2026 — Build do snapshoteb5a9145 concluído saída0(sessão93494/174bdd),87páginas, incluindo perfis de preferência. Após terminar, integrados ac7980bd (pendências/regularizações/reposições/segunda chamada e portal) e2901f0ff (fontes civis M01/aditivo/taxa/retomada); build anterior não comprova estes complementos. DEV1 corrige rótulo do fuso exibido e demais componentescliente. DEV2 segue consumidoresfinanceiros e revisão da precedência porversão/instante; nenhuma dessas frentes recebe aceite antecipado.

18/09/2026 — Validação isolada de preferência ainda não aceita: TESTER relatou HEADeb5a9145 e cherry-pick vazio, mas conferência autoritativa24a8d6 mostrou worktreeerp-tester ainda em07ec082e, perfiltester. Evidênciasc4103e/c23a82/d992a3/2cfbed não comprovam execução nesse worktree/banco. Solicitada reexecução com workdir explícito, identificação de HEAD/perfil e cherry-pick0afccae1 antes dos testes. Não apagar resultados anteriores nem tratá-los como aceite independente isolado.

18/09/2026 — Reexecução isolada de preferência comprovada emerp-tester/perfiltester/HEADc707d391. Resultados: preferências6/6(8a63ab), agenda15/15(d030a3), helper/diário15/15(49a47a) e TS sessão28166/a1c7f9, saídas0. TESTER confirmou explicitamente que a rodada anterior ocorreu indevidamente emde19 e a desconsiderou para aceite isolado. Aceite deste checkpoint cobre0afccae1; complementos posteriores e consumidores faltantes permanecem em desenvolvimento/revisão.

18/09/2026 — Complementos de fuso integrados: d4823b09 (fila docente), 286d97fa (instantes restantes da equipe/operação) e bb8dc5c9 (vencimentos civis na fila, ficha e migração). Recorte principal: 13/13 testes em 2 arquivos, saída 0 (99d972). TESTER prepara regressão dos instantes apontados; secundárias acadêmicas ainda em implementação. Revisão do integrador exige retirar fallback destinado a mocks do carregador financeiro e tratar ordem de retomada/aditivo; reprodução UTC+14 confirma vencimento errado em retomada-estado, correção atribuída ao DEV2. Sem aceite global da frente nem mudança na conclusão da SPEC.

18/09/2026 — Integrados ba12293b (ocorrências) e5765540e (correções de conclusão), ainda sem aceite global das secundárias. TESTER regressão27575103 integrada e87641e1: 6/6 renderizadores, saída0(78e469), TS0(447c3e). Principal encontrou mock incompleto na página troca-fonte: corrigido7aa7b64f com assert de preferência e guard; recorte reposições12/12 saída0(0dd7e3). TypeScript integrado até5765540e aprovado sessão78442/e5cf26, saída0. DEV1 substituído por nova instância Terra no mesmo worktree após encerrar repetidamente apenas com status; predecessor parado, sem edição concorrente. DEV2 e TESTER seguem financeiro. Não declarar conclusão das telas restantes.

18/09/2026 — Regressão unitária após consumidores integrados: primeira execução1811 teve3falhas no mock de preferência da página pendências (176260). Corrigidos mock e orientação textual contraditória em7e1272f9; nova execução global1811/1811 em301arquivos, zero ignorados/falhas, saída0(fc5ffe), JSON confirmado7be528. Não inclui integrações nem os próximos commits em preparação dos agentes. Incidente DEV2 unique ConfiguracaoOperacional em suíte pausa está em diagnóstico; não contabilizado como teste aprovado.

18/09/2026 — Build do snapshot84acdb72 concluído: sessão71997, saída0(c597e4),87páginas, TypeScript incluído. TESTER financeiro bc276831 aprovou14/14 (83e429) e TS0(701bce); regressão de renderfee7d0e0 integrada233d6310 cobre fila/ficha/migração com data civil01/03/2099 emPacific/Kiritimati e origem sem prova. Principal novo teste1/1 saída0(71d059). Esta evidência não cobre correção da retomada ainda em desenvolvimento nem fecha apresentação acadêmica.

18/09/2026 — Auditoria CT07 pelo TESTER: Q69 já implementada, pendência da tabela histórica não é estado corrente. compra-horas.int.test.ts399 disputa uso/devolução com Promise.all e prova único sucesso/saldo; não observa espera por lock. reposicao-agenda.int.test.ts114 cobre última cota sequencialmente; guard SQL possui advisory lock por matrícula/período. Atribuída prova sincronizada da última cota ao TESTER, sem nova regra. Secundárias de fuso6d186d6b: recorte principal diário23/23 em12arquivos saída0(eb0f43); revisão pediu rótulo de fuso/origem nas regularizações e fixture de correção de conclusão antes do aceite.

18/09/2026 — Integrado748998e0: teste SSR real de correções de conclusão e rótulos de fuso/origem nas regularizações. DEV:4/4 em2arquivos(6b1a48),TS0(056a33); principal5/5 em3arquivos,saída0(cbfc09). Auditoria encontrou apresentação ainda fixa em grades/calendário/indisponibilidades/recuperações e lista de reposições do portal; continuação da mesma frente atribuída ao DEV1, sem aceitar preferência global incompleta. DEV2 obteve execução rastreada64949 de pausa:23/27,4falhas por fontes civis ausentes nas fixtures, ajuste com fontes reais em curso; execução não aprovada.

18/09/2026 — CT07 última cota integrada5d5f4778 e documentada6691f133: TESTER13/13(113095),TS0(f3a355); principal1/1 com12fora do filtro(9ede88). Prova sincronizada de crédito em elaboração. Fuso: ced403f2 portal/ausências, a40a7182+ef20c66e grade e b20195a1 testes integrados; SSR principal2/2(eb26d1). Filas segunda chamada3089d371 passaram11/11 em4arquivos(4a7d63), mas revisão identificou rótulo 'origem UTC' sem projeção da origem real; DEV1 corrigirá SELECT/retorno antes do aceite. Demais secundárias permanecem pendentes.

18/09/2026 — Revisão do integrador bloqueia aceite de remarcação99802368/cancelamento1877886f: conversão nova removeu normalização UTC de timestamps sem sufixo nas fotografias SQL, podendo interpretar no fuso do host. Correção e testes com/semZ atribuídos ao DEV1; testes anteriores só usavamZ e não cobriam o caso. Fonte docente a21b955a tem teste c3e959a4 aprovado no principal1/1(44e846); detalhe0a10aca6/df784129 passou2/2(5434c3). CT07 crédito c5a81d6f/3271d11d: TESTER28/28(79545/04d739),TS0(adf99d),principal1/1+27fora(10e960). Retomada permanece em revisão sem aceite.

### Revisão de integração de fusos e datas civis — 18/09/2026

- Snapshot integrado `cce316f8`: remarcação de segunda chamada preserva instantes UTC de snapshots com e sem sufixo; teste dirigido de três formatos aprovado no integrador (3/3, saída 0, `5dc8cb`). Cancelamento sem sufixo UTC aprovado separadamente (1/1, saída 0, `c56914`). Esses recortes não substituem a regressão global registrada no início do quadro.
- Revisão independente em `b3dfd2fb` identificou três ajustes ainda em desenvolvimento: rótulo do fuso efetivo na agenda, horário proposto da remarcação e identificação do fuso da ocorrência de cancelamento. A revisão do diff da página principal também detectou remoção indevida de links administrativos; integração condicionada à restauração e teste de navegação.
- Auditoria financeira: `diferencaEmDias` ainda usa o fuso do processo em `regua.ts`. Seus consumidores incluem a régua de mensagens e a restrição automática D+30 (`acesso-aulas-regras.ts`). Corrigir a apresentação do vencimento não comprova correção desses cálculos. A frente financeira deve resolver a referência civil comprovada também nesses consumidores; permanece pendente.
- Retomada financeira: DEV2 prepara versão da cobrança no snapshot, preservação da data civil de emissão UTC+14 e reprogramação na mesma data. Revisão independente do diff não encontrou defeito, mas exige completar evidência de encadeamento com alteração posterior e de legado sem versão antes do aceite. Trabalho ainda não integrado.

- Complemento integrado da segunda chamada: `a833ec8a` restaura a navegação administrativa e identifica a referência de exibição; `4a3b4e31` amplia a fixture de remarcação. A revisão do painel identificou que o mesmo parâmetro também definia o fuso inicial do formulário de ocorrência. O integrador separou `fusoEntrada` da preferência de exibição, preservando a referência anterior dos novos lançamentos. SSR usa o painel real e verifica conversão através da meia-noite, três links da gestão, ausência desses links para professor, guarda antes das consultas e campo de fuso original. Recorte completo de segunda chamada: 20/20 em 9 arquivos, saída 0 (`f4026c`); TypeScript saída 0 (`bef049`). Não representa conclusão da preferência em todas as telas acadêmicas.

### Integração e regressão — 18/09/2026 (73d64339 / 9bae8e61)

- Regressão unitária global em `73d64339`: **1.825/1.825**, nenhum pendente/ignorado, saída 0; sessão `24692`, conclusão `41d8f9`, relatório conferido em `c3f4c5`. A primeira execução em `4107a4b5` falhou em quatro casos da fixture de remarcação por não simular a nova consulta de preferência; corrigida em `73d64339`, sem mudar a produção para acomodar o teste. Este resultado global antecede a integração financeira seguinte.
- `9bae8e61` integra a retomada com origem civil e versão da cobrança. No integrador: pausa/retomada **29/29**, saída 0, sessão `90572`/`dc110b`; unitários de referência civil e consulta de ajustes **22/22**, saída 0 (`3808a6`); TypeScript saída 0 (`67247`/`ab075a`). Cenário CT06 de contratação/continuidade também aprovado **1/1**, saída 0 (`0b3ffe`). Banco descartável do perfil `integracao`, sem envio ou assinatura externa real.
- O teste UTC+14 percorre emissão, assinatura simulada identificada, aceite, pagamentos, ativação, pausa aprovada e prévia de retomada, mantendo 05/10 como vencimento civil de um instante persistido em 04/10 UTC. REPROGRAMAR na mesma data também conserva uma origem versionada no snapshot. A cadeia real retomada seguida de aditivo posterior continua em preparação pelo DEV2; não foi presumida como testada.
- A revisão independente da segunda chamada em `4107a4b5` confirmou 20 testes e TypeScript com saída 0 no worktree TESTER, além da separação entre fuso de exibição e de entrada. A SPEC foi corrigida para explicitar que a régua de dias e D+30 ainda não usam a nova referência civil; a apresentação financeira não comprova esses cálculos.

- `14ff122d`: lista de recuperações, detalhe da realização e lista de planos passam a respeitar preferência de exibição, com origem administrativa UTC explícita e campos de entrada preservados. Novos SSR verificam conversão com mudança de dia, fallback e guarda antes do acesso aos dados. Recorte no integrador: 10/10 em 4 arquivos (`b27b9c`), saída 0. Build do snapshot `14ff122d` concluído, incluindo TypeScript e geração de 87 páginas: sessão `65113`, saída 0 (`e63bb0`). Restam outros consumidores de recuperação e calendário; não marcar a frente de fuso como integralmente concluída.

- Verificação adicional do integrador em `8ce6df09`, com processo `TZ=Pacific/Kiritimati`: remarcação/cancelamento de segunda chamada e páginas de recuperação, **14/14 em 6 arquivos**, saída 0 (`01fd0b`). Confere invariância da exibição e normalização dos snapshots antigos de segunda chamada fora do fuso usual do host. Não envolve banco e não comprova cálculos financeiros D+30.

- `cc147d62`: execução do plano e detalhe da tentativa de recuperação passam a exibir instantes administrativos pela preferência pessoal. `AgendaPublicada` recebe a preferência separadamente e conserva o fuso de origem como fallback, sem reinterpretar entradas dos formulários. Revisão corrigiu a proposta inicial que repassava UTC administrativo como fallback da agenda. Recorte integrado: 23/23 em 8 arquivos de recuperação, saída 0; TypeScript saída 0 (`a7b53a`). Autorizações, prorrogações, outras telas de agenda e calendário ainda aguardam o complemento da mesma frente.

- Revisão independente de `9bae8e61` no TESTER (`c662fc7a`): integração pausa/retomada 29/29, sessão `5481`, saída 0; unitários de referência civil/ajustes 22/22 e TypeScript saída 0. A versão da cobrança é preservada na fotografia; REPROGRAMAR mesma data é origem material. O teste UTC+14 inclui a prévia de retomada no final do arquivo, além de emissão/aceite/ativação/pausa; a versão anterior do teste não incluía esse último trecho.
- Q176 enviada e **ainda sem decisão**: qual referência determina a virada do dia financeiro para atraso, régua e D+30. Alternativas apresentadas: por contrato com padrão institucional, única da escola ou por país. Nenhuma foi presumida. A preferência de exibição não pode ser utilizada como regra financeira. Fontes civis sem fuso exigem definição antes de completar esses cálculos; outras frentes prosseguem.

- `d75a3744` integra prova contratual real: ativação, pausa, retomada com reprogramação e aditivo posterior formalizado/aplicado na mesma cobrança; leitura seleciona a maior versão efetiva. DEV: arquivo contratual 48/48, sessão `61679`, saída 0; asserção complementar de cobertura parcial 1/1 (`681166`) e TypeScript (`ebdadf`) saída 0. Integrador: três cenários alterados aprovados, **3/3, 45 fora do filtro**, sessão `89364`/`bf5541`, saída 0. Preservadas as rejeições de cobertura parcial, intervalo invertido e falta de valor estruturado; fixture válida passou a informar o ciclo futuro obrigatório. Assinaturas são simuladas no ambiente de teste, sem provedor real.
- Q176 continua sem resposta. DEV2 encerrou o recorte financeiro e foi direcionado à exibição de revisões do calendário, em `codex/dev2-calendario-20260918`, no mesmo worktree 9ac1; integrador preparou o cliente Prisma local, sem instalar dependências ou ativar serviços. A outra frente mantém autorizações/prorrogações de recuperação. Não há terceira funcionalidade em implementação.

- `6c65a36a` integrado: quatro históricos de autorizações/prorrogações de recuperação usam preferência pessoal para instantes administrativos. Integrador conferiu a preservação de formulários e executou todos os testes atuais da pasta de recuperação: **29/29 em 10 arquivos**, saída 0 (`aa7776`); TypeScript saída 0 (`7399cc`). Próximo recorte mantém agenda, cancelamento, designação e prévias de recuperação; revisões do calendário avançam no outro worktree.

- Auditoria complementar de exibição identificou consumidores ainda fora dos recortes entregues: `MudancasAcademicasPainel`, lista/detalhe de avaliações e fechamento, históricos de correções e revisões de progressão, regras de nível/turma e dois pontos de segunda chamada (data do fato no formulário docente e histórico de designação). A busca por formatadores é um inventário de candidatos, não prova de conclusão nem indicação para mudar campos civis. A frente de preferência pessoal permanece parcial até revisar esses consumidores, além dos trabalhos atuais de recuperação e calendário.

- Correção do inventário de fontes de recuperação: o estado SQL de cancelamento (`20260914230000_cancelamento_agenda_recuperacao`) usa `jsonb_build_object` sobre `EncontroAgenda.inicio/fim`, colunas `timestamp without time zone`. Consulta real no banco descartável confirmou JSON `2026-01-01T02:30:00`, sem sufixo (`a6d6a7`, saída 0). Esses campos representam UTC e não podem passar diretamente por `new Date` como horário local. DEV1 deve normalizar somente a projeção para exibição e testar em fuso do processo diferente, preservando snapshot/hash. O relato anterior de que todos os instantes dessa frente eram ISO Z foi corrigido; outros campos serão conferidos pela fonte.

- Regressão unitária global no snapshot `a0e46295`: **1.855/1.855**, nenhum pendente/ignorado, saída 0. Sessão `25906`, conclusão `3eaa24`, contagem do relatório conferida em `5b4b64`. Inclui as entregas de recuperação e a integração financeira já commitadas; não inclui WIP de calendário e do último recorte de agenda/designação de recuperação nos worktrees dos DEVs.

18/09/2026 — Calendário integrado em e16995a8/3955336a: preferência de exibição no replanejamento, preservando entradas e distinguindo referência institucional no histórico. Validação do integrador: filtro src/app/(app)/academico/calendario, 4 arquivos/8 testes, saída 0 (034d89); TypeScript saída 0 (330287). Recorte local, sem regressão global. Q167C reconfirmada: negociação por caso, concordância registrada e aprovação independente; destinos operacionais continuam pendentes de delimitação, sem conversão automática em dinheiro.

18/09/2026 — Build integrado no snapshot fabc30ed: compilação, TypeScript e geração de 87 páginas concluídos, saída 0 (sessão74506/946a56). Não equivale à homologação dos fluxos nem inclui alterações ainda nos worktrees. Revisão independente Q167 confirma cálculo e fotografia sem consumidor operacional; proposta, concordância, aprovação e aplicação de destinação ainda ausentes, com destinos aguardando Q171. DEV1 continua projeção/agenda de recuperação; DEV2 assume preferência de exibição em painel, fechamento e designação de avaliações, preservando entradas e permissões.

18/09/2026 — Calendário validado também com TZ=Pacific/Kiritimati: mesmo filtro, 4 arquivos/8 testes, saída 0 (077d41). Revisão de recuperação encontrou rótulo de origem incorreto quando faltava fuso do encontro: solicitado distinguir referência UTC de origem conhecida. Solicitada evidência da consulta real, além do helper, para comprovar normalização de snapshot legado sem Z e preservação do hash; entrega ainda em desenvolvimento.

18/09/2026 — Integrada preferência de exibição no painel de avaliações, fechamento e histórico de designação (21f3a36e). Consultas de preferência após guarda; preservados cálculos, formulários e links. Integrador: 3 arquivos/9 testes SSR, saída 0 (66ceea), TypeScript saída 0 (b6c62d). SPEC atualizada na entrega. DEV2 segue exibição das correções acadêmicas; DEV1 finaliza recuperação e evidência da consulta com snapshot legado.

18/09/2026 — Recuperação integrada em422a8d12. Integração independente ampliada em lancamentos.int.test.ts comprova fonte SQL sem Z, normalização apenas na consulta, fuso do encontro, instante preservado, hash e snapshot originais e decisão independente válida. Perfil integracao com TZ=Pacific/Kiritimati: 1/1, 95 fora do filtro, saída0 (b166f5). Recorte de recuperações:17arquivos/44testes, saída0 (2c2688); TypeScript saída0 (0102f6). Não é suíte integrada global. DEV1 revisa independentemente entrega de avaliações; DEV2 continua correções acadêmicas.

18/09/2026 — Regressão no snapshot e6db1b31: 1.887/1.887 unitários, zero falhas/ignorados, saída0 (60328/c1bc37; JSON conferido b7d5a7). Build do mesmo snapshot com TypeScript e87páginas saída0 (37778/621d44). Depois, correções acadêmicas integradas em58c0d544:4arquivos/11SSR saída0 (53751b), TypeScript0 (b7a222); esse complemento não integra a contagem global anterior. Revisão independente DEV1 aprova6ba70de2 das avaliações por inspeção, sem reivindicar testes próprios. DEV1implementa históricos das regras; DEV2completa dois consumidores de segunda chamada.

18/09/2026 — Integrados ed5dd567 (históricos de regras) e b8be9882 (segunda chamada). Integrador: regras4arquivos/11testes0 (0c97b7); segunda chamada11arquivos/27testes0 (7e6e1e); TypeScript0 (dd0031). Preservadas datas civis, entradas e payloads. DEV1segueequivalências com fallback legado; DEV2separa exibição pessoal e fuso de entrada em lançamento de notas, cuja referência atualmente é compartilhada. Esses complementos têm validação dirigida e não integram o total global anterior.

18/09/2026 — Integrados c5a28531 (entrada de notas separada da preferência de histórico) e8d819d3d (equivalências). Integrador: avaliações4arquivos/13testes0 (874621), TypeScript após avaliações0 (d8121c); equivalências2arquivos/6testes0 (7a36b0). Sem conversão de datas civis ou alteração dos payloads. DEV1revisa independentemente a separação dos fusos; DEV2completa painel de mudanças acadêmicas. Esses recortes não representam conclusão global da preferência nem da SPEC.

18/09/2026 — Painel de mudanças acadêmicas integrado49c6fd4f:5SSR0 (516508) eTypeScript0 (899d50). Inventário do integrador detectou consumidor adicional na ficha alunos/[id]/academico ainda sem repasse da preferência; DEV2 completa esse caminho. Portal-aluno/resultados ainda usa timezone do servidor para confirmadoEm; DEV1 trata esse instante administrativo. Revisões de worktrees anteriores não reabrem equivalências/regras já integradas em8d819d3d/ed5dd567.

18/09/2026 — Integrados ab505f34 (fechamento no portal) e f62a4814 (ficha acadêmica por matrícula). Portal3SSR0 (048d37), TSapósportal0 (0e9219); ficha3SSR0 (359509). Portal deixa de depender do fuso do servidor; ficha repassa preferência mantendo matrícula e autorização. DEV1revisou80802eb0 semachados. Restam histórico de reservas da segunda chamada (fallback institucional) e exceção de reposição (saídas administrativas), agora atribuídos aos doisDEVs.

18/09/2026 — Arquivo completo lancamentos.int.test.ts aprovado no integracao:96/96, zero filtros/ignorados, saída0 (83971/1789b6), snapshot1123327e. Não é toda a suíte de integração. Histórico de segunda chamada integrado4a1c448f:30/30recorte0 (8c3e6e). Exceções de reposição integradas12891802; conflito de testes preservou os dois casos. Execução inicial com marcadores falhou; após resolução,9arquivos/16testes0 (b02555), TypeScript0 (d42a91). Preferência bruta preserva fallback por exceção; datas locais de proposta intactas. Agentes revisam independentemente e identificam próximos escopos sem decisões presumidas.

18/09/2026 — Build no snapshot1e422871 aprovado: compilação, TypeScript e87páginas, saída0 (16352/9a4d6f). Revisões independentes aprovam portal033c2284 e históricoe7a3e5e0 por inspeção. Fila corrente corrigida:266/267 e projeção civil do caixa já integradas; pendências restantes não são reabertas como implementação inicial. Banco descartável dev-gravacoes recebeu266/267 pelo integrador, saída0 (4cb4ec). DEV2verifica/prova contrato legado sem preparação no aditivo; DEV1implementa apenas preferência no instante de aplicação de permuta, preservando datas civis e destinos Q167/Q171.

18/09/2026 — Regressão30cff618 apresentou1936/1938:dois testes antigos da página de histórico não simulavam a nova consulta de preferência (44026/740a0d). Mock corrigido em12b8623b, preservando asserts de autorização/links; recorte2/2 (11e559), regressão1938/1938, zeroignorados, saída0 (38568/fdea95; JSON8938e3). DEV2base atualizada para30cff618 em branchprópria codex/dev2-aditivo-legado-20260918, perfildev-gravacoes preservado (88ae8a), para provar ramo legado no código integrado.

18/09/2026 — Permuta60c9295f integrada:13/13SSR0 (66a39c), TypeScript0 (d192b9); apenas aplicadaEm seguepreferência. InvestigaçãoDCTlegado encontrou lacuna de implementação, não mera falta de teste: original exigido vem de ConclusaoAssinaturaContratual, cujo fluxo depende de preparação comercial; M01 não cria essa assinatura. Q177 enviada para definir origem histórica aprovada, nova formalização ou exclusão desta entrega. Não fabricar assinatura nem apagar preparação para obter prova positiva. DEV2documenta/testa rejeição conservadora; DEV1segueinstantesadministrativos de desistência sem alterar acerto.

18/09/2026 — Desistência: pedido e decisão administrativa integrados3374a6b2;14SSR0 (d6cab9),TypeScript0 (8fef0e). Apenas criação/decisão/efetivação seguem preferência, com fallbackUTC. DEV1segueinstantesoperacionais da fila financeira/informes, sempromessa/vencimento/competência/reguaD+30. DEV2prepara prova negativaM01semoriginalapto: devepreservar contratosalvoeterceiro e nãofabricar assinatura; soluçãopositivaaguardaQ177.

18/09/2026 — Prova negativaM01integrada692b3f67/b40f884b. Root1/1integração0 (5a29bf),TypeScript0 (9df797). Consulta recusa ausência de originalapto; tentativa realnão cria proposta/aplicação/evento nem altera matrícula/cobrança alvoououtra. Semfabricarpreparação/assinatura; aditivo positivo legado continua ausente aguardandoQ177. DEV2atualizadoembranchprópria b40f884b (26a4cb), segue somentehoráriosadministrativos na páginafinanceira de desistência; DEV1seguefila/informes.

18/09/2026 — Fila/informes02c41db9 integrados; fixture antiga de vencimento causou1falha eTS1. Corrigida referência civil em a5aab17e, com negativo A_CONFERIR:21arquivos/85testes0 (cb70f5),TS0 (053ba0). Conferência financeira de desistência6a6b5dd6 integrada, preservando ambos textos no conflitoSPEC:11SSR0 (7adcdd),TS0 (d023e2). WorktreesDEV1/DEV2 atualizados limpos para6a6b5dd6 embranchespróprias (fa05ba/56003d), agora revisão cruzada independente das duas entregas; evita nova fixture sobre base desatualizada.

18/09/2026 — Build 934d9512 aprovado: compilação, TypeScript e 87 páginas, saída 0 (77146/a2df20). Revisão independente de desistência financeira 6a6b5dd6: 11/11 SSR, saída 0 (f8b31a), TypeScript 0 (310397). Revisão de fila/informes 02c41db9+a5aab17e: 7/7 SSR, saída 0 (060831), TypeScript 0 (6b6e4a); sem achados bloqueantes. Drawer conferido pelo componente real em SSR, sem teste de clique em navegador. Próximas duas frentes limitadas: DEV1 originais/prévias documentais; DEV2 substituições documentais, apenas preferência de exibição de instantes, preservando datas civis. Q167C já consta na SPEC; destinos executáveis continuam pendentes em Q171, sem conversão automática em crédito ou dinheiro.

18/09/2026 — Regressão unitária do snapshot 659726ad aprovada: 1.956/1.956 em 352 arquivos, zero falhas/ignorados, saída 0 (54009/d24e25), relatório node_modules/.implementation/unitarias-659726ad.json conferido em c55478. Inclui os complementos financeiros integrados; não inclui as duas frentes documentais ainda nos worktrees. Auditoria de consumidores confirma uso de fuso implícito em secretaria/envios-portal e inbox; preparar lotes posteriores após concluir as duas frentes atuais. Corrigidos também escapes de quebra de linha e caractere de controle no próprio quadro, sem mudar decisões.

18/09/2026 — Históricos documentais integrados: substituições `a195c928` (DEV `b4af4c3c`) e originais/prévias `97963be0` (DEV `86d4d152`). Principal: 25/25 em 11 arquivos, saída 0 (819519), TypeScript 0 (67a32a); recorte substituições 7/7 também aprovado (bb6776). Preferência após guarda, fallback UTC, dados civis e ações preservados. Worktrees limpos atualizados para 97963be0 em branches de revisão (cc9d36/92a1a3); agentes fazem revisão cruzada independente antes do aceite.

18/09/2026 — Revisão cruzada: substituições a195c928 aprovadas pelo TESTER DEV1, 7/7 SSR (1b3c85) e TypeScript, saídas 0. TESTER DEV2 encontrou reserva.expiraEm omitida no original; corretiva 297d52cb integrada (fonte 461cfdc5). Principal: 2/2 SSR (d3e629) e TypeScript (3de0e6), saídas 0, com reserva cruzando dia e fallback/erro de preferência/guarda nas quatro páginas. Revisão da corretiva permanece pendente. Próximas duas frentes: DEV2 históricos de aditivos; DEV1 históricos operacionais de envios do portal. Vigências exigem rastreamento da fonte: não presumir que todo campo com esse nome é data civil.

18/09/2026 — Integração das preferências de equipe/portal no banco descartável principal: 6/6 em dois arquivos, saída 0 (17301/d9ebc6). Inclui conta inativa, versão/revogação e espera observada por lock; sem banco de produção. Aditivos administrativos integrados em f4d73670 (fonte 4607a17a); principal 30/30 documentais (fc5a6b) e TypeScript (4c85b6), saídas 0. Vigência permanece fora do recorte de exibição, identificada como instante contratual, não como data civil. Auditoria de HomeProfessor encontrou próxima experimental escolhida entre todas as pendentes, inclusive passadas; correção deverá preservar check-ins atrasados e separar o próximo encontro. Nenhuma mudança nessa página nesta entrega.

18/09/2026 — Avisos e portal integrados3741b000 (fonte960350ad): root11/11 em4arquivos, saída0 (df183f), incluindo projeção de decididaEm, fila, troca de e-mail e avisos da agenda. Regressão do snapshot:1972/1972 em359arquivos, zeroignorados, saída0 (12248/02133b; JSON19804e); build87páginas/TypeScript0 (8032/fc3655). DEV1 revisou f4d73670:6/6+TS0, mas observadaEm dos retornos de assinatura é projetado e não exibido; corretiva atribuída ao revisor, com revisão posterior pelo outro DEV. Vigência é instante contratual, não data civil. DEV2 implementa HOME: próxima experimental futura separada dos check-ins atrasados, preferência apenas de apresentação.

18/09/2026 — Corretiva de observações do aditivo880c4cd2 integrada: root3/3SSR (37916b), TypeScript0 (b3572e). HOME cb01167c integrada (fonte3abceb7b):21/21 em4arquivos, saída0 (08f522). Query mantém todas as pendentes do professor; referência única capturada no servidor escolhe apenas a próxima futura/atual, sem ocultar check-in atrasado. Fuso pessoal de Professor/Vendedor apenas na exibição. Worktrees limpos atualizados para cb01167c (19d32a/7ed8be): DEV1 revisa HOME; DEV2 revisa avisos3741b000 e corretiva880c4cd2. Revisões em andamento.

18/09/2026 — Revisões independentes concluídas em cb01167c: DEV1 aprova HOME,21/21 dirigidos e TypeScript com saída0; consulta ordenada, próxima >= referência única do servidor, check-ins atrasados preservados. DEV2 aprova avisos3741b000 e corretiva880c4cd2,14/14 dirigidos e TypeScript com saída0; guardas, tokens, destinatários, ações, hashes e paginação preservados. Limite de ambas: consulta mockada/SSR, sem navegador ou provedor. Root TypeScript pós-HOME0 (f82884). Próximas duas frentes: DEV1 ficha CRM, DEV2 Inbox, preferência de apresentação com preservação de inputs/datas civis.

18/09/2026 — CRM integrado01623dea/4ac93487 (fontes492843e9/cfdcdb29). Complemento inicial de teste não aprovado foi substituído antes da integração. Root:3/3 em2arquivos (2b84a7), TypeScript0 (f7db6a). Guarda bloqueia consultas/preferência; ausência/erro da preferência usa UTC; valores date-only, datetime-local e texto DatasAtualizadas permanecem iguais. Revisão independente ainda pendente. Auditoria da Inbox encontrou vencimento.toISOString() exibido por fuso do navegador; DEV2 integra a referência civil persistida já usada no Financeiro, com A_CONFERIR quando insuficiente. Não é mudança da política financeira Q176.

18/09/2026 — Inbox41e46b28 integrada (fonte92f8fd9e). Root7/7SSR0 (63c8b9), integração arquivo18/18, zeroignorados (16983/c4daf9), TypeScript0 (4301/b1ab2a). Vencimento usa fonte civil persistida; ausência mantém A_CONFERIR. A integração atual prova negativo e contrato de outro aluno; não comprova ainda fonte confirmada e dois contratos do mesmo aluno. DEV1 recebeu revisão independente e teste complementar desses casos no dev-email. Carteiras/usuários45bc5b3a integrados (fontec81d2698),4/4SSR0 (beecb9); preferência apenas nos instantes de cobertura/acesso, entradas preservadas. WorktreeDEV1 atualizado limpo45bc5b3a (d920ab).

18/09/2026 — Revisão independente do CRM encontrou desvio preexistente no detalhe DatasAtualizadas: YYYY-MM-DD convertido por new Date/toLocaleDateString pode exibir dia anterior; a fixture de teste codificava esse desvio. O aceite de preservação civil permanece aberto. Root rastreou a action: eventos reais usam ISO após parser local, portanto histórico ISO de follow-up/proposta não oferece fuso original suficiente para reconstrução arbitrária. DEV2 corrigirá apresentação literal/civil e registro explícito da fonte civil em novos eventos, sem alterar parser compartilhado nem reescrever histórico. Experimental ISO com offset permanece instante. Integrações anteriores verdes não comprovam esse ramo.

18/09/2026 — Auditoria dos consumidores restantes: carteiras/usuários já integrados; pipeline usa durações em epoch e não exige conversão de calendário. Permanecem instantes administrativos nos painéis de configuração WhatsApp, políticas de comissão, acesso às aulas e movimentações/ficha financeira. Root confirmou também que alunos/consultas.ts resumoFinanceiro retorna proximoVencimento Date e a ficha do aluno o converte para ISO/local; próximo lote deve usar fonte civil persistida para a apresentação, preservando autorização e sem modificar a política de seleção/atraso pendente de Q176. Não inferir conclusão global de fuso a partir dos recortes anteriores.

18/09/2026 — Revisão Inbox aprovada pelo TESTER:19/19 integrações,7/7SSR eTS0. Complemento independente integrado6a2994b9 (fonte0d63fd50): duas matrículas do mesmo aluno, pagadores explícitos e fontes persistidas distintas; atendimento selecionado retorna somente a fonte civil do contrato correto. Root1/1 novo,18 fora do filtro (3e16a3), saída0. Fixture materializa registros de origem; comprova consumidor/projeção, não execução integral de emissão. CRM13c8f5f3 integrado (fonteca227846): novos eventos conservam referência civil explícita válida, ISO antigo sem referência é identificado sem inferir dia, experimental com offset usa preferência. Root4/4SSR0 (7b93f2),8/8 integrações0 (517511),TS0 (5bc6ad). Worktrees limpos atualizados para13c8f5f3 (857bc2/212e04); DEV1 revisa correçãoCRM, DEV2 carteiras/usuários.

18/09/2026 — Regressão snapshot6814f675:1997/1997 em371arquivos, zeroignorados, saída0 (24098/5e48b3; JSON6cbd06). Build87páginas/TypeScript0 (50838/173d3c). Revisão independente carteiras45bc5b3a:4/4SSR+TS0 (db2002), sem achados. CorretivaCRM13c8f5f3:TESTER4/4SSR,8/8integrações eTS0, sem achados; teste positivo de instante usaZ, não assert específico de offsetnãoZ. Próximas frentes: DEV1 ficha principal do aluno/fonte civil do próximo vencimento e instantes de movimentações; DEV2 configuraçãoWhatsApp e instantes de vigência da comissão. Sem alteração da políticaQ176 nem dos inputs civis.

18/09/2026 — Configuração WhatsApp e políticas de comissão integradas4d8694b9 (fonte33536361). Root9/9 em4arquivos novos, saída0 (15f8e9), TypeScript0 (0b1834). Preferência consultada após guarda; gerente não carrega painéis administrativos. Comissão recebe preferência existente do pai e preserva vigência/ação/entrada. Testes inicialmente .tsx foram convertidos pelo DEV para .test.ts antes do commit, conforme coleta real da regressão. Revisão independente pendente; rótulo técnico de comissão em ajuste de texto separado. DEV1 segue ficha principal: mesma escolha temporal de cobrança para resumo/projeção e matrícula conferida antes das trilhas.

19/09/2026 — Ficha principal do aluno integrada em 00014ff9: vencimento usa a fonte civil da cobrança já selecionada, com conferência da matrícula e A_CONFERIR quando insuficiente. Professor continua sem resumo financeiro e sem consulta de trilhas. Histórico de movimentações usa preferência pessoal após guarda. Histórico de acesso às aulas integrado em c7b23d99: criação/decisão recebem preferência pelas três origens existentes, sem mudar restrição D+30 ou aprovações. Principal: 16/16 unitários/SSR em seis arquivos (57d608), cadastro.int.test.ts 8/8 no banco descartável de integração (sessão53402/b45926), TypeScript saída0 (740778). Revisões independentes em andamento. Não é regressão global nem homologação visual. Configuração/comissão bde09d80 também tem recorte correto de cinco arquivos/11 testes saída0 (e6ff0c), revisão independente pendente.

19/09/2026 — Revisões independentes concluídas: DEV1 no erp-dev-email aprovou AcessoAulas 708bdeb8 e configuração/comissão 33536361/3869848c, cópias e2a01a23/db931359/d26249c2; 17/17 dirigidos e TypeScript saída0. DEV2 no 9ac1 aprovou ficha 102db8e7, cópia e69b39ee: 8/8 dirigidos (0acdd8), cadastro8/8 em dev-gravacoes (90421/d0998e) e TypeScript0 (873dc8). Sem achados bloqueantes, sem homologação visual presumida. Próximas duas frentes: paginação de observações de assinatura de aditivo e instantes administrativos de ficha financeira/movimentações.

19/09/2026 — Regressão do snapshot eb99a638 concluída: vitest padrão 2019/2019 em380arquivos, zero falhas/ignorados (52907/70fab1, JSON378edc), build Next com87páginas e TypeScript saída0 (75127/3c7a60). Não inclui alterações ainda nos worktrees dos DEVs. Suíte padrão não inclui testes de integração, que permanecem comprovados pelos recortes explicitamente registrados. Duas frentes em execução: histórico completo de observações de assinatura de aditivo e preferência de exibição nos históricos financeiros.

19/09/2026 — Regressão transversal no snapshot8a1ff00d: seis arquivos CT01, vídeoCT03, CT04, CT05, CT06 e encerramentoCT10, sete testes aprovados no banco descartável de integração (sessão9132/4b8570, saída0). Comando vitest.integration com filtros por esses seis nomes; não é suíte integrada completa nem comprova todos os subcenários CT03/CT06. Revisão preliminar da paginação de aditivo identificou seleção de tentativa fora da página exibida; correção/teste solicitados ao DEV antes de integrar. Q171 reapresentada no seletor para delimitar destinos executáveis da negociação já aprovada na Q167; ainda sem resposta e sem destinação monetária presumida.

19/09/2026 — Históricos financeiros/movimentações integrados em66ac6f15 (fontef8e1ab9e): aplicação da regularização, ajuste, histórico financeiro, compra de horas, efetivação/conferência do encerramento, decisão de cumprimento e criação de pausa/retomada usam preferência pessoal com UTC de fallback. Datas civis/inputs/regrasQ176 preservados. Root: quatro arquivos/nove testes dirigidos saída0 (2bf309), TypeScript0 (3dd55c). Testes das movimentações coletados como.test.ts conferem cinco ocorrências de horário/fuso nos cinco consumidores reais extraídos; arquivo.tsx anterior não foi contado. Revisão independente solicitada ao DEV2 após concluir paginação.

19/09/2026 — Paginação de observações de aditivo integrada em58bd919e (fontee2636ced), com escopo por processo, ordem estável e rejeição de tentativa fora da página. DEV:49/49 integrações (81282/ec6939),4SSR/TS0. Root:4SSR0(c86ff1),TypeScript0(18802/b6594b); arquivo integrado completo segue na sessão22745, ainda sem conclusão. Leitura de pg_stat_activity mostrou limpeza ativa e nenhum bloqueador (e1e7b4), sem reiniciar execução. TESTERDEV1 revisa. Financeiro66ac6f15 aprovado independentemente peloDEV2 em3b94a9cf:9/9(d8e5c6),TS0(15a33c). Tile legado de último pagamento permanece fora do recorte. PróximaDEV2: acesso paginado aos pedidos de encerramento além dos50maisrecentes.

19/09/2026 — Validação integrada da paginação de aditivo concluída: src/server/contratos/aditivo.int.test.ts inteiro49/49, sessão22745/chunk228177, saída0, duração150,74s. Sem reinício da sessão. Complementa quatro testesSSR e TypeScript já aprovados; revisão independente continua separada.

19/09/2026 — Revisão independente da paginação de aditivo aprovada por DEV1, fonte e2636ced/cópiaa0074770: integração49/49 na sessão41618, SSR4/4 e TypeScript, saídas0. Vínculo matrícula/proposta/artefato, tentativa da página, ordenação de empate e links conferidos; não homologa fornecedor externo. Próxima frente DEV1: instantes de fechamentos por hora, retomadas financeiras, autorizações de comunicação e registro de cotação. Cotação classificada por leitura de salvarTaxasCambio/atualização automática: vigenteEm recebe newDate, sem data civil de entrada. Nova paginação de encerramentos do DEV2 permanece não integrada: revisão detectou helper exportado emuse-server aceitando identidade do caller; correção para sessão autenticada e parser puro solicitada antes do aceite.

19/09/2026 — Pedidos de encerramento paginados integrados em b82b3658 (fonte10a7df37). Consulta interna após sessão, revalidação de usuário ativo/papel e escopo; ordem criadoEm/id,50porpágina, links maisrecentes/maisantigos. Root5SSR/unit(08690f),2integrações(8036bb),TS0(fcd57b). Fixture contém53pedidos CANCELADA e outroaluno; prova consulta/paginação e revogação, não o fluxo público de criação/cancelamento. Revisão independente atribuída aoDEV1 após loteatual. DEV2 inicia vigências contratuais e condições porhora na preferência pessoal; sem converter camposcivis nem modificar entradas/efeitos.

19/09/2026 — Históricos operacionais integrados emcd1f13cb(fonte109115b8): criação/emissão de fechamento porhora, pausa/proposta/decisão de retomada, concessão/revogação de autorização e instante de registro da cotação usam preferência válida e fallback explícito. Períodos, vencimentos,inputs e cálculos preservados. Root4arquivos/8testes(cec29f),TS0(c078d7). DEVrelatou7testes em seu recorte; resultado do root refere-se aos quatro caminhos explicitamente executados neste checkpoint. Revisão independenteDEV2 após vigências.

19/09/2026 — Revisão independente encerramentos10a7df37/cópia2cacfc66 aprovada:5SSR/unit(0527fe),2integrações(51fe74),TS0. Regressão global unitária snapshot207be2d9:2033/2033,385arquivos,zero falhas/ignorados(9904/7e11ce;JSON858816); build87páginas/TS0(33455/074dac). Não inclui alterações posteriores nos worktrees nem substitui suíte global de integração. DEV1 segue instantes administrativos da migração; DEV2 vigências contratuais, preservando entradas e condições efetivas.

19/09/2026 — Auditoria residual de apresentação (não implementada neste registro): fechamentos-horas/page.tsx conserva três horários origem.inicio no fuso do período; próximo lote usará preferência com fallback dessa origem. FilaCobranca.tsx ultimaCobrancaEm vem de tent.ultima.toISOString em cobrancas/consultas.ts e ainda usa locale implícito. PeriodoIntegral.tsx aplicadaEm usa helperUTC fixo. Esses três consumidores são instantes identificados; não converter campos civis adjacentes. Vigências contratuais seguemDEV2 e migração administrativaDEV1; os itens adicionais aguardam conclusão das duas frentes. Datas de nascimento, início/fim de turma, pagamentos e promessas não foram classificadas como instantes por esta busca e não devem receber conversão automática.

19/09/2026 — Vigências contratuais integradas0971e47b(fonte8dd0eefa): cadastro/aditivos/original/alçadas, acerto de vencimento e condiçõeshora usam preferência pessoal. Vigência das condiçõeshora preserva d.fuso como fallback válido; administrativos usamUTC. Inputs e instanteDaGrade, ISO/efeitos e vencimentos civis inalterados. Root6arquivos18tests(22dfa9),TS0(3ecc98), incluindo offsetnãoZ e fallback. RevisãoDEV1 após migração. Operacional109115b8 recebeu inspeção independenteDEV2 semachados; testes no checkout próprio ainda solicitados, sem declarar executados. DEV2 assume3residuaisoperacionais após validar esse commit.

19/09/2026 — Históricos de migração integradosc38a03b6(fonte26a5b162): preferência pós-guarda em conciliação/lote, instantes de resolução/proposta/aplicação/conflitos/ensaios; pagamentos,datetime-localhistórico,DATE e snapshots preservados. Root21/21 em5arquivos(16fede),TS0(d06b0d). RevisãoDEV2 apósloteresidual. Auditoria root abriu verificaçãoQ47/Q48: TurmaFormulario chama criarTurma, cujo TurmaSchema ainda exige fim>início no mesmo dia e dataFim; TurmasPainel calcula rótulo de situação por datas. Confirmar percurso completo de cadastro→grade e fonte de status antes de corrigir; testes isolados da grade não comprovam esse percurso. DEV1audita após revisar vigências.

19/09/2026 — Lacuna confirmada no percurso de cadastro Q47: TurmaFormulario.validar rejeita horarioFim<=horarioInicio e exige dataFim; criarTurma consome TurmaSchema com a mesma restrição. academico/grades/nova somente lista turmasPLANEJADA jácadastradas e prepara agenda com horárioinicial+duração; portanto não fornece criação alternativa sem horáriofictício. Schema legado10/10(181047) passa justamente exigindo rejeição da regra antiga, não prova cumprimentoQ47. DEV1prepara correção do percurso e auditoria de consumidores antes de alterar dataslegadas. Preservar meta pornível, encerramento pela gestãoQ48 e aprovação da publicação.

19/09/2026 — Três resíduos de instantes integradosd8d233a0(fonte349d3767): início dos encontros no fechamento usa preferência com fallback do período, última cobrança usa instante administrativo, aplicação de período integral recebe preferência pós-guarda. Root3arquivos10tests(b64adc),TS0(8026e5). Revisão independente operacional109115b8:DEV2snapshot8fffe804,3arquivosalterados/5tests(159adc),TS0; root4/8 incluía também página financeira do aluno preexistente. Revisão migração26a5b162:DEV2snapshot9e1d204c,4arquivosalterados/14tests(ecfa88),TS0, semachados; root5/21 incluía testes preexistentes do diretório configuração/lote. Recortes distintos, não equivalentes, ambos explicitamente registrados.

19/09/2026 — Revisão independente vigências8dd0eefa aprovadaDEV1em de131b9b:18/18dirigidos eTS0. AuditoriaQ47/Q48confirmada por doisagentes: cadastroUI/schema bloqueia atravessarodia e exige fimmanual; painel ignora statuscanônico. Implementação atribuídaDEV1incluiUI/servidor/importador, fimmanualopcionalnovo, preservaçãolegadoedição e fonte duração coerente, statusprojetado na página. SemDDL:campos jánullable. Aceite exige criação real→preparação→aprovação/publicação de grade noturna, com conflitos/calendário preservados. DEV2 audita consumidores dataFim/horarioFim e exceçõesQ37 independentemente; não declararcorreção concluída por estaatribuição.

19/09/2026 — Continuação da auditoria Q47/Q48/Q161: DEV2 recebeu o recorte de comprovação automática de oferta. oferta-continuidade-agenda-tx.ts veta por dataFim legado antes de conferir a agenda; corrigir sem afrouxar vínculo, calendário, docência ou cobertura efetiva. Ausência de dataFim não comprova continuidade. DEV1 mantém cadastro/importação/painel e publicação noturna como primeira frente. Próximo recorte identificado, ainda não implementado: consultas de destinos em academico/consultas.ts e alunos/consultas.ts, além de impedimentoEstadoAcademico em academico/regras.ts, também dependem de dataFim legado; a correção deve abranger consulta e execução, com fotografia/revalidação da agenda, preservando capacidade e aprovação. Não basta retirar o filtro da tela. Q167C conferida no quadro: concordância das partes e aprovação específica por caso já registradas; destinos executáveis Q171 permanecem pendentes, sem presumir crédito financeiro ou devolução.

19/09/2026 — Q161 integrada em5d6ab8fc/5c296fe3 (fontes f213b208/3387db9d): eliminada recusa baseada na dataFim legada quando agenda vigente comprova oferta. Preservadas conferências de vínculo, calendário, docência e encontros; dataFim futura/nula sem agenda continua insuficiente. Revisão corrigiu fixture que dizia noite local mas representava meio-dia; agora cobre travessia real e fim exclusivo à meia-noite em Pacific/Kiritimati, além de cancelamento terminal. Integrador: oferta-continuidade-agenda-tx e disponibilidade-oferta-tx,14/14 em2arquivos (63829/068f61); TypeScript concluído na mesma sessão, saída0 a90d16. SPEC Q161 atualizada. Recorte unitário, não suíte integrada nem aceite global. DEV2 inicia revisão independente da entrega noturna DEV1, ainda em implementação.

19/09/2026 — Q47/Q48 integrada em3f8ca710 (DEV9c8cd19a). Cadastro/formulário/importador permitem virada de dia e dispensam dataFim no novo cadastro; duração/frequência conferidas sob lock da modalidade. Edição preserva referências e exceções quando grade não muda; mudança em agenda publicada continua bloqueada. Painel projeta status canônico. Revisões encontraram e corrigiram bypass da duração pela edição, revalidação indevida da frequência aprovada e descarte de data final inválida no importador. Principal: três arquivos completos q47-criacao-noturna, regra-turma e integridade-academica,30/30 sem ignorados, sessão92122/6ddeae saída0; quatro arquivos unitários/SSR22/22, sessão31294/b3360a, TypeScript terminale8682a saída0. A execução completa de integridade sem resultado terminal no DEV não foi contada; reexecução principal terminou normalmente. SPEC atualizada. DEV1 agora revisa Q161 e resíduos operacionais; DEV2 implementa disponibilidade/snapshot dos destinos acadêmicos. Sem migração, envio externo ou push nesta entrega.


19/09/2026 — Regressão global unitária a67af640: 392 arquivos,2.054 testes aprovados,zero falhas/pendentes; terminal33637/a61537 saída0, JSON node_modules/.implementation/unitarias-a67af640.json conferido emc55c94. Build mesmo snapshot com DATABASE_URL exclusivamente do perfil descartável integracao,87páginas+TypeScript,94584/f38334 saída0. Não inclui WIP destinos ou próximo atalho de agenda. Revisão independente Q161 DEV1nos snapshots03611416/467ddf1b:14/14 doisarquivos eTS0 (f6c07b),sem bloqueador. Resíduos operacionais349d3767 revisados emdd480517:10/10 trêsarquivos+TS0 (16bda4),sem bloqueador. Auditoria operacional do próprio DEV emQ47 identificou falta de atalho cadastro→geração da agenda; complemento atribuído ao DEV1, enquantoDEV2 implementa destinos por agenda/fotografia. Não confundir revisão do próprio autor com aceite independente da entregaQ47.

19/09/2026 — Atalho operacional de turma integrado77ca5d4e/be78729e (fontes7cdade9e/7b8273f6). Criação encaminha à preparação com seleção validada pelo servidor; painel oferece próximo passo; parâmetro turmaId repetido e turma inelegível recusados. Revisão root detectou regressão na primeira versão: edição retorna sucesso sem dado e era tratada como falha. Correção separa criação/edição; teste exerce controlador realmente chamado pelo formulário, não somente composição de URL. Principal:3arquivos6/6 eTS0, saída terminal4052f5. SPEC atualizada; sem homologação visual presumida. DEV1 passa à revisão independente do WIP de destinos doDEV2; a regressão global registradaa67af640 não inclui este complemento.

19/09/2026 — Revisão de destinos por agenda encontrou incompatibilidade adicional: replanejamento-decisao.ts altera encontros futuros e publica novo calendário, preservando a propostaGradeTurma original. Portanto exigir igualdade entre calendarioId da grade histórica e calendário vigente bloqueia destinos legítimos após replanejamento aprovado. DEV2 deve reconhecer a cadeia atual aprovada sem reescrever o histórico nem aceitar calendário divergente por simples ausência de erro; incluir publicação inicial → alteração aprovada do calendário → destino disponível e invalidação de proposta anterior. DEV1 confere essa fonte independentemente. O consumidor Q161 conserva o mesmo limite com fallback de confirmação pedagógica; correção posterior deve preservar esse fallback e provar a cadeia. Frente ainda não integrada; testes antigos de grade/calendário iguais não comprovam este caso.

19/09/2026 — Auditoria independente confirmou um fluxo sem saída no calendário sem impacto: decisão simples recusa qualquer encontro PREVISTO existente; decisão conjunta recusa revisão sem remarcações alteradas. Segunda frente atribuída ao DEV1: permitir aprovação/aplicação conjunta de revisão válida sem alterar encontros, preservando independência, fonte, conflitos e histórico, sem avisos de remarcação inexistente. Reserva técnica268, se necessária:20260919000000_calendario_sem_remarcacoes; nenhuma aplicação autorizada ao DEV e nenhuma migração aplicada neste registro. DEV2 mantém destinos; sua fonte precisa reconhecer também essa aplicação sem remarcações. Revisão dos snapshots exige conservar leitura/retry autorizado de v1/v2 sem promovê-los a aprovação nova e distinguir alteração futura relevante de conclusão normal de aula passada. Implementação e aceite continuam pendentes.

19/09/2026 — Corretiva268 congelada no commit8cce2181 e aplicada pelo integrador somente no perfil dev-email (erp_genius_test_dev_email,localhost:54329), migrate deploy saída0cd003d. SHA256 DBC3859AFA3E0AE88DE42AF081CD6580F94389BCC699154CFA98AECBA2B4A651. Guard167 preserva evento/decisão, cardinalidade e bijeção; exige arrays explícitos e revisões estruturalmente completas antes de aceitar conjunto sem remarcações. Bytes aplicados imutáveis. Código e cenários públicos/negativos seguemDEV1; nenhuma integração no banco principal ou aceite funcional presumido. Próxima corretiva, se necessária,269 ainda não reservada a outra frente.

19/09/2026 — Calendário sem remarcações integrado em103e25d4 (fonte66e04dab), SQL268 emd5eec4f8 e formato fixado3307314f. Migração aplicada no perfil integracao, saída0 4fd146. Prisma diagnoseMigrationHistory somente leitura confirmou268 fora das migrações editadas após conferir equivalência LF/CRLF; não houve reset nem edição de checksum. Diagnóstico também apontou oito divergências históricas anteriores, ainda não resolvidas:20260912130000_itens_emissao_entrada,20260914233000_decisao_substituicao_recuperacao,20260915000000_regularizacao_reposicao_guardrails,20260915003000_agenda_reposicao,20260915013000_integridade_entrega_portal,20260915060000_participantes_aditivo,20260915125000_agenda_inicial_segunda_chamada,20260915138000_preservacao_cobrancas_desistencia. Não declarar histórico global limpo. Integrador: novos cenários2/2(82b7af),TypeScript0(f2819e); regressão de cinco arquivos de replanejamento9/9, sessão5759/e32776 saída0. Primeira regressão encontrou fixture adversarial sem listas obrigatórias; fixture completada para continuar verificando ausência do segundo efeito material, sem afrouxar a guarda. Cobertura inclui autoaprovação, foto obsoleta, SQL malformado, atomicidade, concorrência, avisos e conjunto vazio. SPEC F07.3 atualizada. Testes usam criação direta da turma e publicação real da grade/calendário; não constituem homologação visual ou suíte global. Destinos acadêmicos continuam em implementação no DEV2; banco dev-gravacoes sem conexões no diagnóstico461546, e cenário dirigido posterior passou1/64 com63 filtrados, sem substituir a suíte completa.

19/09/2026 — Ambiente DEV2 atualizado pelo integrador, com WIP preservado: SQL268907f324d, formatoe61e99cf e fluxo12085a6b. Aplicação no perfil dev-gravacoes concluída com saída0ffcb04; arquivo alinhado ao SHA256LFdbc3859afa3e0ae88de42af081cd6580f94389bcc699154cfa98aecba2b4a651. Sem envio externo ou alteração de dados reais. Diagnóstico adicional do histórico principal3170a6/1d5671 distinguiu tentativas revertidas de aplicações vigentes: sete das oito divergências relatadas pelo engine correspondem a tentativas antigas com rolled_back_at; as sete aplicações concluídas têm bytes idênticos ao checkout. Resta divergência real de checksum em20260915138000_preservacao_cobrancas_desistencia, inclusive após normalizarLF/CRLF; origem ainda não confirmada. Não editar o histórico/checksum nem chamar esse diagnóstico de saneamento concluído. DEV2: arquivo fluxo teve62/64 aprovados, saída1; retries legados em correção. Revisão independente encontrou comparação indevida de aulas passadas e ausência de bijeção na cadeia do calendário; helper ajustado, provas negativas e regressão ainda pendentes. Esses resultados não são aceite da transferência.

19/09/2026 — Convergência de ambiente por migração aditiva269, integrada e9c8de93 (DEVf4182957). A função instalada preservar_cobranca_cancelada_apos_desistencia conservava retorno CASE; o arquivo histórico já versionado usa IF DELETE/RETURN OLD/RETURN NEW. Não alterar138000 nem seu checksum. Nova CREATE OR REPLACE reproduz o corpo canônico, sem mudar os triggers nem regredir impedir_baixa_cobranca_desistencia, também usada por DestinacaoRecebimento. Aplicações:dev-email saída0fb8b0a; integracao saída0b0c8f3; SHA256BF1F36C7108411742366E35BA8E00B2793E7CA10680990B4DE2788210B3CC0BA, formato fixado antes do deploy. Consulta pós-aplicação confirmou corpo de pg_proc e checksum iguais à269(dbaeb9). Baseline anterior2/2,8filtrados(1c257e); após269, arquivo completo desistencia-financeiro.int.test.ts10/10, sessão83917/718942 saída0. Portanto convergência do ambiente, sem alegar falha funcional nos ramos já aprovados. Divergência histórica138000 permanece registrada; não declarar histórico Prisma limpo. DEV acrescenta prova do caminho permitido anterior à efetivação e preservação posterior; ainda não contar esse complemento como entregue. DEV2 mantém transferências com regressão e evidências pendentes.
19/09/2026 — Corretiva 269 de desistência aplicada pelo integrador somente no banco descartável `dev-email`: reconcilia `preservar_cobranca_cancelada_apos_desistencia()` ao corpo canônico versionado, sem editar a migração 20260915138000 nem checksums. `desistencia-financeiro.int.test.ts -t "preserva cobrança originalmente|permite alterar"`: 3/3, 8 filtrados, saída 0 (perfil `dev-email`); TypeScript `--noEmit` saída 0. O teste cobre UPDATE/DELETE recusados após efetivação e UPDATE/DELETE permitidos para cobrança cancelada sem efetivação. Não é regressão global nem integração externa de assinatura.

19/09/2026 — Complemento269 integrado19a82cda (fontefd720a13): principal3/3 com8filtrados no recorte `preserva cobrança originalmente|permite alterar`, saída0 6c1239; TypeScript0c75d56. Preservadas as evidências do arquivo completo10/10 anterior ao novo caso. DEV1 passa à comprovaçãoQ161 após replanejamento, sem modificar o helper de destinos doDEV2; fallback pedagógico continua obrigatório quando a cadeia ou a cobertura não comprovar oferta. DEV2 segue regressão de destinos e revisão das alterações posteriores aprovadas. Nenhum aceite global ou homologação externa presumido.
19/09/2026 — Q161: a fonte automática de continuidade passa a reconhecer a cadeia calendário→revisão→decisão→aplicação para grade histórica após replanejamento, guardando a âncora e o hash na memória. Aulas MINISTRADO preservadas podem compor o período; CANCELADO, fotografia divergente ou cadeia sem aplicação exigem confirmação da Gestão. Unitários de âncora/oferta: 18/18, saída 0 (e2d51c). Integração real de publicação e revisão sem remarcações: 2/2, saída 0 (d3ccf9), incluindo fotografia tornada obsoleta dentro de transação com rollback. TypeScript saída 0. Não emite cobrança nem substitui a confirmação humana.


21/09/2026 — A pedido do usuário, Q161 transferida para codex/consolidacao-specs-20260916 por cherry-pick552b86e7/be99b3ca, resultando0914a7a1/a9d97763. Conflito exclusivamente documental resolvido preservando ambos os históricos. Verificação principal: cadeia-calendario-oferta.test.ts e oferta-continuidade-agenda-tx.test.ts19/19, saída0 1ee694; TypeScript sessão71029/186590 saída0. Tentativa replanejamento-sem-remarcacoes.int.test.ts não iniciou: setup do banco descartável integracao falhou, saída1 498efc; nenhum teste integrado aprovado nesta tentativa. A revisão anterior continua aberta: comparação rígida de status pode exigir confirmação indevida após evolução legítima PREVISTO→MINISTRADO; alterações individuais posteriores aprovadas também precisam de suporte. Integrado não significa Q161 integralmente concluída. Sem push nesta operação.

## Infraestrutura — correção Prisma/OpenSSL em Alpine 3.24 (25/09/2026)

**PR #127** — `cursor/fix-prisma-openssl-alpine-99a4`

### Problema identificado
A imagem `node:22-alpine` flutuante resolveu para Alpine 3.24 que vem com `libssl.so.3` mas sem o binário `openssl`. Isso causou:
- Falha na detecção do OpenSSL pelo Prisma 5.22 (warning e fallback para openssl-1.1.x)
- Engine errado gerado (`linux-musl` em vez de `linux-musl-openssl-3.0.x`)
- Serviço `migrate` falhando com exit 1
- Queries no runtime falhando (mas `/api/health` permanecia verde)

Verificado em produção no servidor Coolify.

### Solução implementada
1. **Dockerfile**:
   - Pin da imagem base com digest: `node:22-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`
   - Base stage comum com `apk add --no-cache openssl` (evita repetição)
   - `ENV HOSTNAME=0.0.0.0` no runner (Next standalone precisa bind em todas as interfaces)
   - Checagens REAIS dos engines no build (engine errado quebra o build, não a produção):
     - builder: `prisma migrate status` contra `127.0.0.1:1` tem de devolver `P1001`, o que só acontece
       se o schema engine (o do serviço `migrate`) executou;
     - runner: `new PrismaClient().$connect()` contra `127.0.0.1:1` tem de falhar com `errorCode P1001`,
       o que só acontece se o query engine nativo do standalone carregou. A versão anterior
       (`require('@prisma/client')`) não carregava o engine e deixaria passar um engine errado.

2. **Endpoint `/api/ready`**: 
   - Readiness check com `SELECT 1` via Prisma (detecta DB inacessível ou engine quebrado)
   - Retorna 200 em sucesso, 503 (`{ ready: false }`) em falha
   - Timeout de 3s, com o timer limpo ao final de cada chamada
   - Rota pública: o detalhe do erro (host/porta do banco, mensagem do engine) vai só para o log
   - Testes unitários com mock do Prisma client (200 em sucesso; 503 em erro/timeout/resultado
     inesperado; erro não exposto; timer limpo; HEAD = GET)

3. **Healthcheck atualizado**:
   - `docker-compose.coolify.yml` usa `/api/ready` (valida DB + Prisma)
   - `/api/health` mantido como pure liveness (sem dependências externas)
   - `SETUP.md` atualizado com a distinção

### Verificação relatada pelo Cursor Agent (commits 318989f4/af60eb96, NÃO reexecutada na revisão)
Vale para a versão anterior dos checks de build; a linha "sem `apk add openssl` falha no build-time
check" foi obtida com o check antigo (`prisma --version | grep`), não com os checks atuais.
- ✅ Build completo: builder e runner concluídos
- ✅ Prisma detecta `linux-musl-openssl-3.0.x` sem warnings
- ✅ Migrate: 436 migrações aplicadas de banco vazio (exit 0); segunda execução no-op (exit 0)
- ✅ Runtime: `/api/health` 200, `/api/ready` 200, query `SELECT 1` funciona
- ✅ `/api/ready` retorna 503 após parar o Postgres (validado localmente)
- ✅ Testes unitários `/api/ready`: 200 em sucesso, 503 em erro/timeout/resultado inesperado

### Testes de mutação confirmados
| Cenário | Build | Runtime |
|---------|-------|---------|
| ✅ Completo (com apk + pin + HOSTNAME + checks) | ✅ OK | ✅ Funciona |
| ❌ Sem `apk add openssl` | ❌ **Falha no build-time check** | N/A |
| ❌ Sem `ENV HOSTNAME=0.0.0.0` | ✅ OK | ❌ **wget localhost falha (Connection refused)** |
| ❌ `/api/ready` sempre 200 (sem query) | ✅ OK | ⚠️ **Teste unitário falha** |

### Verificação da revisão (25/09/2026, Windows, sem Docker)
- `vitest run src/app/api/ready src/app/api/health`: 2 arquivos, 11/11 testes, saída 0 (vitest 4.1.9 do
  `node_modules` do checkout principal, resolvido por Node, sem junction; não é o ambiente do integrador).
- Mutações em `/api/ready`: sem `clearTimeout` → 1 teste falha; devolvendo o erro na resposta → 2 falham.
- Checks do Dockerfile, com o texto exato após a junção de linhas do Docker, rodados em `sh` com os
  engines Windows: engine OK → saída 0; `PRISMA_SCHEMA_ENGINE_BINARY` inválido → saída 1;
  `PRISMA_QUERY_ENGINE_LIBRARY` inválido → saída 1 ("Unable to require"). Não prova o comportamento
  no Alpine: isso exige `docker build`.
- Digest `sha256:0a7108bf…e402` conferido no registry do Docker Hub: é o de `node:22-alpine3.24`
  (e também o de `node:22-alpine` nesta data).
- Trava unitária do Dockerfile (R2 B1), `src/deploy/dockerfile-prisma.test.ts`: lê o Dockerfile como o
  Docker (sem comentários, continuações juntadas, por estágio) e EXECUTA o JS da checagem do runner
  contra um `@prisma/client` falso. Rodada com ready+health: 3 arquivos, 21/21, saída 0.
  13 mutações, todas detectadas (saída 1): remover/comentar/`echo` no `apk add`; base sem pin; runner
  fora de `base`; remover a checagem do builder ou trocá-la por `|| true`; runner com `process.exit(0)`,
  com comentário imitando a checagem, aceitando qualquer erro ou rodando antes do COPY do standalone;
  sem `ENV HOSTNAME`; healthcheck do Coolify de volta para `/api/health`.
- `binaryTargets` (R2 B2) continua fora por decisão do usuário: a garantia passou a ser a checagem que
  CARREGA os engines no build (se a detecção falhar, o build quebra), travada pelo teste acima.
- Suíte unitária completa neste ambiente: 473 arquivos, 2476 passaram e 14 testes falharam em 18 arquivos, todos
  alheios ao PR (pacotes ausentes no `node_modules` do checkout principal: `pdfkit`, `google-auth-library`;
  enums de um client Prisma de outro schema; `coolify-db-init.test.ts` falha em checkout Windows com
  `core.autocrlf=true` porque o compose vem em CRLF). Nenhum arquivo que falhou referencia os arquivos do PR.
- TypeScript global NÃO validado: o `tsc` com o `node_modules` do checkout principal usa um client
  Prisma de outro schema e gera erros alheios; nenhum erro em `api/ready`/`api/health`.

### Verificação na VPS (25/09/2026, relatada pelo usuário, não reexecutada pelo agente)
- Imagem com digest, openssl no estágio `base`, `HOSTNAME=0.0.0.0` no runner e `binaryTargets` fora
  do schema conferidos.
- `docker build`: as duas checagens de engine passaram (builder `migrate status` e runner `$connect`).
- 436 migrations aplicadas num Postgres 16 vazio; a segunda rodada deu "No pending migrations".
- Testes de `/api/ready` e `/api/health`: 11/11.
- `/api/ready` via 127.0.0.1: 200 com o banco no ar; banco derrubado → 503 em 3s sem expor o erro;
  volta a 200 quando o banco retorna.
- **Defeito encontrado:** o healthcheck do compose (`wget http://localhost:3000/api/ready`) falhava
  SEMPRE com "connection refused". O wget do BusyBox resolve `localhost` para `::1` (IPv6) e não tenta
  o IPv4, e o Next com `HOSTNAME=0.0.0.0` escuta só IPv4. O mesmo comando com `127.0.0.1` passa.
  Correção: healthcheck em `http://127.0.0.1:3000/api/ready`, travado em
  `src/deploy/dockerfile-prisma.test.ts` (falha com `localhost` ou `[::1]`). Após a correção: 22/22,
  saída 0; 15 mutações detectadas, entre elas a volta para `localhost`.

### Pendências
- **Confirmar redeploy no Coolify** com o healthcheck em 127.0.0.1: container `healthy`, migrate com
  saída 0, `/api/ready` 200 e HTTPS em produção.
- **TypeScript** (`tsc --noEmit`) no ambiente preparado pelo integrador.

**Estado**: Implementado e validado na VPS (relato do usuário); aguardando o redeploy no Coolify. Não concluído.


## Inbox WhatsApp — nome do contato com o perfil da própria linha (29/09/2026)

### Problema identificado (produção)
Várias conversas da linha Baileys apareciam com o nome do dono da linha ("Diogenes Mendes"). Causa: o
`messages.upsert` com `fromMe: true` (mensagem enviada pelo app do celular) traz no `pushName` o
perfil de QUEM ENVIOU. O webhook repassava esse nome sem olhar `fromMe`, e o `garantirContato`
guardava o primeiro nome para sempre. Toda conversa iniciada pelo celular ficava com o nome da linha.
O caminho de histórico já ignorava `fromMe`; só o tempo real estava sem a trava. Um nome contaminado
também podia virar nome de lead (auto-captura e "Criar lead").

### Solução implementada (PR #131, com as correções da revisão)
- **Schema:** nova coluna `ContatoWhatsApp.nomePerfil` (migração `20260929120000_contato_whatsapp_nome_perfil`,
  aditiva). `nomeExibicao` passa a ser só o nome dado pelo ERP; webhooks escrevem apenas `nomePerfil`.
  Legado: contato sem vínculo e sem nenhuma intenção originada pelo ERP tem o nome movido para `nomePerfil`.
- **Ingestão:** `processarMensagemNormalizada` descarta o pushName de `fromMe`; mensagem recebida atualiza
  `nomePerfil` (o mais recente vale). O histórico usa o perfil mais recente do próprio contato no lote.
  Nome dado pelo ERP (pagador empresa, "Gestor comercial") não é mais sobrescrito por pushName.
- **Exibição** (`nome-contato.ts`, único ponto): aluno do atendimento → lead → responsável do contato (fora
  do COMERCIAL) → nome do ERP → nome de perfil → número. Sem "Contato institucional"; o pedagógico sem
  cadastro continua "Atendimento pedagógico". O mesmo helper serve a triagem, as revisões de envio e as
  saudações simuladas. Criação de lead usa nome do ERP → perfil.
- **Busca:** também em `nomePerfil` e no nome do responsável (fora do COMERCIAL, como na exibição).
- **Reparo:** `scripts/reparar-nome-contato-whatsapp.ts`, somente leitura por padrão. Com `--aplicar`, usa
  uma transação por contato e limpa o nome igual ao perfil da linha nas duas colunas (`NomeContatoReparado`).
  Leads com o mesmo nome só são listados.

### Verificação (Windows, worktree sem node_modules; executáveis do checkout principal)
- Unitários por arquivo (não é a suíte completa): `nome-contato`, `busca-inbox`, `consultas-inbox`, `historico`,
  `webhook/evolution/route`, `InboxCliente`, `operacoes-atendimento`, `comercial/consultas`: 8 arquivos,
  65/65, saída 0.
- `inbound.test.ts` NÃO roda neste ambiente: o Prisma Client gerado no checkout principal está atrás do
  schema (falta `MotivoPendenciaAvisoAgenda`). A falha já existia.
- 3 falhas em `financeiro/consultas-saldo-taxas` e `financeiro/operacoes` se repetem idênticas no commit
  base `9059924c`: não vêm desta mudança.
- **TypeScript não aprovado:** com o client desatualizado, `tsc --noEmit` sai com 2. Nos arquivos desta
  entrega, os únicos erros novos são sobre `nomePerfil`, coluna que o client antigo não conhece.
- Migração não aplicada em banco nenhum: não há `.erp-test-profile` neste worktree.

### Pendências
- Integrador: confirmar o ID de migração `20260929120000`, regenerar o client, rodar `tsc --noEmit`,
  `inbound.test.ts` e as integrações WhatsApp (`linha-comercial`, `inbox`, `acesso-atendimento`) num perfil isolado.
- Produção: aplicar a migração e rodar o reparo, primeiro somente leitura; depois da conferência pelo
  usuário, `--aplicar`. Renomear na tela de Leads os leads listados com o nome da linha.

**Estado**: Implementado; aguardando o integrador (migração, TypeScript, integrações) e o reparo em produção. Não concluído.

## Inbox WhatsApp — editar o nome do contato (29/09/2026)

### Pedido
O contato pode usar no perfil do WhatsApp um nome errado ou inútil. A equipe precisa salvar o nome certo na própria conversa.

### Solução implementada (PR #132, com as correções da revisão)
- **Ação** `editarNomeContatoWhatsApp`: grava o nome salvo (`nomeExibicao`, até 80 caracteres). Vazio limpa o
  nome e a tela volta ao perfil do WhatsApp ou ao número.
  - **Alcance:** quem vê o atendimento (renomear não envia nada, então vale também para atendimento encerrado ou
    com pagador trocado), nunca no pedagógico, e só se o usuário enxerga TODOS os atendimentos do contato
    (`contatoSoNoAlcance`; ADM sempre). Assim um vendedor não renomeia o contato que o Financeiro também atende.
  - **Concorrência:** a gravação só vale se o nome atual ainda for o que a tela carregou (`nomeAnterior`);
    se outra pessoa salvou antes, a ação recusa.
  - **Auditoria:** `ContatoRenomeado` (doc 12). Capacidade `whatsapp.editar_contato` registrada no doc 37.
- **Schema:** coluna `ContatoWhatsApp.nomeEditadoEm` (migração aditiva `20260929130000_contato_whatsapp_nome_editado`).
  Depois de a equipe editar ou limpar o nome, os fluxos do ERP (cobrança, aviso de agenda, abrir atendimento)
  não o preenchem mais, então a limpeza não se desfaz sozinha.
- **Aviso de agenda:** o contato nasce com o nome do destinatário real (responsável autorizado ou aluno), não
  mais com o primeiro nome do aluno no telefone do responsável.
- **Tela:** botão "Editar nome" no cabeçalho, com painel que mostra o perfil do WhatsApp como referência. Quando
  o nome exibido vem de um cadastro, o painel avisa: aluno ou lead próprio têm link para a ficha; lead de outra
  carteira, pedir a correção a quem cuida dele; responsável, a correção é da Secretaria. Os links de ficha saem
  de um único helper (`hrefCadastro`).
- Telefone não é editável: é a identidade do contato no WhatsApp.
- **Script de reparo:** `--manter` aceita os últimos dígitos e lista o que cada um exclui, avisando quando pega
  mais de um contato.

### Verificação (executáveis do checkout principal; client Prisma desatualizado)
- Unitários por arquivo (não é a suíte completa): `editar-nome-contato`, `nome-contato`, `InboxCliente`,
  `consultas-inbox`, `busca-inbox`, `operacoes-atendimento`, `botoes`, `AtendimentosPainel`, `page`, `historico`:
  10 arquivos, 75/75, saída 0.
- `comunicacoes-agenda/quantidade-transporte.test.ts` não carrega neste ambiente (enum ausente no client
  desatualizado, mesma falha já existente do `inbound.test.ts`).
- TypeScript não aprovado. Os únicos erros novos são sobre `nomeEditadoEm`, coluna que o client antigo não conhece.

### Pendências
- Integrador: confirmar o ID de migração `20260929130000`, regenerar o client, rodar `tsc --noEmit`,
  `quantidade-transporte` e as integrações WhatsApp num perfil isolado.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## E8 — portal público (docs/43 §6 item 8; 13/10/2026)

### Solução implementada (branch `claude/e8-portal-publico`)
- `/portal-aluno/ativar` (L2626, L2627, L2629, L2630): o segredo do link vai para o `sessionStorage` da aba antes de sair
  da barra e é relido no F5; sem link, a tela não mostra o formulário e oferece "Pedir um novo link" e "Já tenho senha:
  entrar". Regra da senha escrita (12 caracteres, 72 bytes) com contador, "Repita a senha" que bloqueia o envio,
  `autoComplete="new-password"` nos dois campos, `useAcaoCliente` + `FeedbackAcao` (e-mail validado é sucesso, 422 tira o
  formulário, falha de rede tem instrução própria).
- `/portal-aluno/recuperar` (L2639, L2641, L2642): a confirmação só aparece com a resposta aceita, numa região de status já
  montada; recusa e falha de rede viram alerta com o formulário preenchido. A confirmação é a mesma para qualquer e-mail.
- `/pagar/[token]` (L2567, L2568, L2569, L2570, L2571, L2572): quadro próprio para link inválido, link expirado, cobrança
  paga, cancelada, vencida e pendente; só pendente e vencida mantêm o caminho de pagamento; `robots: noindex`.
- `/login` (L2553, L2555): o guard manda `/login?callbackUrl=<caminho>` (o caminho chega pelo `src/proxy.ts`) e o login
  volta para lá só se for caminho interno (`src/lib/destino-interno.ts`); queda de rede no `signIn` vira mensagem.
- Botões de login, pagar, entrar, ativar e recuperar em `Botao`/`botaoClasses`, sob a trava `botoes.test.ts`.

### Verificação
- Não executada neste worktree (sem node_modules). Testes novos e travas alteradas listados na PR; o integrador roda.

### Pendências
- Integrador: rodar a suíte unitária, `tsc --noEmit` e eslint; conferir o `src/proxy.ts` (primeiro proxy do projeto) no UAT.
- `/api/portal-aluno/token` devolve 422 também para a senha que o Zod recusa; a tela evita o caso validando antes.
- Link de troca de e-mail (`VALIDAR_TROCA_EMAIL`) cai na mesma tela, que sempre manda senha; a rota recusa esse caso.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## E10 — borda de rota (docs/43 §6 item 10; 13/10/2026)

### Solução implementada (branch `claude/e10-borda-rota`)
- `loading.tsx` com o formato da tela em `/matriculas/[id]`, `/academico`, `/diario` e `/secretaria` (título, linha de
  apoio, busca e cartões; as abas, quando a área tem, ficam com o layout), `/configuracao` (só a tabela: o layout já
  tem o h1 e as sub-abas), `/login` (cartão de acesso), `/pagar/[token]` e `/certificado/[codigo]` (título e cartão no
  centro). As rotas existem com esses caminhos; `/pagar` e `/certificado` só existem com o parâmetro.
- C3 da #170 confirmado na leitura: o `(painel)/loading.tsx` do financeiro desenhava título e abas dentro do layout que já
  os desenha. Agora desenha só indicadores e tabela; o `EsqueletoAbas` saiu.
- `error.tsx` de área onde o doc 42 pede: acadêmico, alunos, configuração (título h2, abaixo do h1 do layout), diário,
  financeiro, matrícula, secretaria e o lote comercial (leads, pipeline, carteiras, comissões, empresas, inbox). Cada um
  com o título da área, "Tentar de novo" (`reset`), `VoltarPara` ao índice da área (ao início quando é o índice que
  falha) e nada de `message`/`digest`. Nas páginas públicas `/pagar/[token]` e `/certificado/[codigo]`, o erro deixa de
  cair no `global-error` ("fale com um administrador") e fala com quem recebeu o link.
- `<Suspense>` nas telas que o doc cita: `/academico/reposicoes` (o `Conteudo`, com uma consulta por gravação) e
  `/matriculas/[id]/preparacao` (a prontidão da Secretaria, que vinha encadeada depois da consulta principal). O guard
  continua sendo a primeira instrução; contrato de dados e permissões não mudaram.
- Travas: `src/app/borda-rota.test.ts` (listas fechadas em `borda-rota-mapa.ts`, anúncio acessível, error.tsx sem
  `error`, Suspense obrigatório, autotestes) e `src/app/borda-rota.render.test.ts` (render de cada loading e error).

### Verificação
- Não executada neste worktree (sem node_modules). Verificação: pelo integrador (suíte unitária, `tsc --noEmit`, eslint
  e mutação).

### Pendências
- Na primeira entrada numa área com layout (ex.: da Secretaria para `/matriculas/X/preparacao`), quem cobre a espera do
  layout é o `(app)/loading.tsx` genérico; o esqueleto da área aparece depois, dentro do layout.
- Sem loading próprio: `matriculas/nova`, as sub-rotas de `configuracao/whatsapp` (layout com abas próprio) e
  `/portal`. Sem error.tsx próprio: `home`, `preferencias` e `acesso-negado` (o de `(app)` basta) e `/login`.
- Conferir no navegador (UAT) o esqueleto do financeiro na troca de aba e o fallback dos dois `<Suspense>`.

**Estado**: Implementado; aguardando o integrador. Não concluído.

**Atualização de 13/10/2026 (integrador):** mergeada pela #174 (`4c4f526a`). Ver "Entregas desde a #133". Falta conferir no UAT o esqueleto do financeiro e os dois `<Suspense>`.

## ConfirmarAcao, fatia B (issue #169; 13/10/2026)

### Solução implementada (branch `claude/fu169-confirmacoes-b`)
- 13 ações novas no mapa fechado `src/app/confirmacoes-mapa.ts` (cópia literal em `confirmacoes.test.ts`), cada uma só
  dentro da prop `acao` de um `<ConfirmarAcao>`, com a consequência escrita e erro/incerto dentro do diálogo: encerrar
  país (L2428, com o nome digitado e as colunas Produtos/Preços/Alunos), "Faltou" (L2693), vincular contato e opt-out
  (L2298, com "mínimo de 12 caracteres"), aprovar replanejamento (L1102) e quantidade de aulas (L1218, as duas com
  "Conferi…"), presença histórica (L2499, decisão vazia e botão com o nome da ação), desativar usuário (L2413), idioma
  e preço (L2340, com aviso de combinação sem preço), inativar empresa (L2281, action nova `definirSituacaoEmpresa`
  com estado-alvo explícito), revogar cobertura (L2244) e "Aprovar e enviar lote" (L2018, revisão com nome, valor e
  degrau; sem `try/catch` solto).
- Ativação da régua (L2517): consulta nova só de leitura `estimarAlcanceRegua`; a regra de quem recebe saiu do cron para
  `decidirEnvioCron` (`src/server/whatsapp/alcance-regua.ts`), usada pelo cron e pela contagem. O diálogo diz
  "N pessoas vão receber…".
- `ConfirmarAcao` ganhou `digitacao` (nome exato antes de confirmar). Sem schema nem migração.

### Verificação
- Não executada neste worktree (sem node_modules). Testes de interação por tela (`*.confirmacao.test.ts`), testes do
  servidor com Prisma em mock (`alcance-regua.test.ts`, `estimar-alcance.test.ts`, `empresas/situacao.test.ts`).

### Pendências
- Integrador: suíte unitária completa, `tsc --noEmit`, eslint e mutação; `cron.int.test.ts` num perfil isolado
  (o cron passou a usar `decidirEnvioCron`).
- Desvincular contato pela inbox (L2298) precisa de action nova e regra de permissão: fora desta fatia.
- Alternadores de usuário, idioma e preço continuam invertendo o estado atual no servidor (contrato existente).

**Estado**: Implementado; aguardando o integrador. Não concluído.

## E11 — amostra Média/Baixa com nova semente (docs/43 §6 item 11; 13/10/2026)

### Entrega (branch `claude/e11-amostra-media-baixa`, só documentação)
- Doc 43 §7.6: amostra de 126 dos 727 achados Média/Baixa com a semente 20261013 (`node scripts/medicao-ux/amostra.mjs 6 3 20261013`), na `main` `4c4f526a` (depois da #174). Cada achado tem veredito e evidência `arquivo:linha`.
- Estimativa estratificada: **66,8% abertos (IC 95% 58,7–74,9%), ≈ 486 achados**. A §7.3 (semente 42, `e5418550`) deu 58,9% (IC 50,3–67,5%); os intervalos se sobrepõem. Não é amostra pareada.
- 21 dos 126 achados coincidem com a semente 42. Dois deles passaram de aberto para resolvido com a #172 (L2553, L2567). Os 105 novos dão 68,0% abertos.
- Padrões com mais abertos: layout e hierarquia (20), texto e microcopy (17) e validação de campo (17).
- Nota no item 11 da tabela da §7.5.

### Verificação
- Vereditos só por leitura de código. O UAT não foi aberto e o app não foi rodado.
- A estimativa usou `estimativaEstratificada` de `scripts/medicao-ux/nucleo.mjs`. O mesmo cálculo, com as contagens da §7.3.2, reproduz os 58,9% (50,3–67,5%).
- Sem mudança em `src/`. A suíte não foi rodada; o `medicao-ux.test.ts` lê as seções 2.1, 4 e 5 do doc 43, que não mudaram.

### Pendências
- Ações sem confirmação fora das fatias A e B de `confirmacoes-mapa.ts`: L325, L1479, L2019 e L2142. A L2142 tem efeito financeiro.
- O `<p role="alert">` devolvido pela página no erro de consulta continua; os `error.tsx` da #174 não o substituem (8 achados da amostra).
- As métricas de fluxo da 7.7 continuam sem medição.

**Estado**: Medição entregue (docs). Os achados medidos seguem abertos conforme o doc 43 §7.6.

## FU170 grupo A — pendências menores da issue #170 (13/10/2026)

### Entrega (branch `claude/fu170-grupo-a`)
- C10: a conferência de reserva sem resultado usa `MSG_RESULTADO_INCERTO_SEM_CHAVE`; trava nova em `mensagens.test.ts` (nenhuma tela escreve "Resultado não confirmado" à mão).
- C17: célula e planilha de alunos com o rótulo do filtro (`rotuloTurmaAcademica`: código · nome · modalidade · idioma nível).
- C21: `ThemeToggle` com uma fonte só (`src/lib/tema.ts`, `useSyncExternalStore` sobre a classe `dark`) e `aria-pressed`. A trava de `botoes.test.ts` passa a exigir grupo rotulado só para conjunto de seleção.
- C22/C23: 57 páginas entraram no mapa da trilha (eram 60 de 181 fora); 3 ficam em `FORA_DA_TRILHA`, com motivo e teto, em `trilha.test.ts`. A volta de `tentativas/*/autorizacao` diz "Avaliador da recuperação" (L1617).
- C36: "Abrir Financeiro" na emissão só para quem abre `/financeiro` (`abreFinanceiro`).
- C52 (parte): `TurmasPainel` com `formatarDataCivil`; o `PagarCliente` já não formatava data. Trava nova em `datas-civis.test.ts` para `new Date(campo civil).toLocaleDateString`, com 2 usos contados (FichaEmpresa e InformesPagamento).
- C1 da R1 da #174: o erro do hub da matrícula volta para `/home`.
- D4 e D6: `docs/18` (e o comentário de `globals.css`) sobre `--ai-solid`/`--brand-solid`; cabeçalho da SPEC-ERP-005 e linha do índice.

### Verificação
- Não executada neste worktree (sem node_modules). Verificação: pelo integrador (suíte unitária, `tsc --noEmit`, eslint e mutação).

### Pendências
- C52: `FichaEmpresa.tsx:190` (fora deste grupo, PR #175) e `InformesPagamento.tsx:38` (conferir se `dataPagamento` é dia ou instante).
- C23: os `VoltarPara` com href dinâmico continuam sem trava.

## E9 — consultas e dados no servidor (docs/43 §6 item 9; 13/10/2026)

### Entrega (branch `claude/e9-consultas-servidor`)
- Fila de cobrança (`/financeiro/cobrancas`) em trechos de 50 por cursor nos dois sentidos (`depois`/`antes`), com o filtro da URL da #144 mantido. O cursor leva a chave de ordem da fila (`prioridade_atraso_id`), e por isso pagar o item do cursor não faz a próxima pular ninguém. A consulta lê a fila inteira só com o que ordena, filtra e conta. O detalhe pesado (vencimento civil, destino, envios, respostas, mensagem) é lido só para o trecho, com `take`. O lote só leva o que está na tela.
- Informes a conferir (`/financeiro/informes`) viraram fila por cursor (30 por vez). O número da aba vem de um `count`.
- Lote de migração (`/configuracao/migracao/[loteId]`): linhas paginadas (25 por página, `Paginacao`) e o JSON de cada linha e de cada tentativa divergente dentro de `<details>` fechado.
- Importação de alunos: a linha que repete um aluno já cadastrado, ou uma linha anterior da mesma planilha, é ignorada e volta com o motivo. Critérios: documento no mesmo país, ou nome + e-mail, nome + telefone ou nome + nascimento. No modal, depois do resultado, o botão passa a ser "Importar outra planilha" (docs/42 L224).
- Envios do portal: abas "Incertos" (padrão), "Falhas" e "Todos" na URL (`?situacao=`), mantidas no cursor (docs/42 L431).
- `/pipeline`: **retirado desta PR na integração (16/10)**. A Fase 1C (#191) remove a tela `/pipeline` com o resto da casca do CRM antigo; alterar arquivos que ela apaga só criaria conflito. O funil volta a ser tratado no CRM novo.
- Travas atualizadas: `paginacao-dois-sentidos` (2 filas novas), `estados-vazios-mapa` e `botoes-mapa`.

### Verificação
- Testes novos ou atualizados: `fila-cursor`, `fila-contadores`, `filtros-fila`, `fila-informes`, `fila-envios`, `consultas-lote`, `importacao-duplicidade`, `route.test` da importação e os de tela (cobranças, informes no painel, envios, lote, modal de importação, FilaCobranca).
- Integrador (16/10, com a `main` depois das #177, #178, #189 e #190): `tsc` 0; suíte unitária completa 655/655 arquivos, 4.644/4.644 testes; eslint 0; 22/22 mutações da PR KILLED com controle, e C1 da R1 (o detalhe repete o recorte de situação) KILLED com controle. Testes de integração não rodados (#162).

### Pendências
- A fila de cobrança ainda lê todas as cobranças abertas na passada leve, porque a ordem e os cartões dependem da régua calculada em memória. Um `take` real nessa leitura exigiria gravar o estado da régua no banco, o que pede migração e não foi feito.
- A deduplicação não tem índice único: duas importações simultâneas ainda podem duplicar. Um documento só é achado no cadastro quando lá está igual ao da planilha ou sem pontuação: "8822-1381" no cadastro e "88221381" na planilha não casam. Resolver isso pede uma coluna normalizada com índice único, ou seja, migração.
- `listarAlunos` ainda carrega as cobranças de cada aluno (`src/server/alunos/consultas.ts:226-229`), no máximo 50 alunos por página. Não foi alterado para não colidir com a `claude/fu170-grupo-a`, que mexe na mesma função.
- A thread da inbox cortada em 300 mensagens é da issue #168.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Design system, bloco DS-B — botão em pílula (Fase 0, Task 5; 15/10/2026)

### Solução implementada (branch `claude/fase0-ds-b-botao`)
- `src/components/Botao.tsx`: `BASE_BOTAO` em pílula (`rounded-full`, `gap-2`) com 44 px de altura mínima abaixo de
  `sm` (`max-sm:min-h-11`); desabilitado sem opacidade (`disabled:bg-surface-muted disabled:text-disabled
  disabled:border-gray-200`) e `aria-busy:cursor-progress`.
- Variantes: `secundario` com `border-border-soft`, sem fundo, texto `text-brand-700` e hover `bg-highlight`;
  `fantasma` com hover `bg-highlight`; `primario` e `perigo` sem mudança. Tamanhos `sm px-3 py-1`, `md px-4 py-1.5`,
  `lg px-[22px] py-2.5`.
- `<Botao ocupado>` marca `aria-busy="true"` e desabilita o botão.
- `src/components/Botao.test.ts`: pílula e 44 px, disabled sem opacidade, ocupado com `aria-busy` e `disabled`,
  secundário sem fundo e com hover `highlight`. Doc 18 (Botão) atualizado.

### Verificação
- Na HEAD `8d17003`: `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0, 647 arquivos e 4.576 testes (linha
  de base da main: 646 e 4.560); `npm run lint` saída 0, 0 erros e 44 avisos.
- Sem schema nem migração; `*.int.test.ts` não alterados.

### Pendências
- Conferir no navegador (UAT) o botão nos dois temas, inclusive os estados desabilitado e ocupado.
- Telas que montam botão sem `Botao`/`botaoClasses` não mudam neste bloco.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Design system, bloco DS-B — campos de formulário (Fase 0, Task 6; 15/10/2026)

### Solução implementada (branch `claude/fase0-ds-b-campos`)
- `src/app/globals.css` (`@layer base`): `input` (exceto checkbox/radio), `select` e `textarea` com fundo
  `--surface-muted` e raio 8 px; `:disabled` com `--text-disabled` e `cursor: not-allowed`; `textarea` com
  `min-height: 90px` e `resize: vertical`; abaixo de 767 px, `input` e `select` com `min-height: 44px` (o `textarea`
  mantém os 90 px). Classe utilitária explícita (ex.: `bg-surface`) continua vencendo a base.
- `ROTULO_CAMPO` em `src/components/Campo.tsx`: `text-sm font-medium text-gray-800` (14 px, peso 500); dica e erro
  seguem em 12 px.
- Doc 18 com a seção "Campos de formulário". Travas em `src/components/Campo.test.ts` e
  `src/app/design-system.test.ts`.

### Verificação
- Na HEAD `c7d98f1` (revisão final): `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0, 647 arquivos e
  4.578 testes (linha de base da main: 646 e 4.560); `npm run lint` saída 0, 0 erros e 44 avisos, todos preexistentes
  e em arquivos fora do diff (ex.: `src/server/migracao/planilha-acoes.ts`).
- Recorte da Task 6: `Campo.test.ts`, `campos.test.ts`, `design-system.test.ts` e `contraste.test.ts`, 71 testes
  passando.
- Sem schema nem migração; `*.int.test.ts` não alterados.

### Pendências
- Conferir no navegador (UAT) os campos nos dois temas, no celular (44 px) e no desktop.
- Demais componentes base e telas: blocos seguintes da Fase 0.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Design system, bloco DS-B — avisos, estados e movimento reduzido (Fase 0, Task 9; 15/10/2026)

### Solução implementada (branch `claude/fase0-ds-b-avisos`)
- `src/components/Aviso.tsx`: caixa única de aviso (`rounded-md p-3 text-sm` + tom). Tons `info`, `sucesso`, `atencao`
  e `erro`; os três últimos com borda inicial de 3 px. Papel `alert` no erro e `status` nos demais (`papel="nenhum"`
  quando a região anunciante é outra).
- `FeedbackAcao`, `MensagemStatus` (prop `tom` nova), `ErroArea` (via `EstadoRota aviso="erro"`) e
  `AvisoFusoNaoConfigurado` passam a usar o `Aviso`, sem mudar as props existentes.
- Esqueleto pulsa (`animate-pulse`). O `@media (prefers-reduced-motion: reduce)` de `src/app/globals.css` desliga
  animação, transição e rolagem suave (teste em `src/app/design-system.test.ts`).
- `docs/18-design-system.md`: seção "Avisos e movimento reduzido".

### Verificação
- Revisão final (diff `9ead958..51e683d`): `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0, sem filtro,
  648 arquivos e 4.586 testes (linha de base da main: 646 e 4.560); `npm run lint` saída 0, 0 erros e 44 avisos, todos
  preexistentes e fora dos arquivos da task.
- Sem schema nem migração; `*.int.test.ts` não alterados.

### Pendências
- Conferir no navegador (UAT) os avisos nos dois temas e o esqueleto com movimento reduzido.
- Demais tasks do DS-B (5–8 e 10) e DS-C seguem nos próprios PRs.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## 2026-10-15 — Fase 0 DS-B: modal, confirmação e drawer (Task 7)

- Branch `claude/fase0-ds-b-camadas`, empilhada sobre `claude/fase0-ds-a-fundacao` (`9ead958..cb121aa`; Task 7 `9ead958..e0269c3`).
- Tarefa: Task 7, Modal, ConfirmarAcao e Drawer como camadas elevadas (`bg-surface-raised`, `shadow-dialog`, `rounded-dialog`, bordas lógicas).
- Verificação (HEAD `cb121aa`): `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0 (647 arquivos, 4.578 testes; linha de base da main: 646 e 4.560); `npm run lint` saída 0 (0 erros, 44 avisos, os mesmos da base).
- Sem schema nem migração; `*.int.test.ts` não alterados.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Design system, bloco DS-B — navegação (Fase 0; 15/10/2026)

### Solução implementada (branch `claude/fase0-ds-b-navegacao`)
- Sidebar: item `min-h-10 max-sm:min-h-11 rounded-item`, `hover:bg-highlight`; item ativo com seleção suave
  (`bg-brand-bg text-brand-800 font-medium`); contador de não lidas `bg-brand-solid text-on-brand`.
- Barra mobile: mesmos estados da sidebar; botões com `max-sm:min-h-11 max-sm:min-w-11`; os itens da gaveta (a mesma
  `NavLinks`) chegam a 44 px abaixo de `sm`. `BarraMobile.test.ts` trava esses estados.
- Sub-abas em pílula (`rounded-full`, `max-sm:min-h-11`), ativa `bg-brand-solid text-on-brand`.
- Seção "Navegação" do `docs/18-design-system.md`. A estrutura de menus (`src/lib/nav.ts`) não muda.

### Verificação
- Na HEAD `2c181aa`: `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0 (647 arquivos, 4.577 testes; linha
  de base da main: 646 e 4.560); `npm run lint` saída 0 (0 erros, 44 avisos).
- Sem schema nem migração; `*.int.test.ts` não alterados.

### Pendências
- Conferir no navegador (UAT) a sidebar, a gaveta mobile e as sub-abas nos dois temas.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Design system, bloco DS-B — primitivos (Fase 0, Task 10; 15/10/2026)

### Solução implementada (branch `claude/fase0-ds-b-primitivos`)
- Primitivos novos em `src/components`: `Chip`, `ItemLista` (com `aria-current`), `Avatar` (iniciais da primeira e
  da última palavra) e `Menu` (painel `shadow-popover`, item de perigo, alvo de 44 px abaixo de `sm`). Documentados no
  doc 18 ("Primitivos — Chip, ItemLista, Avatar e Menu"); `brand.bg` mapeado no `tailwind.config.ts`.
- `src/lib/popover.ts` (puro): `posicaoPopover` (lado com mais espaço, limitado à margem), `proximoIndiceMenu` e
  `acaoTecladoMenu`. Com o foco fora dos itens (gatilho), a seta para baixo vai ao primeiro e a seta para cima ao último.
- Menu dentro de diálogo: o teclado do menu é ouvido em `document` na fase de captura. O Escape fecha só o menu
  (`stopPropagation`) e devolve o foco ao gatilho. Um Modal, Drawer ou ConfirmarAcao em volta (`useDialogo`) continua
  aberto, e o Tab segue para o diálogo, que mantém o foco preso.
- O painel é `position: fixed`. Scroll (captura, em qualquer lista) e resize fecham o menu, para ele não ficar solto
  sobre outra linha.
- Teste de interação sem DOM (`Menu.interacao.test.ts`): `useDialogo` ligado com `document` falso que entrega captura
  antes da bolha. Cobre Escape com diálogo e menu abertos, ArrowUp a partir do gatilho, Tab, scroll e resize.
- `src/app/botoes.test.ts`: exceções com motivo para Chip, ItemLista e Menu.

### Verificação
- Depois das correções da revisão final: `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0, 653 arquivos e
  4.606 testes (linha de base da main: 646 e 4.560); `npm run lint` saída 0, 0 erros e 44 avisos (nenhum em arquivo do
  bloco).
- O novo teste de Escape falha se o ouvinte do menu voltar à fase de bolha. Isso foi conferido.
- Sem schema nem migração; `*.int.test.ts` não alterados.

### Pendências
- Falta conferir no navegador (UAT): o menu dentro do drawer, a posição perto das bordas e os dois temas.
- O focar após o posicionamento (`visibility` do painel) é ligação de DOM sem teste automatizado, porque não há jsdom.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Verificação do integrador: bloco DS-B (2026-10-15)
- Branch: `claude/fase0-ds-b-primitivos` (empilhada sobre `claude/fase0-ds-a-fundacao`). Tarefa 10: Chip, ItemLista, Avatar e Menu.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 653 arquivos e 4.606 testes (linha de base da main: 646 e 4.560).
- `npm run lint`: saída 0.
- Sem schema nem migração; testes de integração não alterados.

## Design system, bloco DS-C: conferência visual e ajustes finais (Fase 0, Task 11; 15/10/2026)

### Solução implementada (branch `claude/fase0-ds-c-conferencia`)
- Junta DS-A e os seis DS-B (botão, campos, camadas, navegação, avisos, primitivos) com merge sem squash. Conflitos
  só de documentação (`quadro-entregas.md`, `docs/18-design-system.md`, mantidas todas as seções) e da contagem
  de exceções em `src/app/botoes.test.ts` (Chip 1, Menu 1, Sidebar 1, combinando navegação e primitivos).
- 70 capturas (claro e escuro, 1440 e 390 px) de login, home, alunos, matrícula nova, financeiro, secretaria,
  acadêmico, diário, configuração (turmas e WhatsApp), inbox, modal, drawer, menu do celular e formulário com erro.
  Achados e correções em `docs/planejamento/ds-capturas.md`: 19 corrigidos, 4 pendências fora do recorte.
- Correções principais: sombra do drawer fechado vazando na borda; estouro horizontal no celular (sr-only da
  `ColunaOrdenavel`, selects do inbox); abas do financeiro, chips da fila e dias da turma em pílula; detalhe da
  cobrança e diálogo de turma como camada elevada (`bg-surface-raised`, `shadow-dialog`, véu 60%); anel de foco
  duplo (`focus:ring-*`) removido, com trava em `paleta.test.ts`; links da secretaria separados.

### Verificação
- Na HEAD `9718acf`: `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0, 654 arquivos e 4.647 testes
  (DS-A + 6 DS-B mergeados, antes das correções: 654 e 4.636); `npm run lint` saída 0, 0 erros e 44 avisos
  preexistentes.
- Servidor de produção (`npm run build` + `next start`) contra `erp_genius_test_tester`; recaptura sem estouro
  horizontal em 390 px.
- Sem schema nem migração; `*.int.test.ts` não alterados.

### Pendências
- "Exportar planilha" isolado acima do título em Alunos; links recuados na ficha do aluno; ✕ cru no detalhe da
  cobrança; `Menu` ainda sem tela que o use.
- Mergear por último na Fase 0, depois de DS-A e dos seis DS-B.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Fase 3, bloco A: modelo do atendimento por setor (16/10/2026)

- Branch `claude/fase3-a-modelo-atendimento`, criada sobre `integracao/ate-fase-1` (d4c0f74); desde a R1 do PR #197 a base
  é o `main`, mesclado na branch (B1: `Lead` → `Oportunidade` da #193). Tarefas 1 a 8 do plano
  `03-fase-inbox.md`: número por setor, status e prazos do atendimento, reabertura, grupos, origem CELULAR/IA com
  `clientMessageId`, preferências do inbox por usuário. Cinco migrations (`20261016090000` a `20261016130000`).
- Verificação (banco `tester`): `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0, 646 arquivos e 4.627 testes;
  `npm run lint` saída 0, 0 erros e 44 avisos. Integração relacionada (`vitest related -c vitest.integration.config.ts`
  sobre os 53 arquivos alterados): 78 arquivos, 876 verdes, 21 falhas, todas preexistentes (ver abaixo).
- Falhas de integração: as 7 da linha de base (6 em `academico/visibilidade`, 1 em `whatsapp/inbox`) mais 14 em
  `agenda/substituicao-avisos` (3), `agenda/replanejamento-concorrencia`, `diario/reposicao-agenda` (7),
  `diario/reposicao-permissoes`, `diario/calendario-reposicao` (1 cada). Essas 14 falham igual rodando o código de
  `integracao/ate-fase-1` neste banco (sensíveis à data de hoje, 16/10/2026, e ao ambiente); anotadas, não são do bloco.
  `cobrancas/resposta-contrato` quebrava pelo CHECK `Atendimento_status_encerrado` e foi corrigido no teste (4/4 verdes).
- IDs de migration: confirmados pelo integrador em 16/10/2026, registrados no ledger de execução (ver "Fase 3 — IDs de migration").

### Revisão R1 do PR #197 (16/10/2026)
- **B1**: `main` mesclado; `atribuirDono` usa `tx.oportunidade.update` e mantém o `updateMany` de status; três
  `*.int.test.ts` passaram a `prisma.oportunidade`.
- **B2**: conflito aditivo com a #194 (`schema.prisma`, `labels.ts`, `enums-rotulos.test.ts`); quem integrar em segundo
  lugar mantém os dois lados. Resolvido em 17/10/2026 no merge do `main` (`683bf3e5`, após o merge da #194): os dois lados mantidos.
- **B3** (R3): conflito com a #195 no import de `@prisma/client` de `enums-rotulos.test.ts`, resolvido no merge do
  `main` (`46f69962`): o import mantém os enums da #194, da #195 e desta PR. Migrations: 20261001/20261002/20261003 do
  `main`, depois as 20261016* desta PR.
- **C1**: o mapeamento papel → setor tem uma fonte só (`src/server/crm/setores-papel.ts`, reexportado por
  `crm/permissoes.ts`). O inbox usa `setoresVisiveisNoInbox` (`whatsapp/setor.ts`), que acrescenta só as extensões do
  plano 03, Tarefa 1: PROFESSOR → PEDAGOGICO e a Q1 (`SECRETARIA_VE_FIN_PEDAG`, provisória "mantém"). A branch da
  Fase 3B (`escopo.ts`) precisa trocar `setoresDoUsuario` de `./setor` por `setoresVisiveisNoInbox`.
- **C2**: `listarResponsaveisTriagem` e `salvarSetoresNumero` só aceitam papéis de triagem dos setores do número
  (`papeisDeTriagem`: papéis nativos, sem PROFESSOR, ALUNO nem ADMINISTRADOR, que já é o padrão).
- **C3**: assumir, devolver e transferir pela inbox **ainda não mexem no status** neste bloco. Isso entra no
  **bloco C** do plano 03 (PR C, ações de atendimento), não no bloco B (escopo e roteamento): Task 15 (`assumirAtendimento`
  → `EM_ATENDIMENTO`, `devolverParaFila`, `atribuirAtendimento`, com `proximoStatus` da Task 5) e Task 16
  (`transferirAtendimento` encerra a origem com `ENCERRADO` e abre outro). Até lá, só `atribuirDono` e a criação mexem no status.
- **C4**: IDs `20261016090000` a `20261016130000` confirmados pelo integrador em 16/10/2026 (ordem coerente: depois de
  20261001/20261002 da #194). A confirmação é do integrador, registrada no ledger de execução, e não da revisão R1.
- Verificação (HEAD de código `a2120aa4`, 17/10/2026): `node_modules/.bin/tsc --noEmit` saída 0; `npm run lint` saída 0,
  0 erros e 43 avisos; `node_modules/.bin/vitest run` saída 0, 658 arquivos e 4.759 testes. Integração (recorte, não
  suíte completa) no banco descartável `erp_genius_test_fix197` (`prisma migrate deploy` limpo, apagado depois): os 14
  `*.int.test.ts` novos ou tocados pelo PR (`acesso/politica`, `cobrancas/resposta-contrato` e 12 de `whatsapp/`:
  `acoes-numero`, `atendimento-pedagogico-autorizacao`, `atendimento-status`, `destinatario-atual`, `grupos`,
  `linha-comercial`, `numero-setor`, `origem-celular`, `pagador-contrato`, `pg-proc-whatsapp`, `preferencias`,
  `reabertura`), 99 testes, todos verdes.

**Estado**: Implementado; aguardando o integrador. Não concluído.


## Fase 3, Task 13: regressão de escopo (E5)

- Branch `claude/fase3-b-escopo-roteamento` (Tasks 9 a 13), empilhada sobre o bloco A.
- Mudanças de comportamento aceitas (tabela da Task 13, redução deliberada de visibilidade da Q1, `escopo.ts`):
  - FINANCEIRO deixa de ver todo atendimento FINANCEIRO com aluno (antes `{ finalidade: "FINANCEIRO", alunoId: { not:
    null } }`). Agora vê o próprio (`responsavelId`), a fila sem responsável dos números que servem FINANCEIRO e os
    atendimentos em que é participante vigente.
  - SECRETARIA_ACADEMICA deixa de ver todo SECRETARIA, PEDAGOGICO e FINANCEIRO com aluno. Agora vê o próprio, a fila dos
    números que servem os setores dela (Q1) e os atendimentos em que é participante vigente. Consequência coberta por
    teste: SECRETARIA encerra PEDAGOGICO só pela fila (`destinatario-atual.int.test.ts`).
  - GERENTE_COMERCIAL passa a ver todo COMERCIAL (`linha-comercial.int.test.ts`, LC-04).
  - Fora da tabela, vindo de E4 (`f2af0cdb`): SECRETARIA sem aluno é destinatário roteado, não triagem
    (`linha-comercial.int.test.ts`).
- Vazamento da fila COMERCIAL (lead de outro vendedor em número sem dono, bug do escopo da Task 9): corrigido em
  `04b1d345` (fila COMERCIAL só sem lead: `{ ...ramoFilaDoSetor('COMERCIAL'), leadId: null }`). As falhas que ele
  causava em `acesso-atendimento` (2) e `preferencias` (2) passam.
- Aguardando aval do integrador/produto: `c265d904` muda `inbox.int.test.ts` ("lead de OUTRO vendedor vinculado ao número
  de A não vaza o cockpit"), de `toBeNull()` para thread visível com `lead` e `contato.leadId` nulos. Não é mudança de
  E5. É a falha da linha de base (main f8a9c0e), resolvida no conflito doc 36 x LC-D02/SPEC-ERP-005 a favor de LC-D02,
  regra que já existia: o dono da linha vê todas as conversas da linha (`donosDeLinhaVisiveis`, já em `d4c0f74`). O
  cockpit de lead de outra carteira continua fechado. Se o aval for negado, reverter `c265d904` e manter o caso como
  falha conhecida da linha de base. Ruling em `.superpowers/sdd/rulings-claude_fase3-b-escopo-roteamento.md`.
- Verificação (banco `tester`, HEAD da correção da revisão final):
  - `node_modules/.bin/tsc --noEmit`: saída 0 (linha de base: 0).
  - `npm test`: saída 0, 647 arquivos e 4.634 testes (linha de base: 643 e 4.607).
  - Recorte da Task 13, unitário (`vitest run src/server/whatsapp src/server/uploads`): saída 0, 25 arquivos e 197
    testes.
  - Recorte da Task 13, integração (`vitest run -c vitest.integration.config.ts src/server/whatsapp src/server/uploads`):
    saída 0, 29 arquivos e 225 testes. Inclui a falha da linha de base de `whatsapp/inbox`, que passa por causa de
    `c265d904` (ver acima).
  - Revisão final (registro do revisor): `financeiro-matricula`, `pagador-contrato` e
    `atendimento-pedagogico-autorizacao` com 20/20.
- Pendente do integrador antes do PR: `npm run test:int` completo, que não foi rodado nesta faixa (mais de 2 h, regra do
  integrador). Esperado: só as 6 falhas da linha de base em `academico/visibilidade`, mais as 14 sensíveis à data
  anotadas no bloco A.
- `npm run lint`: saída 0, 0 erros e 44 avisos (linha de base: 0 erros).

### Fase 3B: verificação de abertura do PR (2026-10-17)

- Branch `claude/fase3-b-escopo-roteamento`, tarefas 9 a 13, base `claude/fase3-a-modelo-atendimento`. Banco `tester`.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 647 arquivos e 4.634 testes (a primeira execução teve 1 timeout de 30 s em `confirmacoes.test.ts` por carga
  do container; o arquivo passa isolado e a suíte inteira passou na repetição).
- `npm run lint`: saída 0, 0 erros e 44 avisos.
- Integração dos arquivos tocados (`destinatario-atual`, `escopo-grupos`, `inbox`, `linha-comercial`, `roteamento`,
  `triagem-numero`): saída 0, 6 arquivos e 69 testes.
- `vitest related -c vitest.integration.config.ts` sobre o diff arrastou dependentes transitivos sem relação com o bloco
  (agenda, diário, academico/visibilidade) e foi interrompido após ~17 min sem terminar. Falhas parciais observadas:
  `academico/visibilidade` (6, linha de base conhecida) e `agenda/substituicao-avisos`, `diario/reposicao-*`,
  `diario/calendario-reposicao`, `agenda/replanejamento-concorrencia` (serialização 40001), que o bloco não toca e não foram
  comparadas com o main. Pendente para a suíte completa do integrador.

### Fase 3B: revisão R1 do PR #199 (17/10/2026)

- **B1:** `origin/claude/fase3-a-modelo-atendimento` (`83d473f4`) e `origin/main` (`f4ded562`, com a #196) mesclados
  (`b0ffdff6`, `e3dad326`). Conflito só neste quadro: seções da 3A e da 3B mantidas. `escopo.ts` passa a usar
  `setoresVisiveisNoInbox` (`whatsapp/setor.ts`) no lugar de `setoresDoUsuario` nas duas chamadas (`escopoAtendimentos`
  e `escopoGrupos`). Como as duas tiram o PROFESSOR antes, o resultado é o mesmo da função antiga para todo papel
  (`escopo-setor.test.ts` verde). `triagem-numero.int.test.ts` usa `prisma.oportunidade.create` (trava de
  `oportunidade-map.test.ts`).
- **B2, Ruling:** o E3.4 define o participante como convite explícito (Task 17), não como efeito de abrir. Por isso
  `abrirAtendimentoInstitucional` não inclui quem abriu como participante: depois do `garantirAtendimento`, se o
  atendimento tem outro responsável e está fora do escopo de quem abriu, recusa antes de gravar
  `AtendimentoInstitucionalAberto`, com "Este atendimento já está com <nome>; peça para ser incluído como participante."
  Teste: `whatsapp/abrir-atendimento-escopo.int.test.ts` (dois FINANCEIRO no mesmo número e matrícula, participante
  vigente pode abrir, SECRETARIA_ACADEMICA em SECRETARIA e em FINANCEIRO de outro responsável). Sem a correção, 2 dos 3
  casos falham.
- **C1:** `docs/specs/whatsapp-linha-comercial.md` (LC-D02 e LC-04) atualizada para a regra da Fase 3 (E3.2, Task 13):
  o GERENTE_COMERCIAL vê as conversas de todo COMERCIAL; a carteira do lead continua restrita à equipe.
- **C2:** a lista de triagem para o responsável do número (não admin) fica para a tela do inbox novo (Tasks 29 a 31).
  Até lá, `inbox/page.tsx` só mostra a triagem ao ADMINISTRADOR; o servidor já aceita o responsável.
- **C3:** o aval do `c265d904` continua pendente com o integrador/produto; se negado, reverter antes do merge.
- **C4:** confirmado. FINANCEIRO e SECRETARIA deixam de ver encerrados de que não foram responsáveis nem participantes
  (a fila é só de abertos, tabela da Task 13). O histórico do setor para o atendente fica para a consulta de histórico
  do inbox novo (Task 26), se o produto pedir.
- **C5 e verificação** (banco `tester` recriado do zero com `prisma migrate deploy`, porque o anterior tinha as 2026100*
  aplicadas depois das 20261016*):
  - `node_modules/.bin/tsc --noEmit`: saída 0;
  - `npm run lint`: saída 0, 0 erros e 43 avisos;
  - `node_modules/.bin/vitest run`: saída 0, 667 arquivos e 4.822 testes (sem o teste novo de integração);
  - integração de `src/server/whatsapp` inteiro mais os `*.int.test.ts` do diff contra a 3A fora dele (`crm/funil`,
    `crm/historico`, `crm/oportunidades`, `crm/pessoas`, `matricula/preparacao-escopo`): saída 0, 34 arquivos e 249
    testes. `academico/visibilidade` (usa `abrirAtendimentoInstitucional`): as 6 falhas conhecidas da linha de base.
  - O `vitest related` interrompido da verificação de abertura foi substituído por essa integração dos arquivos tocados.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## Fase 3, bloco D: tempo real (Tasks 21 a 23)

- Integrador autorizou `pg` 8.23.1 e `@types/pg` 8.23.1 (16/10) para o LISTEN da Task 21

## CRM, bloco B: Oportunidade, capacidades e etapas do funil (Fase 2, Tasks 3 a 5; 16/10/2026)

### Verificação antes do merge (branch `claude/fase2-b-oportunidade`, HEAD `435b10e`)
- `node_modules/.bin/tsc --noEmit` saída 0.
- `npm test`: 646 arquivos e 4.630 testes; 4.629 passaram. A única falha foi um timeout de 30 s em
  `src/app/confirmacoes.test.ts`, com a suíte de integração rodando em paralelo no mesmo container. Rodado
  sozinho, o arquivo passa: 59 de 59.
- `prisma migrate status` no perfil `dev-gravacoes`: 438 migrations, banco atualizado.
- `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
  --exit-code` no perfil `dev-gravacoes`: saída 2. O script de diferença tem 1.232 linhas: FKs recriadas,
  índices renomeados por truncamento e defaults de `CURRENT_TIMESTAMP AT TIME ZONE 'UTC'`. O mesmo diff contra o
  `schema.prisma` do main `d4c0f74` sai byte a byte igual, e nenhuma linha cita `"Lead"`. A deriva já existe
  no main; o `@@map("Lead")` não acrescenta nenhuma diferença.
- Integração no perfil isolado, só os 30 `*.int.test.ts` tocados pelo bloco ou que citam `oportunidade`. A
  suíte completa leva mais de 2 h, e o integrador proibiu rodá-la nas faixas. Resultado: 30 arquivos e 496
  testes; 490 passaram e 6 falharam, todos preexistentes:
  - `src/server/whatsapp/inbox.int.test.ts`, "lead de OUTRO vendedor ... não vaza o cockpit". Já está na lista
    de falhas do main `f8a9c0e`.
  - `src/server/avaliacoes/aproveitamento-aplicado.int.test.ts`, 5 testes que falham com "Turma de destino não
    está disponível para transferência.". As fixtures têm datas fixas de 01/2026, e a disponibilidade da oferta
    é calculada com o relógio real. O arquivo não foi alterado pelo bloco. Rodado num worktree temporário em
    `d4c0f74`, no mesmo banco, falha igual (5 de 5).
- Correção da revisão final: `destinoDoArraste` devolve `{ tipo: "nenhum" }` quando a origem e o destino são a
  mesma etapa. Assim as Tasks 13 e 14 não abrem diálogo, não mostram recusa falsa e não gravam `Evento` sem
  mudança.
- Reverificação antes do PR (16/10/2026): `tsc --noEmit` saída 0; `npm test` 646 arquivos e 4.630 testes verdes,
  saída 0; `npm run lint` 0 erros (44 avisos); `vitest related` no perfil `dev-gravacoes` ficou grande demais
  (alcança módulos acadêmicos pelos imports) e foi interrompido pelo limite de tempo. Até a interrupção, 13 arquivos
  falharam (38 testes). Os mesmos 13 arquivos, rodados em worktree de `origin/integracao/ate-fase-1`, falham igual:
  38 testes. São preexistentes (fixtures com datas fixas de 2026 contra o relógio real, mais o `inbox` já listado).

### Pendências (revisão R1 do PR #193)
- **C3, para quando `exigirCapacidadeCrm` for ligada nas telas e ações:** a troca não pode ampliar o que hoje é
  negado. A `MATRIZ` de `src/server/crm/permissoes.ts` concede `contatos.ver` à `SECRETARIA_ACADEMICA` e
  `comissoes.ver` ao `VENDEDOR`, mas os guards atuais negam esses acessos. Antes de ligar, ou a matriz é ajustada,
  ou o guard atual continua valendo junto. Em qualquer caso, precisa de um teste que prove que esses dois acessos
  seguem negados.
- **Decisão sobre o C3 (17/10/2026, revisão final do bloco B):** a parte de `contatos.ver` para a
  `SECRETARIA_ACADEMICA` fica **superada pelo plano**. O plano da Fase 2 quer que a Secretaria veja contatos
  (alunos e responsáveis, sem dados de oportunidade), e o bloco F já liga isso em `obterContato`
  (`src/server/crm/contatos.ts`) com `capacidadesCrm(...).has("contatos.ver")` e `escopoPessoas`. A parte de
  `comissoes.ver` para o `VENDEDOR` **continua valendo**: ainda não está ligada em lugar nenhum, e o bloco de
  comissões precisa do teste que prova o acesso negado (ou ajustar a matriz) antes de ligá-la.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## CRM, bloco C: Pessoa como hub e empresa B2B (Fase 2, Tasks 6 a 8; 16/10/2026)

### Verificação antes do merge (branch `claude/fase2-c-pessoa-empresa`, HEAD `06aff92`)
- Perfil de teste: `.erp-test-profile` = `dev-gravacoes`, que está na lista fechada de `scripts/test-profile.mjs`
  e resolve para o banco descartável `erp_genius_test_dev_gravacoes` (porta 54329). Todas as suítes abaixo rodaram
  nesse banco. Na Task 6 a migration foi aplicada por engano também num banco chamado `dev-gravacoes` (o nome do
  perfil, fora da lista); o integrador deve descartá-lo.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: 646 arquivos e 4.632 testes verdes, saída 0 (linha de base: 643 arquivos e 4.607 testes).
- `npm run lint`: saída 0, 0 erros.
- Migrations: `20261001000000_crm_pessoa` (2.M1) e `20261002000000_crm_empresa_b2b` (2.M2). Os IDs foram
  escolhidos pelos agentes e ficam depois de `20260929130000`. Nenhuma outra branch local ou remota tem migration
  `202610*`. O integrador ainda precisa reservar ou renomear esses IDs antes de aplicá-los num ambiente
  compartilhado.
- `prisma migrate status` em `erp_genius_test_dev_gravacoes`: 440 migrations, "Database schema is up to date!".
- `pg_proc` (F2-C): as funções públicas que citam `"Lead"`, `"Pessoa"`, `"Empresa"`, `"Aluno"` ou `"Responsavel"`
  não usam as colunas novas (a migration só acrescenta colunas anuláveis, tabelas e FKs). As funções de
  desistência e segunda chamada foram chamadas pelos `*.int.test.ts` de `src/server/matricula/` e
  `src/server/contratos/` listados abaixo, todos verdes.
- Integração no perfil isolado, só um recorte. A suíte completa leva mais de 2 h e o integrador proibiu rodá-la
  nas faixas. Resultado: 9 arquivos e 120 testes verdes, saída 0:
  - `src/server/comercial/leads.int.test.ts` (8 testes, com o novo `criarLead` da Task 8);
  - `src/server/crm/pessoa-schema`, `empresa-schema` e `pessoas` (14 testes);
  - `src/server/matricula/desistencia-efetivacao`, `desistencia-financeiro-sql` e `desistencia-administrativa`
    (24 testes);
  - `src/server/contratos/aditivo-acerto-taxa` e `substituicao` (74 testes).
- Pendente com o integrador antes do PR: rodar `npm run test:int` completo num banco autorizado e comparar com
  as 7 falhas preexistentes do main `f8a9c0e`; confirmar ou renomear os IDs 2.M1 e 2.M2.

- Reverificação (16/10/2026, HEAD `1f21347`): tsc 0; `npm test` 646 arquivos/4.632 testes, saída 0; lint 0 erros (44 avisos).
  `vitest related` sobre os 10 arquivos do diff contra `claude/fase2-b-oportunidade` arrasta praticamente toda a suíte
  (`evento.ts` e `labels.ts` são importados em todo lugar) e foi interrompido após 30 min; no lugar rodaram-se
  `src/server/crm` + `comercial/leads` (4 arquivos, 22 testes) e `comercial/{captura,regua-comercial,config-comercial}`
  (3 arquivos, 20 testes), todos verdes, saída 0.

### Correções da revisão R1 do PR #194 (17/10/2026)
- **B1, conflito com o main:** `origin/main` (`097f5df5`, com a #193) mesclado sem squash. O único conflito foi este
  quadro: a seção "DS-B — avisos" fica só na posição para onde o main a moveu, e no fim os blocos B (com as
  pendências da R1 do #193) e C ficam ambos, cada um com a própria linha **Estado**. Nenhum `\w+.lead.<método>`
  em `src` fora da string do próprio teste de trava (`oportunidade-map.test.ts`).
- **C1, `empresaId` em `criarLead`:** validado na transação antes do `create`. Inexistente ou de empresa inativa
  devolve "Empresa não encontrada." em vez de estourar a FK (P2003). `Empresa` não tem dono nem carteira; o escopo
  disponível hoje é `ativo`. Quando houver escopo de empresa, ele entra no mesmo `findFirst`.
- **C2, telefone e e-mail com Pessoa existente — intencional nesta fase, documentado no código (`criarLead` e
  `garantirPessoaTx`):** com `pessoaId` informado, o telefone não entra em `ContatoWhatsApp`; e o `email`
  digitado só vai para a Pessoa quando ela é criada por `garantirPessoaTx`. Pessoa já existente (informada, achada
  pelo contato ou pelo aluno/responsável) não tem telefone nem e-mail atualizados por `criarLead`.
- **C3, corrida em `garantirPessoaTx`:** `pg_advisory_xact_lock(hashtextextended('pessoa:'||telefone, 0))` antes
  da busca do contato, com o telefone já normalizado em E.164. Duas criações simultâneas do mesmo telefone novo
  passam a dar uma só Pessoa.
- **C4, vendedor e `pessoaId` sem oportunidade — comportamento esperado:** o vendedor só vê pessoas da própria
  carteira (com oportunidade em `escopoComercialAtual`). Uma pessoa sem oportunidade (por exemplo, vinda de
  aluno) é recusada como "Contato não encontrado." quando o vendedor informa o `pessoaId`. **Ponto para a tela de
  nova oportunidade (#196):** a busca de contato do vendedor não deve oferecer essas pessoas; ele cria a
  oportunidade pelo telefone, e `garantirPessoaTx` liga à pessoa certa pelo contato ou pelo aluno/responsável.
- **C5, IDs das migrations — confirmados pelo integrador em 17/10/2026:** `20261001000000_crm_pessoa` (2.M1) e
  `20261002000000_crm_empresa_b2b` (2.M2). A pendência "confirmar ou renomear os IDs" acima fica resolvida.

### Verificação da R1 (HEAD dos commits de correção)
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm run lint`: saída 0, 0 erros (43 avisos, nenhum nos arquivos tocados).
- `node_modules/.bin/vitest run` completo: 655 arquivos e 4.738 testes verdes, saída 0.
- Integração: o banco do perfil `tester` estava em uso por outra suíte e já tinha migrations da Fase 3
  (`20261016*`), então rodou num banco descartável próprio, `erp_genius_test_fix194` (mesmo Postgres,
  porta 54329), criado do zero com `prisma migrate deploy` das migrations desta branch e apagado no fim.
  `src/server/crm/*.int.test.ts` e `src/server/comercial/*.int.test.ts`: 7 arquivos e 46 testes verdes,
  saída 0 (inclui `pessoas`, `empresa-schema`, `pessoa-schema` e `leads`, que exercita o `criarLead` alterado).
- Os dois testes do C3 (concorrência com 5 chamadas paralelas e espera pelo lock) falham com o lock removido
  (conferido localmente) e passam com ele.

**Estado**: Implementado; aguardando o integrador. Não concluído.

## CRM, bloco D: tags, campos personalizados e visualizações salvas (Fase 2, Tasks 9 a 11; 16/10/2026)

### Migration 2.M3 (`20261003000000_crm_tags_campos_filtros`)
- O ID foi escolhido pelo implementador, e não reservado pelo integrador como a Global Constraint pede. Ele fica
  depois de `20261002000000_crm_empresa_b2b` (2.M2), e nenhuma outra branch local ou remota tem migration
  `20261003*`. A Fase 3 (`claude/fase3-a-modelo-atendimento`) usa `20261016*`, que vem depois. Sob delegação do
  integrador, o ID foi mantido e aplicado só no banco do perfil. O integrador ainda precisa confirmá-lo antes de
  qualquer ambiente compartilhado.
- Na correção da revisão final saiu uma linha em branco duplicada antes do comentário do CHECK; o SQL é o mesmo.
  A migration já estava aplicada no banco descartável `erp_genius_test_dev_gravacoes`, onde só o checksum em
  `_prisma_migrations` foi trocado para o do arquivo novo
  (`2470707f74538c034f297fe2cc9b1fc84aaaf5df8742d693e0676d70c9cb2ec2`). Nenhum outro banco tem essa migration.
- `prisma migrate status` em `erp_genius_test_dev_gravacoes`: 441 migrations, "Database schema is up to date!".
  `prisma migrate deploy`: "No pending migrations to apply".
- `pg_proc` (F2-D): a migration só cria tipos, tabelas, índices, FKs com `ON DELETE RESTRICT` e o CHECK
  `num_nonnulls("pessoaId","empresaId") = 1`, e não altera nenhuma tabela existente. Nenhuma função do schema
  `public` cita `"Tag"`, `"PessoaTag"`, `"EmpresaTag"`, `"CampoPersonalizado"`, `"ValorCampoPersonalizado"` ou
  `"FiltroSalvo"`, então nenhuma função existente fica quebrada.

### Exceção registrada: delete físico do vínculo de tag
- `removerTag` apaga a linha de vínculo (`tx.pessoaTag.delete` e `tx.empresaTag.delete` em
  `src/server/crm/tags.ts`), e isso contraria a Global Constraint "Não há delete físico de dado de negócio".
- Por que a exceção foi aceita:
  - o schema que o plano dá para `PessoaTag`/`EmpresaTag` não tem coluna de lápide;
  - o vínculo é só a marcação atual, e a própria `Tag` nunca é apagada (é desativada por `ativo`);
  - o histórico completo fica nos Eventos `TagAtribuida`/`TagRemovida` (agregado `Pessoa` ou `Empresa`, com a tag
    no payload), gravados na mesma transação;
  - atribuir de novo cria um vínculo novo e um Evento novo, então nada se perde.
- Se o dono preferir a lápide (`removidoEm`), é preciso trocá-la antes de a migration 2.M3 ser aplicada num
  ambiente compartilhado. Depois disso, a troca custa uma migration nova.

### Verificação da correção
- Integração no perfil `dev-gravacoes`: `src/server/crm/tags.int.test.ts`, `campos.int.test.ts` e
  `filtros-salvos.int.test.ts` passaram (3 arquivos, 24 testes, saída 0). Só mudaram o SQL, sem alteração de
  semântica, e os docs, então `tsc` e `npm test` não são afetados.
- Pendente com o integrador antes do PR: confirmar o ID 2.M3 e a exceção acima, e rodar `npm run test:int` completo.
**Estado**: Implementado; aguardando o integrador. Não concluído.

### Verificação para o PR (bloco D, branch `claude/fase2-d-tags-campos-filtros`, 16/10/2026)
- Tarefas: 9 (tags), 10 (campos personalizados) e 11 (visualizações salvas).
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 647 arquivos e 4650 testes verdes (linha de base: 643 arquivos e 4607 testes).
- `npm run lint`: saída 0, 0 erros e 44 avisos (`no-unused-vars` já existentes).
- `vitest related --run -c vitest.integration.config.ts` sobre os .ts/.tsx do bloco: saída 0, 4 arquivos e 37 testes verdes.
  `prisma migrate deploy` no banco `dev-gravacoes`: sem pendências. Nenhuma das 7 falhas preexistentes da linha de base
  foi tocada; a suíte de integração completa fica com o integrador.

### Correções da R1 do #195 (17/10/2026)
- **C1 (quadro × `main`):** o `main` (com o #194, 683bf3e5) foi mesclado nesta branch sem conflito. Os blocos B, C e
  D ficam no quadro, cada um com a própria linha **Estado**.
- **C2 (unicidade fora da transação):** `criarTag` e `salvarFiltro` passam a envolver a transação em `comUnicidade`
  (`src/server/crm/unicidade.ts`), que traduz o P2002 de uma corrida na mesma mensagem da checagem prévia ("Já
  existe uma tag com este nome." e "Já existe uma visualização com este nome."). A reativação de um filtro
  arquivado agora é condicional (`updateMany` com `arquivadoEm: { not: null }`). Se outra chamada já o reativou,
  a resposta é "Já existe…", e não há segundo Evento. Os testes estão em `unicidade.test.ts` e nos `*.int.test.ts`
  de tags e filtros-salvos: a checagem prévia é forçada a "não achou" e o índice único do banco recusa. A mutação
  (não traduzir o P2002) foi detectada pelos 2 testes de corrida.
  Um `Promise.all` com duas actions reais não serve como teste aqui: o import dinâmico de `@/lib/auth` em
  `exigirSessao`, feito em paralelo, escapa do `vi.mock` (`ERR_MODULE_NOT_FOUND` de `next/server`) até com nomes
  diferentes. As suítes que testam concorrência mockam `exigirSessao` no arquivo inteiro (por exemplo
  `academico/fluxo.int.test.ts`).
- **C3 (`"use server"`):** no repositório, a diretiva fica no próprio módulo de `src/server` (como em
  `comercial/acoes.ts` e `crm/oportunidades.ts`). Nenhum módulo `"use server"` reexporta de outro. Hoje nenhuma
  tela chama as mutações de `crm/tags.ts`, `crm/campos.ts` e `crm/filtros-salvos.ts`: o `/funil` (bloco E) só
  lê `listarFiltros` no servidor. Por isso, **a exposição como action vem junto com a tela** que a consumir
  (salvar visualização no funil e contatos no bloco F). Nesse momento, as exportações que não são action
  (`CLASSES_COR_TAG`, `escopoEmpresas`, `CHAVES_FILTRO`, `validarValorCampo`, `listarFiltros(usuario, …)`) precisam
  sair do módulo marcado ou ficar num módulo `"use server"` separado só com as mutações. Nenhum módulo foi
  criado agora sem consumidor.
- **C4 (integração e ID):** o integrador confirmou o ID `20261003000000`. A integração rodou num banco descartável
  próprio, `erp_genius_test_fix195` (localhost:54329): `prisma migrate deploy` aplicou tudo, `migrate status`
  deu "Database schema is up to date!", e `campos`, `tags` e `filtros-salvos.int.test.ts` passaram (3 arquivos,
  27 testes). O banco foi apagado no fim.
- Verificação com o `main` mesclado: `tsc --noEmit` com saída 0; `npm run lint` com 0 erros (43 avisos já
  existentes); `vitest run` com 657 arquivos e 4758 testes, todos verdes.
**Estado**: Implementado; correções da R1 aplicadas; aguardando o merge. Não concluído.

## CRM, bloco E: funil (Fase 2, Tasks 12 a 18; 16/10/2026)

### Verificação para o PR (bloco E, branch `claude/fase2-e-funil`, 16/10/2026)
- Tarefas: 12 a 18 (funil: Kanban, lista, perda, ganho e contratação).
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 653 arquivos e 4680 testes verdes (linha de base: 643 arquivos e 4607 testes).
- `npm run lint`: saída 0, 0 erros e 44 avisos (já existentes).
- `vitest related --run -c vitest.integration.config.ts` sobre os .ts/.tsx do bloco (diferença contra o bloco D): 13 arquivos,
  153 testes verdes e 1 falha, a preexistente da linha de base (`src/server/whatsapp/inbox.int.test.ts`, "lead de OUTRO
  vendedor ... não vaza o cockpit"), que este bloco não toca. Nenhuma falha nova. Suíte completa fica com o integrador.

### Correções da R1 do #196 (17/10/2026)
- **B1 (integração com o `main`):**
  - O `main` (46f69962, já com o #194 e o #195) foi mesclado, primeiro via bloco D (`8bee5cbe`) e depois direto
    (`f8abcd1d`).
  - Em `revalidarLead`, fica só `/funil` (o `main` tirou `/pipeline`).
  - Nenhum esqueleto do `main` serve para colunas de Kanban. Por isso, `EsqueletoColunas` volta para
    `src/components/Esqueleto.tsx`, que o `funil/loading.tsx` usa, junto com a linha do teste e o piso de 8
    exports em `Esqueleto.test.ts`.
  - O mapa da trilha (C22 da #170, que veio do `main`) volta a ter `/leads/*/contratacao`. A página só redireciona
    para `/oportunidades/*/contratacao` e sai com a Tarefa 37 (`595da65a`).
- **C1 ("Mudar etapa…" da ficha), em `1b826890`:** o select de `/leads/[id]` tira "Exp. agendada" e oferece só
  Novo, 1º contato e Qualificado. `moverEtapa` sempre recusava esse destino, e a experimental tem o próprio botão
  "Agendar experimental". O teste está em `FichaLead.test.ts`.
- **C2 (oportunidade de Empresa), em `74c70470`:**
  - **Ruling:** o plano (Tasks 7, 8 e 16) dá `Empresa` B2B, `Oportunidade.empresaId`, `ParticipanteOportunidade` e
    `criarLead` com `empresaId`, mas não define o fluxo do modo Empresa na nova oportunidade. A decisão segura é a
    oportunidade de empresa **criar a `Empresa` e ligar `empresaId`, sem criar `Pessoa` com o nome da empresa**.
    O participante não é criado automaticamente, porque o plano não pede isso. Ele entra depois, pela ficha.
  - `criarLead({ criarEmpresa: true })`:
    - cria a `Empresa` (código `E-`, `contatoTelefone`, `contatoEmail` e `origemCanal` vindos do formulário) com
      o Evento `EmpresaCriada`;
    - liga `empresaId` e grava `b2b = true`;
    - não chama `garantirPessoaTx`, então não cria `Pessoa` nem `ContatoWhatsApp`;
    - recusa a chamada se vier junto com `empresaId` ou `pessoaId`.
  - `empresaId` sozinho segue a regra do #194: a empresa precisa estar ativa, e a pessoa de contato é criada pelo
    nome digitado. `LeadCriado` passa a levar `empresaId` no payload.
  - No modo Empresa, `NovaOportunidade` manda `criarEmpresa`, não manda `pessoaId` e não busca duplicados de pessoa.
  - Testes: `NovaOportunidade.interacao.test.ts` e `pessoas.int.test.ts`.
- **C3 (ponto de atenção de desempenho):** as ordens "tempo" e "perdidos" de `carregarFunil` carregam todos os ids
  da coluna (no caso de perdidos, todos os PERDIDO do escopo) para ordenar e cortar em memória. Isso funciona no
  volume atual, mas cresce com a base. Quando o volume subir, a ordenação e o corte devem ir para o SQL (por
  exemplo, `etapaDesde` materializado ou uma subconsulta por `MAX(Evento.criadoEm)` com `LIMIT`).
- **C4 (integração):** num banco descartável próprio, `erp_genius_test_fix196` (localhost:54329), `prisma migrate
  deploy` aplicou tudo e `migrate status` deu "Database schema is up to date!". Passaram `funil` (4 testes),
  `historico` (2), `oportunidades` (4) e `matricula/preparacao-escopo` (2), mais `crm/pessoas` (16) e
  `comercial/leads` (8), que cobrem o `criarLead`: 6 arquivos e 36 testes no total. O banco foi apagado no fim.
- Verificação com o `main` mesclado: `tsc --noEmit` com saída 0; `npm run lint` com 0 erros (43 avisos já
  existentes); `vitest run` com 663 arquivos e 4792 testes, todos verdes. Uma rodada anterior teve uma falha
  intermitente em `src/app/confirmacoes.test.ts`: o teste passa isolado (59 testes, cerca de 18 s) e passou na
  rodada completa seguinte.
**Estado**: Implementado; correções da R1 aplicadas; aguardando o integrador. Não concluído.

### Verificação para o PR (bloco G, branch `claude/fase2-g-carteira`, 17/10/2026)
- Tarefas: 25 (carteira derivada das oportunidades, reatribuição em lote) e 26 (tela da carteira e coberturas).
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 654 arquivos e 4691 testes verdes (linha de base: 643 arquivos e 4607 testes). Uma correção do bloco:
  o aviso da carteira virou região de status (`src/app/anuncios.test.ts`).
- `npm run lint`: saída 0, 0 erros e 44 avisos (já existentes).
- `vitest related --run -c vitest.integration.config.ts` sobre os .ts/.tsx do bloco (diferença contra o bloco E): 3 arquivos,
  18 testes verdes, saída 0. Nenhuma das 7 falhas preexistentes foi tocada; a suíte completa fica com o integrador.

### Correções da R1 do #198 (17/10/2026)
- **B1 (integração com o `main`), em `6826ff0b`:** o `main` (f4ded562, já com o #196) foi mesclado. Em
  `src/server/acesso/coberturas.ts`, as duas ações mantêm `revalidatePath("/carteira")` e o import de `next/cache`
  voltou. Em `src/components/Sidebar.tsx`, ficam `KanbanSquare: IconLayoutKanban` (usado pelo `/funil` do `nav.ts`) e
  `Briefcase: IconBriefcase`, com o import de `IconLayoutKanban` de volta. A trava `casca-crm-removida.test.ts` só
  proíbe a pasta antiga `/carteiras`, então não mudou. Os conflitos herdados (`comercial/acoes.ts` e o esqueleto do
  funil) já vieram resolvidos pelo #196.
- **C1 ("sem interação" zerava com a reatribuição), em `c5dacf9f`:** a conta ignora a lista explícita
  `EVENTOS_IGNORADOS_SEM_INTERACAO` (`LeadAtribuido`, `TagAtribuida`, `TagRemovida`, `CampoPersonalizadoAlterado`).
  Teste em `carteira.int.test.ts`: a reatribuição em lote não zera os dias, e só com eventos administrativos a conta
  parte da criação da oportunidade.
- **C2 (ponto de atenção de volume):** `carregarCarteira` carrega todas as oportunidades abertas do escopo e faz o
  `groupBy` de `Evento` com `in` de todos os ids, para filtrar por dias e ordenar em memória (o corte de 500 é só na
  resposta). Funciona no volume atual, mas cresce com a base. Quando o volume subir, o filtro e a ordenação por dias
  devem ir para o SQL (por exemplo, uma subconsulta por `MAX(Evento.criadoEm)` com `LIMIT`, ou a última interação
  materializada na oportunidade).
- **C3 (nomes das recusadas), em `97f57a16`:** `recusadasComNome` guarda o nome das linhas na hora da resposta, antes
  do `router.refresh()`. Teste em `carteira/page.test.ts`.
- **C4 (integração):** num banco descartável próprio, `erp_genius_test_fix198` (localhost:54329), `prisma migrate
  deploy` aplicou tudo. Passaram `carteira.int.test.ts` (10 testes) e `coberturas-lista.int.test.ts` (2). O banco foi
  apagado no fim.
- Verificação com o `main` mesclado: `prisma generate`; `tsc --noEmit` com saída 0; `npm run lint` com 0 erros (43
  avisos já existentes); `vitest run` com 664 arquivos e 4804 testes, todos verdes.
**Estado**: Implementado; correções da R1 aplicadas; aguardando o integrador. Não concluído.

### Verificação para o PR (bloco I, branch `claude/fase2-i-comissoes`, 17/10/2026)
- Tarefas: 33 (painel de comissões por papel e moeda), 34 (tela `/comissoes` para vendedor, gerente e financeiro) e
  35 (estorno pelo FINANCEIRO), mais a correção do `aprovadaEm` e o commit de correção da revisão final.
- Correção da revisão final: "matriculadas sem comissão" passou a usar `escopoComercialAtual` (o FINANCEIRO e o
  ADMINISTRADOR continuam vendo tudo) e não conta matrícula CANCELADA nem ENCERRADA; `estornarComissaoDoPainel`
  entrou na lista fechada de `src/app/confirmacoes-mapa.ts`; teste do ADMINISTRADOR no estorno.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 655 arquivos e 4698 testes verdes (linha de base: 643 arquivos e 4607 testes).
- `npm run lint`: saída 0, 0 erros e 44 avisos (já existentes).
- Integração no perfil `integracao`: `node_modules/.bin/vitest related --run -c vitest.integration.config.ts` sobre os
  29 .ts/.tsx do diff contra `claude/fase2-g-carteira`: saída 0, 14 arquivos e 321 testes verdes (nova rodada de 17/10/2026). Nenhuma das 7 falhas preexistentes foi tocada; a suíte `npm run test:int` completa fica com o integrador.
- **Pendência bloqueante do merge — Q7 (gate da Task 35):** a Q7 segue como decisão provisória
  (`00-visao-geral.md`, Global Constraints e `src/server/crm/permissoes.ts`). O PR F2-I sai com o estorno manual pelo
  FINANCEIRO sob decisão provisória; o ADMINISTRADOR também estorna, porque recebe todas as capacidades (matriz da
  Task 4, com teste). O dono do produto precisa confirmar a Q7 antes do merge: se decidir "estorno automático no
  cancelamento da matrícula", a Task 35 sai do PR; se decidir outro operador, muda só a matriz da Task 4.
- **Merge da `main` (17/10/2026):** a base do #200 passou a ser `main` (já com as Fases 2B a 2G e as correções da R1
  do #198). Só o quadro teve conflito: os blocos dos dois lados foram mantidos, cada um com a própria linha **Estado**,
  e as pendências do topo seguem a versão da `main` com as notas do bloco I. O merge automático tirou o
  `revalidatePath("/comissoes")` de `revalidar()` em `src/server/matricula/acoes.ts` (removido pelo `684af0b3`); ele
  voltou, porque a rota `/comissoes` existe de novo. `coberturas.ts`, `Sidebar.tsx`, `EsqueletoColunas` e as travas de
  `src/app/*.test.ts` ficaram com a versão da `main` somada às entradas do bloco I. Verificação: `prisma generate`;
  `tsc --noEmit` com saída 0; `npm run lint` com 0 erros (43 avisos já existentes); `vitest run` com 665 arquivos e
  4811 testes, todos verdes. Num banco descartável próprio, `erp_genius_test_fix200` (localhost:54329), `prisma migrate
  deploy` aplicou tudo e passaram `comissoes-estorno`, `comissoes-painel` e `comissao-aprovada-em` (3 arquivos, 11
  testes) e `reserva-vaga` (68). O banco foi apagado no fim.
**Estado**: Implementado; aguardando o integrador e a confirmação da Q7. Não concluído.

## CRM, bloco H: tarefas, agenda e mensagem agendada (Fase 2, Tasks 27 a 31; 17/10/2026)

### Verificação para o PR (bloco H, branch `claude/fase2-h-tarefas`, 17/10/2026)
- Tarefas: 27 (model `Tarefa` e `NotificacaoUsuario`, agrupamento por data civil institucional), 28 (ações de tarefa
  com escopo por setor, versão e auditoria), 29 (mensagem agendada pela tarefa, com `agendadaPara` respeitado pelo
  despachante), 30 (lembretes no cron, com notificação ao usuário) e 31 (tela `/tarefas` com lista, agenda e
  calendário), mais as correções da revisão (ids de arraste da agenda semanal; editar a tarefa não rearma lembrete já
  disparado; a lista mostra atrasadas antigas).
- Migration 2.M4 `20261017090000_crm_tarefas`, conferida pelo integrador: vem depois de `20261001000000` a
  `20261016130000_preferencias_inbox_usuario`.
- **Merge da `main` (afd13cb9, com as Fases 2B a 2G, 2I, 3A e 3B):** houve conflito em `prisma/schema.prisma` (relações
  de `Usuario`), `src/app/borda-rota-mapa.ts`, `src/app/borda-rota.render.test.ts` e `src/app/botoes.test.ts`. Nos
  quatro, os dois lados foram mantidos (`/tarefas` ao lado de `/carteira` e `/comissoes`). `nav.ts`, `Sidebar.tsx`,
  `labels.ts`, `trilha.ts` e `despachante.ts` mesclaram sem conflito. Nenhuma linha do H foi perdida: os
  `revalidatePath("/tarefas")` e os ícones `Checklist`, `KanbanSquare` e `Briefcase` continuam.
- Verificação com o `main` mesclado: `prisma generate`; `tsc --noEmit` com saída 0; `npm run lint` com 0 erros (43
  avisos já existentes); `vitest run` com 674 arquivos e 4874 testes, todos verdes.
- Integração no perfil `dev-email` (`erp_genius_test_dev_email`, recriado com drop e create): `prisma migrate deploy`
  aplicou tudo. Passaram `crm/tarefas`, `crm/lembretes`, `crm/mensagens-agendadas`, `whatsapp/despachante-agendada`,
  `whatsapp/despachante-comercial` e `whatsapp/despachante.live`: 6 arquivos e 54 testes, com saída 0.
**Estado**: Implementado; aguardando revisão e merge. Não concluído.

## Fase 4A — driver MOTOR e cliente do motor (17/10/2026)

- Branch `claude/fase4-a-driver-motor`, base `main` 08e2b4b7. Tarefas 1 a 4 do plano `04-fase-motor.md`: enum `MOTOR` e
  tipos de mensagem, tabelas de eventos e reações (migrations `20261017120000_whatsapp_motor_enums` e
  `20261017130000_whatsapp_motor_dados`), configuração e cliente HTTP do motor, porta v2 e `drivers/motor.ts`.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 676 arquivos e 4898 testes verdes (linha de base: ~671 e ~4850).
- `npm run lint`: saída 0, 0 erros e 43 avisos (já existentes).
- Integração no perfil `integracao` (banco `erp_genius_test`, migrations em dia): `vitest related` sobre os 15 .ts do diff
  se espalha por quase toda a suíte (`labels.ts` é importado em todo lugar) e foi interrompido por tempo. Rodados os
  arquivos que o bloco toca: `motor/schema-motor`, `despachante.live`, `despachante-comercial`, `destinatario-atual`,
  `cron` e `acoes` (whatsapp): saída 0, 6 arquivos e 53 testes verdes. A suíte completa fica com o integrador.

### Correções da R1 do #205 (17/10/2026)
- **C1 (conflito com o `main`):** o `main` (8a5debff, com o CRM bloco H) foi mesclado. Só o quadro teve conflito: os
  dois blocos ficaram, cada um com a própria linha **Estado**. `schema.prisma` (`IntencaoMensagem` com `agendadaPara` e
  `tarefaId` ao lado de `clientMessageId`), `labels.ts`, `enums-rotulos.test.ts` e `despachante.ts` (filtro por
  `agendadaPara` ao lado da porta v2) mesclaram sem conflito. As migrations da 4A (`20261017120000` e
  `20261017130000`) seguem depois de `20261017090000_crm_tarefas` e `20261017100000_inbox_tempo_real`.
- **C2 (ambiente sem envio até ligar o driver), decisão registrada:** a migration
  `20261017130000_whatsapp_motor_dados` termina com `UPDATE "NumeroWhatsApp" SET ativo = false, sessao =
  'DESCONECTADO' WHERE driver <> 'MOTOR'`, ou seja, desativa todos os números que não são MOTOR. Como o `driverMotor`
  só entra em `DRIVERS` na Task 5 (bloco 4B) e ainda não há como cadastrar um número MOTOR (Tasks 18 e 19), **depois
  do deploy da 4A o ambiente fica sem envio de WhatsApp até a tarefa que liga o driver**. Isso é intencional: segue
  as decisões D1 e D3 (ambiente em teste; Meta e Evolution saem). O integrador não deve subir a 4A num ambiente que
  precise enviar WhatsApp antes da 4B.
- **C3 (número MOTOR no despachante):** o comentário de `DRIVERS` dizia que o MOTOR "entra na Fase 4, Task 4"; agora
  diz que o driver entra na Task 5. Novo `driverDoNumero(driver)` em `despachante.ts`: sem driver registrado, lança
  `ErroDriver("driver_sem_implementacao")` (não reprocessável), e o `catch` grava esse motivo em vez de
  `resultado_incerto`, que mandava para revisão humana algo que com certeza não saiu. O registro do driver ficou para
  a Task 5, como manda o plano, porque depende do `clientMessageId` no claim e do adiamento reprocessável (Task 6).
  Teste unitário: `src/server/whatsapp/despachante-driver.test.ts`.
- **C4 (requisito para a Task 8, pendência):** `drivers/motor.ts` trata `TIMEOUT` e `INDISPONIVEL` (inclui
  `ECONNRESET`) como reprocessáveis, mas um timeout depois que o motor recebeu o POST é um resultado incerto. **A nova
  tentativa precisa reaproveitar o mesmo `clientMessageId`** para o motor deduplicar; hoje o despachante gera
  `randomUUID()` quando a intenção não tem id, e o schema descreve o id como "um por tentativa". A Task 8 precisa
  garantir isso junto com as Tasks 5 e 6 (id gravado no claim e mantido no adiamento): só o reenvio decidido na revisão
  humana (`REENVIAR_APOS_VERIFICACAO`) zera o id. Não muda nada nesta PR, porque o driver não está ligado e o
  despachante ainda não lê `reprocessavel`.
- **C5:** tratado na #206 (`recursos-canal.ts`).
- **C6 (nit):** `drivers/motor.ts` passou a montar `/v1/numeros/${encodeURIComponent(…)}`, como `motor/acoes.ts`.
  Teste em `drivers/motor.test.ts`.
- Verificação com o `main` mesclado: `prisma generate`; `tsc --noEmit` com saída 0; `npm run lint` com 0 erros (43
  avisos já existentes); `vitest run` com 685 arquivos e 4950 testes, todos verdes. Os `*.int.test.ts` não rodaram
  nesta rodada (precisam de banco).
**Estado**: Implementado; correções da R1 aplicadas; aguardando o integrador. Não concluído.

## Fase 3E: React e porte dos componentes do motor (17/10/2026)

- **Branch:** `claude/fase3-e-componentes` (base `main` 08e2b4b7). **Tarefas:** 24 a 28 (React, lista virtual, histórico,
  balão e compositor em `src/components/conversa/`).
- **Verificação:** `node_modules/.bin/tsc --noEmit` saída 0; `npm test` saída 0 (679 arquivos, 4905 testes verdes);
  `npm run lint` saída 0 (0 erros, 45 avisos); `vitest related --run -c vitest.integration.config.ts` sobre os 29
  arquivos .ts/.tsx do diff, saída 0 (3 arquivos, 28 testes), no banco `tester`. Suíte de integração completa não rodada
  (fica com o integrador). Nenhuma falha nova em relação à linha de base.
- **Índice do cursor da lista (atenção para migrations futuras):** o `NULLS LAST` de
  `AtendimentoWhatsApp_ultimaMensagemEm_id_idx` (`ultimaMensagemEm DESC NULLS LAST, id DESC`) só existe na migration
  `20261017110000_inbox_indice_cursor_lista`. O Prisma não expressa a ordem de nulos no schema, que declara só
  `sort: Desc`. Um `prisma migrate dev` futuro pode enxergar diferença nesse índice e propor recriá-lo sem o
  `NULLS LAST`. Se propuser, a migration gerada deve ser editada para manter `DESC NULLS LAST`, porque é essa ordem que
  casa com a consulta da lista. No `prisma migrate diff` desta revisão, o índice não apareceu.
- **Correções da R1 (17/10/2026):** merge da `main` (`1c02c4c5`) com conflito em `src/app/botoes.test.ts` (entradas dos
  dois lados mantidas, sem afrouxar a trava) e neste quadro (bloco H e bloco 3E, cada um com o próprio Estado).
  `LIBERADOS` de `recursos-canal.ts` virou `Partial<Record<DriverWhatsApp, …>>`, para compilar com o `MOTOR` da #205 em
  qualquer ordem de merge, com teste de driver ausente do mapa. O `Compositor` ajusta rascunho, anexo e erro no render
  quando muda o atendimento ou o modo, sem setState em effect, com teste da troca.
- **Verificação com a `main` mesclada:** `prisma generate`; `tsc --noEmit` saída 0; `npm run lint` com 0 erros e 43
  avisos (nenhum nos arquivos da PR); `vitest run` com 687 arquivos e 4956 testes verdes. Num banco descartável próprio,
  `erp_genius_test_fix206` (localhost:54329), `prisma migrate deploy` aplicou tudo e passaram
  `inbox/barramento`, `inbox/consultas-pagina` e `inbox/eventos-sse` (3 arquivos, 28 testes). O banco foi apagado no fim.
- **Segundo merge da `main` (`cd0a9cbc`, com a #205 da Fase 4A):** só este quadro teve conflito (ficam o bloco da 4A e o
  da 3E, cada um com o próprio Estado). Com `MOTOR` no enum `DriverWhatsApp`: `prisma generate`; `tsc --noEmit` saída 0,
  o que confirma o `LIBERADOS` parcial; `npm run lint` com 0 erros e 43 avisos (nenhum nos arquivos da PR); `vitest run`
  com 692 arquivos e 5007 testes verdes; no `erp_genius_test_fix206` recriado, `prisma migrate deploy` aplicou tudo,
  inclusive as migrations da 4A, e os mesmos 3 arquivos de integração do inbox passaram (28 testes). O banco foi
  apagado no fim.
**Estado**: Implementado; aguardando o integrador. Não concluído.

## CRM, bloco F: contatos (Fase 2, Tasks 19 a 24; 17/10/2026)

### Verificação para o PR (bloco F, branch `claude/fase2-f-contatos`, 17/10/2026)
- Tarefas: 19 a 24 (lista e ficha do contato, duplicados e mescla, exportação e importação de contatos, tela).
- Correção da revisão final:
  - a mescla aplica a trava de `editarPessoa`: quem não é Administrador não muda nome nem e-mail de aluno, esteja o
    cadastro acadêmico na principal ou na secundária (`MSG_NOME_ALUNO`);
  - o histórico da ficha inclui os eventos das lápides mescladas na pessoa, de forma transitiva, e mostra cada
    `PessoasMescladas` uma vez ("Contatos mesclados");
  - a importação só completa campos e põe tag em pessoa existente dentro de `escopoPessoas(autor)`; fora do escopo,
    conta como existente e não grava nada nela;
  - "Salvar campos" na ficha recarrega a tela e diz quantos campos ficaram salvos quando uma chamada falha no meio;
  - teste de exportação com 58 linhas (2 páginas, a 2ª com pessoas e empresas) conferindo `quantidade` do
    `DadosExportados`;
  - a importação registra `console.error` por linha que falha, só com o número da linha e o nome/código do erro.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test` (`vitest run`): saída 0, 675 arquivos e 4879 testes verdes (linha de base: ~671 arquivos e ~4850 testes).
- `npm run lint` (`eslint .`): 0 erros e 43 avisos (já existentes).
- Integração no perfil `dev-gravacoes`: `src/server/crm/`, `src/app/api/contatos/`, `src/app/api/exportacoes/` e
  `src/server/whatsapp/linha-comercial.int.test.ts`: 20 arquivos, 158 testes verdes e 1 falha, a preexistente da linha
  de base em `api/exportacoes` ("alunos exportados por professor mantêm vínculo atual…", falha igual no `main`).
  Nenhuma falha nova. O `vitest related` sobre os 32 .ts/.tsx do bloco alcança quase toda a suíte (via
  `src/lib/labels.ts` e afins) e parou no limite de 90 min; até ali só apareceram falhas preexistentes da linha de base
  (`agenda/substituicao-avisos`, `avaliacoes/impactos-progressao-tx`, `academico/visibilidade`,
  `academico/progressao-fechamento`, `avaliacoes/aproveitamento-aplicado`). A suíte `npm run test:int` completa fica
  com o integrador.
- **Mudança de permissão — coordenar com o integrador (Tarefa 22):** capacidade nova `dados.exportar_contatos`
  (`src/lib/capacidades.ts`, rótulo "Exportar contatos (sem telefone e e-mail)"), exigida por
  `/api/exportacoes/contatos`. O Administrador já a tem; para os demais papéis é concedida por usuário (`Usuario.permissoes`), como
  `dados.exportar_leads`. O integrador precisa confirmar essa capacidade e decidir a quem concedê-la antes do merge.
- Verificação final do bloco (17/10/2026, branch `claude/fase2-f-contatos`, Tarefas 22 a 24): `tsc --noEmit` saída 0;
  `npm test` 675 arquivos/4.879 testes, saída 0 (numa primeira rodada, com lint em paralelo, `confirmacoes.test.ts`
  estourou o tempo de 30 s por carga; isolado passa e a rerrodada completa passou); `npm run lint` 0 erros, 43 avisos.
  Integração no perfil `dev-gravacoes`: os 8 `*.int.test.ts` do diff + `src/server/crm`: 18 arquivos, 117 testes verdes,
  saída 0. O `vitest related` sobre o diff alcança 206 arquivos de integração (via `evento.ts`/`labels.ts`) e foi
  interrompido; até ali só falhou `agenda/substituicao-avisos`, preexistente da linha de base. Suíte completa fica com o integrador.
- **Merge da `main` (`0d091807`, com #202 a #206 e #208):** houve conflito só em `src/app/botoes.test.ts` (`AREAS_MIGRADAS`
  ficou com `/tarefas` e `/contatos`; na lista de alternâncias sem `aria-pressed` ficaram a `FichaContato` e o
  `BalaoMensagem`) e neste quadro (blocos H, 4A, 3E e F, cada um com o próprio **Estado**). `schema.prisma`,
  `labels.ts`, `nav.ts`, `Sidebar.tsx`, `trilha.ts`, as travas e mapas de `src/app/*.test.ts`, `Modal.tsx` e
  `despachante.ts` mesclaram sem conflito, e nenhuma linha do F ou da `main` se perdeu (o bloco F não traz migration;
  a última segue `20261017130000_whatsapp_motor_dados`). Verificação: `prisma validate` e `prisma generate`;
  `tsc --noEmit` saída 0; `npm run lint` com 0 erros (43 avisos já existentes); `vitest run` com 699 arquivos e 5050
  testes verdes. Num banco descartável próprio, `erp_genius_test_fix211` (localhost:54329), `prisma migrate deploy`
  aplicou tudo e passaram os 8 `*.int.test.ts` do diff e `src/server/crm` (21 arquivos, 148 testes, saída 0). O banco
  foi apagado no fim.
- **Correções da R1 do #211 (17/10/2026):**
  - **C2:** `editarPessoa` só liga a pessoa a empresa visível ao autor (`escopoEmpresas(autor, tx)`, como em
    `definirValorCampo`); empresa de outra carteira devolve "Empresa não encontrada." e nada é gravado. Teste novo em
    `ficha-contato.int.test.ts`.
  - **C3:** na importação, a Pessoa que nasce ligada a aluno ou responsável (telefone do cadastro acadêmico) não ganha
    oportunidade na carteira do vendedor. Pessoa existente fora da carteira faz `aplicarLinhaContato` lançar
    `LinhaForaDaCarteira`: a transação da linha é desfeita (inclusive o `ContatoWhatsApp` que `garantirPessoaTx` teria
    criado) e a linha conta em `foraDaCarteira` (resposta, tela e `ContatosImportados`), não em `atualizados`. Dois
    testes novos e dois ajustados em `api/contatos/importar/route.int.test.ts`.
- **Merge da `main` (`f8b8d21f`, com #207, #209 e #210):** conflito só neste quadro (ficam o bloco F e o da 3C, cada um
  com o próprio **Estado**). O resto mesclou sem conflito. O bloco F continua sem migration; a última passa a ser
  `20261017150000_fuso_exibicao_canonico`, da `main`.
**Estado**: Implementado; correções da revisão final aplicadas; aguardando o integrador (inclusive a confirmação de
`dados.exportar_contatos`). Não concluído.

## Inbox, bloco C: ações de atendimento (Fase 3, Tasks 14 a 20; 17/10/2026)

### Verificação para o PR (bloco C, branch `claude/fase3-c-acoes`, 17/10/2026)
- Tarefas: 14 (matriz de permissões do doc 03 e assumir/devolver/atribuir), 15 (abrir atendimento recusa fila fora do
  escopo), 16 (transferência = encerrar + abrir, com contexto como nota interna), 17 (participante de outro setor com
  prazo e revogação), 18 (nota interna nunca enviada), 19 (agendar reusando `agendadaPara`) e 20 (encaminhar como
  cópia, validando o escopo do destino). Branch empilhada sobre `claude/fase2-h-tarefas`; `main` 08e2b4b7 mesclado.
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros (43 avisos já existentes). `npm test`: 682 arquivos e 4940 testes,
  saída 0. A trava `confirmacoes.test.ts` acusou `e.constructor` em `erro-regra-atendimento.ts`; trocado por
  `Object.getPrototypeOf(e) === Error.prototype`. Numa rodada com a máquina carregada um teste dessa trava estourou o
  tempo (30 s); isolado e na rodada seguinte passou.
- Integração no perfil `dev-email`: os 12 arquivos `*.int.test.ts` do bloco (inbox/barramento, consultas-pagina,
  eventos-sse; whatsapp/abrir-atendimento-escopo, agendamento, atribuicao, encaminhar, nota-interna, participantes,
  pg-proc-whatsapp, saude, transferencia) passaram: 12 arquivos, 72 testes, saída 0. O `vitest related` completo
  alcança centenas de arquivos e foi interrompido após cerca de 70 min; os 4 arquivos que ele terminou antes
  (agenda/substituicao-avisos, diario/reposicao-agenda, diario/reposicao-permissoes, academico/visibilidade) falharam
  como na linha de base (falhas preexistentes sensíveis à data/visibilidade).
- **Base trocada para `main` e `main` mesclado (0d091807, com a Fase 4A #203 a #205, a Fase 3E #206 e o #208):** três
  merges (7ed4cc1b, bfce6d3b, f6bfe2e2). Os dois primeiros tiveram conflito só neste quadro; os blocos da 4A, da 3E e da
  3C ficaram, cada um com a própria linha **Estado**. O do #208 foi limpo. A 3C não mexe em `schema.prisma`,
  `labels.ts`, travas `src/app/*.test.ts`, `despachante.ts` nem `src/server/inbox` (barramento, consultas, SSE), então
  não houve disputa nesses arquivos. A 3C não tem migration; a ordem segue `20261017100000_inbox_tempo_real`,
  `20261017110000_inbox_indice_cursor_lista` (3E), `20261017120000` e `20261017130000` (4A). `prisma validate` ok.

### Correções da R1 do #207 (17/10/2026)
- **B1 (linha de VENDAS):** `assumirAtendimento` e `atribuirAtendimento` conferem, na mesma transação e depois do
  UPDATE, que o novo responsável enxerga o atendimento (`count` com `AND: [{ id }, escopoAtendimentos(alvo)]`). Se não
  enxergar, recusam com "Nesta linha de vendas o atendimento fica com o dono da linha; ele não pode ser assumido por
  quem não atende a linha." e nada é gravado. `atribuicao.int.test.ts`: os casos positivos passaram para um número
  que atende o COMERCIAL fora de VENDAS (ali o responsável gravado dá acesso) e chamam `atendimentoVisivel` depois de
  assumir e de atribuir; bloco novo com número VENDAS e `donoId: null` (vendedor não assume, gerente não atribui,
  o atendimento segue na fila e visível pela fila) e com número VENDAS do dono (o dono assume da fila e recebe a
  atribuição, e continua vendo). Commit e7fee8fa.
- **C1:** `main` mesclado (acima).
- **C2:** descrição do PR atualizada: base `main`, sem empilhamento.
- **C3:** a transferência para PEDAGOGICO exige `alocacaoTurma` ativa com o aluno, a turma e a matrícula da chave,
  como a lista de opções. Teste novo em `transferencia.int.test.ts`; o teste do trigger 265 passou a criar a alocação.
  Commit e7fee8fa.
- **C4 (pendência registrada, não corrigida aqui):** `devolverParaFila`, `atribuirAtendimento`,
  `transferirAtendimento`, `convidarParticipante` e `registrarNotaAtendimento` chamam `atendimentoVisivel` (que usa o
  `prisma` global, assim como `escopoAtendimentos`, `escopoComercialAtual` e a leitura de alocações do professor)
  dentro da transação interativa, nas quatro primeiras com o `FOR UPDATE` já tomado. Cada ação usa duas conexões do
  pool ao mesmo tempo; com `connection_limit` baixo e concorrência, o pool pode esgotar. A correção é passar um `db`
  opcional por `atendimentoVisivel`, `escopoAtendimentos` e os helpers de escopo comercial; como mexe no escopo usado
  por todo o Inbox, fica para uma tarefa própria.
- **C5:** `revogarParticipante` cancela (`CANCELADA`) as intenções HUMANO `PENDENTE`/`ADIADA` do revogado no
  atendimento, salvo se ele ainda puder enviar por outro vínculo (conferido com `escopoAtendimentos(…, { enviar })`).
  Teste novo em `participantes.int.test.ts`. Commit e7fee8fa.
- Verificação com o `main` 0d091807 mesclado: `prisma generate`; `tsc --noEmit` com saída 0; `npm run lint` com 0 erros
  (43 avisos já existentes); `vitest run` com 697 arquivos e 5065 testes, todos verdes (numa rodada anterior a trava
  `confirmacoes.test.ts` estourou os 30 s com a máquina carregada; isolada passa). Integração num banco descartável
  `erp_genius_test_fix207` (migrate deploy, apagado no fim): os 7 `*.int.test.ts` da 3C e os 3 de `src/server/inbox`,
  10 arquivos e 72 testes, saída 0.
**Estado**: Implementado; aguardando revisão e merge. Não concluído.

## Fase 4B — despachante pelo motor: correção da revisão final (17/10/2026)

- Branch `claude/fase4-b-despachante`. Os testes de integração live migraram para `vi.mock('drivers/motor')` com
  números MOTOR, sem `skip`: despachante.live, ciclo-cobranca, acesso-atendimento, destinatario-atual, origem-celular
  (clientMessageId da mensagem = o da intenção), atendimento-pedagogico-autorizacao, cobrancas/conferencia,
  agenda/substituicao-avisos e academico/visibilidade.
- Guarda contra envio real em teste: `vitest.integration.config.ts` zera `MOTOR_URL`/`MOTOR_API_KEY`. Teste-trava:
  `motor/guarda-teste.int.test.ts`.
- Doc 30 §S1 reescrito: a trava vale só para BAILEYS legado; MOTOR e Meta aceitam automação (D38). Textos de
  PoliticaPainel, AvisosAgendaPainel e `salvarConfiguracaoAvisosAgenda` corrigidos.
- Integração (perfil `integracao`), 13 arquivos tocados: verdes, salvo as falhas preexistentes da linha de base:
  academico/visibilidade (6, trigger P0001) e agenda/substituicao-avisos (3). Essas 3 viram SIMULADA pela política de
  cobrança DESLIGADA antes do driver e falham igual no HEAD anterior. O ruling está em
  `.superpowers/sdd/rulings-claude_fase4-b-despachante.md`.
- `tsc --noEmit` 0. `npm run lint`: 0 erros e 43 avisos (já existentes). Testes unitários: 677 arquivos e 4903 testes.
  `contraste`/`confirmacoes` estouraram o tempo uma vez, com load ~20 de outras faixas, e passam isolados. O
  `PoliticaPainel.confirmacao` (rótulo "Meta cloud (legado)" da Tarefa 1) foi corrigido.
**Estado**: Implementado; aguardando o integrador.

## Fase 4B — verificação final do bloco (17/10/2026)

- Branch `claude/fase4-b-despachante`, tarefas 5 a 8 do plano `04-fase-motor.md`, empilhada sobre `claude/fase4-a-driver-motor`.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm run lint`: saída 0, 0 erros e 43 avisos (já existentes).
- `npm test`: saída 0, 677 arquivos e 4903 testes. Duas rodadas anteriores falharam em varreduras do src
  (`confirmacoes`, `contraste`) por estouro de 30 s com load ~20 de outras faixas; `testTimeout` unitário subiu para 120 s
  e `confirmacoes` ganhou 120 s no teste da varredura.
- Integração (perfil `integracao`), 14 arquivos `*.int.test.ts` do diff: 12 verdes, 116 testes. Falham só as preexistentes:
  academico/visibilidade (6) e agenda/substituicao-avisos (3). `vitest related` não foi usado: `labels.ts` espalha o
  alvo por quase toda a suíte; a completa fica com o integrador.
**Estado**: Implementado; aguardando o integrador.

### Correções da R1 do #213 (17/10/2026)
- **B1 (conflito com o `main`):** mesclados o `main` até a #210 (`f8b8d21f`) e depois a #212 (`d5930411`). Conflitos:
  `despachante.ts` (DRIVERS só com MOTOR, como na 4B, mais o `driverDoNumero` tipado da R1 do #205 e o
  `clientMessageId` gravado no claim), `agenda/substituicao-avisos.int.test.ts` (flag de agenda ligada mais o id
  `3EB0-…` do motor) e este quadro. A retenção de agenda da #209/#212 (`decidirEnvio`/`RETER_AGENDA`,
  `reterAvisoAgenda`, `retidasAgenda`) fica antes do passo 10 e do claim: o aviso retido não vira SIMULADA nem vai
  ao driver. Teste novo em `despachante-motor.int.test.ts`; `despachante-driver.test.ts` passou para a semântica da
  4B (MOTOR registrado; META_CLOUD/BAILEYS sem driver).
- **C1:** `driverAceitaAutomacao` aceita só MOTOR. `salvarConfiguracaoAvisosAgenda`, `motivoConfiguracaoAgendaInvalida`
  e `salvarPoliticaRegua` (ao armar) recusam META_CLOUD com "Meta Cloud ainda não tem envio disponível."; o
  `PoliticaPainel` mostra o mesmo aviso para remetente Meta. Testes: `canal`, `cron`, `comunicacoes-agenda/whatsapp`,
  `PoliticaPainel.confirmacao` e `politica.int`.
- **C2:** `testTimeout` unitário volta para 30 s; 120 s só na varredura do `src` de `contraste.test.ts` (como já
  estava em `confirmacoes.test.ts`).
- Verificação: `tsc --noEmit` 0; `npm run lint` 0 erros (43 avisos já existentes); `npm test` verde; integração
  (whatsapp, agenda/substituicao-avisos, comunicacoes-agenda, academico/visibilidade, cobrancas/conferencia,
  comercial/regua-comercial): 49 arquivos verdes, sem as falhas preexistentes citadas acima.
**Estado**: Implementado; correções da R1 aplicadas; aguardando o integrador.

## Pendências não bloqueantes das revisões do #212 e do #213 (17/10/2026)

- Branch `claude/pendencias-212-213`.
- **C1 do #212:** `medirSaudeCanal` só conta `retidasAgendaDesligada` com `COMUNICACOES_AGENDA_ENVIO_ENABLED`
  desligado. Com o envio ligado, o valor é 0, mesmo que o motivo `envio_agenda_desligado` continue gravado até o
  próximo tick. Testes novos (falhavam antes) em `saude.test.ts` e `saude.int.test.ts`.
- **C4 do #213:** o comentário da trava de driver em `despachante.ts` e o doc 30 (§S1 e a ordem dos guard-rails)
  dizem agora que só MOTOR aceita automação; META_CLOUD fica de fora até ter driver no despachante. A linha da
  Fase 4B acima ("MOTOR e Meta aceitam automação") é histórica e foi mantida.
- Verificação: `tsc --noEmit` 0; `npm run lint` 0 erros (43 avisos já existentes); `npm test` 707 arquivos e 5191
  testes; integração em banco descartável (`saude`, `agenda/substituicao-avisos`, `despachante-motor`): 3 arquivos e
  45 testes verdes.
**Estado**: Implementado; aguardando revisão e merge.

## Fase 4C — verificação final do bloco (17/10/2026)

- Branch `claude/fase4-c-webhook`, tarefas 9 a 17 do plano `04-fase-motor.md`, partindo da `claude/fase4-b-despachante` (base trocada para o `main` após o merge da #213).
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 681 arquivos e 4928 testes.
- `npm run lint`: saída 0, 0 erros e 43 avisos (já existentes).
- Integração (perfil `integracao`): `vitest related` foi interrompido por varredura ampla (`evento.ts` alcança quase toda a suíte);
  rodados os 10 arquivos `*.int.test.ts` do diff e de `whatsapp/motor/` + `inbox` + `saude`: saída 0, 88 testes verdes.
- **Merge do `main` após a #213 (17/10/2026):** base do #215 trocada para o `main`; mesclados o merge final da 4B
  (B1/C1/C2), #207, #209, #210, #211 e #212; depois a #214 (retidas só contadas com o envio de agenda desligado). Conflitos, todos aditivos: `api/whatsapp/cron/route.ts` (+teste)
  roda `eventosMotor` e `lembretesTarefas`; `saude.ts` (+`saude.int.test.ts`) soma os campos do motor
  (`eventosMotorPendentes`/`eventosMotorFalhos`) aos da retenção de agenda (`retidasAgendaDesligada`/
  `envioAgendaHabilitado`) e ao relógio da agendada vencida; este quadro. `saude.test.ts` (vindo do `main`) ganhou o
  mock de `eventoMotorRecebido`. Mantidos o `testTimeout` de 30 s e `driverAceitaAutomacao` só com MOTOR. A 4C não
  tem migrations próprias (usa as `20261017120000`/`20261017130000` da 4B).
- Verificação pós-merge: `tsc --noEmit` 0; `npm run lint` 0 erros (43 avisos); `npm test` verde; integração
  (`whatsapp/motor/*`, `inbox`, `saude`, `despachante-*`): 14 arquivos, 126 testes verdes.

### Correções da R1 do #215 (17/10/2026)
- **B1:** merges do `main` acima (até a #214), preservando as duas etapas do cron e os campos de saúde dos dois lados.
- **B2:** a saúde mede os eventos do motor por estado. `eventosMotorPendentes` conta só o que o dreno já deveria
  pegar (sem backoff ou com a próxima tentativa vencida); `eventosMotorAdiados` (novo) conta os em backoff, sem
  alerta. O alerta "Evento do motor parado" só olha evento sem backoff recebido há mais de 15 min ou com a próxima
  tentativa vencida há mais de 15 min (minutos medidos desde a próxima tentativa). Testes em `saude.int.test.ts`.
- **C1:** `sessao.estado` ignora (`ignorado:estado_antigo`) o estado com `ocorridoEm` anterior ao de outro
  `sessao.estado` do mesmo número já aplicado (`resultado = ok`) na tabela de entrada; sem migration. Testes em
  `processar-sessao.int.test.ts` (direto e pelo dreno).
- **C3:** `POST /api/whatsapp/webhook/motor` recusa com 413, antes do HMAC e sem gravar, corpo acima de 1 MB
  (`TETO_CORPO_WEBHOOK_MOTOR`): pelo `content-length` declarado e pelo tamanho lido em streaming. Maior evento do
  contrato: `mensagem.recebida` com texto longo (~260 KB no pior caso UTF-8). Testes em `route.test.ts`.
- **C2:** segue em aberto (os `*.int.test.ts` não rodam no CI).
**Estado**: Implementado; correções da R1 aplicadas; aguardando o integrador.

## CRM, bloco J: saída de `/leads` e da ficha antiga (Fase 2, Tarefas 36 e 37; 17/10/2026)

### Verificação para o PR (bloco J, branch `claude/fase2-j-saida-leads`, 17/10/2026)
- Tarefas: 36 (links e revalidações de lead apontam para `/funil`) e 37 (saem `/leads`, `/leads/[id]` e
  `/leads/[id]/contratacao`; a guarda `src/app/sem-rota-leads.test.ts` impede a volta).
- Correção da revisão final:
  - saiu o código que só servia à lista e à ficha antigas: `sanearFiltrosLeads`, `hrefLeads`, `destinoPaginaLeads`,
    `hrefDosCamposLeads`, `camposDosFiltrosLeads`/`CamposLeads`, `filtrosLeadsParaQuery`, `temFiltroLeads` e
    `LEADS_POR_PAGINA` (`src/server/comercial/filtros.ts`), `listarLeadsPagina` (`src/server/comercial/consultas.ts`) e
    `tituloLead` (`src/server/titulos-registro.ts`), com os testes deles. Ficam `lerFiltrosLeads`,
    `filtrosDaConsultaLeads`, `whereFiltrosLead` e `listarLeads`, usados por `/api/exportacoes/[tipo]`;
  - `revalidarLead()` (`src/server/comercial/acoes.ts`) e `revalidar()` (`src/server/matricula/acoes.ts`) perderam o
    parâmetro sem uso, e os `leadId` que só alimentavam esse argumento saíram dos chamadores. Os 2 avisos novos de lint
    sumiram.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm run lint`: saída 0, 0 erros e 43 avisos (os mesmos da linha de base).
- `npm test`: primeira rodada com 1 falha por timeout (`src/app/confirmacoes.test.ts`, container sob carga das outras
  faixas, load average 12 a 18); a repetição saiu com 693 arquivos e 5017 testes verdes, saída 0.
- Integração no perfil `dev-gravacoes` (as 5 migrations da `main` aplicadas só nesse banco com `prisma migrate deploy`):
  `vitest run -c vitest.integration.config.ts --changed origin/claude/fase2-f-contatos` (os `*.int.test.ts` que o diff
  toca, pois `vitest related` com os 49 arquivos estourou os 30 min): 36 arquivos e 518 testes verdes, saída 0. A suíte
  `npm run test:int` completa (mais de 2 h) fica com o integrador.

### Base trocada para `main` e correções da R1 do #216 (17/10/2026)
- **Merges do `main`:** três merges, `f8d6969a` (#211, #212, #213 e #207), `019503f0` (#214) e `ec188b0d` (#215,
  Fase 4C). Nos três o conflito foi só neste quadro; ficam os blocos de cada PR, com o próprio **Estado**. O código
  mesclou sem conflito, e o `main` não trouxe novos links ou usos de `/leads` nem da ficha antiga. Sem migration nova.
- **B1:** as edições que só existiam na ficha antiga ficam no `PainelOportunidade` do `/funil`
  (`src/app/(app)/funil/EdicaoOportunidade.tsx`), com as mesmas server actions, o mesmo papel e o mesmo escopo de
  carteira. Na aba Detalhes: resumo e próximo passo (`atualizarResumo`); datas e follow-up (`atualizarDatas`); dados
  da oportunidade (`editarLead`; temperatura e a origem que a tela não mostra vão como estão); documentos
  (`anexarDocumentoLead`, com upload ligado à oportunidade e à categoria, e `arquivarDocumentoLead`). Na aba
  Atividade: registrar interação (`registrarInteracao`). Edita quem tem `funil.mover`.
  - `obterOportunidade` traz os campos novos e os documentos ativos com o filtro de `obterLead`.
  - O plano (Tarefas 15 a 18, 36 e 37) não dava destino a essas edições.
  - Testes: `EdicaoOportunidade.interacao.test.ts`, `PainelOportunidade.test.ts` e `historico.int.test.ts`. A trava
    `sem-rota-leads.test.ts` passa a exigir as cinco seções no painel e as seis ações. Manifestos `botoes-mapa`,
    `campos-mapa` e `estados-vazios-mapa` atualizados.
- **C2:** redirects permanentes em `next.config.mjs`: `/leads` → `/funil`, `/leads/:id` → `/funil?o=:id` e
  `/leads/:id/contratacao` → `/oportunidades/:id/contratacao`. Teste em `sem-rota-leads.test.ts`.
- **C3 (decisão):** a entrada da matrícula a partir da oportunidade é "Preparar contratação"
  (`/oportunidades/[id]/contratacao`). O "Converter em matrícula" da ficha antiga (`/matriculas/nova?lead=<id>`)
  não volta. O pré-preenchimento por `?lead=` em `/matriculas/nova` fica no código por enquanto; a remoção é uma
  tarefa à parte.
- Verificação depois do último merge, num banco descartável `erp_genius_test_fix216` (`migrate deploy`, apagado no
  fim):
  - `tsc --noEmit`: saída 0.
  - `npm run lint`: 0 erros e 43 avisos já existentes.
  - `npm test`: 706 arquivos e 5204 testes verdes, saída 0.
  - Integração: os `*.int.test.ts` tocados pelo diff da 2J (`--changed origin/main`), pelos três merges e pela R1.
    Foram 61 arquivos e 728 testes verdes. A rodada saiu com código 1 por um erro não tratado
    (`ErroAutenticacao`) atribuído a `portal-aluno/preferencia-fuso.int.test.ts`, no teste de revogação concorrente.
    O arquivo veio do `main` e não é tocado pela 2J; isolado, passou duas vezes (9 testes, sem erro).
**Estado**: Implementado; base `main`; correções da R1 aplicadas. Antes do merge, o integrador precisa rodar `npm test`
completo e `npm run test:int` no `.erp-test-profile`, os dois com saída 0. Não concluído.

## Inbox, bloco F: aceite das 21 regras e remoção do Inbox antigo (Fase 3, Task 33; 17/10/2026)

- `src/server/inbox/regras-inbox.int.test.ts`: um `it` por regra do §4.4 (21 testes, com o número no nome), sobre as funções
  reais de produção e o Postgres de teste, driver simulado. Saída 0 (21 testes).
- Removidos: `InboxCliente.tsx` (e os dois testes) e `AtendimentosPainel.tsx` (e o teste). A triagem do número e a revisão de
  envio incerto foram para `PainelTriagem.tsx`, dentro da conversa aberta (e na tela "Escolha uma conversa"); a triagem
  aparece a quem `listarTriagemWhatsApp` aceita (administrador ou responsável pela triagem do número), a revisão só ao
  administrador. O formulário "Abrir atendimento" foi para `NovoAtendimento.tsx`, sem mudança de comportamento.
- Travas globais ajustadas sem afrouxar: `botoes-mapa.ts`, `botoes.test.ts`, `confirmacoes-mapa.ts`, `confirmacoes.test.ts`,
  `enums-rotulos.test.ts`, `estados-vazios-mapa.ts` (entradas do arquivo removido saíram; as dos arquivos novos entraram) e
  `sem-polling.test.ts` (a lista `LEGADO` ficou vazia). O que estava pendente da Task 33 nas telas novas foi corrigido no
  código: `PainelSetor` usa rótulos (`ETAPA_LABEL`, `STATUS_COBRANCA_LABEL`, `SETOR_ATENDIMENTO_LABEL`) e `EstadoVazio`;
  `AcoesAtendimento` passa o tipo do aviso (convite/agendamento) em vez de texto livre.
- Nenhum link ou rota aponta para o Inbox antigo (`/inbox` é a mesma página; só a Sidebar linka).

**Pendências explícitas da Task 33 (a confirmar com o produto antes do PR)**

- Regressão funcional, em aberto até decisão do produto: o opt-out voltou (ver a correção da revisão final, abaixo). Na thread
  continuam sem botão: criar lead, vincular contato, editar nome, retomar régua/tratar, registrar pagamento, anexar e gravar áudio.
  As Server Actions seguem testadas (regras 10, 12 e 14). Antes do merge, o integrador precisa da decisão do produto por escrito:
  repor (e qual tarefa faz isso) ou aceitar a perda.
- Regra 18, lacuna de requisito: o brief pede "upload no visível", mas `src/app/api/upload/route.ts` não tem upload por atendimento
  (é por lead/matrícula). O teste 18 cobre envio só de arquivo do próprio autor e download no escopo. Upload por atendimento fica
  como lacuna para a tarefa dona do envio de mídia.
- Regra 21: o brief cita `AgendamentoCancelado`; o evento real gravado é `MensagemAgendadaCancelada`, e o teste usa o real.
- Evidência pendente: `npm run test:int` completo não foi rodado (mais de 2 h; proibido na faixa). Só `regras-inbox.int.test.ts`
  (21/21). A Task 33 só conta como concluída com essa ressalva, até o integrador rodar o `test:int`.

**Correção da revisão final do bloco F (17/10/2026)**

- Tasks 30 e 32 ligadas na tela: `InboxNovo` usa `ListaAtendimentos` (setor, número, status, responsável, "Prazo estourado",
  virtualização acima de 100 linhas) e `PainelFiltros`. As opções do filtro vêm de `opcoesFiltroInbox`
  (`src/server/inbox/opcoes-filtro.ts`). Quando o filtro muda, a lista recomeça da nova primeira página, por estado derivado e sem
  key de remontagem. O `PainelSetor` fica no aside e no Drawer e é lido por `GET /api/inbox/atendimentos/[id]/painel`
  (`carregarPainel`; 401, 403 e 404 fora do escopo).
- Opt-out reposto no painel da conversa (`OptOutContato.tsx`). O registro passa por `ConfirmarAcao`, e o par voltou à lista
  fechada de `confirmacoes-mapa.ts`. O administrador remove o opt-out com evidência de 12 caracteres ou mais.
- `PainelTriagem`: lista vazia conta como ausência, então não aparece `<details>` com "· 0". `DialogoPessoa` e `DialogoPendentes`
  carregam em `useEffect`, não mais durante o render. O convite usa mapeamento tipado do `Resultado`. O valor do painel Comercial
  sai com `toFixed(2)`, como o do Financeiro.
- Verificação: `tsc --noEmit` com saída 0; `eslint src --quiet` com saída 0; `npm test` com 703 arquivos e 5104 testes, todos
  verdes; integração em `regras-inbox`, `paineis` e `opcoes-filtro` (3 arquivos, 27 testes) com saída 0.
  O `npm run test:int` completo continua pendente para o integrador.

## Fase 3F: telas do Inbox novo (17/10/2026)

- Branch: `claude/fase3-f-telas` (base main 35d8263a). Tarefas 29 a 33: casca, lista, conversa, painel lateral por setor e remoção do Inbox antigo.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 703 arquivos e 5104 testes verdes (linha de base: ~697/~5060).
- `npm run lint`: saída 0; 0 erros e 43 avisos.
- Integração relacionada (`vitest list --filesOnly --changed origin/main` com `vitest run -c vitest.integration.config.ts` sobre os 97 arquivos `*.int.test.ts` apontados): saída 0; 96 arquivos passaram, 1 ignorado; 1041 testes passaram, 1 ignorado. O `vitest related` direto passou de 30 min sem terminar, por isso a lista foi resolvida antes e rodada em seguida.
- A suíte de integração completa (`npm run test:int`) não foi rodada; fica para o integrador.

**Correção da R1 do #217 (17/10/2026)**

- **B1 (merge do main até 2d53a7c9, #208 a #216):** `InboxCliente.tsx` continua removido (o #216 só trocava o link do
  cadastro para `/funil?o=<id>`; o Inbox novo usa esse link). `botoes.test.ts` com os dois lados (sai `leads/[id]/FichaLead.tsx`
  e `InboxCliente`, entram `contatos/FichaContato.tsx`, `ConversaAberta` e `ListaAtendimentos`; `AcoesContato` entra em
  `botoes-mapa.ts` e `estados-vazios-mapa.ts`). `Modal.tsx`
  junta `folha` (3F) e `telaCheiaNoCelular` (2F), com `telaCheiaNoCelular` mandando no layout. Quadro com os dois blocos.
  Conflito de comportamento achado e ajustado: o despachante da Fase 4B só envia pelo motor, então as regras 11 e 12 de
  `regras-inbox.int.test.ts` passaram a usar número MOTOR e `drivers/motor` simulado.
- **C2 (decisão do dono, 17/10/2026: portar tudo para o Inbox novo antes do merge):** a pendência da Task 33 acima fica resolvida.
  No painel lateral (`AcoesContato.tsx`, abaixo do `PainelSetor`): criar oportunidade (`criarLeadDaConversa`), vincular contato
  (`vincularContatoWhatsApp`, só dentro de `ConfirmarAcao`; voltou à lista fechada de `confirmacoes-mapa.ts`), editar nome
  (`editarNomeContatoWhatsApp`), retomar régua (`marcarConversaTratada`), registrar pagamento (`PagamentoModal`) e promessa
  de pagamento (`registrarPromessaPagamento`). Links: oportunidade em `/funil?o=<id>` (também no `PainelSetor`), aluno em
  `/alunos/<id>`. As regras de quem vê cada botão vêm de `carregarAcoesContatoInbox` (`consultas-inbox.ts`), as mesmas de
  `carregarThread` (regras extraídas para `regrasCadastroDoAtendimento` e `silencioPosInbound`, usadas pelas duas), e cada
  Server Action confere a alçada de novo. Sem telefone no painel (regra 5). Anexar arquivo e gravar áudio já estavam no
  `Compositor` (upload em `/api/whatsapp/upload` e `enviarMidiaInbox`); ganharam testes de interação.
- **C3:** o menu da mensagem mostra só os comandos que a conversa executa (`COMANDOS_MENSAGEM_LIGADOS = ["copiar"]`).
- **C4:** o compositor usa `podeEnviarNaConversa` (`podeExecutar(usuario, "enviar", …)` e atendimento ENCERRADO não envia).

## Pendências não bloqueantes do #215 (C4) e do #217 (C6, C7) (18/10/2026)

- Branch: `claude/pendencias-215-217` (base main 6d6d33ee). Cada item com teste falhando antes da correção.
- **C4 do #215:** o alerta "Evento do motor parado" passa a medir o evento mais atrasado, não o de menor `seq`. O critério
  de "parado" não mudou: sem backoff conta desde `recebidoEm`, em backoff conta desde a `proximaTentativaEm` vencida, sempre
  além do limiar de 15 min. São duas consultas, cada uma ordenada pelo seu relógio, e vale a mais antiga das duas
  (`saude.ts`). Teste em `saude.int.test.ts` com o evento de `seq` menor menos atrasado.
- **C6 do #217:** o compositor do Inbox novo decide pelo `podeEnviar` da thread (`atendimentoVisivel(usuario, id, true)`), que
  `carregarPainel` passa a devolver, e não mais por `podeExecutar("enviar")`, que libera todo mundo.
  `InboxNovo` passa esse valor do painel do atendimento aberto à `ConversaAberta` (falso enquanto o painel carrega).
  `podeEnviarNaConversa(item, podeEnviar)` continua barrando ENCERRADO. Testes de componente em `ConversaAberta.test.ts` e
  de integração em `paineis.int.test.ts`: o responsável envia, o convidado só de leitura não envia, o convidado com envio envia.
  Revisão: a secretaria responsável recebe `podeEnviar: false` quando o aluno do atendimento não tem o telefone do contato.
  O envio real recusa no mesmo caso, porque `enviarTextoInbox` usa `conversaVisivel(…, true)`, alias da mesma função
  `atendimentoVisivel`, e quem recusa é `destinatarioAtualDoAtendimento`. O painel está coerente com o envio.
  `paineis-envio.int.test.ts` compara o painel com `enviarTextoInbox` em três casos: telefone do aluno igual ao do contato
  (envia), aluno sem telefone ou com outro telefone (não envia) e secretaria sem aluno (envia).
- **C7 do #217:** com o contato em opt-out (`atual.optOut`), o bloco "Retomar régua" some do painel (`AcoesContato`/`CobrancaContato`),
  como no Inbox antigo. Pagamento e promessa continuam. Teste de interação em `AcoesContato.test.ts`.
- Verificação: `tsc --noEmit` com saída 0; `eslint .` com saída 0 (0 erros, 43 avisos, nenhum nos arquivos tocados);
  `npm test` com saída 0 (714 arquivos, 5276 testes). Integração com saída 0 em `saude.int.test.ts` (20 testes) e em
  `src/server/inbox/` (7 arquivos, 64 testes), rodada num banco descartável próprio. O `npm run test:int` completo não
  foi rodado; fica para o integrador.

## Fase 4D — verificação final do bloco (18/10/2026)

- Branch `claude/fase4-d-inbox-motor` (PR empilhado sobre `claude/fase4-c-webhook`), tarefas 18 a 24b do plano `04-fase-motor.md`.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 714 arquivos e 5245 testes (linha de base da 4C: 711/5220).
- `npm run lint`: saída 0, 0 erros e 43 avisos (já existentes).
- Integração (perfil `integracao`): `vitest related` ficou varrendo a suíte inteira (`evento.ts`/`schema.ts` alcançam quase tudo) e foi
  interrompido; rodados os 7 `*.int.test.ts` do diff (`acoes-numero`, `linha-comercial`, `motor/acoes-admin`, `motor/acoes-mensagem`,
  `motor/conteudo`, `motor/grupo-envio`, `motor/presenca`): 89 testes verdes; e `despachante-motor/comercial/agendada` + `inbox`:
  43 testes verdes. Sem falhas novas.
**Estado**: Implementado; aguardando revisão e merge (depois da 4C).

**Base trocada para `main` e correções da R1 do #219 (18/10/2026)**

- **Merges do `main`:** dois merges, `2e4efada` (#216 e #217) e o de `ad4142cd` (#218).
  - Conflitos: este quadro (ficam os blocos de cada PR), `Compositor.test.ts` (testes de anexo e áudio do #217 junto com os de capacidades da 4D) e `ConversaAberta.tsx` (o `podeEnviar` do painel do #218 junto com as capacidades da 4D).
  - A 4D não mexia no Inbox antigo removido pela 3F. Sem migration nova.
- **B1:** o Inbox novo decide os recursos do motor por `ItemListaInbox.capacidades`, calculado com `capacidadesDoNumero` como em `ThreadConversa.capacidades`. Antes decidia por `recursoDisponivel(item.driver)`, que libera MOTOR com a sessão caída. O compositor recebe `capacidades`.
- **C4:** `COMANDOS_MENSAGEM_LIGADOS = ["copiar", "reagir", "editar", "apagar"]`, filtrados por mensagem em `comandosDaMensagem`.
  - Cada comando exige a capacidade do número, o envio liberado e a mensagem não apagada. Editar e apagar valem só na própria mensagem de saída, e editar só em texto. `MensagemThread` ganha `propria` e `apagada`.
  - Os diálogos ficam em `inbox/AcoesMensagem.tsx`. Apagar roda em `ConfirmarAcao` e entrou na lista fechada.
  - Encaminhar fica fora: falta a escolha da conversa de destino.
- **C6:** `criarGrupoWhatsApp` confere `grupoNovoNoEscopo`, que tem os mesmos ramos de `escopoGrupos`. Teste em `motor/acoes-admin.int.test.ts`.
- Verificação num banco descartável `erp_genius_test_fix219` (`migrate deploy`, apagado no fim):
  - `tsc --noEmit`: saída 0.
  - `npm run lint`: 0 erros e 43 avisos já existentes.
  - `npm test`: 718 arquivos e 5314 testes verdes, saída 0.
  - Integração (`src/server/whatsapp`, `src/server/inbox`, `src/app/api/inbox`, `src/app/api/whatsapp`): 59 arquivos e 473 testes verdes, saída 0.
  - O `npm run test:int` completo fica com o integrador.
**Estado**: Implementado; base `main`; correções da R1 aplicadas; aguardando revisão.

## Pendências da revisão do #218 (C2, C3) (18/10/2026)

- **C2:** o compositor do Inbox novo distingue permissão carregando (`podeEnviar: null` → "Carregando…", em `role="status"`),
  painel que falhou (`falhaPermissao` → erro em `role="alert"` com o `<Botao>` "Tentar de novo", que volta a carregar) e
  permissão negada (`false` → o motivo). Continua falhando fechado: só `true` envia. Testes em `Compositor.test.ts`,
  `ConversaAberta.test.ts` e `InboxNovo.interacao.test.ts`.
- **C3:** um aviso do SSE do atendimento aberto, ou um `resync`, recarrega o painel (`versaoPainel`). Assim o compositor libera
  quando alguém transfere ou convida com envio. Teste de componente que simula o aviso em `InboxNovo.interacao.test.ts`.
- Verificação: `tsc --noEmit` com saída 0; `eslint .` com saída 0 (0 erros, 43 avisos, nenhum nos arquivos tocados);
  `npm test` com saída 0 (715 arquivos, 5288 testes). Nenhuma mudança no servidor, então a integração não foi rodada.

**Correções da R1 do #220 (18/10/2026)**

- **B1:** merge do `main` com o #219 (4D). O `Compositor` recebe `podeEnviar: boolean | null`, `falhaPermissao?` e `capacidades`, e
  não tem mais `driver`. Em `ConversaAberta` o null de carregando vai só ao compositor; `comandosDaMensagem` recebe
  `envioLiberado === true`, então carregando não libera comando.
- **C1:** só `atendimento.atualizado` do atendimento aberto e `resync` recarregam o painel; `mensagem.nova` e `mensagem.status`, não.
  Esses são os tipos reais do SSE (`AvisoInbox`). O convite de participante não gera aviso: a tabela de participantes não tem
  trigger de `notificar_inbox`. Por isso o convite com envio só libera o compositor depois de um `resync`, de uma ação na
  tela ou de reabrir a conversa (pendência de servidor).
- **C2:** se a recarga falha e o painel daquele atendimento já tinha carregado, fica o último painel conhecido. O erro com
  "Tentar de novo" aparece só na carga inicial. Testes em `InboxNovo.interacao.test.ts`.

## Fase 4E — remove Meta/Evolution e sobe o motor (18/10/2026)

- Branch `claude/fase4-e-remove-legados` (PR #221; nasceu empilhado sobre a 4D e hoje tem base `main`), tarefas 25 e 26 do plano `04-fase-motor.md`:
  remoção dos drivers, webhooks e templates de Meta e Evolution; deploy com o serviço do motor no lugar do Evolution.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 711 arquivos e 5232 testes.
- `npm run lint`: saída 0, 0 erros e 43 avisos (já existentes).
- Integração (perfil `integracao`): `vitest related` varria quase toda a suíte e foi interrompido; rodados os 37 `*.int.test.ts` do diff:
  37 arquivos, 326 testes verdes. Sem falhas novas.
**Estado**: Implementado; aguardando revisão e merge (depois da 4D).

**Base trocada para `main` e correções da R1 do #221 (18/10/2026)**

- **Merge do `main`** (`3e909715`: #216, #217, #218, #219 com a 4D e #220). Conflitos:
  - `InboxCliente.tsx`, `InboxCliente.test.ts` e `InboxCliente.confirmacao.test.ts`: fica a remoção da 3F.
  - `consultas-inbox.ts`: fica a refatoração do `main` (`silencioPosInbound`, `regrasCadastroDoAtendimento`, `propria`/`apagada`);
    sai `janela24h`, que dependia de `META_CLOUD`. O Inbox novo (`InboxNovo*`, `AcoesAtendimento*`) não lê `janela24h`.
  - este quadro (ficam os blocos de cada PR).
  - Sem migration nova no `main` nem nesta branch.
- **B1, além do diff original:** os testes que o `main` trouxe (`AcoesAtendimento.test.ts`, `InboxNovo.test.ts`,
  `InboxNovo.interacao.test.ts`, `consultas-pagina`, `opcoes-filtro`, `paineis` e `regras-inbox.int.test.ts`) passam a usar
  `DriverWhatsApp.*` no lugar das strings `"BAILEYS"`/`"META_CLOUD"` (trava `sem-provedores-legados.test.ts`).
  `regras-inbox.int.test.ts` deixa de mockar `drivers/meta-cloud` e `drivers/evolution`, apagados. A regra 15 desse arquivo
  passa a receber a mensagem com `driver: MOTOR`: `criarNumeroSetor` cria número MOTOR desde a 4E, e o inbound acha o número
  pelo driver (com `META_CLOUD` a mensagem não era gravada e o teste falhava depois do merge).
- **C1:** `scripts/backup-producao.sh` para o motor só durante o tar de `/data` (PGlite em arquivo) e o religa em seguida,
  também em erro (`trap religar_motor EXIT INT TERM`). O tar roda num container auxiliar (`alpine:3.20`, `IMAGEM_TAR`) com
  `--volumes-from` do container do motor, sem depender de tar na imagem do motor. O restore usa o mesmo container auxiliar.
  Teste em `src/deploy/motor-compose.test.ts`. Nada foi rodado contra um ambiente real.
- **C2:** a saúde do canal (`saude.ts`) alerta cada `NumeroWhatsApp` ativo com driver legado (`BAILEYS` ou `META_CLOUD`; o
  enum não tem `EVOLUTION`). Testes de integração em `saude.int.test.ts`. Passo de migração em `SETUP.md` ("Números legados"):
  reparear a linha no motor (converter o registro para `MOTOR` e conectar por QR ou código) ou desativar o número legado.
- **C3:** `importarHistoricoLinha` (`src/server/whatsapp/historico.ts`) ficou sem chamador: o motor não manda histórico por
  nenhuma rota. Saem o módulo, `historico.test.ts` e o bloco LC-10/LC-11 de `linha-comercial.int.test.ts`. Se o motor
  passar a enviar o histórico do aparelho, a importação volta com a rota que a chamar.
- **C4:** sem avisos do eslint nos arquivos alterados: sai `destinosAgenda` (sem uso) de `comunicacoes-agenda/whatsapp.ts`, e
  `substituicao-avisos.int.test.ts` tipa o transporte com `vi.fn<...>` em vez do parâmetro `_entrada` sem uso.
- Verificação num banco descartável `erp_genius_test_fix221` (`migrate deploy`, apagado no fim):
  - `tsc --noEmit`: saída 0.
  - `npm run lint`: saída 0, 0 erros e 40 avisos (nenhum nos arquivos alterados).
  - `npm test`: saída 0, 715 arquivos e 5308 testes.
  - Integração (`src/server/whatsapp`, `src/server/inbox`, `src/app/api/inbox`, `src/app/api/whatsapp` e os `*.int.test.ts`
    tocados pelo PR e pelo merge): 69 arquivos e 544 testes verdes. Na primeira
    rodada só a regra 15 de `regras-inbox` falhou (acima); corrigida, o arquivo rodou de novo isolado: 21 testes verdes.
  - O `npm run test:int` completo fica com o integrador.
**Estado**: Implementado; base `main`; correções da R1 aplicadas; aguardando revisão.

## Fase 4F — E2E com motor simulado (18/10/2026)

- Branch `claude/fase4-f-e2e` (PR empilhado sobre `claude/fase4-e-remove-legados`), tarefa 27 do plano `04-fase-motor.md`:
  motor simulado (`src/test/motor-simulado.ts`) e teste de ponta a ponta (`src/server/whatsapp/motor/ponta-a-ponta.int.test.ts`).
  A tarefa 28 (roteiro com aparelho real) segue com o integrador.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0, 711 arquivos e 5232 testes.
- `npm run lint`: saída 0, 0 erros e 43 avisos (já existentes).
- Integração (perfil `integracao`): `vitest related` sobre os 2 arquivos do diff: 1 arquivo, 6 testes verdes. Sem falhas novas.
**Estado**: Implementado; aguardando revisão e merge (depois da 4E).

**Base trocada para `main` e correções da R1 do #222 (18/10/2026)**

- **Merge do `main`** (`d15e0969`, #221 com a 4E). Conflito só neste quadro (ficam os blocos de cada PR).
- **C3:** `MotorSimulado.reiniciar()` zera recebidos, enviadas, contador de ids, idempotência por `clientMessageId`,
  falha e mídia; o `beforeEach` do ponta a ponta chama `sim.reiniciar()`. O primeiro caso lê o `providerMessageId`/`mensagemIdMotor`
  de `sim.enviadas` em vez de fixar `3EB01`. Caso novo prova o reinício (o mesmo `clientMessageId` recebe id novo, sem cache).
- **C4:** `RESULTADO_INCERTO` no simulado agora significa "enviou, mas a confirmação se perdeu" (registra a mensagem e responde 502).
  Caso novo: intenção `FALHOU`/`resultado_incerto`, o despacho não reenvia sozinho, o reenvio com o mesmo `clientMessageId`
  devolve a mesma mensagem (uma só em `sim.enviadas`) e o eco repetido registra um único `EnvioIncertoConfirmadoPeloMotor`
  sem criar `MensagemWhatsApp`. A opção `falharEnvio` de `iniciarMotorSimulado` saiu (ninguém a usava; `reiniciar()` volta a `null`).
- **#221 C2:** `SETUP.md` (§Backup diário), `docs/31` §4 e o cabeçalho de `backup-producao.sh` citam o 503 isolado de
  "Motor WhatsApp inalcançável" esperado às 03:15, com o motor parado durante o tar. O §4 do doc 31 deixa de citar a Evolution.
- **`scripts/auditoria/cenarios.test.mjs`:** mock de `drivers/motor` no lugar de `drivers/meta-cloud`/`evolution`, número de teste
  `MOTOR`. O script já não rodava antes: importava `whatsapp/cron-comercial`, removido na E1 (`53c69b4b`). W03 saiu com o cron
  comercial; W04 fica no registro do reagendamento; W05 confere que um novo `despacharFila` não reabre a falha.
  Rodado (`vitest run -c scripts/auditoria/vitest.config.ts`, com banco descartável): 18 verdes, 10 falhas, 1 pulado. As falhas são
  deriva de API fora do WhatsApp (`registrarPagamento` exige campos novos, alçadas novas de retomada/país, A01/A06); a suíte é de
  auditoria e pode falhar por desenho. W01, W02, W05 e W07 passam com o motor mockado.
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros, 40 avisos. `npm test`: 715 arquivos, 5308 testes verdes.
- Integração (banco descartável): `ponta-a-ponta.int.test.ts` 8 testes verdes; `src/server/whatsapp/motor`: 14 arquivos, 112 testes verdes.
**Estado**: Implementado; base `main` (não empilhado); correções da R1 aplicadas; aguardando revisão.

## Fase 5, Task 1: trava de pré-requisitos (18/10/2026)

- Branch: `claude/fase5-a-fundacao` (main 6d6d33ee + 24af270d, SDK 0.131.0 exato). Teste: `src/test/pre-requisitos-fase5.test.ts` (5 testes verdes), `tsc` saída 0.
- Nomes reais do main diferentes do plano (trava usa os reais): `Tarefa.leadId` (plano: `oportunidadeId`), `Tag.ativo` (plano: `arquivadaEm`), `PrazoRespostaSetor{finalidade, minutos}` (plano: `ConfigSetorAtendimento{prazoPrimeiraRespostaMin}`).
- A conferir depois, quando as faixas integrarem: `NotaAtendimento`, `src/server/whatsapp/envio-inbox.ts`, `NumeroWhatsApp.perfilNome/privacidade/temporariasSegundos` e `drivers/motor.ts` (`atualizarPerfil`/`atualizarPrivacidade`/`definirTemporarias`, Fase 4D–4F), `ConfigSetorAtendimento`.

## Fase 5, bloco A — fundação da Aria, Tasks 2 a 5 (18/10/2026)

Branch `claude/fase5-a-fundacao` (main 6d6d33ee + 24af270d, `@anthropic-ai/sdk` 0.131.0 exato). Tasks 2 (migration `20261018010000_aria_base`, remoção do copiloto, rótulos, autoria `ATOR_ARIA`, ADR-F5-01), 3 (porta `ProvedorIA`, provedor simulado, escolha pela chave), 4 (provedor Anthropic: Sonnet 5.5/Haiku 5.5, saída estruturada, recusa, reserva) e 5 (custo por modelo, `ChamadaIA`, teto mensal). Só provedor simulado e cliente simulado nos testes; nenhuma chamada real à API.

- **Preço conferido na tabela pública** (`platform.claude.com/docs/en/about-claude/pricing`, 18/10/2026), USD por milhão de tokens:
  - Haiku 5.5 (prompts até 100 mil tokens): entrada 0,10, leitura de cache 0,01, saída 0,50. O 0,01 de `custo.ts` está **confirmado**. Acima de 100 mil tokens a tabela muda (0,50 / 0,05 / 2,50); a triagem não chega perto disso e `custo.ts` usa só a primeira faixa.
  - Sonnet 5.5: entrada 2 e saída 10 conferem. A **leitura de cache pública é 0,10** (0,05× a entrada), não 0,20 como nas Global Constraints do plano. `custo.ts` mantém 0,20 do plano, o que superestima o gasto com cache e faz o teto mensal disparar mais cedo (lado seguro). **Pendência para o dono:** trocar para 0,10 (ajusta também o teste `custo_sonnet`, que passaria de 9000 para 8000 micro-USD) ou manter.
  - Escrita de cache (1,25× a entrada em 5 min) não entra no cálculo: `custo.ts` soma só `input_tokens`, `cache_read_input_tokens` e `output_tokens`. Pendência registrada para quando houver medição com a API real (fase à parte).
- Documentação operacional: `SETUP.md`, `deploy/env.production.example`, `docker-compose.coolify.yml` e `docker-compose.prod.yml` deixam de citar o copiloto e `IA_MODELO` (nada em `src` lê a variável). A `ANTHROPIC_API_KEY` passa a ser descrita como chave da Aria: com ela, a Aria chama a rede e, em `ATIVA`, pode enviar mensagens; os modelos ficam em Configurações › CRM › IA.
- Evidências (HEAD da correção, sobre `c1b66b68`):
  - `node_modules/.bin/tsc --noEmit`: saída 0.
  - `npm test`: saída 0; 720 arquivos, 5301 testes verdes.
  - `eslint src/server/aria`: saída 0.
  - Integração, recorte (não é a suíte completa), no banco do perfil `dev-email` com a migration `aria_base` aplicada só nele: `npm run test:int -- src/server/aria src/server/comercial/config-comercial.int.test.ts src/server/whatsapp/acesso-atendimento.int.test.ts`: saída 0; 4 arquivos (`schema-base`, `uso`, `config-comercial`, `acesso-atendimento`), 31 testes verdes.
  - Por task: Task 2, `ator.test.ts` + `enums-rotulos.test.ts` 130 testes verdes e `vitest related` 431 arquivos/2817 testes verdes; Task 3, `src/server/aria/provedor` 6 testes; Task 4, 13 testes (inclui 401, 429, 500, timeout e conexão); Task 5, `custo.test.ts` 5 testes e `uso.int.test.ts` 8 testes. Todos com saída 0.
- **Pendente para o integrador antes do merge:** `npm run test:int` completo no `.erp-test-profile` (mais de 2 h; a regra do integrador desta faixa proíbe rodá-lo aqui). Comparar com as falhas preexistentes conhecidas (sensíveis à data e o flake de `portal-aluno/preferencia-fuso`) e registrar aqui código de saída e totais.
- **Estado**: implementado; aguarda a suíte de integração completa, a decisão do preço de cache do Sonnet 5.5 e o integrador. Não concluído.

### Fase 5A: fundação da Aria (verificação do bloco) — 2026-10-18

Branch `claude/fase5-a-fundacao` (Tasks 1 a 5, sobre main 6d6d33ee + 24af270d).
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 720 arquivos, 5301 testes verdes.
- `npm run lint`: saída 0; 0 erros, 43 avisos (iguais à linha de base).
- Integração (banco `dev-email`, migration `aria_base` aplicada só nele), recorte dos arquivos tocados e dos que importam `comercial/{acoes,consultas,schema}`: `src/server/aria`, `src/server/comercial`, `crm/{funil,pessoas,oportunidades}`, `acesso/politica`, `whatsapp/{inbox,acesso-atendimento}`, `secretaria/politica`: saída 0; 13 arquivos, 120 testes verdes.
- Nota: `vitest related` com `src/lib/labels.ts`/`evento.ts` alcança praticamente toda a suíte de integração (passou de 2 h e foi interrompido pelo limite de tempo); a suíte completa fica para o integrador.

**Merge do `main` (#218 a #222, Fases 4D, 4E e 4F) na Fase 5A (18/10/2026)**

- Merges de `d15e0969` (#221) e `95b5ff5f` (#222). Conflito só neste quadro (ficam os blocos de cada PR). O `main` não trouxe migrations
  novas desde `6d6d33ee`; `20261018010000_aria_base` continua a última e não colide. Nada da 5A citava Meta, Evolution ou drivers legados.
- Trava `src/test/pre-requisitos-fase5.test.ts` com a 4D ativa: `driverMotor` (`enviarTexto`/`enviarMidia`/`enviarConteudo`), ações do
  Inbox em `whatsapp/motor/acoes-mensagem.ts` (nome real; plano: `envio-inbox.ts`), inbound `processarMensagemRecebida`/`processarMensagemEnviada`
  e eco `CELULAR` (`inbound.ts`, `processar-grupo.ts`), mais a presença da trava de legados da 4E. Seguem fora do `main` e anotados na trava:
  `NotaAtendimento`, `NumeroWhatsApp.perfilNome/privacidade/temporariasSegundos` e `atualizarPerfil`/`atualizarPrivacidade`/`definirTemporarias`
  em `drivers/motor.ts` (a #222 entregou só o E2E com motor simulado).
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros, 40 avisos. `npm test`: 721 arquivos, 5342 testes verdes.
- Integração (banco descartável, `migrate deploy` com `aria_base`; `migrate diff` sem divergência nas tabelas da Aria): `src/server/aria`,
  `comercial`, `crm/{funil,pessoas,oportunidades}`, `acesso/politica`, `secretaria/politica`, `whatsapp/{inbox,acesso-atendimento,motor}`
  (inclui `ponta-a-ponta`), `src/server/inbox`, `despachante-{motor,comercial}`, `whatsapp/{acoes,acoes-numero,triagem-numero}`: saída 0;
  39 arquivos, 340 testes verdes. O `npm run test:int` completo segue com o integrador.

## Fase 5A, pendências da revisão do #224 (18/10/2026)

Branch `claude/pendencias-224` (sobre main `f1b4a41c`). Nenhuma chamada real à API; cliente Anthropic mockado nos testes.

- **C1, escrita de cache:** o provedor Anthropic passa a ler `usage.cache_creation_input_tokens` (ausente ou nulo vira 0) em
  `RespostaIA.tokensEscritaCache`; o simulado devolve 0. `custoMicroUsd` cobra a escrita a 1,25× a entrada (Sonnet 5.5: 2,50 USD/M;
  Haiku 5.5: 0,125 USD/M) e soma ao total; `registrarChamadaIA` repassa o campo. Sem coluna nova em `ChamadaIA`: o custo gravado já
  inclui a escrita; guardar a contagem separada fica para quando houver migration da Aria.
- **C3, modelo validado antes da chamada:** `modeloPermitido()` em `custo.ts`; o provedor Anthropic lança
  `ErroProvedorIA("MODELO_NAO_PERMITIDO")` antes de chamar o cliente quando o modelo da tarefa está fora de `MODELOS_PERMITIDOS`.
  Não existe schema de validação da `ConfigIA` (nenhuma tela ou action grava os modelos ainda); validar lá quando ela for criada.
- **C6:** comentários do copiloto removido ajustados em `globals.css`, `tailwind.config.ts`, `_shared/regras.ts` e
  `whatsapp/consultas-inbox.ts`.
- Leitura de cache do Sonnet 5.5 segue 0,20 (decisão pendente do dono).
- Evidências: `tsc --noEmit` saída 0; `npm run lint` saída 0 (0 erros, 40 avisos, linha de base); `npm test` saída 0, 721 arquivos,
  5349 testes verdes; integração `src/server/aria` (banco descartável `erp_genius_test_pend224`, `migrate deploy`): saída 0, 2 arquivos,
  13 testes verdes.
## Fase 5, bloco B — configuração da Aria, Tasks 6 a 11 (18/10/2026)

Branch `claude/fase5-b-config` (sobre `claude/fase5-a-fundacao`, main 6d6d33ee + 24af270d). Tasks 6 (schema versionado, predefinições e matriz), 7 (divisão Admin × Gerente Comercial), 8 (rascunho, publicação numerada com diff, descarte e restauração), 9 (estado DESLIGADA/SHADOW/ATIVA, pausa global e supervisão), 10 (base de conhecimento: fontes, trechos e extração de PDF pelo provedor simulado) e 11 (busca textual em português), mais o commit de correção da revisão final. Só provedor simulado; nenhuma chamada real à API.

- **Migration** `20261018020000_aria_conhecimento`: ID reservado pelo integrador para `<ID-F5-02> aria_conhecimento` (registro de 18/10 em `planejamento/execucao-ledger.md`: `020000 aria_conhecimento`). Aplicada só no banco do perfil `tester` (`prisma migrate status`: em dia, 455 migrations).
- **Correções da revisão final:** Gerente não encurta supervisão em vigor (DF5-13; teste `gerente_nao_encurta_supervisao`); ADR-F5-01 registra o descarte do rascunho como única remoção física e a regra de que o Gerente não salva nem publica rascunho que o Admin alterou fora da alçada dele; testes de `busca` com controle positivo (conferido por mutação: tirar o filtro de `status` ou de `arquivadaEm` derruba `ignora_fonte_arquivada_e_nao_pronta`).
- **Pendência para o dono (matriz):** a tabela de predefinições do plano (Task 6, Step 3) traz `CONDICAO_COMERCIAL` EQUILIBRADO `ooossooo` e AUTONOMO `oooeeooo` (etapas EXPERIMENTAL_*), mas o teste do próprio plano exige `EQUILIBRADO.PROPOSTA = SUGERE`. O código segue o teste: EQUILIBRADO `ooooosso` e AUTONOMO `oooooeeo` (PROPOSTA e AGUARDANDO_MATRICULA). Condição comercial em experimental não faz sentido de negócio, então a tabela do plano parece deslocada. Até o dono confirmar e o integrador corrigir a tabela do plano, a referência dos blocos C e D é `src/server/aria/matriz.ts`.
- Evidências (HEAD da correção):
  - `node_modules/.bin/tsc --noEmit`: saída 0 (linha de base: 0).
  - `npm test`: saída 0; 723 arquivos, 5328 testes verdes (linha de base do bloco A: 720/5301).
  - `npm run lint`: saída 0; 0 erros, 43 avisos (iguais à linha de base).
  - Integração, recorte (não é a suíte completa), banco do perfil `tester`: `npm run test:int -- src/server/aria`: saída 0; 6 arquivos, 45 testes verdes. `vitest related` sobre `aria/estado.ts` e `aria/conhecimento/busca.ts`: saída 0; 2 arquivos, 15 testes.
- **Pendente para o integrador antes do merge:** `npm run test:int` completo (mais de 2 h, proibido nesta faixa), comparando com as falhas preexistentes conhecidas (sensíveis à data e o flake de `portal-aluno/preferencia-fuso`); confirmação do dono sobre a matriz.
- **Estado**: implementado; aguarda a suíte completa, a confirmação da matriz e o integrador. Não concluído.

### Fase 5B: verificação final do bloco antes do PR — 2026-10-18

Branch `claude/fase5-b-config` (HEAD 9745f787), PR em rascunho empilhado sobre `claude/fase5-a-fundacao`.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 723 arquivos, 5328 testes verdes.
- `npm run lint`: saída 0; 0 erros, 43 avisos (iguais à linha de base).
- `vitest related --run -c vitest.integration.config.ts` sobre os 15 .ts/.tsx do diff contra `claude/fase5-a-fundacao`: saída 0; 4 arquivos, 33 testes verdes (recorte, não a suíte completa).

### Fase 5B: merge do `main` (f1b4a41c) — 2026-10-18

Branch `claude/fase5-b-config` (sobre d11663d3). Conflito só neste quadro (ficam os blocos de cada lado). Nada da Aria cita Meta, Evolution ou drivers legados; nenhuma migration nova colide com `20261018020000_aria_conhecimento`.
- `prisma validate`: válido. `node_modules/.bin/tsc --noEmit`: saída 0. `npm run lint`: saída 0; 0 erros, 40 avisos.
- `npm test`: saída 0; 724 arquivos, 5369 testes verdes.
- Integração em banco descartável novo (`migrate deploy` de todas as migrations: saída 0), recorte (não é a suíte completa): `src/server/aria`, `whatsapp`, `inbox`, `comunicacoes-agenda`, `comercial`, `crm/{funil,pessoas,oportunidades,mensagens-agendadas}`, `academico/visibilidade`, `acesso/politica`, `agenda/substituicao-avisos`, `secretaria/politica`: saída 0; 83 arquivos, 645 testes verdes.
- `prisma migrate diff` banco × schema: as divergências são antigas (nomes de índices/FKs e defaults de data em outras áreas), salvo `TrechoConhecimento.busca` (coluna gerada `tsvector` e índice GIN em SQL manual, que o Prisma não representa). **Pendência:** um `migrate dev` futuro tentará removê-los; revisar antes de gerar a próxima migration.
- **Pendente antes do merge:** `npm run test:int` completo pelo integrador; confirmação do dono sobre a matriz; PR #223 segue aberto no `main`.

### Fase 5B: correções da R1 do PR #226 — 2026-10-18

Branch `claude/fase5-b-config` (sobre c1f4dead; `git merge origin/main`: já em dia com f1b4a41c). TDD: cada teste novo falhou antes da correção.
- **B1** `criarFonteArquivo` só aceita upload "livre" do próprio autor (`uploadLivreDoAutor` em `uploads/autorizacao.ts`): sem vínculo a lead/aluno/cobrança/matrícula e sem referência em cobrança, informe de pagamento, documento ou mídia de WhatsApp; fora disso, "Arquivo não encontrado." antes de qualquer leitura do disco. `podeLerArquivo` não serve de porta aqui: nega todo upload sem referência (o caso legítimo); a regra adotada é mais restrita para qualquer arquivo com finalidade, inclusive para o Administrador.
- **B2** mock do provedor no teste parte de `provedorSimulado.gerar(p)` (compatível com o #227).
- **C2** `buscarTrechos` ignora fontes vencidas; criação recusa `validoAte` no passado ou inválido. **C3** `salvarRascunho`/`restaurarVersao` exigem o rascunho aberto (`id` + `atualizadoEm`, de `rascunhoAtual()` ou do último salvamento) e recusam se mudou. **C4** teste unitário (prisma dublê) liga `definirEstadoAria`/`publicarRascunho` às capacidades (conferido por mutação). **C5** `busca` declarada com `dbgenerated` + `@@index([busca], type: Gin)`; `prisma migrate diff` banco × schema perdeu as duas linhas de `TrechoConhecimento` e não ganhou nenhuma; trava em `conhecimento/migracao-busca.test.ts`. **C6** tetos: 200 mil caracteres por fonte, PDF de 10 MB, 400 trechos por fonte.
- **Atenção bloco C:** a assinatura de `salvarRascunho` (campo `rascunho`) e de `restaurarVersao(versaoId, rascunho)` mudou.
- `tsc --noEmit`: saída 0. `npm run lint`: saída 0; 0 erros, 40 avisos. `npm test`: saída 0; 726 arquivos, 5374 testes.
- Integração (recorte) em banco descartável com todas as migrations: `src/server/aria`, `src/server/uploads` e as suítes que usam `uploads/autorizacao` (`academico/visibilidade`, `matricula/condicoes-horas`, `inbox/regras-inbox`, `financeiro/recebimentos-destinados`): saída 0; 11 arquivos, 127 testes.

### Fase 5E: relatórios e metas (verificação do bloco) — 2026-10-18

Branch `claude/fase5-e-relatorios` (Tasks 30 a 36), empilhada sobre `claude/fase5-a-fundacao`.
- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 725 arquivos, 5336 testes verdes.
- `npm run lint`: saída 0; 0 erros, 43 avisos (iguais à linha de base).
- Integração, recorte: `vitest related --run -c vitest.integration.config.ts` sobre os arquivos .ts/.tsx do diff contra `claude/fase5-a-fundacao`: saída 0; 14 arquivos, 109 testes verdes.
- Pendente: suíte de integração completa a cargo do integrador no fim da fase.

**Merge do `main` (#224, Fase 5A, já com 4D a 4F) na Fase 5E (18/10/2026)**

- PR #228 passa a ter base `main` (não empilhado). Merge de `f1b4a41c`; conflito só neste quadro (ficam os dois blocos). `botoes-mapa.ts`,
  `botoes.test.ts` e `enums-rotulos.test.ts` mesclaram sozinhos. A 5E não cita Meta, Evolution, drivers legados nem o Inbox antigo.
  `20261018030000_metas_comerciais` segue a última migration, depois de `20261018010000_aria_base`; sem colisão.
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros, 40 avisos. `npm test`: saída 0; 726 arquivos, 5377 testes verdes.
- Integração (banco descartável, `migrate deploy` completo; `migrate diff` só com a deriva preexistente de defaults de timestamp, nada em
  `MetaComercial`): `src/app/api/relatorios`, `home/consultas`, `metas`, `relatorios`, `aria`, `src/server/inbox`, `whatsapp/motor`: saída 0;
  31 arquivos, 252 testes verdes. O `npm run test:int` completo segue com o integrador.

**Correções da R1 do PR #228 (18/10/2026)**

- B1: a meta EXPERIMENTAIS_REALIZADAS passa a contar a primeira `ExperimentalRealizada` (check-in do professor) por oportunidade no mês
  da escola, aceitando também `EtapaAlterada` para EXPERIMENTAL_REALIZADA; respeita escopo e dono. Nas abas de Relatórios só o funil conta
  experimentais, e já usava os dois eventos; Atividades e Equipe não contam experimentais.
- C1: a aba Metas da Configuração inclui o Gerente Comercial (única aba dele; o link "Definir metas" fica na aba Equipe de Relatórios);
  a meta do próprio gerente aparece com o nome dele.
- C2: `/api/relatorios/exportar` recusa com 403 (mensagem "só para a gestão comercial") as abas Equipe e Aria, os filtros de responsável e
  de autor e o detalhe por pessoa para quem não é admin nem gerente comercial.
- C3 (DF5-11): no relatório o vendedor é só ele. Diferente de `escopoComercialAtual`, as coberturas de carteira não entram nos relatórios
  nem nas metas na v1 (documentado em `relatorios/escopo.ts`, com teste).
- C4: o nome da etapa no Funil diz que abre as oportunidades que estão nela agora (título, rótulo acessível e nota da tabela).
- C5: Equipe mostra "Meta dos meses do período" e explica que soma os meses inteiros tocados; VALOR_GANHO usa `valorPrevisto`.
- B2: resolvido no merge do `main` com o #226 (ver bloco seguinte).
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros, 40 avisos (linha de base). `npm test`: saída 0; 727 arquivos, 5380 testes verdes.
- Integração (banco descartável): `metas`, `relatorios`, `src/app/api/relatorios`, `home/consultas`: saída 0; 8 arquivos, 68 testes verdes.

**Merge do `main` (#226, Fase 5B) na Fase 5E (18/10/2026)**

- Merge de `86261292`. Conflitos: `prisma/schema.prisma` (ficam `MetricaMeta`/`MetaComercial` da 5E e `TipoFonteConhecimento`,
  `StatusFonteConhecimento`, `FonteConhecimento`, `TrechoConhecimento` da 5B, com `busca` em `dbgenerated` e `@@index([busca], type: Gin)`)
  e este quadro (ficam os dois blocos).
- `prisma validate`: válido. Banco limpo com `migrate deploy`: `20261018010000_aria_base`, `20261018020000_aria_conhecimento` e
  `20261018030000_metas_comerciais` aplicam em sequência; `migrate diff` banco × schema sem nada em `MetaComercial`, `FonteConhecimento`
  ou `TrechoConhecimento` (só a deriva preexistente de outras tabelas).
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros, 40 avisos. `npm test`: saída 0; 732 arquivos, 5412 testes verdes.
- Integração (banco descartável): `metas`, `relatorios`, `src/app/api/relatorios`, `home/consultas`, `src/server/aria`, `src/server/uploads`:
  saída 0; 15 arquivos, 133 testes verdes. O `npm run test:int` completo segue com o integrador.

## Fase 5, bloco C — turno da Aria, Tasks 12 a 25 (18/10/2026)

Branch `claude/fase5-c-turno` (empilhada sobre `claude/fase5-b-config`; main 6d6d33ee + 24af270d). Tasks 12 a 25 (contexto, decisão, guardas, gatilhos, executores, handoff, expiração, orquestrador e despacho), todas com revisão limpa. Só provedor e motor simulados; nenhuma chamada real à API da Anthropic nem ao WhatsApp.

- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 729 arquivos, 5383 testes verdes (linha de base ~714/~5270).
- `npm run lint`: saída 0; 0 erros, 44 avisos (linha de base 43; os avisos são do tipo `no-unused-vars`).
- Integração, banco do perfil `tester` (`tester34`), recorte: `vitest related` sobre os 41 .ts do diff contra `claude/fase5-b-config` alcança praticamente toda a suíte (passou de 38 min e foi interrompido). Em seu lugar, `vitest run -c vitest.integration.config.ts` nos 12 `*.int.test.ts` do diff mais `src/server/aria`, `whatsapp/{despachante,inbound,atendimentos}` e `crm/mensagens-agendadas`: saída 0; 23 arquivos, 208 testes verdes.
- Pendente para o integrador: `npm run test:int` completo, comparando com as falhas preexistentes conhecidas.

### Fase 5C: merge do `main` (até 9b01b45f) e R1 do PR #229 — 2026-10-18

Branch `claude/fase5-c-turno`, agora com base `main` (não mais empilhada). Merges de 86261292 (#226), c9f14e91 (#228) e 9b01b45f (#227, #230); conflitos só no quadro e em `IntencaoParaValidar` (`despachante.ts`, ficam `acaoAgenteIAId` e `conteudo`).
- **C1** migration da 5C renomeada para `20261018060000_aria_triagem_shadow_sem_atendimento` (030000 é de `metas_comerciais`; 040000/050000 reservados à 5F) e, na R2, para `20261018080000_` (o #232 trouxe `20261018070000_chamada_ia_escrita_cache`). Banco limpo aplica todas em sequência.
- **B2** dublês de provedor da 5C partem de `provedorSimulado.gerar(p)` (tsc 0 com `tokensEscritaCache` obrigatório). `triagem.int.test.ts` usa `driver: "MOTOR"`. Contexto do turno: teste de fonte vencida fora dos trechos.
- **B3** `pausarAriaNoAtendimento` cancela as intenções PENDENTE/ADIADA de origem IA (`aria_pausada`), inclusive já pausada; handoff preserva a própria mensagem. Despachante (origem IA) cancela com `aria_pausada` se o atendimento está pausado (fora a pausa do handoff) ou se houve fala/fila humana depois (conferido por mutação).
- **C2** rajada: âncora com inbound mais novo vira `IGNORADO:FALA_SUPERADA` (antes e depois da chamada ao provedor). **C3** turnos EM_ANDAMENTO há mais de 10 min viram handoff `TURNO_INTERROMPIDO` no reprocesso. **C4** sai o parâmetro `origem` de `agendarMensagem`. **C5** `devolverParaAria` exige escopo de envio. **C7** sem `_p`.
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros, 40 avisos. `npm test`: saída 0; 738 arquivos, 5492 testes.
- Integração em banco descartável novo: `src/server/aria`, `src/server/whatsapp`, `crm/mensagens-agendadas`, `metas`: saída 0; 74 arquivos, 629 testes. `npm run test:int` completo segue com o integrador.

### Fase 5C: R2 do PR #229 e merge do `main` (cb9ca307) — 2026-10-18

- Merges de fd094fc0 (#231) e cb9ca307 (#232), sem conflitos.
- **B4** a rajada (C2) e o reprocesso só contam como "fala mais nova" inbound de tipo que a Aria responde (`TIPOS_COM_TEXTO`, exportado de `guardas.ts`); texto + figurinha/áudio/localização responde uma vez ao texto; texto + texto segue respondendo só ao último. O reprocesso também não cria turno para inbound sem texto.
- **C1** migration da 5C em `20261018080000_aria_triagem_shadow_sem_atendimento`; banco limpo aplica 010000, 020000, 030000, 070000 e 080000 em sequência.
- **C9 (pendência entre 5C e 5F):** a triagem da Aria abre atendimento por `abrirAtendimentoDoSetor` (`aria/triagem.ts`), fora de `atendimentoDoInbound`, onde o #233 (5F) põe `atribuirAutomaticamente`. TODO no código; **quem entrar por último no `main` (5C ou 5F) aplica o rodízio nesse caminho também.** **Resolvido no #233** (merge do `main` 1a99b63b): ver a entrada "Fase 5F (#233): merge do #229".
- `tsc --noEmit`: saída 0. `npm run lint`: 0 erros, 40 avisos. `npm test`: saída 0; 740 arquivos, 5509 testes.
- Integração em banco descartável novo: `src/server/aria`, `src/server/whatsapp`, `crm/mensagens-agendadas`: saída 0; 73 arquivos, 621 testes.

## Fase 5: preços oficiais da IA em `custo.ts` (18/10/2026)

Branch `claude/precos-ia-oficiais` (sobre main `1a99b63b`). Nenhuma chamada real à API.

- **Decisão do dono:** usar o preço oficial da Anthropic (`platform.claude.com/docs/en/about-claude/pricing`, consultada em
  18/10/2026). A Global Constraint do plano 05 que dizia "cache 0,20" para o Sonnet 5.5 fica **superada**; fecha a pendência
  registrada nos blocos A e nas pendências do #224.
- **Sonnet 5.5:** leitura de cache de 0,20 para **0,10** USD/M (0,05× a entrada, nota 2 da página). Entrada 2, escrita 2,50 (5 min) /
  4 (1 h) e saída 10 conferem. Sem faixa de prompt longo.
- **Haiku 5.5:** leitura de cache 0,01 e escritas 0,125 / 0,20 (fatores 1,25× e 2× de `fatorEscritaCache`) conferem com a faixa de
  até 100.000 tokens. **Faixa nova** acima de 100.000 tokens de prompt: entrada 0,50, escrita 0,625 / 1, leitura 0,05, saída 2,50.
  O prompt é o total de tokens de entrada da requisição (input + leitura de cache + escrita de cache); acima do limite a chamada inteira
  paga a faixa alta. 100.000 fica na faixa baixa; 100.001 vai para a alta. A saída não conta para a faixa.
- `custo.ts` ganha `precoPorMilhao(modelo, tokensPrompt)` e `LIMITE_PROMPT_HAIKU_FAIXA_BAIXA`; o comentário de preços cita a fonte e a
  data. Testes ajustados: `custo_sonnet` 9000 → 8000, escrita somada 14000 → 13000 (`custo.test.ts`, `uso.test.ts`, `uso.int.test.ts`
  `registra_ok_com_custo` e `registra_custo_com_escrita_de_cache`). `inference_geo` US-only (1,1×) não é usado.
- TDD: os testes novos e ajustados falharam antes da mudança (13 vermelhos) e passaram depois.
- `tsc --noEmit`: saída 0. `npm run lint`: saída 0; 0 erros, 40 avisos (linha de base). `npm test`: saída 0; 740 arquivos, 5522 testes.
- Integração em banco descartável novo (`migrate deploy`): `npm run test:int -- src/server/aria`: saída 0; 18 arquivos, 190 testes.

### Fase 5F, Task 38: Configurações › Números (setores, triagem, perfil, privacidade, temporárias) — 2026-10-18

- `src/server/crm-config/{numeros,perfil-numero}.ts` (só ADMINISTRADOR, motor chamado antes de gravar, `Evento` `NumeroSetoresAlterados`, `NumeroTriagemAlterada`, `NumeroPerfilAlterado`, `NumeroPrivacidadeAlterada`, `NumeroTemporariasAlteradas` com `{de, para}`), painel `numeros/PerfilNumeroPainel.tsx`.
- Cliente do motor em `src/server/whatsapp/motor/numero.ts` (`atualizarPerfil`, `atualizarPrivacidade`, `definirTemporarias`, injetável). O contrato /v1 do motor TEM os endpoints (`profile.update`, `profile.picture`, `privacy.update` incl. `defaultDisappearing`), então não há pendência no repositório do motor, exceto: a foto aceita no máximo 128 KB decodificados no motor (o ERP aceita até 2 MB pelo brief; acima de 128 KB o motor recusa e nada é salvo) e "adicionar a grupos" não tem a opção "ninguém" no WhatsApp.
- As colunas `perfilNome/perfilRecado/perfilFotoUploadId/privacidade/temporariasSegundos` já vieram na migration `20261018040000_crm_configuracoes` (Task 37); nenhuma migration nova.
- Temporárias = padrão para conversas novas (`defaultDisappearing`); conversas já abertas não mudam.

### Fase 5F, Task 39: Distribuição e SLA por setor — 2026-10-18

- `src/server/crm-config/distribuicao.ts` (`escolherResponsavel` pura, `salvarDistribuicaoSetor`, `atribuirAutomaticamente` com `SELECT … FOR UPDATE` na linha do setor), `sla.ts` (`salvarSlaSetor`), `acoes-distribuicao.ts` (fronteira Server Action da tela) e tela `configuracao/crm/distribuicao` (`SetorPainel.tsx`). Eventos no agregado `ConfigSetorAtendimento`: `DistribuicaoAlterada`, `SlaAlterado`, `AtendimentoAtribuido {motivo}`.
- Dados em `PrazoRespostaSetor` (colunas da migration `crm_configuracoes`); nenhuma migration nova. Linha criada ao salvar com prazo 60 min quando não existia.
- Gancho: `atendimentoDoInbound` (`whatsapp/atendimentos.ts`) chama `atribuirAutomaticamente` no 1º inbound de atendimento sem responsável (MANUAL, sem participantes ativos ou setor sem linha = fila). Carteira = `Oportunidade.vendedorDonoId` do lead (só COMERCIAL) e vale antes da regra; carteira não move `ultimoAtribuidoId`.
- Papéis: Admin todos os setores; Gerente Comercial só COMERCIAL; Gerente Pedagógico só PEDAGOGICO (a página da seção continua só Admin/Gerente Comercial). Participante precisa ser ativo e ter o setor pelo papel (`setoresDoUsuario`).

### Fase 5F, Task 40: Tags e campos personalizados — 2026-10-18

- `src/server/crm-config/tags-campos.ts` (`salvarTag`, `arquivarTag`, `salvarCampo`, `arquivarCampo`), `acoes-tags-campos.ts` (fronteira Server Action) e tela `configuracao/crm/tags-campos` (`TagsCamposPainel.tsx`). Eventos `TagSalva`/`TagArquivada` (agregado `Tag`) e `CampoSalvo`/`CampoArquivado` (agregado `CampoPersonalizado`), todos com `{de, para}`.
- Adaptação ao schema real: o tipo "LISTA" do brief é `SELECAO`; a cor é o enum `CorTag` (não existe hex no modelo); arquivar tag = `ativo=false`, arquivar campo = `arquivadoEm`. Nome único ignora caixa e acento (comparação em código, por alvo nos campos). Trocar tipo/alvo com valores preenchidos é bloqueado. Arquivar campo exige digitar o nome e não apaga valores. Papéis: Admin e Gerente Comercial.
- Nenhuma migration nova.

### Fase 5F, Tasks 41 e 42 e fechamento do bloco — 2026-10-18

- Task 41: respostas rápidas sobre `TemplateWhatsApp` (atalho, setor, uso pela Aria). Task 42: provedor de IA, modelos por tarefa, orçamento e triagem (só Admin), com provedor simulado; nenhuma chamada real à API da Anthropic. Correções da revisão final no commit `09c4cb68`.
- Branch `claude/fase5-f-config-crm`, empilhada sobre `claude/fase5-a-fundacao` (Tasks 37 a 42).
- Verificação em `/home/claude/wt/fase5f`: `tsc --noEmit` saída 0; `npm run lint` 0 erros e 40 avisos antigos; `npm test` 726 arquivos, 5365 testes verdes; integração relacionada (`vitest related -c vitest.integration.config.ts` sobre os 61 arquivos .ts/.tsx do diff): `vitest related` ficou inviável (o diff toca `trilha.ts` e consultas compartilhadas, que arrastam centenas de arquivos; interrompido por mim após 6 arquivos sem falha); rodados direto os 8 `*.int.test.ts` do bloco (`src/server/crm-config/*` e `whatsapp/{acoes-numero,financeiro-matricula,roteamento}`): 8 arquivos, 72 testes verdes. A suíte de integração completa segue com o integrador.

### Fase 5F (#233): merge do `main` e revisão R1 — 2026-10-18

Branch `claude/fase5-f-config-crm`, agora com base `main` (não mais empilhada na 5A). Merges de `main` em `fd094fc0` (5B #226, 5E #228, #223, #225, #227, #230, #231) e `cb9ca307` (#232).
- **Conflitos:** este quadro (os dois lados); `crm/metas/page.tsx` (fica a página real da 5E, progresso + `definirMeta`, agora seção de Configurações › CRM dentro do `crm/layout.tsx`; guard único `exigirSessaoPagina(ADMINISTRADOR, GERENTE_COMERCIAL)`, igual a `secoes.ts`); `inbox/ConversaAberta.tsx` (estado do encaminhar do main `{acao, m, atendimentoId, numeroId}` + respostas rápidas); `botoes-mapa.ts` (metas + seções da 5F); `casca-crm-removida.test.ts` (Gerente Comercial só vê a aba CRM).
- **Sem conflito textual, ajustados:** `configuracao/_componentes/tabs.ts` perde a aba "Metas" da 5E (Metas é seção do CRM, como DF5-10/Task 37: "Configurações › CRM › Metas"; o Gerente Comercial chega por CRM › Metas e pelo link "Definir metas" da aba Equipe dos Relatórios, que segue em `/configuracao/crm/metas`); `src/lib/trilha.ts` tinha `/configuracao/crm/metas` duplicada (TS1117), fica "Metas comerciais"; `crm-config/ia.ts` valida os modelos com `modeloPermitido` (#227).
- **Migrations em sequência num banco limpo** (`migrate deploy` em banco descartável): 010000 aria_base, 020000 aria_conhecimento (5B), 030000 metas_comerciais (5E), 040000 crm_configuracoes e 050000 resposta_rapida_titulo (5F), 070000 chamada_ia_escrita_cache (#232). `migrate diff` contra o schema: só o drift antigo de nomes/defaults de tabelas das fases 1 a 4, nada das 5B/5E/5F.
- **R1:** C2 — o plano 05 (Task 39) não define o efeito de `alertarResponsavel`, `alertarGerente` e `contarSoNoHorario`: a tela marca "em breve" e fica a **pendência** de ligar prazo (`prazoRespostaEm` respeitando o horário) e alertas. Mesma coisa para `ariaPodeUsar` / `respostasParaAria`: **pendência de ligação** quando o turno da Aria (5C, #229) entrar. C3 — a privacidade gravada pode ser parcial; o painel completa com o padrão (`privacidade-inicial.ts`). C4 — `crm-config/numeros.ts` (`definirSetoresDoNumero`, `definirResponsavelTriagem`, sem chamador) removido; fica só `whatsapp/acoes-numero.salvarSetoresNumero`, a que a tela usa, e os testes de `numeros.int.test.ts` passaram a usá-la (ela recusa triagem que perdeu o papel em vez de zerar; a tela já manda null nesse caso). C5 — `atribuirAutomaticamente` ganhou testes unitários com tx mockada; a abertura por setor virou `abrirAtendimentoDoSetor` em `whatsapp/atendimentos.ts` (mesma assinatura da 5C) e aplica a distribuição por padrão, então a triagem da Aria (5C) entra no rodízio ao chamar essa função; o inbound passa `{ atribuir: false }` e mantém a decisão em `atendimentoDoInbound` (fromMe e chamada não atribuem). Ao entrar a 5C, o conflito em `atendimentos.ts` resolve-se mantendo esta versão. C6 — respostas rápidas do compositor viram lista simples de botões (sem `listbox`/`option`).
- Evidências (banco descartável `erp_genius_test_fix233`, `migrate deploy`): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros e 40 avisos (linha de base); `npm test` 741 arquivos, 5487 testes verdes; integração `crm-config/*`, `whatsapp/{acoes-numero,financeiro-matricula,roteamento}`, `aria/*`, `metas`, `relatorios/atendimento-aria`, `api/relatorios/exportar`: 17 arquivos, 165 testes verdes; mais os 32 `*.int.test.ts` que importam `whatsapp/atendimentos` ou `whatsapp/inbound` (por causa de `abrirAtendimentoDoSetor`): 32 arquivos, 265 testes verdes. A suíte completa segue com o integrador.

### Fase 5F (#233): merge do #229 (5C) e pendências C7, C9, C10 — 2026-10-18

Merge do `main` em `1a99b63b` (#229). Conflitos: este quadro (os dois lados) e `whatsapp/atendimentos.ts`, onde fica a versão do #233 de `abrirAtendimentoDoSetor` (`opcoes.atribuir`, `abrirSemAtribuir`), que é o superconjunto da 5C.
- **C9:** a triagem da Aria (`aria/triagem.ts`) chama `abrirAtendimentoDoSetor` com 3 argumentos e recebe o rodízio por padrão; TODO removido. Teste `atendimento_aberto_pela_triagem_recebe_responsavel_pelo_rodizio`.
- **C7 (R2):** novo `whatsapp/savepoint.ts` (`comSavepoint`). A atribuição dentro de `abrirAtendimentoDoSetor` roda num SAVEPOINT: se falhar (erro de banco no `FOR UPDATE`, por exemplo), volta ao savepoint, o atendimento fica na fila do setor sem responsável e a transação do chamador segue utilizável. Na triagem, a abertura inteira também roda num SAVEPOINT (o `try/catch` que engolia o erro com a transação abortada saiu); falha na abertura devolve a mensagem à triagem humana. Teste `falha_de_banco_na_atribuicao_nao_quebra_a_transacao_e_o_lead_fica_na_fila_do_setor` (com `SELECT 1/0` dentro da transação; antes da correção dava `25P02`).
- **C10 (R3 do #229):** em `aria/turno/contexto.ts`, `ultimaFala` é o último inbound com `texto.trim()` não vazio; áudio, figurinha ou imagem sem legenda depois do texto não apagam a busca nas FONTES. Teste `ultima_fala_ignora_inbound_sem_texto`.
- Migrations num banco limpo, em sequência: 010000, 020000, 030000, 040000, 050000, 070000, 080000 (`aria_triagem_shadow_sem_atendimento`).
- Evidências (banco descartável, `migrate deploy`): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros e 40 avisos (linha de base); `npm test` 747 arquivos, 5542 testes verdes; integração `src/server/{aria,whatsapp,crm-config}`: 77 arquivos, 659 testes verdes. A suíte completa segue com o integrador.

## Fase 5, bloco D — tela da Aria, playground e Aria no Inbox, Tasks 26 a 29 (18/10/2026)

Branch `claude/fase5-d-tela` (empilhada sobre `claude/fase5-c-turno`; main 6d6d33ee + 24af270d). Tasks 26 (menu e consultas de visão geral e histórico), 27 (tela com abas, matriz por papel e publicação com diff), 28 (playground sem efeito) e 29 (estado da Aria, devolver e sugestões no painel do Inbox), mais o commit de correção da revisão. Só provedor e motor simulados.

- `node_modules/.bin/tsc --noEmit`: saída 0.
- `npm test`: saída 0; 733 arquivos, 5414 testes verdes (linha de base ~714/~5270).
- `npm run lint`: saída 0; 0 erros, 44 avisos (linha de base 43).
- Integração, banco do perfil `tester`, recorte: `vitest related` sobre os 61 .ts/.tsx do diff contra `claude/fase5-c-turno` alcança praticamente toda a suíte (passou de 18 min e foi interrompido por mim). Em seu lugar, `vitest run -c vitest.integration.config.ts` em `src/server/aria`, `inbox/paineis.int.test.ts`, `whatsapp/consultas-inbox.aria.int.test.ts`, `whatsapp/inbound-triagem-aria.int.test.ts` e `whatsapp/despachante`: saída 0; 27 arquivos, 254 testes verdes.
- Pendente para o integrador: `npm run test:int` completo, comparando com as falhas preexistentes conhecidas.

### Fase 5D (#234): base `main`, merges de #229, #233 e #235, R1 (B1, C1) e N1 da R2 do #226 — 2026-10-18

Branch `claude/fase5-d-tela`, agora com base `main` (não mais empilhada na 5C). Merges de 1a99b63b (#229), 04145a58 (#233) e 8cbf1672 (#235).
- **B1 (conflitos):** quadro, `botoes.test`, `enums-rotulos.test` (sai `CAMPO_MIDIA`, cujo driver o main removeu), `Sidebar`, `nav` (Relatórios e Agente de IA), `paineis.ts` (`podeEnviar` do main + `aria` da 5D), `consultas-inbox.ts`, `triagem.int.test` (mock de atribuição do #233 + testes da 5D), mantidos os dois lados. `pausa.ts`, `despachante.ts` e `despacho-ia.int.test` ficam com a versão final da 5C: o cancelamento antigo da 5D (`cancelarFalasPendentesDaAria`, `aria_pausada_no_atendimento`) sai; o caso "agendada antes do handoff não sai" foi mantido, com motivo `aria_pausada`. `orquestrador.ts` fica com o main mais dois acréscimos que o main não cobre (testes falham sem eles): âncora sem texto termina `IGNORADO:SEM_TEXTO`, e a transação relê a pausa antes das ações de CRM (sem isso, turno só com ações durante a tomada pelo humano termina `FALHOU`).
- **N1 da R2 do #226:** `publicarRascunho({ nota?, rascunho })` e `descartarRascunho(rascunho)` recebem o `RascunhoAberto` e recusam com a mensagem de "rascunho alterado por outra pessoa" (`rascunhoConferido`, o mesmo de `gravarRascunho`). A tela recebe `rascunho.atualizadoEm` (ISO) de `carregarTelaAria` e envia `{ id, atualizadoEm }` em Salvar, Publicar e Descartar; a recusa aparece no `FeedbackAcao` (Salvar) ou no diálogo de confirmação.
- **C1:** `AriaDoAtendimento.podeDevolver` = Aria pausada e `podeDevolverParaAria` (escopo de envio, regra única também usada por `devolverParaAria`); o `PainelAria` só mostra "Devolver para Aria" com ela.
- Dublês de provedor da 5D partem de `provedorSimulado.gerar(p)`; testes da triagem usam `driver: "MOTOR"`.
- Evidências (banco descartável `erp_genius_test_fix234`, `migrate deploy`): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros, 40 avisos; `npm test` saída 0, 752 arquivos, 5592 testes; integração em `src/server/aria`, `inbox/paineis`, `whatsapp/consultas-inbox`, `whatsapp/inbound` e `whatsapp/despachante`: saída 0, 28 arquivos, 288 testes.
- **Pendente (fora do escopo deste ajuste):** os módulos de `src/server/aria` chamados pelos componentes cliente da tela e do Inbox (`versoes`, `estado`, `historico`, `pausa`, `playground`, `conhecimento/fontes`) não têm `"use server"` nem um `acoes.ts` de fachada, como no resto do app. O CI não roda `next build`, então isso não aparece em tsc/lint/testes. **Resolvido em 2026-10-18 (abaixo).**
- **Fronteira "use server" (2026-10-18):** `next build` falhava em `/(app)/aria/page` (`node:fs/promises` no chunk do navegador, via componentes cliente importando `versoes`/`estado`/`historico`/`pausa`/`playground`/`conhecimento/fontes`). Novo `src/server/aria/acoes.ts` ("use server", só delega, padrão de `crm-config/acoes-distribuicao.ts`); `BarraPublicar`, `Salvar`, `Cabecalho`, `Confianca`, `Conhecimento`, `Historico`, `Playground` e `inbox/PainelAria` importam dele (tipos seguem via `import type`). `config-schema`/`matriz` conferidos: puros (zod + tipos do Prisma). `next build` saída 1 antes, saída 0 depois.
- **B2 da R2 (2026-10-18):** foto/vídeo/documento sem legenda logo depois de uma pergunta deixava a Aria muda (texto `FALA_SUPERADA`, mídia `SEM_TEXTO`, reprocesso pulava o texto). `falaSuperada` e a contagem posterior do reprocesso agora só contam inbound de `TIPOS_COM_TEXTO` com corpo não vazio após trim (`haFalaQueSupera`). TDD: laço `texto_mais_*` ganha imagem/vídeo/documento sem legenda (nulo, "" e espaços) e imagem com legenda (supera), mais `foto_sem_legenda_durante_a_chamada_nao_supera_o_turno_em_curso` e `reprocesso_nao_pula_ancora_seguida_de_foto_sem_legenda`; 5 vermelhos antes, verdes depois. **C3:** descrição do PR cita os trechos da 5C antiga que entram por ele (`FRASE_ENCAMINHAMENTO`, revalidação de pausa/valores em `AGENDAR_MENSAGEM`, comentário de `CONDICAO_COMERCIAL`).
- Evidências (banco descartável próprio `erp_genius_test_fix234b`, `migrate deploy`, sem chave da Anthropic e sem motor real): `next build` saída 0; `tsc --noEmit` saída 0, 0 erros; `npm run lint` 0 erros, 40 avisos; `npm test` saída 0, 752 arquivos, 5592 testes; integração em `src/server/aria` saída 0, 20 arquivos, 236 testes (inclui `turno`: 8 arquivos, 93 testes). Pendente para o integrador: `npm run test:int` completo.

### Fase 5G, Task 43: trava de auditoria das configurações + C9/C10 do #233 — 2026-10-18

Branch `claude/fase5-g-auditoria`, base `main` 04145a58 + merge de 8cbf1672 (#235, sem conflito). Não depende da 5D (#234).
- **Task 43:** `src/server/crm-config/auditoria.test.ts`, trava estática pela AST do TypeScript (mesmo estilo de `src/test/guard-pagina.ts`) sobre todos os `.ts` de `src/server/crm-config/` (lidos da pasta), `aria/{versoes,estado,historico,pausa}.ts`, `aria/conhecimento/fontes.ts` e `metas/metas.ts`. Testes: `toda_action_exportada_grava_evento` (toda função exportada que pode gravar chama `registrarEvento` no tx de um `$transaction`, ou no tx recebido como parâmetro `TransactionClient`/`Tx`, seguindo chamadas e re-exportações entre arquivos de `src/`; `registrarEvento(prisma, …)` não conta), `somente_leitura_nao_altera_nada` (cada leitura dispensada é conferida: sem mutação do Prisma, `$executeRaw*` nem `$transaction`, seguindo as chamadas; `upsert` com `update: {}` é a criação do padrão), `nenhum_delete_fisico` (`<model>.delete/deleteMany` de model do schema e `DELETE FROM`/`TRUNCATE` em SQL cru) e `cobre_os_modulos_da_task_43`, mais autotestes dos helpers com código em memória (isca `registrarEventoFalso`, evento fora da transação, helper chamado com `prisma`, `export default`/`export { }` falham alto). Conferida também por mutação: tirar o `registrarEvento` de `arquivarTag` aponta `arquivarTag` e `arquivarTagDaTela`; um `configIA.update` em `painelIA` aponta a leitura.
- **Nomes reais × plano:** os módulos de configuração são `crm-config/{distribuicao,sla,perfil-numero,respostas-rapidas,tags-campos,ia}.ts` mais as fronteiras `acoes-{distribuicao,ia,respostas,tags-campos}.ts` (`numeros.ts` saiu no #233, C4). A lista `SOMENTE_LEITURA` do plano (`painelIA`, `listarRespostasRapidas`, `progressoMetas`, `versaoPublicada`, `situacaoAria`) confere com o código e ganhou as leituras reais que o plano não listava: `rascunhoAtual`, `respostasRapidasDoCompositor`, `respostasParaAria`, `listarPerfisNumero`, `uploadIdPorUrl`, `exigirEdicaoDoSetor`.
- **Apontado pela trava e corrigido:** `aria/pausa.ts#cancelarIntencoesDaAria` era exportada e mutava sem `Evento`; só `pausarAriaNoAtendimento` a usa, então virou função interna.
- **Exceções de delete físico** (ancoradas em arquivo + chamada, e a trava falha se uma delas deixar de existir): `aria/versoes.ts:versaoAgenteIA.delete` (descarte de rascunho, previsto no plano) e `aria/historico.ts:pessoaTag.delete` (desfazer a TAG da Aria remove o vínculo pessoa↔tag, como `crm/tags.ts` já faz; `Evento TagRemovida`). O plano listava só a primeira.
- **C9 (#233):** `atendimentoDoInbound` (`whatsapp/atendimentos.ts`) chama `atribuirAutomaticamente` dentro de `comSavepoint(tx, "atribuir_setor", …)`; erro de banco no rodízio volta ao savepoint, a transação do inbound segue e o atendimento fica na fila do setor sem responsável. Teste `falha_de_banco_na_atribuicao_do_inbound_nao_derruba_a_transacao_e_fica_na_fila_do_setor` (`crm-config/distribuicao.int.test.ts`, `SELECT 1/0` dentro da transação; antes da correção o inbound falhava).
- **C10 (#233):** o `aoFalhar` da abertura na triagem (`aria/triagem.ts`) registra `console.error` com `mensagemId`, `setor` e `resumoDoErro(e)`. `resumoDoErro` (novo, `whatsapp/savepoint.ts`) guarda só nome e códigos (Prisma e Postgres), sem a mensagem do erro, que pode citar valores da consulta; também usado no log do C9. Testes `falha_na_abertura_do_setor_vai_para_o_log_sem_dados_pessoais_e_volta_a_triagem_humana` (`aria/triagem.int.test.ts`) e `savepoint.test.ts`.
- Nenhuma migration nova.
- Evidências (banco descartável `erp_genius_test_t43`, `migrate deploy`): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros e 40 avisos (linha de base); `npm test` 749 arquivos, 5566 testes verdes (depois do merge do #235); integração `src/server/{crm-config,aria,metas,whatsapp}` (módulos auditados, `whatsapp/atendimentos` e `aria/triagem`): 78 arquivos, 676 testes verdes antes do merge; depois do merge, `aria/uso`, `aria/triagem` e `crm-config/distribuicao`: 3 arquivos, 38 testes verdes. A suíte completa segue com o integrador.
- **B1 (merge do main be19e1df, com o #234):** conflito só no quadro, mantidos os dois lados (5D antes da 5G). `podeDevolverParaAria` (`aria/pausa.ts`, leitura pura do escopo) entra em `SOMENTE_LEITURA`. A fronteira `src/server/aria/acoes.ts` ("use server" do #234) entra em `ARQUIVOS_FIXOS`, como as `acoes-*.ts` de crm-config; ela passou a usar imports nomeados (não `import * as`) para a trava seguir as chamadas aos módulos auditados. `testarAria` (playground) é a única ação que grava sem Evento, por desenho (só `ChamadaIA`, o registro de uso/custo): exceção ancorada em `EXCECOES_SEM_EVENTO` com a mutação permitida; a trava falha se a exceção sumir ou gravar outra coisa. Conferida por mutação: tirar o `registrarEvento` de `estado.pausarAria` aponta também `acoes.ts#pausarAria`; um `configIA.upsert` com update no playground aponta `acoes.ts#testarAria`.
- Decisão do dono (18/10): a meta EXPERIMENTAIS_REALIZADAS conta uma por oportunidade, no mês da primeira realização, e o crédito vai para o vendedor dono atual, igual ao funil (#228). Nenhuma mudança de código.
- Evidências do B1 (banco descartável próprio `erp_genius_test_fix236`, `migrate deploy`, apagado ao fim): trava 9 testes verdes; `tsc --noEmit` saída 0, 0 erros; `npm run lint` 0 erros, 40 avisos; `npm test` saída 0, 754 arquivos, 5603 testes; integração `src/server/{aria,crm-config}` saída 0, 25 arquivos, 282 testes. Depois do merge de 9a46b345 (#237, só CI e quadro): trava verde e `npm run build` com a env do CI saída 0.

### CI: job `build` (next build) — 2026-10-18

- Novo job `build` no `.github/workflows/ci.yml`: `npm ci`, `prisma generate` e `npm run build`, com o `DATABASE_URL` de teste do workflow e `NODE_OPTIONS=--max-old-space-size=5120`. Motivo: no #234, componentes "use client" importando módulos de servidor com Prisma quebravam o build de produção sem que typecheck, lint ou testes acusassem.
- Evidência: `npm run build` no `origin/main` (8cbf1672) com a env mínima do CI: saída 0, ~3 min.

### Q176: régua de cobrança e D+30 no fuso da escola (B1 da triagem, lote "servidor sem migration" da #164) — 2026-10-19

Branch `claude/regua-fuso-escola`, base `main` 78edb2a0. É só a Q176. O resto da #62 continua pendente na #164.
- **Problema:** a régua contava os dias pelo relógio do servidor (`inicioDoDia` com `getFullYear/getMonth/getDate`). Em produção o processo roda em UTC, então o dia virava às 21h de Brasília, e lembrete, cobrança e D+30 podiam sair um dia antes.
- **`cobrancas/regua.ts`:** `diferencaEmDias` foi substituída por `diasCivisDesde(agora, gravada, fuso)`. "Hoje" passa a ser a data civil da escola (`dataCivilInstitucional`). O dia de uma data gravada sai de `diaCivilGravado`, o maior entre o dia UTC e o dia da escola, e isso cobre as três convenções de gravação: meio-dia da escola, meia-noite da escola e meia-noite UTC do legado. `proximaAcao(entrada, hoje, fuso, politica?)` usa essa conta para os dias de atraso e para a promessa vigente. `promessaNoPassado(ate, agora, fuso)` é a regra da promessa.
- **D+30:** `cobrancaGeraRestricaoAutomatica(…, agora, fuso)`. `reavaliarAcessoAutomaticoMatriculaTx` (`cobrancas/acesso-aulas.ts`) e `autorizarReproducaoGravacaoTx` (`gravacoes/autorizacao.ts`) leem o fuso com `fusoDaEscola(tx)`.
- **Fila e ficha:** `montarReguaPorCobranca` lê `fusoDaEscola()`, ou recebe o fuso de quem chama. Isso vale para a fila, a ficha financeira, o cron da régua e o enfileiramento manual. Na fila, "Recebido hoje" passa a começar à meia-noite da escola (`instanteDaGrade`).
- **Promessa de pagamento:** em `registrarPromessaPagamento`, "não pode ser no passado" compara com o dia da escola, e a data passa a ser gravada ao meio-dia da escola. Data civil inexistente, como 31/02, agora é recusada; antes rolava para o mês seguinte.
- `fusoDaEscola(cliente?)` (`relatorios/atendimento.ts`) aceita a transação de quem já está dentro de uma. O padrão continua America/Sao_Paulo.
- **Testes (TDD, com relógio fixo):** às 23h30 de Brasília (02h30 UTC do dia seguinte), o D0 e o D-3 ainda não saem, a promessa ainda vale e o D+30 ainda não restringe; à 00h30 saem. Há também casos para as três convenções de gravação e para "recebido hoje" com `vi.setSystemTime`. Os testes da régua deixaram de usar datas no relógio local do processo. Antes da correção, em UTC, os casos das 23h30 do D+30 falhavam e reproduziam o bug.
- **Fora do escopo** (mesmo tipo de problema, mas fora do fluxo da régua): o teto de mensagens por contato/dia do despachante (`whatsapp/despachante.ts`, `inicioDia`) e o corte mensal do fechamento automático de comissões (`financeiro/cron-financeiro.ts`) ainda usam o relógio do servidor.
- Nenhuma migration nova.
- Evidências (banco descartável `erp_genius_test_regua`, `migrate deploy`, apagado ao fim): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros, 40 avisos; `npm test` saída 0 com TZ=UTC e com TZ=America/Sao_Paulo, 754 arquivos e 5612 testes em cada; `npm run build` saída 0; integração em `cobrancas`, `gravacoes/{autorizacao,troca-fonte-reposicao}`, `whatsapp/{ciclo-cobranca,acoes,cron,motor/ponta-a-ponta}`, `retomada/fluxo` e `financeiro/gateway` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0, 11 arquivos, 120 testes.

### Aria usa as respostas rápidas liberadas — 2026-10-19

Branch `claude/aria-respostas-rapidas`, base `main` 78edb2a0. Decisão do dono: ligar `TemplateWhatsApp.ariaPodeUsar` ao turno da Aria (pendência do C2 da R1 do #233).
- **Contexto:** `montarContextoTurno` preenche `respostasRapidas` por `respostasParaAria(setor, db)` (`crm-config/respostas-rapidas.ts`, mesmo nome, segue em `SOMENTE_LEITURA`): `tipo RESPOSTA_RAPIDA`, `arquivadoEm null`, `ariaPodeUsar true`, setor = `AtendimentoWhatsApp.finalidade` ou geral (`setor null`), na tx do turno, ordem por atalho (desempate por id). Teto `LIMITE_RESPOSTAS_ARIA = 100`, o mesmo da FAQ (`config-schema`: até 100 itens de até 2000 caracteres; o corpo da resposta já é limitado a 2000).
- **Prompt:** o bloco "RESPOSTAS RAPIDAS LIBERADAS" diz que são textos aprovados, para usar como referência mantendo valores e condições. Variáveis como no compositor do Inbox (`aplicarVariaveisResposta`): `{nome}` vira o nome da oportunidade (no Comercial, o mesmo nome que o Inbox mostra) e `{responsavel}` vira o nome da Aria (quem responde). Variável sem valor (`{curso}`, ou `{nome}` sem oportunidade) fica, e o prompt manda reescrever a frase sem ela e nunca enviar chaves ao cliente. O corpo continua passando por `ocultarDadosPessoais`.
- **Sem ação nova:** a resposta rápida é só referência; o envio segue por `RESPONDER`/`AGENDAR_MENSAGEM` com as guardas atuais.
- **Guarda de valores:** antes, um preço citado numa resposta liberada (fora da tabela de preços do país) era barrado como `VALOR_NAO_AUTORIZADO`. Agora `permitidos` soma os valores monetários que as respostas liberadas do contexto citam (`valoresCitados`, mesmos padrões da guarda). Percentuais e parcelas citados nelas não entram: seguem só da política da Aria (faixas de desconto e `parcelasMax`), conforme `CATEGORIAS_DAS_RESPOSTAS = ["valores"]` em `turno/executor.ts` (decisão provisória do C1 da R1, mais segura; o dono ainda pode mudar acrescentando as categorias na constante). Vale na resposta, na sugestão aprovada (`efetivarRespostaSugerida`), no plano e na aplicação de `AGENDAR_MENSAGEM` (que relê as respostas na tx). Resposta não liberada, arquivada ou de outro setor não autoriza nada; desmarcar "Aria pode usar" derruba a autorização de sugestões ainda não aplicadas.
- **Tela:** `RespostasPainel` troca o aviso "em breve" por `AVISO_ARIA`, que explica o efeito e diz que hoje a Aria só atua no Comercial, então respostas de outros setores marcadas ainda não têm efeito; comentários de `RespostasPainel.tsx` e `contexto.ts` atualizados.
- **Playground:** `aria/playground.ts` lê as respostas liberadas do COMERCIAL e as gerais com `respostasParaAria("COMERCIAL")` (mesma função e mesmo teto do turno real), então prompt e guarda de valores não divergem do atendimento.
- **Para o dono decidir (C1):** hoje só preços das respostas liberadas passam. Motivo: a guarda compara só o número, sem contexto ("multa de 2%" liberaria "2% de desconto"), e o Gerente Comercial, que também salva respostas, passaria de `parcelasMax`. Para liberar percentuais/parcelas, basta incluí-los em `CATEGORIAS_DAS_RESPOSTAS`.
- **R1 (C1–C4, C6):** C1 como acima; C2 playground; C3 aviso; C4 unitário `turno/permitidos.test.ts` (preço de resposta liberada aceito; percentual e parcela só da resposta bloqueados; lista vazia), sob o `npm test`; C6 `origin/main` 7d3688ae (#239) trazido, quadro resolvido mantendo as duas seções. C5 (tamanho do prompt) só acompanhamento; C7 (draft) fica com o dono.
- Testes (TDD, vermelhos antes): `turno/contexto.test.ts` (unitários do prompt, novo), `turno/valores.test.ts` (`valoresCitados`), `turno/contexto.int.test.ts` (setor do atendimento, geral, outro setor, arquivada, `ariaPodeUsar` false, modelo de automação, tx, outra finalidade, teto), `turno/executor-resposta.int.test.ts` e `turno/executor-crm.int.test.ts` (valor liberado passa; não liberado e de outro setor bloqueiam; `AGENDAR_MENSAGEM` sugerida e aplicada), `turno/orquestrador.int.test.ts` (provedor simulado: bloco no `sistema` com a variável trocada, resposta com o valor sai como `RESPONDEU`), `configuracao/crm/avisos-em-breve.test.ts`. Na R1 (vermelhos antes): `turno/permitidos.test.ts` (novo), `playground.int.test.ts` (respostas do COMERCIAL e gerais no prompt e na guarda; outro setor e não liberada bloqueiam), `executor-resposta.int.test.ts` ("12x" e "2%" só da resposta bloqueiam) e `avisos-em-breve.test.ts` (só atua no Comercial).
- Evidências da R1 (head após o merge do `main` 7d3688ae; banco descartável `erp_genius_test_fix238`, `migrate deploy`, apagado ao fim): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0, 0 erros; `npm run lint` 0 erros, 40 avisos (linha de base); `npm test` saída 0, 756 arquivos, 5625 testes; integração `src/server/aria` e `src/server/crm-config` saída 0, 25 arquivos, 289 testes; `npm run build` saída 0 (NODE_OPTIONS=--max-old-space-size=5120, como no CI; a primeira tentativa com 6144 caiu em "Failed to type check" sem erro listado, com outros `tsc` da máquina ocupando memória, e o `tsc` isolado deu 0 erros). Nenhuma migration nova.
- Evidências da primeira entrega (banco descartável próprio `erp_genius_test_ariarr`, `migrate deploy`, apagado ao fim; sem chave da Anthropic e sem motor real): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0, 0 erros; `npm run lint` 0 erros, 40 avisos (linha de base); `npm test` saída 0, 755 arquivos, 5612 testes; integração `src/server/aria` e `src/server/crm-config` saída 0, 25 arquivos, 288 testes (inclui a trava `crm-config/auditoria.test.ts`); `npm run build` saída 0. Nenhuma migration nova. A suíte de integração completa fica com o integrador.

### #166, 1º lote: idempotência em `criarMatricula` e na Nova oportunidade — 2026-10-19

Branch `claude/idempotencia-matricula-lead`, base `main` 78edb2a0. Item B2 da triagem. A #166 continua aberta.
- **Servidor:** novo `src/server/_shared/idempotencia.ts` (`hashEntrada`, `repeticaoIdempotente`). Dentro da transação, ele pega `pg_advisory_xact_lock` sobre `tipo + autor + chave` e procura o Evento de criação do autor com `payload.chaveIdempotencia`. Com a mesma entrada, devolve o resultado original; com outra entrada, devolve um `ErroRegra` mandando recarregar e conferir. A chave e o `entradaHash` ficam no payload do `MatriculaCriada` (que também passa a levar `aguardaPreco`) e do `LeadCriado`. **Nenhuma migration.** A chave (`ChaveIdempotenciaSchema`, em `_shared/validacao.ts`) é opcional em `MatriculaSchema` e no novo `CriarLeadSchema`; sem ela, o comportamento é o de antes.
- **Cliente:** `src/lib/chave-idempotencia.ts` (`useChaveIdempotencia`): a mesma chave até o sucesso, como em `AcertoContratualFormularios`. `MatriculaFormulario` e `funil/NovaOportunidade` passam a usar `idempotente: true` e a enviar a chave. `docs/12` atualizado.
- **Testes (TDD):** `matricula/criar-idempotencia.int.test.ts` (7) e `comercial/criar-lead-idempotencia.int.test.ts` (6). A mesma chave duas vezes gera 1 registro e 1 Evento e devolve o mesmo resultado, também com envio simultâneo, com `aguardaPreco` e no modo Empresa. A chave repetida com outra entrada é recusada sem gravar. Chaves diferentes ou de outro autor criam normalmente, e o envio sem chave também. Sem a trava consultiva, os testes simultâneos ficam vermelhos. Unitários: `lib/chave-idempotencia.test.ts` e os casos de reenvio após resultado incerto nas interações das duas telas. Os dois `.int` novos mockam `exigirSessao` (os papéis continuam lidos do banco): dois `import("@/lib/auth")` simultâneos escapam do `vi.mock`.
- **Próximo lote (risco):** `criarTarefa`; catálogo (`criarPreco`, depois idioma, nível, modalidade e produto); `registrarNotaDaFicha` e `mesclarContatosDaLista`; `salvarTemplateWhatsApp` (que tem `nome @unique`, então o reenvio não duplica). Restam 142 `idempotente: false` em `src`.
- Evidências (banco descartável `erp_genius_test_idem`, `migrate deploy`): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros, 40 avisos (linha de base); `npm test` saída 0, 755 arquivos, 5607 testes (inclui a trava `crm-config/auditoria.test.ts`); `npm run build` com a env do CI saída 0. Integração, toda com saída 0: `src/server/matricula` (46 arquivos e 2 pulados; 386 testes e 3 pulados), `src/server/comercial` (5 arquivos, 32 testes), `src/server/crm` (24 arquivos, 188 testes), `src/server/_shared` (1 arquivo, 4 testes) e `src/lib` (2 arquivos, 5 testes).

### Triagem B4, B7 e B9: alternadores com estado-alvo, dedup da importação de alunos e SSE com revalidação — 2026-10-19

Branch `claude/triagem-b4-b7-b9`, base `main` 7d3688ae, com merge de 8970be6e (#238 e #240; conflito só no quadro, mantidos os dois lados). Itens B4 (#175 C2), B7 (#180 C2) e B9 (#201 C6) da triagem de pendências.
- **B4, estado-alvo:** `alternarIdiomaAtivo`, `alternarPrecoAtivo` e `alternarUsuarioAtivo` viraram `definirIdiomaAtivo(id, ativo)`, `definirPrecoAtivo(id, ativo)` e `definirUsuarioAtivo(id, ativo)`, no padrão de `definirSituacaoEmpresa`. O servidor recebe o estado desejado; se o registro já está nele, não grava nada nem registra evento. O idioma trava a linha (`FOR UPDATE`), o preço trava os preços da combinação e o usuário segue com `bloquearUsuarios`. Reativar um preço que já está ativo não aposenta mais os irmãos. Os painéis (`IdiomasPainel`, `PrecosPainel`, `UsuariosPainel`) mandam `true` em ativar e `false` na confirmação, e o `ConfirmarAcao` dessas desativações passou a `idempotente`, porque agora repetir é seguro. `confirmacoes-mapa.ts`, a cópia em `confirmacoes.test.ts` e `docs/37` foram atualizados com os nomes novos.
- **B7, deduplicação da importação:** em `alunos/importacao-duplicidade.ts`, (1) o candidato por nascimento vem pelo dia civil (intervalo UTC), e não mais por `primeiroNome in … insensitive`, que diferenciava acento: "Jose" na planilha acha "José"; (2) a leitura não tem mais teto, segue em lotes de 2000 pelo id (cursor) até acabar (`LOTE_CANDIDATOS_DUPLICIDADE` substitui `TETO_CANDIDATOS_DUPLICIDADE`); (3) as chaves de nome + e-mail, telefone ou nascimento levam o país, como a de documento, e a consulta filtra pelos países da planilha.
- **B9, SSE do Inbox:** `api/inbox/eventos` fecha a conexão no prazo máximo de vida (`VIDA_MAX_MS`, 15 min) ou no vencimento do JWT com que abriu, o que vier antes, e relê o usuário a cada `REVALIDAR_MS` (60 s). Usuário desativado, papel do Inbox revogado, usuário só do portal ou falha ao reler fecham o stream (falha fechada). Quando o papel muda e o usuário continua no Inbox, o filtro de avisos passa a usar o usuário relido. O prazo do JWT chega pela sessão: o callback `session` expõe `expiraEm` (de `token.exp`, via `lib/prazo-sessao.ts`) e `exigirSessaoComPrazo` (`_shared/sessao.ts`) o devolve; `exigirSessao` continua igual para os demais chamadores. JWT já vencido na abertura → 401.
- **Cliente:** a reconexão continua sendo do `EventSource`. O servidor sugere `retry: 3000`; ao reabrir, a rota confere sessão e papel de novo, e 401/403 encerram de vez. Como avisos do intervalo sem conexão podem se perder, `assinarEventosInbox` (extraída de `useEventosInbox`) entrega um `resync` a cada reabertura depois da primeira, e a tela recarrega o que mostra.
- **Testes (TDD, vermelhos antes):** `catalogo/estado-alvo.int.test.ts` e `acesso/estado-alvo.int.test.ts` (dois usuários: um ativa e o outro confirma "ativar" com a tela velha, e o resultado não desfaz nem grava segundo evento; também desativar duas vezes, alvo não booleano e reativação real que ainda aposenta o irmão); `importacao-duplicidade.test.ts` e `.int.test.ts` (acento, lote cheio seguido de outro com o cadastro mais novo, país); `api/inbox/eventos/route.test.ts` (relógio falso: prazo de vida, desativação, papel revogado, falha ao reler, JWT vencendo antes do prazo); `sessao-prazo.test.ts`; `useEventosInbox.test.ts`.
- Nenhuma migration nova. A trava `crm-config/auditoria.test.ts` continua verde.
- Evidências (banco descartável `erp_genius_test_b479`, `migrate deploy`, apagado ao fim): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros, 40 avisos (linha de base); `npm test` saída 0, 756 arquivos, 5629 testes; `npm run build` saída 0; integração em `src/server/{catalogo,acesso,alunos,inbox,empresas}` e `whatsapp/participantes-aviso`: saída 0, 16 arquivos, 113 testes. Depois do merge de 8970be6e: `tsc --noEmit` saída 0; `npm run lint` 0 erros, 40 avisos; `npm test` saída 0, 759 arquivos, 5646 testes; a mesma integração saída 0, 16 arquivos, 113 testes.

### Q176 (continuação): teto diário do WhatsApp, fechamento de comissões e pendências da R1 do #239 — 2026-10-19

Branch `claude/fuso-limite-comissoes`, base `main` 7d3688ae (com o #239). Trata os dois pontos que o #239 deixou fora do escopo e os comentários não bloqueantes da R1 dele. Ref. #164.
- **Helper novo em `operacao/fuso.ts`:** `inicioDoDiaCivil(data, fuso)` devolve o primeiro instante válido do dia civil no fuso da escola. Normalmente é a meia-noite. Onde ela não existe, como America/Santiago em 06/09/2026 (início do horário de verão), é a 01h. `inicioDoDiaInstitucional(instante, fuso)` aplica o helper ao dia da escola em que o instante cai. Os dois não dependem do fuso do servidor.
- **Teto por contato/dia (`whatsapp/despachante.ts`, passo 7):** a contagem começa no início do dia da escola (`fusoDaEscola()`, lido uma vez por execução de `despacharFila`), e não mais à meia-noite do servidor. Mudança mínima: duas linhas de import, a leitura do fuso e a troca do `inicioDia`.
- **Fechamento automático de comissões (`financeiro/cron-financeiro.ts`):** a competência (`mes`) e o corte (`aprovadasAntesDe`) saem do mês civil da escola. Às 23h30 de Brasília do dia 31 ainda é o mês corrente.
- **R1 do #239, C1 (`cobrancas/consultas.ts`):** "Recebido hoje" usava `instanteDaGrade(…, "00:00", fuso)`, que dá erro quando 00:00 não existe. Passou a usar `inicioDoDiaInstitucional`. Há teste com America/Santiago em 06/09/2026.
- **R1 do #239, C2:** novo `cobrancas/promessa.test.ts`, com relógio fixo, para `registrarPromessaPagamento`. Cobre a gravação ao meio-dia da escola (15:00Z em Brasília), o aceite de "hoje" às 23h30 de Brasília, a recusa da véspera e a recusa de 2026-02-30. Só teste: o código já fazia isso.
- **Testes (TDD, relógio fixo):** às 23h30 de Brasília (02h30 UTC do dia seguinte), a saída automática do meio-dia ainda conta no teto, e a comissão aprovada no dia 31 ainda não entra no fechamento. À 00h30, a saída das 23h30 da véspera já não conta, e a aprovação das 23h30 do dia 31 entra. Antes da correção, os quatro casos falhavam com TZ=UTC e passavam com TZ=America/Sao_Paulo, o que reproduz o bug. O caso de Santiago falhava nos dois fusos, com "Horário 2026-09-06 00:00 em America/Santiago inexistente".
- **Fora do escopo, com o mesmo tipo de problema:** `relatorios/periodo.ts` (`meiaNoite`, usada por `periodoDoFiltro` e pelas metas) devolve 05/09 23h para o dia 06/09 em America/Santiago; `home/consultas.ts` (`hojeIntervalo`, `inicioDoMes`); `financeiro/consultas.ts` (`inicioDoMes`); `retomada/regras.ts` (`dataMinimaReprogramacao`, `validarDatasNaoRetroativas`); `_shared/regras.ts` (`vencimentoMensalidade`, `vencimentoPrimeiraMensalidade`). Também no despachante: a intenção suprimida pelo teto é adiada por 24h corridas, e não até o início do dia seguinte da escola.
- Nenhuma migration nova.
- Evidências (banco descartável `erp_genius_test_fuso2`, `migrate deploy`, apagado ao fim; perfil temporário desfeito antes do commit): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros, 40 avisos (nenhum nos arquivos tocados); `npm test` saída 0 com TZ=UTC e com TZ=America/Sao_Paulo, 755 arquivos e 5625 testes em cada; `npm run build` saída 0; integração de `whatsapp`, `financeiro` e `cobrancas` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0, 66 arquivos e 518 testes em cada.
- Após o merge do `main` 8970be6e (#238 e #240, que só têm o quadro em comum com esta branch): `tsc --noEmit` saída 0; `npm run lint` 0 erros, 40 avisos; `npm test` saída 0 com TZ=UTC e com TZ=America/Sao_Paulo, 758 arquivos e 5642 testes em cada; `npm run build` saída 0. A integração não foi repetida, porque o merge não tocou `whatsapp`, `financeiro`, `cobrancas` nem `operacao`.

### SLA: horário de atendimento por setor e alertas de prazo estourado — 2026-10-19

Branch `claude/sla-completo`, base `main` 78edb2a0 com merge de 7d3688ae (#239; conflito em `fusoDaEscola`, que o #239 já fez igual: ficou a versão do main). Resolve a pendência C2 da R1 do #233 (`alertarResponsavel`, `alertarGerente` e `contarSoNoHorario` só gravados) e entrega a parte de horário da P5 da Task 39. Plano: `docs/superpowers/plans/2026-10-19-sla-completo.md`. Migration `20261018090000_sla_horario_alertas` (só estrutura, sem `UPDATE` de dados).
- **Calendário e prazo:** `crm-config/horario-atendimento.ts` (`HorarioAtendimentoSchema`, `prazoVenceEm`, `dentroDoHorario`), puro, no fuso da escola. `PrazoRespostaSetor.horario` (JSON). `prazoRespostaEm` conta só no horário quando `contarSoNoHorario` está ligado e há horário válido; filtro "Prazo estourado", lista e relatórios herdam o prazo útil. Horário de verão: hora pulada avança, hora repetida usa a primeira (`agenda/grade.ts` expõe `candidatosDaGrade`).
- **Alerta:** `whatsapp/alertas-sla.ts#rodarAlertasSla` no tick do `/api/whatsapp/cron` (chave `alertasSla`): claim atômico de `AtendimentoWhatsApp.slaAlertadoEm`, uma `NotificacaoUsuario` `SLA_ESTOURADO` por destinatário e `SlaEstouradoAlertado` (agregado `AtendimentoWhatsApp`) na mesma transação. O UPDATE do claim emite `atendimento.atualizado` pelo trigger `notificar_inbox` (SSE do Inbox). Nada de WhatsApp nem e-mail.
- **Sistema de notificações (duas correções):** a unicidade de `NotificacaoUsuario` passa a ser `(tipo, refId, usuarioId, criadaEm)`, pois responsável e gerente na mesma transação têm o mesmo `now()`; `marcarNotificacaoLida` audita no agregado do item (`AtendimentoWhatsApp` para SLA, `Tarefa` para lembrete) em vez de `"Tarefa"` fixo. O sino abre `/inbox?c=<id>` para SLA e aparece também no cabeçalho do Inbox.
- **Tela:** Distribuição e SLA edita o horário (um intervalo por dia, fuso da escola na legenda), "Copiar de outro setor", textos de ajuda; o aviso "Em breve" do SLA saiu.
- **Decisões do dono (19/10), iguais às recomendações do plano:**
  - D1: horário por setor (`PrazoRespostaSetor.horario`), com "Copiar de outro setor".
  - D2: feriados ficam para depois; o cálculo aceita `feriados`, mas não há tela (a tela devolve os gravados como estão).
  - D3: um aviso por atendimento, sem repetir.
  - D4: o aviso vai ao responsável; avisar também o gerente é opção da tela, desligada por padrão. Gerente: `GERENTE_COMERCIAL` (Comercial), `GERENTE_PEDAGOGICO` (Pedagógico), Administrador (Financeiro e Secretaria). Só usuários ativos.
  - D5: atendimento sem responsável avisa o gerente do setor ou, se não houver, o Administrador; participantes do rodízio não recebem.
  - D6: se a Aria respondeu dentro do prazo (mensagem `SAIDA`/`IA` enviada até o vencimento), não há alerta; `primeiraRespostaEm` e o indicador de primeira resposta continuam só humanos.
  - D7: mudar horário ou prazo não recalcula atendimentos abertos (a tela avisa).
  - D8: janela de 24 h; estouros mais antigos não alertam, e o claim acontece mesmo com alertas desligados.
  - D9: "contar só no horário" sem horário cadastrado conta 24 h por dia (a tela avisa).
  - D10: sem toast; o aviso é o sino mais a atualização da lista pelo SSE.
  - D11: a tela tem um intervalo por dia; schema e cálculo aceitam vários (dia com vários intervalos gravados é preservado até ser editado).
- **Desvios do plano:** `EntradaSla.horario` é opcional (ausente preserva o gravado; `null` limpa), para não quebrar quem salva só prazo e alertas; o teste de envio da tela usa a função pura `entradaSalvarSetor` (o componente não é montado com DOM); conversa de grupo não abre atendimento (trigger), então o filtro `grupoId` do claim fica só como defesa e sem teste de banco; `TIPO_NOTIFICACAO_LABEL` ganhou "Prazo estourado".
- **Pendente (tarefas separadas):** tela de feriados; ligar `dentroDoHorario` em `metricasAtendimento.foraDoHorarioPct` (Relatórios) e no gatilho `foraHorario` da Aria; levar o sino ao layout global; aviso repetido e toast, se o dono pedir.
- Evidências (banco descartável próprio `erp_genius_test_sla`, `migrate deploy`, apagado ao fim; sem chamada externa): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` saída 0, 0 erros, 40 avisos (linha de base); `npm test` saída 0, 759 arquivos, 5646 testes; `npm run build` saída 0; integração em `src/server/{crm-config,whatsapp,inbox,crm,relatorios}` e `cobrancas/acesso-aulas` (que chama a rota do cron): saída 0, 97 arquivos, 771 testes. Pendente para o integrador: `npm run test:int` completo.
- **R1 (REQUEST CHANGES):**
  - B1 e C1: `origin/main` trazido duas vezes (8970be6e, com #238 e #240; depois a9a71b9d, com #242). `configuracao/crm/avisos-em-breve.test.ts` ficou com o teste da Aria do main (`AVISO_ARIA`, `uso_pela_aria_explica_o_efeito`), sem o teste e o import de `AVISO_SLA_EM_BREVE`. No quadro, as seções dos dois lados foram mantidas (o diff contra o main só tem linhas adicionadas).
  - C2: `prazoVenceEm` não lança mais quando o prazo não cabe em 400 dias do calendário (por exemplo, dias de atendimento todos em feriados). Faz `console.warn` e conta corrido, como o horário inválido. Testes unitários escritos antes (vermelhos com o `throw`).
  - C3: nova coluna `MensagemWhatsApp.enviadaEm` (migration `20261019090000_mensagem_enviada_em`, só estrutura, sem `UPDATE`, porque o trigger `notificar_inbox_mensagem` dispara em todo UPDATE). Ela é gravada no envio do despachante, no envio para grupo, no eco `fromMe` e na primeira confirmação de envio (ENVIADA, ENTREGUE ou LIDA) de mensagem que estava `NA_FILA`. O D6 compara `COALESCE(enviadaEm, criadoEm)` com o vencimento. As saídas anteriores à coluna já nasciam enviadas, então o `criadoEm` delas equivale. O `statusEm` não serve porque avança com ENTREGUE e LIDA: uma resposta enviada no prazo e lida depois passaria a gerar alerta. Testes de integração em `alertas-sla.int.test.ts` (vermelhos antes): criada na fila antes do prazo e enviada depois alerta; da fila direto para ENTREGUE depois do prazo alerta; enviada no prazo e lida depois não alerta. Também `motor/grupo-envio.int.test.ts` e `origem-celular.int.test.ts` conferem a coluna.
  - C4 (só registro): hoje, desmarcar todos os dias na tela grava `horario = null` e apaga os feriados gravados. Quando a tela de feriados entrar, desmarcar os dias não pode apagar os feriados: grave `{ intervalos: [], feriados }`, que já conta corrido.
  - C5: integração dos módulos tocados no head final, em 4 shards com bancos próprios (`erp_genius_test_fix241`, `…b`, `…c`, `…d`; `migrate deploy`; apagados ao fim), toda com saída 0: `src/server/whatsapp` (inclui `alertas-sla` e `cron`): 58 arquivos, 452 testes; `src/server/{crm,crm-config,inbox}` (inclui `crm-config/sla` e `crm/notificacoes`): 33 arquivos, 268 testes; `src/server/{relatorios,cobrancas,aria}` (`cobrancas/acesso-aulas` chama a rota do cron): 28 arquivos, 311 testes. Total: 119 arquivos, 1031 testes.
  - Evidências da R1 (head com o main a9a71b9d): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0, 0 erros; `npm run lint` saída 0, 0 erros, 40 avisos (linha de base); `npm test` saída 0, 764 arquivos, 5690 testes; `npm run build` saída 0.

### B5 e B6 da triagem: escopo na mesma transação (#207) e confirmações que faltavam (#175) — 2026-10-19

Branch `claude/triagem-b5-b6`, base `main` 7d3688ae, com merge de 8121ab13 (#238), 8970be6e (#240) e a9a71b9d (#242); conflito só no quadro (mantidas as duas seções, a do #242 antes desta).
- **B5 (#207, C4 da R1 e C2 da R2):** `escopoAtendimentos(usuario, { enviar, agora, db })` e `atendimentoVisivel(usuario, id, enviar, db)` aceitam a transação. O `db` vai para `escopoComercialAtual`, `donosDeLinhaVisiveis` e as alocações do professor, e para `destinatarioAtualDoAtendimento` no envio. `devolverParaFila`, `atribuirAtendimento` (com `exigirResponsavelEnxerga`), `transferirAtendimento`, `convidarParticipante`, `revogarParticipante` e `registrarNotaAtendimento` conferem o escopo na própria tx: não abrem outra conexão com o `FOR UPDATE` tomado. `podeDevolverParaAria` repassa o `db` que já recebia. `acesso/*` não tinha checagem de escopo dentro de transação; o escopo comercial (`_shared/escopo-comercial.ts`) já aceitava a tx e só não a recebia. Sem mudança no comportamento fora de transação (o `prisma` global continua padrão, com o memo por requisição).
- **Testes B5 (TDD):** `whatsapp/escopo-transacao.int.test.ts`: dentro de uma tx que nunca é commitada, a checagem com a tx enxerga o atendimento, a cobertura de carteira e o vínculo de equipe gravados nela; sem a tx, não. `whatsapp/acoes-atendimento-pool.int.test.ts`: com `connection_limit=1`, as seis ações acima concluem; antes da correção, todas caíam no `pool_timeout` (P2024).
- **B6 (#175), padrão do `ConfirmarAcao` (fatia B):**
  - **L2142**, `financeiro/permuta/PermutaOperacional.tsx`: a decisão da compensação (`DecidirCompensacao`) nasce vazia e obrigatória (antes vinha em "Aprovar e compensar"). O botão diz a ação. Aprovar abre a confirmação com o valor que sai de cada mensalidade e o aviso de que não é recebimento em dinheiro.
  - **L325**, `alunos/[id]/portal/painel.tsx`: "Aprovar e aplicar" a troca de e-mail abre a confirmação. Ela informa o e-mail anterior e o novo, que a senha deixa de valer e que as sessões e os links de acesso são revogados na hora.
  - **L1479**, `academico/recuperacoes/[realizacaoId]/Formularios.tsx`: "Oficializar esta versão" abre a confirmação, com a versão e a nota, e exige marcar "Conferi a nota e a evidência antes de oficializar.". `ConferirNota` recebe `versao` e `nota`.
  - Rejeitar continua direto nas três telas. Cada uma tem uma exceção ancorada em `confirmacoes-mapa.ts`, e a cópia literal está em `confirmacoes.test.ts`.
- **Travas tocadas:**
  - `portal-aluno/actions.ts` passou a chamar `identidade.*` pelo namespace, porque a trava não aceita alias do nome da ação no módulo.
  - `botoes-mapa.ts` ganhou o botão da decisão da permuta.
  - `PermutaOperacional.test.ts` não expande mais a decisão, que tem teste próprio.
- **Testes B6:** `PermutaOperacional.confirmacao.test.ts`, `painel.confirmacao.test.ts` e `Formularios.confirmacao.test.ts` verificam:
  - clicar não executa;
  - confirmar executa uma vez, com os argumentos certos;
  - voltar não executa;
  - o erro aparece dentro do diálogo;
  - rejeitar segue direto.
- **Fora:** L2019, o motivo na rejeição de desconto, aguarda decisão de produto.
- Nenhuma migration nova.
- Evidências no head final, com o merge do #242 (banco descartável `erp_genius_test_b56`, `migrate deploy`, apagado ao fim):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npm run lint`: 0 erros e 40 avisos, a linha de base.
  - `npm test`: saída 0, 762 arquivos e 5.661 testes.
  - `npm run build` (NODE_OPTIONS=--max-old-space-size=5120): saída 0. Uma tentativa anterior caiu no OOM do cgroup, com a máquina ocupada por outros agentes.
  - Integração `src/server/{whatsapp,inbox,acesso,financeiro/permuta}`: saída 0, 70 arquivos e 537 testes.

### #166, 2º lote: idempotência em tarefas, catálogo e nota de contato, e índice da busca — 2026-10-19

Branch `claude/idempotencia-lote2`, base `main` 8970be6e (#240), com o `main` 858d38e9 trazido (#242, #243, #241 e #244). A #166 continua aberta.
- **C1 da revisão do #240 (índice):** migration `20261019100000_evento_idempotencia_idx` (depois das do SLA, #241: `20261018090000_sla_horario_alertas` e `20261019090000_mensagem_enviada_em`) cria o índice de expressão parcial `Evento_idempotencia_idx` sobre `("tipo", "autorId", ("payload" ->> 'chaveIdempotencia')) WHERE "payload" ? 'chaveIdempotencia'`, em SQL manual. `repeticaoIdempotente` passa a buscar por `sqlBuscaIdempotente` (SQL cru com a mesma expressão e o mesmo predicado; antes era `findFirst` com filtro JSON, que o índice não atendia). O schema documenta o índice no `model Evento`, sem `@@index`: o Prisma 5.22 não representa expressão nem predicado, e o `prisma migrate diff` banco × schema sai idêntico ao de antes da migration (o índice não aparece, como os outros parciais). Trava: `_shared/idempotencia-indice.test.ts` (migration, consulta e schema). Novo `marcaIdempotencia(chave, entrada)`.
- **Servidor:** chave opcional e marca no payload do Evento de criação, na mesma transação: `criarTarefa` (`TarefaCriada` da `Tarefa`; o lembrete é a própria tarefa, então não sai aviso duplicado; `editarTarefa` continua sem chave), `criarIdioma`, `criarNivel`, `criarModalidade` (`CriarModalidadeSchema`; `editarModalidade` sem chave), `criarProduto` (a conferência de duplicado foi para dentro da transação, depois da repetição, então o reenvio devolve o produto em vez de "Já existe") e `criarPreco` (o reenvio não aposenta o preço que a própria tentativa criou), e `registrarNotaDaFicha`/`registrarNotaPessoa` (a nota é o `NotaInterna`; o hash cobre pessoa e texto). `docs/12` atualizado.
- **Cliente:** `useChaveIdempotencia` e `idempotente: true` em `PainelTarefa` (só na nova tarefa: `idempotente: !tarefa`), `IdiomasPainel` e `PrecosPainel`, `NiveisPainel`, `ProdutosPainel`, `ModalidadeFormulario` (só na nova; `ModalidadesPainel` passa `key` por formulário) e a nota da `FichaContato` (executor e feedback próprios).
- **C2 da revisão do #242:** em `IdiomasPainel` e `PrecosPainel`, o executor inteiro passa a `idempotente: true`: Ativar/Reativar chamam `definir*Ativo(id, true)` (estado-alvo), então a falha de rede manda reenviar em vez de conferir a página. Teste em `catalogo.confirmacao.test.ts` (o incerto mostra `MSG_RESULTADO_INCERTO` e o reenvio repete o mesmo alvo).
- **Fora:** `mesclarContatosDaLista` não é criação (o reenvio já falha com "Uma das pessoas já foi mesclada", sem efeito duplo); `salvarTemplateWhatsApp` tem `nome @unique`.
- **Testes (TDD, vermelhos antes):** integração `_shared/idempotencia-indice.int.test.ts` (o índice existe e é parcial; o `EXPLAIN` da busca usa o índice; a busca filtra tipo, agregado e autor), `crm/criar-tarefa-idempotencia.int.test.ts` (5), `catalogo/criar-idempotencia.int.test.ts` (5: os cinco cadastros) e `crm/nota-contato-idempotencia.int.test.ts` (4). Os casos: a mesma chave duas vezes gera 1 registro e 1 Evento e devolve o mesmo resultado; envio simultâneo gera 1; a mesma chave com outra entrada é recusada sem gravar; outra chave ou outro autor criam; sem chave, como antes. Mutação: sem a trava consultiva, os testes simultâneos de tarefa e catálogo ficam vermelhos (o da nota passou por tempo: a transação é curta). Interação: `tarefas/PainelTarefa.interacao.test.ts`, `configuracao/catalogo/catalogo.idempotencia.interacao.test.ts` e `contatos/FichaContato.nota.interacao.test.ts` (o reenvio após o incerto manda a mesma chave, o sucesso troca a chave, e a edição segue sem chave).
- **Restam:** `mesclarContatosDaLista` (se o dono quiser devolver o mesmo resultado no reenvio), `configuracao/crm/*`, `aria/_componentes/*`, `inbox/AcoesContato.tsx` e os demais 135 `idempotente: false` em `src` (o que ficou na `FichaContato` é das ações que não criam).
- Evidências (banco descartável `erp_genius_test_idem2`, recriado com `migrate deploy` depois das migrations do SLA, apagado ao fim): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros, 40 avisos (linha de base; nenhum nos arquivos tocados); `npm test` saída 0, 772 arquivos, 5732 testes (inclui a trava `crm-config/auditoria.test.ts`, 9 testes); `npm run build` com a env do CI saída 0 (head 9d2748df). `prisma migrate diff` banco × schema idêntico com e sem o índice (só a deriva antiga de nomes de índices e FKs). Integração no head 010b1eec (o #244 não toca nestes módulos), toda com saída 0: `src/server/_shared` (2 arquivos, 7 testes; sem o índice, os 2 testes dele ficam vermelhos), `src/server/catalogo` (3 arquivos, 15 testes), `src/server/crm` (28 arquivos, 208 testes), `src/server/comercial` (5 arquivos, 32 testes), `src/lib` (2 arquivos, 5 testes) e `src/server/matricula` (46 arquivos e 2 pulados; 386 testes e 3 pulados).

### Triagem B11, B14 e B15: datas civis na ficha da empresa, SHA no /api/health e loading faltantes — 2026-10-19

Branch `claude/triagem-b11-b14-b15`, base `main` 914dece1 (#245).
- **B14 (C52 da #170):** `empresas/[id]/FichaEmpresa.tsx` mostrava o vencimento da fatura B2B um dia antes em UTC−3 (`new Date(iso).toLocaleDateString`). Agora é `formatarDataCivil(f.vencimento.slice(0, 10))`, como no `TurmasPainel`. A entrada saiu de `CIVIS_COMO_INSTANTE_CONHECIDOS` (`datas-civis.test.ts`); resta o `InformesPagamento.tsx`. `TurmasPainel.tsx:196` e `movimentacoes/page.tsx:24` já usavam o helper; só os comentários "meia-noite UTC" foram corrigidos (C2 da #178: a turma é gravada ao meio-dia local pelo formulário; o `@db.Date` volta do Prisma à meia-noite UTC).
- **B14, docs:** notas de "situação no código" no cabeçalho dos docs 09, 27 e 32 (telas e cadências da casca antiga removidas na E1), cabeçalho da SPEC-ERP-005 (o `historico.test.ts` saiu na R1 da #221; a conferência da Evolution 2.3.7 deixou de se aplicar com a Fase 4E) e a linha do doc 27 no `00-indice.md`. O doc 08 é de decisões de produto e não afirma nada sobre o código: ficou como estava.
- **B11 (#165):** `/api/health` devolve `sha`. O valor vem do build-arg `GIT_SHA` do Dockerfile (estágio runner, depois das checagens do Prisma, para não invalidar o cache delas), que vira a variável de ambiente `GIT_SHA`. O `docker-compose.coolify.yml` repassa `${SOURCE_COMMIT:-}`; no Coolify, o `SOURCE_COMMIT` só traz o commit no build com "Include Source Commit in Build" ligado. Sem valor, ou com valor sem forma de SHA (7 a 40 hexadecimais), sai `"desconhecido"`. A rota continua sem `CRON_SECRET` (liveness; nunca foi protegida) e passou a `force-dynamic`.
- **B15:** `loading.tsx` em `matriculas/nova` (`EsqueletoCartoes`, com título) e em `configuracao/whatsapp` (`EsqueletoTabela`, sem título: o h1 e as abas vêm dos layouts), nas listas de `borda-rota-mapa.ts`, `borda-rota.test.ts` e `borda-rota.render.test.ts`. O `/portal` (C4 da #170) deixou de redirecionar calado para `/portal-aluno` (que pede outro login): agora explica que a área do aluno tem acesso próprio, leva a `/portal-aluno/entrar` e tem "Sair" da sessão da equipe. O `(portal)/layout.tsx`, que só redirecionava, saiu. O `/portal` não tem `loading.tsx`: é estático e não consulta nada. O `redirect("/portal")` de `sessao.ts` continua, com o comentário atualizado. `global-error.tsx` usa o `Botao`.
- **Testes (TDD, vermelhos antes):** `FichaEmpresa.confirmacao.test.ts` (TZ=America/Sao_Paulo: sai 10/10/2026), `api/health/route.test.ts` (SHA, ausente, valor inválido, SHA curto, sem autenticação), `deploy/dockerfile-prisma.test.ts` (ARG/ENV no runner depois do Prisma e o arg do compose), `(portal)/portal/page.test.ts`, `global-error.test.ts` e as travas de borda de rota.
- Evidências: `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `npm run lint` 0 erros e 40 avisos (linha de base); `npm test` saída 0, 774 arquivos e 5.749 testes; `npm run build` com a env do CI saída 0 (`/portal` estático, `/api/health` dinâmico). O SHA não foi conferido num deploy real do Coolify.

### Fuso da escola, parte 3: relatórios, tela inicial, financeiro, retomada e adiamento do WhatsApp (pontos do #243) — 2026-10-19

Branch `claude/fuso-parte3`, base `main` 1e721ca5, rebaseada sobre d54280b6 (#241), 858d38e9 (#244) e 914dece1 (#245); conflito só no quadro (mantidas as duas seções, a do #245 antes desta). Mesmo padrão do #239 e do #243 (Q176 · ref. #164): o dia e o mês são os civis da escola (`fusoDaEscola()`), nunca os do servidor, que roda em UTC. Cada ponto começou com um teste que falhava com TZ=UTC e com TZ=America/Sao_Paulo.
- **`operacao/fuso.ts`:** novos `inicioDoDiaSeguinteInstitucional` (fim exclusivo do "hoje" da escola) e `inicioDoMesInstitucional`, sobre `inicioDoDiaCivil`, com testes (virada de dia, mês e ano; America/Santiago em 06/09/2026).
- **1. `relatorios/periodo.ts` (`meiaNoite`):** usava o deslocamento do fuso em dois passos e, em America/Santiago em 06/09/2026 (dia sem meia-noite), devolvia 03:00Z, 23h do dia 05. Agora usa `inicioDoDiaCivil` (04:00Z, 01h local). Testes: "HOJE" e período personalizado começando e terminando nesse dia.
- **2. `home/consultas.ts`:** "leads de hoje" usava `setHours` do servidor; "matrículas do mês" e "receita do mês", o dia 1 do servidor; a competência da meta lia `new Date()`. Agora tudo sai do dia e do mês da escola, e `dadosHomeGerente` aceita `agora`. Teste de integração com relógio fixo: escola na Costa Rica, às 04:30Z de 01/11/2026 (22h30 de 31/10).
- **3. `financeiro/consultas.ts` (`kpisFinanceiro`):** "recebido no mês" e "novas matrículas" começavam no dia 1 do servidor. Agora começam no dia 1 da escola. `vencimento < agora` (atraso) compara instantes e ficou como estava. Teste unitário com relógio fixo (`consultas-kpis-fuso.test.ts`).
- **4a. `retomada/regras.ts`:** a data mínima da reprogramação e a recusa de datas retroativas usavam o dia do servidor. À noite na escola, o dia de hoje era recusado como passado. `dataMinimaReprogramacao(agora, fuso)`, `validarDatasNaoRetroativas(alvos, agora, fuso)` e `montarSnapshotRetomada(..., agora, fuso)` passam a receber o fuso da escola (ações e consulta usam `fusoDaEscola`). A suíte de integração da retomada grava a escola no fuso do processo, porque suas datas saem do relógio local.
- **4b. `_shared/regras.ts` (`vencimentoMensalidade`, `vencimentoPrimeiraMensalidade`): não é bug, sem mudança.** O único uso em produção (`matricula/acoes.ts`, cronograma na ativação) passa como referência o vencimento da 1ª mensalidade, um dia civil gravado ao meio-dia (servidor ou fuso da escola), nunca o relógio. A função faz aritmética de calendário sobre esse dia; o resultado (meia-noite do servidor) é lido como dia civil por `diaCivilGravado`. O `agora = new Date()` padrão só é usado em testes.
- **5. `whatsapp/despachante.ts`:** a mensagem barrada pelo teto por contato/dia era adiada por 24 horas corridas; agora volta no início do dia seguinte da escola (`inicioDoDiaSeguinteInstitucional`). Testes de integração: às 23h30 de Brasília volta às 03:00Z, e em America/Santiago, às 23h30 de 05/09/2026, volta às 04:00Z de 06/09 (01h local).
- **Encontrados e fora deste PR:**
  - `_shared/validacao.ts` (`paraDataLocal`) e `retomada/schema.ts` (`dataRetomada`): data digitada vira meio-dia do relógio do servidor, não da escola.
  - `matricula/acoes.ts` (1ª mensalidade em `new Date(ano, mes - 1, dia, 12)`) e `vencimentoMensalidade` gravam vencimento no relógio do servidor; quem compara `vencimento < agora` (atraso em `alunos/consultas`, `ajustes/acoes`, `retomada/acoes`) marca atraso às 21h da véspera em Brasília para vencimentos gravados à meia-noite UTC.
  - `home/consultas.ts` e outros: limites de SLA e check-in por duração (`Date.now()`), sem efeito de fuso.
- Nenhuma migration nova.
- Evidências no head com o main 858d38e9 (banco descartável `erp_genius_test_fuso3`, `migrate deploy`, apagado ao fim):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npm run lint`: 0 erros e 40 avisos, a linha de base.
  - `npm test` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0 nos dois, 769 arquivos e 5.727 testes.
  - `npm run build` (NODE_OPTIONS=--max-old-space-size=5120): saída 0.
  - Integração `src/server/{relatorios,home,financeiro,retomada,operacao}` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0 nos dois, 15 arquivos e 157 testes.
  - Integração `src/server/whatsapp` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0 nos dois, 60 arquivos e 465 testes.

### Pendências das revisões do #241 (N1, C5) e do #244 (C2), com a integração completa — 2026-10-19

Branch `claude/pendencias-241-244`, base `main` d54280b6, com merge de 858d38e9 (#244), 914dece1 (#245), 6a4165d8 (#246) e fef6d467 (#247).
- **#241 N1:** duas saídas que nascem `ENVIADA` não gravavam `MensagemWhatsApp.enviadaEm`. Agora gravam:
  - o encaminhamento pelo motor (`encaminharMensagemWhatsApp`, `motor/acoes-mensagem.ts`) grava `enviadaEm = statusEm`. Se o eco do celular chega antes, ele já grava `enviadaEm` e o `upsert` não mexe nisso;
  - o eco `fromMe` em grupo (`motor/processar-grupo.ts`) grava o `quando` do eco. A entrada em grupo continua com `enviadaEm` nulo.
  - Testes (vermelhos antes): `motor/acoes-mensagem.int.test.ts` e `motor/processar-grupo.int.test.ts`.
- **#244 C2:** `revisarFalhaEnvio` (`whatsapp/operacoes-atendimento.ts`) confere o escopo com `atendimentoVisivel(u, id, true, tx)`, dentro da própria transação. Teste novo em `whatsapp/acoes-atendimento-pool.int.test.ts` (`connection_limit=1`): revisar com reenvio conclui. Antes da correção, caía no `pool_timeout`.
- **#241 C5:** `npm run test:int` completo no head final (2b5b5b67, com todo o main até fef6d467), em 4 shards (`--shard=n/4`). Cada shard usou um banco próprio, `erp_genius_test_p241_1` a `_4`, recriado vazio, com `migrate deploy` do zero (463 migrações), e apagado ao fim. Perfil temporário em `scripts/test-profile.mjs`, desfeito antes do commit.
  - Saída 0 nos 4 shards: 309 arquivos e 2.652 testes, com 2.648 passando, 0 falhas e 4 pulados. Os pulados são as fixtures de homologação Q165, Q170 e Q249 (`*-ui-homologacao.int.test.ts`), que só rodam quando ligadas.
  - Por shard: 78 arquivos e 663 testes; 77 e 692 (3 pulados); 77 e 704 (1 pulado); 77 e 593.
  - Duas rodadas anteriores, em heads que ficaram para trás com a entrada do #245 e depois do #247, foram interrompidas sem nenhuma falha até o ponto em que pararam.
- Nenhuma migration nova.
- Evidências no head final:
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0. A primeira tentativa acusou `.next/types` velho, gerado antes do #246, que removeu `(portal)/layout.tsx`; depois do build, saída 0.
  - `npm run lint`: 0 erros e 40 avisos, a linha de base.
  - `npm test`: saída 0, 775 arquivos e 5.758 testes.
  - `npm run build`: saída 0.

### Triagem B12 e B17: lote de acessibilidade e travas do CI (ref. #170) — 2026-10-19

Branch `claude/triagem-b12-b17`, base `main` d2adffd4. Cada item foi conferido no `main` antes de mexer; todos ainda estavam abertos.
- **B12, acessibilidade:**
  - **#168 C49, wizard da matrícula:** o `Stepper` de `matriculas/nova/MatriculaFormulario.tsx` virou `<ol aria-label="Etapas da matrícula">`, com `aria-current="step"` no passo atual.
  - **#170 C30:** no passo 2, "Salvar matrícula" passou a `primario` (com `type="button"`); "← Voltar" segue `secundario`. Mapa de botões (`src/app/botoes-mapa.ts`) atualizado.
  - **#173 C6, `CampoMoeda`:** o aviso visível continua mudando a cada tecla, mas deixou de ser `role="alert"`. Fica ligado ao input por `aria-describedby`, e o anúncio sai de uma região `role="status"` sempre montada, preenchida no blur com o aviso que ficou e esvaziada ao voltar a digitar. Exceção ancorada em `feedback-separado.test.ts` para `setAnunciado(aviso)`.
  - **#170 C14, `Modal`:** no navegador, o modal vai para um portal em `document.body`. Enquanto ele está aberto, o resto da página fica `inert` (`isolarFundo`, em `lib/dialogo.ts`). O isolamento roda no mesmo efeito do foco: o fundo é isolado depois que o foco entra no diálogo e é solto antes de o foco voltar a quem abriu. No HTML do servidor e na hidratação, o modal sai no lugar, como antes. Os `ConfirmarAcao` que ficam dentro de um `<form>` (4 telas) só têm botões `type="button"`, então nada dependia do form de fora.
  - **#170 C45, `SubTabs`:** `ariaLabel` virou obrigatório, sem o padrão "Sub-navegação"; `/configuracao` ganhou "Seções da configuração". A trava confere que cada `<SubTabs>` do app tem rótulo literal próprio.
- **B17, CI e travas:**
  - **C46:** o lint do CI roda `npx eslint . --max-warnings 40`, o número atual. `src/test/ci-workflow.test.ts` trava o teto.
  - **#204 C1:** `src/server/crm/comissoes-painel.test.ts` confere, com Prisma mockado, o `where` de "Matriculadas sem comissão": `vendedorDonoId` no mesmo `AND` do escopo, sem datas, e nenhuma consulta para VENDEDOR.
  - **C38:** a âncora do cursor da fila de agenda de 2ª chamada é lida no universo da fila (decisão aprovada + disponibilização), não em qualquer proposta. Teste unitário lê o SQL montado; `filas-cursor.test.ts` segue verde.
  - **C51:** a trava de anúncio (`anuncios.test.ts`) só aceita `role="alert"`/`"status"`, `role={…}` que escolhe entre os dois, `aria-live` polite/assertive ou a nota estática declarada (`role="note"`). Antes passava qualquer `role=`, incluindo `data-role` e `aria-live="off"`. O detector de "resultado incerto" em variável ou template já está coberto pela trava AST de `feedback-separado.test.ts` (E3, E6).
  - **C55b:** `src/test/guard-pagina.ts` passa a ver papel guardado em membro (`obj.p = sessao.papeis`, `obj["p"] = …`) e lido por chave calculada (`sessao["pap" + "eis"]` resolvida; chave montada com valor desconhecido lê papel, por cautela).
- **Fora deste PR (pendências):**
  - `docker build` no CI (C47): pesado, fica para um job próprio.
  - `coolify-db-init.test.ts` (C47): obsoleto, o arquivo saiu com a Evolution (8ded2f5c).
  - C48 (travas de enum da R3 da #138, `ETAPA_LABEL`, fornecedor, badges `{label, cls}`) e C54 (limites declarados de 7 travas): são grandes e cada trava pede uma releitura própria. Ficam para PRs separadas.
  - C53: o manifesto já trava os usos do `EstadoVazio` arquivo a arquivo, então o piso solto é redundante. O caso B2 (exceção exata somada à edição do manifesto) exige redesenhar a trava de exceções.
- Nenhuma migration nova. A integração da fila de 2ª chamada (`segunda-chamada-agenda-inicial.int.test.ts`) não rodou aqui, porque o container não tem Docker.
- Evidências no head, sobre o `main` d2adffd4:
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com 0 erros e 40 avisos (a linha de base).
  - `npm test` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0 nos dois, com 779 arquivos e 5.801 testes.
  - `npm run build`: saída 0.

### Revisão da #249: modal solta o fundo antes do feedback (C1) e integração do cursor `antes` (C2) — 2026-10-19

Branch `claude/modal-feedback-inert`, base `main` 2a209fd4.
- **C1, `useDialogo` (`src/lib/dialogo.ts`):** o fundo isolado pelo `Modal` em portal passa a ser solto na limpeza de um efeito de layout, dentro do próprio commit. Antes, ele só era solto na limpeza do `useEffect`. Quando a tela fecha a confirmação e publica o resultado no mesmo lote (confirma → fecha → `FeedbackAcao`), o texto entrava na região `role="status"` com a página ainda `inert`, e o leitor de tela podia não anunciar. A ordem foi mantida: o foco entra e depois o fundo vira inert; o fundo é solto e depois o foco volta. O foco segue no efeito passivo, e a limpeza passiva só devolve o foco (`soltarUmaVez`: soltar de novo não faz nada). No servidor, o gancho cai no `useEffect`, sem o aviso de `useLayoutEffect` no HTML.
- **Teste do C1 (`src/components/Modal.feedback.test.ts`):** o react-dom/client roda de verdade sobre um DOM mínimo (`src/test/dom-minimo.ts`). O projeto não tem jsdom nem Testing Library, e agentes não mexem em package/lockfile. Um `MutationObserver` confere que, quando o texto entra na região status, ela já não está dentro de um ancestral `inert`, e que o foco volta a quem abriu. O relógio do Scheduler é avançado para ele ceder entre o commit e os efeitos passivos, o caso de um commit maior que a fatia de 5 ms. Sem a correção, o teste falha com `inert: true`. `dialogo.interacao.test.ts` foi ajustado às duas limpezas e ganhou o caso "a limpeza do commit solta o fundo sem mexer no foco".
- **C2, fila de 2ª chamada:** novo caso em `segunda-chamada-agenda-inicial.int.test.ts` para o cursor `antes`. São 22 fontes. A âncora do `antes` é agendada e sai da fila, e chega uma fonte nova à frente. A volta devolve a primeira página igual à original, e a volta seguinte chega ao começo, que é a primeira página lida do início (`lerPaginaDaFila`). Uma âncora fora do universo da fila (proposta sem decisão, mais antiga que as fontes) vale o mesmo que um id inexistente e não posiciona a leitura.
- Nenhuma migration nova.
- Evidências no head, sobre o `main` 2a209fd4:
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com 0 erros e 40 avisos.
  - `npm test` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0 nos dois, com 780 arquivos e 5.803 testes.
  - `npm run build`: saída 0.
  - Integração `segunda-chamada-agenda-inicial.int.test.ts` no Postgres da porta 54329, banco descartável `erp_genius_test_modal` (`migrate deploy`, perfil temporário fora do commit): saída 0, com 13 testes.

### Ordenação de nomes com acento: coluna gerada `nomeOrdenacao` (D1, #141) — 2026-10-19
Branch `claude/ordenacao-acento`. O Postgres de produção (`postgres:16-alpine`) roda com `datlocprovider=c`, sem ICU e sem `unaccent`, e ordena byte a byte: "Alice, Bruno, Zé, Álvaro". A decisão D1 foi uma coluna de ordenação normalizada, só nas listas de nome, criada por migration e sem mexer no cluster.
- **Migration `20261019110000_nome_ordenacao`:** cria `nomeOrdenacao TEXT NOT NULL GENERATED ALWAYS AS (…) STORED` em `Aluno` (`primeiroNome || ' ' || sobrenome`), `Pessoa` e `Empresa` (`nome`), com índice `(nomeOrdenacao, id)`. Por ser coluna gerada, o `ADD COLUMN` já preenche as linhas existentes, e o banco recalcula o valor a cada INSERT/UPDATE, inclusive em SQL cru. Nenhum ponto da aplicação grava a coluna; se tentar, o banco recusa.
- **Expressão:** `btrim(regexp_replace(translate(x, ORIGEM, DESTINO), '[[:space:]]+', ' ', 'g'))`. Usa só funções IMMUTABLE que não dependem de locale. O `translate` tira os acentos latinos (Á/À/Â/Ã/Ä/Ç/Ñ/Ø/Ł/Ș…), troca A–Z por minúsculas (sem `lower()`, cujo resultado fora do ASCII muda entre glibc e musl), troca o espaço duro por espaço e apaga os diacríticos combinantes U+0300–U+036F (texto em NFD).
- **Fonte única:** `src/lib/nome-ordenacao.ts`. Guarda o mapa, a expressão SQL e o espelho `normalizarParaOrdenacao`. No schema, a coluna é declarada com `@default(dbgenerated(...))`, como a `busca` da base de conhecimento, para que o `migrate diff` não proponha removê-la. Conferido: o diff não menciona `nomeOrdenacao`.
- **Listas trocadas para `[{ nomeOrdenacao }, { id }]`:** alunos (`alunos/filtros.ts`, na tela e na exportação, nas duas direções e como desempate das colunas país/status), contatos do CRM (pessoas e empresas em `crm/contatos.ts`), `/empresas` ordenada por nome (`empresas/filtros.ts`), contextos de recebimento destinado (`financeiro/consultas.ts`, ordenados pelo nome do aluno) e candidatos a aluno na preparação comercial.
- **Fora:** `Responsavel` não tem nenhuma lista ordenada por nome no banco. As listas de usuários, países e catálogo ficam fora da decisão D1, e as ordenações em memória já usam `localeCompare`.
- **Testes:**
  - `nome-ordenacao.test.ts`: unitários para Á/á/À/Â/Ã/Ç, nomes combinados, NFD e espaços; mapa sem duplicatas.
  - Trava: a migration contém exatamente a expressão do módulo; o schema declara a coluna e o índice; pela AST, o código de produção só cita `nomeOrdenacao` como chave de `orderBy`, com valor `"asc"`, `"desc"` ou `dir`.
  - `nome-ordenacao.int.test.ts`: o banco calcula o mesmo valor que o espelho TS; o valor acompanha a edição, inclusive por SQL cru; gravar à mão é recusado; "Álvaro" fica entre "Alice" e "Bruno" nas listas de alunos (as duas direções), contatos e empresas.
- Evidências no head:
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com 0 erros e 40 avisos (a linha de base; nenhum nos arquivos tocados).
  - `npm test`: 780 arquivos e 5.814 testes OK.
  - `npm run build`: saída 0.
  - Integração no banco isolado `erp_genius_test_acento`, com a migration aplicada por `prisma migrate deploy`: 36 arquivos e 314 testes OK. Cobriu `nome-ordenacao`, alunos, os 22 do CRM, recebimentos destinados, 5 de matrícula (reserva de vaga, preparação, continuidade e CT06), visibilidade acadêmica, diário e exportações.
  - `prisma migrate diff` (banco × schema): nenhuma linha com `nomeOrdenacao`.

### Fuso da escola, parte 4: atraso de mensalidade no dia da escola, datas digitadas no fuso da escola e adiamento direto à janela (pontos do #247) — 2026-10-19

Branch `claude/fuso-parte4`, base `main` fef6d467 (#247). Mesmo padrão do #239, #243 e #247: o dia é o civil da escola (`fusoDaEscola()`), nunca o do servidor, que roda em UTC. Cada ponto começou com um teste com relógio fixo que falhava; todos verdes com TZ=UTC e com TZ=America/Sao_Paulo.
- **1. Atraso de mensalidade:** `vencimento < agora` marcava atraso às 21h de Brasília do próprio dia do vencimento (meio-dia da escola) e, no legado à meia-noite UTC, já às 21h da véspera. `diaCivilGravado` e `diasCivisDesde` saíram de `cobrancas/regua.ts` para `operacao/fuso.ts` (a régua os reexporta, sem cópia), com dois novos: `vencimentoEmAtraso` (o dia civil da escola passou do dia do vencimento) e `limiteDoAtraso` (o mesmo critério como instante, para filtro no banco: `vencimento < limite` ⟺ em atraso; teste de equivalência em seis fusos). `financeiro/regras.ts` ganhou `statusEmAbertoPorVencimento`. Corrigidos: `alunos/consultas` (lista e ficha: atrasado e próximo vencimento), `ajustes/acoes`, `retomada/acoes`, e, pela mesma busca, `ajustes/consultas` (ficha financeira: em atraso e próximo), `financeiro/consultas` (KPIs em atraso/a receber), `financeiro/recebimentos` (status após pagamento parcial), `empresas/consultas` (atrasadas por colaborador), `matricula/desistencia-acerto-aplicacao`, `contratos/aditivo-acerto-taxa-acoes` (gravava o vencimento à meia-noite UTC e comparava com o relógio) e `alunos/acoes` (a pausa cancela a mensalidade ainda não atrasada: `gt: agora` virou `gte: limiteDoAtraso`).
- **2. Datas digitadas:** `paraDataLocal` (`_shared/validacao.ts`) e `dataRetomada` (`retomada/schema.ts`) usam `instanteDaGrade(data, "12:00", fuso)`. Como o Zod é síncrono, as ações validam com `analisarComDatasDaEscola(schema, entrada, await fusoDaEscola())` (sobre `comDatasDaEscola`, que só aceita trabalho síncrono): editar/pausar aluno, criar matrícula e ativação, ajuste, datas do lead, turma e pagamento. Fora desse escopo, a data digitada é recusada em vez de cair no relógio do servidor. Dia inexistente mantém a normalização antiga (31/02 → 03/03) em `paraDataLocal`; `dataRetomada` continua recusando. Compatibilidade de leitura: a retomada lê o dia digitado com `diaCivilGravado` (lê o meio-dia antigo do servidor e o novo da escola) e o replay compara por dia, então proposta pendente antiga segue reconhecida e não vira retroativa (teste de integração com snapshot antigo).
- **3. C3 da revisão do #247 (`whatsapp/despachante.ts`):** a mensagem barrada pelo teto diário vai direto para `retornoAposTeto`: o maior entre o início do dia seguinte da escola e a abertura da janela do contato (primeira hora existente da janela num dia permitido, no fuso do contato). Sem janela possível em uma semana ou com fuso inválido, fica no início do dia seguinte, como antes. Os testes de teto e janela existentes seguem verdes.
- **Testes:** `operacao/fuso.test.ts` (21h30 do dia do vencimento não atrasa, 00h30 do seguinte atrasa, nas três convenções), `financeiro/regras.test.ts`, `financeiro/consultas-kpis-fuso.test.ts`, `ajustes/consultas.test.ts`, `_shared/validacao.test.ts`, `retomada/regras.test.ts`, `whatsapp/despachante-teto.test.ts` (6 casos, inclusive Santiago sem meia-noite), integração `financeiro/atraso-dia-civil.int.test.ts` (13: lista de alunos, pausa, ajuste, retomada MANTER/REPROGRAMAR/proposta antiga) e 2 casos novos em `whatsapp/despachante-comercial.int.test.ts`. Fixtures com mock de Prisma ganharam `configuracaoOperacional`; os testes de schema validam dentro de `comDatasDaEscola`.
- **Encontrados e fora deste PR:**
  - `paraDataHoraLocal` (datetime-local da experimental) ainda usa a hora do relógio do servidor.
  - `matricula/acoes.ts:322` grava a 1ª mensalidade em `new Date(ano, mes - 1, dia, 12)` (meio-dia do servidor); lido corretamente por `diaCivilGravado`.
  - `kpisFinanceiro`: `dataPagamento: { lte: agora }` deixa o pagamento datado de hoje fora do "recebido no mês" até o meio-dia da escola (antes, até 09h de Brasília).
  - `diario/avisos-pendencias-diario.ts:227` (`vencimento <= agora` de pendência do diário, prazo com hora, não dia civil).
  - `diaCivilGravado` e o meio-dia da escola pressupõem fuso entre −11h e +11h.
- Nenhuma migration nova.
- Evidências (banco descartável `erp_genius_test_fuso4`, `migrate deploy`, apagado ao fim):
  - No head com o main b1da50fc (#248, #249, #250): `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144) saída 0; `eslint . --max-warnings 40` saída 0, 0 erros e 40 avisos (linha de base, nenhum nos arquivos tocados); `npm test` com TZ=UTC e com TZ=America/Sao_Paulo saída 0 nos dois, 781 arquivos e 5.824 testes; `npm run build` com a env do CI (NODE_OPTIONS=--max-old-space-size=5120) saída 0.
  - Integração `src/server/{financeiro,alunos,ajustes,retomada,operacao,cobrancas,whatsapp,matricula,comercial,turmas,empresas,contratos,_shared}` (141 arquivos, 3 pulados):
    - TZ=UTC, sobre fef6d467 (antes do ajuste da fixture abaixo): 1.230 passaram e 1 falhou, `financeiro/politica.int.test.ts`, cuja taxa vencia "agora" e era tida como atrasada no mesmo instante. A fixture passou a vencer ontem; o arquivo ficou verde com TZ=UTC e com TZ=America/Sao_Paulo (20 testes).
    - TZ=America/Sao_Paulo, no head com o #248: 1.232 passaram, 4 pulados. Saída 1 por uma rejeição não tratada em `matricula/desistencia-efetivacao.int.test.ts` (corrida de reserva concorrente; arquivo não tocado). Repetido duas vezes sozinho com TZ=America/Sao_Paulo: 11 de 11 e saída 0.
    - O #249 e o #250 não tocam nesses módulos de servidor: a integração não foi repetida depois deles.

### Decisões D9, D10, D11 e D14 do dono: B2B oculto, previsão de comissões no painel novo, avaliação exige fuso, mescla com alçada (#251) — 2026-10-20

- **D9, cobrança de empresas oculta (L2282):** a escola não usa a fatura B2B.
  - A chave fica em `src/lib/funcionalidades.ts`: `COBRANCA_B2B_ATIVA = false`, com `MSG_COBRANCA_B2B_DESLIGADA` ao lado.
  - `fecharFaturaB2B` e `pagarFaturaB2B` recusam com a mensagem, depois da sessão e da alçada e antes de qualquer leitura.
  - Na ficha da empresa, as faturas antigas continuam listadas. "Registrar pagamento" some, e um aviso diz por quê.
  - **Cancelar continua disponível** (R1 do #251, B1). Pausar ou cancelar aluno (`alunos/acoes.ts`), ajustar cobrança (`ajustes/acoes.ts`) e dar baixa (`financeiro/baixa.ts`) mandam cancelar antes a fatura FECHADA que já exista. Cancelar só desfaz o agrupamento, então `cancelarFaturaB2B` e o botão "Cancelar fatura" seguem com a chave desligada.
  - Nada foi apagado. Para religar, basta trocar a chave para `true`. Os testes do fluxo antigo (`FichaEmpresa.confirmacao.test.ts` e `b2b.int.test.ts`) religam a chave.
  - **Testes:**
    - `fatura-desligada.test.ts`: fechar e pagar recusam; cancelar passa.
    - Bloco D9 da ficha: pagar some e cancelar fica.
    - `fatura-desligada.int.test.ts`: com uma fatura FECHADA antiga e a chave desligada, a pausa do aluno é recusada; depois de cancelar a fatura, o aluno pausa.
- **D10, avaliação sem fuso da escola (C7 da #170):**
  - A página de lançamento sempre confere o fuso da escola, mesmo com `?fuso=` na URL. Sem ele, o formulário dá lugar a `MSG_LANCAMENTO_SEM_FUSO`, com o link "Configurar o fuso da escola" (`/configuracao/operacao`). O histórico continua visível.
  - `salvarLancamentoAvaliacaoLocal` e, desde a decisão de 20/10, `salvarLancamentoAvaliacao` (instante absoluto) recusam com a mesma mensagem.
  - As 15 suítes de integração que lançam notas chamam o helper comum `configurarFusoDaEscola()` (`src/test/integracao.ts`, upsert) no setup, logo depois do `truncarBanco`. Os `configuracaoOperacional.create/upsert` com fuso UTC que já existiam nelas viraram o mesmo helper. Nenhuma asserção mudou.
- **D11, previsão de pagamento das comissões (C50/L2259; decisão do dono de 20/10):**
  - **Regra:** dia X do mês seguinte à competência, em data civil no fuso da escola. A competência é a do painel: `aprovadaEm`, ou `criadoEm` quando não houve aprovação. Dezembro vira janeiro do ano seguinte.
  - **X:** fica em `ConfigFinanceiro.diaPrevisaoPagamentoComissao`, com padrão 10 e valores de 1 a 28 (CHECK no banco). A migration é `20261019120000_previsao_pagamento_comissao`.
  - **Onde se configura:** na aba "Política de comissão" do `/financeiro` (componente `DiaPrevisaoComissao`). Foi a escolha porque é a seção de configuração de comissões, e o `/configuracao` não abre para o Financeiro. A alçada é a de publicar política: `comissao.configurar`, e o Administrador passa sempre.
  - **Auditoria:** `salvarDiaPrevisaoComissao` grava o evento `DiaPrevisaoComissaoAlterado` (agregado `ConfigFinanceiro`) com `{ de, para }`. Repetir o mesmo dia não grava nada.
  - **Calculada na leitura, sem gravar `Comissao.dataPrevistaPagamento`:** a previsão depende só da competência, que não muda, e de X, que muda. Gravar exigiria recalcular as comissões em aberto a cada troca de X e preencher as antigas por migration. Na leitura, a troca vale na hora. O campo continua sem uso, como sempre esteve.
  - **Painel `/comissoes`:** coluna "Previsão de pagamento" na tabela e no cartão do celular, com a regra e o dia no topo da lista. Comissão paga ou estornada mostra "—". O escopo de quem vê cada linha é o mesmo do painel.
  - **Testes:**
    - Unitários do cálculo (`previsao-comissao.test.ts`, inclusive dezembro → janeiro e a virada de mês no fuso da escola), da tela de configuração e do painel.
    - Integração do painel (padrão 10, dezembro → janeiro com X = 5, estornada sem previsão, escopo do vendedor) e da configuração (evento `{ de, para }`, faixa, CHECK e alçada).
- **D14, mescla que repõe `Aluno/Responsavel.pessoaId` (#211 C4):**
  - **Alçada:** mover o cadastro acadêmico exige a alçada da Secretaria (`temAlcadaSecretaria`: Secretaria Acadêmica ou Administrador), além de `contatos.mesclar`. Sem ela, a mescla recusa com `MSG_ALCADA_SECRETARIA_MESCLA` e nada muda. A mescla comum segue igual.
  - **Secretaria sozinha:** continua sem mesclar (decisão do dono de 20/10).
  - **Prévia:** `previaMesclaPessoas` (`previaMesclaDaLista`, só leitura) devolve o que passa (telefones, oportunidades, participações, tags e campos), os campos que mudam, o cadastro acadêmico que é reposto e o motivo da recusa, quando houver.
  - **Tela:** "Revisar mesclagem" pede a prévia e a mostra no diálogo. Se a mescla seria recusada, o diálogo não abre e o motivo aparece.
  - **Evento:** cada cadastro reposto grava `CadastroAcademicoRepontado` no `Aluno` ou no `Responsavel` (agregado novo em `AgregadoTipo`), com `pessoaIdAntes`, `pessoaIdDepois` e `via: "mescla"`.
  - **Mudança no teste:** o teste de nome/e-mail de aluno pela mescla passou a usar um usuário com GC e Secretaria.
- **Migration:** `20261019120000_previsao_pagamento_comissao` (nova coluna com padrão; sem trava longa).
- Evidências no head, sobre o `main` 5b4e75a9 (com #248 a #253):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com 0 erros e 40 avisos (a linha de base, nenhum nos arquivos tocados).
  - `npm test` com TZ=UTC e com TZ=America/Sao_Paulo: saída 0 nos dois, com 787 arquivos e 5.868 testes.
  - `npm run build`: saída 0.
  - Integração (banco `erp_genius_test_d9`, com a migration nova aplicada):
    - `crm`, `empresas`, `avaliacoes`, `financeiro`, `academico`, `portal-aluno` e `diario/correcao-aula`: 88 arquivos, com 777 testes verdes e 1 falha.
    - A falha é `politica.int.test.ts`, "duas baixas parciais…": o `emAtraso` sai vazio entre 21h e 24h de Brasília. A taxa vence "agora − 24 h" e, nesse horário, ainda é o mesmo dia civil na escola (regra do #253). Este PR não mexe em KPI nem em vencimento.
    - As 15 suítes que lançam notas, rodadas à parte: 298 testes verdes.

### Decisões D8, D12 e D13 do dono: desvincular contato, mensagem agendada e carteira por contato real — 2026-10-20

Branch `claude/decisoes-d8-d12-d13`, base `main` 2a209fd4, com o `main` 5b4e75a9 (#250, #252 e #253) trazido antes do push. Implementado em TDD; nenhuma migration.
- **D12, mensagem agendada (#202 C3/C4):**
  - **C3:** `agendarMensagem` pelo CRM (tarefa, oportunidade ou pessoa) grava a intenção sem atendimento. O despachante abre (ou reusa) o atendimento COMERCIAL só no claim do envio (`abrirAtendimentoDaAgendada`, na mesma transação). Se o autor perdeu o número ou a carteira, a transação é desfeita e a intenção vira `CANCELADA`/`atendimento_sem_acesso`, sem atendimento criado. Agendada cancelada ou simulada (sem `WHATSAPP_LIVE`) nunca abre atendimento. O agendamento pelo Inbox continua no atendimento que já existe.
  - **C4:** agendar, reagendar e a `AGENDAR_MENSAGEM` da Aria são recusados fora da janela de envio, com a mensagem "Fora da janela de envio da escola: as mensagens saem das 9h às 20h, de segunda a sexta (horário de …). Escolha outro horário." A Aria fica `BLOQUEADA` com `motivoBloqueio: "FORA_DA_JANELA"`, e a sugestão aplicada depois é revalidada.
  - **Regra única:** `src/server/whatsapp/janela-envio.ts` (`dentroDaJanelaEnvio`) agora decide o passo 8 do despachante e a recusa do agendamento. A hora e o dia vêm do helper novo `horaEDiaInstitucional` de `operacao/fuso.ts`. A janela é a que o despachante aplica a uma intenção sem política própria (`carregarPoliticaRegua`), lida no fuso da escola. O `retornoAposTeto` do #253 também passou a usar `dentroDaJanelaEnvio`, sem cópia de `horaLocal`/`diaSemanaLocal`.
  - "Enviar agora" segue sem trava de janela, porque é envio imediato e não agendamento.
- **D13, carteira (#198 C6):** a lista negativa virou a positiva `EVENTOS_DE_CONTATO_SEM_INTERACAO`: `InteracaoRegistrada` (ligação, presencial, e-mail), `TarefaConcluida`, `ExperimentalAgendada`, `ExperimentalConfirmada` e `ExperimentalRealizada`. Somam-se as mensagens de entrada e as saídas que chegaram (`ENVIADA`/`ENTREGUE`/`LIDA`) nos atendimentos da oportunidade. Nota interna, edição de cadastro, reatribuição, tags e documentos não contam. A integração cobre o lead com só notas e edições depois do último contato e a saída que falhou.
- **D8, "Desvincular contato" no Inbox (#175, docs/42 L2298):**
  - **Ação:** `desvincularContatoWhatsApp` (`src/server/whatsapp/desvincular-contato.ts`) zera `ContatoWhatsApp.alunoId`, `responsavelId` ou `leadId`, o vínculo que `vincularContatoWhatsApp` faz. Na linha de vendas, também solta o lead do atendimento da linha. Não apaga cadastro, mensagens nem atendimentos, e o contexto dos atendimentos de secretaria e financeiro (aluno e matrícula) fica.
  - **Permissão:** só o Administrador ou o gerente do setor (`podeExecutar(…, "desvincular")`). O comercial desfaz a oportunidade; a secretaria e o financeiro, o aluno e o responsável; o pedagógico, nada.
  - **Motivo e auditoria:** o motivo é obrigatório (10 a 500 caracteres). O evento `ContatoDesvinculado` é gravado na mesma transação, e o arquivo entrou na trava `crm-config/auditoria.test.ts` (mutação do evento fora da transação conferida: a trava falha).
  - **Tela:** o botão "Desvincular" no painel do Inbox (`AcoesContato.tsx`) aparece só com os `vinculos` que o servidor libera. Pede o motivo no `CampoTexto` e roda a action no `ConfirmarAcao`, registrado no mapa de confirmações. A confirmação do vínculo deixou de dizer "não há desvincular pela tela".
- **Evidências** no head:
  - `tsc --noEmit`: saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com os 40 avisos de base.
  - `npm test`: 783 arquivos e 5.860 testes, sobre o `main` 5b4e75a9.
  - `npm run build`: saída 0.
  - **Integração de whatsapp, inbox, crm e aria (+ `app/(app)/inbox`):** 117 arquivos e 1.004 testes, verdes salvo 3 testes de `whatsapp/acoes.int.test.ts` (cobrança "Sem ação devida hoje"), que falham igual no `main` b1da50fc limpo e não são deste PR. Depois do merge do #253: 12 arquivos de integração do despachante, agendamento, carteira, desvincular, Aria e regras do Inbox, com 129 de 129 testes.
- **Ajustes depois da R1 e das decisões do dono no #254 (2026-10-20):**
  - **Carteira:** a mensagem enviada só conta quando foi uma pessoa (`HUMANO` pela Inbox, `CELULAR` pelo app), além da recebida do cliente. Régua e automações (`CRON`, `LOTE`, `GESTAO`), a resposta da Aria (`IA`) e saída legada sem origem não contam. O teste de integração cobre o lead que só recebeu régua e Aria depois do último contato e continua "sem interação".
  - Recusar o agendamento no fim de semana e deixar "Enviar agora" sem a trava da janela foram confirmados pelo dono, sem mudança.
  - **C3:** `abrirAtendimentoDaAgendada` confere `destinatarioAtualDoAtendimento` dentro da transação do claim, antes da visibilidade. Na divergência, tudo é desfeito e a intenção vira `CANCELADA`/`destinatario_alterado`, sem atendimento nem conversa. Há teste com o contato da pessoa diferente do telefone da oportunidade.
  - **C4:** `dentroDaJanelaEnvio` usa `horaEDiaNoFuso` (novo em `operacao/fuso.ts`, só `Intl`), então um fuso como `EST5EDT` vale. Só cai na hora do servidor o que nem o `Intl` aceita.
  - **Evidências:**
    - `tsc`: saída 0.
    - lint: 40 avisos de base.
    - `npm test`: 783 arquivos e 5.861 testes.
    - build: saída 0.
    - Integração de `src/server/crm` mais despachante e agendamento: 34 arquivos e 265 testes.

### Testes de cobrança que dependiam do horário: fixture no dia da máquina × régua no dia da escola — 2026-10-20

Branch `claude/fix-acoes-int`, base `main` 6122c874 (#251). Relato: 3 testes de `whatsapp/acoes.int.test.ts` ("Sem ação devida hoje para esta cobrança.") falhavam no main, embora a integração de fef6d467 tivesse passado.
- **Causa:** não é regressão do #247 nem do #253 no produto. Desde o #239 (fa393092, Q176) a régua e o D+30 contam no dia civil da escola (`fusoDaEscola()`), e as datas gravadas são lidas por `diaCivilGravado` (o maior entre o dia UTC e o da escola). As fixtures montavam "hoje" no relógio real: `agoraAs`/`diasDepois` no fuso da máquina, e `Date.now() − N × 24 h`. Entre 00h e 03h UTC (21h–24h em Brasília) o dia UTC já é o seguinte ao da escola: o vencimento "hoje + 7" vira D-8 na escola (com TZ=UTC), e o "agora − 29 dias" vira D+28 (em qualquer TZ). A integração de fef6d467 passou porque rodou fora dessa faixa.
- **Prova:**
  - Reproduzido no relógio real às 01h15 e 02h12 UTC; com o relógio deslocado (preload que troca `Date`), `acoes.int.test.ts` falha às 01h30 e 02h59 UTC com TZ=UTC e passa às 03h01, 15h e 23h30; com TZ=America/Sao_Paulo passa em todos.
  - `git bisect` (só esse arquivo, TZ=UTC, relógio às 01h30 UTC) entre fa393092^ (verde) e o main: primeiro commit ruim fa393092 (#239). fef6d467 falha às 01h30 UTC e passa às 15h UTC.
  - Mesma família, achados com o relógio deslocado e confirmados no relógio real às 02h12 UTC: `cobrancas/acesso-aulas.int.test.ts` (2 testes D+29/D+30, nos dois fusos) e `cobrancas/conferencia.int.test.ts` (1 teste, TZ=UTC); ambos verdes em fa393092^ e vermelhos em fa393092 às 01h30 UTC.
  - `financeiro/politica.int.test.ts`, "duas baixas parciais…" (relato do coordenador): a taxa vencia "agora − 24 h", que entre 21h e 24h de Brasília ainda cai no dia de hoje da escola, e o `emAtraso` (#253, `limiteDoAtraso`) saía vazio. Verde em b172bc53^ e vermelho em b172bc53 às 01h30 UTC; falhou no relógio real às 02h21 UTC nos dois fusos.
- **Correção (só testes, nenhum produto alterado):** `acoes.int.test.ts`, `acesso-aulas.int.test.ts` e `conferencia.int.test.ts` rodam com relógio fixo (`vi.useFakeTimers({ toFake: ["Date"] })`, 2026-10-20 15h UTC = meio-dia da escola, quando o dia UTC e o da escola coincidem); o CT08 segue trocando o relógio por conta própria. Em `politica.int.test.ts` a taxa vence ao meio-dia de ontem no calendário da escola (`inicioDoDiaInstitucional(agora, fusoDaEscola()) − 12 h`).
- **Busca por outros casos:** `grep` nos `*.int.test.ts` por vencimento derivado de `Date.now()`, `agora.getTime()`, `agoraAs`, `diasDepois` e `new Date()`. Rodados no relógio real entre 02h21 e 02h40 UTC: `whatsapp/{cron,ciclo-cobranca,inbox,acesso-atendimento,despachante.live}`, `whatsapp/motor/ponta-a-ponta`, `gravacoes/autorizacao`, `portal-aluno/relatos-indisponibilidade`, `financeiro/{confirmacao-manual,atraso-dia-civil}`, `matricula/{comissao-aprovada-em,reserva-vaga}`, `uploads/arquivos`, `aria/triagem` e `api/exportacoes` — todos verdes. `atendimento-pedagogico-autorizacao` só falhou com o relógio deslocado (o `now()` do banco ficava à frente do processo); no relógio real passa.
- Evidências (banco descartável `erp_genius_test_acoesint`, `migrate deploy`, apagado ao fim), no head com o main 6122c874 (#251):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base; nenhum nos arquivos tocados).
  - `npm test`: 787 arquivos e 5.868 testes OK.
  - `npm run build` (NODE_OPTIONS=--max-old-space-size=5120): saída 0.
  - Integração `src/server/whatsapp`, `src/server/cobrancas` e `financeiro/politica.int.test.ts`: 64 arquivos e 513 testes OK com TZ=UTC e com TZ=America/Sao_Paulo.
  - Os 4 arquivos corrigidos: 47 testes OK no relógio real às 02h40 UTC (dentro da faixa que quebrava) e com o relógio deslocado para 01h30 UTC, nos dois fusos.

### D7: integração completa noturna no GitHub Actions, em 4 shards — 2026-10-20

Branch `claude/ci-integracao`, base `main` 9808cd29, PR #256 (draft). Nenhuma migration.
- **Workflow `.github/workflows/integracao.yml`:** `npm run test:int -- --shard=N/4` toda noite às 06:17 UTC (03:17 em Brasília) e por `workflow_dispatch`, sem gatilho de PR. São 4 shards com `fail-fast: false`, e cada um tem o próprio `postgres:16-alpine` de serviço em `localhost:54329`, com `postgres:teste`, credencial de teste e não segredo. As migrações rodam do zero com `node scripts/prisma-teste.mjs migrate deploy`. O job usa `TZ=America/Sao_Paulo`, `NODE_OPTIONS=--max-old-space-size=4096` e timeout de 120 min, e cada passo tem o seu. Actions por SHA, Node do `.nvmrc` e cache do npm, como no `ci.yml`.
- **Como o banco é escolhido:** o `vitest.integration.config.ts` ignora `DATABASE_URL` e usa o perfil (`.erp-test-profile` ou `ERP_TEST_PROFILE`), sempre em `localhost:54329`. O setup global só confere `migrate status`, sem criar banco nem migrar. Entrou o perfil `ci-integracao` (`erp_genius_test_ciint`) em `scripts/test-profile.mjs`, que o workflow pede por `ERP_TEST_PROFILE`. Os perfis locais não mudam, e `src/test/banco-isolado.test.ts` cobre o novo.
- **Evidências:**
  - YAML carregado sem erro.
  - Shard 1/4 local com as mesmas variáveis do workflow, num banco descartável `erp_genius_test_ciint` migrado do zero: 79 arquivos e 666 testes verdes em 47 min 40 s, numa máquina compartilhada com outras suítes.
  - `banco-isolado.test.ts` e `ci-workflow.test.ts`: 6 testes verdes.
  - **Execução no Actions: não feita.** O `POST .../actions/workflows/integracao.yml/dispatches` voltou 403 "Resource not accessible by integration", porque o token da sessão não tem `actions: write`. O workflow também ainda não aparece na lista do repositório: o GitHub só registra um `workflow_dispatch` depois que o arquivo chega na branch padrão. O primeiro run sai pelo botão "Run workflow", com um token que tenha permissão, ou na primeira noite depois do merge.
### B13 e D4: remoção do CRM antigo e do Inbox antigo (código morto e tabelas órfãs) — 2026-10-20

Branch `claude/remover-crm-antigo`, base `main` 9808cd29. Decisões do dono B13 (remover o código morto) e D4 (apagar as tabelas e os campos órfãos). Cada item foi conferido com `git grep` (imports e chamadores) antes de sair.
- **Inbox antigo:**
  - Saem `listarConversasInbox`, `listarConversas` e `carregarThread` (`whatsapp/consultas-inbox.ts`).
  - Saem os limites, a mescla e o filtro de canal de `whatsapp/busca-inbox.ts`. Ficam `lerBuscaInbox` e `whereBuscaConversas`, usados pelo Inbox novo.
- **CRM antigo:**
  - Saem `enfileirarIntencaoComercial`, `salvarConfigComercial`, `salvarReguaComercial`, `carregarSaudacoesSimuladas`, `carregarConfigComercial`, `comercial/regua-comercial.ts` e `comercial/regua-fabrica.ts`. Os dois arquivos entraram na trava `casca-crm-removida.test.ts`.
  - Saem também `motivoCadenciaInvalida`, `reagendamentoPendente`, `registrarEventoReguaComercialEnviada` e a seção comercial do `seed-whatsapp`.
  - **Despachante:** saem os ramos da cadência comercial e o shadow da saudação e da gestão lidos da `ConfigComercial`. O que sobrar na fila é cancelado: `passoComercial` com `politica_comercial_alterada`, origem `GESTAO` com `configuracao_gestao_alterada`. A reativa sem IA só simula.
- **Dependências:** `@dnd-kit/sortable` e `@dnd-kit/utilities` saíram com `npm uninstall`. O `@dnd-kit/core` fica, porque o funil e a agenda de tarefas o usam.
- **Migration `20261020090000_remover_crm_antigo`:**
  - `DROP TABLE` de `PoliticaComercial` e `DegrauComercial`.
  - `DROP COLUMN` de `IntencaoMensagem.politicaComercialId`, com o índice parcial `IntencaoMensagem_comercial_degrau_key`.
  - `DROP COLUMN` de `ConfigComercial.autoLeadAtivo`, `saudacao*` e `gestao*`.
  - O comentário no topo exige backup. As consultas de conferência estão no corpo do PR ("Antes do deploy").
- **O que ficou:**
  - `ConfigComercial.checkInToleranciaMinutos` e `matriculaAutomaticaAtiva` (lidos pela Home e pelo fechamento automático).
  - `IntencaoMensagem.leadId`, `passoComercial` e `ocorrenciaComercial`.
  - A regra da carteira (#254) que deixa `ReguaComercialEnviada` fora dos contatos: é a mesma régua antiga, mas vale para os eventos já gravados.
  - `capturarRespostaExperimental`, que só acha os lembretes já gravados.
- **Testes:**
  - Saíram os que só exercitavam código morto.
  - As regras de acesso que passavam pela thread antiga foram portadas para as consultas do Inbox novo (`src/test/inbox-consultas.ts`, `carregarPainel`).
  - O teto Q176 foi para `despachante-teto.int.test.ts`, com o cancelamento das intenções que sobraram.
  - B3, shadow com live e template pelo motor viraram testes de automação genérica.
- **Evidências:**
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com 40 avisos de base.
  - `npm test`: 787 arquivos e 5.875 testes.
  - `npm run build`: saída 0.
  - Integração no banco `erp_genius_test_crmantigo`, com a migration aplicada: `src/server/whatsapp`, `comercial`, `crm` e `inbox`, mais `academico/visibilidade` e `aria/turno/despacho-ia`. Foram 101 arquivos e 780 testes verdes.
  - `prisma migrate deploy` do zero num banco vazio: 466 migrations aplicadas.
  - `prisma migrate diff` banco × schema: só as divergências antigas, as mesmas do `main`, e nenhuma linha dos objetos removidos.
- **Pendência operacional:** fazer backup e rodar as consultas do PR antes do deploy.

### Pendências pequenas das revisões #250, #253 e #255 — 2026-10-20

- **#255 C1 (relógio fixo × `now()` do banco):** `whatsapp/acoes.int.test.ts`, `cobrancas/acesso-aulas.int.test.ts` e `cobrancas/conferencia.int.test.ts` fixam o relógio no meio-dia da escola **do dia corrente** (`meioDiaDaEscolaHoje()` em `src/test/integracao.ts`: `inicioDoDiaInstitucional(new Date(), fusoDaEscola()) + 12 h`, lido depois do `truncarBanco`), e não mais em 2026-10-20 15h UTC. Assim o processo fica no mesmo dia dos defaults `now()` do Postgres.
- **#253 C2:** `criarMatriculaTx` passa o `tx` para `fusoDaEscola(tx)`.
- **#253 C3:** conferido que o caso não acontece: o `SolicitarRetomadaSchema` já recusa `cobrancaId` repetido ("Uma cobrança não pode receber duas datas.", desde o #175), antes da transação e do replay. Nenhuma checagem duplicada no replay; um comentário ali aponta a dependência, e um teste novo em `retomada/fluxo.int.test.ts` trava o comportamento (erro, proposta e eventos intactos, replay correto continua devolvendo a mesma proposta).
- **#250 C1:** comentário em `Modal.feedback.test.ts` sobre a dependência da fatia de 5 ms do Scheduler (`scheduler` 0.23.2, `performance.now`) e o que conferir depois de um upgrade do React. Conferido que o teste falha se `useDialogo` usar `useEffect` no lugar do efeito de layout.
- **#249 C2:** já feito no #250 (caso `antes` em `avaliacoes/segunda-chamada-agenda-inicial.int.test.ts`); nada a fazer.
- Evidências (banco descartável `erp_genius_test_pend`, `migrate deploy`, apagado ao fim):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base; nenhum nos arquivos tocados).
  - `npm test`: 788 arquivos e 5.892 testes OK com TZ=UTC e com TZ=America/Sao_Paulo.
  - `npm run build`: saída 0.
  - Integração (`whatsapp/acoes`, `cobrancas/acesso-aulas`, `cobrancas/conferencia`, `retomada/fluxo`, `matricula/criar-idempotencia`, `matricula/ativacao`, `financeiro/politica`): 7 arquivos e 97 testes OK com TZ=UTC e com TZ=America/Sao_Paulo.

## LGPD, D5 (#165): anonimizar o texto da busca nos `DadosExportados` antigos (20/10/2026)

Branch `claude/lgpd-exportacoes`, base `main` 9808cd29, com o `main` 4d698f2e (#255) trazido antes do push. Nenhuma migration. **O script não foi rodado em produção (UAT)**: fica para o dono, depois do backup.

- **Problema:** até a #119 (merge em 25/09/2026, 11:03), o evento `DadosExportados` gravava em `payload.filtros.busca` o texto digitado na busca da listagem exportada (alunos e leads), que pode ser nome, e-mail ou telefone. A partir da #119 a trilha grava só `{ aplicada: true, caracteres: n }`. A exportação de contatos e a de relatórios (#228) já nasceram no formato novo.
- **Rotina:** `anonimizarBuscaExportacoes` (`src/server/lgpd/anonimizar-busca-exportacoes.ts`), operada por `scripts/anonimizar-busca-exportacoes.ts`, no padrão de `reparar-nome-contato-whatsapp.ts`.
  - **Critério:** `tipo = 'DadosExportados'`, `criadoEm` antes do corte e `payload.filtros.busca` em texto (`jsonb_typeof = 'string'`). O corte padrão é o fim de 25/09 em Brasília (`2026-09-26T03:00:00Z`), porque o deploy da #119 veio depois do merge e o próprio dia 25 pode ter o texto. Pode ser trocado com `--corte`.
  - **Troca:** a busca em texto vira `{ aplicada: true, caracteres: n }`, o mesmo formato que o código grava desde a #119 (o padrão da trilha, e não `null` nem um marcador). O resto do payload não muda. O texto removido não é copiado para lugar nenhum.
  - **Simulação por padrão:** sem `--aplicar`, só conta as linhas e mostra o intervalo de datas, sem gravar nada.
  - **Lotes:** `--lote` (padrão 500). Cada lote é um `UPDATE … WHERE id IN (SELECT … FOR UPDATE)` numa transação própria. Uma falha no meio não desfaz os lotes já gravados, e rodar de novo pega o resto.
  - **Auditoria:** um `BuscaExportacaoAnonimizada` (agregado `Exportacao`, autor nulo) por execução com `--aplicar`, com `corte`, `candidatos`, `afetados`, `lotes`, `intervalo { de, ate }` e `concluida`. É gravado também quando um lote falha, e não guarda dado pessoal. Entrou no catálogo (doc 12, seção "Exportação e LGPD").
  - **Idempotente:** a linha anonimizada sai do critério, então a segunda execução afeta 0 linhas (e registra um evento com 0).
- **Como rodar em produção (UAT), quando o dono decidir:**
  1. Fazer o backup do banco com `scripts/backup-producao.sh` e conferir que o arquivo foi gerado.
  2. Com a `DATABASE_URL` do UAT, rodar a simulação: `npx tsx scripts/anonimizar-busca-exportacoes.ts`. Guardar a saída (quantidade e intervalo de datas).
  3. Rodar `npx tsx scripts/anonimizar-busca-exportacoes.ts --aplicar`. A saída mostra as linhas anonimizadas, os lotes e o id do evento.
  4. Rodar a simulação de novo: deve mostrar 0.
  5. Conferir no banco: `SELECT count(*) FROM "Evento" WHERE tipo = 'DadosExportados' AND jsonb_typeof(payload #> '{filtros,busca}') = 'string';` deve dar 0, e `SELECT payload FROM "Evento" WHERE tipo = 'BuscaExportacaoAnonimizada' ORDER BY "criadoEm" DESC LIMIT 1;` traz a contagem.
  6. Registrar aqui as saídas dos passos 2 a 5 e marcar o item da #165.
- **Testes de integração** (`anonimizar-busca-exportacoes.int.test.ts`, banco descartável `erp_genius_test_lgpd`): 5 de 5.
  - A simulação não altera nenhuma linha nem grava evento.
  - A aplicação troca só a busca em texto das linhas antes do corte, em lotes de 1. Ficam iguais: a exportação sem busca, a já no formato novo, a posterior ao corte e um evento de outro tipo com o mesmo campo.
  - Um `--corte` anterior ao dia 25 deixa a linha do dia 25.
  - Idempotência: a segunda execução não muda nada.
  - Evento: o payload exato, sem nenhum texto da busca, e um evento por execução.
  - Mutação: tirar o filtro do corte faz 4 dos 5 testes falharem.
- **Script pela linha de comando** no banco de teste: simulação com 1 linha, `--aplicar` com 1 linha e 1 lote, reexecução com 0, e argumento desconhecido recusado.
- **Evidências:**
  - `tsc --noEmit`: saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com os 40 avisos de base.
  - `npm test`: 788 arquivos e 5.892 testes.
  - `npm run build`: saída 0.

### Port da #62, lote 1: validadores de documento, Q174 e Q161 (D2 do dono, #164) — 2026-10-20

- **Escopo (D2):** trazer a #62 em lotes. Este é o lote de servidor sem migration e fora da cadeia financeira. A #164 continua aberta. Nada veio por cherry-pick: os testes da #62 entraram primeiro e falharam, e a implementação veio depois, refeita à mão onde o main mudou. A Q176 já tinha entrado pelos PRs #239, #243, #247 e #253 e não foi refeita.
- **Validadores (B18, `_shared/validacao.ts`):**
  - `curp`: formato, entidade federativa, data e dígito verificador do RENAPO.
  - `dui_sv`: dígito verificador.
  - `dni_ar` e `cedula_cr`: só formato.
  - `passaporte`: formato ICAO genérico, sem regra por país, porque a #62 não definiu uma.
  - Continua "avisa, não bloqueia": só a flag `documentoValido`.
- **Q174:** o aditivo de `REGIME` é recusado em `prepararAditivoContratualTx`. Correção em relação à #62: lá a recusa ficava numa conferência que só roda com dinheiro, moeda ou cobertura, e um aditivo só de regime passava. Propostas anteriores continuam decidíveis. O aviso na tela fica para o lote das telas.
- **Q161:** a cadeia pós-replanejamento aceita PREVISTO→MINISTRADO e alterações de quantidade aplicadas, compartilhadas com os destinos acadêmicos. A transferência aprovada no meio do ciclo é conferida em dois trechos civis. Memórias já confirmadas mantêm o hash. Detalhe em `continuidade-q161-q162.md`.
- **Ficam para os próximos lotes:**
  - fuso pessoal nas telas: refazer sobre a #159;
  - Q164 (migration `…010000`) e Q157 (`…020000`);
  - assinatura eletrônica: depende de telas e de `ASSINATURA_DRIVER`;
  - cadeia financeira (Q172 → Q175 → Q173 → Q171 → origem histórica, migrations `…030000` a `…090000`) e `decisoes-2026-09-21.md`: aguardam o dono confirmar as regras de 21/09.
- **Evidências** (banco descartável `erp_genius_test_p62`, `migrate deploy`, perfil temporário desfeito e banco apagado ao fim):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `npm test`: 791 arquivos e 5.930 testes OK em UTC e em America/Sao_Paulo.
  - `npm run build`: saída 0.
  - Integração de disponibilidade de oferta, continuidade (fila, emissão SQL e condições), acadêmico (`academico`, `fluxo`), replanejamento sem remarcações e cadastro de alunos: 8 arquivos e 108 testes OK.
  - Uma rodada mais ampla (inclui `aditivo.int.test.ts`) passou de 30 minutos e foi interrompida sem resultado. Nenhuma integração existente cria aditivo de `REGIME`.

### Port da #62, lote 2: Q172, aditivo de adiantamento (#164) — 2026-10-20

- **Decisão:** a de 21/09/2026 (PR #62, `decisoes-2026-09-21.md` daquela PR), reconfirmada pelo dono em 20/10/2026. O aditivo de adiantamento só alcança o adiantamento da emissão inicial enquanto ele não foi pago nem usado.
- **O que entrou (reimplementado sobre o `main`, sem cherry-pick cego):**
  - Migration `20261020100000_aplicacao_adiantamento_aditivo` (era `20260921030000` na #62). Cria `PropostaAdiantamentoAditivo`, `DecisaoAdiantamentoAditivo` e `AplicacaoAdiantamentoAditivo`, os guards 172 e o trigger que altera a cobrança em aberto. Redefine `conferir_campos_aplicacao_direta_231` copiando a definição vigente (`20260917163000`, idêntica à do `main`) e acrescentando o ramo do adiantamento.
  - Servidor: `contratos/adiantamento-aditivo.ts` (propor, decidir, aplicar, consultar) e `contratos/aditivo-adiantamento.ts` (alvo e recusas). A prova por campo (`aditivo-aplicacao-campos*.ts`), a revisão de efeitos e `conferirCompraPreparadaTx` passam a usar os minutos e o valor vigentes.
  - Tela `financeiro/acertos-adiantamento/[matriculaId]/[propostaId]` no padrão atual (`useAcaoCliente`/`FeedbackAcao`, `EstadoVazio`, `IdentificacaoRegistro`, `formatarMoeda`), com link na proposta de aditivo: para o Financeiro e a Administração; a Secretaria recebe a orientação. Registrada nas travas de botões, estados vazios, trilha, feedback separado e identificação.
- **Diferenças em relação à #62:**
  - A orientação separa consumo ("já foram utilizadas em aulas") de compra registrada ("já foram registradas como saldo de horas"). Antes, as duas tinham uma mensagem só.
  - As mutações devolvem `podeRevisar`, como o acerto de vencimento do `main`.
- **Regras:**
  - Há recusa com orientação, na consulta, na ação e no banco, quando existe: pagamento (mesmo parcial), crédito usado ou proposto, consumo, compra de horas, comprovante a conferir, pausa ou acerto.
  - A decisão e a aplicação exigem um aprovador financeiro diferente de quem propôs.
  - A aplicação só vale depois da vigência.
  - A comissão (base: taxa de matrícula) não é recalculada.
  - Convive com a recusa da Q174 (#260), que só alcança `REGIME`.
- **Evidências:**
  - Testes de integração novos em `contratos/aditivo.int.test.ts`, 8 cenários `PRODUCAO_HORA_ADIANTAMENTO`: fluxo completo da #62, pagamento parcial, crédito, compra de horas, consumo, mesma pessoa (na ação e no banco), vigência (antes recusa e depois aplica, com o relógio real do banco) e comissão inalterada.
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `npx eslint . --max-warnings 40`: saída 0, com 40 avisos de base.
  - `npm test` em UTC e em America/Sao_Paulo: 789 arquivos e 5.893 testes em cada fuso.
  - `npm run build`: saída 0.
  - `prisma migrate deploy` do zero no banco `erp_genius_test_q172`. No `migrate diff` banco × schema, nenhuma linha dos objetos da Q172.
  - Integração de `src/server/matricula`, `financeiro` e `contratos` no `erp_genius_test_q172`: 61 arquivos e 618 testes verdes. Ficaram de fora 3 arquivos e 4 testes de homologação de UI, condicionais por ambiente.
- **Fora deste lote:** Q175, Q173, Q171 e a origem histórica, nesta ordem. O link do acerto na página inicial do Financeiro também fica para depois.
- **Pendência operacional:** fazer backup e ensaiar o `migrate deploy` numa cópia do UAT antes do deploy.

### B19: funil e carteira ordenam, filtram e cortam no banco (#196 C3, #198 C2) — 2026-10-20

- **Problema:** o funil (ordem "tempo" e período dos perdidos) e a carteira carregavam todos os ids do escopo, buscavam o último `Evento` de cada um com `in` e ordenavam e cortavam em memória. Além de crescer com a base, isso quebrava acima de 32.767 oportunidades no escopo: o `in` passa do limite de parâmetros do Postgres (`P2035`, visto na medição abaixo com o admin).
- **O que mudou:**
  - `crm/oportunidade-sql.ts` (novo): traduz para SQL o `where` de Oportunidade que essas telas já montam em Prisma (escopo comercial + filtros da URL). O filtro continua definido uma vez só. A tradução cobre só as formas usadas aqui e **recusa com erro** qualquer outra, para que um filtro ou um escopo novo nunca suma em silêncio. A semântica é a do Prisma: `contains` insensível vira `ILIKE '%x%'` sem escapar `%` e `_` (o Prisma também não escapa), e `in: []` não casa nada.
  - Funil: as colunas em ordem "tempo" e a coluna PERDIDO com período usam uma consulta em SQL, com junção lateral no último `Evento`, `ORDER BY` e `LIMIT 50`, mais os totais e somas por país. Só os 50 cartões da página são carregados. As outras ordens já eram `orderBy` + `take` no Prisma e não mudaram.
  - Carteira: uma consulta calcula os dias civis sem interação no fuso da escola (lista positiva de eventos do #198 C6/D13 e mensagens humanas do #254), filtra "sem interação há N dias", ordena (mais dias primeiro e id em ordem binária) e corta em 500, com o `total` por `COUNT(*) OVER ()`. Só as linhas devolvidas carregam os detalhes. `carregarCarteira` ganhou um `limite` opcional, usado nos testes.
  - Desempates: em "tempo" e na carteira o id vai com `COLLATE "C"`, a mesma ordem do `<` do JS de antes. Nas outras ordens fica a collation da coluna, como no `orderBy` do Prisma.
- **Índices: nenhum.** O `EXPLAIN ANALYZE` numa base sintética de 100 mil oportunidades e 800 mil eventos mostrou que o custo está na busca do último evento por oportunidade, que já usa `Evento(agregadoTipo, agregadoId)`. Testei e descartei dois índices: `Lead(vendedorDonoId, etapa)` (ganho de poucos ms) e um índice de cobertura em `Evento` (scan só no índice, sem ganho). A subconsulta correlacionada no `WHERE` levava o planejador a estimar o custo pela tabela inteira e a compilar JIT (~330 ms numa consulta de 8 ms). Por isso as consultas usam junção lateral.
- **Medição** (mesma base, `scripts` locais, não versionados): vendedor com 2.500 oportunidades: carteira 104–150 ms (antes 600–890 ms), funil "tempo" ~100 ms (antes 180–230 ms) e funil "recentes" com perdidos de 30 dias 150–190 ms (antes 100–160 ms). Admin: funil 0,5–1,6 s e carteira ~1,5 s. A versão antiga falhava com `P2035`.
- **Testes:**
  - `funil-carteira-equivalencia.int.test.ts` (40 testes): base determinística de 200 oportunidades com etapas, donos, cobertura ativa e vencida, países, valores e follow-ups com empates, tags, eventos, mensagens de todas as origens e turmas ativas e encerradas. Compara o resultado novo com a cópia da versão anterior (`src/test/legado-funil-carteira.ts`, só para teste), inteiro e na mesma ordem. No funil: 4 ordens × 3 períodos × 7 sessões (admin, 2 gerentes, vendedor com e sem cobertura, sem papel comercial) e 11 filtros (tipo, dono, temperatura, origem, tag, buscas com `_` e `%`, combinados). Na carteira: 10 filtros × 7 sessões, cortes de 1, 7 e 40, e fusos Tóquio e Honolulu.
  - Escopo de visibilidade: vendedor vê a própria carteira e a que cobre (a cobertura vencida não conta), gerente vê só a equipe, sem papel comercial não vê nada e filtro de dono fora do escopo não abre carteira alheia. Vale nos dois caminhos do funil e na carteira.
  - Mutação: inverter o desempate ou o `NULLS LAST` faz 26 dos 40 testes falharem.
  - `oportunidade-sql.test.ts` (7, unitário): formas do escopo, enum, `not`, busca, relações e recusa do que não é suportado. `carteira.test.ts` foi reescrito para a consulta nova, com as mesmas regras da lista positiva e das mensagens.
- **Evidências** (banco descartável `erp_genius_test_b19`, `migrate deploy`, perfil temporário desfeito antes do commit e banco apagado ao fim):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `npm test`: 791 arquivos e 5.924 testes OK.
  - `npm run build`: saída 0.
  - Integração de `src/server/crm`: 30 arquivos e 267 testes OK, incluindo os 40 de equivalência e os de `funil` e `carteira`.

### Port da #62: Q164 e Q157 (#164) — 2026-10-20

- **Escopo:** o lote da Q164 e da Q157, que têm migration e ficam fora da cadeia financeira. O dono confirmou que as decisões de 21/09 continuam valendo. A #164 continua aberta. Nada veio por cherry-pick: os testes da #62 entraram primeiro e falharam, e a implementação veio depois, sobre o main atual.
- **Q164, resolução do impedimento causado pela escola:**
  - A gestão pedagógica (ou a administração) confirma, com justificativa, que uma realização posterior da mesma avaliação resolveu o impedimento. Precisa ser a mesma matrícula, alocação, turma, regra e código, e a realização precisa ter nota oficial. Não há segunda aprovação.
  - A reserva em `PENDENCIA_ESCOLA` e a ocorrência ficam como histórico. A resolução é um registro à parte (`ResolucaoImpedimentoSegundaChamada`), único por reserva e imutável, com guard SQL que repete as regras.
  - O fechamento deixa de contar o impedimento resolvido.
  - Tela: formulário no histórico de reservas, que só aparece quando existe realização apta.
  - Migration `20261020200000_resolucao_impedimento_segunda_chamada`, que era a `20260921010000` na #62.
- **Q157, correção do período de um relato confirmado de falta de oferta:**
  - A correção é versionada e precisa de aprovação de outra pessoa. Aprovada, o período do relato muda na mesma transação, e todos os consumidores (TS e guards SQL) passam a ler o período vigente. O trigger do relato só aceita essa mudança quando há correção aprovada que a respalde.
  - É recusada, na ação e no banco, quando retira dias que já sustentam compensação aprovada ou período integral aprovado.
  - Relato aberto corrige só o início, porque o fim vem pelo término aprovado (Q156). Relato encerrado não é reaberto.
  - Tela nova em `matriculas/[id]/indisponibilidade-oferta/[registroId]/correcao`, com link na lista de relatos.
  - Migration `20261020210000_correcao_relato_indisponibilidade_oferta`, que era a `20260921020000` na #62. A função `validar_registro_indisponibilidade_oferta_matricula` é a mesma do main (`20260915076000`, inalterada desde a #62) mais o ramo de UPDATE.
- **Adaptações ao main:**
  - Telas reescritas no padrão atual: `Campo`, `CampoTexto`, `Botao`, `FeedbackAcao`, `useAcaoCliente`, `useChaveIdempotencia`, `EstadoVazio` e `VoltarPara`. Entraram nos manifestos de botões, campos e estados vazios, e a correção entrou na trilha. "Rejeitar correção" usa a variante `perigo`.
  - O histórico da Q157 usa o fuso da escola como referência, com aviso quando ele não está configurado. A #62 fixava `"UTC"`.
  - Não entra o perfil de teste `claude` da #62.
  - `decisoes-2026-09-21.md` continua fora do main. Nenhum lote o trouxe ainda.
- **Testes novos além dos da #62:**
  - Integração da Q164 com o schema completo, que a #62 não tinha: a recusa sem nota oficial, a confirmação idempotente, o fechamento sem a pendência, o histórico preservado e o guard SQL.
  - Integração da Q157 recusando a retirada de dia com compensação aprovada, na ação e no banco.
  - SSR das telas novas.
- **Fica para depois:** as linhas desatualizadas do quadro (ACA/Q164) e de `docs/41`, que a #164 pede para atualizar junto com o fechamento da issue.
- **Evidências** (banco descartável `erp_genius_test_q164`, perfil temporário desfeito e banco apagado ao fim):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base, nenhum em arquivo tocado).
  - `npm test`: 795 arquivos e 5.946 testes OK em UTC e em America/Sao_Paulo.
  - `npm run build`: saída 0, com as rotas do histórico de reservas e da correção.
  - `prisma migrate deploy` do zero: todas as migrations aplicadas, incluindo as duas novas.
  - Integração de avaliações (segunda chamada, agenda, remarcação, substituição, pendências e fechamento acadêmico) e de matrícula (relato, confirmação, término e correção de indisponibilidade, estado, cobertura, compensação, fonte de compensação, disponibilidade de oferta e período integral): 20 arquivos e 166 testes OK.

### Q172, follow-up da revisão da #261 (C1 e C2) e da revisão da #264 (B1, C1 a C3) — 2026-10-20

- **C1, compra depois do aditivo:** o 1º cenário `PRODUCAO_HORA_ADIANTAMENTO` agora chama `registrarCompraHorasAntecipadas` depois do pagamento de 375. A compra de 120 minutos (os da emissão) é recusada ("Os minutos, valor e cobrança precisam corresponder ao adiantamento contratado..."). A de 180 minutos (os da aplicação) é registrada com valor original 375, desconto 0, pago 375, e a memória guarda `preparacao.aplicacaoAdiantamentoAditivoId`. Os números da revisão (180 aceita, 120 recusa) são os da regra; a fixture não precisou mudar. A compra preparada exige o aceite integrado do original, e o cenário o confirma **antes** do aditivo.
- **Pendência aberta (C1 da revisão da #264), recusa da entrada depois do aditivo:** `conferirPagamentosEntradaParticular` compara a cobrança com o plano **original** das condições de entrada e ignora a `AplicacaoAdiantamentoAditivo`. Depois de aplicado o aditivo ao adiantamento, ela recusa com "A cobrança difere das condições conferidas" no **aceite** (se o aditivo vier antes dele), na **ativação** da matrícula e na consulta da entrada. O caso típico da Q172 (contrato assinado, aditivo no adiantamento ainda não pago, pagamento) fica com a ativação travada e sem caminho de regularização. Os cenários de integração desta Q contornam isso: confirmam o aceite antes do aditivo e forçam `status: "ATIVA"` via Prisma. A correção (a conferência da entrada passar a usar a última aplicação, como `conferirCompraPreparadaTx`, com teste de ativação real depois do aditivo) vai em **PR separado** e precisa entrar antes de liberar a Q172 no UAT.
- **C2 da #261 e B1 da #264, desconto de emissão e redução por aditivo:** os valores gravados na compra não mudam (`valorOriginal` da emissão, `descontoOriginal` = diferença, líquido certo no encerramento e no crédito), e o `calculoCredito` gravado nas propostas também não. Como `valorOriginal` é o preço de referência × minutos da emissão e a aplicação do aditivo não o altera, a diferença pode somar desconto de emissão e redução por aditivo. A consulta de compras carrega as `AplicacaoAdiantamentoAditivo` da cobrança até a registrada na memória e expõe `diferencaValor { valor, desconto, reducaoAditivo }` (`matricula/compra-horas-diferenca.ts`): `reducaoAditivo = clamp(valorAnterior da 1ª aplicação − valorNovo da última, 0, descontoOriginal)` e `desconto = descontoOriginal − reducaoAditivo`. O painel de compras e a memória do crédito mostram cada parcela positiva ("Desconto original" e "Redução do adiantamento por aditivo"); sem nenhuma, o desconto original como antes. `LiberacaoHoras` e `MemoriaCredito` passam a exigir as parcelas (`diferencaCompra`, sem padrão).
- **Evidências:** cenários de integração com referência igual ao negociado (125/h; aditivo 250 → 200: gravados 250/50/200, desconto 0 e redução 50) e com referência de 150/h e negociado de 125/h, 120 minutos: aditivo só de vencimento (300/50/250, só desconto 50), aditivo 250 → 280 (300/20/280, desconto 20, sem redução) e aditivo 250 → 200 (300/100/200, desconto 50 e redução 50). Testes unitários do helper e do render da memória de crédito. Banco descartável `erp_genius_test_q172g`.

### Itens restantes da #170 e pendências do #257 (C3, C5) — 2026-10-20

Branch `claude/issue-170-restante`, base `main` 8d3febe5. Nenhuma migration. Cada item entrou em TDD: o teste falhou antes da correção.

- **C13 (países):** a edição repassa o `id` de cada tipo de documento ao formulário (`PaisesPainel.tsx`). Renomear pela tela um tipo em uso deixa de virar "remover + criar", que o servidor recusava. Teste: `PaisesPainel.edicao.test.ts`.
- **#257 C5:** em `anonimizarBuscaExportacoes`, se um lote falha e o registro do evento também falha, sobe um `AggregateError` com os dois erros e `cause` = o erro do lote. Antes, o erro do lote se perdia. Falha só no lote ou só no registro continua subindo o erro como está. Teste: `anonimizar-busca-exportacoes.test.ts`, com 3 casos.
- **#257 C3:** registrado na seção da #165 acima: destino do backup com o texto (`/var/backups/erp-genius/<carimbo>/erp.dump`, retenção de 14 dias do script) e a exigência de rodar o script de novo depois de restaurar um backup anterior à execução.
- **#172 (portal do aluno):**
  - `ativar`: os campos de senha não têm mais `maxLength`, que contava caracteres, cortava em silêncio uma senha colada e deixava passar 72 letras acentuadas. O limite de 72 bytes fica com a `validarSenhas`, e o contador mostra caracteres e bytes.
  - `/api/portal-aluno/token`: a senha recusada pelo schema responde 400 com `campo: "senha"`, e a tela diz que o link continua valendo. Token malformado, link vencido e corpo ilegível continuam no 422.
  - `/portal-aluno/entrar` (doc 42 #2): credencial recusada (401), serviço fora e falha de rede têm mensagens próprias.
  - `/login` (doc 42 #3 e #5): "Esqueceu a senha? Peça a redefinição a um administrador." e "É aluno? Acesse a área do aluno".
  - `entrega-gravacao.tsx`: o envio usa o `<Botao type="submit">`, com estado ocupado.
- **C45 (abas a 375 px):** abaixo de `sm`, o `SubTabs` vira uma faixa só, rolável na horizontal (`flex-nowrap`, `overflow-x-auto`, abas `shrink-0 whitespace-nowrap`), e a aba ativa é trazida para a vista. Do `sm` para cima, as abas continuam quebrando linha. O `p-1` da faixa evita que o anel de foco seja cortado.
- **#174 (esqueleto genérico):** o `(app)/loading.tsx` lê o caminho de destino e, na primeira entrada em financeiro (abas do painel), configuração, matrícula, acadêmico ou diário, desenha o formato da área: título, cabeçalho do registro e barra de abas, sempre com um título só. Fora delas, continua o genérico. Módulo `esqueleto-area.ts` e o `EsqueletoArea` em `Esqueleto.tsx`. Testes: `(app)/loading.test.ts`. Conferido só por render no teste, não no navegador.
- **C32 (aviso ao sair):** números, setores do número, política da régua e avisos de agenda ganharam a marca "Alterações não salvas" (`AlteracaoPendente`, região `role="status"` sempre montada) e o `useAvisoAoSair`. A base é o valor salvo que chega pelas props, então salvar e esperar o `router.refresh` desliga o aviso. O kill switch não conta, porque grava na hora. Os painéis "comercial" e "régua comercial" do L2519 não existem mais no código. Testes: `alteracoes-pendentes.test.ts` e `avisos-ao-sair.test.ts`.
- **C11:** as capacidades `pagamento.caixa` e `financeiro.aprovar_acertos` (ficha financeira, movimentações e permuta) e `comissao.configurar` (`podeConfigurarComissoes`) passam a vir de `temPermissao(usuario, …)`, sem uma segunda leitura de `usuario` no banco. Testes nas três páginas e em `pode-configurar-comissoes.test.ts`.
- **C33:** "Revisar" (conferência de regra histórica) é um `<Botao type="submit" variante="secundario" tamanho="md">`, e o "limpar filtro" da fila de cobrança saiu de dentro do `<p>`. `botoes-mapa.ts` foi atualizado.
- **C50 (parte):** o `PADRAO` de `ordem-comissoes.ts` passou a ser o critério da própria coluna padrão, em vez de uma lista solta.
- **Ficam abertos:**
  - **Travas grandes:**
    - **C48:** os C7–C9 da R3 da #138, `ETAPA_LABEL`, o fornecedor cru e os badges pedem uma trava de enum nova em várias telas.
    - **C53:** exceções do `EstadoVazio` e o piso `USOS_DA_MIGRACAO_E1`.
    - **C54:** os limites de 7 travas.
  - **C19:** telemetria do `rotular` fora de `development`. Depende de escolher o destino dos eventos.
  - **C27:** título de aba fora das fichas e allow-list duplicada do guard. É uma refatoração de `titulos-registro.ts` com os guards das fichas.
  - **C45 (resto):** `secoes.test.ts` ainda lê o guard pelo fonte. Trocar exige expor os papéis do guard como dado.
  - **C46 (resto):**
    - `no-explicit-any` nos testes;
    - `testTimeout` global.
  - **C50 (resto):** `/empresas` sem volta à ordem padrão, ainda não reconferido.
  - **C52 (resto):**
    - o campo de `InformesPagamento`, que precisa ser conferido como dia ou instante;
    - `pool: "forks"`.
  - **#172:**
    - `set-state-in-effect` em `ativar/page.tsx`: o ajuste muda o arnês do teste de interação;
    - a troca de e-mail, que é operacional e precisa ser conferida no UAT antes;
    - `/login` #6: redirecionar quem já tem sessão pode entrar em laço com sessão desativada e precisa de desenho.
  - **L2019:** decisão de produto.
  - **C47 (`docker build` no CI):** fora do recorte.
- **Evidências** (banco descartável `erp_genius_test_i170`, perfil temporário desfeito e banco apagado antes do commit):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `npm test`: 799 arquivos e 5.980 testes OK em UTC e em America/Sao_Paulo.
  - `npm run build`: saída 0.
  - Integração `previsao-comissao` e `anonimizar-busca-exportacoes`: 2 arquivos e 9 testes OK.

### Q164 e Q157: comentários da review da #265 — 2026-10-20

- **Escopo:** os comentários não bloqueantes da review da #265 (C2 a C5). A #265 já está no main. Nenhuma migration aplicada foi editada.
- **C4, Q164:** o histórico de reservas só oferece realização da mesma regra de avaliação da reserva impedida (`regraId` no filtro `oficiais`). Antes, uma realização de outra regra aparecia no seletor e só era recusada ao confirmar. Teste unitário novo em `segunda-chamada-historico.test.ts`.
- **C3, Q157:** a recusa por compensação aprovada continua conservadora, como o guard SQL já aplicado. A mensagem agora:
  - nomeia o dia;
  - diz quando outro relato confirmado também cobre esse dia;
  - aponta os dois caminhos: propor uma correção que mantenha o dia, ou levar o caso à gestão financeira (Compensações por falta de oferta da escola, em Pausa, retomada e encerramento do aluno). Texto corrigido pela B1 da review da #268, abaixo.
  - Integração nova com um relato confirmado sobreposto. Um relato não confirmado no mesmo dia não é citado.
- **C2, Q157, decisão registrada:** a correção que amplia o período não confere os dias acrescentados contra a disponibilidade positiva aprovada (Q161) nem contra a cobertura futura de período integral aprovado. É o mesmo tratamento do relato novo, e a Q161 diz que a indisponibilidade prevalece. A decisão está escrita em `indisponibilidade-oferta-correcao-regras.ts`. A migration `20261020210000` já foi aplicada e por isso não recebeu o comentário.
- **C5:** a integração das duas frentes rodou com `npm run test:int` no Postgres 54329 (banco `erp_genius_test_q164`, `migrate deploy` do zero): avaliações (segunda chamada, agenda, remarcação, substituição, pendências e fechamento acadêmico) e matrícula (relato, confirmação, término e correção de indisponibilidade, estado, cobertura, compensação, fonte, disponibilidade de oferta e período integral): 20 arquivos e 167 testes OK. Também passaram `tsc --noEmit` (saída 0), `eslint . --max-warnings 40` (0 erros e 40 avisos de base) e os unitários de avaliações, matrícula e das telas tocadas (107 arquivos e 659 testes OK em UTC e em America/Sao_Paulo). O ensaio do `migrate deploy` numa cópia restaurada do UAT continua com o integrador, antes do deploy.
- **B1 da review da #268 (Q157):** a mensagem da recusa por compensação aprovada deixou de apontar a tela inexistente "Compensações da cobrança", de mandar "tratar" uma compensação aprovada (o status só vai de PENDENTE para APROVADA ou REJEITADA, sem estorno) e de afirmar que a compensação foi aprovada "com este relato" (`CompensacaoCoberturaMatricula` e `DiaCompensacaoCobertura` não guardam o relato). O texto agora nomeia o dia e a cobertura da cobrança, cita o outro relato confirmado que cobre o dia ("a correção continua recusada enquanto houver compensação aprovada nele"), diz que a compensação aprovada não é desfeita por esta tela e orienta a manter o dia ou levar o caso à gestão financeira, no painel real "Compensações por falta de oferta da escola" (`alunos/[id]/movimentacoes`, "Pausa, retomada e encerramento"). As duas integrações da C3 fixam o texto novo e recusam os trechos antigos.
- **N1 da #268:** `dataBr` passou a usar `formatarDataCivil` de `src/lib/data-civil.ts`, em vez de repetir a formatação dd/mm/aaaa.
- **N2 da #268:** as integrações da C3 continuam fora do CI. Rodaram com `vitest -c vitest.integration.config.ts` no Postgres 54329 (banco descartável `erp_genius_test_q164b`, `migrate deploy` do zero, perfil temporário revertido e banco removido): `indisponibilidade-oferta-correcao.int.test.ts`, 6 testes OK. Também passaram `tsc --noEmit` (saída 0), `eslint . --max-warnings 40` (0 erros e 40 avisos de base) e os unitários de matrícula e de `data-civil` (66 arquivos e 444 testes OK em UTC e em America/Sao_Paulo).

### Idempotência, 3º lote (#166) — 2026-10-20

- **Escopo:** 20 das ações com `idempotente: false` de maior risco de duplicação. A #166 continua aberta. Os testes de integração entraram primeiro e falharam; a implementação veio depois.
- **Criações com chave** (`repeticaoIdempotente`, marca no payload do Evento de criação, tela com `useChaveIdempotencia`):
  - Inbox: nota interna (`registrarNotaAtendimento`), convite de participante (`convidarParticipante`; o fim do convite fica fixo dentro da tentativa) e mensagem agendada (`agendarMensagemNoAtendimento`).
  - Inbox, cobrança: promessa de pagamento (`registrarPromessaPagamento`).
  - Funil: nota interna do lead (`registrarNotaInterna`) e interação (`registrarInteracao`), cada uma com executor próprio.
  - Aria: fonte de texto (`criarFonteTexto`).
  - Configuração do CRM: criar tag, campo e resposta rápida (só na criação; a edição grava o estado-alvo).
  - Financeiro: ajuste de cobrança (`ajustarCobranca`, ficha financeira e resumo comercial). A marca vai no `DescontoSolicitado` ou no `CobrancaRenegociada`/`CobrancaPerdoada` da primeira cobrança; o reenvio devolve o mesmo `aprovacao`.
- **Idempotentes por natureza** (`idempotente: true` com a justificativa no código, conferida no servidor): conferência final, original e processo de assinatura do aditivo; conferência de informe de pagamento; supervisão da Aria; distribuição/SLA do setor; configuração de IA; avisos de agenda; fuso de exibição.
- **Restam 107** `idempotente: false` fora de testes, listados no PR para o lote 4.
- **Evidências** (banco descartável `erp_genius_test_idem3`, `migrate deploy`, perfil temporário desfeito e banco apagado ao fim):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `npm test`: 790 arquivos e 5.918 testes OK.
  - `npm run build`: saída 0. A primeira tentativa parou no type-check sem mensagem, com a máquina sem memória livre; a segunda passou.
  - Integração dos módulos tocados, em 4 blocos: 28 arquivos e 276 testes OK, incluindo os 5 arquivos novos (`*-idempotencia.int.test.ts`, 24 testes), Inbox/WhatsApp, mensagens agendadas, configuração do CRM, fontes da Aria, conferência e política financeira, atraso por dia civil, retomada e reconferência de desistência. Uma rodada única com todos os arquivos passou do limite de tempo da sessão; nela, `acesso-atendimento.int.test.ts` estourou o tempo de um teste (49 s) sob carga e passou ao ser rodado de novo.
- **Correção da revisão R1 (B1–B4):** supervisão da Aria, configuração de IA, avisos de agenda e edição de tag, campo e resposta rápida gravavam um segundo Evento no reenvio. Agora o servidor compara o estado atual com o pedido e retorna sem update nem Evento quando nada mudou (como `aplicarSlaSetor`); a tela da supervisão fixa o `ate` dentro da tentativa. Cada caso tem teste de integração (duas chamadas idênticas → 1 Evento; mudança real grava). Também: arquivar resposta rápida não troca mais a chave de uma criação incerta, e a chave sem atendimento em `agendarMensagem` vira `ErroRegra`.
- **Revisão R2 (aprovada), ajustes finais:** C5, a supervisão só reaproveita o `ate` depois de resultado incerto e não depois de erro definitivo (`supervisao-tentativa.ts`, com teste); C4, comentário do `FusoExibicaoFormulario`; C2, arquivar uma resposta rápida já arquivada devolve ok, sem Evento. **Fica para o lote 4 (C3):** em `agendarMensagem` (data futura, janela, encerramento e opt-out), na nota e na promessa, a busca da repetição roda depois das validações, e um reenvio tardio recebe erro em vez do registro já feito. Não duplica nada.

### Q172, follow-up: a conferência da entrada considera o aditivo de adiantamento aplicado (#264 C1) — 2026-10-20

- **Bug de produção (vinha da #261):** `conferirPagamentosEntradaParticular` comparava `valorNegociado` e `vencimento` do adiantamento com o plano **original** das condições de entrada. Depois de um aditivo aplicado, a ativação era recusada com "A cobrança difere das condições conferidas…" (contrato assinado → aceite → aditivo → pagamento → ativação), e um aditivo aplicado antes do aceite travava o aceite. Não havia como regularizar: o aditivo já estava aplicado e a cobrança paga.
- **Correção:** a função passa a receber as aplicações (`AplicacaoAdiantamentoAditivo`) da matrícula, carregadas por `carregarAplicacoesAdiantamentoEntradaTx` (`src/server/matricula/entrada-particular-aplicacoes.ts`), nos três pontos de chamada: aceite (`contratos/aceite-estado.ts`), ativação (`matricula/ativacao-preparacao-tx.ts`) e consulta da entrada (`matricula/entrada-particular-consulta.ts`). Para a cobrança do adiantamento, a cadeia de aplicações (ordenada por `versaoCobrancaDepois`) precisa partir do valor, vencimento e minutos conferidos e ser encadeada (anterior de cada aplicação = novo da anterior); a cobrança é comparada com a **última** aplicação, como `conferirCompraPreparadaTx` já fazia. O item devolvido traz `minutos` e valor vigentes e `aplicacaoAdiantamentoAditivoId`. Sem aplicação, o comportamento e o snapshot do aceite não mudam.
- **Continua recusado:** cobrança alterada sem aditivo, cobrança que diverge da última aplicação, cadeia que não parte do conferido ou que se quebra, e aplicação apontando para cobrança que não é o adiantamento.
- **Testes:**
  - Integração (`contratos/aditivo.int.test.ts`, 3 novos): aceite → aditivo aplicado → pagamento → **ativação real** por `concluirMatricula` (sem forçar status); aditivo antes do aceite → consulta da entrada mostra 375/180 min e o id da aplicação → aceite confirmado → ativação real; negativo: valor alterado sem aditivo recusa aceite e consulta, e vencimento alterado depois do aditivo recusa consulta e ativação. Os três falhavam antes da correção com a mensagem do bug.
  - Unitário (`entrada-particular-pagamentos.test.ts`, 8 novos): última aplicação de uma cadeia de duas define valor, vencimento e minutos; recusa de valor, vencimento, origem, quebra de cadeia, minutos, aplicação na taxa e aplicação de outra cobrança.
- **Evidências** (banco descartável `erp_genius_test_q172e`, `migrate deploy`, perfil temporário desfeito antes do commit e banco apagado ao fim):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - Unitários: 793 arquivos e 5.949 testes OK em UTC e em `TZ=America/Sao_Paulo`.
  - Integração de 16 arquivos de `contratos`, `matricula`, `financeiro/politica` e `retomada` que passam por aceite, ativação, entrada ou compra de horas: `aditivo.int.test.ts` com 60 de 60 OK; nos outros 15, 291 de 293 na primeira rodada. As 2 falhas foram em `aditivo-acerto-taxa` (DCT03 e Q168), dentro da fixture e com "Erro inesperado", sob carga do Postgres compartilhado. Ao rodar o arquivo de novo, passaram 53 de 53.

### Follow-ups da #262 (escopo comercial × SQL, índice de Evento) e da #269 (fundo sutil sobre a página) — 2026-10-20

- **#262, C2 das duas revisões:** comentário em `escopoComercialAtual` (`src/server/_shared/escopo-comercial.ts`) avisa que o funil e a carteira traduzem esse `where` para SQL em `crm/oportunidade-sql.ts`, que só aceita as três formas atuais e recusa as outras. Quem mudar o escopo tem de atualizar o tradutor.
- **#262, trava do formato:** `src/server/crm/escopo-comercial-sql.test.ts` roda o `escopoComercialAtual` real (com o banco simulado) para todas as 256 combinações de papéis, com e sem equipe ou cobertura, e para o usuário sem id. Confere que cada resultado é uma das três formas (`{}`, `{ id: "__sem_acesso__" }`, `{ vendedorDonoId: { in: [...] } }`) e que `whereOportunidadeEmSql` o traduz. Teste de mutação: devolver `{ OR: [...] }` no escopo derruba 2 testes.
- **#262, índice `Evento(agregadoTipo, agregadoId, criadoEm)`: criado** (migration `20261020400000_evento_agregado_criado_em_idx`, com `@@index` no schema). Medido com `EXPLAIN ANALYZE` numa base sintética (banco descartável `erp_genius_test_fu262`). Os números são medianas de 5 rodadas numa máquina compartilhada, então há ruído.
  - Base com 100 mil oportunidades e 800 mil Eventos de Lead (mais 500 mil de outros agregados). O ganho aparece nos perdidos com período (`MAX` sem filtro de tipo, só no índice): admin de ~295 para ~130 ms, vendedor de ~21 para ~15 ms. No funil "tempo" e na carteira, a diferença ficou dentro do ruído.
  - Com timeline longa (mais 500 mil Eventos nos 2.500 leads de um vendedor, ~200 por lead):
    - perdidos do vendedor: de ~89 para ~24 ms;
    - perdidos do admin: de ~754 para ~128 ms;
    - carteira do vendedor: de ~307 para ~140 ms;
    - funil "tempo" do vendedor: de ~102 para ~70 ms;
    - funil "tempo" do admin: de ~607 para ~348 ms.
  - O plano passa a usar `Index Only Scan Backward` (sem filtro de tipo) ou `Index Scan Backward` + `Limit 1` (com filtro de tipo).
  - Custo: 70 MB de índice para 1,8 milhão de Eventos (o antigo `(agregadoTipo, agregadoId)` ocupa 23 MB) e ~3 s de `CREATE INDEX`. **O `CREATE INDEX` trava a escrita em `Evento`, então o deploy deve rodar fora de pico.** O projeto não tem precedente de `CONCURRENTLY` nas migrations, então fica o `CREATE INDEX` comum.
  - O índice antigo virou prefixo do novo. Removê-lo fica para outra PR.
- **#269, follow-up do ponto 1:** conferi pelo JSX (árvore de ancestrais no arquivo e nos importadores) cada fundo `bg-gray-50`/`bg-surface-muted` sem borda em `src/app` e `src/components`.
  - Nenhum layout envolve as telas em superfície branca. Os blocos das telas operacionais são `rounded border` sem fundo.
  - **Trocados para `bg-gray-100`, que ficavam direto sobre a página:** 48 classes em 34 arquivos. São as caixas `rounded bg-gray-50 p-3/p-4`, os `pre` de payload `p-2`, os `thead` das tabelas com wrapper só de borda, a linha expandida de PaisesPainel, a célula intermediária do mapa de calor de AbaConversas e o item de mensagem da AgendaTarefas.
  - Os `thead` e a AgendaTarefas tinham sido dados como "dentro de cartão" no #269, mas não estão.
  - **Mantidos:**
    - dentro de `bg-surface`: MudancasAcademicasPainel 2×, AcessoAulasPainel, SecretariaPainel, FichaEmpresa (2 `thead`), CartaoOportunidade, HomeProfessor e o tom neutro de `/pagar`;
    - dentro de `Modal`: ImportarAlunosModal 2× e ImportarTurmasModal;
    - o próprio `<main>` do portal do aluno;
    - um comentário em `Aviso.tsx`.
  - A trava `fundo-sobre-pagina.test.ts` saiu da Aria e foi para `src/app/`. Agora varre `src/app` e `src/components`, ignora comentários e só aceita fundo sutil sem borda nos arquivos da lista conferida (arquivo, quantidade e motivo). Também acusa sobra na lista. Teste de mutação: voltar uma caixa da ReposicoesEquipe para `bg-gray-50` derruba a trava.
- **Verificação:** banco descartável `erp_genius_test_fu262`, `migrate deploy` do zero, perfil temporário desfeito e banco removido ao fim.
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `npm test`: 815 arquivos e 6.091 testes OK em UTC e em America/Sao_Paulo.
  - Integração de `src/server/crm`: 31 arquivos e 277 testes OK.
  - `npm run build`: saída 0.
  - A migration nova aplica com `migrate deploy`, e o `migrate diff` não mostra divergência em `Evento`.

### Q172-R: robustez da conferência da entrada com aditivo de adiantamento (reviews da #270) — 2026-10-20

- **Versões na cadeia (`entrada-particular-pagamentos.ts`):** cada aplicação precisa ter `versaoCobrancaDepois = versaoCobrancaAntes + 1`, nenhuma pode partir de versão anterior à deixada pela aplicação precedente (`antes ≥ depois anterior`), e a cobrança atual não pode estar em versão anterior à da última aplicação (`c.versao ≥ depois da última`). Qualquer violação recusa com a mesma mensagem de divergência.
- **Não adotado (de propósito):** a igualdade estrita sugerida (`antes = depois anterior` e `c.versao = depois da última`). O pagamento (`financeiro/recebimentos.ts`) e outras alterações legítimas (pausa/retomada, liquidação etc.) incrementam `versao` sem mudar valor e vencimento; a igualdade quebraria a ativação depois de pagar o adiantamento, que é o fluxo normal coberto pelas integrações de ativação real. A versão da cobrança na emissão também não é gravada (memória e `ItemEmissaoEntrada` não a guardam), então a primeira aplicação não é ancorada. Valor, vencimento e minutos continuam sendo a conferência principal.
- **Loader (`entrada-particular-aplicacoes.ts`):** filtra `decisao.aprovada = true`, repetindo a regra do trigger `guardar_aplicacao_adiantamento_172` como defesa em profundidade, e passa a carregar `versaoCobrancaAntes`.
- **Quadro:** a contagem do `aditivo.int.test.ts` na entrada da Q172 foi corrigida (64 de 64 depois do merge com a `main`).
- **Testes:** unitário (`entrada-particular-pagamentos.test.ts`, 4 novos): versão avançada entre aplicações e depois da última (pagamento) é aceita; recusa salto de versão, versão sobreposta e versão atual anterior à da última aplicação.
- **Evidências** (banco descartável `erp_genius_test_q172r`, `migrate deploy`, perfil temporário desfeito antes do commit e banco apagado ao fim):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - Unitários: 814 arquivos e 6.097 testes OK em UTC e em `TZ=America/Sao_Paulo`.
  - Integração: `contratos/aditivo.int.test.ts` e `matricula/ativacao.int.test.ts`, 69 de 69 OK (inclui aceite → aditivo → pagamento → ativação real e o aditivo antes do aceite).

### Índice redundante de `Evento` e detector de fundo sem borda respeitando strings — 2026-10-20

- **Índice (`prisma/schema.prisma`, migration `20261020410000_remover_indice_evento_redundante`):** sai `Evento_agregadoTipo_agregadoId_idx` (`@@index([agregadoTipo, agregadoId])`), que virou prefixo de `Evento_agregadoTipo_agregadoId_criadoEm_idx` (#271). A migration tem um único comando, `DROP INDEX CONCURRENTLY IF EXISTS "Evento_agregadoTipo_agregadoId_idx";` (não trava escrita em `Evento`).
  - Conferido antes: nenhuma constraint usa o índice (`pg_constraint.conindid` de `Evento`: PK e as três FKs que apontam para `Evento.id`, todas sobre `Evento_pkey`); não há `@@unique` nem FK em `agregadoTipo`/`agregadoId`; as consultas por `(agregadoTipo, agregadoId)` ou só `agregadoTipo` (Prisma e SQL em `crm/`, `relatorios/`, `metas/`) usam o prefixo do índice novo.
- **Detector (`src/app/fundo-sobre-pagina.test.ts`):** os literais de string passam a sair do parser do TypeScript (TSX) em vez de regex que apagava `/* … */` sem olhar strings; um `/*` dentro de string (glob, ex. `"src/app/*.tsx"`) apagava tudo até o próximo `*/` e escondia classes. Resultado idêntico ao do detector antigo nos 598 `.tsx` atuais (comparado arquivo a arquivo). Teste novo (glob + URL antes da classe) falha com o filtro antigo e passa com o novo; mais um caso de comentário de bloco.
- **Evidências** (banco descartável `erp_genius_test_evi`, apagado ao fim):
  - `migrate deploy` do zero: todas as migrations OK; `Evento` fica com `pkey`, `agregadoTipo_agregadoId_criadoEm`, `criadoEm`, `tipo` e `idempotencia`.
  - `migrate diff` banco × schema: nada sobre índices de `Evento` (só o drift antigo de nome/ação das FKs de `AvisoAlteracaoAgenda`/`PendenciaAvisoAgenda`, que já existia).
  - `tsc --noEmit`: saída 0. `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - Unitários: 815 arquivos e 6.104 testes OK em UTC e em `TZ=America/Sao_Paulo`.
  - `next build`: saída 0.

### Port da #62, lote 3: Q175, aula que não devia ser cobrada (#164) — 2026-10-20

- **Decisão:** a de 21/09/2026 (PR #62, `decisoes-2026-09-21.md` e `q175-desenho-tecnico.md` daquela PR), reconfirmada pelo dono em 20/10/2026. Aula particular lançada como realizada ou falta cobrável que não aconteceu por motivo da escola, ou foi lançada por engano, tem o valor zerado.
- **O que entrou (reimplementado sobre o `main`, sem cherry-pick cego, a partir dos commits `5f2b7de0` e `85938ed7` da #62):**
  - Migration `20261020500000_correcao_aula_nao_cobravel` (era `20260921040000`): `AplicacaoRevisaoFinanceiraCorrecaoAula`, `OrigemCreditoRevisaoCorrecaoAula` e `CreditoMatricula.origemRevisaoCorrecaoAulaId` (oitava origem de crédito); fotografia `q23_fotografia_nao_cobravel_175` com o efeito calculado no banco; guards; trigger diferido que exige o acerto na mesma publicação. Redefine `q23_foto_financeira_valida_257`, `q165_delta_reconhecimento_guard_249`, `credito_matricula_origem_unica_check` e `PropostaRevFinCorrecaoAula_tipo_check` copiando a definição vigente (idêntica no `main` e na base da #62) e acrescentando o ramo novo.
  - Migration `20261020510000_estorno_consumo_horas_nao_cobravel` (era `20260921050000`): `EstornoConsumoHorasCompradas`, ramo `DEVOLVE_MINUTOS` da fotografia; `proteger_reserva_horas_compradas` e `conferir_liquidacao_horas_acerto` (vigentes copiadas) ignoram consumo estornado.
  - IDs conferidos: o lote Q164/Q157 (#265, já no `main`) usa `20261020200000` e `20261020210000`; as duas da Q175 vêm logo depois (`20261020220000`/`230000`, renomeadas na R1).
  - Servidor: `financeiro/revisao-correcao-aula-aplicacao-tx.ts` (aplicação dentro de `aprovarCorrecaoAula`), tipo explícito em `revisao-correcao-aula.ts`, destinação `NAO_COBRAVEL_CORRECAO` no fechamento de horas, estorno conhecido por compra de horas, reserva, encerramento e desistência.
  - Tela de revisões financeiras de correção de aula, no padrão atual (`formatarMoeda`, `CampoTexto`, `FeedbackAcao`): escolha do tipo entre os que o banco comprova, efeito descrito e botão "Aprovar declaração de aula não cobrável". Painel de compras de horas mostra os minutos devolvidos.
- **Regras:**
  - A declaração é feita na revisão financeira; o encontro continua `MINISTRADO` (opção A).
  - O valor vai a zero numa operação só, junto com a publicação acadêmica (trigger diferido).
  - Aprovação financeira (outra pessoa do Financeiro) e pedagógica (gestão) separadas; a financeira sozinha não move valor.
  - Cobrança aberta é reduzida, ou cancelada quando chega a zero; cobrança paga continua quitada e gera crédito na matrícula; aula paga com horas pré-pagas devolve os minutos à mesma compra.
  - Fora: duração errada e `IMPEDIDO_POR_RESTRICAO`. Pagamento parcial, crédito, permuta, pausa, acerto ou comprovante a conferir fazem a fotografia recusar.
  - A comissão não é recalculada.
- **Diferenças em relação à #62:**
  - Na #62 a revisão `AULA_NAO_COBRAVEL` não passava no esquema da fotografia Q92 da tela (sem `fundamento`): mostrava "fotografia indisponível" e só oferecia rejeitar. Aqui ela tem esquema e botão próprios.
  - Painel de compras de horas descreve a reserva com consumo estornado e soma os minutos devolvidos.
- **Evidências:**
  - Integração nova: em `matricula/condicoes-horas.int.test.ts`, os 3 cenários da #62 (aula não fechada, cobrança aberta cancelada, cobrança paga → crédito) e 3 novos (cobrança de duas aulas reduzida e ainda aberta; aprovações separadas; comissão inalterada); em `matricula/q23-consumo-horas.int.test.ts`, o cenário de horas pré-pagas da #62. Todos conferem o encontro `MINISTRADO`.
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=6144): saída 0.
  - `eslint . --max-warnings 40`: saída 0, com 40 avisos de base.
  - `npm test` em UTC e em America/Sao_Paulo: 793 arquivos e 5.939 testes em cada fuso.
  - `npm run build`: saída 0. Duas tentativas anteriores pararam em "Failed to type check" por falta de memória (outros `tsc` na máquina; um `tsc` paralelo foi morto pelo OOM).
  - `prisma migrate deploy` do zero no banco isolado `erp_genius_test_q175`: 469 migrations. No `migrate diff` banco × schema, nenhuma linha dos objetos da Q175.
  - Integração de `src/server/matricula`, `financeiro` e `diario` no `erp_genius_test_q175`, depois do merge da `main` com o #261: 67 arquivos e 617 testes verdes (inclui os 7 cenários da Q175). Ficaram de fora 2 arquivos e 3 testes de homologação de UI, condicionais por ambiente.
- **Fora deste lote:** Q173, Q171 e a origem histórica, nesta ordem.
- **Pendência operacional:** fazer backup e ensaiar o `migrate deploy` numa cópia do UAT antes do deploy.

#### Q175: correções da R1 (duas reviews da #266) — 2026-10-20

- **Base:** merge do `origin/main` (com #263, #264 e #265), sem rebase. Em `compra-horas.ts` e `ComprasHorasPainel.tsx` ficaram os dois lados: `diferencaValor`/`aplicacoes` e os rótulos de desconto e redução por aditivo da #264, e `consumo.estorno`, `minutosEstornados`, `minutosDisponiveis` sem o estornado e `resumoMinutosCompra`/`situacaoReserva` da Q175.
- **Migrations renomeadas** para `20261020220000`/`20261020230000`, depois das `20261020200000`/`210000` da #265 (não foram aplicadas em lugar nenhum).
- **Fechamento por hora (tela):** o esquema `Memoria` aceita `NAO_COBRAVEL_CORRECAO` em `preservados`, com rótulo próprio. Antes, a versão aparecia como "Memória incompatível" e o botão Emitir sumia.
- **Encerramento por hora:** `conferirAgendaEncerramentoTx` reconhece a aula declarada não cobrável ainda não fechada (efeito `SEM_ITEM`) como destinação `NAO_COBRAVEL_CORRECAO` com `aplicacaoId`. Antes, ela ficava como pendência sem saída e o encerramento travava.
- **Reconferência delta da desistência:** `q165_fotografia_delta_atual_255` (SQL) passa a incluir `origemRevisaoCorrecaoAulaId` quando o crédito tem essa origem, como a fotografia em TS. Antes, a matrícula com crédito Q175 caía em "Fotografia posterior delta não corresponde integralmente ao ledger".
- **Banco:** o trigger `recusar_item_nao_cobravel_175` recusa `ItemFechamentoHoras` para conferência com aplicação Q175.
- **Tela de ocorrências:** a conferência com declaração de não cobrável avisa que o valor exibido é histórico e diz qual foi o efeito.
- **Evidências:**
  - `tsc --noEmit`: saída 0. `eslint . --max-warnings 40`: saída 0 (40 avisos de base).
  - `npm test` em UTC e em America/Sao_Paulo: 811 arquivos e 6.060 testes em cada fuso.
  - `prisma migrate deploy` do zero no `erp_genius_test_q175b`: 471 migrations. No `migrate diff` banco × schema, nenhuma linha dos objetos novos da Q175.
  - Integração de `src/server/matricula`, `financeiro` e `diario` no `erp_genius_test_q175b`: 68 arquivos e 623 testes verdes. Ficaram de fora 2 arquivos e 3 testes de homologação de UI, condicionais por ambiente. Entre os testes estão o novo cenário de encerramento e trava do item e a comparação entre a fotografia delta em TS e a do banco com crédito Q175.
  - `npm run build`: saída 0. A primeira tentativa parou em "Failed to type check" por falta de memória, enquanto a integração rodava em paralelo.
  - Depois dos merges seguintes do `main` (#267, #269, #270, #271 e #272; conflito só no quadro): `tsc` e `eslint` com saída 0; `npm test` com 816 arquivos e 6.101 testes em cada fuso; integração de `condicoes-horas`, `q23-consumo-horas`, `desistencia-reconferencia-delta` e `indisponibilidade-oferta-correcao` com 4 arquivos e 55 testes verdes; `npm run build` com saída 0.
- **Não alterado:**
  - O aditivo continua contando consumo estornado. O caso não chega a ele: só existe consumo com compra de horas, e a compra já faz o aditivo recusar.
  - A cobrança cancelada por redução a zero continua sem coluna `canceladaPor*`. A origem está em `AplicacaoRevisaoFinanceiraCorrecaoAula.cobrancaId`.

- **Migrations renomeadas de novo** para `20261020500000`/`20261020510000` (R2): o UAT já aplicou `20261020400000` (#271, deploy automático), e `220000`/`230000` rodariam fora de ordem. Também ficam depois de `20261020410000` (#273). Nenhuma foi aplicada em lugar nenhum.

### Docs da #164: decisões de 21/09 na `main` e linhas antigas do quadro atualizadas — 2026-10-20

- **O que muda:** só documentação. Nenhum código, schema ou migration.
  - `docs/planejamento/decisoes-2026-09-21.md` vem da branch da #62 (`db854944`), com o texto das decisões intacto. Ganhou a seção "Situação na `main` em 20/10/2026", conferida em `origin/main` `90a34cce`, e o aviso de que as notas de implementação descrevem a #62.
  - Linhas antigas atualizadas: "Vencimento no caixa", Q165 (duas tabelas), Q167 (duas tabelas), DCT03, ACA e o parágrafo que as marcava como desatualizadas; doc 41 (Q164 e ciclo de agenda da segunda chamada) e doc 04 §2 (validadores).
- **Na `main`:** Q176 (#239, #243, #247, #253, #255), validadores, Q174 e Q161 (#260), Q172 (#261, #264, #270, #272), Q164 e Q157 (#265, #268), Q175 (#266).
- **Fora da `main`:** Q173, Q171/Q167C, origem contratual histórica, port da assinatura (driver simulado) e fuso pessoal nas telas restantes. A #164 continua aberta.
- **Divergências e recortes entre as decisões e o código** (registrados no documento, sem mudança de código):
  - Q176: sem fuso configurado, a `main` usa `America/Sao_Paulo`; a nota de 21/09 falava em manter o cálculo legado.
  - Q175: a decisão diz que cobrança paga gera crédito; a fotografia recusa pagamento parcial, crédito, permuta, pausa, acerto ou comprovante a conferir.
  - Q174: a recusa vale na preparação e não tem guard SQL; propostas de `REGIME` anteriores ainda podem ser decididas.
  - Q172: comissão não recalculada (base = taxa de matrícula). Isso foi lido no código e não está nas decisões de 21/09.
- **Não conferido:** se as migrations de 20/10 já foram aplicadas no UAT (só no painel do Coolify).

#### Follow-ups das reviews da #266 (R2) e da #272 — 2026-10-20

- **C1 da #272 (defesa em profundidade):** `compra-horas.ts` (consulta das compras) e `compra-horas-preparacao.ts` (`conferirCompraPreparadaTx`) passam a filtrar `aplicacaoAdiantamentoAditivo` por `decisao.aprovada = true`, igual ao loader da entrada (`entrada-particular-aplicacoes.ts`). Dado legítimo não muda de resultado: o trigger `guardar_aplicacao_adiantamento_172` já recusa aplicação sem decisão aprovada.
- **N3 da R2 #266:** novo teste de integração em `matricula/condicoes-horas.int.test.ts`. A declaração de aula não cobrável é rejeitada pela segunda alçada e não nasce aplicação, então a trava `recusar_item_nao_cobravel_175` não alcança a aula. O fechamento do mês fatura a aula normalmente (item de 156,25, cobrança não cancelada, sem crédito).
- **N2 da R2 #266:** a migration `20261020520000_q165_fotografia_origem_correcao_aula` redefine `q165_fotografia_atual` com as duas origens de crédito que o TS (`fotografiaQ165`) já incluía: `origemReconferenciaDeltaDesistenciaId` (assimetria anterior à Q175) e `origemRevisaoCorrecaoAulaId`. Cada chave só aparece quando existe, no mesmo padrão de `q165_fotografia_delta_atual_255`. O corpo foi copiado da definição vigente (`20260917166000`, que nenhuma migration posterior redefine). No `diff -w` contra ela, as únicas diferenças são as duas linhas `|| CASE WHEN cr."origem..." ...`.
  - Os dois casos não são alcançáveis pelo fluxo. O crédito delta só nasce depois de uma Q165 aplicada. O crédito Q175 exige aula ministrada, e a Q165 exige matrícula não ativada.
  - Por isso o teste novo (`desistencia-acerto-contratual.int.test.ts`, "fotografia Q165 Node/SQL coincide com crédito de …", um caso para cada origem) cria o crédito com os triggers desligados (`session_replication_role = replica`), só dentro de uma transação que é desfeita no fim.
  - Sem a migration, os dois casos falham com "Fotografia financeira vigente diverge da proposta"; com ela, passam.
- **Evidências** (banco isolado `erp_genius_test_fu266`, removido depois):
  - `prisma migrate deploy`: aplicou a migration nova sem erro.
  - `tsc --noEmit`: saída 0. `eslint . --max-warnings 40`: saída 0 (40 avisos de base).
  - `npm test` em UTC e em America/Sao_Paulo: 817 arquivos e 6.112 testes em cada fuso.
  - Integração de `compra-horas*`, `*aditivo*`, `desistencia-*` e `condicoes-horas`: 17 arquivos e 282 testes verdes. Ficaram em skip 3 arquivos e 4 testes de homologação de UI, condicionais por ambiente.
  - `npm run build`: saída 0.
- **Ramo da reconferência delta acrescentado** (a pedido da coordenação, antes do merge), com o caso correspondente no teste TS = SQL. Banco descartável no estado da `main` + `migrate deploy`: aplicou a `20261020520000` sem erro. `tsc`: saída 0. Unitários de `desistencia*` e `compra-horas*` em UTC e em America/Sao_Paulo: 12 arquivos e 84 testes em cada fuso. Integração `desistencia*`: 10 arquivos e 86 testes verdes. Ficaram em skip 2 arquivos e 3 testes de homologação de UI.

### Idempotência, 4º lote (#166) — 2026-10-20

- **Escopo:** criações sem guarda (as que duplicavam registro ou Evento) e o C3 da R2 do #267. A #166 continua aberta. Os testes de integração entraram primeiro e falharam contra o servidor de `main` (20 de 21; o que passou é trava de regressão); a implementação veio depois.
- **C3 do #267:** em `agendarMensagem` (pelo atendimento), `registrarNotaAtendimento` e `registrarPromessaPagamento`, a busca da repetição vem antes das validações de estado (data futura, janela, encerramento, opt-out, escopo, situação da cobrança). O reenvio tardio da mesma tentativa devolve o registro já feito em vez de erro. Chave nova continua passando por todas as validações.
- **Criações com chave** (`repeticaoIdempotente`, marca no payload do Evento de criação, tela com `useChaveIdempotencia`):
  - Inbox: abrir atendimento (`abrirAtendimentoInstitucional`, marca no `AtendimentoInstitucionalAberto`; busca antes das validações de destino e de novo dentro da transação).
  - Configuração: criar turma (`criarTurma`, `TurmaCriada`).
  - Empresas: criar empresa (`salvarEmpresa` sem `id`, `EmpresaCriada`). Na edição, o mesmo cadastro não grava outro `EmpresaEditada`.
- **Idempotentes por natureza, com mudança no servidor** (o reenvio não grava registro, Evento nem envio de novo):
  - Funil, documentos: anexar o mesmo upload (a URL é única por envio) devolve o documento já anexado; com outro nome, recusa. Arquivar o já arquivado devolve ok.
  - Inbox, criar oportunidade pela conversa: a conversa já vinculada devolve a mesma oportunidade, com o mesmo `criado` do vínculo de quem repete; trava do atendimento serializa o clique duplo.
  - Financeiro, política de comissão: a última versão já é exatamente a pedida, do mesmo autor → ok, sem nova versão (a checagem vem antes da de vigência).
  - Aria: salvar (rascunho com a mesma configuração e a mesma base), publicar (o rascunho aberto já foi publicado por quem repete, com a mesma nota) e descartar (já descartado por quem repete). `travarAgente` passou a criar a linha com `ON CONFLICT DO NOTHING`: o `upsert` colidia na chave única com dois salvamentos simultâneos no primeiro uso.
  - Portal do aluno (ficha): pendência de e-mail registrada uma vez; troca pendente idêntica do mesmo autor devolvida (antes caía no índice de troca pendente única); a mesma decisão da troca, do mesmo decisor e com o mesmo motivo, devolvida.
- **Correções da R1 (#274):**
  - B1, convite do portal do aluno: sem chave, o reenvio só era reconhecido enquanto o envio estava `PREPARADO`; se o cron despachasse no intervalo, o reenvio preparava outro convite, e o despacho seguinte revogava o link do primeiro (dois e-mails, primeiro link morto). `prepararConvitePortalAluno` passou a receber chave (`repeticaoIdempotente`, marca no `ConvitePortalAlunoPreparado`, hash de `{alunoId}`, busca antes das validações de estado): o reenvio da mesma tentativa devolve o convite original mesmo despachado ou com a conta já ativada. Quando a tentativa reaproveita um envio ainda preparado, o Evento é gravado com `reaproveitado: true` para guardar a marca. A tela usa `useChaveIdempotencia`; um novo clique depois do sucesso é reemissão deliberada (chave nova, novo convite, como antes).
  - N1: em `agendarMensagem` pelo atendimento, sem repetição, o escopo (`atendimentoVisivel`), o encerramento, o número e o opt-out vêm antes das validações de horário e janela. Quem não vê o atendimento recebe "Atendimento não encontrado." para id existente ou inexistente.
  - N2 / C3 da outra R1: a decisão aprovada repetida busca o `TrocaEmailPortalAlunoAplicada` pelo `decisaoId` (antes, o mais recente do aluno) e devolve `solicitacaoEnvioId: null`, não `""`, se não o achar. Nenhuma tela lê o campo.
  - N3, pendente para o próximo lote: se outra pessoa rejeitar a troca de e-mail (ou a retomada) entre a tentativa e o reenvio, o reenvio abre uma nova solicitação (na troca, com novo e-mail de validação). Sem chave, o servidor não distingue esse reenvio de uma nova solicitação deliberada com o mesmo texto. A correção é a mesma do B1: chave em `prepararTrocaEmailPortalAluno` (marca no `TrocaEmailPortalAlunoPreparada`) e na proposta de retomada. A janela é estreita e o comportamento é o de antes deste lote.
- **Idempotentes por natureza, só na tela** (conferido no servidor): emissão do fechamento por hora (uma por decisão), registro e revogação de autorização de comunicação acadêmica (sem Evento), evidência e decisão de envio incerto do portal, proposta e decisão de retomada.
- **Restam 94** `idempotente: false` fora de testes (eram 108), listados no PR para o próximo lote. Ficaram de fora deste lote, por já estarem protegidas por chave única (o reenvio falha em vez de duplicar): `PaisFormulario` e `UsuarioFormulario`. `AgendaTarefas` reagenda com versão (não cria).
- **Evidências** (banco descartável `erp_genius_test_idem4`, `migrate deploy`, perfil temporário desfeito e banco apagado ao fim):
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `npm test`: 814 arquivos e 6.085 testes OK em America/Sao_Paulo. Em UTC, a rodada completa apontou os 5 arquivos que fixavam o comportamento antigo (mensagem "sem chave", `idempotente={false}` e o mock da promessa); atualizados, passam em UTC (8 arquivos, 59 testes). A trava `crm-config/auditoria.test.ts` passa.
  - `npm run build`: saída 0.
  - Integração dos módulos tocados, em 4 blocos (comercial, cobranças, empresas, turmas, Aria, política da secretaria e regra de turma; financeiro e portal do aluno; CRM e Inbox; WhatsApp): 133 arquivos e 1.029 testes OK, incluindo os 7 arquivos novos (`*-idempotencia.int.test.ts`) e os casos de reenvio tardio do C3. Na rodada em bloco, `crm/ficha-dados.int.test.ts` (mesclagem, não tocada) estourou o tempo de 2 testes com o build rodando junto e passou ao ser repetido sozinho; `whatsapp/linha-comercial.int.test.ts` (LC-06) fixava "segundo clique é recusado" e passou a fixar o mesmo lead devolvido sem outro vínculo.


### SLA: feriados no prazo da 1ª resposta — 2026-10-21

Branch `claude/sla-feriados`, base `main` e68adb37. Continua o SLA do #241 ("horário por setor; feriados depois", D2 do plano `docs/superpowers/plans/2026-10-19-sla-completo.md`).

- **Sem cadastro novo:** o sistema já tem o calendário escolar institucional (`VersaoCalendarioEscolar`, períodos `FERIADO`/`RECESSO`/`FERIAS`, versão global aprovada por outra pessoa, tela em Acadêmico › Calendário, âncora `calendario-escola`). O SLA passou a consultá-lo; não há model `Feriado` nem migration. A premissa da D2 ("versionado por turma") não confere e ficou anotada no plano.
- **Cálculo** (`crm-config/horario-atendimento.ts`): `prazoVenceEm` e `dentroDoHorario` recebem `feriadosEscola` (intervalos de datas civis inclusivas). Feriado do setor (`horario.feriados`, que já existia sem tela) e feriado da escola se somam e fecham o dia inteiro, como um dia sem horário; feriado em dia sem atendimento (fim de semana) não muda o prazo. Datas civis no fuso da escola, nunca do servidor. Contagem corrida (sem horário ou `contarSoNoHorario` desligado) ignora feriados.
- **Fonte** (`crm-config/feriados-escola.ts#feriadosDaEscola`): períodos `FERIADO` da versão aprovada mais recente; pendente ou reprovada não vale; descarta os já terminados antes do dia do início. Recesso e férias não entram (são do calendário letivo). Períodos inválidos avisam no log e contam como nenhum feriado (o cálculo roda no inbound, na transação, e não lança). Sem a âncora advisory: é leitura de versões imutáveis, e travar a âncora serializaria todo inbound com a agenda. `feriadosDaEscola` entrou em `SOMENTE_LEITURA` da trava `crm-config/auditoria.test.ts`.
- **Uso:** `whatsapp/status-atendimento.ts#prazoRespostaEm` passa os feriados da escola ao `prazoVenceEm`.
- **Sem recálculo retroativo (D7):** prazos já gravados em `AtendimentoWhatsApp.prazoRespostaEm` não mudam quando um calendário com feriado novo é aprovado (ou um feriado é removido); vale para os atendimentos cujo prazo é calculado depois. Recalcular mexeria em prazos e métricas já exibidos e, por um UPDATE em massa em `AtendimentoWhatsApp`, dispararia `notificar_inbox`. Teste de integração cobre o caso.
- **Tela:** Distribuição e SLA ganhou a linha "Feriados do calendário escolar publicado (Acadêmico › Calendário) fecham o atendimento o dia todo; recesso e férias, não."
- **Perguntas ao dono (escolhido o mais simples):** recesso e férias deveriam fechar o atendimento? Feriado por setor precisa de tela (o campo existe e é respeitado, mas não é editável)? O calendário escolar é aprovado pela Gestão Pedagógica: está ok que ele valha para o SLA do Comercial e do Financeiro?
- **TDD:** unitários `crm-config/horario-atendimento-feriados.test.ts` (prazo que cruza feriado, período de vários dias, início dentro do feriado, feriado no fim de semana com e sem atendimento no sábado, setor × escola, corrido, dia civil em America/Sao_Paulo e em UTC) e integração `whatsapp/feriados-sla.int.test.ts` (aprovado vale; pendente/reprovado não; versão aprovada mais recente; recesso/férias não; setor + escola; corrido; fuso da escola America/Costa_Rica; prazo gravado não recalcula). Ambos vermelhos contra o código da `main` antes da implementação (13 de 15 unitários, 5 de 9 de integração; os que passavam são as guardas de "não pular").
- **Evidências** (Postgres 16 descartável na 54329, banco `erp_genius_test_slaf` com `migrate deploy` do zero, perfil temporário desfeito, banco e cluster apagados ao fim):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=8192): saída 0.
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base).
  - `vitest run` completo: 818 arquivos, 6.128 testes OK em TZ=UTC e em TZ=America/Sao_Paulo.
  - Integração de `src/server/{whatsapp,crm-config,inbox,agenda,relatorios}`: saída 0, 92 arquivos, 718 testes.
  - `npm run build`: saída 0.


### Deploy: repasse das variáveis de ambiente ao app e agendadores do portal e da agenda — 2026-10-21

Branch `claude/compose-env-repasse`, base `main` 80ba5d88. Bug de deploy: o `environment` do serviço `app` em `docker-compose.coolify.yml` (e em `docker-compose.prod.yml`) só citava 11 variáveis; as demais lidas pelo código, definidas no painel do Coolify ou no `.env` da VPS, não chegavam ao container.

- **Repasse** (dois composes): `RESEND_API_KEY`, `EMAIL_INSTITUCIONAL_REMETENTE`, `PORTAL_ALUNO_URL_PUBLICA`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY`, `DRIVE_ORGANIZACAO_ID`, `GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_DRIVE_PUBLICACAO_SERVICE_ACCOUNT_PRIVATE_KEY` com `${VAR:-}`; `EMAIL_PORTAL_ENVIO_ENABLED`, `CONTINUIDADE_MENSAL_EMISSAO_ENABLED`, `COMUNICACOES_AGENDA_ENVIO_ENABLED`, `COMUNICACOES_AGENDA_QUANTIDADE_ENVIO_ENABLED` com `${VAR:-false}`. Nenhuma virou obrigatória.
- **Agendadores novos** (dois composes, mesmo padrão de `cron`/`cron-despacho`): `cron-portal-envios` (POST `/api/portal-aluno/envios/cron` a cada 60 s) e `cron-avisos-agenda` (POST `/api/agenda/avisos/cron` a cada 5 min; sem cadência definida em código/docs, ficou a da régua). Conferido no código: com a flag diferente de `"true"`, as duas rotas respondem `{executou:false}` logo após conferir o `x-cron-secret`, sem tocar o banco (coberto pelos `route.test.ts` existentes).
- **Pendência:** `/api/financeiro/continuidade/cron` continua sem agendador nos composes (documentado no compose, nos envs de exemplo e no SETUP.md); ligar `CONTINUIDADE_MENSAL_EMISSAO_ENABLED` exige agendador externo.
- **Healthcheck do motor: não adicionado.** O repo não tem a imagem do motor (`MOTOR_IMAGE` externa): não dá para saber se ela traz `wget`/`curl` nem qual rota de saúde expõe (`/v1/health` aparece só num teste do cliente, como caminho arbitrário).
- **Observações:** `PAGAMENTO_SIMULADO` não é lida por nenhum código atual (só comentários); mantida no compose. `.env.example` reorganizado com `[obrigatória]`/`[opcional]` e sem o bloco duplicado do motor (o segundo `MOTOR_URL="http://motor:4317"` sobrescrevia o de dev). `SETUP.md §Coolify` ganhou as variáveis novas.
- **Trava** (`src/deploy/compose-env.test.ts`): varre `src` (`process.env.X`, `process.env["X"]`, `ambiente.X`, `env.X`) e exige cada variável de produção no `environment` do `app` dos dois composes, flags `*_ENABLED` com `:-false`, e a variável listada em `.env.example` e `deploy/env.production.example` (fora as montadas pelo compose: `DATABASE_URL`, `NEXTAUTH_URL`, `MOTOR_URL`). Exclusão explícita: só de teste (`FAKE_PRISMA`, `GUARD`, `GUARD_GRADES`, `TZ`, `PRISMA_TESTE_TIMEOUT_MS`, `HOMOLOGACAO_UI_*`, `QA_*`; o teste falha se alguma delas for lida fora de arquivo de teste) e da imagem (`NODE_ENV`, `GIT_SHA`, conferidas no Dockerfile). Contra os composes da main, falha em 13 casos. `cron-despacho.test.ts` estendido para os dois agendadores novos.
- **Evidências:**
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base).
  - `TZ=UTC vitest run`: 819 arquivos, 6.210 testes OK (antes dos agendadores); depois deles, `src/deploy` + rotas dos dois crons: 6 arquivos, 134 testes OK.
  - `docker compose -f … config` nos dois composes: saída 0, serviços `cron-portal-envios` e `cron-avisos-agenda` presentes e flags resolvidas como `"false"`.


### Fuso pessoal nas telas restantes (1º lote: telas operacionais) — 2026-10-21

Branch `claude/fuso-pessoal-telas`, base `main` 239001ad. Pendência da Q176 ("fuso pessoal nas telas restantes, que está parcial: a #159 cobriu parte"). Só exibição: regras de negócio continuam no fuso da escola (`fusoDaEscola`, `dataCivilInstitucional`, `diaCivilGravado`) e datas civis continuam como data civil. Sem migration.

- **Helper central** (`src/server/operacao/fuso-exibicao.ts`): `formatarInstanteExibicao` ganhou o 4º parâmetro `estilo` (`dataHora`, padrão e igual ao de antes; `data`; `hora`, 24 h; `diaMesHora`), sempre com `timeZone` explícito. Novo `formatarDiaCivilGravado(valor, fusoEscola)`: data civil gravada como instante (promessa, data do pagamento) sai como o dia da escola pelo mesmo critério da régua, sem fuso pessoal.
- **Telas ajustadas:**
  - Inbox: a página entrega o fuso já resolvido (pessoal; sem ele, o da escola; antes caía em UTC); hora da lista (`ListaAtendimentos`), do balão (`BalaoMensagem`), da Aria (`PainelAria`) e de convites/agendamentos (`AcoesAtendimento`, que formatava no fuso do navegador).
  - CRM: painel da oportunidade no funil (criação, experimental, histórico no fuso pessoal; o próximo follow-up passou a sair como dia civil da escola, sem a hora 12:00), ficha do contato, histórico da Aria, chamadas da IA em Configuração › CRM › IA (`toLocaleString` sem fuso).
  - Financeiro: promessa na fila de cobrança e na ficha financeira, data do pagamento nos informes e "último pagamento" da ficha (eram `toLocaleDateString` no fuso do processo; a gravação legada à meia-noite UTC dava o dia anterior com o servidor em São Paulo); recebimento existente na conciliação da migração.
  - Aluno: data do teste de nível e da emissão do certificado (fuso pessoal), nascimento (data civil, sem `new Date`); validação pública do certificado no fuso da escola.
- **Trava** (`src/app/fuso-pessoal-telas.test.ts`): pelo AST, em todo `.ts`/`.tsx` de produção de `src/app` e `src/components` (fora `src/app/api`), acusa `toLocaleDateString`/`toLocaleTimeString` sem `timeZone`, `toLocaleString` sem `timeZone` que não é de número, `Intl.DateTimeFormat` sem `timeZone` e getters do relógio local (`getHours`, `getDate`, `getTimezoneOffset`…). Opções opacas e arquivo que não analisa contam. Exceções com motivo, uma por achado: os campos de entrada `datetime-local` da experimental (5 getters) e do diário (`getTimezoneOffset`), e a detecção do fuso do navegador no aditivo. Fora do alcance (declarado): `timeZone` presente com o fuso errado.
- **Fica para o próximo lote:** telas que já passam `timeZone`, mas com o fuso de origem/da reserva em instantes (Secretaria › Reservas, matrícula: reserva, nova reserva, ocorrências financeiras, indisponibilidade de oferta, compensações, aditivos/agenda; segundas chamadas; presença histórica da migração) — é preciso separar, uma a uma, o que é instante do que é horário publicado no fuso da agenda; e o fuso de ENTRADA dos campos `datetime-local` (agendar mensagem no Inbox, experimental, diário), que ainda leem no relógio do navegador.

### Docs do WhatsApp no estado do motor + nits da review do #279 — 2026-10-21

Branch `claude/docs-whatsapp-e-nits`, base `main` 239001ad. Só documentação e um teste de deploy.

- **Doc 30**: nota "Estado atual" no topo (Meta Cloud e Evolution fora do código; driver único `MOTOR`, `whatsapp-web-baileys` em modo serviço; `MOTOR_IMAGE`/`MOTOR_API_KEY`/`MOTOR_WEBHOOK_SECRET`; webhook `/api/whatsapp/webhook/motor`; conexão por QR ou código em Configuração › WhatsApp › Números). S1 deixa de dizer que as cadências C1/C2 saem pelo motor (não têm produtor; da D34 resta a classe reativa, hoje da Aria). Contratos: o driver único é `drivers/motor.ts`. Etapas E1/E3/E4/E5/E6 ganham o "hoje" ao lado do plano original.
- **Doc 31**: §0 (burocracia Meta) trocada pelos pré-requisitos do motor; §1 descreve os serviços reais do compose (sem banco `evolution`, com `motor` e os crons); §1.3 vira motor + pareamento; §2 marca o crontab horário da VPS como **superado** e tabela os quatro laços do compose (`cron` 5 min, `cron-despacho` 1 min, `cron-portal-envios` 1 min, `cron-avisos-agenda` 5 min); §3 com os alertas atuais de `saude.ts` (motor inalcançável, eventos falhos, driver legado); §5/§6/§7 sem Evolution, kill switch em Política da régua.
- **Doc 32**: aviso no topo de que o piloto C1/C2 **não roda no código atual** (`cron-comercial.ts` removido em 9e5d7bd3/53c69b4b; `PoliticaComercial` sem leitor em `src`; B1, B7 e B9 sumiram; restam B3 `validaAte` e o campo do B8). Status "todos implementados" marcado como superado.
- **Nits do #279** (`src/deploy/cron-despacho.test.ts`): C1 — a contagem de laços em linha única passa a ser o número de serviços `cron*` do bloco `services` (não mais `toBe(4)`); C2 — a trava recusa qualquer `command:` em bloco escalar (`>`, `>-`, `>+`, `|`, `|-`, `|+`).
- **Evidências:**
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base).
  - `vitest run src/deploy`: 4 arquivos, 131 testes OK. Mutação: um quinto serviço `cron-extra` no compose do Coolify derruba o teste (`expected 4 to be 5`); a regex casa `>`, `>-`, `>+`, `|`, `|-` e não casa `command:` em lista nem `command: npx …`.
  - Suíte de integração não rodada (máquina com carga alta; mudança só em docs e teste de deploy).

### Idempotência, 5º lote (#166) — 2026-10-21

- **Escopo:** o N3 da R1 do #274 e 12 ações que criam registro, enviam mensagem ou mexem em dinheiro. A #166 continua aberta. Os testes de integração do N3 entraram primeiro e falharam contra o servidor de `main` (6 dos 9 casos novos; os 3 da retomada que passaram em `main` cobrem o reenvio simultâneo, a chave nova e a chave de outro autor, e ficam como trava de regressão). A implementação veio depois.
- **N3 da R1 do #274** (`repeticaoIdempotente`, depois da sessão e da conferência do papel, busca antes das validações de estado, escopo por autor):
  - Troca de e-mail do portal: `prepararTrocaEmailPortalAluno` recebe chave (marca no `TrocaEmailPortalAlunoPreparada`; hash de aluno, novo e-mail normalizado, motivo e evidência). Se outra pessoa rejeitar a troca entre a tentativa e o reenvio, o reenvio devolve a solicitação original, sem nova solicitação nem novo e-mail de validação. A busca vem antes da leitura do aluno: a chave reaproveitada com outro aluno, existente ou não, recebe a mesma recusa. A ficha usa `useChaveIdempotencia`.
  - Retomada: `solicitarRetomada` recebe chave (marca no `RetomadaSolicitada`; hash de aluno, opção, motivo e datas ordenadas pela cobrança). A conferência do usuário atual passou para antes das travas do calendário, e a busca vem logo depois dela. `RetomadasPainel` usa `useChaveIdempotencia`.
  - Chave nova continua sendo nova solicitação ou proposta; sem chave, o comportamento de antes.
- **Criações com chave:**
  - Financeiro, fechar o mês das comissões (`fecharMesComissoes`): a marca vai em todos os `ComissaoPaga` do mesmo fechamento. O reenvio devolve quantas foram pagas e não paga as comissões aprovadas depois da tentativa (antes, o reenvio pagava tudo o que estivesse aprovado). O fechamento automático do cron não muda. `ConfirmarAcao` com `idempotente` e chave trocada em `aoConcluir`.
  - Matrícula nova, solicitar abertura de turma (`solicitarAberturaTurma`, marca no `AberturaTurmaSolicitada`). Antes, cada reenvio gravava outro pedido.
- **Idempotentes por natureza, com mudança no servidor.** O reenvio de quem já fez a ação devolve ok sem gravar registro nem Evento. Se o estado veio de outra pessoa (ou do contato, no opt-out), a ação segue recusada como antes. A linha do registro é travada para o clique duplo não gravar dois Eventos. Helper novo: `ultimoEventoDoAutor` (`src/server/_shared/idempotencia.ts`).
  - Comissões, estornar (`estornarComissao`): mesmo motivo e detalhe. A falha de rede da tela agora manda tentar de novo.
  - Home do professor, check-in da experimental (compareceu e faltou): o último check-in do lead é o mesmo, do mesmo autor. O escopo do professor passou para antes da etapa, então quem não está atribuído recebe sempre "não está atribuída a você".
  - Funil, marcar como perdida (`marcarPerdido`): mesmo motivo e observação. Antes, cada reenvio gravava outro `LeadPerdido`. Com outro motivo, grava como antes.
  - Configuração do CRM, arquivar tag e campo (o campo confere o nome de novo); Aria, arquivar fonte; Tarefas, cancelar (mesmo motivo, antes da conferência de versão); Carteira, revogar cobertura (já devolvia ok, mas o clique duplo gravava dois Eventos); Inbox, registrar e remover opt-out (a remoção confere a evidência).
- **Mantidas como estão, por já estarem protegidas por chave única:** envio de cobrança pelo WhatsApp, individual e em lote (`IntencaoMensagem` única por cobrança, passo e ciclo; o reenvio devolve a intenção existente ou é recusado com "sem ação devida", sem segundo envio). Ficam com `idempotente: false` porque a tela não deve sugerir repetir.
- **Restam 103 linhas** com `idempotente: false` ou `idempotente={false}` fora de testes e de `src/server` (eram 116 em `main`, na mesma contagem). Os grupos são os mesmos do PR #274. Saíram deste lote: estorno, fechamento do mês, check-in (2), perda, abertura de turma, tag, campo, fonte, tarefa, cobertura e opt-out (2).
- **Testes atualizados** porque fixavam o comportamento antigo: o reenvio do opt-out (`whatsapp/inbox.int.test.ts`) e do arquivamento de fonte (`fontes.int.test.ts`) agora devolve ok com um Evento; os mocks de `comissoes-estorno.test.ts` e `experimental.test.ts` (trava da linha) e a mensagem de resultado incerto em `HomeProfessor.confirmacao.test.ts`.
- **Evidências** (banco descartável `erp_genius_test_idem5`, `migrate deploy`; perfil temporário desfeito e banco apagado ao fim). O Postgres compartilhado foi reiniciado duas vezes durante a rodada; o banco foi recriado e as suítes, repetidas do zero.
  - `tsc --noEmit`: saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `npm test`: 817 arquivos e 6.113 testes OK em UTC e em America/Sao_Paulo. Inclui a trava `crm-config/auditoria.test.ts`.
  - `npm run build`: saída 0.
  - Integração dos módulos tocados, em 3 blocos: portal do aluno, retomada e financeiro (29 arquivos, 219 testes); comercial, CRM, configuração do CRM, turmas, acesso e Aria (66 arquivos, 607 testes); WhatsApp e Inbox (69 arquivos, 536 testes). Mais `academico/fluxo` e `matricula/limite-legado`, que também chamam `solicitarRetomada` (2 arquivos, 68 testes). Tudo OK, sem testes ignorados nos blocos.
  - Arquivos novos: `retomada/retomada-idempotencia`, `financeiro/comissoes-idempotencia`, `comercial/experimental-perda-idempotencia`, `crm-config/arquivamentos-idempotencia` e casos novos em `portal-aluno/identidade-idempotencia`. Só os do N3 foram rodados contra `main` antes da implementação; os demais foram escritos junto com ela.

### Fuso pessoal nas telas (2º lote: `pagoEm` misto e telas com fuso de origem) — 2026-10-21

Branch `claude/fuso-pessoal-telas-2`, base `main` 95ca3d73 (com o 1º lote, #286). Continua a pendência da Q176 e trata as ressalvas das duas reviews do #286. Só exibição: nenhuma gravação nem regra de negócio mudou. Sem migration.

- **`Cobranca.pagoEm` misto (ressalva A / C2):** o campo guarda a data digitada (meio-dia da escola em `registrarPagamento`/ativação; meio-dia do NAVEGADOR no FIN-04, ver "Fica para o próximo lote"), a gravação legada à meia-noite UTC ou um instante real (`new Date()`/`agora` na baixa e no informe sem data, no ajuste que quita, na desistência; o instante histórico da baixa da migração). Normalizar na gravação **não é local**: o mesmo valor alimenta `Recebimento.dataPagamento`, o hash de idempotência (`hashDados`) e filtros por período (`dataPagamento <= agora`). Por isso a leitura distingue, no novo `diaCivilDoPagamento`/`formatarDiaDoPagamento` (`src/server/operacao/fuso-exibicao.ts`): exatamente 00:00:00.000 UTC é data civil legada (dia UTC); qualquer outro valor sai no dia da escola (`dataCivilInstitucional`), o que vale para a data digitada e para o instante. Limite aceito: instante real exatamente à meia-noite UTC, com milissegundo zero, é lido como data civil. Telas: "Último pagamento" da ficha financeira, data do pagamento nos informes e no histórico de recebimentos (este usava o dia UTC do ISO). O pagamento das 22:30 de São Paulo deixa de aparecer no dia seguinte.
- **C3:** o follow-up do painel da oportunidade usa o novo `formatarDiaDaEscola`, que não lança com fuso inválido (cai no dia UTC). O valor inicial do campo de data (`type="date"`, não `datetime-local`) em `DatasOportunidade` ganhou o mesmo fallback, porque derrubava o mesmo painel.
- **Telas com fuso de origem:** separado instante (→ fuso pessoal; sem preferência, o de origem; com o fuso dito) de horário publicado no fuso da agenda/reserva (→ mantém):
  - Secretaria › Reservas (turma e particular): registro e decisão da proposta → fuso pessoal; prazo, novo prazo (digitado no fuso da reserva) e horários → mantêm.
  - Matrícula › ocorrências financeiras (`ConferenciaHoras`): comunicação, conferência e aplicação da declaração → fuso pessoal; encontro, vigência e limite de cancelamento → mantêm.
  - Matrícula › indisponibilidade de oferta (relatos e término): confirmação/registro/decisão → fuso pessoal (sem preferência, o da escola, como antes; sem fuso da escola, UTC rotulado).
  - Matrícula › continuidade mensal: registro e decisão da versão eram o **dia UTC** → dia no fuso pessoal (sem preferência, o da escola).
  - Segundas chamadas › agenda inicial: registro da proposta → fuso pessoal; horário proposto → mantém.
  - Presença histórica da migração (fixava UTC): horário da aula → fuso de origem do encontro da agenda (sem encontro, o da escola; ajuste D da review 5604624805); resolução da divergência → fuso pessoal.
  - Conferidos e mantidos: matrícula › reserva e nova reserva (só prazo e horários da agenda), revisões de correção de aula (horário do encontro), compensações e prévia da continuidade (datas civis), período integral e compras de horas (já no fuso pessoal), aditivos › agenda e `ImpactosAcademicosAcerto` (horários da agenda; o resto é campo de entrada), `SegundaChamadaPainel` e remarcação/substituição (já no fuso pessoal), avaliações (`Formularios`: só o `datetime-local`), Configuração › CRM › metas (competência da escola é regra), contratação › `AgendaParticularFormulario` (conferência dos horários no fuso digitado).
- **Trava** (`src/app/fuso-pessoal-telas.test.ts`), lacunas da review: nova regra "apelido" (`Intl.DateTimeFormat` fora da posição de chamada, `Intl` como valor, `X.DateTimeFormat` de outro objeto, desestruturação de `DateTimeFormat`; `globalThis.Intl`/`window.Intl`/`Intl["DateTimeFormat"]` passam pela regra "intl"); nova regra "texto-local" (`String(d)`, `d.toString()`, `${d}`, `d + …`, `+=`) e `Date()` sem `new`. "d é data" é sintático (`new Date(…)` ou nome declarado no arquivo como `new Date(…)`/`: Date`, também em união) — o type checker custaria demais na suíte; Date que chega tipada de outro módulo fica fora (no JSX o tsc já recusa). `parseDiagnostics` (API interna do TS): falha fechada se sumir e teste de sanidade. Nenhum achado novo nas telas; exceções inalteradas.
- **Fica para o próximo lote:**
  - telas cujo fallback sem preferência ainda é UTC, não o fuso da escola: acertos de adiantamento e de vencimento, período integral, compras de horas, substituição de agenda da segunda chamada;
  - `remarcacao` da segunda chamada: "prazo vigente" no `fusoExibicao` vindo do servidor (conferir a origem);
  - fuso de ENTRADA dos campos `datetime-local` (Inbox, experimental, diário, avaliações, aditivos › agenda, conciliação da migração);
  - **gravador do FIN-04** (review 5604624805, item A): `RecebimentoDestinadoForm.tsx` grava o meio-dia do NAVEGADOR (`new Date(\`${data}T12:00:00\`)`, aceito por `z.coerce.date()` em `financeiro/acoes.ts`), não o da escola. Com o navegador a ~12h ou mais a leste da escola, `diaCivilDoPagamento` mostra o dia anterior (a oeste, o seguinte). Correção no lote 3: o form manda a data AAAA-MM-DD e o servidor a lê com `analisarComDatasDaEscola`, cuidando do `hashDados` nos reenvios.
- **Ajustes da review 5604624805** (aprovada; nenhum bloqueador):
  - A: JSDoc de `diaCivilDoPagamento` e descrição do PR corrigidos (a data digitada não é sempre o meio-dia da escola; limite do FIN-04 documentado). Gravador intocado neste PR.
  - B: a trava também acusa o acesso por propriedade (`String(p.criadoEm)`, `${p.criadoEm}`) de nome declarado como data. Rodada no repo: nenhuma tela real nova.
  - C: limite de escopo por arquivo (falso positivo possível) registrado no cabeçalho da trava.
  - D: presença histórica: o horário da aula sai no `fusoOrigem` do `EncontroAgenda`, como no diário; só a aula sem encontro cai no fuso da escola. As duas consultas trazem `fusoAgenda` (teste de integração novo).
  - E: `ConferenciaHoras`: a comunicação também sai no fuso da agenda, entre parênteses, quando o fuso exibido difere, para comparar com o limite de cancelamento no mesmo fuso.
  - F: continuidade mensal: o dia do registro e o da decisão saem com o fuso escrito.
  - Evidências: eslint dos arquivos tocados, saída 0; trava e testes tocados (15 arquivos, 184 testes) OK em `TZ=UTC` e `TZ=America/Sao_Paulo`; `entrada-financeira-historica.int.test.ts` (23 testes) OK nos dois fusos, no banco descartável `erp_genius_test_fix289`, apagado depois. `tsc` local estourou a memória (4 GB): conferido pelo CI.
- **Evidências** (Postgres de teste em `localhost:54329` recusando conexões: só unitários):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=8192): saída 0.
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base).
  - Afetados (helper, as duas travas, funil, financeiro, ficha financeira, reservas, ocorrências, indisponibilidade, continuidade, segundas chamadas, presença): 87 arquivos, 526 testes OK em `TZ=UTC` e em `TZ=America/Sao_Paulo`, com expectativas fixas. Os testes novos de tela falham com o comportamento antigo (conferido para o "último pagamento" e os informes).
  - `TZ=UTC vitest run` completo: 825 arquivos, 6.267 testes OK.
  - `npm run build`: saída 0.

### Fuso pessoal nas telas (3º lote: fallback da escola, prazo da remarcação e fuso de entrada dos `datetime-local`) — 2026-10-21

Branch `claude/fuso-pessoal-telas-3`, a partir do 2º lote (#289, já no `main`, com merge do `main` sem rebase). Encerra as três pendências que o #289 deixou e trata o item A da review dele (FIN-04). Sem migration.

- **Fallback da escola** (sem preferência pessoal, as telas caíam em UTC): registros e decisões (instantes) agora usam o fuso pessoal; sem preferência, o da escola (ou o da agenda), com o fuso escrito na tela.
  - Financeiro › acertos de adiantamento e de vencimento: proposta, aplicação e vigência. Saiu o "origem UTC". Os vencimentos são datas civis gravadas e passam por `formatarDiaCivilGravado`, no fuso em que o acerto foi preparado (antes era um `Intl` cru, que lançava com fuso inválido).
  - Matrícula › período integral: registro, decisão e aplicação (`instanteDoPeriodoIntegral`).
  - Aluno › movimentações › compras de horas: registro da compra. O horário do encontro continua no fuso da agenda.
  - Segundas chamadas › substituição: registro e decisão no fuso pessoal; sem preferência, no da agenda (como a agenda inicial do lote 2) e, sem agenda válida, no da escola. O horário publicado fica no fuso da agenda, e um fuso de agenda inválido não derruba mais a página: sai em UTC, dito na tela.
  - Política de comissão: as vigências exibidas acompanham o campo de entrada (sem preferência, fuso da escola).
- **Remarcação da segunda chamada › "prazo vigente":** o servidor mandava `estado.encontro?.fusoOrigem ?? "UTC"`, ou seja, UTC sem encontro, e um fuso gravado inválido derrubava a página.
  - Agora `fusoDoPrazoSegundaChamada` (`src/server/avaliacoes/segunda-chamada-prazo.ts`) usa o fuso da agenda; sem ela, ou com fuso inválido, usa o da escola (`fusoDaEscola`). Só cai em UTC se a escola também não tiver fuso, e nunca usa o fuso do servidor.
  - A consulta devolve `origemFusoExibicao` e a tela escreve "(America/Sao_Paulo, fuso da agenda/da escola)", sem lançar.
- **Fuso de ENTRADA dos `datetime-local`.** Os ~40 campos de `src/app` foram auditados:
  - 24 já estavam certos: `<CampoFuso>` no mesmo formulário e ação `*-local` com `instanteAvaliacaoLocal`.
  - Os errados liam o texto digitado no fuso do navegador (`new Date(valor)`: diário, Inbox, experimental no painel e nas datas, vigência do aditivo, política de comissão, validação/prazo/liberação da reposição).
  - A correção da conclusão de reposição lia o valor como UTC.
  - `paraDataHoraLocal` lia no fuso do PROCESSO.
  - A agenda do aditivo convertia no cliente.
  - O ciclo da agenda particular não dizia o fuso.
  - **Novo `src/server/operacao/fuso-entrada.ts`:**
    - `fusoDoCampoLocal`: o fuso pessoal; sem ele, o da escola; sem nenhum válido, "UTC" escrito ao lado do campo (fallback documentado).
    - `valorCampoLocal`: valor inicial e `max` no mesmo fuso; não lança, e fuso inválido usa UTC.
    - `instanteDoCampoLocal`: converte no fuso informado e recusa formato inválido, data impossível e horário pulado ou repetido no horário de verão.
    - Servidor: `exigirInstanteDoCampoLocal` (`src/server/_shared/campo-local.ts`) transforma o erro em `ErroRegra`, sem fallback.
  - **Novo `<CampoDataHoraLocal fuso=…>`** (`src/components`): escreve "Horário em X." ao lado do campo, marca `data-fuso` e, com `nomeFuso`, envia o fuso junto.
  - **Ações `*-local`** (texto + fuso → instante no servidor):
    - `diario/reposicao-local.ts`
    - `diario/diario-local.ts`
    - `financeiro/politica-comissao-local.ts`
    - `contratos/aditivos-local.ts`
    - `contratos/agenda-aditivo-local.ts`
    - `agendarMensagemNoAtendimentoLocal`
    - `agendarExperimental({ dataLocal, fuso })`
    - `atualizarDatas({ dataExperimental, fusoDataExperimental })`
  - `paraDataHoraLocal`/`dataHoraOpcional` passam a recusar o texto sem fuso.
  - Exceção mantida: a conciliação financeira da migração, que usa deslocamento UTC explícito, copiado da fonte.
- **Trava** (`src/app/fuso-pessoal-telas.test.ts`):
  - Nova regra "campo-local": `datetime-local` fora do `<CampoDataHoraLocal>`, a não ser com `<CampoFuso>` no mesmo `<form>` ou na mesma árvore JSX. `createElement`/constante contam (falha fechada).
  - Nova regra "conversao-local": `new Date(v)`/`Date.parse(v)` em que `v` lê o campo (`x.get("<name>")` ou o nome ligado ao `value`).
  - Saíram as 7 exceções do lote 2 (experimental, diário, `Intl.DateTimeFormat()` do aditivo) e entrou 1 (conciliação da migração).
  - `campos.test`/`campos-mapa` e `rotulos.test` reconhecem o `CampoDataHoraLocal`.
- **FIN-04 (item A da review do #289):**
  - Antes, o form gravava o meio-dia do NAVEGADOR: 05/10 digitado em Sydney virava 04/10 na escola em São Paulo.
  - Agora o form manda `AAAA-MM-DD` e `registrarRecebimentoDestinado` analisa com `analisarComDatasDaEscola`/`dataObrigatoria`, gravando o meio-dia da escola (`Recebimento.dataPagamento` e `Cobranca.pagoEm`). O ISO de um form antigo ainda aberto continua aceito.
  - **Idempotência:** com `dataDigitada`, o replay da mesma chave aceita a data gravada pela outra convenção de meio-dia para o MESMO dia digitado (`mesmaDataDigitada`: meio-dia de D em algum fuso, entre UTC−12 e UTC+14, em quartos de hora e sem segundos), desde que o resto do `hashDados` seja igual.
  - Outro dia com a mesma chave continua recusado.
- **Pendências:**
  - Cerca de 100 telas ainda usam "UTC" como origem de exibição sem preferência (fora do escopo deste lote; lista com `grep 'formatarInstanteExibicao(.*"UTC"'`). Entre elas a própria página de aditivos e os históricos de movimentações.
  - O horário publicado na remarcação da segunda chamada continua no fuso pessoal com "(origem X)", como o lote 2 deixou.
  - O `tsc --noEmit` completo foi morto por falta de memória: fica com o CI. O dos arquivos alterados e dos seus importadores (143 arquivos) passou.
- **Evidências** (depois do merge do `main` com o #289):
  - Afetados: 282 arquivos e 2.546 testes OK em `TZ=UTC` e em `TZ=America/Sao_Paulo`, com expectativas fixas. Inclui as travas `fuso-pessoal-telas`, `fuso-instante`, `campos` e `rotulos`, os helpers e as telas tocadas.
  - Testes novos: `fuso-entrada` (dois fusos, virada do dia, horário de verão, fallback), `acoes-campo-local` e `segunda-chamada-prazo`. `recebimentos-data-digitada` cobre Sydney → 05/10 e o replay. Também os autotestes das regras novas da trava.
  - Integração no banco descartável `erp_genius_test_fuso3`, apagado no fim:
    - `recebimentos-destinados`: FIN-04 nos dois sentidos do replay e outro dia recusado.
    - `comercial/leads`: experimental com e sem fuso.
    - `whatsapp/agendamento`: agendamento local.
    - `reposicao-entrega-operacional`.
    - Tudo OK em UTC; `agendamento` e `recebimentos-destinados` também em São Paulo.
    - `segunda-chamada.int` (consulta de remarcação: fuso do prazo = agenda): OK.
  - `tsc` dirigido (alterados e importadores, 145 arquivos): saída 0. O `tsc --noEmit` completo foi morto por falta de memória (4 GB): fica com o CI.
  - `eslint . --max-warnings 40`: saída 0, com 0 erros e 40 avisos (a linha de base).
- **Correções das reviews do #290** (5605939307 e 5605944129):
  - **B1:** em `/academico/reposicoes`, o prazo da etapa e o "Expira em" da liberação eram digitados em UTC quando não havia preferência. Agora a página usa `fusoDoCampoLocal(preferência, escola)`, e 25/10 23:59 em São Paulo vira `2026-10-26T02:59Z`. Nenhuma outra entrada caía em UTC.
  - **FIN-04, replay (menor 1 e C3):** `mesmaDataDigitadaNaEscola` compara com o dia que a escola vê no registro existente. Em Pacific/Auckland e Pacific/Honolulu, outro dia com a mesma chave é recusado. Um registro antigo que a escola vê em outro dia (Sydney) também é recusado, sem duplicar o caixa.
  - **Menores:**
    - comentário de `diaCivilDoPagamento` atualizado;
    - a experimental intocada volta como o instante gravado (hora repetida do horário de verão), com o limite documentado no diário e na agenda do aditivo;
    - a trava "conversao-local" passa a pegar `new Date`/`Date.parse` sobre `*.target.value` nos handlers do campo e `valueAsNumber`/`valueAsDate`;
    - na remarcação, o rótulo do prazo com fuso não reconhecido mostra "UTC; … não reconhecido";
    - o texto do `datetime-local` sem fuso vira erro de validação legível.
  - **Evidências:**
    - trava e testes tocados (26 arquivos, 211 testes) OK em UTC e em São Paulo;
    - financeiro, `_shared` e comercial: 72 arquivos e 560 testes OK nos dois TZ;
    - `tsc` dirigido: saída 0; lint dos alterados: 0.
    - A integração não rodou, porque o cluster de teste está com o checkpoint parado (vários `DROP DATABASE` pendentes, inclusive o do `erp_genius_test_fuso3`). O `recebimentos-destinados.int` foi atualizado para a regra nova.

### Idempotência, 6º lote (#166) — 2026-10-21

Branch `claude/idempotencia-lote6`, base `main` 239001ad, com `main` mesclada depois do 5º lote (PR #282). Não toca as ações do 5º lote. A #166 continua aberta.

- **Escopo:** 20 ações que criam registro, enviam pelo WhatsApp ou mexem em dinheiro. Os testes de integração entraram primeiro e rodaram contra o servidor de `main`: 18 de 29 casos falharam; os 11 que passaram (sem chave, chave de outro autor, estado vindo de outra pessoa) ficam como trava de regressão.
- **Criações com chave** (`repeticaoIdempotente` depois da sessão e do papel, busca antes das validações de estado, escopo por autor; `useChaveIdempotencia` na tela):
  - Financeiro, pedido manual de restrição e de liberação de aulas (`bloquearAcesso`, `desbloquearAcesso`; marca em `RestricaoAulasSolicitada`/`LiberacaoAulasSolicitada`, hash de matrícula, pedido e motivo). Antes, se a solicitação era rejeitada entre a tentativa e o reenvio, o reenvio abria outra; se era aprovada, o reenvio era recusado. A mesma chave com outro motivo, o pedido inverso ou outra matrícula (existente ou não) recebe a mesma recusa.
  - Funil, registrar o link de pagamento da taxa (`registrarLinkPagamento`; marca em `LinkPagamentoEnviado`, hash de cobrança e link). Antes, cada reenvio gravava outro Evento e movia a âncora da régua "link sem pagamento". O reenvio devolve ok mesmo com a cobrança já paga. O painel ganhou executor próprio para o link (como a nota).
  - Inbox, transferir atendimento (`transferirAtendimento`; marca nos dois `AtendimentoTransferido`, hash de atendimento, destino, chave do destino e contexto). O reenvio devolve o atendimento novo em vez de "Atendimento encerrado".
  - Inbox, encaminhar mensagem pelo motor (`encaminharMensagemWhatsApp`), no padrão do envio de assinatura (#288), depois do B1 da R1: a TX1 confere tudo e grava `MensagemWhatsAppEncaminhamentoIniciado` (com a marca) sob a trava da chave; o motor é chamado fora de transação; a TX2 grava o desfecho (`MensagemWhatsAppEncaminhada`, `...EncaminhamentoIncerto` para timeout, rede ou resposta ambígua, `...EncaminhamentoNaoEnviado` quando o motor afirma que não executou). O reenvio da mesma chave devolve ok, "em andamento" ou "incerto" sem chamar o motor; só depois de "não enviado" tenta de novo. A leitura e o escopo da TX1 usam a própria transação (B2). Sem chave, o fluxo de antes.
- **Idempotentes por natureza, com mudança no servidor.** O reenvio de quem já fez a ação devolve ok sem gravar Evento nem chamar o motor. Se o estado veio de outra pessoa, do despachante ou do celular, a ação segue recusada como antes.
  - Inbox: assumir (o último Evento de responsável do atendimento é o `AtendimentoAssumido` de quem repete; o clique duplo que perde o UPDATE condicional também recebe ok), devolver para a fila (último é o `AtendimentoDevolvido` dele), encerrar (antes, com a corrida do clique duplo, dava para gravar dois `AtendimentoEncerrado`; agora a linha é travada), revogar convite e cancelar mensagem agendada (`cancelarMensagemAgendada`, que também serve à agenda de tarefas).
  - Mensagem pelo motor: editar com o mesmo texto da última edição de quem repete e apagar a mensagem que ele mesmo apagou pelo ERP. Apagada pelo celular (sem Evento), segue "já foi apagada".
- **Idempotentes por natureza, só na tela** (conferido no servidor, que já devolvia a decisão ou a efetivação existente): decisão da solicitação de acesso às aulas, efetivação da desistência, decisão administrativa e decisão financeira da desistência, decisão e efetivação do acerto de encerramento, atribuir atendimento. As decisões já usavam a mensagem própria de decisão incerta ("reenvie a mesma decisão"); as efetivações passam de "recarregue antes de repetir" para "reenvie sem alterar os dados".
- **Fica como está:** fixar conversa no Inbox alterna o estado (o reenvio desfaria o primeiro clique); continua com `idempotente: false`, agora num executor separado de assumir/devolver. O pagamento simulado da página pública `/pagar` não baixa a cobrança (`baixarCobrancaTx` exige autor), então não há o que repetir.
- **Restam 92 linhas** com `idempotente: false` ou `idempotente={false}` fora de testes e de `src/server` (103 em `main` depois do 5º lote, na mesma contagem). O encerramento usa `ultimoEventoDoAutor` do 5º lote; assumir e devolver usam um helper local, porque o último Evento de responsável é procurado entre três tipos.
- **Testes atualizados** porque fixavam o comportamento antigo: o segundo `revogarParticipante` em `whatsapp/participantes.int.test.ts` (agora ok, com um Evento); a chamada de `encaminharMensagemWhatsApp` em `inbox/AcoesMensagem.test.ts` (leva a chave); a mensagem de resultado incerto das efetivações em `movimentacoes/feedback.interacao.test.ts` e `desistencia/feedback.interacao.test.ts`.
- **R1 do #291:** B1 e B2 acima; testes de motor lento (6 s, acima do timeout padrão de transação interativa), envio simultâneo com a mesma chave (C2), timeout que vira incerto e limite de ritmo que libera nova tentativa; encaminhar com chave, transferir com chave e as repetições de devolver, assumir e encerrar em `whatsapp/acoes-atendimento-pool.int.test.ts` (uma conexão). C3: chave por alvo (`useChavesPorAlvo`) no painel de acesso às aulas (matrícula e pedido) e no encaminhar (destino). C4: trava comum a restringir e liberar com a mesma chave.
- **R2 do #291 (revisão 5605995246):** o marcador confirmado antes do motor (`...EncaminhamentoIniciado`) já cobria o B1/B2; o reenvio que o encontra sem desfecho agora diz "não confirmado, confira a conversa". `traduzir` só diz "não executou, tente de novo" quando o motor afirma que não executou; timeout, rede e `RESULTADO_INCERTO` dizem que a ação pode já ter sido feita. B3: editar e apagar gravam `MensagemWhatsAppAcaoIniciada` sob a trava da mensagem e do verbo antes do motor e o desfecho depois; dois pedidos simultâneos geram uma chamada e um Evento (cenários D e E). A chave não vai ao motor: a rota `/v1/numeros/:id/acoes` não tem campo de deduplicação no contrato conhecido (o `clientMessageId` é só da rota de mensagens).
- **Arquivos novos:** `cobrancas/acesso-aulas-idempotencia`, `matricula/link-pagamento-idempotencia`, `whatsapp/atendimento-idempotencia` e `whatsapp/motor/mensagem-idempotencia` (`*.int.test.ts`). Os três primeiros trocam só `exigirSessao` (como `empresa-idempotencia`), para o envio simultâneo não esbarrar no `import()` duplo do NextAuth mockado.
- **Evidências** (banco descartável `erp_genius_test_idem6`, `migrate deploy`; perfil temporário desfeito e banco apagado ao fim). A máquina estava sob carga (load ~20 em 4 núcleos) e o Postgres compartilhado entrou em recuperação no meio da rodada; a integração foi repetida depois que ele voltou.
  - `tsc --noEmit`: saída 0, antes e depois do merge da `main`.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base), antes e depois do merge.
  - `npm test` antes do merge: 819 arquivos e 6.218 testes; em UTC, 2 falharam por timeout de carga (`colunas-ordenaveis`, `paginacao-dois-sentidos`), em America/Sao_Paulo, 1 (`campos-texto`, timeout fixo de 120 s). Os três passam repetidos isolados. Inclui a trava `crm-config/auditoria.test.ts`.
  - `npm run build`: saída 0 (a primeira tentativa parou em "Failed to type check" sem diagnóstico, com a memória da máquina esgotada; repetida, passou).
  - Integração: os 19 arquivos que chamam as ações tocadas mais `whatsapp/linha-comercial`, `crm/carteira` e `crm/funil-carteira-equivalencia`: 22 arquivos e 247 testes OK. A rodada por diretório inteiro (`whatsapp`, `inbox`, `crm`, `cobrancas`) não terminou dentro do limite de uma hora por causa da carga.

### Port da #62: Q171/Q167C — destinos do excedente de permuta e saldo restrito a serviços — 2026-10-21

Branch `claude/port-62-q171`, base `main` 80ba5d88. Origem: #62 `5f2354ee` (destinação negociada) e `4f09181e` (uso do saldo), portados sem cherry-pick e adaptados à `main`. Regras de 21/09 (`docs/planejamento/decisoes-2026-09-21.md`, sexta rodada): o acordo caso a caso escolhe entre saldo restrito a serviços e crédito financeiro; concordância do aluno (ou responsável) e da escola com nome, meio e evidência; aprovação independente; saldo de serviços abate mensalidade, hora particular ou taxa da mesma matrícula, não expira e nunca vira dinheiro.

- **Migrations** `20261021300000_destinacao_excedente_permuta` (era `20260921070000`) e `20261021310000_uso_saldo_servico_permuta` (era `…080000`). Proposta → concordâncias → decisão independente → destinos na mesma transação (`SaldoServicoPermuta`; `OrigemCreditoExcedentePermuta` → `CreditoMatricula`). O uso aprovado nasce como `AplicacaoCompensacaoPermuta` com `usoSaldoServicoId` (CHECK de origem única), então contador, projeção e proteção da cobrança seguem sem reescrita. Guards SQL imutáveis, aprovador ≠ preparador, constraint triggers diferidas (destinos e aplicação nascem com a aprovação).
- **Nona origem de crédito** (`origemExcedentePermutaId`) em todas as funções que enumeram origens, copiadas da definição VIGENTE na `main` e conferidas com `diff -w` (só o ramo novo): `credito_matricula_origem_unica_check`, `q165_delta_reconhecimento_guard_249` e `q165_fotografia_delta_atual_255` (de `20261020500000`), `q165_fotografia_atual` (de `20261020520000`, #276). A #62 só tinha os dois primeiros: `_255` e `q165_fotografia_atual` foram redefinidos na `main` depois. TS no mesmo padrão (`desistencia-financeiro-tx.ts`, `desistencia-reconferencia-delta-fontes.ts`): a chave só aparece quando existe. `validar_aplicacao_permuta_223`: cópia da vigente (`20260917148000`) com o ramo do uso antes do corpo original, que ficou idêntico (a #62 mudava a ordem dos bloqueios).
- **Diferenças em relação à #62:** o uso do saldo recusa cobrança em pausa (suspensa/cancelada) e com comprovante a conferir, na ação e no banco, como a compensação por permuta da `main`; a concordância idêntica repetida devolve a mesma (também depois da decisão); decisões guardam o motivo no Evento; ações devolvem `podeRevisar` como `permuta-servico.ts`; vencimentos na tela são dia civil no fuso da escola (`diaCivilGravado` + `fusoDaEscola`); tela sem id cru, com `IdentificacaoRegistro`, `EstadoVazio`, rótulos e `formatarMoeda`; valores aceitam vírgula.
- **Tela** `financeiro/permuta/excedente/[matriculaId]` (link em cada acordo da lista de permutas). Manifestos atualizados: `botoes-mapa.ts`, `estados-vazios-mapa.ts`, trilha. Catálogo de eventos (doc 12) com os seis eventos novos.
- **Perguntas ao dono (escolhido o mais conservador):** a concordância pode ser registrada pela Secretaria (como na #62), mas a tela é só do Financeiro, ok? A Q173 (aditivo de moeda, ainda não na `main`) deve contar saldo de serviços na moeda antiga como pendência da "matrícula limpa"? Hoje ele simplesmente não abate cobrança de outra moeda.
- **TDD:** a igualdade Node/SQL da `q165_fotografia_atual` com a nona origem ficou vermelha antes do TS; integrações novas `excedente-permuta-destinacao.int.test.ts` (3 casos: fonte mista, soma, idempotência, concordâncias, autoaprovação na ação e no banco, destinos atômicos, cobrança intacta, Evento por escrita, TS = SQL da fotografia delta, crédito usado pelo fluxo geral, segunda destinação recusada, cobrança alterada) e `saldo-servico-permuta-uso.int.test.ts` (3 casos: tipos/moeda/matrícula, disponível na ação e no banco, reserva, autoaprovação, aprovação sem aplicação recusada pelo banco, imutabilidade, sem crédito gerado, cadeia nas fontes da Q167, comprovante a conferir recusado na ação e no banco, rejeição devolve a reserva).
- **Evidências** (Postgres na 54329, banco descartável `erp_genius_test_q171`, `migrate deploy` do zero com 476 migrations, perfil temporário desfeito e banco apagado ao fim):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=8192): saída 0.
  - `eslint . --max-warnings 40`: 0 erros e 40 avisos (linha de base).
  - `vitest run`: 818 arquivos, 6.128 testes OK em TZ=UTC e em TZ=America/Sao_Paulo (inclui a trava `crm-config/auditoria.test.ts`).
  - Integração de `src/server/financeiro` e `src/server/matricula` (permuta, desistência, Q165, Q167): 58 arquivos e 488 testes OK; `financeiro/politica.int.test.ts` (baixas parciais concorrentes, não tocado) falhou uma vez com o build rodando junto e passou ao ser repetido sozinho.
  - `npm run build`: saída 0.
- **Correções da revisão (R1 `5602744571` e R1 rigorosa `5603911810`):**
  - **B1/C2, saldo restrito nunca vira dinheiro:** o uso aprovado do saldo não é origem de excedente. A recusa vale na ação (`apurarTx`) e no banco (`guardar_origem_excedente_uso_saldo_171` em `OrigemExcedentePermuta`).
  - **B2 e item menor:** o uso abate só `MENSALIDADE`, como a permuta da `main`, na ação e no banco. Em hora particular, a Q175 devolveria a aula paga com saldo como crédito financeiro. Em taxa, o acerto de taxa não conhece a permuta e o uso falhava com exceção do banco. Nenhuma função vigente foi redefinida. Isso é mais estreito que a decisão de 21/09 (ver a nota da Q171 em `decisoes-2026-09-21.md`).
  - **B3:** a destinação exige cobrança `PAGO`, com saldo 0 e liquidado ≥ `valorNegociado`, na ação e nos guards da proposta e da decisão.
  - **C3:** a nota da Q171 explica que `valorDevidoAcordado` é digitado na proposta.
  - As mudanças entraram nas próprias migrations `20261021300000`/`310000`. O corpo original de `validar_aplicacao_permuta_223` continua idêntico (`diff -w`).
  - Testes novos: `saldo-servico-permuta-uso.int.test.ts` com 4 casos (B1 na ação e no banco; tipos fora de mensalidade recusados na ação e no banco) e `excedente-permuta-destinacao.int.test.ts` com 4 casos (B3 na ação e no banco). Com o guard do banco removido, o caso B1 fica vermelho.
- **Correções da R2 (`5606178959` e rigorosa `5606415941`):**
  - **B4:** o banco amarra o excedente à obrigação acordada. O limite é a redução (liquidado − obrigação) e o serviço próprio (permuta − usos do saldo). Além disso, a obrigação não pode passar do negociado. A regra vale nos guards da proposta e da decisão (`20261021300000`). Teste do cenário da sonda (caixa 30 + permuta 50 + uso 20) em `saldo-servico-permuta-uso.int.test.ts`.
  - **C7:** a tela do excedente esconde a preparação em cobrança em aberto e quando a única fonte de serviço é uso de saldo, e explica o motivo. Teste de render em `excedente/[matriculaId]/page.test.ts`.
  - **C6:** a descrição do PR foi atualizada para o recorte só de mensalidade.

### Port da #62: assinatura eletrônica com driver simulado (Q155/Q165) — 2026-10-21

Branch `claude/port-62-assinatura-simulada`, base `main` 239001ad. Traz, adaptado à `main` atual, o port da #62 (`d2cf08f2`, `1583df0a`, `f09201ea`, que nunca chegaram à `main`). Envio e cancelamento de assinatura (contrato, aditivo e desistência Q165) passam a funcionar ponta a ponta com um driver SIMULADO, atrás do port `ProvedorAssinatura`; trocar para o fornecedor real (Q155) é implementar um driver nesse contrato.

- **Port e drivers** (`src/server/contratos/`): `provedor-assinatura.ts` (contrato: criar envelope pela chave da tentativa, consultar por chave, cancelar, baixar assinado; exceção, timeout ou referência vazia são sempre INCERTO), `provedor-assinatura-simulado.ts` (driver SIMULADO; os envelopes ficam na tabela `EnvelopeAssinaturaSimulado`, durável entre reinícios e com Evento em cada escrita) e `provedor-assinatura-ativo.ts` (`ASSINATURA_DRIVER`: vazio = registro manual; `simulado`; qualquer outro valor falha com erro de regra citando a Q155).
- **Sinalização do simulado:** o processo criado pelo simulado tem fornecedor `SIMULADO` e ambiente `SANDBOX`. Migration `20261021500000_driver_assinatura_simulado`: CHECK `SIMULADO ⇒ SANDBOX` e `SIMULADO ⇒ referência sim_…` nos processos de contrato (NOT VALID, sem reler legado) e de aditivo; os guards de efeito contratual real já exigiam `PRODUCAO`. As telas mostram o aviso "Integração de assinatura SIMULADA" e o serviço como "Simulado (nenhum documento sai do ERP)". Em `NODE_ENV=production` o simulado é aceito (é o build do UAT), com aviso no log. Nenhuma função SQL foi redefinida.
- **Envio e conciliação do contrato** (`envio.ts`, tela `contrato/originais/[artefatoId]`): tentativa confirmada no banco antes da chamada externa, resultado em outra transação; perda de resposta vira `ENVIO_INCERTO` e só a conciliação pela chave da tentativa resolve. Só aparece com o driver ativo, conferência da revisão atual e processo do mesmo serviço/ambiente.
- **Aditivo** (`aditivo-envio.ts`, tela do original do aditivo): mesmo protocolo; `ProcessoFormulario` oferece "Simulado" só com o driver simulado ligado e fonte em SANDBOX, e a ação recusa `SIMULADO` sem o driver. `iniciarTentativaAditivoTx` e `registrarResultadoEnvioAditivoTx` passaram a gravar Evento (`TentativaAssinaturaAditivoIniciada`, `ResultadoEnvioAssinaturaAditivoRegistrado`), que faltava.
- **Desistência Q165** (`executarCancelamentoAssinaturaDesistencia`, tela `desistencia/documentos`): intenção Q121 → cancelamento no serviço → observação `CONFIRMADO`/`INCERTO`; só a confirmação encerra o processo (`CANCELADO`), e a efetivação já reconhecia esse cancelamento. Repetir com nova chave concilia a mesma intenção; já confirmada, não chama o serviço de novo. A consulta documental separa o cancelamento por desistência do de substituição (antes, uma intenção de desistência aparecia como "cancelamento para substituição").
- **Idempotência:** as quatro ações aceitam `chaveIdempotencia` (`repeticaoIdempotente`, marca no Evento da tentativa/resultado/observação) e as telas usam `useChaveIdempotencia`; a mesma chave devolve o resultado gravado sem chamar o serviço.
- **Deploy:** `ASSINATURA_DRIVER` repassada em `docker-compose.coolify.yml` e `docker-compose.prod.yml`, listada em `.env.example`, `deploy/env.production.example` e `SETUP.md` (trava `compose-env.test.ts` conferida por mutação).
- **Travas de UI:** botões novos em `botoes-mapa.ts` ("Cancelar envio no serviço de assinatura" como `perigo`); a mensagem de resultado do envio (`contrato/resultado-envio.ts`) entrou como exceção ancorada em `enums-rotulos.test.ts`, por ser frase do fluxo e não rótulo do estado.
- **Fora do escopo:** driver real e webhook autenticado (Q155), conclusão automática a partir do assinado baixado, job de conciliação agendado, e envio de aditivo sobre base de ambiente `HISTORICO` (origem contratual histórica, #285).
- **Perguntas ao dono (escolhido o mais conservador possível sem quebrar o objetivo):** (1) o simulado é aceito com `NODE_ENV=production` para servir ao UAT; bloquear em produção real exigiria outra variável. (2) Um processo SIMULADO/SANDBOX pode ser fonte do acerto Q246/Q165 (regra existente para SANDBOX, não alterada).
- **Evidências** (Postgres 16 descartável na 54329, banco próprio do agente):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=8192): saída 0.
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base).
  - `vitest run` completo: 821 arquivos, 6.241 testes OK em TZ=UTC e em TZ=America/Sao_Paulo.
  - `prisma migrate deploy` do zero em banco novo: 475 migrations aplicadas, saída 0.
  - Integração dirigida: `contratos/envio-integrado.int.test.ts` 3/3; `aditivo.int.test.ts` cenário novo 1/1; `desistencia-acerto-contratual.int.test.ts` cenário novo 1/1 (envio pelo simulado, cancelamento incerto e depois confirmado, efetivação).
  - Suítes completas de `src/server/contratos` e `src/server/matricula` (depois da volta do cluster): 57 arquivos, 571 testes passados, 4 ignorados e 2 falhas. As 2 falhas foram nos testes novos de corrida, que o run carregou no meio da edição. Rodados de novo isolados com o código final (`envio-integrado`, `aditivo`, `desistencia-acerto-contratual`): 3 arquivos, 90/90.
  - Revisões R1, R2 e rigorosa: a conciliação não confirma envelope `CANCELADO`/`RECUSADO` (fica `INCERTO` com o motivo); `ENVIANDO` só é conciliado depois de `PRAZO_CONCILIACAO_ENVIANDO_MS` (10 min), maior que `TIMEOUT_CRIACAO_ENVELOPE_MS` (2 min), que agora é aplicado na criação; a tela só oferece conciliar em `ENVIO_INCERTO` ou `ENVIANDO` vencido; o catálogo de eventos (`docs/12`) foi atualizado; a evidência repetida do cancelamento simulado não varia mais; e o valor bruto de `ASSINATURA_DRIVER` vai só para o log.
  - `npm run build`: saída 0.

### Port da #62: origem contratual histórica como fonte de aditivos do contrato legado — 2026-10-21

Port de `db854944` (decisões da quinta e sexta rodada de 21/09, `docs/planejamento/decisoes-2026-09-21.md`), sem cherry-pick, sobre a `main` atual.

- **Modelo:** `PropostaOrigemContratualHistorica` (Secretaria/Administração: PDF assinado em bytes + `pdfHash`, referência, data civil da assinatura, transcrição das condições e projeção no formato da prévia) → `DecisaoOrigemContratualHistorica` (outro administrador declara os hashes conferidos do PDF e da transcrição). `PropostaAditivoContratual` e `PropostaAgendaAditivoParticular` passam a ter `conclusaoOriginalId` **ou** `origemHistoricaId` (CHECK `num_nonnulls = 1`). Migration `20261021400000_origem_contratual_historica` (era `20260921090000`).
- **Funções SQL redefinidas** (`conferir_fonte_aditivo_117`, `validar_proposta_aditivo_117`, `validar_decisao_aditivo_117`, `validar_artefato_aditivo_117`, `validar_conferencia_assinatura_aditivo_117`, `validar_decisao_alcada_aditivo_117`, `validar_compatibilidade_aplicacao_aditivo_117`, `validar_proposta_agenda_aditivo_117`, `vincular_agenda_proposta_aditivo_117`): partem da definição vigente na `main` (`pg_get_functiondef`), conferida com `diff -w`; só ganham o ramo histórico e os ajudantes `bloquear_fonte_aditivo_117`/`previa_fonte_aditivo_117`. Na `main`, a conferência de modelo/publicação de `conferir_fonte_aditivo_117` fica dentro do ramo da conclusão, então o ramo histórico a repete. Nenhuma outra função vigente lê `conclusaoOriginalId`/`conclusaoFonteId`.
- **Diferenças em relação à #62:** o guard `guardar_origem_contratual_historica` também confere moeda da matrícula e regime da preparação comercial (a #62 só conferia na ação); telas reescritas com os padrões atuais (`useAcaoCliente`/`FeedbackAcao`, `CampoTexto`, `botaoClasses`, `VoltarPara`, `EstadoVazio`, rótulo `ESTADO_PROPOSTA_DECIDIDA_LABEL`, trilha "Origem histórica"); o resto do TS de aditivos aplicou sem conflito, exceto a importação ao lado da recusa de regime (Q174) e as telas de aditivo.
- **Alcance:** sobre a origem histórica valem todos os aditivos exceto `TAXA_VALOR`, `TAXA_VENCIMENTO`, `PRIMEIRA_MENSALIDADE_VENCIMENTO` e `ADIANTAMENTO_*` (schema TS e guard SQL). Q172 (adiantamento) não é alcançado; Q174 (regime) continua recusado na preparação.
- **Limite herdado da #62 (pergunta no PR):** a base do aditivo histórico tem `ambiente: "HISTORICO"`; o envio para assinatura só aceita `SANDBOX`/`PRODUCAO` e exige o mesmo ambiente da base, então o aditivo sobre contrato legado chega à aprovação, mas não segue para assinatura nem aplicação. Não foi inventado um ambiente.
- **TDD/integração** (`contratos/origem-historica.int.test.ts`, sobre matrícula M01 real): os 2 cenários da #62 + 1 novo (inserção direta em outra moeda recusada pelo banco — vermelho antes do guard; um Evento por escrita com replay idempotente da proposta e da decisão; aditivo de taxa inserido direto no banco recusado; CHECK de fonte única).
- **Evidências** (Postgres descartável na 54329, banco `erp_genius_test_orh` com `migrate deploy` do zero, perfil local não versionado; banco apagado ao fim):
  - `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=8192): saída 0.
  - `eslint . --max-warnings 40`: saída 0, 0 erros e 40 avisos (linha de base; nenhum nos arquivos alterados).
  - `vitest run` completo: 818 arquivos, 6.128 testes OK em TZ=UTC e em TZ=America/Sao_Paulo.
  - Integração de `src/server/contratos`: 166 testes OK (1 pulado por desenho, homologação Q170). Integração de `src/server/matricula`: 403 testes OK (3 pulados por desenho).
  - `npm run build`: saída 0 (duas tentativas anteriores morreram por falta de memória na máquina compartilhada, sem erro de tipo).
