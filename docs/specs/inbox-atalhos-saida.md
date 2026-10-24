# Inbox #335 — atalhos de saída

## Resumo da publicação e revisão independente

O TESTER executou integração independente na preparação `a4f6`: três arquivos completos e 32 testes, sessão `56263/6a6c55`, saída 0, 121,66 s. Na fonte final E0 houve outra execução própria, de 19 arquivos/139 testes (`f1dbe4`, saída 0), e a prova `aba719` confirmou os nove paths do produto iguais a `4c76`. Os 32 testes de integração não foram reexecutados em E0. Fontes, pareceres e hashes históricos permanecem no [índice QA](../../output/inbox-335-qa/indice.json), sem reatribuição por esta revisão de prosa.

A base original era `8e503a72`, branch `codex/inbox-e2-335`, agregado somente local. O integrador reconstruiu a publicação após a #324. O plano privado `output/inbox-335-investigacao-dev-a.md` foi aprovado com ordem técnica 335→336→325. Os checkpoints abaixo preservam os resultados e as pendências de cada fonte; a composição final está no relatório `output/inbox-335-composicao-final.md`.

## Contrato

`hrefConversa(id, { agendar? })` é um encoder puro de URL relativa: caminho `/inbox?c=`, ID bruto codificado por `encodeURIComponent` e `&agendar=1` somente quando a opção é true. Não autoriza o alvo nem executa agendamento. A #336 resolve o atendimento autorizado e os links B2B antes do aceite completo da #325; essa frente já está implementada e em validação, com publicação separada.

`matriculaId: string | null` nos DTOs FINANCEIRO e SECRETARIA segue exatamente o gate de `matriculaCodigo`: Admin, Financeiro e Secretaria no setor financeiro; Admin e Secretaria no setor Secretaria. O convite sozinho não libera os dados setoriais. A seleção da matrícula já traz ID e código; não há query ou ACL nova. Código com ID vira link `/matriculas/id`; sem ID permanece texto; sem código não se cria link sem nome. A página de destino revalida papéis e carteira.

“Abrir contato” no Funil aponta para `/contatos?c=id`, com ID codificado e a identidade da Pessoa da oportunidade preservada. Não cria rota `/contatos/[id]` nem amplia `contatos.ver` ou `escopoPessoa`. A leitura comercial D13 não se transforma em acesso ao CRM global.

## Checkpoint de código e rastreabilidade

A verificação inicial usou TDD unitário/SSR e integração real dos painéis em `dev-email`, cliente 487, uma suíte por vez, Node 22.23.2/config integration/maxWorkers 1. Gates só contam após saída terminal observada. Naquele checkpoint, o visual APP-only `painel-secretaria` ainda dependia de fixture legítima, Ready do ROOT e handoff da CLI B337. Não houve migration, schema, dependência, Prisma ou push; foram preservados #324/#323 e Compositor/Sino 337.

O RED unitário `0d2a8e` teve três falhas de links/rota; a ausência do módulo do encoder foi registrada separadamente. O RED INT `73676/bb5d73` teve 12 passes e uma falha em 13 casos: `matriculaId` ausente com matrícula real. GREEN: 65 arquivos/653 testes unitários, sessão `45159`; três arquivos/32 integrações, sessão `1473`; TSC `16563`, heap 8192; lint de nove fontes `818ebc`, maxWarnings 0. Todos terminaram com código 0, Node 22.23.2, sem filtro de nome ou novos skips. São recortes, não global, QA independente ou aceite visual. Fontes, comandos e limites estão no relatório `output/inbox-335-report.md`.

O encoder tem cinco casos, incluindo espaços, Unicode e caracteres que não podem injetar origem ou parâmetro. Os três casos novos de PainelSetor preservam código legível e ausência legítima de link; o Funil mantém Pessoa e rota real. A integração usa seis atores e dados não vazios para provar gates e convidados sem dados setoriais, além dos arquivos completos de envio e Detalhes. O campo aditivo da API usa a seleção existente, sem nova consulta ou ACL.

O banco A foi liberado após a sessão `1473`, código 0. O restauro ainda não era presumido naquele checkpoint; visual, fixture, CLI/handoff B337, QA independente, global integrado, PR e CI estavam pendentes. Nenhuma imagem histórica foi atribuída à alteração.

## Visual e harness — freeze documental DEV de 23/10/2026

APP `4c76` e harness `6e498` têm fontes distintas. O harness acrescenta seis combinações APP Secretaria às 176 anteriores, total de 182, com preflight GET autorizado e conclusão finita das mensagens antes da foto. RED/GREEN e TSC/lint dirigidos estão no relatório; não houve mudança de produção/ACL ou novo global.

A prova real reuniu 24 PNGs formais APP e 40 complementares: 64 positivos, 4.273.828 bytes, com originais e hashes em allowlists curadas. Admin e Secretaria chegaram à matrícula real com código público. Admin saiu do Funil para a mesma Pessoa em `/contatos?c=`. Professor convidado recebeu campos setoriais nulos e envio false; no navegador, o cadastro redirecionou para acesso negado. Não se infere autorização de uma URL nem de HTTP 200 do stream. O protótipo funcional é N/A, explicitado em tabela de 12 linhas; nenhuma referência foi fabricada.

Na altura de 500 px, foram oito contextos e 12 medidas de borda, com Tab, Escape, foco, mesmo DOM e scroll local. O link móvel ficou inteiro entre y482,5 e 499,5, sem margem ampla; a posição inicial e a posição após rolagem são provas distintas. O último controle foi apenas focado, sem mutação. Houve duas construções SSE sequenciais, com máximo de uma simultânea nas origens. R1 formal, R1 de alcance e uma foto Next foram preservadas e excluídas da positiva, com substitutos e fontes próprios.

ROOT preparou 11 linhas suplementares e restaurou A487 em `c538fc`, saída 0, após o stop `79643`: 424 hashes e as nove mensagens/quatro notas originais preservados. O bloco Next de AGENTS foi conferido e removido sozinho. Parecer e allowlists em `output/inbox-335-visual-parecer.md` documentam a prova e seus limites. No freeze visual, QA independente, global integrado, publicação e CI ainda estavam pendentes; não se presumiu homologação.

## Composição de publicação sobre main

Fonte E0 `e0b35f2c54d90ad79cfc70ef69d20b688290de29`, base `6fe0e49a` após a #413. A árvore integral é igual à preparação `bf344`; global 916/7.205, TSC e lint com 40 avisos herdados terminaram com código 0. O TESTER fez 19/139 testes próprios em E0 e três arquivos completos/32 integrações na preparação `a4f6`, com fontes separadas. Os nove paths do produto 335 continuam iguais a `4c76`, e os nove do harness a `6e498`; o rebase não motivou nova execução dos 32 testes de integração.

Evidências, hashes e limites estão no índice `output/inbox-335-qa/indice.json` e no relatório `output/inbox-335-composicao-final.md`. As 64 imagens originais não foram recapturadas; o limite móvel de 0,5 px permanece. O CI rápido não inclui integração; a política noturna/dispatch continua igual. CI do próximo head documental, releitura dos comentários e merge seguem com o integrador.
