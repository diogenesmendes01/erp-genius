# #337 — menções em notas: checkpoint funcional DEV B

Base `6c50f901e350eb75eaf1dbbb2488f07d8fc487d4`, branch `codex/inbox-e2-337`, perfil isolado `dev-gravacoes`. Domínio, UI e schema implementados; gates dirigidos abaixo observados até a saída terminal. **Visual, QA independente, global integrado e publicação ainda pendentes.** O usuário priorizou reviews/merges existentes; não foi iniciado browser ou preview desta issue.

## Contrato entregue

O autocomplete opcional do Compositor consulta candidatos somente após sessão e leitura do atendimento. Busca de2–60caracteres, normalização comum de nomes do ERP, termo filtrado por SQL parametrizada antes do limite, até201candidatos relevantes e20resultados autorizados. ID, nome e campos de sessão são lidos do banco; UI mostra nome+papel, nunca e-mail/documento/ID técnico. Texto livre resolve somente aliases únicos; homônimos exigem token selecionado. Uma amostra truncada nunca é tratada como inequívoca: mais de200candidatos relevantes desabilitam a extração livre, mantendo tokens explícitos por ID revalidados.

Tokens validam trecho/limites UTF16/surrogate/sobreposição e nome compatível. Campo omitido conserva exatamente nota.trim()/hash legado, inclusiveCRLF; presente normalizaCRLF→LF/trim e usa coordenadas dessa nota. Alterações antes/dentro invalidam tokens; comando pendente é congelado, key/hash incluem metadados canônicos. Rascunho restaurado não reconstrói homônimo. Enter/IME, setas/Escape/Tab, owner/revisões C3 e ACK A→B→A continuam protegidos. Outros consumidores mantêm callbacks/props opcionais.

A action existente continua sendo o único caminho de criação. Na mesma tx da nota: usuário ativo/interno, exclusão do autor, leitura atual por destinatário com atendimentoVisivel(...,false,tx), Set e replay166. Sem carregar sessão/global dentro da tx. Nota/avisos/aviso SSE confirmam ou revertem juntos; não criam Mensagem/Intencao/envio externo. A PK da menção codifica inequivocamente o par Evento+destinatário; refId continua sendo o atendimento. Sem skipDuplicates ou timestamps de produção fabricados.

O sino recebe rótulo/hrefInbox codificado e filtra MENCAO_NOTA após revogação de leitura, sem mudar SLA/lembretes. Mantém o ciclo SSR/navegação atual; **não atualiza uma aba já aberta em tempo real**. Não há polling, novo EventSource, refresh ou consulta sob demanda do sino. A marca✦ das tags Aria permanece fora do delta.

## Migrações e operação executadas pelo ROOT

Reservas140000enum,170000criar parcial e180000retirar global autorizadas após preflightROOT3ebdf7. Cada SQL contém um comando, sem BEGIN/IF. Enum ao final, depois de SLA_ESTOURADO. Índice parcial `NotificacaoUsuario_legado_temporal_key` mantém tipo/refId/usuarioId/criadaEm para tipo<>MENCAO_NOTA; criação precede retirada do global. Guarda schema-sla agora comprova essa garantia legada e o novo teste verifica o conjunto, sem relaxar algoritmo.

SchemaReady foi escrito somente após REDs terminais. ROOTbe05f4 aprovou escopo; ajuste final de ordem/nome conferido. Hashes e bytes estão em inbox-337-evidencias.json, reconferidos sem alteração após DDL.

ROOT77153/d44777 saiu0: Prisma B gerado e3migrations aplicadas. ROOTab1fbc saiu0:4hashes iguais, ordem do enum, índice parcial unique/valid/ready nas4colunas e global ausente; notificações legadas preservadas, duplicatas recusadas; duas menções no mesmo horário aceitas e PK repetida recusada. Registros temporários removidos e423tabelas originais conferidas. Snapshot novo `inbox_snapshot_337_b_20261023`:424tabelas/1377registros/490migrations, fixture3mensagens/1nota. Somente helperROOT preservar-banco-337-b.mjs pode restaurar após DDL; nenhum helper322 foi usado depois.

DEV não executou Prisma, migration, instalação ou cluster. Banco foi liberado ao ROOT após20817, sem suite/preview/browser ativo; restauração final será registrada pelo integrador.

## TDD, fixtures e negativos preservados

- 6075b8: saída1, Sino apontava tarefa em vez de Inbox; helper novo ausente não coletou casos e não foi contado como RED funcional.7494b3 coletou24casos e falhou17/7pass com interfaces neutras. Puros56f62a:21pass/0.
- Candidatos/rota: primeiro import ausente sem casos; b39dce saída1 com6falhas/1pass causais.7bb22c passou28incluindo puros. O cap global201 inicial foi substituído por busca normalizada filtrada antes do limite, conforme ruling ROOT; testes cobrem José depois dos200usuários globais.
- DB90625 saiu1:6casos,4falhas causais (aviso, dedupe, token homônimo e trecho forjado),1erro de fixture/import concorrente e1pass. O ERR_MODULE_NOT_FOUND next/server de NextAuth não conta como RED da feature. Padrão já documentado em inbox-idempotencia.int.test: mockar somente exigirSessao e chamar carregarUsuarioFresco real evita import dinâmico simultâneo, preservando papéis/ativo/portal. GREEN inicial71905:6/6.
- UI inicial encontrou limitação do DOM mínimo com SVG; os ícones foram isolados somente na fixture, sem dependência/helper global. A/B40cbad na fonte anterior teve6falhas/1pass; fonte atual passou7. Não se atribui o erro SVG à feature.
- Schema6c6134:3RED;31206b:7GREEN incluindo encoding/SLA. Rename do índice e ordem do enum seguiram revisão ROOT, sem SQL extra.
- Recorte52182 saiu1:6arquivos/58casos,46pass/12fail. Novo18teve1falha de fixture: mesma tx não garantiu o mesmo criadaEm no caminho Prisma (diferença3ms). Duas notificações reais já existiam. Ruling ROOT autorizou alinhar apenas a segunda data ao valor real da primeira no teste, provando a constraint sem relógio novo no produtor.39403 passou18/18 após esse ajuste.
- As11falhas restantes de52182 são do SLA legado e seguem como pendência isolada abaixo. Nunca chamar6/58verde. Todos os logs são privados e ficam fora do commit; este relatório conserva a classificação e métricas.

## Gates DEV aprovados, separados por execução

| Execução | Escopo | Saída |
| --- | --- | --- |
|39403|nota-mencao.int completo:18casos,79,90s|maxWorkers1,0,sem filtro/skips|
|20817|nota-interna,inbox-idempotencia,crm/notificacoes,crm/lembretes completos:4arquivos26casos,85,65s|maxWorkers1,0,sem filtro/skips|
|40522|unitário principal:17arquivos365casos,38,64s|maxWorkers2,0|
|03db3e|consumidores Inbox/Conversa/Acoes:6arquivos171casos,4,36s|maxWorkers2,0|
|a2e52a|guardas e dependências:6arquivos132casos|0,subconjunto já incluído acima|
|58467|TypeScript projeto --noEmit --pretty false,heap8192|0|
|48ba89|ESLint dirigido aos23arquivos TS/TSX --max-warnings0|0,zero avisos ESLint|

Integrações usaram configintegration/perfilB490, uma suíte por vez, provedores vazios. Não é suíte global. TSC inicial45724 apontou readonly nos testes/payloadJson; corrigidos com tipos corretos e objetos explícitos, semcast. Recorte inicial71688 teve3falhas de guardas; ROOT aprovou somente âncoras exatas para option de menção (nome acessível/aria-selected) e2refs DOM useId. Cópia literal de exceções atualizada; nenhum algoritmo/limite/regex relaxado. A limpeza final removeu apenas whitespace excedente de EOF nos TS próprios antes de58467/48ba89.

## Pendência técnica isolada: SLA anterior à337

SLA runtime `src/server/whatsapp/alertas-sla.ts` permanece byteigual à base6c50, OID `9a16145433dfa241829488441d7f9bdb1916541b`; nenhuma mudança no produtor nem fixture permanente.

A primeira tentativa de filtro diagnóstico f8ceb7 pulou14casos e não executou nenhuma assertion. A repetição b78482 executou1caso e falhou, com13filtrados. Instrumentação temporária foi restaurada em finally. Mesma conexão/B comprovou:

- TimeZone: America/Sao_Paulo.
- Coluna salva: TIMESTAMP `2026-10-19 14:55:00`.
- Parâmetro Prisma: timestamp with time zone `2026-10-19 12:00:00-03` (=15:00Z).
- Comparação atual prazo<=parâmetro: false; comparação prazo<=(parâmetro AT TIME ZONE UTC): true.

O claim interpreta o timestamp UTC-sem-fuso como horário local, deslocando3h. A falha ocorre antes de inserir notificação e independe do índice de menções. ROOT aceitou o diagnóstico como defeito preexistente comprovado, não como gate aprovado e não como regressão causada pela337. Nenhum timezone, clock, janela ou produtor foi alterado para esconder falhas. ROOT coordenará a correção isolada antes da integração final. Não foi aberta terceira frente DEV.

## Checkpoint e pendências

Código funcional337 congelado para revisão independente. Faltam visual real/protótipo, QA exata, global integrado, adjudicação/correção SLA e publicação. Plano visual aprovado para fase futura coordenada pelo ROOT: homônimos com papéis distintos, teclado/caret/IME/foco/ACL, nota interna local pela action real e sino por SSR/navegação em3tamanhos×2temas, inclusive320×500. Escrita apenas no banco descartável, sem transporte. Não foi executado browser nem fabricada evidência.

Por prioridade nova do usuário, não iniciar visual ou outra funcionalidade; preservar este checkpoint e aguardar atribuição de review em outro branch próprio. Sem PR/push pelo DEV. Artefatos privados anteriores permanecem preservados, sem PNG/probes/logs/snapshots no commit.

## Retomada após os reviews e merge de ROOT 272a — 23/10/2026

Fontes: congelamento337 c203da6df3c47d1c69031c8d310880a7393da182 e ROOT 272a2b33452944d77b5f1e6ed2a750981f57c1bf. Branch follow-up51c2 preservada. Checkout e merge ocorreram somente no worktree DEV B, sem apagar privados nem usar force/reset. Os únicos conflitos foram quadro, import/assinatura do Compositor e mock useId.

Resolução investigada e aprovada pelo integrador: import useId única; buscarMencoes preservado; idAvisosAnexos incondicional antes dos hooks e listaMencoesId independente; button aria-describedby/small id por recurso e temCapacidade preservados; mock ROOT sem cast. Quadro combina os blocos dos dois lados e preserva a curadoria de frases históricas já corrigidas pela main. ConversaAberta automerge remove só props/imports triagem/revisoes órfãs, sem perder o glue da nota #337.

Comparação estática do índice conciliado: delta contra272a contém só30 caminhos originais337, nenhum path extra. Package/lock/scripts/seedQA, eventos-inbox, PainelContato Escape, useEventosInbox.interacao, consultas-inbox com remoção de contarNaoLidas e novo INTD13 da409 são idênticos ao ROOT. Nenhum painel/tags 324 foi alterado. As guardas diferem somente pelos registros exatos337 já autorizados.

Hashes SHA-256 físicos do checkout Windows preservados; os OIDs dos blobs Git são iguais a c203 (distinção de EOL detalhada abaixo):

- prisma/schema.prisma: 1bb9d8de80b8dd7ff35952145252a5022ac197e88376da4ea7a0571832c8221d.
- migration 140000: c52ce475401fd2211bd00d998701baaa104041309e7957210f2681fc03bdd5ef.
- migration 170000: ef5eeb9230496eb269d2a23794e6404aae63e61875b0b94c0a28ed88c908d86a.
- migration 180000: 17f536b92218054a506d5ff5ac78e6ffa4f4ba639b1ef7b029daaac9362f3bd8.

Nenhum gate runtime desta composição foi iniciado antes do cliente 490. O diff-check do delta próprio contra272a passou; o total contra c203 acusa CRLF no HTML docs/qa/pdf/05-automacao-de-testes-de-front.html herdado da QA280, cujo blob é exatamente o ROOT. Não houve normalização desse arquivo nem alegação de diff-check global limpo. O primeiro leitor de objetos tentou obter diretório pelo índice como se fosse arquivo e foi corrigido para write-tree; é erro de auditoria, não falha de produto.

Não gerar/aplicar Prisma ou SQL pelo DEV. O integrador preparará cliente 490 e verificará snapshot 337; nunca restaurar com helper 322. A falha de SLA por TIMESTAMP/timestamptz continua preexistente e separada, sem escondê-la por TZ e sem declarar o recorte6/58 verde. Os gates históricos deste relatório permanecem nominais a c203. Visual/QA independente/regressão da composição ainda pendentes.

### Precisão de hashes físicos e blobs Git

Os SHA-256 acima são dos arquivos físicos do checkout Windows, com CRLF; não são os hashes dos bytes LF dos blobs Git. Os OIDs Git do HEAD conciliado são exatamente os de c203, e cada arquivo físico, normalizado somente CRLF→LF em memória, é byte igual ao respectivo blob. Nenhum arquivo foi regravado/normalizado por essa comparação.

|Arquivo|OID do blob (igual a c203)|SHA-256 dos bytes LF do blob|
|---|---|---|
|schema.prisma|7365328d336ff6ae5892e46f1e595f25923e3f1e|536ab77c144fed18bc97e48af02ae5bf104639f2d5c87ca5650885821e41cbc2|
|SQL 140000|937af8132d8c33a27d068feefcdc29bdf8db8241|5d51c4eedf609b0b7d0c07d68850fbb17185c6eee4ea9747986d252f10344f05|
|SQL 170000|1fdef70b7d10a9337d17f343838ec4527e756f83|3ab60c179b6bf8198595b54cdca2858f4ae7451ae15da76d20d6093dc9ae6f21|
|SQL 180000|4154f32fccdaa04141ab3003e189faf5ed9bfb88|bbd88485484c5af76d20dbf0628012b110e26b51c8b066e2b5d73c62c47c819d|

O schema físico tem 9.744 quebras CRLF (436.127 bytes), contra 426.383 bytes no blob LF. Cada SQL tem uma quebra CRLF. O integrador esclareceu que o antigo hash de helper SchemaReady iniciado em 7569 antecede o congelamento c203; não deve ser reutilizado para DDL. O novo preflight é read-only, prova identidade ao blob c203 e conserva os três SQL físicos; nenhuma migração nova ou reaplicação foi solicitada. Esta correção de proveniência é só MD e não altera a fonte do merge 5541686f.

## Validação nova da composição e freeze para QA — 23/10/2026

Ambiente externo preparado pelo integrador: cliente Prisma 5.22.0 próprio, sessão 43744/0d5cb0 até terminal 0 (66,63 s), verificação física ca40cd0 e preflight read-only f968da0 do banco490/snapshot. Não houve generate, DDL ou mudança de perfil pelo DEV.

### Primeira rodada, fonte bf823765

- Nota-mencao: sessão 4687, 1 arquivo/18 casos, 61,88 s, terminal 0.
- Unitário principal: sessão 77314, 17 arquivos/432 casos, 431 passes/1 falha, terminal 1. Única ofensa: Compositor.tsx:366 shadow-lg. A classe já estava em c203; não se atribui a falha à alteração da guarda. Essa rodada é negativa, não verde.
- TypeScript 52562 e lint dos 23 fontes d360c2 terminaram 0 nessa fonte anterior ao ajuste de classe.

Depois de todos esses terminais, foi trocada somente shadow-lg por shadow-popover no popup. Nenhum algoritmo, whitelist ou limite de guarda foi alterado.

### Gates finais após a última mudança executável

|Sessão/execução|Recorte|Saída|
|---|---|---|
|38132|32 arquivos/671 testes unitários e consumidores, 38,57 s, maxWorkers2|Terminal 0, sem filtro de nomes/skips|
|85640|TypeScript noEmit/incremental, heap8192|Terminal 0|
|417416|Lint dos 23 fontes TS/TSX do delta337, max-warnings0|Terminal 0, zero avisos|
|36828|Quatro legados completos: nota-interna, inbox-idempotencia, crm/notificacoes e crm/lembretes; 26 casos, 90,69 s|Terminal 0, maxWorkers1/configintegration, sem filtro/skips|

O recorte de 32 arquivos inclui domínio/rota/sino/compositor/rascunho, guardas/schema, Inbox/rodapé/busca/ações/foco, acessibilidade384, Escape395, caminhos Git/CI e hook SSE compartilhado. Não é suíte global.

São 44 integrações dirigidas em duas invocações sequenciais. A sessão 4687 terminou antes de iniciar 36828. O backend é byte igual ao bf823765 após a mudança de classe; não se reatribui a INT18 à classe nova. Transportes vazios, sem envio externo.

Logs finais INT/unit estão privados em output/qa-private-337-retomada/. TypeScript e lint não emitiram diagnósticos e o Tee não criou arquivos vazios; seus códigos terminais foram observados. MIXED_EXPORTS/vite-tsconfig-paths existentes foram mantidos, sem editar tooling.

### Banco, pendências e handoff

O banco B490 foi liberado após o terminal 36828. ROOT restaurou exclusivamente pelo helper337/snapshot490 em 6dcf6e, terminal 0: 424 tabelas/hashes e migrações preservados, fixture original com 3 mensagens/1 nota, desconectada e sem provider. É operação do integrador, não execução do DEV. Nenhum processo de DB/preview/browser do DEV continua ativo; cliente490 próprio permanece preparado.

Não foi executado alertas-sla.int nesta rodada. A guarda pura schema-sla passou, mas isso não aprova o produtor runtime. O defeito TIMESTAMP/timestamptz e os 11 negativos históricos permanecem separados; não se mudou TZ para ocultá-los. O reparo SLA isolado só começará após novo handoff, preservando este congelamento.

Visual real/protótipo, QA independente, correção SLA, regressão integrada e publicação ainda pendentes. Nenhum servidor/browser/install/Prisma/SQL/cluster/push foi executado. O checkpoint acrescenta somente a classe do popup e metadados/SPEC/quadro, sem logs brutos ou PNGs.

## P2 independente: saturacao do sino por mencoes revogadas — 23/10/2026

Fonte inicial 9a9bfdc8a74cb6d2abc8487fd8b1fb766066aec2. Parecer TESTER output/inbox-337-review-estatica-tester.md, SHA256 f15717837b8a58d95a7a7deab2399909d8bc56f30347e174aae6b52a25788923, identificou take:20 antes da ACL: 20 mencoes revogadas escondiam SLA/lembrete validos nas posicoes seguintes. Ruling ROOT autorizou keyset/ACL em lote e explicitamente retirou teto rigido total, incompatível com 20 ultimos visiveis sob revogacoes arbitrarias.

### TDD e delta

RED b20aa1: terminal 1, 7 casos / 3 passes/4 falhas. A saturacao retornou [] em vez de SLA 21/lembrete 22; mais de um lote e empate tambem ficaram vazios; refTipo incorreto deixou so 19 validos em vez de 20. O mock respeita take, usuario/cursor e retorna fixture ja ordenada; a expectativa nao espelha o produtor.

Depois do RED, alterado somente listarNotificacoes: lotes fixos 100 de notificacoes do proprio usuario, orderBy criadaEm desc/id desc, cursor estritamente menor pela ultima linha examinada. escopoAtendimentos calculado uma vez; uma query de Atendimento por lote com IDs de mencoes deduplicados, refTipo correto e contato individual. Sem N+1, sort JS, ACL nova para legados, novo SQL de permissao/schema/guard ou acumulo de historico. Para em 20 visiveis ou fim. O custo total depende das paginas examinadas; memoria por pagina e consultas por lote limitadas, sem cap silencioso.

Teste unitario removeu apenas o mock do atendimentoVisivel anterior apos o RED, pois esse N+1 deixou de existir. Cenarios/assercoes causais permaneceram; GREEN imediato 0f4b1b: 7/7. Testes reais foram acrescentados a nota-mencao.int.test.ts: SLA 21/lembrete 22 apos 20 revogadas e 205 revogadas antes de 21 validas, com ACL de participante somente leitura, mesma referencia repetida e empate de timestamp. O oracle dos IDs validos usa uma consulta PostgreSQL independente na fixture, sem sort JS que suponha collation.

### Gates finais

- Unitarios 74707b: 7 arquivos/74 casos, 2,94s, maxWorkers2, terminal 0.
- Integracao sessao 35114: 5 arquivos/46 casos, 140,05s, terminal 0, configintegration/maxWorkers1, B490 exclusivo. nota-mencao completo agora20 + nota-interna/inbox-idempotencia/crm-notificacoes/crm-lembretes completos26. Sem filtro de nomes ou skips.
- TSC sessao 92181: noEmit/incremental, heap8192, terminal 0.
- Lint 7eafa7: tres fontes alterados, max-warnings0, terminal 0/zero avisos.

Os sete unitarios reais: notificacoes-mencoes, consultas-mencoes, SinoNotificacoes, lib/mencoes-nota, schema-mencoes, identificacao-registro e dependencias. Um argumento adicional src/server/inbox/mencoes.test.ts nao corresponde a arquivo existente e nao foi contado. Nao e suite global. Avisos preexistentes MIXED_EXPORTS/vite-tsconfig-paths preservados, sem alterar tooling.

Fonte permaneceu imovel durante INT/TSC/lint/unit. Depois dos terminais foram alterados apenas SPEC/report/quadro/JSON. Logs privados fora Git:
- output/inbox-337-p2-red-private.log — SHA256 93be9994fd0c3b89fbbdec45538bccf8479e1d078a91ea934d9a30d141d1c12d.
- output/inbox-337-p2-int-private.log — SHA256 4ec2b7df717b25c22c4b87ad22ed9b22c909e7462780fbc1f5d765700a8a4ef7.
- output/inbox-337-p2-unit-private.log — SHA256 1f322c08ac914eb8c660536cf0cbf6d165a170ecc226a5e862da43fafd677e9c.
TSC/lint terminais observados, sem inventar arquivos vazios.

### Isolamento e pendencias

Banco B490 reservado apos restauracao ROOT 82bbbd0 e liberado depois de 35114. Nenhum processo DB/preview/browser ativo. Restauração subsequente cabe ao ROOT/helper337/snapshot490; nao e alegada antes do terminal externo. Schema e tres migrations, deps/scripts e produtor SLA sao byte iguais a 9a9. A branch #410 e seu commit 1995d87c permanecem separados; nao sao gate integrado deste freeze.

Codigo do P2 entregue para re-review; QA independente final, visual local/prototipo, composicao com #410/regressao integrada e publicacao ainda pendentes. Nenhum envio externo, DDL, Prisma, install ou push pelo DEV.

## P2 visual: caret apos selecao e handoff ce658 — 23/10/2026

Fonte de browser anterior: a3bc5cb50b67aeab155d6d7f6733f9cdba6afa71. Preview ROOT 1278 (Node22/Next16.3.5), fixture com 4 atores / 2 convites validada por ROOT 5b77c2 / e83648. Credenciais foram lidas do JSON privado ROOT somente em memoria; nunca impressas/copiedas a manifesto ou Git. Nenhum submit de nota, CRUD manual ou marcacao de aviso foi executado. Leitura/teclado somente. ROOT parou 1278 em d80831 (CtrlC/exit1 esperado, nao gate) e comprovou 3111 livre em fb4ade0 antes de qualquer edicao.

### Diagnosticos de leitura preservados

- Sessao 81385 terminal1: timeout no helper historico semanticaThreadHumanaPronta, antes do editor. Negativo: output/inbox-337-probes/popover-desktop-2026-10-23T21-41-25.579Z/.
- Diagnostico dae333 terminal0 confirmou DOM real: saida antiga tem autor Admin fictício Inbox, status Não enviada; nota tem ID/autoria e zero botoes/status; dias presentes. Falhava somente a premissa literal “Você”, pois o novo autor e outra pessoa. Nao e regressao da tela nem autorizacao para relaxar a guarda historica.
- Preparador PRIVADO337 passou 4c924c, texto/ACL/viewport/foco corretos; inspecao dos metadados encontrou caret no fim. Essa saida 0 tem finding de inspecao e nao e aprovada para caret/allowlist.
- RED browser 2f3f66: desktop 1440×900 e mobile 320×500, ambos terminal1 por caret [35,35] vs [29,29]. Texto final “😀 @Alex Pessoa Fictícia 337 depois” e foco preservados; popup inteiro / documento scroll 0; GET candidatos 200 / body finalizado, 2 homonimos Professor/Vendedor e Financeiro excluido. Todos contextos fechados em finally. Pastas caret-exato-desktop-2026-10-23T21-44-28.355Z e caret-exato-mobile-2026-10-23T21-44-30.913Z. Screenshots/probes/raw privados, sem pacotes positivos.

### TDD e correcao

RED ReactDOM 6087af:4 falhas / 8 passes em 12; tres de caret causais e uma contagem incorreta da fixture (“intencao mais nova” tem 18 caracteres, nao 17). Corrigida somente essa literal; RED fiel d73a8f:3 falhas / 9 passes, indices 21/22 vs 15 nos tres casos de sufixo. O teste usa ReactDOM real e adapta apenas a fronteira textarea do DOM minimo local: trocar value move ao fim e setSelectionRange limita ao comprimento atual. O browser acima e a prova nativa independente da mesma ordem.

Compositor.tsx novo blob 4df042fa11516884b9911d99a012cba92ca7f298: ref de selecao pendente e useLayoutEffect sem espera assincrona. Contexto/revisao/texto precisam corresponder antes de focar/selecionar; ref consumido/descartado uma vez. Caret e inicio+trecho+1, tanto para espaco inserido quanto para um ja presente; sufixo preservado, UTF16. Sem props/API novas, helper compartilhado ou mudanca no fluxo de nota/idempotencia/C3.

Primeiro GREEN c3e91b terminou1: cinco testes antigos do DOM minimo nao possuem setSelectionRange. Restabelecida a chamada opcional ja existente no produtor anterior; sem alterar a semantica do textarea nativo. GREEN 30023c: 12/12. Acrescentado caso de texto igual, que ainda precisa aplicar selecao apos commit, total 13. Backend permanece byte igual a a3bc.

### Gates da composicao

- Sessao 8155: 45 arquivos / 775 testes, 38,31 s, maxWorkers 2, terminal 0, sem filtro/skips. Inclui os 32 arquivos de compositor/rascunho/Inbox/menções/sino/guardas e 13 arquivos unitarios do harness, excluindo explicitamente os 2 *.int.test.ts do harness. Lista privada output/inbox-337-caret-recorte-private.json, SHA256 2d063530ed33201a8fdc3a7cda727fbfca349e4467b841b5cf6860cca8e6b9c8.
- Lint inicial b89709 terminou1: unico binding campo sem uso na fixture nova.
- TSC 88861 terminou 2: somente duas TS2345 na fixture, pois assinatura DOM de setSelectionRange aceita number|null. Corrigido localmente null→0 sem cast e retirado somente binding sem uso. Sem mudanca produtiva depois do recorte 45/775.
- Teste final afetado c7b4a2: 1 arquivo / 13 casos, terminal 0, 532 ms.
- TSC incremental FINAL 5743f4: terminal 0.
- Lint FINAL 26ba94: 11 fontes (Compositor/teste + 9 fontes JS/d.mts/TS do handoff),max-warnings0,terminal 0 / zero avisos. README e MD nao entram como fonte ESLint.
- Nenhuma INT repetida. As 46 INT 35114 sao nominais a a3bc / backend identico; nao sao gate novo de caret/browser. Nenhum global proprio.

Logs privados e hashes:
- inbox-337-caret-red-private.log — a8aef30e0cac6cfe505b2642150b48309373164a4c0545679d8832b44bf79f03.
- inbox-337-caret-red-fixture-private.log — 448cad2e7a9bf27e53f8f54eddc245b81c3915f1d8b48106714eaf2712a6b263.
- inbox-337-caret-green-private.log — e1289cb1efa7c0345a20a9df08e33b7f111e5b7e1d9c5efce3f202aeb8cd5f25.
- inbox-337-caret-green-final-private.log — cc542b08f8ace776e0f43ec2618c0d4a3ac12fb99fabbc86460ffe2f98be3e11.
- inbox-337-caret-fixture-final-private.log — a78adbd7312b1a2339e54ed811fe8dbfa62f4e9da97647d580d8185ec62eeaad.
- inbox-337-caret-recorte-private.log — ab962c4241ece42c9dc9329178c060432b6c09dbeea3035d03f194c25e74f797.
TSC/lint finais sem diagnosticos; terminais observados, sem inventar log vazio. Avisos vite-tsconfig-paths mantidos.

### Handoff e limites

Portados SOMENTE 10 paths autorizados de ce658d8db49bca9a3f050072de2ef3e17c9cbe06, com blobs exatos: scripts/visual/README.md, capturar-inbox.d.mts/mjs, espera-app.d.mts/mjs, nucleo-captura.mjs e visual-inbox-cabecalho/coluna/painel/tags.test.ts. Nenhum produto 324, quadro324, SPEC324 ou report324 copiado. O estado painel-sem-nome/Tags e capacidade do harness, nao aprovacao desse produto na fonte337. O preparador historico314 permanece intacto no seu contrato; a prontidao privada para o novo autor e identificada, sem esperar “Você” de mensagem de outro autor.

AGENTS: retirado somente bloco Next gerado depois do stop, conferido contra HEAD; regras reais e CRLF preservados. Schema / 3 SQL / client 490 / deps / backend intocados; #410 @1995 continua separada. Fixture 337 permanece no B 490 para novo Ready, sem restauro/SQL pelo DEV nesta fase.

Integrador informou autorizacao HUMANA: “Sim, autorizar esses testes locais e a restauração”, referente ao escopo de ate 8 notas positivas / 2 negativas337 e leitura/marcacao no sino local, sem WhatsApp/email/externos. O bloqueio anterior foi respeitado e nao houve tentativa de contorno. As escritas so comecarao depois do novo Ready ROOT; preview antigo parado.

Proximo: re-review exato, preview/fixture com fonte atualizada pelo ROOT, REDbrowser→GREEN do caret (ainda pendente), IME/fluxo local autorizado e matriz 38 proposta/inspecao/allowlists. Nao declarar visual aprovado pelo unitario 775. Sem publicacao/merge/push.

Fechamento: acrescentado somente newline EOF ao teste apos os gates, conforme revisao do integrador; sem mudanca de corpo/logica e sem repetir recortes por formatacao. Parse/help offline do CLI e identidade10/10 dos blobs ce658 passaram em0710fa, saida0.

## Visual em d68 e correção da rolagem vazia — 23/10/2026

Fonte da prova: d68f678c8af2f17cb815647b68fa514e389c85f7, preview ROOT 10704, preflight HTTP 17c02a. O GREEN real do caret ff7ff9 confirmou [29,29] em 1440×900 e 320×500, preservando sufixo, foco, UTF16 e dois candidatos autorizados. Esses probes não submeteram notas.

A matriz terminou em duas execuções integrais distintas: 63719, seis referências de protótipo; 46979, 32 APP em 1440×900, 1024×768, 390×844 e 320×500, nos dois temas. Foram inspecionados os 38 PNGs. O protótipo compara somente o baseline de nota: autocomplete, ACL, sino e IME são N/A. A fonte HTML permaneceu intacta; a política DOM preserva os telefones fictícios +5500 e não equivale a substituí-los por um rótulo. Allowlist privada histórica: output/inbox-337-visual-allowlist.json, SHA256 4dd23f8d0a99ca448abbfdb6e7b5ff3a70dabd71e3821a5dbc4af4d5938f683e, 38 arquivos / 3.647.586 bytes. Não atribuir essas imagens à fonte corrigida abaixo.

As oito notas positivas foram submetidas uma vez cada pela UI/action real e confirmadas por ID/autor/corpo. Professor recebeu quatro avisos e vendedor quatro; cada contexto comprovou +1 somente no destinatário escolhido, zero no outro homônimo/fora e leitura persistida por navegação SSR. Nenhum realtime novo foi introduzido. ROOT b34b51, leitura terminal 0, confirmou as oito notas, oito notificações já lidas, nenhuma mensagem nova e IntencaoMensagem igual ao snapshot.

### IME e rejeição automática preservados

O probe privado 2fdbd3 terminou 1 por uma premissa excessiva: exigia que o popup permanecesse após Enter durante composição. Os eventos nativos CDP provaram isComposing=true e opção inalterada; Enter teve ação padrão de newline (@Al seguido de quebra), encerrando a consulta no cursor sem selecionar pessoa. Isso não prova um teclado IME específico do sistema operacional. Não foi chamado de GREEN integral.

A revisão automática rejeitou repetir esse probe porque três POSTs poderiam representar submits incertos. A execução foi interrompida, sem contorno. A auditoria ROOT b34b51 conferiu banco e servidor: eram respostasRapidasDoCompositor, marcarAtendimentoLidoAutomatico e respostasRapidasDoCompositor; nenhuma negativa tinha sido criada. O probe IME rejeitado não foi repetido. A autorização humana explícita “Sim, autorizar esses testes locais e a restauração” e a confirmação ROOT permitiram somente a primeira negativa já prevista.

### Defeito causal do placeholder

A inspeção dos dois PNGs 320×500 pós-ACK detectou primeira linha do placeholder cortada. Probe somente leitura confirmou baseline/foco/limpeza por teclado com value vazio, scrollTop 0, scrollHeight 62 e clientHeight 42. Era necessário observar o ACK real antes de atribuir causa.

Sessão 50732 terminou 0 e criou UMA negativa confirmada, ID cmvlj00yo002i53qv8e5z8xkb: escolher pessoa e depois editar antes do trecho invalidou o token. As contagens SSR permaneceram vendedor 4/professor 4/fora 0, todas não lidas 0. O ledger registra uma tentativa e uma confirmação; não houve repetição.

No mesmo editor 320×500, baseline vazio: scrollTop 0; antes do submit: 127/182/42 (scrollTop/scrollHeight/clientHeight); após ACK com value vazio: 20/62/42. Rect constante y442..486, primeira linha estimada y433, documento sem deslocamento. É defeito de scroll vazio confirmado, apesar da saída 0 do fluxo funcional. Fotos desse diagnóstico não são evidência positiva da geometria. Todos os contextos foram fechados; a segunda negativa foi suspensa. Restam zero positivas e UMA negativa na autorização original.

### TDD e ajuste mínimo

RED ReactDOM 39aa0a: cinco casos, dois falharam causalmente com scrollTop 20 em vez de 0 (nota e resposta), três passaram. A fronteira local do DOM mínimo reproduz somente a retenção/clamp nativo observado; ReactDOM, owner e ACK são reais.

A correção acrescenta um useLayoutEffect em texto/contexto que, somente com estado texto vazio E value DOM vazio após commit, define scrollTop=0. Não muda foco, seleção, owner, intenção, comando, resultado ou política de ACK. Erro, ACK antigo com intenção mais nova e troca para rascunho não vazio preservam valor, rolagem e foco.

GREEN 5b731c: 5/5. Recorte 26312: 46 arquivos / 780 testes, 39,82 s, maxWorkers 2, sem filtro/skips, terminal 0. Lint 69967a: duas fontes, max-warnings 0, terminal 0. TSC 91984 terminou 134 por heap padrão de aproximadamente 4 GB, sem diagnóstico de tipos; negativo privado preservado. Repetição 66860 com --max-old-space-size=8192 terminou 0, sem saída. Não inventar log vazio para essa saída.

Backend/schema/três SQLs/harness/deps são byte iguais a d68 e o backend segue a3bc: as 46 INT continuam nominais à fonte anterior, sem reexecução ou nova atribuição. Nenhum DB/Prisma/install/DDL foi executado pelo DEV nesta fase. ROOT encerrou preview 10704 com Ctrl+C/exit 1 esperado e confirmou porta livre em ff5a16/0. Foi removido apenas o bloco Next de AGENTS, preservando instruções reais/EOL.

Este freeze ainda exige re-review do ajuste, novo Ready e GREEN browser de um ACK usando a única negativa restante. Os 38 PNGs d68 continuam históricos com fontes e limite explícitos; não são capturas da correção. Fixture e nove notas permanecem no banco por decisão ROOT, sem restauração alegada. Composição #410, regressão integrada, pacote final e publicação continuam pendentes.

## Fechamento visual local e restauração — 23/10/2026

Fonte executável final: ab76f3f6cc921a8057dfac2b2d84454d6a689a49. Preview ROOT 10399, preflight HTTP 3bc38a, provedores externos vazios e cliente 490 próprio. A única negativa restante foi executada pela UI/action real, dentro da autorização humana original; não houve ampliação do limite.

A execução 274865 terminou 1 ANTES de qualquer click Enviar: Home→Inbox por links reais mudou a URL antes da montagem da linha Beatriz. nota=null e ledger sem nova tentativa, somente os três action IDs automáticos conhecidos. Foi preservada como negativa do oráculo privado. Após ACK técnico do ROOT, acrescentada somente espera de montagem da linha no probe privado, sem mudar produto ou harness compartilhado.

Sessão 56204 terminou 0. Seleção explícita de homônimo, navegação real Home→Inbox, remontagem do rascunho com texto preservado e sem token persistido, uma única submissão e nota confirmada cmvljozml0008146gxp2kt40m. As contagens SSR continuaram vendedor 4/professor 4/fora 0 e não lidas 0 para todos, demonstrando que o rascunho não inferiu destinatário homônimo.

GREEN do ACK em Chromium 320×500/claro: antes do envio scrollTop 87, scrollHeight 142, clientHeight 42; após ACK value vazio, scrollTop 0, scrollHeight 62, clientHeight 42. Rect y442..486 idêntico ao baseline, primeira linha estimada y453, documento scroll 0/0. A fonte anterior d68 retinha scrollTop20 e primeira linha y433. Sem refoco artificial; o layout effect não moveu foco/seleção. O placeholder continua com duas linhas numa área de 42px, como no baseline: não é alegado cabimento integral das duas linhas, apenas correção do deslocamento superior indevido.

As duas imagens antes/ACK foram inspecionadas e têm allowlist própria: output/inbox-337-ack-green-allowlist.json, SHA256 94c16eb57dfa9271be89348a16f568dc3424353dd8367357ceeabb129268efe0, 2 arquivos / 59.664 bytes. As 38 imagens da matriz histórica permanecem nominais a d68 e sua allowlist imutável SHA256 4dd23f8d0a99ca448abbfdb6e7b5ff3a70dabd71e3821a5dbc4af4d5938f683e. Não são 40 capturas de uma única fonte nem uma nova execução da matriz após o fix. Metadados curados distinguem as execuções; PNGs, probes e raw ficam privados.

### Auditoria e isolamento finais

ROOT c61217 terminou 0 antes do restauro: exatamente dez notas do autor fictício (oito positivas e duas negativas), oito notificações (quatro vendedor/quatro professor, todas lidas), zero para fora/autor, nenhuma Mensagem nova e hash de IntencaoMensagem igual ao snapshot. As duas negativas foram confirmadas uma vez cada; nenhum submit incerto foi repetido. O orçamento autorizado está esgotado.

Todos os browsers/contextos foram fechados pelo DEV. ROOT encerrou preview 10399 em c96325 (Ctrl+C/exit 1 esperado, não gate) e confirmou porta livre. Restauração ROOT df221b terminou 0, com 424 hashes originais, fixture fictícia de três mensagens e uma nota e snapshot337 preservado. Nenhum SQL/Prisma/DDL/restauro pelo DEV. Foi removido apenas o bloco Next gerado de AGENTS após conferir o diff, mantendo regras reais e EOL.

O complemento IME permanece limitado aos eventos nativos isComposing observados em 2fdbd3, cuja saída 1 veio de premissa excessiva sobre popup após newline padrão; a repetição rejeitada automaticamente não foi executada. A auditoria b34b51 classificou seus três POSTs como leitura/respostas rápidas, sem nota extra. Não se declara uma prova de todos os IMEs de sistema operacional.

Este fechamento altera somente MD/JSON/allowlists. Nenhuma fonte executável muda após ab76; seus gates 46/780, TSC heap8192 e lint permanecem nominais a esse commit, não ao commit documental. Backend segue a3bc e suas 46 INT não foram repetidas pelo ajuste visual. QA independente final, composição da #410, regressão integrada e publicação continuam sob coordenação do integrador. Ownership de scripts visuais liberado para A335 após este freeze; nenhuma outra funcionalidade iniciada.

## Preparação limpa para publicação — 24/10/2026

Branch codex/inbox-e2-337-preparacao, base congelada bf3443f4a922d2290ec18d372a4d2edf3ae69fb1. Origem final preservada em cae002d7a49c343a44f829be02ea61b72ccfc947. Os registros acima são históricos e seus gates não foram reatribuídos à nova composição.

Foram aplicados somente os deltas SRC/prisma de c203da6d → 9a9bfdc8 → a3bc5cb5 → d68f678c (dois SRC) → ab76f3f6 (dois SRC). O merge5541686f não foi reaplicado: as revisões da outra frente já estão na base. O harness misto d68 e seus testes visuais foram excluídos do porte; scripts/visual e matriz182 da base335 permaneceram intactos, sob ownership A326. As seis versões documentais finais de cae foram trazidas; no quadro, somente sete seções337 foram anexadas, sem apagar ou alterar o prefixo da base.

Três conflitos reais do c203 foram resolvidos por hunk: manter a guarda Tags da base junto às duas referências DOM337; manter useId tipado no mock; combinar buscarMencoes com idAvisosAnexos e as descrições acessíveis dos anexos. Os quatro patches seguintes aplicaram limpos. Verificação estática a5c946, EXIT0:25/28 paths iguais em LF à origem final; TODOS os executáveis, schema e três SQLs exatos. Dos24 TypeScript,22 têm AST do JS emitido equivalente; as únicas diferenças de JS são as duas guardas de Tags já existentes na nova base. A tipagem do mock em Compositor.test produz somente parênteses redundantes, sem diferença na AST. Essa prova não é typecheck, unit ou integração.

Os únicos IDs de migração são os três originais20261023140000/20261023170000/20261023180000. Não houve instalação, Prisma generate, schema novo, DDL, alteração de pacote/lock, DB, HTTP, preview, browser, push, PR ou merge. Cliente/perfil490 e lease serão preparados pelo ROOT após esta fonte; unit/TSC/INT dependentes ainda não foram executados. Não contar falha de cliente487 como RED de produto.

As provas visuais continuam nominais:38 imagens da fonte d68 e duas do ACK ab76, sem uma matriz40 atribuída à preparação nova. O ROOT registrou pacote histórico de3.743.253bytes, SHA256 db1203ff694febc3afb627b65d32f5eeac39b1ec8537f2411481bb7250546dfb, asset670630281/release draft421321214. Nenhum asset, PNG, ZIP, raw, credencial ou script privado foi portado. As oito notas positivas e duas negativas autorizadas já foram consumidas; NÃO executar novo submit/nota ou recaptura que grave. Placeholder de segunda linha permanece parcialmente visível: não se promete cabimento integral.

A interpretação dos contratos segue a origem: tokens selecionados e coordenadasUTF16, sem inferir homônimos; buscaSQL de candidatos antes do limite; nota/avisos/NOTIFY/idempotência na mesma transação; sinoSSR e P2keyset100 até20visíveis ouEOF, escopo único e ACL em lote; caret apóscommit com contexto/revisão/valor; ACK vazio zera sóscrollTop, sem foco ou seleção. Nenhuma dessas regras foi redesenhada no porte.

Fonte preparada para revisão e ambiente490. Gates atuais, QA independente exata, regressão integrada, CI/merge e publicação ROOT na ordem335→336→337 permanecem pendentes. A branch336, seu ZIP5FBD e as22PNG físicas foram preservados.

## Gates atuais da preparação limpa — 24/10/2026

Fonte executável congelada f971a9c84d1bf90981417f8c91f8ca1cffc773ea, branch codex/inbox-e2-337-preparacao, base bf3443f4. Nenhuma fonte mudou durante os quatro executores; tracked clean confirmado em 7a9c8e após o terminal.

ROOT preparou perfil dev-gravacoes/B490, sem DDL nova: auditoria 4cafa5, EXIT 0, confirmou 424 hashes/snapshot 337 e ausência de outras atividades. Generate próprio 3286/f147fb, EXIT 0 (64,86 s), cliente físico validado em 76cdae, EXIT 0, e Next typegen 0. O DEV não instalou, gerou, migrou ou alterou ambiente/cluster.

| Gate | Sessão/terminal | Resultado atual |
| --- | --- | --- |
| UNIT | 54035/1bd4f9 | EXIT 0, 46 arquivos/783 testes, 40,37 s, maxWorkers 2 |
| INT | 87016/3c2e61 | EXIT 0, cinco arquivos/46 testes, 165,26 s, maxWorkers 1/config integration |
| TSC | 78543/86130e | EXIT 0, heap 8192, nenhum diagnóstico |
| Lint | 413ab7 | EXIT 0, 24 arquivos TS/TSX, maxWarnings 0 |

UNIT inclui domínio, rota, sino, compositor, rascunho, ACK/scroll, guardas/schema e os 13 testes unitários existentes do harness da base; não altera ownership ou código do harness. A lista exata está no JSON curado. Integração executou os cinco arquivos completos: whatsapp/nota-mencao.int.test.ts, whatsapp/nota-interna.int.test.ts, whatsapp/inbox-idempotencia.int.test.ts, crm/notificacoes.int.test.ts e crm/lembretes.int.test.ts. Sem filtro de nome ou skips nas duas invocações. São recortes dirigidos, não suíte global.

Os warnings herdados vite-tsconfig-paths e MIXED_EXPORTS permaneceram; nenhum tooling/config foi alterado para silenciá-los. TSC/lint não emitiram diagnóstico; a prova é o código terminal observado na mesma sessão, não ausência de texto ou suposto arquivo vazio. Logs privados permanecem fora do Git; o JSON registra somente hashes/contagens quando o arquivo existe.

O banco foi liberado ao ROOT somente após 3c2e61, sem outra suíte B490 ativa. Restauro pelo helper 337B aguarda confirmação externa; não se presume execução. Nenhuma nota manual/UI, recaptura, mensagem externa, provider, preview, push, PR ou merge foi executado. As integrações automatizadas usam o banco descartável autorizado e não constituem nova prova UI.

A equivalência com cae foi comprovada antes dos gates: executáveis/schema/SQL exatos, mantendo apenas guardas de Tags da base nos dois testes. Os 40 PNGs permanecem históricos (38 d68 + dois ab76); orçamento humano de oito positivas/duas negativas esgotado. O placeholder de segunda linha continua parcialmente visível; não se promete cabimento integral.

Entrega DEV com gates atuais verdes na fonte f971. QA independente exata, ancestralidade final 335→336→337, regressão integrada, CI/merge e publicação coordenada continuam pendentes. Este complemento altera apenas documentação e não reatribui evidências visuais.
