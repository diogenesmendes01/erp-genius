# Inbox E2.1 — aviso do atendimento e capacidades do painel (#321)

Base1bb721b7e6e72bbfd8f5f8fe7f3f944bef0440b3 (PR406/E1). BranchOWNcodex/inbox-e2-321; Node22.23.2; perfildev-email exclusivo. Implementação de infraestrutura, sem nova tela: UI/capturasN/A. Compilação real do bundle/inbox será feita pelo integrador após terminar a suíte e restaurarA; não alegar que SSRunitário prova bundle de navegador.

## Contrato e recorte

- Novo avisarAtendimento(db,id) em src/server/inbox/aviso.ts aceita Prisma.TransactionClient ou typeofprisma. Reutiliza exatamente UPDATE AtendimentoWhatsApp SET id=id WHERE id=$id, sem buscar ou emitir conteúdo. O trigger existente notificar_inbox_atendimento publica atendimento.atualizado com tipo/atendimentoId/mensagemIdnull/conversaId no COMMIT. Rollback não avisa. ID ausente não inventa atendimento/evento.
- avisarMudancaDeEscopo em whatsapp/acoes-atendimento.ts delega ao novo helper na MESMA transação. Não mudou ordem de locks, validação de sessão/escopo, autorização, idempotência, convite/revogação nem aviso direcionado do revogado. Nenhum novo canal/evento/polling/trigger/migration foi criado.
- Aviso é uma escrita/lock na linha; a action deve primeiro autorizar o contexto. O helper não concede acesso nem substitui atendimentoVisivel. Mantém a mesma ordem transacional do chamador; nenhuma emissão por conexão paralela na produção.
- capacidadesPainel(u,ctx) retorna10booleanos como projeção de contexto JÁautorizado. ctxveLead deve vir da consulta existente/escopo real, jamais de parâmetro cliente como autorização. MatrizesCRM/Aria continuam fontes de alçada.

| Capacidade | Projeção |
|---|---|
| veLead | ctx.veLead já resolvido pelo servidor |
| verContato | CRMcontatos.ver; não substitui consulta de pessoa/telefone e filtros do setor |
| editarContato/editarTags | COMERCIAL+veLead+CRMcontatos.editar |
| criarTag | editarTags+CRMcarteira.equipe |
| moverEtapa | COMERCIAL+veLead+CRMfunil.mover |
| tarefas/tarefasEquipe | CRMtarefas.ver/tarefas.equipe |
| desfazerAria | COMERCIAL+veLead+Aria decidirHistorico vigente; dependênciaD1 abaixo |
| verEmpresa | Administrador ouFinanceiro, conforme guard de empresas/[id]/page e adminimplícito de papeisTem |

D13: nenhum setor não comercial recebe edição/tag/etapa/Aria por mera presença de lead; consulta de painel e abas comerciais/pessoa/telefone pedagógico continuam autoritativas. verContato exprime alçada CRM, não liberação de conteúdo sensível do setor. Esta issue não altera paineis.ts/UI/rota nem entrega abasE2 futuras.

D1 vigente aprova vendedor RESPONSÁVEL decidir/desfazer. O contrato atual desta projeção não recebe responsável; veLead não prova responsabilidade. #354 introduzirá contexto+autorização reais juntos. O false atual ao vendedor sem contexto de responsabilidade não redefine produto como vendedor nunca desfaz. Não foi ampliada a matriz global capacidadesAria nem configuração/histórico global para vendedor.

A função pura capacidadesAria agora tipa somente Pick<UsuarioSessao,papeis>, sem fabricar UsuarioSessao ou cast incompleto. No mesmo módulo, ErroPermissao vem diretamente de _shared/sessao (a mesma classe), evitando barrel_shared→evento/Prisma num produtor consumido pelo client. Troca coordenada comROOT; validarAlteracaoPorPapel, matrizes, demais consumidores/roles intactos.

## TDD e evidências observadas

REDunit17c1e9:permissoes63casos,50anteriorespass/13novosfalham por capacidadesPainel ausente. Novos casos derivam expectativas literais de papéis/setores/leadvisível, D13, empresa e acumulação sem abrirAria global. Todos testes anteriores preservados.

REDint7cb60b:configintegration/dev-email validou migrationsstatus, então falhou import ./aviso ausente;0testes executados/nenhuma fixturetruncada nesta execução. Não conta como 4assertionsvermelhas. Após implementação, 32292/48e2f2 TERMINAL0:2arquivos/8testes/51,27s, aviso4novos+participantes-aviso4completos. ListenerPG real antes da normalização do barramento prova payload exato, incluindo ausência de campos privados extras. Commit sentinela em outra linha comprova listenerativo enquanto txalvo aberta; depois commit chega. Rollback seguido de sentinela não deixa avisoalvo, sem pausa arbitrária. Cada conexão encerra emfinally. IDinexistente não gera notificação.

GREENunit7421d3:3arquivos/77testes Inbox/CRM/Aria0. RecorteclienteSSR61501/be6713:7arquivos/138testes0; caminho de hookinteracao inexistente não foi contado. Corrigido para useAcoesAtendimento.test.ts real no recorte ampliado87466/512e65:14arquivos/193testes0 (server/inbox unitários, matrizesCRM/Aria, AcoesAtendimento,useAcoesAtendimento,MenuConversa,ConversaAberta,sem-polling e guards). Sem-t ou skipnovo; configuração unitária exclui*.int. Não é suíteglobal.

Lint47771/0e7f79:6fontes produtivas/teste alteradas, max-warnings0, TERMINAL0. TypeScript14927/9d4395 heap8192 TERMINAL0. RegressãoDB22922/b84d78 TERMINAL0:2arquivos/18testes/129,62s (participantes.int e acoes-atendimento-pool.int completos), maxWorkers1/configintegration/perfildev-email. TotalDB26testes em4arquivos, duas execuções sequenciais; não é suíteglobal. Warns de configuração Vitest mixedexports/vite-tsconfig-paths préexistentes foram exibidos sem alteração/supressão.

## Ambiente e limites

Antes de SQL por suíte, perfildev-email/bancoerp_genius_test_dev_email/Nodev22.23.2/fontebase1bb conferidos160390 e início comunicadoROOT. Uma suíteDB porvez (32292 terminou antes22922); semSQLmanual/seed/servidor/preview/providers/envio/deps/package/lock/schema/migration/cluster. beforeEachtruncarBanco(public) é o padrão aprovado. ROOT conserva snapshotA551; DEV anunciou banco livre após22922terminal0, sem novo uso após esse aviso. Restauração/checagem do banco e bundler real ainda cabem ao integrador. Sem UI nova; teste de browser funcional não se inventa para este helper. Bundlefocado/QAexata/global integrado/publicação/CI aguardamcoordenação; não marcarE2concluída.

Estado do checkpoint: implementação/recortes DEV concluídos, sem fixture/DB/preview/SQLmanual ativos. Compilação real /inbox, QA independente e global integrado ainda pendentesROOT. Fonte/#321 não modifica C3/R6/SSEclient/VirtualList/menu/painel visual, matrizes globais ou schema.
