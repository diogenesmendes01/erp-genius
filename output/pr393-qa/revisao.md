# PR #393 — revisão C2/C4

`prazoEstourado` foi extraído para módulo puro, mantendo a exportação cliente
compatível e a comparação estrita. O cálculo compartilhado não carrega mais
o relógio cliente. O teste bloqueia explicitamente esse import; não simula
uma renderização completa de Server Component do Next.

O selo IA do Avatar agora tem papel de imagem e nome “Aria atendendo”. Avatares
sem selo conservam aria-hidden e markup byte a byte idêntico. Não foram
acrescentados nós, classes ou estilos.

TDD: duas falhas causais e 21 passes antes; quatro arquivos / 57 testes após.
A primeira regressão global detectou um literal legado na nova fixture.
Execução interrompida com saída 1; fixture corrigida para SIMULADO, sem
alterar a guarda. Guarda e teste novo passaram em dois arquivos / dois testes.
Regressão completa repetida: sessão 85183, saída 0, 849 arquivos / 6.645 testes,
maxWorkers=2, sem filtro ou ignorados. Integração DB está fora dessa configuração.
TypeScript sessões 73432 e 33014 (após correção da fixture) terminaram 0;
lint global sessão 57857 terminou 0, com
40 avisos herdados. Node 22.23.2.

Chrome offline: 40 pares de tamanhos/formas/tom/selo em dois temas, total de
80 comparações. Medidas e estilos iguais, 40 nomes IA acessíveis; markup
comum idêntico. CSS Tailwind real compilado e componentes SSR reais contra
0720227c. Paths SVG arredondados a 0,001 px por variação numérica do navegador
entre posições distintas; dimensões do Avatar exigem igualdade exata.
As duas imagens foram inspecionadas e permanecem locais. Esta prova usa fontes
de fallback iguais, não uma página Next ou recaptura dos consumidores.

Pais #391/#392 e E0 recebidos por merges normais. C5 de documentação foi
conciliado preservando os registros. C1/CI e parecer independente do head
final continuam como gates. #392/B2 ainda aguarda decisão humana; não integrar
a pilha em main antes desse pai. Sem alteração de schema, permissão, pacote,
lockfile ou transporte nesta revisão.
