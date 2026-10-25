# Revisão R1 — janela temporal e rastreabilidade

C3 foi reproduzido antes da correção: sessão35945/32a8fc EXIT1, dois arquivos completos, quatro falhas causais e39controles aprovados. O consumidor mostrava a sugestão futura numa janela antiga; o helper ignorava o limite superior e o comparador recebia NaN.

A correção acrescenta fimJanela opcional, fornecido pelo consumidor somente quando temMaisDepois=true. O limite é inclusivo e compara instantes, inclusive offsets. Datas inválidas são ordenadas estavelmente junto aos itens sem instante; sugestões sem instante válido ficam fora de uma janela superior limitada. A janela atual continua mostrando suas sugestões posteriores à última mensagem. Nenhum cursor, transporte, ação ou estilo mudou.

GREEN b83068 EXIT0: dois arquivos completos/43 testes, um worker, sem filtros ou skips. Regressão dos consumidores11e8a9 EXIT0: quatro arquivos completos/43 testes (itens-thread, busca, rodapé e menções). Lint4 em828b4b EXIT0. Esses são dois recortes separados; não equivalem à suíte global. Os avisos SSR useLayoutEffect preexistentes e o aviso vite-tsconfig-paths permanecem. CI e QA posteriores continuam gates próprios.

C4: o caso do plano aprovar_sugestao_expirada_mostra_erro corresponde ao teste existente “expirada mostra erro focado e não sinaliza sucesso”, em src/app/(app)/inbox/aria/CartaoSugestaoAria.interacao.test.ts. O teste exige mensagem de expiração focada, ausência de callback de sucesso e possibilidade de nova interação; não foi renomeado nem removido.

C1:36imagens inspecionadas e ZIP sanitizado pronto; autorização para anexar à PR430 continua pendente. B1/C2: a integração deve respeitar420→427→430 e conservar ambos os blocos de InboxNovo.interacao.test.ts e os históricos do quadro. Esses conflitos não são declarados resolvidos antes da composição real.

O corpus visual permanece nominal à fonte85e/runtime4b. Não houve recaptura após C3: a alteração não modifica cartão/CSS, e as cenas fictícias são da janela atual com instantes válidos, nas quais fimJanela=null mantém o comportamento anterior. Isso não transforma as capturas em execução do novo commit nem prova os novos casos por imagem. Os novos casos são cobertos pelos testes do helper e do consumidor real.
