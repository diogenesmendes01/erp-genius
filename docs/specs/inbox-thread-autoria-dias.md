# Inbox #314 — autoria, notas e dias na thread

## Base e escopo

Branch codex/inbox-e1-314, base c7e85eb2014bffd9919eedc1808dcb7dcc5b1f24 (308+311). Implementação parcial liberada pelo integrador. Consome tokens/fonte306, casca308, mensagens/notas300/301 e menu305. Não modifica schema, consultas públicas, autorId, permissões, transporte ou lógica de leitura/count/SSE. CLI/núcleo/esperas/README do harness continuam com B312; delta proposto em output/inbox-314-handoff-harness.md.

## Dados e apresentação

Mantém itensDaThread e sua janela de notas, desempate temporal e chaves mensagem/nota. decorarThread acrescenta separador com chave dia:AAAA-MM-DD quando muda o dia civil e evento de transferência no topo quando a consulta autorizada devolve setor. Não muda cursor ou ordenação. As chaves de mensagem e nota permanecem, inclusive durante paginação; mudar rótulo Hoje→Ontem não muda chave de dia. Usa um formatador Intl por decoração, evitando criar um objeto caro por mensagem de histórico virtualizado.

AutorBalao: cliente/humano/aria/nota. Identidade da sequência considera tipo, dia, própria versus outra pessoa, nome e origem; notas consideram origem atendimento/oportunidade e autor. Você→Camila→Carlos não suprime identificação, nem notas que mudam de origem. Autor humano/nota desconhecido não faz sequência. Entrada compara participanteNome; a repetição do mesmo participante pode agrupar, outro participante rompe. Sem autorId público não é possível distinguir homônimos idênticos; limite mantido sem inventar contrato.

BalaoMensagem usa entrada, verde humano, roxo IA ou nota tracejada, cauda somente no início da sequência, limite min(560px,72%), texto14/1,45 e hora mono10,5. Própria exibe Você; outra humana usa autorDaMensagem, preservando Celular/Sistema. Grupo conserva participante, cliente individual não inventa autor. Autor humano usa text-brand-800, que aponta para --brand-strong no Tailwind atual e passa o contraste306; text-brand-strong não é um utilitário declarado. Ícones de status13, verde somente LIDA, falha continua Não enviada. Chevron float-right e motor de menu/foco/medição/capacidades305 preservados. Destacada acrescenta ring de aviso. Não acrescenta sombra de balão.

Nota é adaptação estritamente visual, com role=note e data-nota-id, origem no rótulo e autor (ou Autor não informado) na linha da hora. Não tem menu, gatilho, status do transporte, modelo, mídia, enquete, Pix ou visualizador, mesmo com props de mensagem impróprias. Não dispara action; não recebe comandos externos. NotaNaThread e seu teste foram retirados após busca de consumidores; contratos de origem/autor/hora/quebras/XSS portados ao teste do balão.

EventoSistema e SeparadorDia trazem caixa própria flex/justify-center: self-center isolado seria ineficaz nos Fragments ou wrappers flow-root do VirtualList. isItemFocusable exclui dia/evento/nota sem comandos, sem mudar o motor compartilhado. Casca304/308 conserva rolagem interna; padding da thread7%, celular até699px10px. Transferência sai do cabeçalho e aparece como evento, mantendo action de escopo e guard de resposta antiga/seleção.

## Dia civil, fuso e SSR

Chave por Intl.formatToParts com fuso resolvido pelo helper existente (preferência válida, senão UTC neste contexto). Hoje compara chaves; Ontem é véspera da chave local por calendário, nunca agora menos24h. DST London: em2026-03-29T23:30Z a chave é30/03, mas menos24h cai28/03; véspera correta29/03. Testes cobrem também retorno DST, ano, bissexto, fuso inválido e mudança de dia. Datas fora de Hoje/Ontem usam formatarInstanteExibicao(data), com fallback existente.

A página captura ISO agoraThread no servidor e passa por InboxNovo até ConversaAberta. SSR e hidratação recebem o mesmo instante explícito. SSE e seleção local não criam outro relógio, intervalo ou polling; teste verifica a prop preservada. Uma nova renderização da página no servidor atualiza a referência. Limite aprovado: página que atravessa meia-noite sem essa renderização conserva os rótulos relativos anteriores; não há timer novo nesta issue. Consumidor isolado sem agoraThread mostra datas absolutas, sem ler relógio do navegador durante render.

## Verificação e pendências

Relatório de RED/GREEN e gates: output/inbox-314-report.md. Proposta de fixture somente por escrito: output/inbox-314-fixture-proposta.md, não executada pelo DEV. Não há foto, seed, servidor ou suíte DB nesta entrega parcial. Prova pura de âncora confirma key/offset após paginação; não é medição real da transição99→101 linhas.

Faltam preparação/preview coordenados, medições dos balões/menu/scroll/virtualização e fotos app×protótipo dos estados conversa/humano-compositor/celular-conversa,3 tamanhos×2 temas, além de prova complementar Lucas transferido e autoria/status. TESTER deve revisar SHA exato; global combinado é do integrador, sem full próprio. Nenhum aceite visual ou conclusão integral presumidos.
