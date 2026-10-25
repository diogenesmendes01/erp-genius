# #328 — R5: revelar a aba antes do selo inferior

Base de trabalho75ed2f8f1e94b2bad94cc556d714a502f0a52286; runtimeAPPf9485756a67a450a58e61607f01b99f1b1e83f6a. Revisão somente do harness e seu teste/documentação. Produto, permissões, fonteHTML/CSS, dependências, perfis, coletores, guardas953, declarações, callbacks de aceite e wrappers históricos não mudam.

## Evidência e limite causal

NativeV6r3,92896/086f49 EXIT1: interrompido na segunda cena,1PNG privada do primeiro desktop. Esse lote permanece NEGATIVO e não é homologação; nenhum reaproveitamento automático da PNG. DIAG1 autorizado separado,39407/cc80b1 EXIT1 intencional,diagnosticoObtido=true:1admin/tablet1024x768/escuro,1login7API3RPCnaturais,0ações de negócio,1PNGdiagnóstica. Preservou a mesma instância do primeiro TimeoutError,Page/browser fechados; SSE1START1terminal200/Pageviva. Auditoria sem selo continua negativa; não inferir sua falha posterior de body/hash como origem do timeout.

A timeline do DIAG mediu goto/hidratação/abrirPainel/detalhes/tab/topo e os dois scrolls originais passando. Espera10 falhou em semanticaAcoes328/cartao,30s; primeira linha sanitizada: page.waitForFunction: Timeout 30000ms exceeded. Uma avaliação extra da FUNÇÃO ORIGINAL com argumento capturado,antescleanup,retornoufalse. Não houve clone/bitmap do oráculo.

DOMfacts preservados:
| Alvo | top..bottom |
| --- | --- |
| scrollport |0..768 |
| tabs Detalhes e Oportunidades | -9..29 (38px) |
| tabpanel |30..768 |
| cabeçalho da oportunidade |46..118 |
| select |210..244 |
| cartão experimental |260..387,5 |
| campos dd |403,5..478 |
| Assumir conversa |494..538 |
| Marcar como perdido |538..582 |

O callback de aceite(:128–129) procura a tab selecionada com visivel(e) inteiro. O helper inicia limite.top0 e tolera1px(:83/:93); ambas tabs top=-9 ficam fora, logo nenhuma pode satisfazer esse filtro. Esta é uma recusa comprovável no snapshot, compatível com a avaliaçãofalse. Não afirmar exclusividade de causa durante todos30s, nem reatribuir a causa única do loteNativeV6r3 anterior. Header/lápis fora do viewport,mas acessíveis, já têm o escopoR4; nenhuma nova exceção foi criada. SVG real observado tabler-icon-calendar-check preserva R3.

PainelContato.tsx:97–113 põe cabeçalho+abas+conteúdo num único scroll local, deliberadamente sem sticky. A geometria não prova defeito de produto: existe espaço no enquadramento para revelar as tabs mantendo os alvos inferiores. Por exemplo,um deslocamento hipotético9px dá tab0..38 e último botão547..591; isso é cálculo sobre o snapshot,não medição de uma nova rolagem nativa.

## Único ajuste

Após scrollIntoViewIfNeeded do cartão e do botão inferior(quando permitido), o driverAPP chama o MESMO método nativo no tab Oportunidades, antes de mudar descricao.fase para cartao e aguardar o oráculo. Sem coordenadas,wheel,evaluate-scroll,focus,opções ou alteraçãoDOM/CSS. PerdaInbox/Funil/PROTO conservam seus caminhos anteriores; leitor recebe a mesma revelação de aba após seu cartão.

SDK instalado playwright-core/lib/coreBundle.js:21169–21189 delega scroll estável;:39545 usa DOM.scrollIntoViewIfNeeded. Isso prova a delegação, não garante9px do resultado futuro. O predicado permanece literal e recusará qualquer enquadramento que esconda card/dd/ações ou a tab; a validação nativa futura continua necessária.

## TDD e freeze

RED7cc826 EXIT1, filtroR5:2falhas causais(admin terminava em scrollMarcar...,leitor em scrollAula...) e1controle geométrico positivo;167casos fora do filtro. Adapter ainda era byteigual75ed. GREENadb2d7 EXIT0:arquivo completo170/170,maxWorkers1,sem filtros/skips;lint2 mesmoexecutor0. O aviso informativo preexistente de vite-tsconfig-paths não foi alterado. Nenhum timeout/teste foi aumentado ou omitido.

Novos testes usam abrirAcoesApp328 REAL e o double mínimo existente, exigem ordem exata dos scrolls antes do waitcartao e preservam os dois únicos cliques da navegação. Contrafactual no callback REAL conserva a recusa de tab-9..29, aceita0..38 e recusa inert. O teste de geometria é um controle dirigido, não simulação de Chromium ou comprovação do movimento nativo9px. R1foco/R2nomes/R3SVG/R4header e todos167casos anteriores permanecem.

Sem TSC/global/INT/novo browser/HTTP/DB nesta revisão. Não reatribuir os gates anteriores aR5. O domínio/runtimeAPP permanecef948; deltaSRC só no teste. QA independente do novo commit e eventual namespace/Ready/GO futuro continuam separados.

## Identidades e histórico

Os quatro bytes75ed(adapter,teste,SPEC,quadro) foram copiados antes da edição para output/inbox-328-r5-source75ed-snapshots-private/*.snapshot, com manifestoSHA; nenhuma extensão.ts compilável foi criada para snapshots. R3/R4,NativeV6r3,DIAG1,Ready131,markers/PNGs e seus pacotes permanecem nominais e intactos. O novo harness invalida por desenho os pinos atuais de adapter/teste/SPEC/quadro daReady131; não editar essa Ready para parecer válida na fonte nova.

O futuro diff de F948 terá10paths dePORT:os8 anteriores com os quatro atualizados,mais este report e fontesR5. Não foi criado wrapper novo. Identidades físicas/GitLF e proteção dos corpos/fonte em inbox-328-harness-scroll-r5-fontes.json.

Artefatos privados de diagnóstico,só referência:
- output/inbox-328-diag-tablet-v6r3-5853953b-a40d-4461-91c5-ec48faed741f/manifesto-private.json:280706B,SHA04f5e97e7d48b510a177ffadfe5d145158ae1a7439f3ca6c19c075c84d12f5c6.
- mesma pasta/screenshotdiagnostico-sem-aceite.png:130739B,SHAfca8cd11a4ab560c855c802026e8a859f00b40da0b43aa9ae538050c648c8cf4.
Nenhum desses arquivos é PNG de aceite ou anexo público autorizado. ROOT responde pela auditoria pósDIAG e ambiente; nenhum banco/preview/cluster foi alterado pela DEV.
