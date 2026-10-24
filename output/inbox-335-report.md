# #335 — checkpoint de código DEV A

## Resumo atualizado e revisão independente

A integração não se limita à execução do autor. O TESTER executou três arquivos completos/32 testes na preparação `a4f6`, sessão `56263/6a6c55`, saída 0, 121,66 s. Em E0 executou outros 19 arquivos/139 testes (`f1dbe4`, saída 0); a prova `aba719` confirmou os nove paths do produto iguais a `4c76`. Os 32 testes de integração não foram repetidos em E0. Detalhes e fontes permanecem nos seis pareceres históricos do [índice QA](inbox-335-qa/indice.json) e no relatório [de composição final](inbox-335-composicao-final.md).

Este documento mantém os checkpoints originais e suas pendências nominais. A revisão de prosa não altera execuções, hashes, JSONs ou allowlists, nem transforma um checkpoint anterior em prova da fonte atual.

A branch original `codex/inbox-e2-335` partiu de `8e503a72d8e25c5c9244956e975376c3fa351e8a`, checkout `252a59`, perfil `dev-email`, cliente 487. O plano privado `output/inbox-335-investigacao-dev-a.md` foi aprovado com ordem técnica 335→336→325. A história agregada era apenas local; o integrador reconstruiria a publicação sobre main após a #324. Código entregue para revisão não significa issue concluída.

## Entrega e contratos

`hrefConversa(atendimentoId, { agendar? })` é uma função pura: caminho fixo `/inbox?c=`, ID bruto por `encodeURIComponent` e `&agendar=1` somente quando true. Não autoriza o alvo, não executa agendamento e não depende de Next/Prisma. A #336 é responsável por `atendimentoParaAbrir`, escopo por alvo e link B2B; convite A não autoriza B. A #325 mantém “Falar com” no aceite completo, sem URL fabricada.

DadosSetor FINANCEIRO e SECRETARIA ganham `matriculaId: string | null`, da relação já selecionada: `paineis.ts` já pedia ID/código. O gate é exatamente o de `matriculaCodigo`: Admin, Financeiro e Secretaria no Financeiro; Admin e Secretaria na Secretaria. Convidado de outro papel recebe ambos nulos. Sem query, schema, migration ou ACL nova. Cobrança ativa e os outros campos/filtros permanecem.

PainelSetor usa o código real como nome do link `/matriculas/id` codificado. Sem ID, conserva o código em texto; sem código, não cria link sem nome nem exibe o ID. O destino continua validando papel/carteira. “Abrir contato” no Funil corrige `/contatos/id` para `/contatos?c=id`, codificado, mantendo a Pessoa da oportunidade e as regras existentes. A exceção comercial D13 não concede acesso global ao CRM.

Foram preservados #324 (TagPainel.id, cabeçalho, tags e slots), #323 (resolver, D13, empresas distintas e autorizações), leitura/R6/ACK/SSE/URL e Compositor/Rodape/Sino 337. Nesse checkpoint, os scripts visuais não haviam sido editados: ownership B337 até o handoff. Sem instalação, Prisma, DDL, seed manual, alteração de ambiente ou push.

## TDD e gates originais — Node 22.23.2

Executável `C:/Users/Mendes/AppData/Local/hermes/node/node.exe` e `node_modules` locais. A configuração unitária exclui `*.int.test.ts`. Integração com `vitest.integration.config.ts`, perfil `dev-email`, maxWorkers 1 e uma execução por vez. Os comandos finais não usaram `-t` ou novos skips; não são suíte global.

| Marco | Executor/terminal | Resultado observado |
| --- | --- | --- |
| RED unitário | `0d2a8e` | Saída 1; 23 casos, 20 passes/três falhas causais: dois links de matrícula ausentes e rota de Contato antiga. Módulo do encoder ausente/zero casos é contrato ausente, não RED causal de comportamento. |
| RED integração | Sessão `73676`, `98595f→bb5d73` | Saída 1; 13 casos, 12 passes/uma falha: matrícula/código reais presentes e matriculaId ausente. Cenário novo com seis atores, sem falha de fixture. |
| Diagnóstico privado de edição | `0d283e` | SyntaxError de script privado antes de qualquer escrita de fonte; corrigido no próprio script, não é RED de produto. |
| GREEN inicial | `610972` | Saída 0; quatro arquivos/31 testes, 1.10 s: encoder 5, PainelSetor 12, Funil 11 e rota 3. |
| Amplo dirigido final | Sessão `45159`, `ed9b94→9a719c` | Saída 0; 65 arquivos/653 testes, 17.76 s, maxWorkers 2. |
| INT final completo | Sessão `1473`, `8d2751→fa0266` | Saída 0; três arquivos/32 testes, 104.27 s, maxWorkers 1: paineis.int, paineis-envio.int e painel-detalhes.int. |
| TypeScript final | Sessão `16563`, `b5fb6c→57e776` | Saída 0; --noEmit, heap 8192. |
| ESLint dirigido final | `818ebc` | Saída 0; nove fontes/testes alterados, --max-warnings=0. |
| Diff-check | `0db43c` | Saída 0; nenhum sensor ou registro de guarda alterado. |

Recorte amplo nominal: `src/app/(app)/inbox`; `src/app/(app)/funil/PainelOportunidade.test.ts`; `src/lib/href-conversa.test.ts`; `src/server/inbox/{paineis-tags,painel-detalhes,painel-abas}.test.ts`; `src/app/api/inbox/atendimentos/[id]/painel`; `src/app/{botoes,fundo-sobre-pagina,identificacao-registro}.test.ts`. Inclui composição #324, sem-polling e a guarda final E1 do Inbox. Os avisos informativos Vite tsconfigPaths/config integration mixed exports não foram suprimidos nem tratados como necessidade de instalação.

## Cobertura e rastreabilidade

| Contrato | Teste real |
| --- | --- |
| Encoder relativo/opção | `href-conversa.test.ts`: monta URL relativa com ID bruto codificado e não interpreta a opção de agendar. |
| Escape de origem/parâmetros | `it.each`: o id %s não muda origem, caminho ou parâmetros (Unicode, espaços, ?, #, &, / e origem aparente). |
| Código como nome acessível | `PainelSetor.test.ts`, `it.each`: %s usa o código real como nome do link, nunca o ID (Secretaria/Financeiro). |
| Ausência legítima | Sem ID conserva código em texto; sem código não cria link sem nome. |
| Contato real/rota correta | `PainelOportunidade.test.ts`: 335 Abrir contato usa a ficha existente `/contatos?c=` e codifica a Pessoa sem trocar identidade; Pessoa null não oferece link. |
| Gates não vazios | `paineis.int.test.ts`: 335 ID de matrícula segue os gates do código, nunca a mera participação. Admin/SEC/FIN positivos conforme setor; vendedor/professor convidados negativos; Financeiro convidado na Secretaria negativo; ator fora do escopo null; sem matrícula null. |
| Regressão do DTO | Expectativas anteriores de Secretaria/Financeiro mantidas com o campo novo exato; nenhuma asserção negativa removida. A rota preserva 200/no-store/auth/404. |

## Banco e pendências do checkpoint de código

RED `73676` e GREEN `1473` terminaram; o banco A foi liberado ao ROOT após `fa0266`, sem executor, servidor ou browser A ativo. Snapshot E2 #323 era o único restauro permitido. O DEV não presumiu sua execução; a confirmação do integrador ainda estava pendente naquele checkpoint.

O visual APP-only `painel-secretaria` ainda dependia de fixture legítima ROOT com Aluno, Matrícula, código e permissão, dois temas e navegação até o destino autorizado, com retorno/foco. O seed histórico não informava matrícula para Lucas, origem 307; o vínculo não foi presumido. Nenhuma imagem, probe, captura ou CLI 335 havia sido produzido; B337 mantinha os scripts e somente ROOT iniciaria preview/fixtures.

QA independente, global integrado, fixture/visual, base de publicação, PR e CI também estavam pendentes. Nenhum global próprio ou gate antigo da #324 foi reatribuído à #335. Após os gates, a fonte executável permaneceu igual; somente SPEC, quadro e relatório seriam consolidados. Planos/investigações #325/#335 e outputs privados anteriores foram preservados.

## Harness visual 335 — checkpoint antes do navegador

O produto permaneceu byte a byte igual a `4c76d200257ea4c3df3707e95100d9180a9efdbc`. O estado APP-only `painel-secretaria` acrescentou seis combinações às 176 anteriores, total de 182. Preflight GET real autorizado exige setor, matrícula e código; prontidão exige link real visível e painel único, sem mensagem fictícia. Protótipo funcional N/A. ROOT preparou 11 linhas privadas (seis de contexto/atores e cinco de catálogo ausente), com snapshot original preservado segundo seu preflight. Preview `79643`, com autorização apenas para navegação/leitura.

RED `832b7f`, terminal 1: sete falhas, duas causais (estado não reconhecido/GET ausente) e cinco por helper inexistente; ausência de export não é regressão de autorização. GREEN `235d12`, terminal 0: 14 arquivos/100 testes visual-inbox, sem `-t` ou novos skips. TSC `11c019`, terminal 0, heap 8192; lint dirigido `5c575a`, terminal 0, maxWarnings 0; diff-check 0. Sem INT, global ou DB nesse checkpoint. As dez linhas do bloco Next gerado em AGENTS ficaram fora do commit até o stop do ROOT. Imagens e cliques ainda estavam pendentes, sem aceite visual declarado.

### Prontidão R2

A rodada CLI R1 inteira foi preservada como negativa (`34480/0f4b39`, terminal 1). No desktop escuro, o GET de mensagens foi abortado sem conclusão substituta observada antes da foto; as outras cinco imagens não fechavam o aceite da rodada. O RED `ffa43c`, terminal 1, teve sete passes/uma falha e comprovou liberação prematura enquanto o corpo do GET ainda estava pendente.

O reuso local de `instalarConclusaoMensagens` na #335 espera os corpos finitos já iniciados antes da foto, sem alterar sensor, filtro ou produção. O painel autorizado/visível continua obrigatório. GREEN `a4b419`, terminal 0: 14 arquivos/101 testes. TSC `2ac1bd`, terminal 0, heap 8192; lint `2f1842`, terminal 0, maxWarnings 0. Nenhuma mensagem foi criada para encobrir thread vazia; R2 usaria pasta e fonte novas.

## Visual e harness — freeze documental DEV de 23/10/2026

APP `4c76` e harness `6e498` têm fontes distintas. O harness acrescenta seis combinações APP Secretaria, preservando as 176 anteriores (182 total), com preflight GET autorizado e conclusão finita das mensagens antes da foto. RED/GREEN e TSC/lint dirigidos constam acima; não houve mudança de produção/ACL ou novo global.

A prova real reuniu 24 PNGs formais APP e 40 complementares: 64 positivas, 4.273.828 bytes, originais/hashes em allowlists curadas. Admin e Secretaria chegaram à matrícula real com código público. Admin saiu do Funil para a mesma Pessoa em `/contatos?c=`. Professor convidado recebeu campos setoriais nulos e envio false; o navegador redirecionou para acesso negado no cadastro. Não se infere autorização da URL nem de HTTP 200 do stream. O protótipo funcional é N/A, explicitado em tabela de 12 linhas; nenhuma referência fabricada.

Na altura de 500 px, foram oito contextos e 12 medidas de borda, com Tab, Escape, foco, mesmo DOM e scroll local. O link móvel ficou inteiro em y482,5–499,5, sem margem ampla; a posição inicial e após rolagem são provas distintas. O último controle foi apenas focado, sem mutação. Duas construções SSE sequenciais tiveram máximo de uma simultânea nas origens. R1 formal, R1 de alcance e uma foto Next foram preservadas e excluídas da positiva, com substitutos e fontes próprios.

ROOT preparou 11 linhas suplementares e restaurou A487 em `c538fc`, saída 0, após o stop `79643`: 424 hashes, nove mensagens e quatro notas originais preservados. O bloco Next de AGENTS foi conferido e removido sozinho. Parecer `output/inbox-335-visual-parecer.md` e allowlists formais/complementares registram a prova e seus limites. No freeze visual, QA independente, global integrado, publicação e CI ainda estavam pendentes; não se presumiu homologação.

A situação atual de publicação e a integração independente do TESTER estão no resumo inicial e no relatório de composição final. Os consumidores da #336 já estão implementados e em validação separada; nenhuma função dessa frente ou da E4 foi acrescentada à PR #414. O CI rápido continua sem integração e a política noturna/dispatch permanece igual. CI do novo head documental, resposta à revisão e merge seguem com o ROOT.
