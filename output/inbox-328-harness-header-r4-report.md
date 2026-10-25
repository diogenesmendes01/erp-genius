# #328 — R4 do contrato da foto inferior (APP/cartao)

Base Git41a34afdc4024e4069f594855d52fb9524141088/R3. Produto runtime continua f9485756a67a450a58e61607f01b99f1b1e83f6a; novo namespace apenas do harness/testes/docs. Nenhuma nova operação ou wrapper.

## Contrato autorizado e implementação

A metadata do driver declara naoProvaHeaderNaFotoInferior=true após observar o topo. O callback exigia nome/subtítulo/lápis inteiros na viewport também na fase cartao. ROOT decidiu explicitar o escopo da foto inferior; o requisito anterior recusaria condicionalmente um header recortado. Não há contradição universal ou geometria nativa comprovada. A decisão técnica explícita limita a foto inferior a identidade/acessibilidade desses três alvos.

Somente app && fase==='cartao': h2 e subtítulo têm cardinalidade1, texto correto e estão conectados/acessíveis/não disabled ou aria-disabled. Lápis é único e acessível para admin e ausente para leitor. Esses três alvos não exigem recorte inteiro na viewport. Não são aceitos hidden/inert/aria-hidden/display:none/visibility:hidden. A regra de acessibilidade existente é reutilizada; não se altera visivel, CSS ou DOM para obter aceite.

O ramo else contém as mesmas expressões de cabeçalho anteriores: Topo e Detalhes conservam visibilidade inteira e PROTO permanece literal. A checagem do lápis fora de cartao é a expressão anterior; não se criou exigência nova em Detalhes, que retorna antes dessa seção. Fields dd, etapas, cartão, footer, ações inferiores, foco, semanticaFechamento, callbacks/driver e SVGvendorR3 são literais à41a fora dos dois hunks declarados.

## TDD e limites dos gates

REDaf7f9b EXIT1, filtroR4:11falhas/24controles/132fora do filtro. Três falhas de recorte esperado positivo cartao com Topo negativo; outras falhas demonstram requisitos explícitos de unicidade e desabilitação. Não é global nem arquivo completo aprovado.

GREENfinal918a27, sessão22009, terminaldfd846 EXIT0: arquivo visual-inbox-acoes-oportunidade.test.ts completo167/167, maxWorkers1, Node22heap512, sem filtro/skips; duração8,71s. Mesmo executor terminou lint dos dois arquivos0. O gate anterior3548f8/37660/b7ebf2 também foi0; a repetição final ocorreu após explicitar Record<string,string> nos atributos do double, sem alterar a lógica do módulo. Aviso vite-tsconfig-paths preservado; configurações/timeouts intactos. TSC/global/INT não repetidos conforme ROOT.

A fixture positiva continua usando renderToStaticMarkup e SVG/paths reais do Tabler3.44.0. Os contrafactuais fora da viewport são positivos apenas em cartao; mesmas condições Topo e h2/subtítulo Detalhes falham; hidden/inert/displaynone/visibilityhidden/ariahidden/disabled/aria-disabled/texto incorreto/duplicado oculto/desconectado continuam negativos. Os outros negativos existentes do arquivo permanecem passando.

## Proveniência e pendências

CommitR3/134gates e respectivos negativos são históricos nominais. NativeV4 e DIAG continuam negativos sem causa exclusiva; DIAG falhou antes dos predicados/sem DOM/PNG. Esta revisão não prova qualquer geometria nativa, homologação ou operação. Não há novaDB/HTTP/browser/Next/fixture/ação/captura/wrapper/install. Runtime/src exceto teste, Prisma/deps/config, CLI/declarações/953/coletores/originais permanecem iguais f948.

Seis paths desta revisão: adapter, teste, SPEC, quadro, este report e manifesto-fontes. AGENTS local M não entra no commit. ROOT/T revisarão o SHA exato antes de qualquer READY/GO futuro; fonte do preview e pinos históricos não são reatribuídos. #328 permanece aberta, sem publicação/aceite presumido.