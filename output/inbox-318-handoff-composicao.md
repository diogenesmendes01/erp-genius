# Handoff reservado após313 — Inbox318

Não aplicar antes de liberação. Fontes exclusivas e SPEC/report em318; shell atual permanece compatível sem contato.

- InboxNovo: passar contato={id,nome,subtitulo:setor·numeroRotulo,tags:painelDoAberto?.dado?.tags??[],quadrado:false}, abasDoPainel(finalidade), estado ativo associado à seleção e callback. Não key/remontar PainelContato; conservar visivel/sobreposto/className/focarAoAbrir/aoFechar. Preservar todos os guards de id/rede/revogação/leitura/SSE.
- Corpo Detalhes: LinhaCampo de telefone apenas quando não vazio; PainelSetor; PainelAria; AcoesContato; OptOutContato apenas fora de grupo; PainelTriagem/revisões. Evitar duplicar padding e border dos filhos, sem editar suas regras/props ou retirar aprovação.
- ConversaAberta: mover só triagem da seleção para o painel. InboxNovo sem seleção conserva a ponte de triagem para não esconder controles.
- BotaoIcone real313: consumir API/ref para um único fechar36. Atual mantém Botao/ref e rótulo308; aplicar voltar/fechar responsivo sem segundo botão ou hide1100. Shell960/1400 é imutável nesta tarefa. Não editar dialogo.ts.
- Harness: novo painel-detalhes; manter tablet-painel/celular-painel, hidrataçãoSSE, diagnósticoReact, helperDOM392 após interação/antesfoto e manifestos/fontes. Não executar transportes/ações externas.
- Guardas: quatro registros exclusivos de PainelContato foram autorizados e aplicados (aba1/key a.id/aria-selected/tag1), sem algoritmos alterados. Merge posterior deve preservar os registros doB313 e guardaAST381/mono312 do integrador.
- Visual quando liberar: três tamanhos/dois temas app×protótipo; bordas699/700,959/960,1399/1400, altura500 e nomes/tags extensos. Scroller local inclui topo/abas/corpo, avatar não encolhe. Medir alcance de todos os controles, foco/resize, coluna/overlay/uma vista, telefone omitido e grupo semopt-out. Não presumir geometria por classes.


Atualização: composição acima LIBERADA e implementada após4f1c2049, exceto harness/visual/quadro. Abrir()/NovaConversa/helperdialogo não editados; receber fix313359a23fd por merge normal após checkpoint. BotaoIcone36 real já consumido; validar nome acessível responsivo e geometria no preview quando autorizado. Report registra RED/GREEN e pendência do renome de fixture313 para guarda confirmacoes, sem exceção nova.


Fixes313 recebidos:359a23fd→merge1ecddf96; b10ecc98→mergeed1b6593. Composição/controleNovo preservados, renome de fixture continua varrido e confirmacoes verde. Gates combinados47files534tests/TSC/lint18 EXIT0 na fonteed1b6593. HandoffCLI/preview ainda pendentes; ver roteirovisual e relatório, sem aceite presumido.
