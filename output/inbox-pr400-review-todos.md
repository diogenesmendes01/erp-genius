# PR #400 — comentários remanescentes (DEV B)

Base exata: 3b852c548337f56ae284c747ad403c85a9f3fdf4.
Branch local: codex/inbox-pr400-review-todos.
Review5624037446 e comentários6357760296/6358946353/6359287153 lidos no
inventário ROOT inbox-pr-reviews-20261023.json. Esta entrega acrescenta
somente JSDoc, SPEC, quadro e este relatório; não altera execução.

## Mapa completo da revisão

| Comentário | Disposição e limite |
| --- | --- |
| C1 HIGH | Os registros históricos de ancestralidade estão em pr400-qa/ancestralidade.md. Main/retarget/CI final e adoção do novo SHA continuam com o integrador; nada disso foi executado aqui. |
| C2 MEDIUM | Integração histórica nominal à fonte260a4599: preferencias.int.test.ts + motor/presenca.int.test.ts, completos,20testes, sessão44027 EXIT0, perfil ci-integracao. Report pr400-qa/leitura-integracao.md. Nenhuma nova integração executada ou atribuída ao head desta revisão. |
| C3 LOW | Export manual mantido como alias legado de compatibilidade da API299; JSDoc @deprecated explicita a ausência de caller produtivo nesta árvore e aponta o automático usado pelo Inbox. Sem remover/refatorar o caminho operacional ou inventar consumidor futuro. |
| C4 LOW | Volume inventariado e preservado, com curadoria/ZIPs históricos referenciados abaixo. Nenhuma evidência apagada, movida ou regravada. |
| C5 LOW | SPEC alinha o único h1 Conversas e a concordância1conectado/0ou2conectados ao comportamento já testado. Rota, escopo, contagens e interfaces iguais ao plano. |
| C6 LOW | Conflitos documentais do quadro são trabalho do integrador. Não confundir este C6 com a correção SSE396 já incorporada historicamente; nenhum conflito de integração foi declarado resolvido aqui. |

## C3 — compatibilidade e equivalência executável

rg em src, excluindo *.test.ts/*.int.test.ts, encontra marcarAtendimentoLido
somente em sua declaração em preferencias.ts. Os usos restantes estão nos
testes legados leitura-automatica.test.ts e preferencias.int.test.ts.
InboxNovo importa/chama marcarAtendimentoLidoAutomatico; a escolha da política
é um literal interno do servidor e não uma flag enviada pelo cliente.

Assinatura, imports, corpo e helper privado não mudam. O caminho legado
continua registrando leitura pessoal/compartilhada/motor e preserva sua
política de invalidação; o automático conserva GET/selo/finally e zero
revalidatePath. Testes existentes cobrem sucesso, escopo negado, falha parcial
e motor. Não se cria comportamento novo, portanto não há RED artificial.

Prova4e8a25: TypeScript.transpileModule, ES2022/ESNext/removeComments=true,
sobre o arquivo inteiro antes/depois do JSDoc, produziu JS idêntico:
4.573bytes, SHA256 1c84aacf6c3b95b466a9257a6fdb023c8a010be96442dec7d804e1befcc95e9d.
Nenhum JS emitido foi gravado na árvore.

## C4 — inventário, curadoria e origem das provas

O diff original5f6a2992→260a4599 possui16arquivos output,302.451bytes e
6.776linhas, confirmando o volume do review. Cinco JSON somam6.247linhas.
Na base corrente b29e7c20→3b852c54 são18arquivos/306.916bytes/6.850linhas,
incluindo os dois relatórios posteriores da PR400. Contra a base original,
os pais acrescentaram outros pareceres:26arquivos/330.292bytes/7.225linhas.
Esses recortes não contam logs/PNGs privados nem o novo relatório.

As allowlists separam fotos atuais, referências de protótipo e complementos,
e o resumo causal conserva o diagnóstico sem rawRSC/logs. Os pareceres318/394
são evidências históricas de dependências/revisões independentes: sua autoria
e fonte permanecem intactas. Remover ou compactar esses arquivos agora
quebraria a rastreabilidade congelada; não foi feita limpeza arbitrária.

Pacote histórico313: inbox-313-evidencias-4f.zip,103PNG (90DEV+13TESTER),
SHA256 a5ddcdd7179558a5696fc7e0867dd839c84a63ae0f094ed527729ec99814aa20.
Fonte4f/refs2e e curadoria constam do manifesto/sidecar ROOT consultados.
Complemento [394/313](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-394-evidencias-3a.zip):
22PNG/29arquivos/1.714.633bytes, SHA256
bd80252b79b544b75f0f47257a7476dd67e0f91718a64876f35ef90bcdd9811a,
conforme inbox-313-global-final.md. Só positivos/metadados sanitizados;
negativos/probes/HTML/RSC/logs/seeds/snapshots não compõem esses pacotes.
Não houve novo upload/download/inspeção de imagens ou atribuição de autoria
nesta revisão; as fontes e limites históricos não são transferidos ao head.

## Verificação atual

Schema400 e schema402 têm o mesmo blob7a00fb88efdde3c69566aba8896180403daaefba.
Cliente físico402 já gerado pelo ROOT é compatível; nenhuma nova geração.
Banco B490 não foi usado ou alterado, sem SQL/integração/preview/browser.
Checkpoints402 f94d3b76 e337 c203da6 permanecem nas branches próprias.

Node22.23.2/localbins, maxWorkers2, sem filtro de nome ou testes ignorados:
UTCef39c4 EXIT0 e SaoPauloa361ad EXIT0, oito arquivos/139testes em cada fuso.
Recorte: leitura-automatica, SeletorNumero, ColunaConversas (SSR/interação),
InboxNovo (SSR/interação/foco) e page. TypeScript --noEmit heap8192,
sessão56267 EXIT0; ESLint preferencias.ts --max-warnings=0,2fcadb EXIT0/0avisos.
São gates dirigidos atuais; os20INT de260a e globais históricos permanecem
nominais, sem alegar nova execução completa ou homologação.

diff --check limpo. Sem alteração de testes, deps/lock, schema, harness,
PNG, DB, produção executável, push ou comentário GitHub. Revisão independente
do SHA e C1/CI/C6 finais seguem com o integrador antes de integrar.
