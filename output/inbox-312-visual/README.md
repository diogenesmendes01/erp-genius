# Evidências da issue #312

[ZIP sanitizado de revisão](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-312-evidencias-4b6f.zip), asset667543637, 8.739.714 bytes.

SHA256: `2abcf2d47b56e5aec4bfe1e71594ac3c94941056e9734b94380d30eda3ca0cc3`.

Upload, download e hash conferidos na release **draft** autorizada. O pacote contém 87 arquivos: 67 PNGs positivos (49 DEV e 18 TESTER), 13 pranchas JPG, documentos e manifesto. Sem HTML bruto, negativos ou referências antigas. As 14 referências do protótipo foram anonimizadas explicitamente no DOM antes da foto; HTML original preservado.

Aplicação DEV a3da8a15, harness de referências5e915b42 e QA independente EXATA4b6f1554. Formal:14app+14referências, três estados/tamanhos/dois temas aplicáveis. Provas DEV incluem SSR29→30 sem remount da linha e150conversas, paginação50→100→150, alturas variáveis, Tab/ShiftTab e resize300/372/390. QA independente confirmou seis contextos com150itens, seleção35, foco e âncora de rolagem preservados;18PNGs positivos e nenhum erro de página/rede. Allowlist49PNG+13JPG conferida por hash/tamanho.

Consolidação root sobre3da7bf6e com extensão estrita da guarda AST para o contador numérico mono11px: sessão24299, Node22.23.2,860arquivos/6.727testes unitários sem filtros/ignorados, TypeScript e lint exit0 (40avisos herdados). O primeiro global teve uma falha na guarda por não reconhecer esses tokens do contador; RED2/78→GREEN80/80 preservou rejeição de texto de ação, onClick e padding grande. ItemConversa, ListaAtendimentos e VirtualList têm os mesmos objetos da fonte4b6f. Não se presume nova QA de navegador neste agregado.

CI após retarget e revisão do novo head permanecem obrigatórios antes de merge. Sem novo PNG em Git, envio real ou deploy.