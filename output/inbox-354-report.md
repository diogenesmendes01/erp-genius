# Inbox #354 — entrega DEV para QA

Implementação dos três verbos contextuais, DTO/capacidades por cartão e confirmação/foco concluída no recorte DEV. Base16b7d3d, branch codex/inbox-e3-354-decisoes-responsavel. APIs globais preservadas. UNIT amplo88/1087 e INT5/78 EXIT0 antes do último fechamento restrito dos dois alvos; depois UNIT5/41 e INT2/2 EXIT0 (filtro explícito/23fora), lint26 EXIT0. Sem alegar TSC/global/QA/visual aprovados. Nenhum processo Node/teste continua ativo.

O registro inicial abaixo é histórico e foi superado pela implementação/evidências finais subsequentes.

# Inbox #354 — investigação e início TDD

Base: 16b7d3d7bca78e48ea9572e616c884f6ddd92d82. Branch própria codex/inbox-e3-354-decisoes-responsavel. Implementação parcial: somente predicado puro de exceção D1 e testes; nenhuma conexão com execução/DTO ainda.

## Contrato aprovado

Vendedor responsável ATUAL pelo atendimento COMERCIAL autorizado pode aprovar/rejeitar/desfazer a ação da mesma conversa com alvo atual existente. Não usar vendedorDonoId como responsabilidade; null=null não prova alvo válido. Alvo divergente não ganha exceção; continua a autorização global existente. Capacidades globais e APIs CRM permanecem. Escopo e usuário serão revalidados dentro da transação; o predicado puro exige contexto fresco/autorizado e existência do lead fornecidos pelo chamador.

## Matriz de locks observada em 16b

Todos os verbos atuais começam por AcaoAgenteIA FOR UPDATE (historico.ts:36). A tabela abaixo lista locks explícitos e DML; não afirma que SELECT simples trava linha.

| Caminho | Ordem posterior à ação |
|---|---|
| Aprovar RESPONDER/ENVIAR_DOCUMENTO | Atendimento FOR UPDATE (executor.ts:177), contexto/versão/preços/respostas, INSERT IntencaoMensagem, Evento |
| Aprovar MOVER_ETAPA/MARCAR_PERDIDO | Lead FOR UPDATE (executor.ts:260), UPDATE Lead, Evento |
| Aprovar TAG | INSERT PessoaTag; Evento |
| Aprovar ATUALIZAR_CAMPO | UPDATE/INSERT ValorCampoPersonalizado; Evento |
| Aprovar CRIAR_TAREFA | ConfiguracaoOperacional FOR SHARE (relogio.ts:6/executor.ts:423), INSERT Tarefa; Evento |
| Aprovar AGENDAR_MENSAGEM | Atendimento FOR UPDATE (executor.ts:449), janela/política/fuso, INSERT IntencaoMensagem; Evento |
| Aprovar NOTA_INTERNA | Evento; pg_notify transacional |
| Aprovar CONDICAO_COMERCIAL | INSERT Aprovacao quando necessário; Evento |
| Rejeitar | UPDATE AcaoAgenteIA; Evento |
| Desfazer etapa/perda | Lead FOR UPDATE; UPDATE Lead; Evento |
| Desfazer tarefa | Tarefa FOR UPDATE (historico.ts:148); UPDATE condicional; Evento |
| Desfazer agendada | IntencaoMensagem FOR UPDATE (historico.ts:167); UPDATE condicional; Evento |
| Desfazer tag/campo | DELETE/UPDATE da linha existente; Evento |
| Desfazer nota | Evento; pg_notify transacional |

INSERTs com FKs exigem proteção implícita das linhas-pai referenciadas. Tarefa referencia Usuario/Lead/Pessoa/Atendimento; IntencaoMensagem referencia Numero/Contato e vínculos de domínio declarados; PessoaTag referencia Pessoa/Tag; ValorCampo referencia Pessoa/Campo; Aprovacao referencia solicitante Usuario. AcaoAgenteIA.oportunidadeId/decididaPorId/eventoId são escalares sem relation no schema: não inventar FK. As migrações/triggers ainda precisam ser conferidas antes de classificar a matriz como fechamento completo.

Não há advisory explícito nos verbos acima. salvarConfiguracaoOperacional usa advisory 739204 antes do upsert de ConfiguracaoOperacional. A331 coordena advisory → Config → Atendimento → Tarefa. Introduzir Atendimento antes de aplicarAcao(CRIAR_TAREFA) criaria Atendimento → Config: não implementar assim. Necessária coordenação para pré-adquirir configuração antes de atendimento e manter o default global.

## Escapes de conexão encontrados por leitura

- montarContextoTurno(atendimentoId, tx), chamado após Atendimento em efetivarRespostaSugerida, chama buscarTrechos global quando há fala e fontes ativas (contexto.ts:99). buscarTrechos usa prisma.$queryRaw.
- AGENDAR_MENSAGEM chama exigirAgendamentoNaJanela(quando) sem tx; recusaForaDaJanela chama carregarPoliticaRegua e fusoDaEscola globais. fusoDaEscola já aceita cliente opcional; a política ainda não.
- A extensão db-aware mínima desses caminhos foi enviada ao integrador antes de qualquer patch compartilhado. Pool1 não pode ser considerado validado por estes UNITs.

## TDD inicial / evidências

- b5854e EXIT1: módulo novo ainda ausente, zero casos executados. Apenas falha de import, não evidência comportamental.
- 8a55c9 EXIT1: assinatura mínima negando exceção; 13 casos, 2 falhas e 11 passagens.
- 268fb2 EXIT0: 2 arquivos/23 casos (13 D1 + 10 permissões globais), worker1/heap1024, sem filtro de caso.
- Logs: output/inbox-354-autorizacao-red.log, inbox-354-autorizacao-red-casos.log, inbox-354-autorizacao-green.log.

## Próximos passos e whitelist prevista

Após coordenação de locks: fronteira decisao-inbox.ts, núcleos mínimos em historico.ts, exports aditivos em acoes.ts, produtor sugestoes-thread.ts e consultas-inbox.ts, DTO/CTA real de desfazer no cartão e confirmação canônica. Helpers compartilhados db-aware somente com autorização coordenada. Preservar APIs globais, marcadores404/gerações, limites20/keyset100 e consultas agrupadas. Testar ações reais, reversibilidade/alteração humana/envio, concorrência/revogação após locks/pool1, idempotência/eventos/avisos e regressões348/350/352. INT depende de nova lease; não executar agora. #355 edição, #356 pacote e #357 MANUAL/cancelamentos fora deste patch.

Não executados: DB/SQL/INT, TSC/global, build/Next/browser/HTTP, installs/schema/env. Sem PR/push. Não marcar concluída nem considerar produção autorizada pelos UNITs do predicado.

## Implementação DEV e evidências finais

Implementados os três núcleos mínimos em historico.ts e fronteira Inbox separada; wrappers globais mantêm autorizações e diferença histórica do desfazer. travarAcao continua privado; a fronteira usa seu lock local sem exceção na guarda de auditoria. Config de tarefa é capturada antes de Atendimento e passada como opção interna ao executor; default global segue o caminho anterior. Busca e janela/política são db-aware com defaults preservados. DTO filtrado e ação compartilham predicado/existência/Pessoa do alvo.

DTO traz capacidades por cartão, EXECUTADA/DESFEITA e autoria/data reais. Cartão recebe threadId, usa exports Inbox, confirma desfazer pelo ConfirmarAcao real e protege DOM/handler/ACK/foco contra404, perda/retorno de capacidade e A→B→A. Retorno local após desfazer aguarda liberação passiva do fundo; controle positivo impede roubar foco de outro botão. Guarda nominal exige exatamente2 controles dinâmicos originais+Desfazer literal/contorno, total3, com negativos adicionais; nenhum parser genérico/ConfirmarAcao/Modal alterado.

Último fechamento coordenado: RESPONDER/DOCUMENTO com oportunidade explícita divergente do lead efetivo atual exigem AMBOS os escopos globais no Inbox. Mesmo predicado em lote para DTO e decisão; leads são travados em ordem determinística. Vendedor não ganha exceção com divergência. APIs globais conservam comportamento histórico; teste real negativo Inbox/positivo API global caracteriza esse limite, sem afirmar correção global.

### Recibos terminais

| Etapa | Recibo | Resultado real |
|---|---|---|
| RED autorização assinatura ausente | b5854e | EXIT1, zero casos; falha de import, não comportamento |
| RED comportamental predicado | 8a55c9 | EXIT1,13casos/2falhas/11passagens |
| GREEN predicado+capacidades globais | 268fb2 | EXIT0,2arquivos23casos |
| RED integração D1 | sessão12021/0a79ec | EXIT1,11casos/7falhas/4passagens |
| Histórico global+primeira integração | sessão41079/b34abd | EXIT1,2arquivos43casos/42passagens; único fail era fixture de acesso linhaCOBRANCA, corrigida paraVENDAS sem ampliar ACL |
| GREEN contexto+pool1 real | sessão15795/f699f7 | EXIT0,2arquivos13casos |
| GREEN concorrência/defaultglobal/pool1 | sessão86408/2f8b25 | EXIT0,3arquivos52casos,229,41s |
| RED UI fronteira/confirmar | 2b6bab | EXIT1,8casos/7falhas |
| GREEN UI inicial | 6bc59c | EXIT0,8casos |
| RED produtor D1 | 747e10 | EXIT1,4casos/3falhas |
| RED estados executada/desfeita | 878bf0 | EXIT1,10casos/2falhas |
| RED guarda nominal+adaptação assinatura | sessão89192/3b51b8 | EXIT1,15arquivos241casos/5falhas; âncora fechada atualizada com GO, callback continua somenteID |
| RED auditoria/helper e ordem de props | sessão78205/7b2b72 | EXIT1,86arquivos1071casos/2falhas; helper permaneceu privado, sem exceção de auditoria |
| GREEN auditoria/consumidor353 | cdd502 | EXIT0,3arquivos29casos |
| GREEN capacidade/foco | 020c77 | EXIT0,2arquivos21casos |
| RED foco após desfazer síncrono | 071830 | EXIT1,11casos/1falha; log grande por diff de Elemento, não erro de produção |
| GREEN foco local/desfazer+350 | a9f63e | EXIT0,2arquivos22casos |
| UNIT amplo | sessão77278/6a462d | EXIT0,88arquivos1087casos,67,83s |
| INT amplo do recorte | sessão75695/ea223b | EXIT0,5arquivos78casos,332,46s |
| RED dois alvos UNIT | 5c17ea | EXIT1,5casos/3falhas |
| RED dois alvos INT | sessão33247/ef50fc | EXIT1,2executados/1falha,23fora do filtro |
| GREEN dois alvos UNIT | 75ea5e | EXIT0,5arquivos41casos |
| GREEN dois alvos INT | sessão1074/01dec4 | EXIT0,2executados/23fora do filtro |
| Lint final26arquivos | 838fc7 | EXIT0,--max-warnings=0 |

O UNIT88/1087 e INT5/78 são anteriores ao último patch restrito do predicado/locks Inbox dos dois alvos. Depois dele, o recorte afetado foi refeito conforme coordenação, sem repetir78 automaticamente. Não somar execuções como uma suíte única nem atribuir global/TSC ao head.

### Comandos e limites

Todos com Node local e max-old-space-size1024/Vitest maxWorkers1. UNIT amplo: vitest run src/app/(app)/inbox + escopo-decisao-inbox.test + sugestoes-thread.decisoes.test + permissoes-tela.test + botoes.test + crm-config/auditoria.test + confirmacoes.test + ConfirmarAcao.test + Modal.test. Config unit original, sem filtro de caso/skips no resumo.

INT78: vitest run --config vitest.integration.config.ts src/server/aria/decisao-inbox.int.test.ts src/server/aria/decisao-inbox.pool1.int.test.ts src/server/aria/historico.int.test.ts src/server/whatsapp/consultas-inbox.aria.int.test.ts src/server/aria/conhecimento/busca.int.test.ts --maxWorkers=1. Uma suíte por vez, fileParallelismfalse original. Último INT2 usou somente decisao-inbox.int.test.ts e --testNamePattern 'alvo efetivo:';23 casos desse arquivo não foram executados nessa chamada, já estavam na anterior78. Filtro declarado, não suíte completa.

Pool1 usa PrismaClient REAL com connection_limit1/pool_timeout2 no mesmo banco descartável e somente a fronteira de autenticação adaptada. Cenário de fontePRONTA+últimafala executa FTS real; cenário agendado lê política/fuso e desfaz. Trace guarda só categorias de locks/FTS, não SQL/binds. Config SHARE único precede Atendimento UPDATE, sem aquisição posterior no caso tarefa. Concorrência usa holder/observer reais, aguardando bloqueio observado antes de revogar; sem cancel/terminate.

Perfil .erp-test-profile=ci-integracao SHA256ae0f5496080ab61c84742dda9191a69579795188720819dc797386307101f01f; schema cliente local SHA256647c2586589198b10c9345265e0cce7a43819d5cb44633dbad5e0e0b611fae2b. Lease explícita ROOT após restore503/4920ffa3b. Nenhum outro processo/preview/worker B; as intenções são fictícias e não há provider/HTTP. Não afirmar que o banco foi restaurado após a suíte.

Uma tentativa de iniciar RED UNIT antes do terminal75695 foi rejeitada pela revisão automática por ordenação de suítes. Comando inteiro não executado/sem arquivo escrito. A mesma75695 foi acompanhada até EXIT0; só depois a retomada foi autorizada e o RED foi executado. Não houve contorno.

## Pendências da entrega

QA independente, TypeScript/gates globais e visual coordenados com ROOT. Não executados pelo DEV: TSC/global, build/Next/HTTP/browser, instalações/config/deps/schema/env, PR/push. Entrega de implementação e evidências focais; não issue concluída nem D3 implantado. Novosnúcleos/API/DTO/UI só #354; #355/#356/#357 continuam próprios.
