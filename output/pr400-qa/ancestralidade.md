# PR #400 — C1, composição dos pais

Fonte `08f7fadaf497e5fca609c5f0346602cecf7181ca`, sobre
`92d493b212689c41071a0f3ba9737e72c1d1fabf`.
Nova base `codex/inbox-e1-base-313-r3@633e53e648238ef10f9d977e1a41ebe89f6eed9f`;
a base original5f6a2992 permanece intacta.

O merge normal do main5f476a19 produziu b1dafc5, árvore inteira idêntica à
base5f6 (`c7158d3e0d68fed2567bafe28e0c86d410c2830a`). Antes, merge-tree
com merge-base explícita6961392 confirmou que os cinco conflitos de código
eram de ancestralidade do squash394. Foram preservados os cinco arquivos da
base. O merge reintroduzia64PNG já arquivados: saíram somente do índice,
mantendo cópias locais. Dezenove linhas repetidas do quadro foram comparadas
linha a linha; o único estado divergente era o antigo pronta para PR,
substituído pelo link da PR já presente. Nenhum registro distinto removido.

633e53e6 recebe3976e6 por merge normal, preservando ambas as seções de
documentação e os testes SSR314/identidades. O merge08f na PR400 teve somente
conflito do quadro, conciliado preservando as duas entradas. Delta de código
contra92d: nove arquivos de prazo puro/Avatar acessível/SSEbabd. InboxNovo,
seus testes de interação, ConversaAberta, scripts de captura, leitura
automática f51, R6, URL/ACK e package/lock permanecem byte a byte iguais.

Gates do08f: recorte oito arquivos/150 testes EXIT0; global74482 EXIT0,
879 arquivos/6.886 testes,242,57s,maxWorkers2,sem filtros/ignorados.
Next typegen e TypeScript47616 EXIT0; lint global96198 EXIT0,
0 erros/40 avisos anteriores. Logs privados pr400-restack-*.log.
Nenhuma instalação, mudança de lock, schema, DB, preview ou recaptura.

A integração DB do C2 anterior permanece nominal à fonte260a: duas suítes
completas dirigidas/20 testes,44027 EXIT0; backend e seus testes inalterados
na composição. Não representa execução da suíte completa de integração.
TESTER exato08f favorável: dez arquivos/163 testes próprios,execafb4ce EXIT0;
objetos dos nove arquivos e demais módulos preservados conferidos. Sem DB,
browser ou global próprios. C1 de código resolvido localmente; retarget/main,
CI e #392/B2 continuam gates antes do merge. O novo C6 da revisão396 será
tratado separadamente, sem atribuir retentativa inexistente a este resultado.

## Extensão C6 posterior

Fonte `c221bdb36b22e25141f8c58ac5498fa1db5a839f`, sobref64d2afe,
recebe base313-r3@4119b6c por merge normal. Apenas os dois arquivos SSE
mudam, objetos idênticos01a254f5. Todo o resto de src/scripts/backend,
leitura f51/R6/URL/ACK, package/lock permanece idêntico ao f64. A atualização
posterior da base para b29e7c20 e da composição muda apenas dois MD do parecer397.

Global finalc221:879 arquivos/6.894 testes unitários,sessão3971 EXIT0,
270,86s,maxWorkers2,sem filtros/ignorados. Next typegen/TSC50060 e lint29580
EXIT0,0 erros/40 avisos anteriores. TESTER exatoc221 favorável:sete arquivos/
133 testes próprios,exec3f5f3a EXIT0, incluindo fila/leitura/foco; sem DB,
preview/browser/global próprios. Não há nova recaptura ou reatribuição de
evidências históricas. CI/main/#392B2 ainda pendentes antes do merge.
