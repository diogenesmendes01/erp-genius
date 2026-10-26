# QA estática PR430 / composição350 e054

Parecer favorável à fidelidade da composição e0546ae59da59c5d805b0a4900654ba44294256c. Pais exatos897e100317713e1e14597f429a433fc674df56cc e abb961625f57bf20d9eb4734df98e59dda362957. Nenhum bloqueador novo identificado na integração estática; não é homologação visual nem aprovação de CI futura.

## Prova independente por objetos Git

O comparador próprio executado em2cbd8e terminou EXIT0, usando trees e blobs do commit, sem depender da workingtree ROOT. Contra Mainabb9616 há28paths:18SRC350 e10documentos. Os17objetos exclusivos listados na composição pública têm modo/OID idênticos à publicação897e1003. O único consumidor composto é src/app/(app)/inbox/InboxNovo.tsx: removendo exatamente uma linha aria={painelDoAberto?.dado?.aria}, o arquivo inteiro recompõe Main. Não substitui filtros/lista344 ou aviso do barramento345.

Foram conferidos3.590objetos Main fora dessas18fontes no escopo src/scripts/prisma/.github/package.json/package-lock.json, todos com modo/OID preservados. Isso inclui backend, produtores, schema, migrações, contratos349, ACL e dependências. Não há novo delta nesses escopos fora das fontes selecionadas.

O quadro recompõe exatamente Main1.162.778bytes +umLF separador +sufixo3503.393bytes =união1.166.172bytes; adendoROOT620bytes resulta em1.166.792bytes, SHA2565a21802aa0653947981176b8eba1daccb95faa151958125013bab7f3e26168ab. Prefixo, sufixo, união, adendo e resultado coincidem individualmente com os hashes da composição pública. Não houve corte de registros.

## Documentos e atribuições

Cinco objetos históricos QA são literais à publicação897: composicao-main344.json, foco-4b.md, geral-85e.md, indice.json e resultados-85e.json. SPEC e relatório350 também são literais. A nova composicao-main345.json e o adendo README qualificam a integração com Mainabb9616.

Hashes/bytes do índice foram recalculados dos blobs GitLF: geral-85e.md10.781/SHA7a30df71b40f37366dfd0d2452e238e3d089b805cc57bd557a35f01f8c9fb32d; resultados-85e.json4.310/SHA7aa2c50c0ff89e4413aed19802d1c7d09bd6fcb04abdef963723d5afbc5de46a; foco-4b.md8.588/SHAc8ecd91b823ea7e7440b6443e5420b82e9133833c7c7cd8a9115ded56822d88a. Quatro links Markdown relativos de README/SPEC/report conferidos no tree; diff --check Main..HEAD terminou0.

A indicação c045 no índice/primeiro parágrafo README é nominal à publicação anterior, preservada integralmente; o adendo e a composição nova identificam a Mainabb9616. Os26arquivos/555testes e lint18 são prova TESTER anterior85e/4b, não executados novamente aqui. ROOT10arquivos/205testes88594/090488 e lintInboxNovo62548/28a363 são gates ROOT do conteúdo combinado, não gates meus. O TSC DEV auxiliar e seu original negativo continuam qualificados. CI remota nova e18pares/36RAW visuais permanecem pendentes; o smoke negativo não foi convertido em aceite. Nenhum texto examinado autoriza anexos, captura formal ou conclusão da issue.

## Limites

Leituras próprias d2118e, a50f6f/sessão44169→947860, 129e84 e prova2cbd8e terminaram0. Somente revisão estática; nenhum checkout, teste205, UNIT, TSC, INT, DB, navegador, HTTP ou modificação de fonte/perfil/cliente. Arquivos privados gravados apenas no output do TESTER.

Prova complementar: output/inbox-350-e054-estatica-proof-tester.json. O status remoto posterior deve ser conferido pelo integrador; nenhum resultado CI foi presumido.
