# PR #399 — revisão R1 C1–C6 / DEV A

Base EXATA62e0f74db7729cf4c4e2bf63d055d57eb97d7022, branch codex/inbox-pr399-review-todos. Review5623766055 e comentários6357484157/6360064133 lidos integralmente do inventário ROOT output/inbox-pr-reviews-20261023.json. Sempush/comentárioGitHub/retarget. Branch398d5f78 e investigação324 preservadas; não foram transportadas mudanças de398/main/base407 para esta base isolada.

| Comentário | Disposição local | Evidência / limite |
|---|---|---|
| C1 HIGH empilhamento/main/CI | PENDENTE integrador no headfinal | Antecedente62e/332 e base318-r3 já documentam composição anterior, sem concluir gate modernoQA280/retarget/CI. Não alterei ancestrais ou manifesto/lock. CIremota/checkruns não consultados nem alegados |
| C2 MEDIUM integração das tags | PENDENTE gatefinal integrador | Histórico6357484157:12INT emab8, source/testDB byteidênticos na composição citada. Esse histórico nominal não prova execução no novohead. NenhumDB executado peloDEV nesta tarefa; root fará integração final |
| C3 LOW último dado/tags no sem-acesso | INVESTIGADO / comportamento intencional preservado | InboxNovo.tsx:331 mantém snapshotconhecido sómesmoid, limpa acoesContato e põe podeEnviarfalse. :368 exige painel.id===selecionado; :467 usa tags apenas desse painel. Recarga404 difere de404inicial. Não altera acesso ouUX; Aria/opt-out podem continuar visíveis a partir do snapshot, mas cadaaction revalida seus critérios no servidor. Não alegar remoção universal decontroles |
| C4 LOW esconder fechar em1100 | JUSTIFICADO pela SPEC/shell308 | Seção Casca e leitura de docs/specs/inbox-painel-contato-abas.md:960/1400/Sidebar224, overlayaté1399, manter saída em1100. Ref/fecharúnicos, no mobile volta e acima fecha; nenhumCSS/breakpoint alterado |
| C5 LOW contratos/props órfãos | LIMPEZA mínima + justificativa | aoFechar obrigatório/contato opcional preservam fallback308; min-h26 conserva quebra de rótuloslongos sem cortar. Removidos importtype e2props não consumidos daConversa; único testeSSR depropignorado retirado por autorizaçãoROOT. Três casos reais de composição/triagemsemseleção doInbox preservados, não novos testes de ausência deprop |
| C6 LOW volumeoutput | AVALIADO / indexado e preservado | Delta próprio após278615:23output/6699adições, nenhum removido. Índice abaixo explica os grupos e referência aoZIP histórico. Não apagar evidências/probes/negativos arbitrariamente nem atribuir capturaantiga a novohead |

## C3 — origem do snapshot e autorização real

A regressão existente em InboxNovo.interacao.test.ts tem título recarga por aviso que volta404 (acesso revogado) trava o compositor, sem erro de tentar de novo (C1 da revisão do#223). Ela exercita GET quepassaatravés do painel carregado e depois404, comprovando podeEnviarfalse/semretry. A regressão404na carga inicial segue errocomretry. Composição318 também comprova que outra seleção não reutiliza tags da anterior e que só há um painel.

O código do tratamento não faz cacheglobal nem passa resposta de A para B: conhecido depende doid e o renderpainelDoAberto também. Os dados previamente recebidos não são apagados retroativamente do mesmo contexto. acoes:null corresponde a AcoesContato, NÃO a todos os controles; aria eopt-out não são zerados aqui, portanto não afirmar desativação universal. Esse limite é intencional e não cria escopo no servidor.

Leitura fresh: rota /api/inbox/atendimentos/[id]/painel exige sessão/PAPEIS_INBOX e devolve404 quando carregarPainel retorna null porescopo. AcoesContato usa ServerActions existentes; Aria via acoes.ts delega historico.ts, que exigeDecisor e exigirEscopo dentrodatx; devolução confere escopo corrente em pausa.ts. AtendimentoVisivel continua usando escopoAtendimentos da sessão/tx. Isso não significa que todo clique após404 semprefalhe: outra alçada legítima pode existir, e cada ação aplica sua regra atual. Não executei ações reais/DB, nem encontrei leitura nova fora de escopo nesta inspeção. Não houve alteraçãoUX/segurança nesta review LOW.

## C5 — consumidores e remoção

Busca global src por JSXConversaAberta/PropsConversaAberta encontrou como único consumidorprodutivo InboxNovo; ele não passa triagem/revisoes. A funçãoConversaAberta nemdesestrutura essesprops. Os tipos ItemTriagem/RevisaoEnvio nessearquivo sóserviam aosprops órfãos. Remoção produtiva:umimporttype+comentário+duaspropriedades, semJSX ou regras.

Havia UM casoSSR que injetava triagem naPropsConversaAberta e sóafirmava que nãoaparecia, apesar depropignorado. Foi removido junto com ocontratoórfão mediante autorizaçãoROOT; não substituído por um teste vazio que renderiza semfornecer triagem. A cobertura funcional real continua emInboxNovo.interacao.test.ts nos três casos de composição318, que passam triagem aoInbox e verificam:ordemdosblocos+aprovaçãoAria+umPainelTriagem; tagsA→B/aba; telefoneausente/grupo/triagemsemseleção. PainelTriagem.test.ts também continua no recorte, assimcomo focos/diálogo/painel.

## C6 — delta próprio e mapa de evidências

Comparação read-only:gitdiff--numstat278615a9049086edb5bc2089ff75f5c58017efaa..62e0f74d--output. Ancestral confirmado;23arquivos,6699linhasadicionadas/zero removidas. Classificação:9MD305linhas,10JSON6319linhas,4MJS75linhas. Não é contagem do output inteiro ou de ancestrais. Linhasminificadas não medem custo/volumeexecutável; nenhum dessesprobes foi acrescentado ou alterado neste patch.

| Grupo próprio | Papel | Ligação com entrega existente |
|---|---|---|
| allowlist-positiva.json | índice positivo porfonte/hash/bytes/caminho/limites | 80screenshotsDEV,20pranchas,9JSONs,4probes; mídia não entra no novoGit |
| formal-r1/manifestos quatro | proveniência app×protótipo de painel-detalhes/tablet/celular e combinado | 20formaisd041, equivalênciaestática delimitada atéf5; nãoQAde navegação posterior |
| normal-r2/medidas.json | ACCNAME/viewport/foco/rolagem18cenários | 36screenshotsnormal9dd, inclusive antes domono; fonte não reatribuída |
| aria-r1/medidas.json | alcance porTab/rolagem sem executar aprovação/rejeição | 12screenshots9e, fixtureprivada preparadaROOT, semIA/envio |
| extenso-r2/medidas.json | nome97/15tags/altura500 eúltimocontrole | 12screenshotsf5, repetiçãoapósfixURL; não apagarnegativos locais históricos |
| resize-r4.json e equivalencia-d041-f5b7.json | identidade/focoentrelimiares e identidadeestática dosmódulos | complementam prova de um painel/ref; não substituemruntimeposterior |
| quatro medir-*.mjs | reprodutores dasmediçõespositivas curadas | mantidos sem alteração; nenhum novoexecutável/harness nesta revisão |
| noveMD incluindo pr399-qa | investigação, decisões, fonte/gates nominais, QA/limites e histórico de integração | não homologar uma fonte usando gates deoutra; backend12INT continua nominalab8 |

Referência remota HISTÓRICA já registrada porROOT em output/inbox-318-global-final.md:ZIP318 com142PNGpositivos/fontesDEV/TESTERdeclaradas,15.982.197bytes,SHA256c8e08228150f9d09bef0efe100b846cb3fec849987076d9b515cef0cd76fec8b,releaseDRAFT421321214/asset667770036. As allowlists e relatórios delimitam originais/pranchas, fontes e negativos fora dopacote. Não baixei/republiquei/reauditei esseZIPnesta tarefa, nem alterei PNGs/probes/manifests. Índice serve à revisão, não elimina história/proveniência necessária.

## Gates deste patch

Node22.23.2/executáveislocais. SemDB/browser/preview/Prisma/schema/deps/global/GitHub.
- Unitário FINALae680f terminal0:12arquivos165testes/3.26s/maxWorkers2,sem -t/skipsnovos; configuração unitária exclui INT. Recorte completo:ConversaAberta,InboxNovo.interacao,InboxNovo.foco,PainelContato,PainelContato.interacao,PainelSetor,PainelTriagem,LinhaCampo,paineis-tags,BotaoIcone,dialogo eInboxsem-polling. Inclui regressão223/404, separaçãoID/tags, três casos318reais, fallback/foco/ciclo/aba.
- Lint FINAL912b9e terminal0:duasfontes alteradas,max-warnings0.
- TypegenlocalNext0 e TSCpreliminar47467/2d530a0 foram observados antes da remoçãoCRLF efetiva. A revisão do diff detectou substituição literal não aplicada no arquivoCRLF; correção6b9db9 removeu as4linhas produtivas corretas e a linhaembrancoEOF do teste. Unit9372d4/lint7bdcf7/TSC47467 ficam SOMENTE preliminares, não gates do patchfinal. Recorte/lint definitivos acima foram repetidos; TSC FINALheap8192session42027/ee3e3c TERMINAL0. Nenhumconfig/dependência/harness foi modificado.

Gates finais locais acima concluídos, diffcheck/commitexato nohandoff. Pendentes:QAindependente, integraçãofinalC2 ecomposiçãomain/QA280/CI/retarget dointegrador(C1). Não afirmar todos oscomentários comoresolvidosnoGitHub por haver gateslocais. Instruções eartefatos398/324 preservados.
