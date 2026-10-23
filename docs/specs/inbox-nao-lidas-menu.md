# Selo pessoal de não lidas no menu — #311

Implementação da E1 Task6 sobre #299 e #310. O menu conta **conversas pessoalmente não lidas em todo o escopo**, igual ao chip Não lidas sem filtros. Três mensagens numa conversa contam uma conversa. A Sidebar continua com 224px e o selo conserva classes/tamanhos existentes; esta entrega não redesenha a casca da #308.

## Servidor e autenticação

condicaoNaoLidaPessoal foi extraída sem mudar sua regra: marcação pessoal explícita; ausência de leitura pessoal com contador compartilhado positivo; ou ENTRADA posterior a lidaAte pessoal. consultas-pagina e contarConversasNaoLidas usam a mesma condição combinada com escopoAtendimentos. Sem papel Inbox a contagem retorna zero antes de qualquer consulta.

GET /api/inbox/nao-lidas exige sessão e papel em cada chamada, responde { total } com Cache-Control: no-store, 401 sem sessão e 403 sem acesso. Contagens não seguem filtros da lista nem o tamanho da página. Não há schema, migração ou permissão nova. contarNaoLidas legado permanece porque ainda possui consumidores/testes fora deste recorte.

## Cliente e ciclo de vida

assinarEventosCompartilhados mantém uma EventSource por aba, inclusive Sidebar, BarraMobile, Drawer e Inbox juntos. Cada assinatura tem identidade própria; limpeza duplicada é idempotente e a última assinatura fecha a fonte. StrictMode pode criar fontes sequenciais, nunca duas simultâneas. Callbacks antigos de fonte encerrada são ignorados. Reconexão nativa gera resync; assinante novo de fonte já conectada recebe resync dirigido para cobrir o intervalo do snapshot SSR. Falha de um ouvinte não impede os demais.

useEventosInbox conserva assinatura e API antiga reexportada. A loja useSyncExternalStore só é criada no browser durante subscribe, sem fetch ou mutação global durante render/SSR. O snapshot SSR é a prop inicial. Nova assinatura/prop SSR reconta mesmo quando outro consumidor continua montado, pois leitura pessoal pode não gerar NOTIFY. Zero oculta o selo sem remover a assinatura. BarraMobile sem navegação Inbox não assina a loja.

A loja reage a mensagem.nova, atendimento.atualizado e resync; mensagem.status não reconta. Há no máximo um GET em voo e uma repetição pendente. Rede/5xx/JSON inválido preservam último total; a repetição pendente também escoa após erro. 401/403 limpam total e pendência. Último unsubscribe avança geração e descarta resposta antiga, inclusive JSON tardio; remount espera o voo antigo terminar antes da busca nova. Sem polling. InboxNovo apenas chama recontarNaoLidasInbox no finally de marcarAtendimentoLido; reconciliação otimista e proteções #299/#310 permanecem.

## Demo e prova visual

demo-inbox.ts --entrada thiago aceita somente uma das sete chaves fechadas e exige fixture BAILEYS desconectada no banco local de teste permitido. Insere ENTRADA fictícia e atualiza contadores dentro de transação. O trigger existente publica mensagem.nova após commit; não há NOTIFY duplicado ou envio por transporte.

capturar-selo-inbox.mjs é o harness dedicado coordenado com #308. Exige exclusivamente dev-gravacoes/localhost:54329/erp_genius_test_dev_gravacoes e IDs fictícios exatos. Prepara só preferências pessoais de Admin: Thiago/Ventura marcadaNaoLida=true e lidaAte=null, outras cinco lidas; preserva compartilhados/fixada/silenciada. Não restaura sharedcounter por SQL. Após abrir Thiago a regra existente pode zerar seu contador compartilhado, motivo pelo qual só lidaAte=null não basta para preparar outra rodada.

Ruling do Step5: conversa selecionada lê automaticamente entrada nova. Para provar subida estável, após 2→1 navegar Home desmonta a seleção sem recarregar. Entrada CLI então sobe a 2 nas duas abas. De volta ao chat, outra entrada reconcilia para 1 e não provoca loop. Essa etapa adicional preserva #299/#310.

Evidência em output/inbox-311-visual: 24 PNGs app (4 fases × 3 tamanhos × 2 temas), seis referências reais do protótipo offline, manifestos e pranchas. O protótipo possui outra navegação; comparação limitada a tokens/cores do selo, sem afirmar paridade da casca futura. Fotos esperam fontes, SSE/GET inicial, Drawer dentro do viewport e transições CSS finitas. Estilo só de screenshot oculta toast Next sem issues; diagnósticos continuam ativos. Tema/viewport não muda a largura da Sidebar (224px).

## Verificação e limites

Recortes e códigos observados em output/inbox-311-report.md e quadro-entregas. Integração dirigida foi exclusivamente no perfil dev-gravacoes, antes da preparação final/preview; não é suíte completa de integração. Captura final95056 exit0: 24 PNGs, zero falhas e zero diagnósticos. Cada aba teve SSE ativa/máxima1 e GET máximo1. Todas as 24 imagens e seis referências foram inspecionadas. Tentativas negativas preservadas separadamente são problemas do harness/preparo, sem alegar correção de fonte produtiva por causa delas.

Revisão independente e gate global integrado #308+#311 permanecem a cargo do integrador antes da publicação. Não há homologação presumida, push ou PR pelo DEV.
