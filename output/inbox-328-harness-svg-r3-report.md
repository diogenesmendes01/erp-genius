# #328 — revisão R3 do harness: SVG vendor real

Base f9485756a67a450a58e61607f01b99f1b1e83f6a. Runtime do produto permanece nessa fonte; esta revisão cria um novo namespace Git do harness. V1/V2/V3/V3r2/V4/DIAG, markers, READYs e artefatos negativos não são regravados ou reatribuídos.

## Finding e delta

Forense independente B: output/inbox-328-v4-forense-semantic-fs-b-private.md/json, leitura autorizada. CartaoExperimental usa IconCalendarCheck sem className customizado. IconCalendarCheck.mjs chama createReactComponent com calendar-check; factory Tabler3.44.0 gera classe tabler-icon tabler-icon-calendar-check. Harness f948 exigia icon-tabler-calendar-check. Desacordo determinístico do oráculo, sem alteração/defeito do produto demonstrado.

Mudança produtiva do harness: UMA linha em semanticaAcoes328, exigindo o token APP exato tabler-icon-calendar-check. A semântica original PROTO continua includes('icon-calendar-check'); não foi tornada exclusiva ao outro token. Reversão dessa linha restaura o módulo inteiro byteigual ao GitLF f948. Todos outros callbacks, drivers e guardas são literais à base.

Teste positivo usa renderToStaticMarkup(createElement(IconCalendarCheck,{size:16,aria-hidden:true})) instalado, parse TSX dos atributos/paths literais e transplante no DOM mínimo. Não copia uma classe inventada para concordar com o oráculo. Os cinco paths e o token produzido são assertados antes de testar o callback real, incluindo serialização VM sem closure. Fixture geral usa o mesmo produtor real. Contrafactuais negativos removem token, mudam sufixo, usam outro ícone vendor real ou a antiga classe falsa explicitamente; não são alegados outputs válidos do vendor.

Cabeçalho/lápis recortados: somente testes condicionais que conservam a rejeição atual e demonstram controle topo acessível. Nenhum sticky/CSS/DOM ou critério geométrico foi modificado. Não sabemos se esse recorte aconteceu no V4.

## Execuções e limites

RED2dfd36 EXIT1: filtro R3 SVG vendor, duas falhas do callback APP (topo e cartao), controle PROTO aprovado,124outros fora do filtro (127total naquele passo). Teste não conta como arquivo completo verde.

Primeiro GREENc91a53 EXIT1:133/134. Um teste adicional pressupunha que a classe APP deveria ser recusada pelo PROTO; mas o fragmento original icon-calendar-check também ocorre no token Tabler. A premissa indevida foi corrigida SÓ no novo teste; PROTO não mudou. Log negativo preservado.

GREENfinalb5734e EXIT0: arquivo src/test/visual-inbox-acoes-oportunidade.test.ts completo134/134, maxWorkers1, Node22heap512; sem filtro/skips,1,29s. Mesmo executor fez lint dirigido dos2arquivos e terminou0. Aviso de plugin vite-tsconfig-paths preservado; nenhuma configuração foi alterada.

TSC/global/INT não repetidos por orientação ROOT; gates anteriores f948 continuam nominais, não atribuídos a esta fonte. Nenhum DB/HTTP/browser/preview/fixture/ação/captura foi executado por esta revisão. Nenhum wrapper novo.

## Históricos operacionais

NativeV4: sessão11939/4dceb5 EXIT1,0PNG,cleanupSSEfuncionou. DIAG único posterior:36225/959d35 EXIT1,1login/7API/0RPC/0PNG; erro na primeira Locator.waitFor de hidratação, sem callback semanticaAcoes, DOM ou PNG. Page.crash não foi instrumentado; tipoError/ERRO_ORIGINAL não permite classificar crash/timeout/targetclosed. Ambos continuam negativos, sem retry. BugSVG é válido por produtor/callback independentemente do DIAG inconclusivo, mas não é causa exclusiva observada de V4.

## Handoff

Seis paths autorizados: adapter, seu teste, SPEC, quadro, este report e manifesto fontes companheiro. Runtime src exceto teste, Prisma/deps, CLI/declarações, guardas953, coletores/originais/pins permanecem protegidos. AGENTS local M excluído do commit. QA exata ROOT/T e eventual READYV5 nova são obrigatórias antes de operação; nenhum GO histórico reutilizável. #328 permanece aberta/sem homologação/publicação.