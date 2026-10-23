# Painel do contato com abas — Inbox #318

Issue318/Task13, brief aprovado em output/inbox-318-investigacao.md. Base exclusiva243c9348454b6cca5795a6afa747efa25ed3eef1, branch codex/inbox-e1-318; contratos313 incorporados por merge normal, incluindo correção de seleção/NovaConversa e renome de fixture. Histórico de fontes, RED/GREEN e sessões em output/inbox-318-report.md. Este checkpoint implementa componentes, servidor e composição; aceite visual, TESTER e global permanecem pendentes.

## Casca e leitura

PainelContato mantém visivel boolean|null, sobreposto, className, aoFechar, focarAoAbrir e children. contato/abas/abaAtiva/aoTrocarAba são aditivos e opcionais; sem contato conserva o cabeçalho308. Não muda useDialogo, inert, isolamento local, cleanup de layout, Escape do diálogo filho ou retorno ao gatilho. Uma instância/campo sobrevive coluna↔overlay; não há outro painel nem fechar duplicado.

Com contato: Avatar132 usa tomDoAvatar por id, nome20/500 e subtítulo setor·número recebidos; tags são só leitura, sem lápis/+tag. ✦ somente quando ia=true, com nome acessível. Tag tem mínimo26px e pode crescer para quebrar texto extenso. LinhaCampo é puro, recebe ReactNode escapado, ícone18, valor14,5/rótulo12,5, min52 e overflow-wrap:anywhere. InboxNovo só monta WhatsApp se contatoTelefone já veio não vazio; não há consulta nova de telefone ou alteração da Regra5.

Um scroller local engloba cabeçalho/abas/corpo, permitindo alcançar o conteúdo após nomes/tags extensos em tela baixa. Avatar não encolhe e nenhum campo é ocultado para caber. Classes/SSR não comprovam geometria: altura500, cortes e último controle ainda exigem preview. PainelSetor retira padding externo, ajusta dt12,5 e preserva regiões, links, rótulos, datas civis, valores e estados vazios.

Não reproduzir hide1100 do plano antigo: shell308 usa960/1400 com Sidebar224 e permite overlay até1399. Fechar continua disponível na coluna manual com a mesma ref. O cabeçalho enriquecido consome BotaoIcone36 REAL313; wrapper absoluto evita disputar relative do compartilhado. aria-labelledby referencia textos responsivos Voltar para a conversa abaixo700/Fechar painel acima. A comprovação do nome computado fica para o preview; o aria-label legado e o fallback308 permanecem. Não editar BotaoIcone ou helperdialogo nesta issue.

## Abas e composição

ABAS_ENTREGUES é central, congelada e contém somente detalhes. IdAbaPainel reserva a união futura sem publicar controles futuros. abasDoPainel aplica a restrição comercialD13 ao mapa e retorna apenas Detalhes na E1, inclusive para setor desconhecido. AbasPainel é controlado, com role tablist/tab, aria-selected, roving tabindex, setas circulares/Home/End e ligação aria-controls/tabpanel. Seleção inválida cai na primeira disponível. Contagem usa mono/AI; o teste isolado de aba futura não a entrega na aplicação.

InboxNovo deriva identidade da seleção atual e tags apenas do painel de mesmo id. Estado associa atendimento/aba e é ajustado condicionalmente ao trocar seleção, sem efeito pós-paint nem remount. Callback rejeita aba não entregue. A correção313 de abrir/NovaConversa foi recebida por merge, sem reimplementar sua lógica.

Detalhes segue WhatsApp→setor→aprovaçãoAria→AcoesContato→OptOutContato(fora de grupo)→triagem/revisões. Wrappers locais normalizam padding/bordas dos blocos antigos e ocultam wrappers vazios; não editam suas regras/ações. A triagem foi retirada somente da thread selecionada de ConversaAberta; a ponte de triagem sem seleção continua no Inbox. Props opcionais antigas da thread permanecem compatíveis, sem renderizar duplicata. Guards de id, rede, revogação, leitura otimista/SSE, SSR/agoraInicial, Coluna313 e ref382 preservados.

## Tags e autorização

TagPainel={rotulo,ia}; PainelSetor.tags é opcional para fixtures antigas, mas carregarPainel devolve sempre array. Só busca PessoaTag depois de carregarDadosSetor aplicar escopo/carteira/convite e autorizar pessoa comercial não responsável legal. Fora do escopo retorna null; lead oculto, pessoa legal/ausente e outros setores retornam[]. Nenhuma autorização substituída ou ampliada.

Query por pessoaId, orderBy tag.nome asc, select mínimo criadoPorId/tag.nome. ia é criadoPorId===null na associação PessoaTagD20. Não filtrar Tag.ativo: associação histórica segue legível, como no CRM existente. Helper interno não é action/endpoint. Saída sem IDs/nomes de autores, cor, telefone ou provedor. Sem schema/migration. Ações de contato, Aria e podeEnviar preservam as próprias proteções.

## Coordenação e verificação

Somente quatro registros específicos de guardas foram autorizados: aba1 em NAO_SAO_BOTOES_DE_ACAO, key a.id em CONTROLES_QUE_NAO_SAO_BOTAO e ALTERNANCIAS_SEM_ARIA_PRESSED (role tab/aria-selected), tag1 em DENTRO_DE_SUPERFICIE. Nenhum algoritmo/limite/registro alheio alterado. O fixture313 foi renomeado peloB para dialogo-retorno.fixture.tsx e continua varrido, sem exceção nova.

Integração permitida foi somente paineis.int.test.ts no dev-email após snapshot completo do integrador:12testes EXIT0. Ele restaurou424 tabelas/551 registros e confirmou fixture307/314 normal9mensagens4notas. Não repetirDB sem janela. Não houve seed/reset extra, instalação, package/lock/schema, transportes, servidorDEV ou full próprio318.

Após composição e fixes313: Node22.23.2, recorte47arquivos534testes EXIT0, TSCheap8192 EXIT0, lint18afetados0/0avisos. Não é suíte global. Scripts/visual/CLI seguem exclusivosB até handoff, quadro global não editado peloA. Roteiro em output/inbox-318-roteiro-visual.md inclui três tamanhos/dois temas app×protótipo, cortes699/700,959/960,1399/1400, altura500, nomes/tags longos, foco/resize/portal e nome acessível computado. Usar primeiro as tags canônicas autorizadas da Mariana e AriaBeatriz, sem novo preparoDB por suposição. Aceite visual/TESTER/global ainda não executados.
