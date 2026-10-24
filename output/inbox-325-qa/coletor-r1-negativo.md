# #325 — parecer estático negativo do coletor em d1f51e74

**Não aprovado para a nova rodada formal30+6.** Fonte exata `d1f51e74fc96d6f36b195dcbc340089b36b07bf9`, pai `364fd5112b99767bff001c3f635df02828685e34`. Há uma lacuna na barreira real de requisições que permite perder falha tardia, embora o novo predicado puro de recuperação seja restrito. ROOT confirmou o achado e reteve as36 fotos; DEV B prepara correção separada. Não é relato de defeito do APP325 nem de execução de browser pelo TESTER.

Revisão autorizada somente gitshow/diff pelo meu checkout337 `ecc92d4781c5fe0f94f06920442769e8ad37b999`, mantido intacto/client490. Nenhum checkout325, UNIT/TSC/INT dessa fonte, browser/HTTP de produto, SQL/banco, fixture, Save/nota/UI, instalação ou Prisma pelo TESTER. Os resultados16/138DEV e validação focadac578af são evidências do DEV, não gates próprios desta rodada.

## P2 — a espera não cobre GETDetalhes iniciado ainda pendente

Em scripts/visual/capturar-inbox.mjs, linha229, request apenas atribui ordemSTART no WeakMap. Linha233 acrescenta uma Promise a conclusoes somente quando requestfinished já ocorreu. Linha266 faz awaitPromise.all(conclusoes), portanto espera somente as Promises presentes naquele momento: não representa GETs iniciados ainda em voo nem inclui automaticamente Promises acrescentadas depois da chamada.

Interleaving permitido pelo código:

1. GET35 inicia e aborta; GET38 inicia depois, observa200 e termina com JSON/hash igual ao preflight.
2. GET48, do mesmo endpoint/contexto/página/atendimento, já iniciou mas ainda está pendente. Não entrou em conclusoes, pois não emitiu requestfinished.
3. Promise.all na266 termina sem aguardar48. A semântica DOM final pode estar correta por38; o predicado aceita recuperação35→38.
4. O loop de abortados na269 termina e capturas.push na276 registra falhas vazio. Posteriormente48 pode falhar ou ser cancelado por contexto.close no finally278.
5. O listener pode acrescentar essa falha depois que o loop já acabou; o código não refaz a classificação antes do aceite. Além disso,38 não pode recuperar48: sua ordemSTART é anterior.

Este é um caminho estático possível, não reprodução runtime. Demonstra ausência de uma Promise/estado pendente que imponha a ordem de conclusão desejada e a janela de classificação antes do fechamento. Não basta o predicado estar correto para35: o agregado da captura pode ficar falsamente positivo se perder48.

Os23 casos novos cobrem hash canônico/predicado e21 rejeições relevantes. Não exercitam a ligação real request→response→requestfinished/requestfailed→barreira→close do main. O EventEmitter já usado em outro caso testa abrirApp/preflight, não esse coletor final.

## Partes corretas preservadas

O predicado exige GET local exato/ID codificado sem query/hash, net::ERR_ABORTED, ordemSTART posterior, mesmo contexto/página/atendimento, headers observados200, finished retornando null, hash JSON canônico igual ao DTO preflight, página ativa, atendimento atual e semântica DOM final. Status200 sem corpo, falhaHTTP, corpo diferente/JSON inválido, outra identidade e POST/SSE não satisfazem a prova. Hash ordena propriedades recursivamente e preserva ordem dos arrays; não persiste resposta bruta.

O request real liga headers/body pelo mesmo objetoRequest; resposta.finished/json só são aguardados no endpoint exato de Detalhes, sem aguardar a streamSSE. Corpo que não conclui/parseia não deve produzir registro apto. HTTP>=400 permanece falha independente, e o novo helper não apaga outras falhas já registradas.

61853d comprovou o corpo de cancelamentoDeMensagensRecuperado idêntico ao953 e semanticaDetalhes325Pronto idêntica ao pai364. 8b6ba9 confirmou estados-inbox.mjs inteiro idêntico ao953; APP/servidor/lib/schema/deps sem delta neste commit. Não há razão para enfraquecer esses guardas ao corrigir a coleta.

## Critérios para nova revisão

Registrar cada START GET do endpoint exato com deferred/estado próprio e liquidá-lo em finished+body ou failure; a barreira deve abranger novos STARTs enquanto espera, com timeout conservador e SSE fora. Não chamar uma lista de eventos já finished de “todos os corpos iniciados”.

Conservar falhas/novos eventos no selo final e no close; reclassificar antes do aceite, sem uma resposta anterior recuperar um request posterior. Testes do coletor devem cobrir35abort/38completo/48pendente, falha48 depois da primeira espera, novoSTART durante espera, body/finished atrasado, timeout e falha no fechamento. O oráculo precisa exercitar eventos/Promises da ligação real ou helper compartilhado pelo main, além do predicado puro.

Revisar o novo commit exato e seus terminais antes de outra formal. Não reclassificar26ab1b/c588cb negativos nem a PNG rejeitada34cebb... como positivos; c578af semPNG continua validação focada própria, não aceite de36 fotos.

## Hashes das quatro fontes lidas (GitLF)

| Path | Bytes | SHA256 |
| --- | --- | --- |
| scripts/visual/detalhes-inbox.mjs | 11862 | `bb2d397d9b95282ced7095711299e4934bda6b6fb66ddb9ee80888850f9be8b6` |
| scripts/visual/detalhes-inbox.d.mts | 2075 | `946e6861622b45facabf43e90909074d5607d7d1882802c6f5f76ed32ea4b4ce` |
| scripts/visual/capturar-inbox.mjs | 22283 | `603b53eb5f1751e0b2aab3b1ef90040a2aea2680db6808bb4a3d103ac375e263` |
| src/test/visual-inbox-detalhes.test.ts | 16642 | `033d096a53ac06efb181f8303f383ab1e287cb814937087c1aec4c00f2aa3bce` |

Leituras a8292a/875a34/8b6ba9, metadados61853d. Sem alteração de fonte ou de negativos históricos. Aguardo novo freeze do B; não há aprovação formal presumida.
