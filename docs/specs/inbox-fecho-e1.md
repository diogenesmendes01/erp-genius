# Inbox E1 — fecho de componentes e travas (#320)

Estado: código DEV congelável sobre16e3298d9f26d1bdd8ec327bf6acbaec489bb6f3; E1 ainda NÃO homologada. IntegraçõesDB, globalROOT, matriz visual final e QA independente aguardam coordenação. Branch codex/inbox-e1-320, Node22.23.2, perfil dev-email preservado, nenhum preview/DB usado nesta implementação.

## Recorte

PainelFiltros.tsx não tinha consumidor produtivo e foi removido. A coluna atual mantém PopoverFiltros, ChipsFiltro, SeletorNumero e filtros-url; o escopo é das consultas existentes. Os três testes do filtro antigo em ListaAtendimentos.test.ts foram aposentados junto do import/helper/mock/tipo exclusivos, preservando todos os testes da lista. A prova de setores autorizados permanece em PopoverFiltros/page/opcoes-filtro; abas/número em Chips/Seletor/Coluna.interacao; formato público dos parâmetros em filtros-url. A asserção paramsDaUrl({}).toString()==='' foi migrada explicitamente para filtros-url.test.ts. Só títulos/comentários obsoletos mudaram em InboxNovo/page.test/opcoes-filtro e seu testeint.

NotaNaThread e o export do componente AcoesAtendimento já estavam ausentes. O arquivo AcoesAtendimento permanece com hook/diálogos vivos, montagem única317, Nota por leitura individual inclusive ENCERRADO e ações bloqueadas pelo contrato vigente. Leitura/R6, SSE396, URL/ACK, decoração314, buscaC2 e revisãoC3 do compositor não foram editados.

ItemLista permanece usado pelo SinoNotificacoes; Chip por AgendaTarefas, FunilCliente, PainelOportunidade e NumerosPainel. Seus arquivos/testes/exceções de seleção permanecem. contarNaoLidas em consultas-inbox.ts continua sendo a soma compartilhada sob escopo, validada historicamente em linha-comercial.int.test.ts; não foi substituída por contarConversasNaoLidas pessoal311 ou agregados de conversas310. Esse testeDB não foi executado peloDEV nesta janela.

## Tipografia e trava

Os quatro alvos aprovados receberam somente classes de tipografia:

| Alvo | Resultado |
|---|---|
| ChipsFiltro: total de cada filtro rápido | font-mono + tabular-nums |
| ColunaConversas: badge de filtros aplicados | mantém mono e ganha tabular; não é contador do sino |
| PainelContato: contagem opcional de aba | mantém mono/tom e ganha tabular; E1 continua sóDetalhes |
| SeloNaoLidasInbox: pílula pessoal | mono + tabular, preservando99+/plural/zero; variante ponto não é contador e permanece intacta |

Os testes SSR verificam o span numérico real dos componentes, sem alterar produtores/quantidades ou habilitar telas futuras. ItemConversa (hora/badge) e BalaoMensagem já tinham ambos tokens e foram preservados.

inbox-e1.test.ts trava a ausência dos componentes substituídos, export antigo e cabeçalho antigo da page, mono/tabular nos alvos e sentence case local. Nenhum detector/limite/regex de guarda compartilhada foi relaxado; nenhum registro órfão existia para PainelFiltros/NotaNaThread nos mapas. Registros de AcoesAtendimento/Chip/ItemLista continuam ativos. sem-polling já tinha LEGADO vazio e incluía src/lib/eventos-inbox.ts e src/components/SeloNaoLidasInbox.tsx; foi revalidado sem edição.

## Evidência DEV

- RED eb1f6b:5arquivos/30testes,6falhas esperadas (guarda de componente/mono e quatro componentes). RenderSSR do testeColuna exibiu os avisos conhecidos de useLayoutEffect no servidor durante a falha; não houve alteração de helper global para ocultá-los. Não são prova de hidratação em browser.
- GREEN39bc8c:11arquivos/69testes de filtro/coluna/painel/selo/URL/page, saída0.
- Recorte amplo32910:89arquivos/972testes saída0. Filtros por diretório Inbox e componentes/conversa, Selo (unidade+interação), Chip, ItemLista, visual-inbox e guardas botoes/estados-vazios/fundo/campos/design/identificação/confirmações. sem-polling incluído no diretórioInbox. Sem filtro -t, nenhum skip adicionado/observado; configuração unitária padrão exclui integrações. Não é suíte global.
- Next typegen + TypeScript heap8192, executor92066: tipos gerados e terminal0; lint dirigido7e2bc1 nas15fontes alteradas/existentes incluindo nova guarda, max-warnings0, saída0; diff970b810. Node v22.23.2 verificado.

## Gates pendentes para fechar E1

ROOT coordenará global unitário/lintmáximo40, oito integrações src/server/inbox e transversais definidas no brief; um banco/suíte por vez. Só depois de truncantes o integrador restaura551registros/fixture segura e libera preview. Nenhum gate antigo de317/319 foi reatribuído a esta fonte.

CLI final preservada:20estados,100app+64protótipo=164PNG na matriz herdada, três tamanhos aplicáveis/dois temas e N/A explícito quando sem referência. Executar a matriz completa na fonte320 apósReady, com complementos320×500/limiares/foco/teclado/rolagem. Sidebar224, cortes960/1400 e todas as diferenças justificadas anteriores permanecem. Sem seleção mobile mostra lista/conversa oculta; painel500 pode exigir scroll/teclado ao último controle. Não encerrar por classes ou presumir tudo visível no primeiro quadro.

Somente evidências positivas allowlisted/hashes/fontes e pranchas inspecionadas entram no pacote final; nenhum HTML/RSC/JSONAPIbruto/negativo/log/seed/snapshot/credencial. DEV não inicia SQL/seed/servidor/integração externa/push/PR. Aprovação independente, publicação e CI são gates externos ainda pendentes.
