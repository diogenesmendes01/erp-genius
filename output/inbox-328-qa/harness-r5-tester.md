# QA R5 do harness #328

Parecer favorável ao commit exato 8afcd29063838e5da4d180c5f4d835d72b66d380, filho de 75ed2f8f1e94b2bad94cc556d714a502f0a52286. Runtime APP permanece nominal f9485756a67a450a58e61607f01b99f1b1e83f6a. Own checkout exato e tracked limpo confirmados. Cliente/perfil não foram alterados; sem DB, HTTP, navegador, Next ou captura.

Seis paths: módulo, teste, SPEC, quadro, relatório e manifesto. A única linha executável nova chama scrollIntoViewIfNeeded na tab Oportunidades após o cartão e, para admin, após o botão inferior, antes do wait/cartao. Remover essa linha recompõe integralmente o módulo75ed. AST confirma13 funções/12literais; muda somente abrirAcoesApp328. Predicado de aceite, caminhos PROTO/Funil/Perda, campos, foco, SVG e coletores permanecem literais. Os167 testes anteriores são prefixo literal do arquivo atual. Os cinco OIDs e hashes GitLF declarados conferem; bytes físicos/quadro têm namespace próprio.

UNIT próprio completo: sessão4423/ca4428→c6e332 EXIT0,1arquivo170/170 em11,98s, Node22 heap512/maxWorkers1, sem filtros/skips. Lint do adapter e teste: sessão38623/e6761c→077033 EXIT0, sem saída. O aviso informativo preexistente vite-tsconfig-paths foi preservado. Nenhum TSC/global/INT foi repetido.

Os testes novos usam driver real com doubles de Page/Locator e verificam ordem dos scrolls admin/leitor, antes do waitcartao, com os mesmos dois cliques. O callback real continua recusando tab-9..29, aceita0..38 e recusa inert. Isso não simula o layout/rolagem Chromium nem prova que o movimento nativo revelará a aba sem esconder controles inferiores; o predicado literal permanece exigindo todos eles.

A documentação qualifica a recusa comprovada no snapshot DIAG1, sem causa exclusiva presumida durante30s ou no lote NativeV6r3. Não há inferência de bug de produto. Deslocamento9px é cálculo, não medição nativa da correção. R4 mantém somente header/subtítulo/lápis acessíveis fora da viewport na fase cartão; tabs/card/dd/ações/foco seguem rígidos. NativeV6r3 e DIAG1 continuam negativos; PNG diagnóstica não vira aceite. Porte/namespace, fresh/READY/GO e validação nativa/visual futura continuam pendentes. Este parecer não autoriza operação nem conclui #328.

Negativo administrativo separado: o verificador de fonte27988/50d93b terminou1 ao tentar ler um log de lint vazio, não criado pelo Tee-Object. Todas as assertivas de identidade anteriores passaram; o executor lint já havia terminado0 em077033. Nenhum teste foi repetido por isso e não se fabricou log de execução.

Prova output/inbox-328-r5-170-proof-tester.json, SHA256 5615dfe15808b5e0ed91e0f292c362dced88fa4381b8230468dd9aad8a58c3c1. Log UNIT output/inbox-328-r5-170-unit-tester.log, SHA256 2622502ae1b7355a486c44d34d55c17b3b438e0f5d50fef4d5617b2e710f7e64.
