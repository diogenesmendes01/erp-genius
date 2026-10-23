# Rodapé e compositor — #317

Estado integrado em23/10: gatesROOT85f encerrados0 (897arquivos/7.021testes,
TSC38143,lint49666/42avisos herdados eprivados). Formal4941 refeita24/24PNG
app×protótipo nos3tamanhos/2temas, normal/permissões e C2ERP reais encerrados0,
QA independente e allowlists explícitas. Detalhes/fontes/limites atuais em
output/inbox-317-global-final.md. Os checkpoints pendentes abaixo são históricos.
Visuais317bbb/df9 precedem o porte de transporteC6 idêntico01a; componentes
visuais não mudaram, sem atribuir retryC6 aos registros ERP antigos. CI/revisão/
merge e dependências permanecem gates externos à implementação local.

Base29479848432d2b4fd37972f104b6b7e5cae62368; implementação inline da Task12/brief aprovado. Branch31627b imutável. Só317+319 ativos.

RodapeConversa mantém abas Responder/Nota por atendimento, alvo44 com face26 e teclado/setas/Home/End/aria. Reutiliza Compositor e o único controlador de ações por atendimento (coordenador local/renderprop, sem wrapperDOM). Header/busca/Thread/rodapé permanecem na mesma árvore durante abas/interações/cargas; troca real de contato encerra o coordenador e pode remontar scroller, rulingROOT explícito. Itemnull é fallback real.

Nota usa autorização atual de leitura individual; não depende de envio comercial nem cria backend. Gate de envio null/false/falha continua na abaResponder. Agenda só callback real do controlador existente, nenhum novo diálogo/consulta. Variante travada completa/testável mas nunca ativada pela fonte E1; Aria produtora fica E3/D3. CampoTexto e funções de upload/emoji/voz/respostas rápidas permanecem.

TDD primeiro: resultado antigo sucesso/falha/rejeição não limpa texto/arquivo/erro atual; troca modo libera estado ocupado; A→B→A e cleanup sem vazamentos; tentativas de nota por atendimento+texto, chave estável noerro e renovada apenasok; callbacks existentes de1arg compatíveis. Abas preservam rascunhos separados; nota não inclui anexo/agenda/voz.

Recortes/TSC/lint/SPEC DEV; CLI somente após freeze de código; preview/DB e formais app×protótipo coordenados posteriormente. Sem instalações/package/schema/backend/envio real. Guardas somente registros específicos autorizados após leitura. Identidade e estado de Thread319 pertencemB, sem implementação paralela nessa região.

## Tentativas e revisões locais

O mapa de chaves existente vive uma única vez em ConversaAberta, fora do coordenador com key de atendimento. Rodape/Compositor aceitam a prop opcional; o fallback local é chamado incondicionalmente. O alvo é a tupla JSON atendimento+texto, sem colisões por delimitadores. Retentativa após erro/resultado incerto conserva a chave, inclusive A→B→A e retorno a um texto anterior. Só confirmação ok renova a tentativa original, mesmo tardia; callbacks de um argumento continuam compatíveis.

Contexto de montagem/modo e revisão de conteúdo/arquivo são proteções distintas. Uma resposta antiga não limpa o rascunho de outra aba/contato nem uma intenção deliberadamente editada enquanto aguarda. Uma edição não altera a chave da tentativa incerta. O upload antigo também não despacha mídia nem publica erro sobre o arquivo substituído. Emoji, anexo e respostas rápidas continuam acionáveis. A ocupação é liberada ao terminar, sem aplicar sucesso/erro antigo como resultado do novo conteúdo. Nenhuma lógica compartilhada de idempotência ou fluxo servidor foi alterada.

## Limites do checkpoint produtivo

A variante travada tem comandos reais fornecidos por callbacks, mas não há produtor Aria E1 que a ative. A integração usa sempre modo compositor. Grupo não oferece nota individual. O comportamento de leitura individual foi conferido na action existente; não houve integração DB nesta entrega.

Testes de marcação usam React SSR; parte das interações usa o harness existente tela-sem-dom, com hooks controlados e layout-effect aplicado sem simular cleanup/unmount real. Eles verificam contratos, callbacks e identidade React, não comprovam geometria/foco do navegador. Mount/cleanup real, identidade do scroller, teclado, alvos44, 320×500, imagens app×protótipo, fluxo de permissões, QA independente e global integrado permanecem pendentes de janela coordenada.

O hook useBuscaConversa e seu teste permanecem intactos na base294. A correção C2/#402 é de outra frente e será incorporada pelo integrador antes do QA/formal/global317; este checkpoint não atribui essa correção à própria fonte.


## CLI preparada, captura pendente

Delta separado do produto a86: estado nota12PNG app×protótipo e três tamanhos/dois temas; humano+nota24 formais planejadas. Prontidão confirma abas/campo44/header68/viewport e conteúdo do modo, abrindo nota pelo controle real após hidratação. Aviso do footer não é item da thread314; notas reais continuam estritas. Referência mantém menção futura histórica, app não promete esse recurso. Fonte/hashes e anonDOM392/guardReact/rede permanecem. GREEN8/51, TSC38512 e lint8fontes0 observados, sem browser/DB/imagens ainda. C2 e janela do integrador necessários antes do formal.


## Prova visual e operacional DEV final

FormalR2 na317bbb:24PNGapp×protótipo/humano+nota/trêstamanhos/doistemas, sessão4941 saída0, todasinspecionadas. NormalR2 df9 invariante deproduto:8ctx24PNG, mesmaDOMscroller/VList/âncora0 duranteabas/agendaEscape/busca e rascunhosA→B→A; permissões6ctx12PNG comLucasENCERRADO realGET200/podeEnviar=false e null/503transportecontrolado. Header68/controles44/documentY0; editorResponder80px em320, campo44alto comrolageminterna de texto, não amplo. VarianteAria travada permanece semprodutorE1, semalegarativação.

C2longa317bbb:2ctx10PNG/165decorados, foco natural ao carregar anteriores/149 preservado e000 pinado visível; wheelmanual preservado após atendimento.atualizado real emitido sóROOT (GETincremental?depois, semresync/alterarlinhas). Top631/575 eâncora0px mantidos, mesmosScroller/VList/foco noSSE. Renavegação revela000/149. Fixture isolada150privadas+9originais/4notas, semalegarERPprodutivo; banco restaurado01c7be424hashes peloROOT.

70originais+18pranchas inspecionados, allowlistpositiva-final.json e evidencias-final.json; todaformalantiga16261 eparciais/negativos excluídos. SemPNG emGit/submit/envio/SQLDEV. Resultados tardios/idempotência continuam coberturaunitária, não transação real no browser. UI eCLI inalteradas neste freeze documental; QA/global/publicação eporteC6 posteriores dointegrador.


### Revisão PR403 C3 — armazenamento da tentativa confirmada

Correção sobre a fonte publicada32f9222d8240b77fab1d656043d7399be9226d76. Antes, o guard visual retornava em outro contexto sem remover o rascunho já enviado. Agora a confirmação ok limpa somente a chave do modo/contato original quando owner commitado, revisão e texto bruto persistido ainda coincidem. A limpeza visual atual não repete escrita incondicional no armazenamento. Texto/emoji/arquivo incrementam revisão; erro/incerto mantêm rascunho e a política de idempotência existente.

O mapa é local à ConversaAberta acima da key, repassado opcionalmente ao Compositor; fallback local é chamado incondicionalmente. Registro só no layout effect, sem mutação no render. Remontar o mesmo rascunho cria novo owner e revoga conservadoramente a confirmação antiga, mesmo com texto igual. Desmontar o dono integral invalida o mapa antigo: confirmação daquela sessão já não pode limpar storage depois de novo Inbox. Sem sincronização global, novo formato de localStorage, backend ou alteração da Thread/R6.

REDc65bb8:45testes/3falhas; RED React real/StrictModef0551d:1/1falha de persistência. RED ef5b85: comparação bruta protegida ainda era apagada pela escrita visual; GREEN final10arquivos/257testes sessão48686 saída0, incluindo10testes React reais/StrictMode,43 regressões anteriores e2novos testes controlados. TSC77347 heap8192 e lint8d25f7 cincofontes saída0, Node22.23.2. Lint21b158 inicial falhou por warning do mock, corrigido. Recorte não é full. Sem DB/preview/browser/envios. Visuais317bbb/df9 são históricos; QA independente/global integrado permanecem coordenados.


### Revisão PR403 C2 — Nota por leitura também no menu encerrado

Decisão técnica ROOT: preservar a regra20 vigente, inclusive ENCERRADO. Evidência: server/inbox/permissoes.ts mantém notaInterna=true como alçada, com escopo obrigatório na action; registrarNotaAtendimento em server/whatsapp/acoes-conversa.ts usa atendimentoVisivel(usuario,id,false,tx), sem exigir envio ou atendimento aberto. Projeção de interface não é autorização: nada mudou no servidor, escopo ou permissões globais.

O único delta produtivo C2 é useAcoesAtendimento.pode: !grupo && (aberto || acao===notaInterna) && podeExecutar atual. Agenda, assumir, transferência e gestão mantêm o gate fechado. As ações pessoais já existentes continuam no menu; Nota abre o diálogo existente do contato correto. O rodapé não foi restringido: leitura individual mantém Nota, grupo não; participante sem envio continua com podeEnviar=false.

RED212ccc:2arquivos/11testes, única falha Nota ausente no menu ENCERRADO. GREEN02e329:2/12. Gate combinado comC3:13arquivos/319testes sessão13331 saída0, lint4d0679 oitofontes saída0. TSC1949 inicial falhou só no literal string de fixture; corrigido para literal tipado, TSC85482 heap8192 saída0 e lint5c48e7 testealterado0, Node22.23.2. Recorte inclui permissões unitárias, menu/controlador, composição/rodapé/compositor/idempotência e guardas completas afetadas. Não é suíte global nem integraçãoDB. Nenhum envio/nota de negócio/servidor/browser nesta revisão.

Visuais anteriores317bbb/df9 permanecem históricos, sem atribuir a eles o menu corrigido. Complemento de menu encerrado, QA independente exata e global integrado/publicação ficam pendentes de Ready/coordenação ROOT; não houve push/PR pelo DEV.


### PR403 — complemento positivo do menu e contrato legado

Fonte produtiva29f0e3ece79d59b4240c18430452a7b0c50ed388 congelada, preview ROOT13667, Node22.23.2. Executor028fd6 saída0:2contextos (390×844 claro e1440×900 escuro),8PNG inspecionadas em2pranchas. GET /api/inbox/atendimentos?status=ENCERRADO retornou o item real inbox-demo-lucas-origem-307, SECRETARIA/ENCERRADO/grupo=false; GET painel200 confirmou podeEnviar=false emambos. Nota no menu/rodapé, diálogo real aberto por teclado e fechado comEscape, foco devolvido ao gatilho visível. Agenda/assumir/transferência/gestão ausentes; alvos móveis medidos≥44;0React/externos/submits/overflow/documentY. SSE máximo1simultânea/1ativa,2construções sequenciais no dev (não1total). Nenhuma nota/envio/DBDEV/sucessoERP fabricado; grupo não capturado, cobertura negativa permanece unitária.

Primeiro probe bcb5c2 falhou somente por consultar variável de respostaPainel antes do JSON no celular (null). Negativo preservado em review403-menu-r1 fora daallowlist. R2 usa waitForResponse+json explícitos, pasta distinta. Fontes/hashes porarquivo e anonDOM392/guardReact em review403-menu-r2/manifesto.json. Allowlist positiva distinta review403-menu-allowlist.json:11arquivos,8PNGoriginais+2pranchas+1manifesto,1.225.605bytes; hashes conferidos. Inspeção em review403-menu-inspecao.json. PNGs continuam locais, semGit, não reatribuir aos históricos317bbb/df9.

ROOT identificou expectativa legada AcoesAtendimento.test62 proibindo Nota emENCERRADO. Nosso recorte anterior319 não incluía esse arquivo e não era suíte global; não antecipava aprovação desse contrato. RED local5be328:20testes/1falha, igual ao ROOT/TESTER. Atualização exclusiva de teste conforme ruling regra20: exige botãoNota e mantém negativos Transferir/Encerrar/Assumir; amplia negativos a Agenda/Pendentes/Atribuir/Devolver/Convidar/Bloquear. Busca por contratos encerrados não encontrou outro veto geral aNota; expectativas de copiar/apagar/envio e pendentes fechados foram preservadas.

GREENe86102:9arquivos/126testes (AcoesAtendimento legado explicitamente, useAcoes, ConversaAberta, composiçãoRodape, Menu, Rodape, Compositor, owner realStrictMode, idempotência), saída0. TSC94141 heap8192, lint0b692d testealterado e diff198851 saída0. Produção byteidêntica29f: único delta src é o teste. Guardas combinadas319 do checkpoint29f são históricas, sem alegar novo full. ROOT encerrou13667 e restaurou snapshotA7e0eeb saída0/424hashes551originais; todos browsers fechados antes, AGENTS só blocoNext restaurado. QA exata curta, global integrado e publicação/push seguem comROOT.


### PR403 C3 — retorno sem edição e reconciliação visual (vigente)

Revisão adicional sobre a7ebf56b4fb3391d1013ff776086616c46bb13c1: o critério conservador anterior (novo owner sempre revoga limpeza) era insuficiente para A→B→A SEM editar. Os10testes React anteriores passavam, mas os2novos casos responder/nota reproduziram localStorage e campo com texto já confirmado. Esta decisão substitui a regra histórica de revogar por toda remontagem; desmontagem integral do Inbox continua revogando o mapa antigo.

RED1ae16f:12testes reais/StrictMode,2falhas de persistência. Separar token de intenção do owner commitado corrigiu storage, mas REDvisual6808cf mostrou campo ainda preenchido nos2modos. A solução final mantém token por chave durante remount sem edição e troca token em cada intenção de texto/emoji/arquivo. A tentativa captura token; somente ok com token ainda atual e comparação bruta do armazenamento pode limpar a chave e notificar o owner atualmente montado daquela chave. A assinatura é local e registrada/removida em layout commit; sem registro global, polling, armazenamento de metadados ou backend novo.

A→B→A sem editar: ok limpa armazenamento E campo atual de A, e nova ida B→A segue vazia. Qualquer edição posterior, inclusive editar→voltar ao mesmo texto ou novo arquivo, revoga limpeza; B/outro modo não são alterados. Callback desmontado não recebe notificação; cleanup integral invalida mapa e callbacks antigos não apagam a nova sessão. O armazenamento externo divergente permanece, inclusive no campo carregado dessa edição; armazenamento indisponível mantém reconciliação visual local de melhor esforço sem prometer persistência. Erro/incerto não limpam, política de idempotência permanece.

GREEN388841:2arquivos/62testes (17React reais/StrictMode+45controlados, incluindo emoji/upload/idempotência). Gate dirigido final2293:14arquivos/325testes saída0, inclui legado AcoesAtendimento corrigido, menu/useAcoes, Conversa/rodapé, compositor/owner, idempotência e guardas completas afetadas. TSC57710 heap8192, lint9fc451 trêsfontes e diff537006 saída0, Node22.23.2. Não é full global, integraçãoDB ou QAvisual. Sem preview/browser/DB/envio/instalação/push nesta revisão.

Imagens do complemento menu028fd6 permanecem fonte29f explícita: os controles do menu não mudaram, mas elas NÃO comprovam esta reconciliação C3 nova. Fontes317bbb/df9 seguem históricas. QA independente exata e global integrado/publicação permanecem comROOT, sem homologação presumida.
## Fechamento da composição moderna da revisão403

Fonte741f595e1f9f32cd3511cbba6808bcd005e1c9c8 integra f896 e base317-r3
a8dba58c: C3/menu/rodapé/Conversa iguaisf896,delta adicional só seis arquivos
de prazo puro/Avatar/testes. Contraexemplos adicionais do integradorGREEN19
ae412b,arquivo oficial restaurado paraf896 com17React/StrictMode. Recorte
final8/100344b38 EXIT0. Global53047 EXIT0:899arquivos/7.046unitários,
288,08s,maxWorkers2,sem filtros/ignorados. Nexttypegen/TSC36894/lint6472
EXIT0,0erros40avisosSrc. TESTERf8962/62d60052 e composição7416/85
63aaeb EXIT0,sem DB/browser/global próprios nesta revisão estática.

Pacote85f original preservado; complemento menuA7/29f16PNG/21arquivos,
1.677.732B/SHA4faa6c22... remoto/download/hash confirmados em DRAFT.
Visuais antigos não são reatribuídos ao C3f896/741. C2menu teve prova ERP
sem submit; C3 tem testes ReactDOM/StrictMode e não alega envio ERP/DB.
Pareceres e metadados históricos curados em output/pr403-qa. CI/main/392B2
pendentes antes do merge; sem deploy ou homologação presumida.


## PR403 — C4/C5/C7: contrato explícito e rastreabilidade (23/10/2026)

Base desta revisão: 68e95d8e9cea0842ccdab441be475c302fe9c7e3. Nenhuma mudança em produção, testes, scripts ou permissões. C2 mantém Nota por leitura individual inclusive ENCERRADO, com grupo sem Nota e envio/agenda/gestão bloqueados; C3 vigente continua sendo o token de intenção e a reconciliação visual f896/741 descritos acima. A regra histórica de revogar por qualquer remount não é a regra vigente.

### C4: anexos e gravação pertencem temporariamente a Responder

Os rascunhos de TEXTO são separados por atendimento e modo no localStorage. File selecionado e gravação em curso não são rascunhos persistidos: trocar Responder→Nota descarta o arquivo e interrompe/descarta a gravação. Ao voltar a Responder, o texto reaparece, mas o arquivo precisa ser escolhido novamente e o áudio precisa ser gravado novamente. Nota não recebe anexo, voz ou agenda. Esse descarte é intencional; não há promessa de preservar File/voz, diálogo de confirmação ou armazenamento global.

Inspeção de Compositor.tsx: chave inclui modo; mudança de contexto zera arquivo; cleanup marca descartar e para MediaRecorder. onstop encerra tracks e ignora contexto antigo/descartado, sem anexar Blob ou enviar mídia. getUserMedia resolvido após sair do contexto encerra suas tracks. Upload HTTP já iniciado pode terminar: o guard de contexto/revisão impede despachar a URL antiga ao callback aoEnviarMidia; não há AbortController e não alegamos cancelamento do POST. Envio de texto/mídia já despachado é uma tentativa legítima em andamento, não é cancelado pela troca de aba; seus efeitos tardios continuam sob C3/idempotência.

Essa conclusão sobre cleanup de gravação na troca é inspeção de código. Os testes existentes exercitam gravação→anexo→envio simulado, upload antigo e ausência dos controles na Nota; não foi acrescentado teste específico de MediaRecorder na troca nem feita prova de microfone/browser/ERP nesta revisão documental.

### C5: mapa Task12 → nomes reais

Plano de referência: docs/superpowers/plans/2026-10-22-inbox-prototipo-02-design.md, Task12 (consultado no checkout ROOT; não introduzido nesta branch). Os nomes reais são preservados para evitar renomear testes já auditados.

| Contrato/nome no plano | Arquivo e nome real / prova correspondente |
| --- | --- |
| compositor: abas Responder e Nota interna, dica de respostas rápidas | RodapeConversa.test.ts: compositor oferece abas sem selecionar nota, dica e campo nomeado sem moldura duplicada |
| abaInicial nota: campo e enviar em tons de aviso | RodapeConversa.test.ts: nota inicial mantém aviso e controles internos, sem agendar/anexar/voz; os tons são inspecionados no render de Compositor e nas capturas históricas identificadas, sem atribuir a este caso uma asserção CSS inexistente |
| travado: barra da IA com Nota interna e Assumir para responder, sem campo | RodapeConversa.test.ts: variante travada só mostra comandos fornecidos e nunca campo; variante segue desligada na E1 |
| enviar é círculo de 44 com rótulo acessível; agendar aparece com aoAgendar | Compositor.test.ts: agendar só aparece com callback real e fora da nota; modo responder envia pelo aoEnviarTexto, limpa o campo e o rascunho. Círculo/classes h-11 w-11/rounded-full e span sr-only Enviar estão em Compositor.tsx; a geometria pertence à prova visual histórica, não a um it novo com o nome literal do plano |
| integração ConversaAberta / agenda real | ConversaAberta.rodape.test.ts: um controlador real fornece agenda ao rodapé e ações ao cabeçalho sem duplicar instância; re-render da mesma conversa mantém identidade do scroller/VList e agenda ausente não vira stub |
| abas/teclado/contexto | RodapeConversa.interacao.test.ts: setas/Home/End alternam e focam aba com aria-selected, mantendo o mesmo compositor; contato novo começa na aba inicial e nota indisponível não é selecionável |
| rascunhos separados e resultados antigos | Compositor.test.ts: trocar de atendimento ou de modo carrega o rascunho certo e limpa o erro da conversa anterior; upload antigo não despacha mídia nem modifica arquivo/texto de outra conversa |
| regressão C3 posterior ao plano | Compositor.rascunho.interacao.test.ts: 17 casos ReactDOM/createRoot/StrictMode, incluindo retorno sem editar responder/nota, erro/incerto, intenção posterior de texto/arquivo, modos, storage externo, mídia despachada e cleanup integral |

RodapeConversa.test.ts usa SSR; RodapeConversa.interacao/Compositor.test.ts usam o harness controlado tela-sem-dom. Os 17 casos C3 usam ReactDOM real e StrictMode sobre DOM mínimo, com mocks de controles; comprovam ciclo de montagem/cleanup e callbacks, não layout/microfone ou sucesso ERP. Nenhum deles é chamado de navegador real.

### C7: artefatos curados, fontes e limite de volume

Contra a base própria a8dba58c443ff24be4745e51aab47abed9c4cf2a, o head68e acrescenta em output 22 arquivos/1.826 linhas: 14 MD/501 linhas e 8 JSON/1.325 linhas, zero remoções, zero PNG e zero scripts de probes. A contagem inicial de aproximadamente1,2mil linhas da R1 descrevia um head anterior; o aumento inclui as revisões C2/C3 posteriores. Não é o inventário de todos os outputs herdados do repositório.

Os MD preservam execução nominal, negativos e pareceres independentes. Os JSON são índices/allowlists/hashes/fontes e manifesto do complemento do menu; a maioria do volume é rastreabilidade, não implementação. Preservá-los evita apagar a distinção entre capturas antigas e C3 final. Índice curado e links dos dois ZIPs em output/pr403-qa/revisao.md, seção Evidências visuais e seus limites; relatório desta revisão em output/inbox-pr403-review-todos.md. Não se duplicam os PNGs nem se inclui probe bruto novo.

O pacote original317 (85f) tem122PNG/137arquivos/15.823.526B, SHA256 74a17180135461a99a50e6e48e45b42280ef4b804321607ce3480645ca27f4aa. O complemento menuC2 tem16PNG/21arquivos/1.677.732B, SHA256 4faa6c22ef72e4614d293c869d0986aca56047ee57a5ed5eeb4800490ebaa60c. São metadados históricos conferidos pelo integrador original; nesta rodada não houve download/reupload/inspeção nova das imagens. Fontes317bbb/df9 e29f/A7 não são QA visual de C3f896/741.

C1 (main/CI/retarget/composição) e C6 (conflitos documentais de pais) permanecem com o integrador. Esta revisão não resolve esses gates por declaração nem modifica inbox-nao-lidas-menu.md.


## Follow-up pós-merge PR384 C3 — descrição dos anexos

Base própria4829a27424c2cf6091f5f7c5ea545a888fc0be06, sem portar parcialmente main/fila. Os três itens indisponíveis do menuAnexar mantêm rótulos, disabled e motivos já existentes. A variável local passa a temCapacidade; cada botão referencia por aria-describedby o small que mostra o motivo real. useId é chamado incondicionalmente no compositor; o recurso fornece só o sufixo do ID. IDs ficam estáveis na mesma montagem e distintos entre instâncias, sem derivar identidade de contato/telefone ou criar contador global.

Dois testes ReactDOM/StrictMode sobre DOMmínimo comprovam seis relações em dois compositores, aviso correto com capacidade parcial/semcapacidade, unicidade e estabilidade após capacidades/reabertura. Não substituem leitor de tela/navegador/CSS; nenhum envio/nota foi acionado. RED19dbfc:2falhas/17anteriorespassaram por ausência de aria-describedby. GREEN8cb009:2arquivos64testes, incluindo19ReactDOM/StrictMode e45controlados. MocklocalCompositor.test apenas usa o useId já existente em tela-sem-dom; helper compartilhado intacto. Guardas/rodapé11841a→6420b1:8arquivos145testes0, semfiltro/skipsnovos. Lint3fontesb2079f0; TSCfinal no relatório. Regras Aria/Assumir/nota/permissões não mudam; fotos históricas não são reatribuídas a esta mudança semântica.


### PR384 C2 — Task6 para os nomes reais dos testes

Plano01-correcoes/Task6, consultado noROOT, sem alterar nomes de testes maiores:

| Critério/nome da Task6 | Nome real em Compositor.test.ts / alcance |
| --- | --- |
| com o motor conectado, contato, enquete e localização seguem desabilitados com o aviso de que o envio pelo Inbox ainda não existe | com capacidade do motor, os três anexos seguem desabilitados com motivo do Inbox — três recursos presentes, disabled e AVISO_ANEXO_EM_BREVE, sem aviso de motor ausente |
| nenhum item habilitado do menu Anexar fica sem ação | Mesmo nome real — percorre capacidades vazias/presentes, exige itens habilitados e handlers reais |
| sem motor mantém o motivo existente | contato, enquete e localização ficam visíveis e desabilitados com o aviso do motor |
| capacidades parciais não habilitam formulários inexistentes | capacidades parciais mostram o motivo correspondente em cada anexo, sempre desabilitado |
| modo Nota preservado | modo Nota não oferece Anexar nem avisos de anexos, mesmo com capacidades do motor |

Os dois casos novos PR384C3 de Compositor.rascunho.interacao.test.ts acrescentam relações de descrição/IDs reais em ReactDOM/StrictMode; não substituem os contratos acima nem ativam formulários E4. A denominação do primeiro caso usa capacidade como dado efetivo, sem inventar conexão real no teste. TSC22022→93e8f3 terminou0 após fonte/testes finais; diferenças posteriores são somente esta documentação.
