# #312 — ledger DEV B

Branch codex/inbox-e1-312, basef56d6c5e3e1d5ce51e022b7b52277baee11c2486. Checkout1af78d exit0, branch311 ficou livre. Worktree exclusivoB, Node22.23.2 local. Decisõesdocs da base lidas; novas decisões de produto futuras não ampliam escopo312. Liberação parcial explícita: implementar consumidor/lista/usuarioId/relógio visual/guards/testes/docs, aguardar base308/harness/preview para capturas.

## Decisões

- Consumer puro usa estadoVisualItem/Avatar/BadgeEstado #309, sem reimplementar derivação. Lista mantém motor VirtualList, threshold100/estimativa104, paginação e EstadoVazio. InboxNovo somente usuarioId.
- Ruling do integrador: estender relógio único às fronteiras visuais de minuto de badge vencido; preservar APIs302 e regra estrita, sem polling/rede. Não acordar quando não muda texto/cor. Primeiro minuto mostra1min desde+1ms e só muda em2min.
- Grupos somente teste de render: trigger20261016110000 impede Atendimento de grupo. Ventura demo é individualB2B. Não tocar schema/trigger.
- CLI principal/núcleo/esperas/READMEharness continuam com DEV A308. Nenhum desses arquivos alterado nesta etapa; nenhum DBsuite/servidor acionado.
- Prova de virtualização real precisa >100itens e alturasvariáveis/foco/scroll. SSR atual não representa esse aceite.

## TDD e gates observados

- REDc5b71f exit1: ItemConversa ausente +8falhas de helper proximaMudancaVisualEm inexistente.
- cb6ca0 exit1: ItemConversa8/8 e regras30211/11 passaram; um caso puro tinha expectativa errada (28min59.5s muda em500ms, não59.6s). Corrigida a expectativa e acrescentado mínimo concorrente200ms; nenhuma mudança de lógica para acomodá-la.
- REDec81e9 exit1: consumidorLista/Inbox4falhas esperadas,39passaram em4arquivos; item/helper já verdes. Número/meta antigos e usuarioId ainda ausente.
- Interação inicial1f0cc2 exit1 por limitação do DOMmínimo sem createElementNS; não é RED funcional do relógio. Ícones decorativos substituídos só nesse teste; React/efeitos/store/ItemConversa/Lista continuam reais. Markup SVG real testado no unitário separado.
- REDrelogio7d2198 exit1:10falhas/1passou, mostrando ausência de timers vencidos/atualização29→30/59→60/StrictMode. Tentativa de substituição sem normalizarCRLF não alterou o timer (b97e5c exit1 com mesmas10falhas); corrigido o trecho com verificação explícita antes de escrever.
- GREEN4e2750 exit0:6arquivos65testes (ItemConversa,Lista,Inbox,prazo-visual,prazo-vivo e interaçãoreal), sem ignorados.
- REDguards83530/ad0f13 exit1:2falhas/420passaram em34arquivos, ambas exigiam registrar a nova linha de seleção no mapa exato de botões. Nenhuma guarda/AST foi relaxada; duas entradas pontuais autorizadas por arquivo/nome e quantidade.
- GREEN97215/4a7788 exit0:34arquivos422testes, sem ignorados no recorte. Inclui todo Inbox,VirtualList/virtual-window,Avatar,sharedSSE/Selo311 e guardsbotões/vazios/paleta/fundo/identificacao/fuso.
- TSC95079/2f7629 exit0 com heap8192 após fonte produtiva atual; só mapa de teste/doc alterados depois.
- Lint dirigido inicial9arquivos beffe8 exit0; final10arquivos21a225 exit0/0avisos. Não rodou fullunit/lintglobal/DBsuite nesta etapa.

Comando do recorte amplo:
```text
Node22 node_modules/vitest/vitest.mjs run "src/app/(app)/inbox" src/components/conversa/VirtualList.test.ts src/components/conversa/virtual-window.test.ts src/components/Avatar.test.ts src/lib/eventos-inbox.test.ts src/components/SeloNaoLidasInbox.test.ts src/components/SeloNaoLidasInbox.interacao.test.ts src/app/botoes.test.ts src/app/estados-vazios.test.ts src/app/paleta.test.ts src/app/fundo-sobre-pagina.test.ts src/app/identificacao-registro.test.ts src/app/fuso-pessoal-telas.test.ts --maxWorkers=2
```

## Pendências obrigatórias antes da entrega

Integração da casca/harness308 pelo coordenador; captura app×protótipo conversa/celular-lista/lista-vazia em3tamanhos/2temas; inspeção real inclusive legibilidade Mono600 sintetizada; >100itens com alturasmedidas/Tab/Shift+Tab/scroll/seleção/resize; preservação de negativos. Depois gates dirigidos finais, QAindependente e global integrado. Nenhuma homologação presumida. Não freeze/publicar como concluída antes dessas provas.

## Integração coordenada e harness

Checkpoint parcial8e981d9796f2f26bb62313f9cc162828935d0276; UI/medidas pendentes explicitamente no commit. Merge da basec7e85eb2014bffd9919eedc1808dcb7dcc5b1f24 finalizado em3712bb9dc459100412538d77da2ff1f076134642. Conflitos: quadro preserva ambas entregas; InboxNovo preserva casca308 e finally311, diferença produtiva contra c7 somente usuarioId na Lista. InboxNovo.test conserva testes308 de limiares/painel e testes312 de badges/usuário/número fora. Nenhum outro conflito produtivo.

Pós-base:74267/ae4e48 exit0,36arquivos435testes; TSC86854/77b378 heap8192 exit0; lintdirigido10arquivosbb8db8 exit0. Não full próprio. Globals/UI do integrador emc7 não são prova da fonte312.

Ownership do harness transferido ao B após freeze308. Delta localizado lista-vazia: app ?busca=zzzz semseleção, esperar EstadoVazio+zeroitens; protótipo preencher busca realzzzz/esperar vazio; três tamanhos/dois temas12PNGs adicionais. RED41e08e:2falhas17passaram exit1; GREEN5e0e11:19testes exit0; lint4arquivos0edb5b exit0. --estado todos passa de38 para50PNGs (26app24protótipo). Outros passos/diagnósticos/guards React não alterados.

Integrador comprovou corrida SSR/caret na captura semseleção e fará fix de prontidão em commit separado após o global de c7. B não implementa espera paralela nem ignora warning; deve incorporar fix antes das capturas. Nenhuma captura312 realizada até aqui.

## Preparo privado150 — só escrito para inspeção/execução do integrador

Arquivo local não publicável output/preparar-inbox-312-virtual.mjs; SHA256C56671787682CD628D528D5387DA111FDEEF31F25D9C69595CB36F51262BB838. Node22 --check/--help exit0, sem banco. Integrador executa após inspecionar; DEV não executou DB.

Guards OWN/cwdB e perfildev-gravacoes/bancohostlocalhost54329 exatos; IDsfixos prefixoinbox-312-virtual-. Valida titularidade de número/contatos/conversas/atendimentos/mensagens antes do primeiro upsert dentro de transação única. Semtruncate/delete/recriarAuth; emerro rollback natural e preservação do banco. Número enumCOBRANCA porque enum atual não possuiSECRETARIA, mas setor e150atendimentos sãoSECRETARIA (padrão existente das integrações), BAILEYS DESCONECTADO semproviderRef. Semgrupo/transporte/actionsenvio.

75casos compartilhados2 com2ENTRADAs,75casos compartilhados0 com1ENTRADA e lidaAteAdmin posterior, sem mexer emleiturasalheias. Todas as mensagens/datas de ordenação são anteriores à menor data das7fixture307 (menos24h), semfixada para manter topo canônico. Novo número produz225mensagens e75nãoLidaspessoais iniciais, não mascarar esse efeito no selo311. Prova150 usa filtro explícito numeroId via UI; formal usa7casos normais. Não há manifesto deexecução enquanto integrador não rodar.

## Probe de navegador previsto

Abrir lista canônica e consumir prontidão do harness corrigido pelo integrador; escolher o número privado pelo select Número, sem requestmock de dados. Carregar páginas por Carregar mais50→100→150. Medir pelo menos duas alturas reais, wrapper virtual e janelaDOM limitada; rolar a lista, verificar contiguidade/ausência de sobreposição/âncora apósResizeObserver. Tab/Shift+Tab atravessam fronteira da janela com linha anterior focada preservada, Enter seleciona atendimento real, voltar para lista preserva seleção. Redimensionar300/372 e390 para forçar quebra/recalcularaltura, repetir foco e coletar screenshots/manifesto com falhas, alturas, offsets e fonte mono computada. Nenhuma extensão do motor antes de diagnóstico caso essa prova falhe.

## Bug produtivo SSR encontrado na captura e correção

Formal iniciado na fontec5c70bd184342e8aa56bcd5ddef55c9fcc23c946/preview3111S90638. Conversa4183exit0 produziu12PNGs, manifesto/hashes em output/inbox-312-visual/formal-conversa (inspeção inicial desktopescuro/tabletclaro). Celular-lista85883exit1 produziu4PNGs: uma falha pageerrorhydration servidor33min/cliente34min; negativo completo/hashes em negativo-celular-lista-85883. Nenhum PNG novo foi commitado conforme coordenação de externalização de binários.

Esse negativo é BUG PRODUTIVO312 de snapshot do relógio, diferente da corrida caret308. Fonte produtiva não foi mudada durante a captura. Após preservar o negativo, ruling aprovou agoraInicial?:number compartilhado: captura únicaDate.now na page, forwardInboxNovo→Lista→hook, getServerSnapshot serializado; fallbackSSR0 determinístico. Cliente/subscribeDate.now atual e timer vivo mantidos.

RED5ca4a1exit1: markup29→30,1falha/12filtrados. REDhidratação inicialaa71be expôs limitação de NamedNodeMap do DOMmínimo, suprida só na folhaSSR sem atributos; REDreal7aacbb exit1 demonstra texto divergente e troca da árvore pelo hydrateRoot. RED733229exit1:2falhas/30filtrados no page/forward. GREEN778cdc:5arquivos57testes0; ampliado61944/53a73d exit0:38arquivos472testes, semignorados. TSC64256/af3533heap8192 exit0. Lintiniciala0ea53 exit0/1warning exclusivamente react-hooks/purity da capturaautorizada na page ServerComponent; justificativa pontual adicionada nessa linha, sem mexer em warningsReact/AST/guards. Fix de produto exige recaptura formal completa na fonte nova antes de seed150.

Capturas/hashes/manifestos/pranchas novos permanecerão locais, sem commitPNG. RelatórioJSON/links remotos serão incorporados após depósito confirmado pelo coordenador; não apagar originais/negativos.
