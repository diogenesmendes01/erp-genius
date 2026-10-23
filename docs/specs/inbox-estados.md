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
