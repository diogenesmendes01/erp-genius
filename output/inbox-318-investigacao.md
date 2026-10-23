# Inbox #318 — investigação e recorte antes de implementar

Branch própria: codex/inbox-e1-318, criada sobre 243c9348454b6cca5795a6afa747efa25ed3eef1. A fonte314 permanece congelada. Esta investigação não alterou implementação, testes, banco, preview ou quadro global.

Issue completa lida via conector GitHub: https://github.com/diogenesmendes01/erp-genius/issues/318 (aberta, atualizada em 2026-10-22T19:47:32Z). O corpo coincide com o Task13 de docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md, lido no checkout root somente para consulta. O plano antecede a implementação308.

## Contrato encontrado e adaptação proposta

PainelContato.tsx já existe (linha10): controla uma montagem para coluna, overlay e vista própria, com visivel boolean|null, sobreposto, className, aoFechar e focarAoAbrir. useDialogo/focoInicial está na linha25; isolamento local depois da captura do gatilho e cleanup de layout antes do retorno de foco, linhas27–37. Escape preserva o diálogo filho. A assinatura incompleta do plano não pode substituir esse ciclo.

Proposta: acrescentar contato/abas/abaAtiva/aoTrocarAba, mantendo as props e o ciclo308. Preservar o fallback atual enquanto InboxNovo estiver reservado ao B313. Quando houver contato, o cabeçalho enriquecido substitui o genérico; não adicionar dois cabeçalhos nem dois botões de fechar.

Manter um único botão/ref de fechar, inclusive em coluna, para conservar a abertura manual e o foco já provados. Abaixo de700, rótulo “Voltar para a conversa”/chevron; nos demais tamanhos, “Fechar painel”/X. Não aplicar hide1100 do plano: o overlay continua válido entre1100 e1399, e a coluna manual precisa de foco inicial funcional. Os limiares do shell continuam960/1400. BotaoIcone ainda não existe na base243; consumir o contrato do B313 após handoff, sem criar cópia ou alterar o compartilhado. Nesta fase, o Botao atual permite preparar o cabeçalho e preservar o ciclo de foco.

ABAS_ENTREGUES fica central, readonly e com apenas “detalhes”. IdAbaPainel mantém a união prevista, mas nenhuma aba entra só por existir no tipo. AbasPainel terá tablist/tab, aria-selected, ligação ao tabpanel e teclado. D13 deve ficar explícito na regra das abas comerciais; na E1, todas as finalidades recebem somente Detalhes. Tags e abas são leitura, sem edição, lápis ou “+ tag”.

TagPainel pode ser declarado no módulo server/inbox/paineis.ts e consumido apenas como type pelo cliente; evita importar código cliente no servidor. ContatoPainel, AbaPainel e IdAbaPainel ficam no módulo do painel. LinhaCampo será um componente puro: ícone18, altura mínima52, valor14,5/rótulo12,5, quebra anywhere e marcaIA acessível.

PainelSetor retira p-4 do contêiner/fallback e alinha dl/dt/dd, preservando região acessível, rótulos, links do funil, BRL, data civil e estados vazios. PainelAria/AcoesContato/OptOut já possuem seções com p-4/border-t: a composição local precisa evitar padding/divisória duplicados, sem modificar suas props ou ações. A aprovação Aria não pode desaparecer.

## Dados e proteções D13/D20

carregarDadosSetor, paineis.ts:42, aplica escopoAtendimentos. COMERCIAL passa por podeVerLeadNaThread na linha56; pessoaId fica null para responsável legal na linha61. carregarPainel, linha31, já agrega ações, podeEnviar e Aria. Acrescentar tags opcional ao tipo para compatibilidade das fixtures SSR, mas retornar sempre array no carregador real.

Consultar tags somente quando dados.setor é COMERCIAL e pessoaId já foi autorizado e não é responsável legal. Lead oculto, pessoa ausente/legal e outros setores recebem []; fora do escopo permanece null. Preservar carteira, convite vigente/revogação e permissão de envio existentes.

PessoaTag, schema9472–9481: criadoPorId nullable pertence à associação, não à Tag. ia = criadoPorId === null. Ordenar por tag.nome e selecionar apenas nome/criadoPorId; saída pública apenas {rotulo, ia}, sem IDs de autor. Nenhuma migration. Seguir a leitura atual do CRM para vínculos históricos, sem inventar filtro Tag.ativo; ativo limita o catálogo de escolha em ficha-dados, não as tags já vinculadas. tagsDaPessoa não será ServerAction/endpoint nem substituirá a autorização do carregador; preferível mantê-lo interno.

Telefone continua vindo do ItemListaInbox já filtrado. LinhaCampo WhatsApp só entra quando contatoTelefone não é vazio. Não buscar novamente nem flexibilizar a Regra5/PEDAGOGICO.

## Ownership e fases

Agora A: PainelContato e testes SSR/interação; LinhaCampo e teste novo; PainelSetor/teste; server/inbox/paineis.ts, teste unitário com mocks e extensão de paineis.int.test.ts, sem executar integração antes da janela. SPEC dedicada: docs/specs/inbox-painel-contato-abas.md.

Reservados ao B313: InboxNovo, ConversaAberta, BotaoIcone, scripts/visual e helper dialogo.ts. Não editar quadro global ou guardas compartilhadas antes de coordenar.

Após handoff: InboxNovo:319–340 monta contato/subtítulo setor·número/tags e a ordem WhatsApp→setor→Aria→ações→opt-out(não grupo)→triagem. Mantém fetching, guards, races e a mesma instância da casca. O estado da aba é associado à seleção e volta a Detalhes sem remount da casca. ConversaAberta:154 deixa de duplicar triagem selecionada; a ponte de triagem sem seleção de InboxNovo:359 permanece para não esconder controles sem chat.

CLI/núcleo/esperas/README recebem painel-detalhes e preservam tablet-painel/celular-painel, hidratação, diagnóstico React e anonimização DOM392. Guardas botoes/fundo-sobre-pagina recebem apenas exceções específicas de role=tab e tag em superfície, com contagens exatas, após coordenação; nenhuma whitelist genérica.

## TDD e prova real

- SSR/DOM: avatar132, nome/subtítulo/tags, marca ✦ sem autor, XSS, texto longo, somente Detalhes, ausência de edição/abas futuras, tabpanel/teclado e contagem mono. Um botão de fechar, campo e instância preservados entre modos; inert anterior/restauração, Tab/Escape, portal filho e retorno ao gatilho continuam verdes.
- Serviço: não consultar PessoaTag antes da autorização; lead oculto, pessoa legal/ausente, outro setor, fora do escopo, ordem/marcaIA/select mínimo e preservação de ações/Aria/envio. Integração futura com Pessoa e duas tags (criador/null), dono da linha sem carteira e convites vigentes/revogados. Usar enums tipados; não reintroduzir literais de provedores proibidos em src.
- Gates Node22: recortes painel/linha/setor/Inbox/Aria/ações/opt-out e guardas pertinentes, TSC heap8192 e lint dirigido. Full e banco somente em janela do integrador, sempre com saída terminal observada.
- Visual futuro: painel-detalhes/tablet-painel/celular-painel, dois temas, três tamanhos app×protótipo; bordas699/700,959/960,1399/1400, altura500, nomes/tags extensos, sem telefone/grupo, aprovação Aria/triagem acessíveis e foco/resize.

Risco concreto de altura: avatar132+top36+pb26+gaps+nome/subtítulo/tags já ocupa aproximadamente300px. Tags extensas em altura500 podem zerar o conteúdo se o cabeçalho for rígido. Medir antes de fixar fórmula. Preferência quando não couber: um scroller local que alcance todo o painel; alternativa é cabeçalho local rolável com conteúdo preservado. Não esconder campos ou reduzir o avatar por suposição; não criar scroll externo.

## Coordenação necessária

Recomendação: adaptar a casca308 com contrato aditivo, único fechar também em coluna, abas centralizadas e tags somente depois da guarda atual. Registrar a divergência do hide1100/assinatura antiga. Consumir a API real de BotaoIcone após handoff e medir baixa altura antes de fechar a geometria. Banco dev-email normal314 está intacto; nenhum processo DEV foi iniciado.
