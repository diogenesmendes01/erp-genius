# Item visual de conversa — #312

Implementação da E1 Task7 sobre #309/#298/#299/#302. Escopo parcial liberado em22/10/2026: ItemConversa, ListaAtendimentos, passagem de usuarioId em InboxNovo, extensão visual do relógio, testes e registros exatos dos guards. Fonte da casca/harness #308 ainda deve ser integrada pelo coordenador antes da prova visual; esta SPEC não declara homologação.

## Contrato de apresentação

ItemConversa recebe item:ItemListaInbox, selecionado:boolean, agora:Date, aoSelecionar():void, usuarioId?:string e fuso:string|null. O botão é uma linha de seleção, com type=button e aria-current=true somente na selecionada. Mantém ativação nativa de botão; não acrescenta comandos de negócio.

Avatar44 e hash vêm de Avatar/estadoVisualItem #309, preservando Unicode e os consumidores legados fora do Inbox. Nome14/600, prévia13, hora11.5 mono/tabular no fuso pessoal. Seleção cinza neutro, hover de superfície no restante. Contador sólido da marca, mono/600; hora verde com não lidas. Pino e silenciada são ícones rotulados. Os badges consomem tom/texto/ponto/tracejado/ícone dos produtores #309, sem lógica paralela de estado/setor/prazo. SeloIA permanece desativado naE1.

Número da linha e antiga linha de metadados saem do item; setor e estado passam aos badges. O nome mantém o contrato de exibição já entregue pelo servidor. A proteção pedagógica continua no domínio e no teste. Grupo recebe ícone44 neutro e nenhum badge.

## Lista e virtualização

ListaAtendimentos mantém VirtualList, getKey pelo atendimento, threshold100 e estimatedHeight104, o mesmo scrollRef, seleção/paginação e Carregar mais. Padding passa a4px/8px/12px conforme o plano. O EstadoVazio bloco mantém moldura e frase DS existentes; o mapa de vazios não precisa mudar. InboxNovo acrescenta somente usuarioId na chamada da lista.

104px é estimativa. ResizeObserver continua medindo alturas e largura; quebra dos badges pode mudar altura. Nenhuma alteração no motor VirtualList/virtual-window nesta etapa. Testes SSR provam a transição de lista100 para janela limitada101, mas não provam medidas, foco ou scroll no navegador.

Antes de aceite, prova real deve usar mais de100 atendimentos individuais válidos, abrir páginas normais até ultrapassar o limite, obter ao menos duas alturas reais e verificar Tab/Shift+Tab através da janela, seleção, retorno à lista e mudança de largura. Capturar âncora/offset e ausência de sobreposição após medições. Fixture7casos não comprova virtualização. Se houver falha no motor, preservar diagnóstico e coordenar escopo antes de o reescrever.

## Relógio visual local — ruling aprovado

A mudança #312 faz o badge exibir minutos e mudar cor na fronteira30min. O relógio #302 que só acordava no vencimento deixaria esse texto/cor congelado sem SSE. Foi autorizada extensão localizada: uma única assinatura/timer por lista escolhe o próximo instante que muda texto ou cor, sem busca, rede, intervalos ou polling.

proximaMudancaVisualEm(itens,agora):number|null ignora grupo, encerrado, prazo ausente ou inválido. Para prazo futuro/igual agenda prazo+1ms, preservando regra estrita prazoEstourado(<). Para prazo vencido agenda a próxima fronteira de minuto desde o prazo. O texto usa mínimo1min: entre vencimento+1ms e2min o texto/cor não muda, então não desperta aos60s. Escolhe o menor instante entre todos os itens. O timer é limitado ao teto nativo e, ao acordar, recalcula usando Date.now real, inclusive depois de sleep/salto do relógio. Troca de lista e desmontagem limpam a assinatura anterior.

proximoEstouroEm, prazoEstourado e esperaAteProximo conservam APIs e comportamento original. O helper novo já devolve o instante estrito/exato; o timer não acrescenta outro1ms nas fronteiras de minuto. Datas inválidas não armam timer e não há timer0/loop. Testes de React/efeitos reais cobrem29→30,59→60, futuros/igual, múltiplos/empates, StrictMode, cleanup, teto e salto de relógio. Só ícones decorativos são substituídos no DOM mínimo, que não tem namespaceSVG; markup real dos ícones é testado por renderização separada.

## Grupo e limites do domínio

A migração20261016110000_grupos_whatsapp mantém XOR contato/grupo e trigger impedir_atendimento_em_grupo. Grupos reais não abrem Atendimento. O teste item.grupo=true verifica somente contrato de renderização; não autoriza consulta nova, Atendimento inválido ou desativação de trigger. “Grupo Ventura” da demo307 é contato individual B2B. Não se apresentará essa fixture como prova de grupoWhatsApp real.

## Guards, prova visual e verificação

O item foi registrado pontualmente em botoes.test.ts: uma linha de seleção por arquivo e nome dinâmico, com aria-current, como contrato do plano. As funções de análise e regras gerais do guard não mudam. EstadoVazio permanece com contrato existente.

A prova app×protótipo aguardará base #308/preview do integrador: conversa, celular-lista e lista-vazia, ambos temas,1440×900/1024×768/390×844 conforme combinações aprovadas. Não editar CLI/núcleo/esperas/READMEharness durante ownership do DEV A. Fontes mono400–500 podem sintetizar600; verificar legibilidade sem alegar face600 nativa. Preservar manifestos negativos antes de recaptura.

Diferenças previstas: setor em vez de etapa; Aria/seloIA e autoria de prévia naE3; avatarB2B quadrado naE2; Prazo estourado segue regra ERP; vazio segue moldura DS. Nenhuma funcionalidade será criada só para aproximar referência.

Recortes, códigos e pendências em output/inbox-312-report.md e quadro-entregas. Sem full próprio nesta etapa; global integrado coordenado pelo integrador antes da publicação. Sem schema, DBsuite, servidor, transporte externo, instalação, push ou PR nesta implementação parcial.

## Correção do snapshot SSR na prova real

A captura85883 encontrou bug produtivo: servidor33min/cliente34min atravessando uma fronteira antes de hidratar. Tentativa integral preservada com hashes em output/inbox-312-visual/negativo-celular-lista-85883. Não foi classificada como caret ou aviso descartável.

Ruling coordenado: contrato comum agoraInicial?:number em epochms, capturado uma vez na página servidor e encaminhado InboxNovo→Lista→useAgoraDosPrazos. #314 e consumidores futuros usarão esse mesmo contrato. getServerSnapshot retorna o valor serializado válido, ou0 determinístico em usos diretos sem valor/válido; não chama Date.now no servidor para inventar outro snapshot. O cliente inicia/assina com Date.now real e mantém as fronteiras de timer existentes. A captura de Date.now na página ServerComponent tem exceção de lint somente na linha, justificada por serialização do snapshot; não altera guards/diagnósticos React.

Prova por hydrateRoot real com relógio falso: DOMSSR29min é preservado ao hidratar no minuto30, sem erro recuperável, e atualiza30 após a assinatura. Markup SSR da Lista permanece igual com o mesmo agoraInicial apesar de Date.now mudar; page e Inbox encaminham valor. Fallback ausente/NaN/Infinity/epoch inválido retorna0 e não lê Date.now durante SSR. Descarte/lista/cleanup/SSE continuam nos recortes ampliados.

## Prova real DEV e limites do checkpoint

Na fonte a3da8a153e5291bb4f7d9273194a518fb51a42e4, formal11405 EXIT0 produziu28 PNGs (14 aplicação/14 referências),3 tamanhos/2 temas nos estados conversa/celular-lista/lista-vazia. Todos inspecionados; zero falhas,6 diagnósticos de thread cancelada/recuperada. Aplicação contém telefones fictícios sanitizados pelo integrador; referências originais ainda aguardam helperDOM e não podem ser publicadas nessa forma.

Probe SSR d539e4 EXIT0 provou HTMLSSR29 → cliente30 tanto por timer quanto por relógioCliente60s adiantado antes de hidratar. Mesma linha/nomeSSR, zero warningReact/rede, uma SSE conectada. page.clock controlou somente navegador; prazo temporário preparado/restaurado pelo integrador. O badge usa key pelo texto, portanto sua própria identidade pode mudar após a assinatura; a preservação de linha/nome foi medida separadamente. O negativo produtivo85883 continua preservado e não é reclassificado.

Probe real28814 EXIT0 usou150 conversas individuais válidas preparadas pelo integrador. Paginação50→100→150, janela virtual10–18 botões, alturas90.5–143px, Tab/Shift+Tab através da janela, seleção real35/retorno e resize300/372/390 (client299/371/390) inspecionados nos6 contextos. Âncora e offset preservados; seleção pode permanecer fora do viewport após resize, sem alegar auto-scroll ao selecionado. Nenhuma alteração no motorVirtualList foi necessária. Tipografia3f93f1:44px avatar,14/600 nome,13 prévia,Mono11.5 hora eMono11/600 contador;600 computado pode ser sintetizado.

Manifestos/hashes/negativos/pranchas locais em output/inbox-312-visual; nenhum PNG novo emGit. Referências sanitizadas, depósito remoto confirmado, revisão independente e global integrado permanecem pendentes. Não tratar recorte ou probes DEV como homologação completa.

Atualização das referências: execução38570 EXIT0 recapturou somente14PNGproto com helperDOMv1 declarado (12substituições), sem tocarHTMLoriginal. As14refs foram inspecionadas junto das14app anteriores; todas as49PNG positivas (incluindoSSR3/virtual18) e13pranchas têm allowlist/hash local, sem PNGcommit. Fonteprodutivaa3da8 distinta da fonteHarness5e915. Referências antigas não são publicáveis nem serão apagadas. Depósito remoto confirmado/QA/global integrado continuam pendentes.
