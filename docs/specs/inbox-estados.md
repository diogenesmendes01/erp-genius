# Estados do Inbox — #319

Checkpoint estático sobre a base comum29479848432d2b4fd37972f104b6b7e5cae62368. Implementa a Task14 do plano02 e os rulings de coordenação, preservando #313/#314/#318, busca #316, notas #388 e contagens/leitura/SSE existentes. Prova visual, revisão independente e global integrado permanecem pendentes; não há homologação presumida.

## Esqueletos e casca

EsqueletoConversas passa pelo Carregando existente, com aria-busy e anúncio “Carregando conversas”. A raiz replica margens negativas e alturas da page atual, sem min-height420px: uma coluna abaixo de960, lista300px e conversa a partir de960, lista372px a partir de1100, painel348px automático a partir de1400. O breakpoint1200 da task histórica foi substituído pelo contrato real aprovado; nenhum limiar produtivo mudou. Existe só um marcador de título, busca38px, três chips, seis itens com círculo44px, cabeçalho68px, quatro bolhas decorativas e avatar132px no painel da página. O fundo é o mesmo fundo-conversa. A geometria CSS foi verificada nos testes; sua medição no navegador ainda é obrigatória.

EsqueletoThread({rotulo}) e EsqueletoPainel({rotulo}) também usam Carregando. Os desenhos ficam aria-hidden, sem dados, controles ou mensagens fictícias acessíveis. Os esqueletos parciais não possuem marcador de título. O da thread tem quatro bolhas alternadas; o do painel contém apenas linhas do corpo, pois o cabeçalho/avatar reais continuam pertencendo à única montagem de PainelContato #318. A redução de movimento continua regida pelo animate-pulse/globals.css existente.

## Thread

O esqueleto aparece apenas na carga inicial sem mensagens E sem notas. Reload com conteúdo, paginação e erro mantêm a VirtualList montada com stableMount, as mesmas keys/scrollRef/pinKeys e a busca #316. Notas carregadas sozinhas continuam visíveis, preservando #388. O contêiner anuncia ocupado durante carregando/carregandoAntigas/carregandoNovas.

Erro técnico nunca é renderizado: o alerta informa somente “Não foi possível carregar as mensagens.” e oferece “Tentar de novo”, usando conversa.recarregar. Mensagens anteriores usa Botao fantasma/sm em pílula; retry é fantasma/sm. Ambos preservam guarda de ocupado. Antes de iniciar a carga, o foco vai sincronamente ao campo da busca aberta ou à região real Conversa já focusable. Nenhum callback após await devolve foco: mover o foco para fora durante a espera é respeitado. A lógica da busca, ações de mensagem, compositor e permissões não foi alterada.

## Painel e ausência

Painel de outro atendimento ou ainda não carregado mostra EsqueletoPainel no corpo, sem duplicar avatar. Na falha inicial, dado null do consumidor vira alerta público “Não foi possível carregar os detalhes.” e retry secundario/sm, ligado ao tentarPainelDeNovo existente. O foco é entregue ao painel real antes de o gatilho desmontar. O carregamento/erro continuam enviando podeEnviar=null ao compositor, e somente true autoriza envio.

Um objeto válido sem oportunidade visível é ausência legítima: mensagem neutra em12.5px/gray400, sem alerta ou retry. PainelSetor(null) conserva seu aviso neutro para consumidores diretos; Inbox não o usa para mascarar falha de transporte. API e buscarPainel continuam inalterados. Recarga5xx de painel conhecido mantém o último conteúdo e permissão, sem interromper digitação;404posterior conserva o tratamento existente que retira ações e trava envio. Respostas tardias de outro atendimento são descartadas pelo ciclo atual.

Sem seleção, triagem/revisões permanecem acima quando existirem. A área restante centraliza IconMessages40, título15px/600 “Escolha uma conversa” e apoio13px “As mensagens aparecem aqui.”, sem montar painel. Lista vazia continua no EstadoVazio bloco; esta task não redefine seu padrão.

## Verificação e próximos passos

Registros exatos em output/inbox-319-report.md. DEV: recorte61arquivos861testes, TSC heap8192 e lint13fontes sem avisos, todos com saída0 observada. Inclui R6/fila394/SSE396, busca/pin150, VirtualList/histórico, erro/retry/foco, bordas de rota e guardas AST/botões/paleta/vazios/feedback. Os mapas receberam somente os três Botao exatos e a remoção da isenção antiga de Mensagens anteriores, agora migrado ao design system; algoritmos e limites não mudaram.

A317 é dona do rodapé/compositor e, até handoff, do harness visual. A integração deverá preservar seu coordenador local e os hooks idempotentes, conciliando somente os estados internos da thread deste patch. Sem nova prop ou helper compartilhado.

Após handoff/preview coordenado: sem-selecao/carregando/painel-erro/thread-erro/lista-vazia em1440×900,1024×768,390×844 e320×500, dois temas; probes adicionais de loading parcial, painel vazio, retry, seleção rápida e foco/busca/paginação. Latência/HTTP500 são controles privados e exatos do transporte local, sem afrouxar guardas globais. O protótipo não desenha todos esses estados; declarar quais referências realmente existem (lista vazia já possui listEmpty) e a ausência das demais, sem fabricar referência funcional. Global e publicação ficam com integrador.

Sem schema/deps/package/lock, SQL/seed, servidor iniciado pelo DEV, transporte externo ou envio de mensagem.


## Checkpoint preliminar de navegador472

Em1440×900 claro/320×500 escuro foram observados fallback real sob latência, erros500 públicos/retry real200, ausência legítima comprovada porGET200 e paginação até157itens decorados preservando notas/pin/foco.29PNG inspecionados permanecem locais com allowlist explícita em output/inbox-319-preliminar-allowlist.json. Métricas, negativos e limites no report/evidencias-preliminares. A fixture não contémTriagem; sua ordem visual presente não foi comprovada. O scroll próprio do painel/thread permite alcançar retry porTab, sem alterar documento; estado inicial e alcançado separados. Fonte472 ainda antecede composição317/C2#402: não é formal final nem homologação/global.


## Harness319 após handoff317

Composição produtiva93a5 e harness317bf4ad incorporados noOWN; delta319 não modifica app. CLI acrescenta carregando/painel-erro/thread-erro/painel-vazio, sem-seleção nos3tamanhos e mantém lista-vazia:42PNG no recorte,12APP320×500 adicionais privados. Cinco estados têm N/Afuncional explícito; só lista-vazia possui referência do protótipo. Helper testado aceita500 somente do GETlocal exato efetivamente interceptado, certifica vazio com200real e observa fallbackreal sob latência sem fabricarHTML/RSC. Prontidão valida estado/viewport; carregar página só espera hidratação depoisfoto. Nota317/busca316/anonDOM392/guardas existentes preservados. TDD/gates e negativos no report. C2#402, Ready, formal, inspeção/QA/global/publicação ainda pendentes.


## Fonte composta para gates finais

Composição DEV0f80f61d incorpora C2 e o patch isolado nota-protótipo317; helper/ESTADOS319 preservados, CLIforçadaLF pelo atributo específico. DEV observou recorte70arquivos863testes, NodeChromeoffline2, TSCheap8192 e lint14fontes semavisos, todos saída0. Não é global nem prova deUI. Integrador executará global com fonte imóvel antes do Ready e formal42PNG+12mobile/complementos; evidências472 permanecem preliminares. C6SSE não portado. Detalhes/comandos/limites em output/inbox-319-report.md.


### Prontidão do preparador de carregando

O preparador aguarda o evento real load da navegaçãoHome antes de ativarCDP e solicitar routerPush; existência do router apósDOMContentLoaded não garantia montagem. A/B real5e9 demonstrou Homepermanente/zero fallback versus fallbackpronto, e TDD causal cobre CDPsomenteapósload. Predicado geométrico/timeouts/latência permanecem iguais, semsleep/fabricação. Formal84095 interrompido é negativo histórico inteiro, não pacote final; repetição42+12 exige novoReady/fonteexata. Gatesdirigidos66/TSC/lint0 no report, global5e9 éanterior e não reatribuído.


### Conclusão finita antes de classificar cancelamentos dos estados de painel

Em painel-erro/painel-vazio, a foto mantém a prontidão própria do painel. Observador instalado antes da navegação registra somente GET sem query de mensagens da conversa exata; finalizar aguarda término do corpo (ou falha real) dos requests já iniciados, limite30s/cleanup, antes do veredito. Não exige200 nem conversa visível oculta pelo painel. O classificador de cancelamento continua exigindo recuperação concluída da mesma URL; falha não recuperada reprova. Nenhum outro estado/status/diagnóstico é afrouxado. Negativo96724 e prova causal CDP real dd988c estão preservados no report; formal42+12 ainda pendente, sem reatribuir global5e9.


### Contrato anterior da injeção500 — histórico substituído pelo ruling abaixo

O contrato de falha controlada distingue cancelamento da injeção de recuperação200. Só aceita ERR_ABORTED exato de RequestGET semquery realmente injetado500/fulfillconcluído, se outro Request posterior da mesmaURL terminou500controlado com body completo e o estado público correspondente foi revalidado. Sem substituto, Request alheio, status diferente, corpo falho ou estado ausente continuam falhas. Observador antes da navegação, limite30s e cleanup; Request sóem memória. Classificador global de recuperação200 e guardas não mudam. Formal88639 negativa inteira e causal ada905 permanecem no report; nova matriz completa/inspeção e fases de dados aguardam ReadyROOT.


### Contrato vigente de erro500 controlado por headers e estado público

Substitui a exigência anterior de finished()===null do500. O cliente rejeita !ok sem consumir esse corpo; portanto o aceite do estado de erro exige headers500 efetivamente observados de Request POSTERIOR da MESMAURL, também pertencente à injeção/fulfill500concluído, e alerta/retry públicos revalidados. O Request cancelado também deve ter injeção/fulfill500concluído, GET/origem/path/semquery exatos e net::ERR_ABORTED. Sem substituto observado ou estado público, o cancelamento continua falha. Nenhum corpo é drenado, fetch instrumentado ou HTTP200 recuperado alegado. Classificador global e barreira dos GETs200 reais continuam intactos; limite30s cobre somente prontidão pública, com cleanup. Fonte produtiva não mudou.


### Validação final dos estados319 na composição4fade

Matriz normal42+mobile12 integralmente aprovada e inspecionada na fonte4fade; cinco estados são N/A funcional no protótipo, só lista-vazia possui referência. Longa com153mensagens/2notas/2dias=157itens e corridaA→B:42PNG adicionais; Triagem real presente:6PNG, com banner acima do vazio em>=960 e central oculta/lista visível no mobile. TotalDEV102PNG curadas por três allowlists explícitas, sem binários emGit. GET200 final exige transporte nativo CDP URLexata/continue, requestfinished/finished/body; erro500 continua contrato local por headers+identidade+estado público. Global/classificador/barreira200 preservados, zeroGET na barreira é N/A legítimo. Fonte e hashes, execuções, negativos e limites completos em output/inbox-319-report.md e allowlists normal/longa/triagem.

Em320×500 a busca/rodapé deixam janela61px para a thread: fotos da nota/alerta podem mostrar parte, retry alcançado porTab6 fica inteiro. Rolagem instrumental da nota não prova foco, nem painel-vazio após scroll prova cabimento inicial. Painel modal é fechado por ação real em<1400; volta à lista somente<960. Nenhum atributo/HTML foi fabricado para contornar inert. ROOT restaurou424hashes/1372originais após todas as fases (4f3b20 saída0); fonte executável4fade permaneceu congelada, apenas metadados finais acrescentados. Pacote remoto/QA independente/publicação ficam sob coordenação do integrador, sem homologação presumida.
