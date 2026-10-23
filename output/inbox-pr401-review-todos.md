# PR #401 — comentários remanescentes (DEV B)

Base exata: 0fcaf4595649fcee53027757da3f462e3205170d.
Branch local: codex/inbox-pr401-review-todos.
Review 5624209969 e comentário 6360088582 lidos no inventário ROOT
inbox-pr-reviews-20261023.json. Patch exclusivamente Markdown: SPEC, quadro
e este relatório; nenhum runtime, teste, dependência ou evidência alterado.

## Mapa C1–C5

| Comentário | Disposição e limite |
| --- | --- |
| C1 HIGH | O histórico de composição dos pais permanece em pr401-qa/revisao.md. Retarget, integração com main, CI do head final e QA #280 continuam sob o integrador; nenhuma dessas operações foi executada aqui. |
| C2 LOW | SPEC explicita o contrato diferido: na #315/PR401, Buscar fica desabilitado com “Em breve”; aoBuscar/buscaAberta preparam a integração, sem alternância acionável. Ativação é da dependência #316/PR402, com fonte/evidências próprias. |
| C3 LOW | SPEC justifica Voltar até 960 px pela casca #308: entre 700 e 959 px ainda há uma região por vez. O corte de 700 px pertence à apresentação de controles; painel automático continua em 1400 px. |
| C4 LOW | Sucesso de marcarNaoLida reconta uma vez o selo na aba atual; falha não reconta como sucesso. A action não emite SSE próprio. Demais abas dependem de evento/resync ou dos gatilhos existentes da loja, sem garantia de atualização imediata. Nenhum canal ou polling novo. |
| C5 LOW | Volume avaliado e origem/curadoria preservadas abaixo. Nenhum arquivo de outro autor foi removido ou regravado, nem captura histórica apresentada como nova. |

A SPEC já continha a busca diferida e os cortes reais; os trechos existentes
foram esclarecidos sem duplicar o histórico. O mapa aponta os testes:
CabecalhoConversa (disabled/Em breve e Voltar960/Painel1400), MenuConversa
(busca desabilitada) e useAcoesAtendimento (sucesso/ocupado/falha da preferência).
A referência local ao ciclo da loja de não lidas foi conferida.
Esta revisão não porta a ativação #316 nem o JSDoc legado da revisão #400.

## C5 — inventário e curadoria histórica

git diff 4ddd0fb5..d32e7411 -- output: 23 arquivos, 351.884 bytes,
11.603 linhas. normal-r4/medidas.json sozinho contém 7.014 linhas/171.854
bytes; o volume observado no review é confirmado.
Na base atual dca8c5d5..0fcaf459: 24 arquivos/353.511 bytes/11.631 linhas,
incluindo o relatório posterior da PR401. Contagens obtidas dos blobs Git,
sem incluir outputs privados ou o presente relatório.

Os JSON mantêm medidas, fontes e allowlists de fases distintas. A curadoria
positiva e os limites estão em inbox-315-report.md e nas allowlists; relatórios
396 e pareceres independentes mantêm sua autoria e contexto. Compactar ou
apagar esses registros nesta correção mudaria o inventário congelado e suas
referências; o patch conserva os arquivos e não duplica sondas/manifestos.

Pacote histórico inbox-315-evidencias-5dc.zip: 142 PNG (98 DEV, incluindo
30 pranchas, e 44 TESTER), SHA256
935969f156317937c156959b5eb8d4bf78d2d9045b173f49f77d57acd7a72de3.
Manifesto/sidecar ROOT consultados identificam produto DEV
8b3c46ac475b8e881691b49a0d8139707771236d, visual DEV
efeb0e1f259bb295e4cfb39789c30807820ce337 e QA
5dc9ec5aea6ad1ae34071bd268e075a5c07c56f9. Só positivos selecionados e
metadados/relatórios; sem HTML/RSC/logs/probes/seeds/snapshots/negativos.
Não houve novo upload/download ou inspeção de imagem nesta revisão;
esse pacote não representa captura da base 0fcaf459 ou do novo commit.

## Identidade executável e verificação atual

Schema401 é idêntico a 400/402, blob
7a00fb88efdde3c69566aba8896180403daaefba; o cliente físico já gerado pelo ROOT
é compatível. Nenhum generate, SQL, integração, preview ou browser; banco
B490 permanece intacto. Checkpoints 337/c203, 402/f94 e 400/616 preservados.

Objetos da base preservados integralmente pelo patch MD:

| Caminho | Git OID |
| --- | --- |
| src |6255d69637fb3ccc77b01ab38efca67569040659|
| scripts |dc4be5055ced4ad60da13f37a401c2840ef22ae6|
| prisma |f18085fcbb02882aef3aac4feb83566bf7da5f85|
| package.json |fd6ffbe2e0e936015035754f8d8d39a980bcf8bb|
| package-lock.json |69fb0eb61afb07e6087b78a5508ad8a9a4d54c94|

Os 169 PNG já rastreados na árvore completa permanecem iguais.
SHA256 da lista git ls-tree -r (OID/caminho dos PNG, ordem Git, LF final):
7c36b42336cf711e1054a9170c52c7eb8234b132402914b48bfef341904eaf3e.
Não há PNG novo ou remoção; nenhuma imagem privada foi staged.

Node22.23.2/localbins, maxWorkers2: UTC e5e7da EXIT0, sete arquivos/53 testes;
America/Sao_Paulo d86623 EXIT0, os mesmos sete/53. Sem filtros de nome ou
ignorados. Recorte: CabecalhoConversa, MenuConversa, useAcoesAtendimento,
AcoesAtendimento, Menu, Botao e visual-inbox-cabecalho. Este último verifica
o contrato do harness, sem capturas ou edição do CLI.
TypeScript/lint não foram repetidos: não há alteração de TS/teste/script,
schema ou configuração. Não são apresentados como novos gates aprovados.
Globais/TSC/lint históricos continuam nominais às fontes de revisao.md.

diff --check limpo e somente três MD no patch. Sem push/comentário GitHub,
deps/lock, DB, captura, nova funcionalidade ou homologação presumida.
Revisão independente do novo SHA e C1/CI/integração final seguem com o ROOT.
