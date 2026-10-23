# PR #402 — revisão C2

Fonte funcional: `7a82506297cdbb38f9146fd4d6528a6f49c4e44e`, sobre
`d8dde4a1f948bd45bf8ae6445706dcb5e3fb1294`. Apenas hook/teste alteram o
comportamento; SPEC/quadro e este relatório documentam os gates.

O mesmo resultado não recentraliza depois de um deslocamento superior a 1px
desde a última centralização. Novo resultado centraliza. RAF pendente valida
identidade/posição, inclusive A→B com a mesma área. Foco, pin, VirtualList e
interface posicional do hook preservados. Nome interno rolagemRef permite a
inferência correta do React Compiler instalado, sem waiver de lint.

RED causal: três falhas/10 passes antes da correção. GREEN hook14/14;
recorte ampliado sete arquivos/37 testes, EXIT0. Global final: 893 arquivos/
6.977 testes, sessão30869 EXIT0, sem filtros/ignorados,236,28s. TypeScript
39739 EXIT0, lint global3582 EXIT0,0 erros/40 avisos anteriores. O primeiro
global passou antes da renomeação interna, mas o lint havia indicado dois
erros de inferência; os gates finais acima são posteriores à correção.

TESTER independente examinou o SHA exato: sete arquivos/37 testes próprios,
exec220bac EXIT0, parecer favorável à correção delimitada. Não executou
browser, DB, global ou TSC/lint próprios. A ressalva de acompanhar no ERP a
posição do selecionado após compensação automática da âncora será verificada
na composição317/319. Não identificou defeito reproduzido nessa fronteira.

Chrome de componente, sessão53385 EXIT0: hook/BuscaConversa/VirtualList/CSS
reais, ResizeObserver nativo,150 mensagens fictícias/prepend40,390/1024/1440px
nos dois temas. Manual600/foco externo/pin000/Enter/Shift/prepend preservados;
fonte anterior reproduziu600→0. Última recaptura só ajustou o texto da fixture
para herdar a cor do tema escuro; seis imagens positivas inspecionadas e
métricas conferidas. Não envolve Next/API/SSE/DB nem chamadas externas.

[ZIP positivo](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-pr402-c2-7a825062.zip):
seis PNG/nove arquivos,113.219 bytes,
SHA256 `6a30496c67a9ee472bbf4c58f34e802c8d385a35b10e460a77442094fa07753e`.
ZIP asset668148410, sidecar668148409, release421321214 mantida em rascunho;
download e hash confirmados. README, manifesto e JSON positivo identificam
fonte/limites; sem negativos, scripts, logs brutos, HTML ou credenciais.

C2 resolvido; C1 de ancestralidade/main e CI permanece separado. Sem merge
antes dos pais e do bloqueio de dependências da #392 serem resolvidos.

## Composição C1 posterior

Fonte `fff0095c70068bc8a83c1fbdccb1dc8c3d054566`, sobrec2ecb90c,
recebe base316-r3@1379a138 por merge normal, preservandod32 original.
Contra c2ec, apenas oito arquivos de prazo puro/Avatar/SSE e testes mudam.
Hook/testeC2 idênticos7a825062, busca/UI/scripts idênticosc2ec. Conflito
somente no quadro, ambas as entradas preservadas. Recorte8/52 EXIT0.
Global23642 EXIT0:894 arquivos/6.987 testes unitários,251,81s,maxWorkers2,
sem filtros/ignorados. Next typegen/TSC14950 e lint73243 EXIT0,0 erros/
40 avisos anteriores. TESTERfff favorável10/133 próprios,exec03568d EXIT0,
sem DB/browser/global/TSC/lint próprios. Sem nova captura desta composição.

### Complemento C2 no ERP real, fonte nominal317

TESTER independente na fonte317 `df9aa83cec1f3c96e9cb1794db58bb3b14021b3b`,
com o hook/teste7a, aprovou390×500 claro e1440×900 escuro,executores14374/
89308 EXIT0.159 mensagens/4 notas/165itens,duas páginas anteriores por
cliques reais,149 preservado,000 fora do DOM→pin/linha inteira visível.
Depois da rolagem deliberada,foco em Painel do contato e SSE real,scroll
12.716→12.716 e11.859→11.859; mesma área/ID/foco. Um aviso e um GET2xx de
mensagens com corpo consumido por contexto,uma SSE ativa/um documento.
Dez PNG positivos inspecionados,1.179.830bytes,hashes revalidados no TESTER.

O integrador emitiu pg_notify sem mudar linhas e restaurou o snapshot
TESTER424hashes/1.386linhas,preview encerrado. A primeira tentativa falhou
por contar fontes cumulativas do StrictMode; o observador passou a conferir
concorrência,sem relaxar ID/foco/scroll/GET. Prova com os mesmos dados: não
verifica inserção/edição,permissão ou falhaHTTP. Capturas antecedemC6 e não
são reatribuídas ao fff. Relatório original inbox-317-c2-e2e-tester.md.
Integram o [ZIP317](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-317-evidencias-85f.zip),
com fontes por grupo; recuperaçãoC6 possui prova separada. CI/main/#392B2
permanecem gates antes do merge.

A base316-r3 posterior037a2c3f recebe apenas MD dos pareceres398/399/401
e limpeza404; src/scripts/prisma/package/lock continuam iguaisfff0095c,
zeroPNG298. A comparação de objetos mantém os gates e a origem das provas;
não há repetição de suíte por essa atualização exclusivamente documental.
