# Inbox #358 — composição R6

Base `766a76ab950c100c1d5fd52980f1135ff490f8dd`, candidata `ca58b533b89e0a5bf145381603221bd8b1baf68c`. Os quatro conflitos de código foram resolvidos preservando as entradas de tarefa e o pedido de foco de nota da #332, junto do bloqueio externo, controlador de Assumir e gate de disponibilidade da #358. O setter do rodapé preserva também pedido/foco existentes. Os dois blocos de testes de rodapé foram mantidos. O Menu e o cabeçalho responsivo permanecem com seus contratos.

Todos os arquivos de backend alterados e o gate `useHandoffConversa` ficaram literais à candidata congelada. Provider/dispatcher/CRM/#355 não recebem alteração por esta composição. A fila de texto/mídia permanece transacional, com releitura depois da espera, sem upsert tardio; nota interna não passa por ela.

Verificação do índice composto: sessão12808/terminal52fe1c, EXIT0; **131 arquivos completos/1594 testes**, 108,35s, um worker/2048 MiB, UTC, configuração original, sem filtro de caso ou novos skips. Inclui Inbox inteiro, componentes de conversa/compositor, Modal/Botao/ConfirmarAcao, guardas pertinentes, fixture de tags e puros dos núcleos. Log completo privado: `inbox-composicao-358-r6-focal-711ac63c-f58b-46bf-9545-9382aaf33c39-root-private.log`; recibo terminal homônimo registra árvore `9096a81fee47476e5039298dc6559f91187fed15` preservada durante a execução. Não é suíte global.

Integrações independentes na candidata: nativa1/23 `11618/945439` e regressão5/48 `89438/484951`, EXIT0, sem somar sobreposições. UNIT/oráculo independente final ainda pendente na data deste registro. O banco do TESTER foi restaurado em26472c EXIT0 após a liberação,1393 originais/424 hashes, sem SQL posterior. O DEV entregou UNIT106/1364, nativa23, regressão48 e lint19 sem avisos; suas fontes e negativos constam no relatório próprio.

QA independente final da candidata: UNIT26/568 `1667/6f53cd` e oráculos próprios3/3 `5db439`, EXIT0; parecer SHA256 `b23e43e17eb08399130e83b552a9e7542b446e410b6ad546585ea82703983f6e`. Esses resultados complementam os recortes SQL acima e não são somados como casos únicos.

TSC/global/lint originais da composição, build/CI e aceite visual permanecem pendentes. Não se presume aprovação visual, fechamento de issue ou merge em main.

## TypeScript da composição com C3 do modal

O original na fonte `c2b77326` terminou `48093/2743cc`, EXIT2, com um diagnóstico test-only: `p` não existe no helper `abrirAba331` de InboxNovo.interacao.test.ts. A fixture de atualização da lista passou a usar o `props` já definido, sem alterar runtime ou asserções. Arquivo completo `cb8485`: EXIT0,119 testes. Replay TypeScript original `83354/7b68cf`, EXIT0, fonte de trabalho SHA256 `79ae7bff8413c00382589df600be456eb1f1dd023b6f80d038cc5c7467a46370`, preservada durante a execução, junto das configurações. É execução do WIP corrigido antes do commit, sem reatribuir aprovação ao HEAD anterior. O diagnóstico e os dois recibos foram preservados; nenhuma SQL repetida por esse ajuste de fixture.
