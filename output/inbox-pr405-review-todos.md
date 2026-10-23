# PR #405 — todos os comentários da R1

Fonte publicada 4af3286df9c5870b317f47553ec8bb3b96189831; review5626077684. Este patch é somente documental, não altera src/scripts/prisma/package/lock/config nem imagens. Não reatribuir CI/gates antigos a uma nova composição.

## C1 MEDIUM — main e CI final

A resposta6361517596 documenta a reconciliação anterior com maincce21e19 e os conflitos exclusivos no quadro. Isso é histórico: a main avançou novamente, inclusive QA280 e planejamento297. A integração definitiva exige preservar esses deltas e as correções dos predecessores, retarget405para main, QA/CI final e merge com head esperado. Permanece gate, sem presumir resolvido só por esta documentação.

## C2 LOW — evidências em output avaliadas

O delta original foi quantificado:21arquivos/4863linhas, dos quais8JSON/4355linhas e13MD/508linhas. A review mencionava20arquivos/4848linhas; o adicional é output/pr405-qa/revisao.md com15linhas sobre a conciliação posterior. Não houve imagem nova no Git.

Avaliados e mantidos os registros com suas fontes históricas. Os JSON contêm allowlists, medidas, inspeções e comparação das capturas normais/longas/triagem; os MD separam as fontes DEV, integração e TESTER e seus limites. O ZIP público histórico não duplica esses arquivos JSON individualmente: são149entradas,140PNG+8MD+manifesto. Apagar os registros por tamanho retiraria parte da trilha verificável que fundamenta o aceite, além de quebrar referências dos relatórios. Esta escolha é explícita, em vez de ignorar o LOW. Não transformar checkpoints preliminares em evidência final.

Pacote já documentado: inbox-319-evidencias-b8.zip,12106367bytes, SHA2560972487e1b482aaf5058dff7482585b2404bd09751be7de9c90503f1a37b68c5, fonte visual b8edd5d39298dac617f65060098f6a5d66786159. Metadados vêm do relatório e auditoria já versionados; não houve novo download, browser, captura, upload ou alegação de autoria/validação nova. Relatórios output/inbox-319-global-final.md e output/inbox-319-pacote-review-tester.md preservados.

## Verificação deste patch

Identidade dos objetos de produção/configuração e imagens contra4af, inventário de21arquivos e git diff --check conferidos na preparação. Sem alteração executável, não foram repetidos TSC/lint/global nem escritos testes que apenas espelham documentação. A QA independente deste delta e a integração no head final permanecem com os respectivos executores. Não houve DB, migration, seed, E2E, dependência, envio externo ou deploy.
