# Inbox #314 — autoria, notas e dias na thread

## Rastreabilidade do menu herdado — Task 8 / revisão #385 C2

O menu da issue #305 permanece no balão. Estes nomes finais mais curtos correspondem aos três exemplos do plano E0:

| Exemplo do plano | Nome atual em `src/components/conversa/BalaoMensagem.test.ts` |
| --- | --- |
| Chevron antes do conteúdo, flutuando à direita, sem posição absoluta | `chevron vem antes de autor/texto, flutua à direita e não é absoluto` |
| Visibilidade no hover, foco, toque e com o menu aberto | `chevron aparece em hover/foco/toque e fica visível com menu aberto` |
| Menu fixo na viewport, independente do balão | `painel aberto tem posição fixa e altura limitada com rolagem interna` |

Os testes de interação do menu ficam em `BalaoMensagem.interacao.test.ts`. O mapa preserva os nomes executáveis e não renomeia testes nem atribui uma nova execução à documentação.

## Base e escopo

Branch codex/inbox-e1-314, base c7e85eb2014bffd9919eedc1808dcb7dcc5b1f24 (308+311). Implementação parcial liberada pelo integrador. Consome tokens/fonte306, casca308, mensagens/notas300/301 e menu305. Não modifica schema, consultas públicas, autorId, permissões, transporte ou lógica de leitura/count/SSE. CLI/núcleo/esperas/README do harness continuam com B312; delta proposto em output/inbox-314-handoff-harness.md.

## Dados e apresentação

Mantém itensDaThread e sua janela de notas, desempate temporal e chaves mensagem/nota. decorarThread acrescenta separador com chave dia:AAAA-MM-DD quando muda o dia civil e evento de transferência no topo quando a consulta autorizada devolve setor. Não muda cursor ou ordenação. As chaves de mensagem e nota permanecem, inclusive durante paginação; mudar rótulo Hoje→Ontem não muda chave de dia. Usa um formatador Intl por decoração, evitando criar um objeto caro por mensagem de histórico virtualizado.

AutorBalao: cliente/humano/aria/nota. Identidade da sequência considera tipo, dia, própria versus outra pessoa, nome e origem; notas consideram origem atendimento/oportunidade e autor. Você→Camila→Carlos não suprime identificação, nem notas que mudam de origem. Autor humano/nota desconhecido não faz sequência. Entrada compara participanteNome; a repetição do mesmo participante pode agrupar, outro participante rompe. Sem autorId público não é possível distinguir homônimos idênticos; limite mantido sem inventar contrato.

BalaoMensagem usa entrada, verde humano, roxo IA ou nota tracejada, cauda somente no início da sequência, limite min(560px,72%), texto14/1,45 e hora mono10,5. Própria exibe Você; outra humana usa autorDaMensagem, preservando Celular/Sistema. Grupo conserva participante, cliente individual não inventa autor. Autor humano usa text-brand-800, que aponta para --brand-strong no Tailwind atual e passa o contraste306; text-brand-strong não é um utilitário declarado. Ícones de status13, verde somente LIDA, falha continua Não enviada. Chevron float-right e motor de menu/foco/medição/capacidades305 preservados. Destacada acrescenta ring de aviso. Não acrescenta sombra de balão.

Nota é adaptação estritamente visual, com role=note e data-nota-id, origem no rótulo e autor (ou Autor não informado) na linha da hora. Não tem menu, gatilho, status do transporte, modelo, mídia, enquete, Pix ou visualizador, mesmo com props de mensagem impróprias. Não dispara action; não recebe comandos externos. NotaNaThread e seu teste foram retirados após busca de consumidores; contratos de origem/autor/hora/quebras/XSS portados ao teste do balão.

EventoSistema e SeparadorDia trazem caixa própria flex/justify-center: self-center isolado seria ineficaz nos Fragments ou wrappers flow-root do VirtualList. isItemFocusable exclui dia/evento/nota sem comandos, sem mudar o comportamento padrão do motor compartilhado. Casca304/308 conserva rolagem interna; padding da thread7%, celular até699px10px. Transferência sai do cabeçalho e aparece como evento, mantendo action de escopo e guard de resposta antiga/seleção.

## Dia civil, fuso e SSR

Chave por Intl.formatToParts com fuso resolvido pelo helper existente (preferência válida, senão UTC neste contexto). Hoje compara chaves; Ontem é véspera da chave local por calendário, nunca agora menos24h. DST London: em2026-03-29T23:30Z a chave é30/03, mas menos24h cai28/03; véspera correta29/03. Testes cobrem também retorno DST, ano, bissexto, fuso inválido e mudança de dia. Datas fora de Hoje/Ontem usam formatarInstanteExibicao(data), com fallback existente.

Contrato comum com312: a página captura uma única vez const agoraInicial = Date.now() depois de resolver o fuso, com exceção de purity limitada à linha do Server Component. PropsInboxNovo e ConversaAberta recebem agoraInicial?:number (epochms). O mesmo contrato alimentará Lista/hook no patch do B312; esta branch não implementa o produtor312. Nenhum ISO redundante ou relógio independente no SSR.

useAgoraDaThread usa getServerSnapshot serializado no SSR e na primeira hidratação; número ausente/inválido usa0 determinístico e não consulta Date.now no servidor. O getter cliente devolve valor cacheado, não Date.now a cada leitura. Após a assinatura adota o relógio real; nova revisão de mensagens/notas, seleção ou novo epoch do servidor cria snapshot cliente atual. Assim23:59SSR→00:01hidratação preserva o HTML/nó sem mismatch; após assinatura e nova mensagem00:02 os dias usam o calendário atual. Sem timer, intervalo, listener ou polling. Limite: enquanto totalmente ociosa, a tela pode conservar rótulos anteriores à meia-noite; chegada de conteúdo/seleção não mantém o relógio antigo.

SSR isolado sem epoch válido usa referência neutra0 e datas absolutas usuais, sem ler relógio do navegador durante render. A prop serializada permanece estável durante SSE/seleção, enquanto o snapshot usado na decoração se renova no cliente; são funções distintas, não relógio congelado de sessão.

## Verificação e pendências

Relatório de RED/GREEN e gates: output/inbox-314-report.md. Proposta de fixture somente por escrito: output/inbox-314-fixture-proposta.md, não executada pelo DEV. Não há foto, seed, servidor ou suíte DB nesta entrega parcial. Prova pura de âncora confirma key/offset após paginação; não é medição real da transição99→101 linhas.

Faltam preparação/preview coordenados, medições dos balões/menu/scroll/virtualização e fotos app×protótipo dos estados conversa/humano-compositor/celular-conversa,3 tamanhos×2 temas, além de prova complementar Lucas transferido e autoria/status. TESTER deve revisar SHA exato; global combinado é do integrador, sem full próprio. Nenhum aceite visual ou conclusão integral presumidos.

## Ajuste coordenado da montagem virtual

A prova Chrome no648 mostrou RED6/6 em99→101: troca Fragment→div recriava rows e perdia foco; desktops/tablets voltavam ao topo, celular saltava a âncora. Ruling do integrador autoriza stableMount opt-in no VirtualList compartilhado, ativado somente pela thread. O default continua Fragments/SSR idêntico; lista312 não recebe a opção. A thread mantém pai/div/key dos rows desde o fluxo natural curto até posição absoluta longa. Medição, scroll e foco são acompanhados antes do limiar; layout anterior usa alturas reais para ancoragem. Abaixo do limiar Tab continua nativo; acima preserva isItemFocusable/pins/transição/resize/cleanup/overflowAnchor existentes. Sem altura fixa, timer, polling ou rede extra. Teste ReactDOM prova identidade do botão/row/pai, foco/offset em99→101 com alturas90/50 e retorno101→99; prova real final ainda pendente.

A precisão da medição opt-in é0,001px: diferenças subpixel menores que0,5 por linha não podem ser descartadas ao sair do fluxo natural, pois se acumulam em salto da âncora. O limiar0,5 dos consumidores padrão não foi alterado. TDD inclui sequência de alturas71,75/71,875 versus estimativa72; não usa altura fixa para o layout.

Chrome real na fonte02905042 confirmou identidade/foco/âncora99→101 em6/6contextos: delta0px, Tab seguinte correto,20–24rows montadas, sem warning/overflow/rede extra. As medições prévias confirmaram que5,0625px acumulados vinham das frações descartadas pela regra antiga, não de padding/listOffset. Manifesto privado no relatório; formal app×protótipo ainda separado/pendente.

## Harness formal314 após handoff312

Base dd141 integrada com312/hidratação/anonDOM392/382; conflito de quadro preservou históricos. humano-compositor cobre3tamanhos nos2temas e2alvos, conversa+humano+celular-conversa totalizam28PNGs. Prontidão verifica autoriaVocê, separador civil, status de saída e nota real sem comandos/mídia; sequência de notas não exige cabeçalho repetido. A CLI ancora a nota307 com scroll interno e abreBeatriz no protótipo celular. Notas/autores314adicionais e Lucas são complementos privados; não se exigeHoje fixo de seed histórico. GuardReact, conexãoSSE e anonimizaçãoDOM392antesfoto/manifesto conservados.

## Evidências finais DEV

Fonte/harness944e1736: recorte51arquivos613testes/TSCheap8192/lintdirigido0 comNode22. Formal28PNG app×protótipo concluído e individualmente inspecionado; complemento24PNG/API/DOM/menu nos6contextos inspecionado por pranchas; virtual12PNG/6contextos delta0/mesmo nó e foco no029, runtime idêntico ao944 porobjetoGit. Hashes/política392 efontes exatas em output/inbox-314-visual/formal/manifesto-final.json, normais-final/manifesto.json evirtual-green99-101/manifesto.json. PNGs somente locais por ruling; negativos separados. Detalhes/limites históricos no relatório. TESTER/globalcoordenado pendentes, sem aceite presumido.
## Revisão C1 da PR398 — composição dos pais

Base314-r3@cada334f incorpora3975f8/main por merge normal, sem moverc207.
Composição67192a57 preserva balões/VirtualList/relógio/scripts314, recebe
produtor394/R6, prazo puro/Avatar/SSE revisados e mantém agoraInicial314.
Conversa passa temMaisDepois ao itensDaThread de quatro argumentos388,
conservando decorarThread/stableMount e foco por mensagem. SSR314 e testes
C1/R6 são mantidos em blocos independentes.

Global671:867 arquivos/6.819 unitários,4467 EXIT0,sem filtros/ignorados;
lint global44100 EXIT0/40 avisos anteriores. TSC60102 identificou quatro
fixtures314 com três argumentos; adaptação posterior somente no teste passa
false explícito. Recorte final7/143,TSC84417 e lint do teste EXIT0. Nenhum
runtime posterior ao global, sem repetir o global pela adaptação de fixtures.
TESTERbc4 favorável7/148 próprios,d722b1 EXIT0,sem DB/browser/global/TSC;
CI/main/#392B2 pendentes. Baseb23ff13b recebe limpeza404(sóPNG/docs),
runtime/scripts/deps iguaisbc4. Quatro variantes legadas preservadas só
em backup local antes da retirada, sem reatribuição aoZIP381.
output/pr398-qa/revisao.md.

## PR398 R1 — C3/C4 e rastreabilidade C5/C6 (base ffdd)

Patch sobre ffddfdae6969e93f865be73357c95816d6b090aa, preservando a base publicada e todos os contratos existentes. C3: um item com criadoEm inválido continua na thread, sem inventar dia, mas já não apaga o último dia civil válido e não provoca segunda key dia:AAAA-MM-DD quando o próximo item pertence ao mesmo dia. Uma mudança civil real continua inserindo separador. C4: autorNome de nota nulo/vazio/sóbranco usa Autor não informado; nome preenchido continua exibido e escapado porReact. Nenhuma alteração em VirtualList, cursor, janela de notas, relógio, SSR, SSE ou permissões.

C5 é LIMITE DE ESCOPO MANTIDO, não correção por timer: tela totalmente ociosa que atravessa meia-noite pode conservar Hoje/Ontem do snapshot anterior. O relógio atualiza na assinatura cliente e quando mudam referências de mensagens/notas, seleção ou epoch SSR. O teste real de hidratação abaixo já preserva o primeiro nó/HTML e comprova atualização com mensagem00:02, seleção/notas posteriores, mantendo timerCount0. Não se adiciona polling nem se promete virada automática da tela parada. Isso não afeta o cálculo por dia civil/DST, que continua correto em cada revisão.

### C6 — nomes do plano Task9 e testes executáveis atuais

Não foram renomeados testes já estáveis apenas para coincidir com a redação do plano. A correspondência abaixo é explícita; alguns requisitos são cobertos por um conjunto, sem atribuir a um teste uma asserção que ele não contém. Caminhos relativos ao repositório:

| Nome/requisito do plano Task9 | Arquivo e nome real do teste |
|---|---|
| cliente: fundo de entrada, cauda à esquerda, sem autor | src/components/conversa/BalaoMensagem.test.ts — entrada tem cauda esquerda e participante só em grupo |
| humano: Você para a própria, nome para a de outra pessoa, verde forte | BalaoMensagem.test.ts — humano próprio é Você; outra pessoa mantém nome e cor de contraste306 |
| aria: balão roxo e Aria · IA | BalaoMensagem.test.ts — Aria roxa e primeira autoria; sequência sem autor/cauda |
| nota: tracejado de aviso, rótulo pela origem, autor na linha da hora, sem ✓✓ | BalaoMensagem.test.ts — nota preserva origem/autor/hora/XSS e não cria menu/status/mídia mesmo com props impróprias; complementado por C4 PR398: nota com autor vazio/branco %j informa autoria ausente |
| em sequência: raio inteiro e sem autor | BalaoMensagem.test.ts — Aria roxa e primeira autoria; sequência sem autor/cauda; itens-thread.test.ts — Você→Camila→Carlos identificam cada autor; só repetição conhecida faz sequência |
| hora mono 10,5 e ✓✓ de 13 | BalaoMensagem.test.ts — hora mono10,5/status13 e destaque de busca preservam erro/lida |
| rotuloDia usa o fuso de exibição | src/components/conversa/itens-thread.test.ts — distingue hoje, ontem e data pelo fuso; Ontem é a véspera civil nos dois DST London, não menos24h; virada de ano, bissexto e fallback de fuso inválido |
| decorarThread: evento de transferência no topo, separador a cada dia, sequência por autor no mesmo dia | itens-thread.test.ts — evento no topo e separadores usam keys civis estáveis, sem colisão com nota; Você→Camila→Carlos identificam cada autor; só repetição conhecida faz sequência; notas conservam origem e autor ao decidir sequência |
| grupo: participantes diferentes não fazem sequência | itens-thread.test.ts — grupo troca participante e dia quebra a sequência |
| pílula IA e neutra com hora mono | src/components/conversa/EventoSistema.test.ts — centraliza por própria caixa, pílula IA/neutra e hora mono, sem controle fictício |
| pílula de superfície 12/500 | src/components/conversa/SeparadorDia.test.ts — centraliza também fora de flex/VirtualList e usa pílula superfície12/500 |
| thread com fundo pontilhado da casca, padding de7% e evento de transferência | src/app/(app)/inbox/ConversaAberta.test.ts — decora a thread no fuso usando referência explícita SSR e preserva nota sem comandos (padding/fuso/nota); transferência por composição de itens-thread.test.ts (evento no topo...) + EventoSistema.test.ts. Não é nova prova ponta a ponta de transferência |

Regressões adicionais do contrato: src/components/conversa/agora-thread.test.ts — SSR23:59 hidrata00:01 preservando nó e depois nova mensagem00:02 usa dia cliente; SSR sem epoch válido(%s) usa snapshot neutro estável sem consultar relógio. VirtualList.estavel.test.ts — opt-in conserva o mesmo pai, linha, botão focado e viewport na transição99→101; SSR default continua sem wrapper e opt-in fornece a mesma estrutura de pai/rows abaixo do limite; opt-in não acumula diferenças subpixel ignoradas perto da altura estimada. Esses arquivos foram executados no recorte, mas não alterados.

C1/ancestralidade/retarget e C2/CI remota seguem com o integrador após397; a correção local não declara esses gates concluídos nem compõe QA280. Relatório de todos os comentários e gates locais: output/inbox-pr398-review-todos.md.
