# Painel do contato com abas — Inbox #318

Issue318/Task13, brief aprovado em output/inbox-318-investigacao.md. Base exclusiva243c9348454b6cca5795a6afa747efa25ed3eef1, branch codex/inbox-e1-318; contratos313 incorporados por merge normal, incluindo correção de seleção/NovaConversa e renome de fixture. Histórico de fontes, RED/GREEN e sessões em output/inbox-318-report.md. DEV entrega componentes, servidor, composição e harness, com provas reais descritas abaixo. QA independente final e global coordenado ainda pendentes; código final f5b7f5d018b2cbd61c793daf8827e3a4ffa5a4ff.

## Casca e leitura

PainelContato mantém visivel boolean|null, sobreposto, className, aoFechar, focarAoAbrir e children. contato/abas/abaAtiva/aoTrocarAba são aditivos e opcionais; sem contato conserva o cabeçalho308. Não muda useDialogo, inert, isolamento local, cleanup de layout, Escape do diálogo filho ou retorno ao gatilho. Uma instância/campo sobrevive coluna↔overlay; não há outro painel nem fechar duplicado.

Com contato: Avatar132 usa tomDoAvatar por id, nome20/500 e subtítulo setor·número recebidos; tags são só leitura, sem lápis/+tag. ✦ somente quando ia=true, com nome acessível. Tag tem mínimo26px e pode crescer para quebrar texto extenso. LinhaCampo é puro, recebe ReactNode escapado, ícone18, valor14,5/rótulo12,5, min52 e overflow-wrap:anywhere. InboxNovo só monta WhatsApp se contatoTelefone já veio não vazio; não há consulta nova de telefone ou alteração da Regra5.

Um scroller local engloba cabeçalho/abas/corpo, permitindo alcançar o conteúdo após nomes/tags extensos em tela baixa. Avatar não encolhe e nenhum campo é ocultado para caber. Geometria foi medida em preview:18cenários canônicos de altura500,resize,Aria e cenário extenso97caracteres/15tags,sem inferir sucesso pelas classes. PainelSetor retira padding externo, ajusta dt12,5 e preserva regiões, links, rótulos, datas civis, valores e estados vazios.

Não reproduzir hide1100 do plano antigo: shell308 usa960/1400 com Sidebar224 e permite overlay até1399. Fechar continua disponível na coluna manual com a mesma ref. O cabeçalho enriquecido consome BotaoIcone36 REAL313; wrapper absoluto evita disputar relative do compartilhado. aria-labelledby referencia textos responsivos Voltar para a conversa abaixo700/Fechar painel acima. ChromeCDP confirmou o nome computado nos dois temas/cortes; o aria-label legado e o fallback308 permanecem. Não editar BotaoIcone ou helperdialogo nesta issue.

## Abas e composição

ABAS_ENTREGUES é central, congelada e contém somente detalhes. IdAbaPainel reserva a união futura sem publicar controles futuros. abasDoPainel aplica a restrição comercialD13 ao mapa e retorna apenas Detalhes na E1, inclusive para setor desconhecido. AbasPainel é controlado, com role tablist/tab, aria-selected, roving tabindex, setas circulares/Home/End e ligação aria-controls/tabpanel. Seleção inválida cai na primeira disponível. Contagem usa mono/AI; o teste isolado de aba futura não a entrega na aplicação.

InboxNovo deriva identidade da seleção atual e tags apenas do painel de mesmo id. Estado associa atendimento/aba e é ajustado condicionalmente ao trocar seleção, sem efeito pós-paint nem remount. Callback rejeita aba não entregue. A correção313 de abrir/NovaConversa foi recebida por merge, sem reimplementar sua lógica.

Detalhes segue WhatsApp→setor→aprovaçãoAria→AcoesContato→OptOutContato(fora de grupo)→triagem/revisões. Wrappers locais normalizam padding/bordas dos blocos antigos e ocultam wrappers vazios; não editam suas regras/ações. A triagem foi retirada somente da thread selecionada de ConversaAberta; a ponte de triagem sem seleção continua no Inbox. Na revisão C5 da PR399, props triagem/revisoes da thread sem consumidores produtivos foram removidos; a triagem real segue no Inbox/painel, sem renderizar duplicata. Guards de id, rede, revogação, leitura otimista/SSE, SSR/agoraInicial, Coluna313 e ref382 preservados.

## Tags e autorização

TagPainel={rotulo,ia}; PainelSetor.tags é opcional para fixtures antigas, mas carregarPainel devolve sempre array. Só busca PessoaTag depois de carregarDadosSetor aplicar escopo/carteira/convite e autorizar pessoa comercial não responsável legal. Fora do escopo retorna null; lead oculto, pessoa legal/ausente e outros setores retornam[]. Nenhuma autorização substituída ou ampliada.

Query por pessoaId, orderBy tag.nome asc, select mínimo criadoPorId/tag.nome. ia é criadoPorId===null na associação PessoaTagD20. Não filtrar Tag.ativo: associação histórica segue legível, como no CRM existente. Helper interno não é action/endpoint. Saída sem IDs/nomes de autores, cor, telefone ou provedor. Sem schema/migration. Ações de contato, Aria e podeEnviar preservam as próprias proteções.

## Coordenação e verificação

Somente quatro registros específicos de guardas foram autorizados: aba1 em NAO_SAO_BOTOES_DE_ACAO, key a.id em CONTROLES_QUE_NAO_SAO_BOTAO e ALTERNANCIAS_SEM_ARIA_PRESSED (role tab/aria-selected), tag1 em DENTRO_DE_SUPERFICIE. Nenhum algoritmo/limite/registro alheio alterado. O fixture313 foi renomeado peloB para dialogo-retorno.fixture.tsx e continua varrido, sem exceção nova.

Integração permitida foi somente paineis.int.test.ts no dev-email após snapshot completo do integrador:12testes EXIT0. Ele restaurou424 tabelas/551 registros e confirmou fixture307/314 normal9mensagens4notas. Não repetirDB sem janela. Não houve seed/reset extra, instalação, package/lock/schema, transportes, servidorDEV ou full próprio318.

Após os fixes313359/b10/d95/9c incorporados: Node22.23.2, recorte51arquivos580testes EXIT0, TSCheap8192 EXIT0 e lint11afetados0/0avisos sobre f5b7f5d0; quatro probes MJS também lint0/0avisos. Não é suíte global. HandoffCLI foi autorizado aoA; quadro global318 continua coordenado pelo integrador. Provas/capturasDEV realizadas, QA independente final/global ainda pendentes. Nenhuma nova implementação apósfreeze.


## Harness318 e limites atuais

HandoffCLI recebido; estado painel-detalhes cobre os3tamanhos canônicos/2temas/2alvos,12PNG. Com tablet-painel/celular-painel são20formais; totaltodos106,estados313/314 preservados. Prontidão318 exige conteúdo autorizado/cabeçalho/avatar132/tags canônicas/Detalhesativa/fechar36/geometria/transição,sem exigir threadoculta. Manifesto grava fonteApp/hashes4módulos e anonDOM392 nosdoisalvos apósinterações/antesfoto. CLI não criafixture/seed nem submete ações.

Probes reais normais:18cenários emaltura500 naslarguras390/699/700/959/960/1024/1399/1400/1440,2temas,ACCNAMECDP/foco/rolagem/únicainstância/zerooverflow. Resize:2temas×10passos conforme automático308,mesmosnós e foco visível/nãoinert. Aria:fixture privada do integrador318,12cenários nos3tamanhos/alturascanônicas e500,aprovação/rejeição alcançáveis porTab/rolagem semacionar. Sugestão e9msgs4notas preservadas emGETposterior; dadosnão gerados porIA. Cenário extenso preparado pelo integrador9f646e:97caracteres/15tags,6casos emaltura500 repetidos na fontef5,header905px(desktop/tablet)/880px(celular),scroller1407/1418px,último controle porTab/scroll alcançável semoverflow. Triagem/grupo/telefone omitido têm testes de ligação/SSR/integração; não se alega captura real dos casos não preparados. O relatório distingue fonte9dd normal,9e resize/Aria e futurosformais, semaceite posteriorpresumido.


## Fontes e entrega visual

Allowlist positiva output/inbox-318-probes/allowlist-positiva.json:80screenshots,20pranchas,9JSONs e4probes. PNGs somente locais, sem PNG no commit. Negativos/logs/HTMLbruto/refsantigas/credenciais fora da seleção. Manifestos registram fonteApp e hashes,anonDOMv1 apósinterações/antesfoto. Probes privados não submetem formulário/ação/aprovação/envio.

- Normais:9dd098d2,18casos×2fotos,antes do valorWhatsAppmono; ACCNAME/foco/rolagem comprovados nessa fonte.
- Aria/resize:9e080190,12fotosAria/12casos e2temas×10passos de resize. FixtureSUGERIDA do integrador,botões apenas focados eSugestão/9msgs4notas mantidos emGET posterior.
- Formais:d04100cd,20fotos=12painel-detalhes+4tablet-painel+4celular-painel,app×protótipo/dois temas. Todas inspecionadas em10pranchas. ArquivoHTML original intacto. SóDetalhes/conteúdoERP/sem editar+tag/subtítulo setor·número são divergências planejadas; Sidebar/cortes960/1400 eclose persistente seguem ruling308.
- Extenso final:f5b7f5d0,6casos/12fotos emaltura500,após fixURL313;repetição positiva e inspecionada. Capturas extensas anterioresd041 sóhistórico local,nãoallowlist.

Equivalência estática d041→f5 de9módulos e JSX do painel registrada em equivalencia-d041-f5b7.json. Limite: não transforma fotos anteriores em QA de navegação/leitura/SSE posterior ao fixURL ou à corretiva382pendente. QA final do combinado é responsabilidade do fluxo integrador/TESTER. O parecer preliminar do TESTER sobre9e é favorável e parcial, preservado em output/inbox-318-parecer-preliminar-tester-9e080190.md.

O integrador encerrou preview50441 porCtrl+C/exit1 esperado. A restaurou apenas o blocoNext10linhas deAGENTS. Integrador restaurou snapshot original do dev-email,34417 EXIT0:424tabelas/hashesoriginais,canônicas307/314 preservadas; removeu fixtures318longa/Aria. Não houve DB direto peloDEV depois da integração12/12 autorizada. Confirmações/ações de negócio não executadas nos probes; não alegar prova real nova desses fluxos apenas por preservar componentes/testes.
## Revisão C1 da PR399 — composição atualizada

Base318-r3@167856f4 recebe4003b/398bc4 por merges normais, preservandof534.
Fonte33236c6e concilia apenas quadro; PainelContato/Conversa/LinhaCampo,
backend/testesDB/scripts/package/lock ficam idênticosaoee498. Produtores
394/R6/prazo puro/Avatar/SSE são atualizados sem mudar tags/permissões.
Recorte8/133 e global20394 EXIT0:883arquivos/6.926testes,sem filtros/ignorados;
Nexttypegen/TSC95347 e lint60640 EXIT0,0erros40avisos anteriores. Integração
DB12 permanece nominalab8, arquivos idênticos; sem novo DB/browser nessa
composição. TESTER332 favorável11/196+3/23 próprios,saídas0,sem DB/browser/
global/TSC/lint; CI/main/#392B2 pendentes. Base278615a9 recebe sódocs do
parecer398/limpeza404,source/deps iguais332 e zeroPNG298. Evidências e limites em
output/pr399-qa/ancestralidade.md.

## PR399 R1 — contratos C3/C4/C5 e índice C6

Revisão5623766055, correção local sobre62e0f74db7729cf4c4e2bf63d055d57eb97d7022. Nenhuma alteração visual ou de acesso nesta rodada.

- C3: recarga404/sem-acesso conserva SOMENTE o snapshot já recebido para o mesmo atendimento, como a regressãoC1/#223. AcoesContato sai com acoes:null e o compositor recebe podeEnviar:false. Tags e demais dados jáentregues podem permanecer visíveis até mudar o contexto; não há nova consulta autorizada por esse estado. Ao mudar selecionado, painelDoAberto exige o mesmoID e tags do antigo não são reutilizadas. Aria/opt-out járecebidos podem ainda aparecer: não se promete retirar universalmente todos os controles. Cada ServerAction revalida sessão/escopo/alçada atuais no servidor; o snapshot não é autorização. Carga inicial404 permanece erro, diferente de snapshot previamente entregue. RegraUX/permissões preservada, não houve nova política de apagar retroativamente o dado exibido.
- C4: hide1100 do plano é divergência resolvida pelo contrato geométrico308, seção Casca e leitura desta SPEC: Sidebar224, duascolunas a partir960 e trêsa partir1400, sobreposição até1399. O mesmo fechar tem função de sair da sobreposição e de recolher a coluna manual; escondê-lo em1100 cortaria a saída legítima do overlay. CSS/limiares/nomesacessíveis não mudam nesta revisão.
- C5: aoFechar continua obrigatório para manter operação do shell308, inclusive fallback; contato continua opcional para renderizar o cabeçalho308 antigo durante cargas/sem identidade. Props enriquecidas são aditivas, sem stub. Pílulas sóleitura têm min-h26 para caberem rótulos extensos e quebrarem linha sem clip, preservando altura26 nos rótulos curtos; h26fixo pioraria leitura/rolagem500. Não há redução de alvo interativo nem mudançaCSS. Foram removidos APENAS o importtypeItemTriagem/RevisaoEnvio e os props órfãos triagem/revisoes de PropsConversaAberta, sem consumidoresprodutivos. O único casoSSR que injetava esseprop ignorado saiu; a prova real de triagem pertence aos três casos existentes de InboxNovo.interacao.test.ts (liga identidade/tags...ordem...Aria; não reaproveita tags...; telefoneausente/grupo...triagemsemseleção), mantidos e executados. Não se adiciona teste que sóespelha ausência deprop.
- C6: após o ancestral próprio318-r3@278615a9049086edb5bc2089ff75f5c58017efaa, o deltaoutput real do head62e é23arquivos/6.699adições:9MD305linhas,10JSON6.319linhas,4MJS75linhas. Não inclui artefatosdosancestrais na conta. Metadados conservam origem/hash/bytes, medições500/nomeslongos/Aria/resize e negativos delimitados; não serão apagados arbitrariamente para reduzir diff. Relatório output/inbox-pr399-review-todos.md mapeia os grupos aoZIP318 histórico e mantém limites das fontes. Não houve PNG/harness novo ou reupload nesta rodada.

C1/retarget/main/CI e C2/integração final pertencem ao integrador. Os12INT históricos ab8 não são execução deste novohead; identidade de servidor/teste não substitui o gate final. Nenhum DB/browser/global executado nesta correção.
