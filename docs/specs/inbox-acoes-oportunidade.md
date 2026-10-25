# Inbox #328 — experimental e ações da oportunidade

Status: produto DEV implementado e congelado para QA; integração backend, fixture/preview e aceite visual ainda aguardam admissão específica. Não é conclusão/homologação da issue. Base668abe65 da PR427, com a fundação327/328 preservada.

## Escopo entregue

CartaoExperimental é projeção do DTO autorizado da #327. Sem dataExperimental não renderiza; com data, apresenta título/ícone, instante no fuso efetivo com fallback institucional, professor ou Sem professor e status. Prioridade: NO_SHOW → Não compareceu; EXPERIMENTAL_REALIZADA → Realizada; depois confirmação → Confirmada; demais → Agendada. Horário passado não inventa realização. Não há formulário, agendamento, confirmação ou check-in novo no Inbox.

Editar é navegação para o ID já autorizado da oportunidade, codificado no href, somente com podeAbrirFunil. Essa capacidade é distinta de moverEtapa. Convidado contextual sem CRM global continua vendo o cartão sem ganhar o link. Page propaga fusoEscola já consultado, separado do fuso pessoal efetivo, sem nova query. Não depende do timezone do navegador/Node; não há hardcode de cidade.

A seção de ações usa Botao fantasma/md, alvo mínimo44px e ícones17px. Perda só aparece com moverEtapa e o destino D8 PERDIDO retornando marcarPerdido. Botão e barra chamam o mesmo aoAbrirPerda. Encerradas/readonly não ganham perda. Modal, snapshot de sessão/identidade, drafts/ACKs e exclusão mútua com editor permanecem literais da #327.

Assumir conversa usa a ação canônica assumirAtendimento(atendimentoId), com um argumento capturado no callback, fora de qualquer transação CRM. O cliente usa podeExecutar com setor/responsável/linha comercial/dono da linha e guards de aberto/não grupo. Não copia papéis, altera carteira ou adiciona autorização. Callback Promise<Resultado> é tratado pelo executor idempotente, com busy/erro/sucesso. Reconciliação ocorre por aoMudar existente e somente se a instância keyed por atendimento/oportunidade continuar viva. Não há promessa de SSE: a ação existente faz Evento/revalidatePath e não chama avisarAtendimento explicitamente.

Não implementa D3/#357: nenhuma pausa MANUAL, cancelamento de sugestões da Aria, transferência de carteira ou envio. #354 é D1, não D3. O backend de perda, CAS obrigatório3args, núcleoTx, APIs/permissões/helpers, schema/deps, Compositor/ConversaAberta e harness visual não foram alterados.

## Guardas e evidências

Uma entrada exata aprovada em MAPAS_DE_TELA: CartaoExperimental.tsx / if o.etapa. A função deriva o estado da ocorrência de etapa+confirmação; não substitui ETAPA_LABEL. Classificador literal à base após retirar essa única entrada; negativos e exceções anteriores preservados. Finding71152/11c102 permanece negativo. Classes de perigo inicialmente inexistentes foram corrigidas para aliases reais bg-red-50/text-red-700, sem exceção de paleta.

UNIT global76840/115414 EXIT 0:948 arquivos/7.799 testes,303,68s, maxWorkers2, sem filtro/skips, configUNIT excluiINT. TSC original19172/614085 EXIT 0, Node22heap8192,--noEmit--incrementalfalse, semconfigaux/exclusões extras. Lint11arquivos965991 EXIT 0, com lint do teste de foco refeito em fc19c1 após ajuste apenas de tipo. Oráculos incluem20 combinações de status/render, fuso/DST/SSR, alçadas independentes, contexto completo de assumir, clique duplo, erro/ACK antigo, owner/modal/foco.

O teste novo de foco inicialmente exigia o botão da seção; o diagnóstico mediu Fechar painel do contato visível/nãoinert no painel que retoma a propriedade modal. Só o oráculo mudou, sem Modal/Drawer/useDialogo. O DOM mínimo não comprova CSS/foco nativo. TS2339 anterior foi só no tipo do método getClientRects realmente instalado no fixture; preservado e corrigido localmente, sem mascarar produto.

Report output/inbox-328-produto-report.md e manifesto output/inbox-328-produto-fontes.json registram fontes, logs/negativos/gates/proteções. Servidor/helpers/schema/deps/scriptsvisual intactos, owner327/OR420/defaults343 preservados. Nenhuma INT, DB, fixture, preview, browser, Assumir/perda real, envio, captura ou upload nesta entrega. Corpus18 da #327 continua nominal e não comprova o novo cartão. QA independente, backend se admitido, visual e publicação continuam pendentes.

## Harness328 — código offline, operação pendente

A entrega de produto descrita acima continua nominal c0ac/merge87c01c49; agora existe adapter visual separado, sem mudar produto runtime (deltaSRC somente testes). Quatro estados aprovados e30cenas planejadas: painel-acoes-experimental12APP+PROTO; painel-acoes-perda6APPInbox; funil-perda-referencia6APPFunil funcional, nuncaPROTO; painel-acoes-experimental-leitor6APP. CLI328 comprova268tarefas(238herdadas+30novas), semduplicatas,190/220byteiguais; APIs327 permanecem238. Nenhuma captura328 realizada.

Preflight4GET/semredirect ou retry, contexto/IDs/DTO/bodyhash e cabeçalho do produtor; fuso/configuração e contextoAssumir exigem pinREADONLY ROOT, não alegar capacidade nova no DTO. Bloco específico/legacyexato, acessibilidade/scrollport/clipping, statusidle versus anúncioacessível, hora/fuso/status/professor/capacidades independentes recebem oráculosreais autocontidos. Perda abre/preencheOutro+observação/Voltar, sem submit. Funil reutiliza Drawer aria-label/foco interno pós-useDialogo, sem marcador de hidrataçãoInbox. Nenhum agendamento/carteira/pausaMANUAL D3 ou novoaviso foi implementado.

Freeze eb1a25:4arquivos completos/128UNIT e lint6 EXIT0, sem filtros/skips/warnings. TSC_FINAL: 73293/4bd4b8 EXIT0, Node22heap8192/noEmit/incrementalfalse, config original sem aux/exclusoes. Report/manifesto: output/inbox-328-harness-report.md e inbox-328-harness-fontes.json, com negativos e namespaces de hashes. API327/953,coletores,originais,pinosRootLF/CRLF e produto87 permanecem protegidos. CLI não substitui wrapperrestritivo; futura admissão exige rede/API/streams/build/credenciais privados concretos e QA/GO. Não houve DB,fixture,HTTP/browserreal,preview,ação/captura/upload; corpus327 não reatribuído. #328 continua pendente de visual/operação autorizada/QA/publicação.


## Revisão R1 do harness: foco obrigatório no instante do selo

A QA da fontefa7 encontrou que perda aceitava formulário estável sem foco e Funil não verificava perceptibilidade do foco. Novo callback aplica nos dois ramos a mesma guarda:activeElement conectado,não disabled,contido no modal e visivel pelo helper/clipping existente. Não se acrescenta focus() ao driver para fabricar condição positiva. Fixture estabelece/asserta foco real nos positivos; negativos isolamBODY/externo/desconectado/hidden/inert/aria-hidden/disabled/opacity0/clipping/fora/zero, preservando os outros selos.

RED72f6f9=18falhas/100controles;GREENe70747=1arquivo completo118/118+lint2 EXIT0,w1,sem filtros/skips/warnings. TSC_R1: 9345/bd4aa7 EXIT0, Node22heap8192/noEmit/incrementalfalse, config original sem aux/exclusoes. Manifesto/report desta revisão são output/inbox-328-harness-foco-r1-fontes.json e inbox-328-harness-foco-r1-report.md. Pacotefa7/QAnegativa/gatesanteriores permanecem nominais;CLI/declarações/produto/originais/coletores/pinos literais. SemDB/HTTP/browser/captura/ação real;homologação/visual328 continuam pendentes.


## Revisão R2: nome do modal conforme o chamador

Inbox abre perda com produto??título; Funil usa nome da oportunidade(=tituloDTO). Adapter passa a aplicar esse contrato no callback e no selectorreal getByRole, preservando produto/título distintos na fixture formal. Testes de callback com rótulosDOM independentes rejeitam a outra superfície; selectorreal extraído por AST cobre os dois nomes e fallback semproduto. Nenhum dado foi igualado para mascarar a diferença;R1foco/produto/owner/Modal/fluxodeconfirmação/CLI/declarações/shareds/coletores/pinos continuam intactos.

REDbb6776=4falhas/120controles;GREEN639ae8=arquivo124/124+lint2 EXIT0,w1,sem filtros/skips/warnings. TSC_R2: 37760/f6d472 EXIT0, Node22heap8192/noEmit/incrementalfalse, config original sem aux/exclusoes. Manifesto/report novos inbox-328-harness-nome-r2-fontes.json/report.md preservamfa7/R1 e suas QA/gatesnominais. SemDB/HTTP/browser/captura/ação;#328não homologada.

## Revisão R3 do harness: SVG do produtor real Tabler

A forense FS da fonte f948 confirmou um erro no oráculo, não no produto: IconCalendarCheck do Tabler3.44.0 produz `tabler-icon tabler-icon-calendar-check`, enquanto o harness exigia `icon-tabler-calendar-check`. O callback APP passa a exigir o token exato produzido, separado por whitespace. A expressão de classe PROTO continua usando seu fragmento original `icon-calendar-check`; produto/HTML/CSS/SSR/DTO e critérios de foco/geometria/estado permanecem iguais.

O teste renderiza IconCalendarCheck real por ReactDOMServer e transpõe atributos/paths do SVG para o DOM mínimo; a fixture positiva deixa de inventar a classe esperada. RED2dfd36 teve duas falhas causais (topo/cartao), um controle PROTO e124fora do filtro. GREENfinalb5734e: arquivo completo134/134, w1, sem filtro/skips; lint2 EXIT0. Um negativo adicional indevido de exclusividade do PROTO permaneceu em c91a53 e foi corrigido apenas no teste, sem mudar seu critério legado. Não houve TSC/global repetido nesta revisão; os gates anteriores continuam nominais às suas fontes.

Contrafactuais de cabeçalho/lápis fora do recorte preservam a rejeição atual, com controle topo acessível; não demonstram a geometria do navegador. NativeV4 e DIAG único continuam negativos: DIAG falhou antes dos predicados, sem DOM/PNG, logo não confirmou causa exclusiva nem refutou o finding SVG. Evidências/identidades em output/inbox-328-harness-svg-r3-report.md e inbox-328-harness-svg-r3-fontes.json. Nenhum novo wrapper/DB/HTTP/browser/ação/captura foi executado nesta revisão. QA independente e eventual READY/fonteV5 são etapas futuras; #328 não homologada.