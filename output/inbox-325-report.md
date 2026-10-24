# #325 — checkpoint DEV de Detalhes e B2B

Data: 24/10/2026. Ramo local `codex/inbox-e2-325`, iniciado em `8d843c06e52eaf78d2232a3033be10d0e9b59650`. Fonte executável congelada durante os gates finais. Sem push, PR ou merge por este DEV. Aceite visual e QA independente pendentes; não considerar a issue concluída.

## Resultado e limites

Detalhes comerciais apresenta oportunidade, contato, perfil/empresa e participantes B2B. O cabeçalho consome subtítulo e formato de avatar autorizados. “Na conversa” identifica o interlocutor; “Falar com” usa somente o href não nulo produzido pela #336. Links para ficha de contato e empresa dependem das capacidades próprias. Convidado comercial autorizado não recebe acesso global ou capacidade de envio por meio da apresentação.

O cartão Oportunidade é um link para `/funil?o=<id>`; não implementa callback, corpo ou aba vazia da #327. Não inclui editor da #326. Fora do comercial a composição E1 é preservada, assim como Aria, ações do contato, opt-out e triagem. O hook de leitura não cria intervalo ou assinatura SSE: faz aquisição no-store por atendimento/aba/versão/tentativa, abortando contextos antigos. A integração futura da #326 deve ampliar a mesma instância para Detalhes ativo OU editor, sem outro GET consumidor.

D13 segue o esclarecimento da PR409: dados contextuais comerciais para convidado atualmente autorizado, mantendo filtros existentes de Pessoa legal, carteira/linha e campos personalizados. Empresa/Pessoa conservam suas identidades. Não inclui CPF, idade, preferências ou extensões LATAM da #340, nem sufixo mensal presumido no valor da oportunidade.

## Proveniência da fonte 05588ca5

- `useAbaPainel.ts`: blob `1b7c10d948eff1207feb2bc0d4a4a5b2e3634ef9`.
- `useAbaPainel.test.ts`: blob `043ff1162a1791cc50bbf48909eb7b636881ddcc`.
- Ambos são cópias exatas do commit A `2de9d10b82b52a5d6b1492d3553eec4d3551c22c`; nenhum editor ou DTO antigo foi portado.
- `InboxNovo.tsx`: blob `f71bc641344023e9ab10d89aa0b14d0f3463b922`.
- `AbaDetalhes.tsx`: blob `2cf7d8e6870f1619c84d21502e2ff3ee40874173`.
- `BlocoB2B.tsx`: blob `57bd14b5610de489e1902aefe882cdaf2cf50250`.
- Schema487 permanece `1f575691cde242124c1493b8406121e8830a6f7e`; `painel-detalhes.ts` permanece `42d70b5184f8d0899f9cf342f66da446fc73079f`; `atalhos.ts` permanece `7d490e8af20bc8f4c10423574bb1e5d2a64a9d63`. Sem mudanças em Prisma, servidor, permissões, dependências ou harness.

## Gates nominais da fonte 05588ca5

Node22 local fornecido pelo integrador; Vitest instalado no worktree. Cliente Prisma5.22 próprio B487 gerado pelo ROOT, perfil `ci-integracao`, banco descartável `erp_genius_test_ciint`. A comparação oficial de schema/client do integrador `d10acc` terminou com código 0. Este DEV não gerou cliente, instalou dependências, migrou ou controlou cluster.

| Gate | Comando/recorte | Sessão / terminal | Resultado |
|---|---|---|---|
| Unitário geral | `node node_modules/vitest/vitest.mjs run --maxWorkers=4` | 4380 / 45dc6b | 924 arquivos, 7.252 testes, 157,10 s, EXIT0 |
| Integração | `node node_modules/vitest/vitest.mjs run -c vitest.integration.config.ts src/server/inbox/painel-detalhes.int.test.ts src/server/inbox/paineis.int.test.ts src/server/inbox/atalhos.int.test.ts --maxWorkers=1` | 32745 / d4e174 | 3 arquivos completos, 41 testes, 229,96 s, EXIT0 |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit --pretty false`, heap8192 | 95233 / 20aaf5 | EXIT0, sem diagnóstico |
| Lint | ESLint dos 9 TS/TSX desta entrega, `--max-warnings=0` | 2c76f9 | EXIT0 |

Nenhum filtro de nome ou skip imposto; os totais finais não são somas de execuções intermediárias. A suíte unitária comum exclui os arquivos de integração por configuração; os três arquivos de integração acima foram executados completos e não representam a integração global do ERP. Avisos existentes de configuração Vite/exports apareceram nos logs; não houve falha final de teste ou diagnóstico TypeScript/lint. Logs brutos permanecem privados fora deste relatório curado.

## RED e negativos preservados

- `a9262f`: RED com nove falhas de asserção e dois casos já válidos em onze testes. Apresentação ausente e consumo ainda legado. A tentativa anterior `822ff8` também encontrou três limitações SVG do DOM mínimo; essa parte foi corrigida na infraestrutura de teste antes de contar o RED de comportamento.
- `4aaffb`: GREEN inicial de três arquivos e 22 testes. Testes de apresentação cobrem moeda nula/zero, booleano falso/zero/data, links por capacidade, ausência legítima, distinção PJ/Pessoa e destino B2B autorizado. Testes DOM exercitam aquisição única, conteúdo fora do comercial e Retry real. O hook portado cobre abort, resposta atrasada, troca de versão/aba/seleção, SSR e StrictMode.
- O recorte intermediário encontrou dez falhas em dois arquivos legados. `InboxNovo.interacao.test.ts`: contagens/leitura em voo (2), fronteiras de leitura (2), ACKlocal150 (1), P2 props equivalentes (1), composição318 (1) e recuperação319 (1). O mock de rede passou a distinguir `/painel/detalhes` de lista; a composição passou a esperar AbaDetalhes e o cabeçalho do servidor. `InboxNovo.test.ts`: dois testes SSR foram ajustados à aquisição do DTO, preservando telefone mono fora do comercial e a guarda319 de seleção vazia. Guardas de leitura/SSE não foram reduzidas.
- A primeira suíte geral `31594/1e64ef` terminou EXIT1 com 924 arquivos, 7.252 testes, três falhas: `nenhum botão de ação montado à mão`, `todo <button> do painel passa por botaoClasses` e `nenhum arquivo de src cita Meta/Evolution fora dos permitidos`. O cartão foi corrigido para link de navegação e a fixture passou ao enum atual `DriverWhatsApp.MOTOR`. Nenhuma allowlist ou guarda foi alterada.
- O recorte causal `14043/bf295e` passou com 69 arquivos e 726 testes em 21,12 s, antes da repetição geral final verde. A primeira integração `28890/e014bd` passou 3/41 em 155,81 s; não foi atribuída à fonte final corrigida. O ROOT restaurou o banco em `c050a4`, com 424 hashes/snapshot498 preservados, e forneceu nova lease antes da integração final nominal acima.

## Banco, evidência e próximos gates

Uma única suíte de integração por vez no banco B487. Lease liberada ao ROOT após `d4e174`; nenhum novo uso de DB sem autorização. Restauro posterior não presumido. Banco490/snapshot337 não foi usado; ramo337, commit C3 `18be57f32bbf42591662d79c8460a9d270dcc5e0` e assets336 permanecem preservados.

Não houve UI manual, nota, envio, Assumir, Aria, CRUD manual, chamada externa, preview ou nova captura nesta frente. O harness permanece sob ownership da #326. PNGs/ZIP/referências brutas devem seguir a política de evidências privadas; nenhuma imagem antiga é atribuída à #325. Ainda necessários: handoff do CLI, fixture/preview coordenados, aceite real de Detalhes/B2B em temas/desktop/mobile com navegação dos links, curadoria positiva, QA independente, integração, CI e publicação pelo ROOT.

## Ajuste textual D13/LATAM após 05588ca5

O ROOT aprovou trocar o rótulo específico CNPJ por “Documento da empresa”, usando o mesmo `empresa.documento` já autorizado. O teste existente agora usa documento PJ chileno fictício `76.086.428-5` e mantém nome da empresa e identidade da Pessoa distintos. Nenhuma query, DTO, capacidade, schema ou consumidor de InboxNovo foi alterado. Documento/nascimento de Pessoa continuam na #340.

RED `c9d894`: um teste falhou de oito porque o rótulo ainda era CNPJ. GREEN relevante `97434/447bf9`: 69 arquivos/726 testes, 17,10 s, EXIT0, incluindo Inbox/servidor Inbox e as duas travas causais gerais. Lint dos dois arquivos `116014`: EXIT0, warnings máximos zero. O global 924/7.252, TSC e INT da tabela acima continuam nominais da fonte05588ca5 anterior a esta cópia; não foram reexecutados nem reatribuídos ao ajuste textual. Não houve nova suíte DB. Próximo freeze APP inclui este texto para as capturas325 ainda pendentes.

## Harness325 separado — preparo sem captura

APP permanece congelada em `ddf872e13078fb48c7648da9c2fc48b1d3f29438`. A fase de harness não alterou APP, servidor, schema, dependências ou canônica. Foram adicionados somente os três cenários aprovados: pessoa12 + B2B12 + convidado6 =30, mantendo190 anteriores e total220. Pessoa/B2B usam referências funcionais originais c1/c2; convidado é APP-only com N/A de autorização explícito. Não foi portado o harness/editor326 inteiro.

A impressão SHA-256 das190 combinações herdadas continua `c669324e360cf097784814ae7750dc2d54becb933b4d8f0ea27b416b236c1ea4`. As contagens históricas164/176/182 foram preservadas nos seus recortes, excluindo exatamente os três IDs novos. Auditoria AST `f3a43d` confirmou cinco funções idênticas953: esperarHidratacaoApp, semanticaPainelDetalhesPronto, semanticaRodapePronto, cancelamentoDeMensagensRecuperado e problemaReactNaCaptura. A espera comercial legada aguarda o cartão real325, mantendo os callbacks de sucesso/SSE/React e classificação de falhas.

Gates nominais do harness: RED inicial `dfb1f9` com sete falhas de matriz/módulo/roteamento325 ausentes; GREEN inicial `7d9c73` com sete testes. RED adicional `2192f3` com três falhas de destino/card e espera legada; GREEN `702e22` com onze testes. O recorte intermediário `e0b69a` encontrou16 falhas em sete arquivos: seis recortes de contagens históricas ainda incluíam os30 novos e fixtures Playwright legadas aguardavam a região Comercial removida. Foram ajustados somente os recortes/locators correspondentes; os testes de corpo, altura, transição, header, tags e SSE permanecem. `cf55fb` ainda registrou três fixtures geométricas sem locator, corrigidas antes do GREEN final.

Gates finais: `7a72c9`, 16 arquivos completos/115 testes, 2,80 s, dois workers, EXIT0; TypeScript heap8192 `226547`, EXIT0; lint dos14 arquivos JS/tipos/testes `fbda5b`, EXIT0 com warnings máximos zero; `node --check` dos quatro módulos JS `74e4b9`, EXIT0; CLIhelp `716943`, EXIT0, sem browser/DB. Sem filtro por nome ou skip imposto. Estes são gates do harness, não novo global do produto nem integração/captura.

Plano e fixture permanecem privados/não versionados: `output/inbox-325-visual-plano-private.md` SHA256 `49541C41E88F00EA3EC8D16538A5D318035CBDBA7A6737F9CD1283F4BA294056`; `output/inbox-325-fixture-plano-private.json` SHA256 `4DD860329492C364F82C0F30F72110517C4F25B0410779DEAB439F1A77EFFEE2`. Blueprint offline35novos/15tabelas/IDsfechados, aplicadofalse, duas mensagens ENTRADA TEXTO e nenhuma nota/saída. Referência PaisCL/CLP depende de inspeção ROOT; se ausente aborta sem mudança implícita de catálogo. ROOT gera os dois hashes de senha em privado. Nenhum apply, HTTP, browser ou captura foi feito nesta fase. ROOT confirmou restauro anterior `d6b5fd`/424hashes/498originais após a integração de produto; não houve nova suíteDB.

Próximo gate: ROOT inspecionar/aplicar fixture, confirmar novo READY/preview e aprovar IDs das duas ações incidentais de leitura. Depois executar30 formais e seis complementares320×500 somente leitura, navegar links autorizados sem Save/envio/Assumir/nota/Aria, inspecionar/curar novas fotos e devolver browsers/banco para stop/restauro. Aceite visual, QA independente, CI e publicação permanecem pendentes.

## Negativo real e helper restrito GETDetalhes

O primeiro navegador `26ab1b` terminou EXIT1 e parou no primeiro estado. Uma PNG foi rejeitada e preservada em privado: `app-escuro-desktop-painel-detalhes-pessoa.png`,143.959 bytes,SHA256 `34cebbd989d907bc62e7f42755ac12ca49afdd5f7aaf13d005d6d4d5e9c78a37`. Fonte APPddf/harness364. Conteúdo/links/teclado estavam corretos e SSEmax1, mas GETDetalhes START35 cancelado não tinha classificação de recuperação. Nenhuma foto desse lote foi aceita; contexto/browser fechados em finally. Não se reclassifica o lote antigo após mudar o harness.

Diagnóstico focado autorizado `c588cb` também permanece EXIT1, sem PNG nova. Na mesma página/contexto/atendimento, START35 foi abortado sem headers; START38 e48 foram posteriores, com headers200 e corpo concluído, ambos com hash `6d0da37fe5328bc254cc6bf08cc7194e5a258a902ff2894c700a959914f1d87f`, igual ao GET esperado. Essa evidência motivou o novo helper; não constitui aceite de captura.

A recuperação nova é estrita: GET exato de `/painel/detalhes`, origem/path/ID sem query/hash, identidade real de página/contexto, START posterior, headers200 observados, fim do corpo e SHA JSON canônico igual ao preflight. No fechamento da coleta exige página ativa, mesmo atendimento atual e `semanticaDetalhes325Pronto` reavaliada após todos os corpos e interações. Não aceita mudança/desmonte, body diferente,200 sem fim, ID/contexto/página diferente, POST, SSE ou erro sem substituto. O classificador953 não foi alterado e não se usa horário de chegada do abortevent como ordem de requestSTART.

TDD causal: `6f25b8` RED23 falhas/11pass; `0d0ee4` GREEN16arquivos/138testes. Gates finais: `b6c655` EXIT0,16arquivos completos/138testes,4,07s,dois workers; TypeScript60126/f7c101 EXIT0,heap8192; lint4 `a1e86d` EXIT0,warnings máximos zero; syntax2 `d86b3f` EXIT0 (módulos runtime idênticos após o gate). Sem filtros de nome ou skips impostos. Auditoria425ac1 confirmou os cinco corpos de guardas953 idênticos e a semântica325 idêntica364. APPddf/servidor/schema/deps permanecem intactos.

Validação focada final `c578af` EXIT0: zero PNGs, uma página/contexto, todos fechados; START35→38/48,headers200/bodyfim/hash esperado iguais; semântica final325 true depois dos corpos e Tab, atendimento atual correto, somente três POSTs das duas ações incidentais autorizadas e SSEmax1. O manifesto privado tem SHA256 `f427c0ea91b480ee674a5ccc2ab4bcbb604ce0ef338fa10dc5ed0af29b4d555b`. Fonte runtime registrada por hashes do delta local sobre364 antes do commit, sem reatribuir ao364. A validação focada não é aceite visual e não produz foto publicável. Próximo gate: revisão estática independente do helper comprometido e avalROOT para nova rodada30+6; nenhuma retentativa formal cega foi executada.

## Revisão R2 — barreira de todos os STARTs de Detalhes

A revisão independente encontrou uma falha real no coletor de `d1f51e74fc96d6f36b195dcbc340089b36b07bf9`: as Promises eram adicionadas somente em `requestfinished`. `Promise.all(conclusoes)` podia terminar com um GET já iniciado ainda em voo. No cenário 35 abortado, 38 íntegro e 48 pendente, a recuperação de 35 por 38 passava; o fechamento podia cancelar 48 depois da classificação. A validação focada `c578af` permanece nominal e sem PNG. Ela não prova a conclusão de todos os STARTs, nem autoriza aceite visual. O lote `26ab1b` e o diagnóstico `c588cb` continuam negativos preservados.

Diagnóstico causal posterior `7f1915`, EXIT1 esperado: os callbacks originais foram extraídos por `git show d1f51` e executados com EventEmitter, sem HTTP/browser/DB. Três STARTs produziram apenas uma Promise de conclusão; antes do finally havia um aborto e zero falhas classificadas. O segundo aborto chegou depois. O falso verde agregado foi reproduzido em memória; o script e a saída bruta permanecem privados.

O módulo novo `coletor-detalhes.mjs` instala listeners antes da navegação e cria uma Promise por START do GET exato, no mesmo contexto/página/atendimento. O fim exige `requestfailed` ou `requestfinished` com headers observados, leitura de corpo terminada e hash canônico. A barreira aguarda snapshots sucessivos, incluindo STARTs/callbacks acrescentados durante a espera, até zero pendências e revisão estável, com prazo comum de até 30 s. SSE e URLs com query não entram nessa barreira finita; continuam sob suas guardas existentes.

Um token da revisão estável só sela a coleta junto da identidade e semântica final do atendimento atual. Qualquer evento desse endpoint depois do selo invalida a candidata. Os listeners permanecem ativos durante `context.close` e até `browser.close`; há auditoria parcial após o contexto e veredito final após o browser, com espera final limitada a 3 s. Timeout, ausência de fechamento confirmado, START/falha tardios, body divergente ou pendência residual reprovam. O aborto de 48 não pode usar 38 como substituto porque a recuperação exige START posterior. Uma foto eventualmente gravada permanece candidata até essa auditoria final; o CLI só imprime o resultado depois dela.

TDD e verificação:

- RED inicial `708439`: oito testes de eventos falharam porque o módulo novo ainda não existia. Essa execução não é apresentada como reprodução do coletor antigo.
- GREEN inicial `a60bb8`: oito testes. Ampliação posterior cobre 12 cenários do coletor, além dos 138 testes anteriores do harness. Os cenários incluem 48 em voo, START durante await/body, timeout de corpo, token obsoleto, falha após selo/fechamento, body divergente e listeners até o browser fechado.
- Negativo de TypeScript `f92f1d`: TS2339 no emissor fake do teste. A fixture passou a usar a referência explícita do EventEmitter; nenhuma asserção foi removida.
- Gate final `40d4ce`, EXIT0: `vitest run src/test/visual-inbox --maxWorkers=2`, 17 arquivos completos/150 testes, 3,19 s. Sem filtro por nome ou skip imposto; é recorte do harness, não global de produto nem integração.
- TypeScript `fc8bb6`, EXIT0: `tsc --noEmit --pretty false`, Node com heap 8192.
- Lint dos quatro arquivos alterados/novos, warnings máximos zero, sintaxe dos dois módulos runtime e `git diff --check`: `4a7fc3`, EXIT0.
- Auditoria `676afb`, EXIT0: zero delta em APP/servidor/schema/dependências. `nucleo-captura`, `espera-app`, `estados-inbox`, `entradas-inbox` e `detalhes-inbox` permanecem iguais a d1f51 após normalizar apenas CRLF/LF. O classificador e os guardas953 não foram alterados.

SHA256 físicos no freeze verificado: `capturar-inbox.mjs` = `fa471850a764759d9af30a739a473a8ca6d74ef4bb576cc00e934fb5dc2d0141`; `coletor-detalhes.mjs` = `fa3abdc7679a6ba78cb31ae8ef4085bbbbd239fc87f88ce421bc3e784fd46dab`. APP permanece `ddf872e13078fb48c7648da9c2fc48b1d3f29438`; matriz 190+30=220 preservada.

Nenhuma nova navegação HTTP, execução de browser, captura, integração ou alteração de banco ocorreu nesta revisão R2. O executor privado será alinhado ao mesmo coletor antes de qualquer nova rodada autorizada. As 30 fotos formais e seis complementares continuam pendentes de revisão do delta e aval ROOT; não há nova PNG positiva ou aceite visual. QA independente, CI e publicação também permanecem pendentes.

## Curadoria visual DEV — corpus composto de 36 arquivos

Parecer próprio favorável após inspeção individual das 36 imagens: 18 APP formais de L1, 12 referências estáticas e seis APP320 de L2. Fonte APPddf/harness96c sem delta. L1 (74891/eb2985) permanece EXIT1: primeiro PROTO recusado sem PNG; somente suas 18 APP sem falhas foram selecionadas por arquivo após auditoria final. L2 (18441/ba4c36) terminou 0, 18/18, sem repetir as 18 APP. Na aplicação: 71 STARTs=71 conclusões, zero pendências, 72 links por Tab, alvos de 44 px, duas SSE sequenciais e máximo uma simultânea por página. Fontes individuais e limites estão em output/inbox-325-visual.md e output/inbox-325-visual-allowlist.json.

A referência original tem componentDidUpdate sem prevState e falha antes de toBottom. Exceção exata somente no alvo PROTO, para mensagem+stack/callsites e hashes originais: 36 ocorrências privadas; outros erros continuam falha. As 12 referências comprovam somente painel visual estático, sem autoscroll, posição da thread, foco, comportamento após seleção ou aceite funcional. Convidado continua com N/A de autorização. Nenhuma exceção APP/953. Em 320×500, documento e rótulo ficam contidos com rolagem real; uma linha posterior pode aparecer parcialmente na borda.

Probes 53179/a656b7: EXIT0, seis de seis. Links reais por Tab+Control+Enter, duas páginas auditadas por contexto e SSE máximo uma por página. Funil prova ID e título real Mariana Costa325, distinto do produto Espanhol Intensivo325; contato e empresa reais; Admin A/B200, leitor A200/enviofalse e B404/href ausente. Alvos A/B sem lead comprovam ausência legítima de oportunidade. O probe anterior56898/2df241 permanece EXIT1 administrativo, por título indevido e init em about:blank, sem falha APP. O executor nominal fd95c2dd foi preservado antes do guard futuro f7ffe5, não executado; hashes conferidos em af1642. Nenhuma recaptura das 18 APP nem reclassificação dos negativos26ab1b/c588cb/d1/7f1915.

Corpus: 36 PNGs, 3.434.158 bytes. ZIP privado inbox-325-aceite-ddf872e-96c9e607-20261024.zip: 3.361.508 bytes, 38 entradas, SHA256 37f09534f89890984efb6316fe9ccf999593097306b711f301248d28f3b28d69. Contém 36 PNGs, manifesto e README curados; os 38 hashes foram lidos e conferidos em ba3da5/EXIT0. Nenhum PNG, ZIP, raw, script privado ou credencial no commit. Gates do harness continuam nominais96c (17/150, TSC/lint/sintaxe0); global e INT de produto seguem nominais0558. Hashes físicos e GitLF do coletor foram reconciliados na allowlist.

Nas provas positivas houve 99 chamadas das duas ações automáticas autorizadas; nenhum Save, Assumir, Aria, nota, envio, CRUD ou integração externa. Contextos e browsers encerrados. ROOT stop97596/9d0c00, Ctrl-C/saída1 esperada, e restauroae152c/0 confirmaram 424 hashes/498 linhas; AGENTSNext restaurado sozinho após stop. Nenhuma nova HTTP, DB ou browser. Aceite visual DEV favorável por arquivo; QA independente da curadoria, composição, CI e publicação pendentes. Comuns/harness congelados para handoff327 após commit; próxima implementação exige GO.
