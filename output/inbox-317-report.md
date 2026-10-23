# #317 — checkpoint produtivo DEV A

Branch codex/inbox-e1-317, base imutável 29479848432d2b4fd37972f104b6b7e5cae62368. Worktree inbox-dev-a; runtime Node 22.23.2. Fonte ainda sem aceite visual; commit deste relatório delimita o checkpoint produtivo, não uma entrega homologada. Branch316/27b preservada.

## Escopo entregue no checkpoint

- RodapeConversa: abas Responder/Nota interna por atendimento; semântica tablist/tab/tabpanel, roving tabindex, setas/Home/End, face26 e alvo44 por CSS. Dica somente / respostas rápidas. Variante travada com callbacks fornecidos, ainda sem produtor Aria na E1.
- Compositor: CampoTexto existente, moldura integrada, agenda apenas com callback real e somente Responder, nota âmbar, envio circular com nome acessível/aria-busy. Upload, emoji, voz, respostas rápidas e capacidades atuais permanecem; sem novo transporte.
- Nota individual usa a autorização de leitura já existente no servidor, independente da permissão comercial de envio. Grupo não oferece nota individual. Responder mantém null/carregando, false/negado e falha com Tentar de novo.
- Um coordenador local por atendimento executa o único useAcoesAtendimento existente e chama render-prop como função; cabeçalho/rodapé compartilham ações/agenda/diálogos, sem effect espelhando callbacks. Mesma conversa conserva caminho React do scroller/VList; contato realmente diferente pode remontar por ruling aprovado. Item null usa fallback real.
- Mapa useChavesPorAlvo existente vive acima da key; chave por tupla JSON atendimento+texto, renovada somente após ok. Compatibilidade com callback de um argumento e fallback local incondicional. A→B→A e texto incerto mantêm chave, resultado tardio não escreve no contexto novo.
- Proteção adicional por revisão de conteúdo/arquivo preserva edição deliberada durante await. Sucesso antigo renova apenas sua tentativa; não limpa novo rascunho/anexo. Upload substituído não despacha mídia antiga nem publica erro no conteúdo novo. Sem bloquear emoji/anexo por conveniência.
- Guardas somente nos registros específicos autorizados: dois Botões da variante travada, remoção do antigo Botao Enviar, controles Responder/Nota/Agendar/Enviar, duas ocorrências cruas reais Compositor e exceção aria-busy/modo de Enviar. Algoritmos/limites intactos; Rodape sem exceção de botão cru porque a contagem real é zero.

## TDD e evidências observadas

Todos os comandos abaixo foram observados até a saída terminal. Não houve suíte DB, full global, install, servidor ou browser DEV nesta etapa.

| Evidência | Resultado exato |
| --- | --- |
| ca0cb7 / ee19e8 | RED dos resultados obsoletos/permissão/idempotência e novo componente ausente; esperado antes da implementação |
| 11d703 | RED 4/4 de ligação real Rodape/Conversa antes do coordenador |
| 4ced94 | RED da guarda completa: 1/90 por registro sobrecontado; detector preservado |
| 3b0a6a | Diagnóstico com função original: Rodape zero botões crus; Compositor dois. Ruling ROOT aprovou registro medido |
| 73cd51 | GREEN Botões/Fundo/Compositor: 3 arquivos,124 testes, saída0 |
| 446735 → 0ca797 | RED orientação de resultado incerto → GREEN35; reutiliza executarAcaoCliente existente, sem helper novo |
| 38827 / 33289 | Históricos anteriores à proteção por revisão: 72 arquivos/803 testes e TSC saída0; não são gates da revisão final |
| a27db5 | RED dirigido final: 39 testes,2 falhas. Sucesso antigo apagava edição/anexo novo e falha antiga aparecia sobre a nova intenção |
| 5c42f4 | GREEN39 após proteção local por revisão |
| 173dbe | 41/43, duas falhas no helper de teste acionando botão por texto quando o nome é aria-label; corrigido só o acionamento do teste |
| 972373 | GREEN43/43: upload substituído e nota editada por emoji, confirmação/resultado incerto e chave original cobertos |
| 7989 | Recorte amplo final, saída0:72 arquivos/809 testes,34,75s, maxWorkers2; sem filtro de nome/ignorados. Inbox, componentes conversa, Menu, Botao e guardas de botões/campos/fundo/confirmação/responsivo/identificação |
| 57095 | TSC --noEmit heap8192, saída0, fonte final após revisão |
| fa7780 | ESLint11 fontes/testes afetados, --max-warnings0, saída0 |

Comando do recorte final:

    node node_modules/vitest/vitest.mjs run 'src/app/(app)/inbox' src/components/conversa src/components/Menu.test.ts src/components/Botao.test.ts src/app/botoes.test.ts src/app/campos.test.ts src/app/campos-texto.test.ts src/app/fundo-sobre-pagina.test.ts src/app/confirmacoes.test.ts src/app/responsivo.test.ts src/app/identificacao-registro.test.ts --maxWorkers=2

O node acima é explicitamente C:/Users/Mendes/AppData/Local/hermes/node/node.exe (22.23.2). Configuração unitária exclui integração; o número não é full global.

## Pendências e limites

1. CLI/harness317 ainda não alterado neste checkpoint. Próxima etapa é TDD e delta formal preservando todos os estados anteriores, hidratação, anonDOM392 e guardReact.
2. Browser real/coordenado: três tamanhos e dois temas app×protótipo para humano-compositor/nota; complemento320×500, permissões e agenda/abas/foco/scroll/identidade. Nenhuma PNG317 ou geometria comprovada ainda.
3. Correção C2/#402 do hook de busca pertence a outra frente. useBuscaConversa.ts e seu teste permanecem byte-iguais à base294; integrador fornecerá porte antes do formal/QA/global317. Nenhum aceite desse fix presumido.
4. Interações unitárias usam tela-sem-dom existente, hooks controlados e layout-effect sem cleanup real; não equivalem a hidratação/unmount/foco/medidas de navegador. Identidade comprovada é do caminho React, não observação DOM.
5. TESTER independente, composição com319/C2, global integrado, publicação e CI são etapas pendentes do integrador. Sem autoatribuir gates de outras branches ao checkpoint.
6. Banco dev-email permanece no snapshot original restaurado pelo ROOT282f2f; sem teste DB/server/browser DEV ativo e nenhuma escrita de negócio.

SPEC: docs/specs/inbox-rodape-compositor.md. Quadro recebe apenas seção317; históricos preservados.


## DeltaCLI posterior ao checkpoint a86

O produto a86c9ade33606350c1551c6a5759ebecc9366d6b permanece byte-igual. Novo commit separado altera somente CLI/prontidão/tipos/testes/README e este ledger/SPEC/quadro. Estado nota acrescenta12PNG, humano-compositor mais nota são24 formais planejadas; total136 (72app/64protótipo). Não houve imagem/browser/DB.

- RED8a9d75:6/6 por estado nota/prontidão ausentes e aviso de rodapé confundido com nota314. A correção de escopo exclui somente role=note dentro do footer; notas reais continuam exigindo data-nota-id e ausência de mídia/comandos/status.
- 402067:5/6; restante era mock de getByRole sem options no caso note, corrigido só no teste.
- 224da1:50/51; expectativa histórica124 da coluna atualizada para136, sem remover estado antigo.
- GREENff1da1 EXIT0:8 arquivos/51 testes de harness, sem filtro/ignorados;3tamanhos/2temas combinados em plano. CLI --help é executada por teste sem abrir browser ou DB.
- TSC38512 heap8192 EXIT0; lint8arquivos be4324 --max-warnings0 EXIT0; diffcheck c07e2e EXIT0. Node22.23.2 em todos.

Prontidão317 valida duas abas/seleção/painel e campo atual, header68, controles44 e viewport; nota sem agenda/anexo/voz e sem promessa de menção no app. Abrir nota espera thread real/hidratação e aciona só tab; protótipo usa sua aba/placeholder originais, menção histórica documentada como divergência. Manifesto/fonteApp/hashes, guardReact/hidratação/rede e anonDOM392 após interações/antesfoto preservados.

Formal aguarda C2/#402 congelado e preview fornecido pelo integrador. Testes DOM mínimos não medem CSS real; os tamanhos declarados são plano de captura, não aceite visual. TESTER estático do produto a86 em andamento. Nenhuma captura antiga é atribuída ao compositor317.


## Fonte formal df9 e correção isolada de seletor do protótipo

ROOT forneceu df9aa83cec1f3c96e9cb1794db58bb3b14021b3b (a86+bf4+C2/metadata316, sem estados319); FF próprio0e01fe saída0, tracked clean antes do preview. ROOT informou global15595 saída0 com897arquivos/7013testes e TSC/lint próprios; não são gates DEV reexecutados neste relatório.

Preview ROOT99570, Node22/Next16.3.5, fixture normal307/314 (9mensagens4notas), providers externos vazios. DEV não executou DB/seed/submit/envio/nota/agenda de negócio. Saídas observadas:

- Formal16261 EXIT1: humano-compositor12/12 OK com manifesto próprio. Nota app6/6 OK, mas primeiro protótipo falhou antes do manifesto do estado. Seis appnota preservados como parciais negativos em formal-r1-negativo-nota; não contam para formal completa e não usam manifesto anterior humano.
- Diagnóstico789ffc EXIT0: botão real da referência tem textContent Nota interna, mas nome acessível contém glifo Lucide antes do texto. Footer e placeholder existem. Sem alterar HTML da referência.
- NormalR1/15972 EXIT1 por seletor privado: overflowY=auto selecionava também HEADER; nenhum achado de produto. Mantido negativo. ProbeR2 usa filho com rows reais.
- NormalR2/29367 EXIT0:8contextos320/390/1024/1440×500/dois temas,24PNG,0React/externos. Abas/clique/setas/Home/End/Tab, rascunhos separados, agenda única abrir/Escape/retorno de foco, busca316, A→B→A via lista. Mesmos nós reais do scroller/VList e desvio de âncora0px nas interações da mesma conversa. DocumentoY0/semoverflow; header68/controles44. Larguras medidas do editorResponder:80px em320,150px em390,260px em1024,256px em1440 com painel; altura44. Em320 o texto longo rola dentro do textarea estreito, sem ocultar controles; não alegar editor amplo nesse corte.
- Permissões89958 EXIT0:6contextos390×500/dois temas,12PNG. Lucas-origem ENCERRADO real retornou GET200/podeEnviar=false; null retém GET real e503 responde apenas endpoint exato, rotulados transporte controlado. Nota permanece editável; liberação/retry recupera editorResponder. Sem simular domínio nem comprovar autorização servidor por esse transporte. Respostas HTTP reais e screenshots separados em permissoes-r1.

Todos48PNG positivos desta etapa (12humano+24normal+12permissões) inspecionados em12pranchas locais, sem binários noGit. Nota parcial6 e demais negativos fora da futura allowlist positiva. Diretório privado output/inbox-317-probes. Todos os contextos/browsers DEV fechados antes do ROOT parar99570; NextAGENTS tinha somente10linhas geradas conferidas e foi restaurado isoladamente, regras originais preservadas.

Handoff temporário ROOT autorizou somente o seletor nota-protótipo: getByText exato dentro do footer e verificação tagNameBUTTON antes do clique. App/seletor/esperas restantes e toda produção byte-iguais a df9; referência intacta. Regressão executa o preparador real extraído porAST da CLI em Chrome offline, com pseudoelemento no nome e caso de texto solto que deve ser recusado; sem abrir app/DB.

RED ab9827:2/2 por timeout antigo; GREEN8895b9:Node--test2/2pass, lint2fontes e executor49357 terminal0. Recorte698ece:8arquivos/51testes0, TSC72328heap8192 terminal0, diffcheck12068f0; Node22.23.2. Não atribuir globaldf9 ao novo commit de harness; produção é invariante. Nova rodada formal24, fase longa150/C2, QA final e publicação seguem pendentes de ROOT Ready. CLI319 de B não alterada em paralelo.


## Formal R2 e complemento C2 encerrados — freeze de evidências

HEAD de execução:317bbb791e07a327766f9462156a89b40c6ddd43. FF e1d716 saída0/rastreados limpos antes do preview. Nenhuma fonte produtiva ou CLI alterada durante as provas. ROOT informou global final317bbb:897arquivos/7013testes saída0; global/typegen/TSC/lint do integrador permanecem evidência própria, não execução DEV.

### Rodada formal positiva

Preview ROOT64670, fixture normal9mensagens4notas, providers externos vazios. Sessão4941 terminalEXIT0,24/24PNG: humano-compositor e nota ×1440×900/1024×768/390×844 ×dois temas ×app/protótipo. Todas inspecionadas em6pranchas; hashes/bytes/fonte por arquivo e hashHTMLreferência em formal-r2/*/manifesto-com-hashes.json. GuardReact/hidratação/rede/anonDOM392 intactos,0falhas. Nota-protótipo usa botão real com texto exato; referênciaHTML não foi editada. A referência preserva menção futura/controles próprios, enquanto o app cumpre capacidades reais e nota semanexo/agenda/voz. TODAexecução16261, inclusive humano12 antes positivos, fica fora do pacote final; parciais6appnota/negativos preservados localmente, sem reaproveitar manifesto.

Os24normaisR2 e12permissões anteriores mantêm fonte df9 explícita e equivalência de produção conferida contra317bbb. Não foram repetidos por mudança de seletor do protótipo/metadados. O recorte não representa transação real de nota/envio: houve somente rascunhos locais e abertura/cancelamento de agenda.

### C2/#402 independente, fixture longa isolada

Após parar64670, ROOT preparou helper316A b87915 saída0 e preview53617 da mesma317bbb:159mensagens(9originais+150privadas)/4notas/2dias/165decorados, semproviderexterno. Não atribuir essa fixture isolada a ERPprodutivo. ROOT, nãoDEV, emitiu atendimento.atualizado por Ready; semresync/alteração de linhas/envio/SQLDEV. Transporte deste registro é f8a690 conforme coordenação; C6 futuro não foi antecipado.

Sessão88684 terminalEXIT0,2contextos(390×844claro/1440×900escuro),10PNG,0React/externos/falhas. Carregar anteriores viaUI preservou foco natural no campo e149 ativo/visível;124→165decorados, scrollTop ajustado naturalmente no prepend. Navegar000 pinou/revelou o achado, e000/149 permaneceram visíveis ao renavegar apósSSE. Apóswheelmanual de480px,baseline390 top631 e1440top575: notificação real causou exatamente1GETincremental?depois porcontexto (4→5 e5→6), corpo terminado; janela165/match000/termo e posição manual mantidos, desvioâncora0px/documentY0. Referências DOM/foco salvas imediatamente antesSSE confirmaram mesmo scroller/VList/foco. Essas referências não foram salvas antes dos primeiros prepends: duranteprepend a prova é de visibilidade/ajuste natural, não comparaçãoDOMpré/pós. Navegação explícita muda intencionalmente foco/scroll; preservação estrita se aplica aoSSE na leitura manual.

Todas10PNG inspecionadas em3pranchas. Browsers/contextos fechados porfinally antes de ROOT parar53617. ROOT restaurou snapshot01c7be saída0,424tabelas/hashes e551originais. DEV nunca semeou/alterou banco. AGENTS tinha só blocoNext10linhas conferido e removido isoladamente, preservando instruções/CRLF.

### Allowlist e limites finais

output/inbox-317-probes/allowlist-positiva-final.json contém98arquivos,88PNG(70originais+18pranchas),12.801.910bytes totais incluindoJSON, hashes conferidos. Seleção positiva explícita: formalR224 +normalR224 +permissões12 +C210. Negativos/formalR1/diagnósticos/HTML/logs/credenciais/seeds/probes privados não entram. NenhumaPNG emGit. Resumo sanitizado em evidencias-final.json e índice inspecao-final.json na mesma pasta; imagens permanecem locais para o integrador empacotar pela allowlist.

Este freeze muda somente metadados/SPEC/report/quadro. Gates produtivos a86 e patchaa57 são os já observados acima; não se repetem por documentos. QAfinal/global/publicação/CI e eventual porteC6 permanecem sobROOT, sem homologação presumida. Não iniciar nova implementação. Sem servidores ou browsers DEV ativos.


### Revisão PR403 C3 — armazenamento da tentativa confirmada

Correção sobre a fonte publicada32f9222d8240b77fab1d656043d7399be9226d76. Antes, o guard visual retornava em outro contexto sem remover o rascunho já enviado. Agora a confirmação ok limpa somente a chave do modo/contato original quando owner commitado, revisão e texto bruto persistido ainda coincidem. A limpeza visual atual não repete escrita incondicional no armazenamento. Texto/emoji/arquivo incrementam revisão; erro/incerto mantêm rascunho e a política de idempotência existente.

O mapa é local à ConversaAberta acima da key, repassado opcionalmente ao Compositor; fallback local é chamado incondicionalmente. Registro só no layout effect, sem mutação no render. Remontar o mesmo rascunho cria novo owner e revoga conservadoramente a confirmação antiga, mesmo com texto igual. Desmontar o dono integral invalida o mapa antigo: confirmação daquela sessão já não pode limpar storage depois de novo Inbox. Sem sincronização global, novo formato de localStorage, backend ou alteração da Thread/R6.

REDc65bb8:45testes/3falhas; RED React real/StrictModef0551d:1/1falha de persistência. REDe f5b85 (ef5b85): comparação bruta protegida ainda era apagada pela escrita visual; GREEN final10arquivos/257testes sessão48686 saída0, incluindo10testes React reais/StrictMode,43 regressões anteriores e2novos testes controlados. TSC77347 heap8192 e lint8d25f7 cincofontes saída0, Node22.23.2. Lint21b158 inicial falhou por warning do mock, corrigido. Recorte não é full. Sem DB/preview/browser/envios. Visuais317bbb/df9 são históricos; QA independente/global integrado permanecem coordenados.
