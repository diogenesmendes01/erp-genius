# PR403 — comentários remanescentes R1

Base exata: 68e95d8e9cea0842ccdab441be475c302fe9c7e3. Branch local codex/inbox-pr403-review-todos; review5624992604. Revisão exclusivamente documental: nenhum delta runtime/teste/harness/dependência/Prisma. Investigação324 e branches398/399 preservadas. Sem DB/browser/preview/envio/push/comentário GitHub.

| Comentário | Decisão e evidência | Situação |
| --- | --- | --- |
| C1 HIGH main/CI | Composição/retarget/CI dependem do integrador e pais. Nenhum check remoto novo nesta execução. | Pendente externo; não alegado resolvido |
| C2 MEDIUM Nota ENCERRADO | Regra20 e implementação f896/741 preservadas: Nota por leitura individual em menu/rodapé, grupo sem Nota; demais gates fechados. AcoesAtendimento/useAcoes/ConversaAberta.rodape incluídos no recorte atual. | Correção anterior preservada; nova regressão dirigida0 |
| C3 MEDIUM rascunho confirmado | Token de intenção, comparação bruta e notificação do owner compatível intactos. 17 casos ReactDOM/StrictMode existentes preservados, incluindo A→B→A sem edição limpa campo+storage e intenção posterior/cleanup não limpa. | Correção f896/741 preservada; nova regressão dirigida0; sem nova prova ERP |
| C4 LOW anexos/voz | File e gravação temporários de Responder descartados/interrompidos ao trocar modo; texto tem rascunhos separados. Cleanup/onstop/getUserMedia/upload tardio inspecionados. Upload HTTP já iniciado pode terminar, URL antiga não é despachada; envio já despachado não é cancelado. | Intencional documentado, sem promessa de preservação nem novo diálogo |
| C5 LOW nomes/provas | SPEC contém mapa explícito da Task12 aos nomes reais, incluindo a distinção entre assertivas de marcação, CSS inspecionado, capturas históricas e 17 testes reais de ciclo StrictMode. | Mapeado; nomes/testes preservados |
| C6 LOW conflitos docs | inbox-nao-lidas-menu.md e históricos do quadro pertencem à integração dos pais. Append local preserva históricos, não resolve conflitos hipotéticos de main. | Pendente integrador |
| C7 LOW volume output | Inventário contra base própria a8:22arquivos/1.826linhas =14MD501 +8JSON1325, zeroPNG/probescripts. Links e hashes históricos abaixo. | Justificado/curado, sem apagar auditoria |

## Verificação desta rodada

Node22.23.2, executáveis locais. Nenhuma instalação/DB ou teste integration. Recorte nominal explícito (sem -t/skips adicionais): Compositor.test.ts; Compositor.rascunho.interacao.test.ts; RodapeConversa.test.ts; RodapeConversa.interacao.test.ts; ConversaAberta.rodape.test.ts; useAcoesAtendimento.test.ts; AcoesAtendimento.test.ts; lib/chave-idempotencia.test.ts.

- Vitest chunk8b5363:8arquivos/102testes, saída terminal0, maxWorkers2,2,52s. É recorte, não global. Os17casos C3 reais são parte desse total; os demais incluem SSR/harness controlado.
- TSC --noEmit heap8192: sessão4700, início0f3b1f, terminal7ca537 saída0. Sem typegen/ajuste de cache necessário.
- Lint10fontes/testes inspecionados --max-warnings=0:227ef7 saída0. Primeira tentativa a6fa9e saiu1 porque comando apontou useAcoesAtendimento.ts inexistente; função real está em AcoesAtendimento.tsx:74. Apenas o comando foi corrigido, nenhum arquivo de código.
- Identidade antes da redação393da0: git diff --quiet base68e -- src scripts prisma package.json package-lock.json, saída0. A repetição final será registrada no fechamento abaixo.

Sem RED/GREEN novo: não houve bug novo constatado nem patch produtivo/teste; C4 é esclarecimento intencional autorizado. Inspeção de cleanup MediaRecorder não equivale a novo teste específico da troca nem a exercício de microfone/browser. Não estendemos a cobertura existente por narrativa.

## Artefatos próprios e auditoria

Inventário Git numstat contra a8dba58c443ff24be4745e51aab47abed9c4cf2a→68e (comando4aef23):22arquivos output/1.826linhas,14MD501/8JSON1325. Essa é a base própria identificada em output/pr403-qa/revisao.md; fontes de pais e toda a pasta output não foram tratadas como delta403. A R1 aproximava1,2mil linhas no head32f, anterior à correção C3 e pareceres finais.

- output/inbox-317-report.md/global-final.md e pareceres TESTER: contexto temporal e gates nominais.
- output/inbox-317-probes/allowlist-positiva-final.json, evidencias-final.json e inspecao-final.json: fontes/grupos/hashes das capturas históricas, negativos excluídos.
- review403-menu-allowlist.json/inspecao.json e review403-menu-r2/manifesto.json: complemento C2 encerrado, não envioERP/C3.
- output/pr403-qa: índice final revisao.md e pareceres f896/741/menu, com histórico-menu-a7.json explicitamente histórico.

[ZIP original317 85f](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-317-evidencias-85f.zip):122PNG/137arquivos/15.823.526B; SHA25674a17180135461a99a50e6e48e45b42280ef4b804321607ce3480645ca27f4aa. Fontes317bbb/df9 e demais grupos conforme índice original.

[ZIP menuC2](https://github.com/diogenesmendes01/erp-genius/releases/download/untagged-fa5a4dab1bbf8d54cb05/inbox-pr403-menu-a7.zip):16PNG/21arquivos/1.677.732B; SHA2564faa6c22ef72e4614d293c869d0986aca56047ee57a5ed5eeb4800490ebaa60c. Fontes29f/A7 com GET real/sem submit. Hashes/download/rascunho foram conferidos pelo integrador original; não repetidos nesta rodada. Nenhuma dessas fotos é reatribuída à reconciliação C3f896/741.

Esta entrega acrescenta somente este MD e duas entradas de SPEC/quadro; nenhum PNG/script bruto/HTML/log/credencial é adicionado. Volume adicional serve ao mapa C1–C7 e não replica manifestos ou imagens.

## Identidade publicada a preservar

Objetos Git base68e (também exigidos no fechamento documental):
- src e6e5df16760a1276db03718507b8aff1ed2458d2
- scripts cce360e86a0800dc605d55cc96f62184066f142f
- prisma f18085fcbb02882aef3aac4feb83566bf7da5f85
- package.json fd6ffbe2e0e936015035754f8d8d39a980bcf8bb
- package-lock.json 69fb0eb61afb07e6087b78a5508ad8a9a4d54c94

Pendências: QA exata da entrega documental, integração/CI/main/retarget/C6 com integrador. Gates antigos de741 (global899/7046 etc.) continuam históricos; este DEV não rodou global novo nem homologação de ambiente.

Fechamento documental: bec2f6 git diff --check saída0; diff --quiet base68e para src/scripts/prisma/package/lock saída0. Allowlist do commit: docs/specs/inbox-rodape-compositor.md, docs/planejamento/quadro-entregas.md e este relatório.
