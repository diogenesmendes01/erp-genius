# PR #402 — comentários remanescentes (DEV B)

Base exata: a8dba58c443ff24be4745e51aab47abed9c4cf2a.
Branch local: codex/inbox-pr402-review-todos.
Revisão lida integralmente no inventário ROOT inbox-pr-reviews-20261023.json:
review5624218030 e comentários6358608071/6360114033.
Esta entrega corrige C3, documenta C4, avalia C5 e preserva C2.
C1/main/CI e C6/conflitos de integração permanecem com o integrador.

## Disposição dos comentários

| Comentário | Resultado e limite |
| --- | --- |
| C1 HIGH | Nenhuma composição/main/retarget/CI executada aqui. O histórico de ancestralidade já está em revisao.md; integração final continua pendente do integrador. |
| C2 MEDIUM | Correção7a825062 preservada integralmente. Hook e teste têm os mesmos objetos9e9ad0a37219022d61db0e668787d399f22e0982 e8c129061fdb77d0d3ce80e788b575e29a55a736a. Regressões de scroll/RAF/intent/pin/foco repetidas. |
| C3 LOW | Uma condição acrescenta shiftKey à rejeição do atalho regional. Ctrl/Meta+F simples continuam abrindo; Shift/Alt, inclusive combinados, não abrem nem preventDefault. Alt já era excluído, preservado agora nos dois comandos. |
| C4 LOW | SPEC registra min-h-11/flex-wrap e as props temMaisDepois, carregandoAntigas e campoRef, com motivo e rastreabilidade. Teste adicional comprova campo controlado/ref/callback. Nenhuma mudança visual ou de interface. |
| C5 LOW | Volume inventariado e justificado abaixo; nenhum artefato histórico removido ou regravado. Esta revisão acrescenta apenas este relatório curto, SPEC/quadro e testes. |
| C6 LOW | Conflitos documentais entre branches continuam sob integração; não foram declarados resolvidos por este patch. |

## TDD e verificação

RED causal b62efa EXIT1: cinco casos, dois falharam (Ctrl+Shift+F e
Meta+Shift+F consumidos), três anteriores passaram. GREEN e67da3 EXIT0:
cinco/cinco. O helper puro não importa Prisma.
Primeiro recorte UTC c9dd5e EXIT1:39pass/1fail por fixture novaC4 que lia
ref em props. React18.3.1 mantém ref no elemento; só o teste foi corrigido.
O negativo está preservado no log privado unit-utc.log, fora do commit.
TSC90600 terminou0 antes dessa correção da fixture; o gate final é13749.

| Gate final, Node22.23.2/localbins | Execução | Resultado |
| --- | --- | --- |
| Sete arquivos de busca, TZ=UTC, maxWorkers2 |95bf5c| EXIT0,40testes,1,57s |
| Os mesmos sete, TZ=America/Sao_Paulo, maxWorkers2 |62c38d| EXIT0,40testes,1,56s |
| botoes/identificacao-registro/confirmacoes, TZ=UTC, maxWorkers2 |9370| EXIT0,3arquivos173testes,18,12s |
| tsc --noEmit, heap8192 |13749| EXIT0 |
| eslint nos três TS alterados, --max-warnings=0 |f3c6f1| EXIT0,0avisos |

Sem filtros de nome ou testes ignorados. Os sete arquivos são
busca-conversa.test.ts, BuscaConversa.test.ts, busca-conversa-dom.test.ts,
useBuscaConversa.test.ts, busca-conversa-virtual.test.ts,
ConversaAberta.busca.test.ts e src/test/visual-inbox-busca.test.ts.
O teste do harness verifica contrato; não houve captura ou alteração do CLI.
Regressões C2 incluem SSE/revisão depois da rolagem manual, RAF pendente,
nova escolha explícita, troca A→B na mesma área e pin fora da janela.

## C5 — inventário e preservação das evidências

git ls-tree HEAD, restrito a output/inbox-316* e output/pr402-qa na base:
25arquivos/261.601bytes/6.245linhas. Onze JSON respondem por5.900linhas;
nove scripts por138 e cinco Markdown por207. Não há PNG nesse conjunto.
Os manifestos/allowlists distinguem fontes, versões normais e complementos;
os relatórios históricos C2 os referenciam. Sua remoção ou compactação
mudaria o inventário congelado e dificultaria reproduzir essa cronologia.
Por isso o patch conserva o conjunto, sem duplicar sondas ou manifestos.
As imagens externas e fontes históricas continuam com os limites registrados
em revisao.md; os gates atuais não reatribuem essas imagens à fonte corrigida.
A avaliação reconhece o ruído de revisão; uma eventual externalização deve
preservar referências e cópias verificadas e ficar separada desta correção.

## Ambiente e pendências

ROOT23967/73da90 gerou o cliente Prisma5.22 correspondente ao schema402
antes dos gates. Nenhuma migration ou banco foi alterado: B permanece490
restaurado pelo ROOT(ffb5430), sem suíte de integração, SQL ou preview aqui.
Schema, enums/labels, deps/lock, harness, PNG, VirtualList e hookC2 não mudam.
O checkpoint337 c203da6 permanece na branch própria, sem porte para402.

diff --check limpo; somente helperDOM, seus testes, teste da barra,
SPEC/quadro e este relatório compõem o patch.
Não houve push, comentário GitHub, browser, novo global ou homologação.
CI/main/integração C1/C6 e revisão independente do novo SHA são os próximos
gates do integrador; esta entrega não declara a PR apta a merge antecipado.
