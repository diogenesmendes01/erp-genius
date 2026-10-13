# Análise das PRs #63–#161 e da publicação no UAT

Data: 13/10/2026. Código analisado: `origin/main` em `e5418550` (merge da #161, 10/10/2026). Escopo: as 94 PRs de #63 a #161, a PR #62 (que ficou fora da `main`), as issues de follow-up #139–#142, #152 e #162, e o caminho da `main` até o UAT.

## 1. Resumo executivo

1. **94 PRs, todas mergeadas.** De #63 a #161 há 94 PRs; os números #139–#142 e #152 são issues. Tudo o que entra na `main` vai sozinho para o **UAT**, o único ambiente (não há produção), pelo Coolify, que roda `prisma migrate deploy` antes do app.
2. **A #65 está publicada, mas pela #66.** O merge da #65 caiu numa branch já fechada; a #66 reaplicou o mesmo commit na `main` (§3.2).
3. **A #62 não está publicada.** São 21 commits e 9 migrations que ficaram só na branch `codex/consolidacao-specs-20260916`. O usuário do UAT **não tem**: resolução do impedimento de 2ª chamada pela gestão (Q164), correção do período da falta de oferta (Q157), aditivos de adiantamento, moeda e regime (Q172, Q173, Q174), aula particular não cobrável (Q175), destino do excedente de permuta (Q171), contrato em papel como origem de aditivos, assinatura eletrônica, validadores de Cédula CR, CURP, DNI AR, DUI SV e passaporte, régua e D+30 no fuso da escola (Q176), a Q161 ampliada e parte do fuso pessoal (§3.1).
4. **Auditoria de UX, remedida em 13/10:** dos 145 achados Alta, antes 37 resolvidos, 21 parciais e 87 abertos; agora **79 resolvidos, 26 parciais, 40 abertos**. Dos 727 Média/Baixa, a estimativa de abertos caiu de 71,1% (IC 63,1–79,2%, ≈ 517) para **58,9% (IC 50,3–67,5%, ≈ 428)**. Detalhe no doc 43 §7.
5. **3 issues abertas:** #141 (só a parte B2, ordenação com acento no Postgres), #152 (buracos da trava `guard-pagina`) e #162 (testes de integração das #158 e #161) (§4).
6. **Maiores riscos:**
   - **testes de integração nunca rodados**: os 13 da #162 e mais os da exportação, da linha comercial do WhatsApp, da inbox e do diário. O CI não roda `*.int.test.ts` e o código já está no UAT;
   - **PRs com migration sem revisão**: a #131 (migration com `UPDATE` de dados) e a #132 entraram sem nenhuma revisão e as migrations já foram aplicadas no banco do UAT;
   - **merges sem APPROVE**: nenhuma PR tem APPROVE formal, porque autor e revisor são a mesma conta; 52 das 94 entraram sem APPROVE escrito sobre o head mergeado (§6.3).

## 2. Método e limites

**Fontes**
- `docs/42-auditoria-frontend-ux.md` (doc 42, a auditoria) e `docs/43-medicao-auditoria-ux.md` (doc 43, a medição de 07/10 e a remedição de 13/10 na §7).
- Código da `main` em `e5418550`, depois de `git fetch --all`: `git show origin/main:<arquivo>`, `git grep`, `git log --first-parent`, `git merge-base --is-ancestor`, `git cherry`, `git patch-id` e `git merge-tree --write-tree` (simulação de merge que não cria referência nem mexe em branch).
- `gh` só leitura: `gh pr view N --json …` (corpo, commits, reviews, comentários e arquivos), `gh pr diff N --name-only`, `gh api …/pulls/N/reviews|comments` e o estado das issues a partir da #139.
- `node scripts/medicao-ux/metricas.mjs` na `main` `e5418550`, para a remedição (doc 43 §7).

**Convenções:** "L…" é a linha do achado no doc 42, a mesma notação do doc 43. R1, R2… são as rodadas de revisão; RC é REQUEST CHANGES. "APPROVE" quer dizer o veredito escrito numa review registrada como `COMMENTED` (§6.2). Na §7 os horários estão em UTC, salvo indicação.

**O que não foi feito**
- O UAT **não foi aberto**. Não se sabe qual commit roda lá: o repositório não registra deploy, e os endpoints de saúde não expõem o SHA (§3.4.1).
- Os **testes de integração não rodaram**, nem nesta análise nem, até onde há registro, nas PRs que os alteraram. Nenhuma suíte foi executada nesta análise: os números de `tsc`, `vitest` e mutações são os relatados nas PRs pelo autor, pelo revisor ou pelo integrador.
- As **telas não foram vistas rodando**. Toda afirmação sobre comportamento visual vem de leitura de código; onde um relatório marcou "não verificado", a ressalva continua.
- Nenhum arquivo do repositório foi alterado durante a análise.

## 3. O que está e o que não está publicado no UAT

### 3.0 Resumo executivo (para o dono do produto)

**Publicado no UAT, desde que o deploy automático esteja de fato funcionando (ver §3.4):**
- Tudo que entrou na `main` até a #161. Isso inclui a consolidação do ERP (#61, 21/09) e as PRs #63–#161, quase todas de UI/UX, WhatsApp e filas.
- O "PR 2" de design (token `brand-solid`, troca de `bg-white` por `surface`, menu lateral fixo). Ele **está** na `main`, só que pela **#66** (reaplicação idêntica) e não pela #65.
- As PRs de design #79–#82 (pesos de título, trava de paleta, esqueletos de carregamento, rótulos da ficha). O squash de cada uma é **idêntico, byte a byte**, ao estado final da branch.

**Não publicado (o código existe só na branch `codex/consolidacao-specs-20260916`, vindo da PR #62):** todo o pacote de "pendências de código da SPEC" de 21/09. Do ponto de vista do usuário, o UAT **não tem**:
1. Resolução, pela gestão, do impedimento de segunda chamada causado pela escola (Q164).
2. Correção do período de um relato de "falta de oferta" já confirmado (Q157).
3. Aditivo de **adiantamento** aplicado à cobrança (Q172), aditivo de **moeda** (Q173) e recusa do aditivo de **regime**, com a orientação "faça nova contratação" (Q174).
4. Aula particular "não devia ser cobrada": reduzir ou cancelar a cobrança, gerar crédito ou devolver horas pré-pagas (Q175).
5. Destino negociado do **excedente de permuta** e uso do **saldo restrito a serviços** (Q171/Q167C).
6. **Contrato legado (em papel) como origem de aditivos** (origem contratual histórica).
7. Envio, conciliação e cancelamento de **assinatura eletrônica** pelo "port" com driver simulado. Mesmo se portado, o UAT não ativaria nada: o driver simulado é recusado com `NODE_ENV=production`.
8. Validadores de **Cédula CR, CURP, DNI AR, DUI SV e passaporte**. Hoje esses documentos ficam como "não validado".
9. **Régua de cobrança e bloqueio D+30 virando o dia no fuso da escola** (Q176). Hoje o dia vira no relógio do servidor.
10. **Q161 ampliada**: transferência no meio do ciclo e alterações de quantidade de aulas na comprovação de oferta.
11. **Fuso pessoal** em cerca de 15 telas restantes. Está **parcial**: a #159 cobriu parte, com outro desenho.

**Nenhuma** dessas 9 migrations está na `main`, então o banco do UAT não tem essas tabelas. A documentação da `main` não diz que esses recursos estão prontos: ela continua dizendo "aguarda decisão". Ou seja, **a doc da `main` está atrasada nas decisões** (o registro `decisoes-2026-09-21.md` também só existe na branch), mas não promete o que não existe.

**Recomendação:** portar por recurso, em PRs pequenas, na ordem original:
1. **Servidor, schema e migrations:** cherry-pick, que aplica limpo, porque a `main` quase não mexeu nesses arquivos.
2. **UI:** reimplementar, porque 27 telas conflitam com as PRs de UX e os componentes novos não passam nas 28 travas atuais.
3. **Fuso pessoal:** refazer sobre a #159, sem cherry-pick.

Cada merge na `main` aplica migrations **automaticamente** no banco do UAT (`prisma migrate deploy`). Por isso, antes de cada lote, é preciso backup, ensaio em cópia do banco e a suíte de integração completa.

---

### 3.1 PR #62 — recurso por recurso

#### 3.1.1 Como a #62 ficou de fora (evidência)

| Fato | Evidência |
|---|---|
| #61 levou `codex/consolidacao-specs-20260916` à `main` em 21/09 12:29 (-03) | merge `1ca53675`; head da #61 = `b3e08c6b` (`gh pr list --state merged`) |
| #62 tinha como base essa branch, não a `main` | `gh pr view 62`: `baseRefName = codex/consolidacao-specs-20260916`, head `claude/q161-evolucao-aulas` (`db854944`) |
| #62 foi mergeada em 22/09 09:45 (-03), depois da #61 | merge `7d281719`, com pais `b3e08c6b` + `db854944` |
| Os 21 commits não estão na `main` | `git log origin/main..origin/codex/consolidacao-specs-20260916` = 21 commits + o merge; `git cherry origin/main origin/claude/q161-evolucao-aulas` = **21 "+"** (nenhum patch equivalente na `main`) |
| Todos os arquivos novos estão ausentes | 54 arquivos adicionados pela #62: **54/54 ausentes** em `origin/main` (`git cat-file -e`) |
| Todos os modelos novos estão ausentes | 23 `model` novos no `schema.prisma` da #62: **0/23** no `origin/main:prisma/schema.prisma` |
| Só a #62 e a #65 tiveram base diferente da `main` | Varredura das 133 PRs mergeadas (`gh pr list --state merged --limit 200`): só essas duas |

Tamanho da #62 (`git diff b3e08c6b 7d281719`): **155 arquivos** (54 novos e 101 alterados), **+7.510/−284**. Destes, 148 ficam em `src/` ou `prisma/`.

#### 3.1.2 Tabela por recurso

Legenda de status: **AUSENTE**, **PARCIAL**, ou **REIMPL.** (reimplementado por PR posterior).

| # | Recurso / Q-id | Commits da #62 | Migration | Arquivos principais da #62 | Status na `main` | Evidência na `main` |
|---|---|---|---|---|---|---|
| 1 | **Q161**: cadeia pós-replanejamento (`PREVISTO→MINISTRADO`) e alterações de quantidade encadeadas na âncora; destinos acadêmicos na mesma cadeia | `73c8a2a9` | — | `src/server/agenda/cadeia-calendario-oferta.ts` (+85/−15), `academico/destino-agenda.ts`, `academico/regras.ts`, `matricula/oferta-continuidade-agenda-tx.ts` | **PARCIAL**: a Q161 de base (incremento 605, cadeia calendário→revisão→decisão) veio pela #61; o acréscimo da #62 está **ausente** | `src/server/academico/regras.ts:67`: `REPLANEJAMENTO_APLICADO` sem `alteracoesQuantidade` (símbolo: 0 ocorrências na `main` e 7 na #62). `cadeia-calendario-oferta.ts`, `destino-agenda.ts`, `estado.ts` e `oferta-continuidade-agenda-tx.ts` estão **idênticos** à base `b3e08c6b` |
| 2 | **Q161**: transferência aprovada no meio do ciclo comprova oferta | `6cee069e` | — | `matricula/oferta-continuidade-agenda-tx.ts`, `oferta-continuidade-transferencia.test.ts` (novo) | **AUSENTE** | `src/server/matricula/oferta-continuidade-agenda-tx.ts:24`: o `Pick` da transação não inclui `solicitacaoMudancaAcademica`, que a #62 acrescenta |
| 3 | **Fuso pessoal** nas telas restantes de instantes (15 telas e 26 arquivos) | `d3109641` | — | segundas chamadas, movimentações, agenda de aditivo, indisponibilidade de oferta, ocorrências financeiras, preparação, reservas | **PARCIAL**: a **#159** (`b59744b9`, "fuso e instante", 10/10) fez parte, com outro desenho (`CampoFuso`, `fusoInicialDeEntrada`, `AvisoFusoNaoConfigurado`, trava `src/app/fuso-instante.test.ts`) | Coberto: `academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx:40-41` (usa `fusoExibicao`); `matriculas/[id]/preparacao/page.tsx:22` (formata, mas com preferência `null`, sem fuso pessoal); `.../propostas/[propostaId]/agenda/page.tsx:35` (só o valor inicial do campo). Ainda no fuso de origem/institucional: `secretaria/reservas/page.tsx:28`, `matriculas/[id]/indisponibilidade-oferta/RelatosIndisponibilidadeOferta.tsx:22-23`, `matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx:32`. Contagem de `formatarInstanteExibicao\|consultarPreferenciaFusoEquipe\|fusoExibicao` por arquivo: na #62, todos os 21 arquivos de produção usam; na `main`, só 4 (agenda/page, substituicao/page, preparacao/page e AcertoEncerramento, que já usava na base) |
| 4 | **Assinatura eletrônica (port)**: `ProvedorAssinatura`, driver simulado, envio/conciliação de contrato e aditivo, cancelamento na desistência | `d2cf08f2`, `1583df0a`, `f09201ea` | — | `src/server/contratos/provedor-assinatura.ts`, `contratos/envio.ts`, `contrato/EnviarAssinatura.tsx`, `aditivos/EnvioAditivoFormulario.tsx`, `desistencia/documentos/CancelarAssinatura.tsx`, `matricula/desistencia-cancelamento-assinatura.ts`, `deploy/env.production.example` (`ASSINATURA_DRIVER`) | **AUSENTE** | `ProvedorAssinatura` e `ASSINATURA_DRIVER`: 0 ocorrências em `src`/`prisma`. `src/server/contratos/aditivo-envio.ts:7-9` só prepara o processo interno (enum ZAPSIGN/CLICKSIGN/DOCUSIGN, sem driver). `desistencia-cancelamento-assinatura.ts:20-22`: não chama o fornecedor (idêntico à base) |
| 5 | **Validadores de documento**: Cédula CR, CURP, DNI AR, DUI SV e passaporte ("avisa, não bloqueia") | `d379bbc3` | — | `src/server/_shared/validacao.ts` (+ teste) | **AUSENTE** | `src/server/_shared/validacao.ts:137-142`: `VALIDADORES` só tem `cpf`, com `// TODO (P5/B1): algoritmos reais de cedula_cr, curp, dni_ar, dui_sv, passaporte`, e `passaporte: () => false` |
| 6 | **Q176**: régua e D+30 viram o dia no fuso único da escola | `ec5fd06b` | — | `cobrancas/regua.ts` (`diaCivilGravado`, `diasCivisDesde`, `diasDeAtraso`), `cobrancas/acesso-aulas-regras.ts`, `acesso-aulas.ts`, `consultas.ts`, `gravacoes/autorizacao.ts` | **AUSENTE** | `src/server/cobrancas/regua.ts:79` (`diferencaEmDias` no relógio local do processo), `:169` e `:176` (`proximaAcao` sem fuso); `src/server/cobrancas/acesso-aulas-regras.ts:17` (D+30 com `diferencaEmDias`). `diasCivisDesde`: 0 ocorrências |
| 7 | **Q164**: resolução do impedimento escolar por confirmação da gestão | `2bc19ef7` | `20260921010000_resolucao_impedimento_segunda_chamada` (61 linhas) | `avaliacoes/segunda-chamada-resolucao-impedimento(-tx).ts`, `historico/ResolverImpedimento.tsx`, `avaliacoes/pendencias-fechamento-tx.ts` | **AUSENTE** | `model ResolucaoImpedimentoSegundaChamada` não existe em `prisma/schema.prisma`; `ResolverImpedimento.tsx` está ausente; `pendencias-fechamento-tx.ts` está idêntico à base |
| 8 | **Q157**: correção versionada, com aprovação independente, do período do relato de falta de oferta | `c1b70186` | `20260921020000_correcao_relato_indisponibilidade_oferta` (214) | `matricula/indisponibilidade-oferta-correcao(-regras).ts`, rota `matriculas/[id]/indisponibilidade-oferta/[registroId]/correcao/*` | **AUSENTE** | Os modelos `PropostaCorrecaoRelatoIndisponibilidadeOferta` e `DecisaoCorrecaoRelatoIndisponibilidadeOferta` não existem; a rota `.../[registroId]/correcao` está ausente |
| 9 | **Q172**: aplicação do aditivo de adiantamento enquanto não pago nem utilizado | `5fb66ea2` | `20260921030000_aplicacao_adiantamento_aditivo` (304) | `contratos/adiantamento-aditivo.ts`, `aditivo-adiantamento.ts`, `aditivo-aplicacao-campos(-tx).ts`, rota `financeiro/acertos-adiantamento/[matriculaId]/[propostaId]` | **AUSENTE** | Os modelos `Proposta/Decisao/AplicacaoAdiantamentoAditivo` não existem; a rota `financeiro/acertos-adiantamento` está ausente. `aditivo-aplicacao-campos*.ts` está idêntico à base |
| 10 | **Q175 fatia 1**: aula particular não cobrável, atômica com a publicação acadêmica (reduz ou cancela a cobrança aberta; se paga, gera crédito) | `5f2b7de0` (+ docs `b6baf516`, `3c1e23b9`) | `20260921040000_correcao_aula_nao_cobravel` (285) | `financeiro/revisao-correcao-aula-aplicacao-tx.ts` (novo), `revisao-correcao-aula.ts`, `diario/correcao-aula*.ts`, `revisoes-correcao-aula/*` | **AUSENTE** | `NAO_COBRAVEL`: 0 ocorrências na `main` e 12 na #62; os modelos `AplicacaoRevisaoFinanceiraCorrecaoAula` e `OrigemCreditoRevisaoCorrecaoAula` não existem |
| 11 | **Q175 fatia 2**: paga com horas pré-pagas devolve os minutos ao saldo | `85938ed7` | `20260921050000_estorno_consumo_horas_nao_cobravel` (253) | `matricula/compra-horas.ts`, `encerramento-horas-tx.ts`, `reserva-horas-compradas.ts` | **AUSENTE** | `model EstornoConsumoHorasCompradas` não existe; os 3 arquivos estão idênticos à base |
| 12 | **Q174**: aditivo de `REGIME` recusado na proposta, com a orientação "nova contratação" | `08ad8462` | — | `contratos/aditivo-coerencia.ts`, `ValorEstruturadoCampo.tsx` | **AUSENTE** | `src/server/contratos/aditivo-coerencia.ts:18-20`: `validarCoerenciaValoresAditivo` não recusa `REGIME` (`MENSAGEM_REGIME_NOVA_CONTRATACAO`: 0 ocorrências) |
| 13 | **Q173**: aditivo de moeda, só para o futuro e com a matrícula "limpa" | `3d6aa061` | `20260921060000_aplicacao_moeda_aditivo` (251) | `contratos/aditivo-moeda.ts`, `moeda-aditivo.ts`, rota `financeiro/acertos-moeda/[matriculaId]/[propostaId]`, `continuidade-preco-tx.ts`, `encerramento-contexto-tx.ts` | **AUSENTE** | Os modelos `Proposta/Decisao/AplicacaoMoedaAditivo` não existem; a rota `financeiro/acertos-moeda` está ausente |
| 14 | **Q171/Q167C**: destinação negociada do excedente de permuta (concordâncias, aprovador independente, `SaldoServicoPermuta` + `CreditoMatricula` como 9ª origem) | `5f2354ee` | `20260921070000_destinacao_excedente_permuta` (319) | `matricula/excedente-permuta-destinacao.ts`, rota `financeiro/permuta/excedente/[matriculaId]`, `PermutaOperacional.tsx` | **AUSENTE** | Os 7 modelos (`PropostaDestinacaoExcedentePermuta`, `OrigemExcedentePermuta`, `ItemDestinacao…`, `Concordancia…`, `Decisao…`, `SaldoServicoPermuta`, `OrigemCreditoExcedentePermuta`) não existem; a rota `financeiro/permuta/excedente` está ausente |
| 15 | **Q171**: uso do saldo restrito a serviços (abate mensalidade, hora ou taxa da mesma matrícula e moeda) | `4f09181e` | `20260921080000_uso_saldo_servico_permuta` (136) | `matricula/saldo-servico-permuta-uso.ts`, `excedente-permuta-origens-tx.ts` | **AUSENTE** | `prisma/schema.prisma:8069-8074`: `AplicacaoCompensacaoPermuta` com `destinoId`/`decisaoId` obrigatórios e sem `usoSaldoServicoId` |
| 16 | **Origem contratual histórica**: contrato legado (PDF assinado + transcrição + conferência dupla) como fonte de aditivos | `db854944` | `20260921090000_origem_contratual_historica` (547) | `contratos/origem-historica*.ts`, `fonte-contratual-tx.ts`, rotas `matriculas/[id]/contrato/origem-historica` e `api/matriculas/[id]/origem-historica/**`, guardas Q117 | **AUSENTE** | `prisma/schema.prisma:4410-4411` (`PropostaAditivoContratual.conclusaoOriginalId String`, obrigatório) e `:4607-4608` (`PropostaAgendaAditivoParticular.conclusaoFonteId String`, obrigatório). A #62 torna os dois opcionais e acrescenta `origemHistoricaId` |
| 17 | Documentação de decisões | `ec5fd06b`…`db854944`, `ee3a9cf6`, `b6baf516`, `3c1e23b9` | — | `docs/planejamento/decisoes-2026-09-21.md` (novo), `q175-desenho-tecnico.md` (novo), `quadro-entregas.md`, `continuidade-q161-q162.md`, `fornecedor-assinatura-q155.md` | **AUSENTE** | Os dois documentos novos não existem na `main`; as linhas do quadro continuam as antigas (ver §3.1.3) |
| 18 | Apoio de teste | `c1b70186`, `5fb66ea2` | — | `scripts/test-profile.mjs`, `src/test/substituicao-contratual.ts` | **AUSENTE** | Os dois arquivos estão idênticos à base `b3e08c6b` |

**Nenhum** recurso da #62 foi reimplementado por inteiro por PR posterior. A única sobreposição real é o item 3, coberto em parte pela #159.

#### 3.1.3 A doc da `main` diz que está pronto?

Não. A doc da `main` **não** promete esses recursos; ela ficou **atrasada nas decisões**. As decisões de 21/09 só estão registradas na branch: `7d281719:docs/planejamento/decisoes-2026-09-21.md:7-18` e `:56-67`.

| Doc na `main` | O que diz | Realidade |
|---|---|---|
| `docs/planejamento/quadro-entregas.md:101` | Régua e D+30 "ainda dependem da definição Q176" | Q176 foi decidida (fuso único) e implementada na #62, mas não publicada |
| `docs/planejamento/quadro-entregas.md:103` | Q167: "Q171 delimita destinos; proposta, aplicação e interface ainda faltam" | Implementado na #62, mas não publicado |
| `docs/planejamento/quadro-entregas.md:104` | "Adiantamento Q172, moeda Q173 e regime Q174 aguardam definição de alcance" | Decididos e implementados na #62, mas não publicados |
| `docs/planejamento/quadro-entregas.md:105` | "Resolução formal ainda aguarda Q164" | Idem |
| `docs/planejamento/quadro-entregas.md:1053`, `:1056` | "Q176 enviada e ainda sem decisão" / "continua sem resposta" | Idem |
| `docs/41-situacao-consolidada-do-projeto.md:24` | Q164: "Resposta pendente, comportamento não presumido" | Idem |
| `docs/planejamento/auditoria-609-alcance.md:48` | "Q157 continua sem decisão" | Idem |
| `docs/planejamento/fornecedor-assinatura-q155.md:24` | O ERP pode avançar no registro interno sem escolher fornecedor | Na branch há a atualização de 21/09 com o port; na `main`, não |

**Divergência real entre doc e código (anterior à #62, que a resolveria):** `docs/04-fase1-dominio.md:35` diz que os validadores `cpf`, `curp`, `cedula_cr` e `dni_ar` "Os comuns já vêm prontos". Mas `src/server/_shared/validacao.ts:139` tem o TODO, e só `cpf` está implementado.

O PR (`gh pr view 62`) diz "suíte completa verde" e "integração em banco descartável". Isso vale para a branch, não para a `main`.

---

### 3.2 PR #65: cada mudança e por onde entrou na `main`

**Fatos:**
- A #64 (`claude/pr1-bordas-de-rota`) entrou na `main` às 16:20:11Z de 22/09 (merge `5e8a450e`).
- A #65 tinha base `claude/pr1-bordas-de-rota` e foi mergeada às 16:20:22Z (merge `ebcd5e01`). Assim, o commit `4122e644` foi para a branch já fechada.
- A **#66** (`claude/pr2-redo-para-main`, merge `7ba0b3c2`, 18:59:15Z) reaplicou o mesmo commit como `373dc1de`. `git patch-id --stable` dá o **mesmo valor** para os dois commits (`dcbe83b4…`, 91 arquivos, +174/−127).
- `git cherry` marca `4122e644` com "−": o patch equivalente está na `main`.
- A #66 trouxe ainda `23f58e6c` (promove o botão primário para `brand-solid` e conserta o `focus-visible`) e `7bdefd06` (sincroniza a `docs/18`).

| Mudança da #65 | Na `main`? | Entrou por | Evidência atual (`origin/main`) | Evolução posterior |
|---|---|---|---|---|
| Token `--brand-solid` (globals + Tailwind) | Sim | #66 | `src/app/globals.css:42` (`#4338ca`, claro), `:94` (escuro); `tailwind.config.ts:44` | No escuro deixou de ser o mesmo hex: `#6264ec` desde a **#157** (`c107da32`) |
| `--text-terciary` mais escuro/claro (AA) | Sim | #66 | `globals.css:27` (`#6d6c64`), `:81` (`#979692`) | — |
| `--border-control` novo; `gray.300` aponta para ele | Sim | #66 | `globals.css:22`, `:77`; `tailwind.config.ts:23` | Valores 0,42/0,34 viraram 0,44/0,36 na **#156** (`fbada6a2`) |
| `--brand` no escuro `#6b6ef5` | Sim | #66 | `globals.css:84` | — |
| `h1–h4` com peso 500, `:focus-visible` global, 16px em campo abaixo de 768px | Sim | #66 | `globals.css:143-153`, `:167-172`, `:179-183` | Ampliado pela #79 (h5, h6 e dt; trava de tipografia) |
| `bg-white`→`bg-surface`; `bg-brand-700`/`hover:bg-brand-700`/`bg-blue-700` trocados; `shadow-*` removidas | Sim | #66 | `git grep` em `src/**/*.tsx`: **0** arquivos com `bg-white` isolado, **0** com `bg-brand-700`/`bg-blue-700`, **0** com `shadow-xl`/`shadow-sm` | `hover:opacity-90` virou `hover:brightness-95` (`23f58e6c`, na própria #66; `tailwind.config.ts:43`). Trava de paleta: #80 |
| Sidebar `sticky top-0 h-screen shrink-0 overflow-y-auto` | Sim | #66 | `src/components/Sidebar.tsx:126` | `h-screen` virou `h-dvh` já na #66; `hidden … md:flex` (barra mobile) veio na **#94** (`8b97b771`) |
| `<main>` com `min-w-0` e `p-4 md:p-8` | Sim | #66 | `src/app/(app)/layout.tsx:22` | `id="conteudo"` acrescentado depois (#71, `8ec4dfc5`) |

**Conclusão:** nada da #65 está faltando na `main`. O merge `ebcd5e01` é só um fantasma na branch fechada.

---

### 3.3 Branches remotas fora da `main`

`git branch -r --no-merged origin/main` devolve 10 branches de 136 remotas.

| Branch | Commits fora da `main` | Mexe em `src/`/`prisma/`? | Conteúdo na `main`? | Como |
|---|---|---|---|---|
| `codex/consolidacao-specs-20260916` | 22 (21 da #62 + merge `7d281719`) | Sim, 148 arquivos | **Não. Trabalho não publicado** | `git cherry` = 21 "+" |
| `claude/q161-evolucao-aulas` | 21 (tip `db854944`) | Sim, idem | **Não. Trabalho não publicado** (mesmo conteúdo da linha acima) | idem |
| `claude/pr1-bordas-de-rota` | 2 (`ebcd5e01`, `4122e644`) | Sim, 89 arquivos | **Sim** | `4122e644` ≡ `373dc1de` da #66 (patch-id igual; `git cherry` = "−") |
| `claude/pr2-brand-solid-shell` | 1 (`4122e644`) | Sim | **Sim** | idem |
| `claude/pr13-pesos-titulos` | 2 | Sim (fontes, `globals.css`, `tipografia.test.ts` e 7 telas) | **Sim** | squash da **#79** `e9b1c29d` |
| `claude/pr14-trava-paleta` | 3 (inclui merge da `main`) | Sim (`paleta.test.ts`, `layout.tsx`) | **Sim** | squash da **#80** `c9d2f67c` |
| `claude/pr15-esqueletos` | 3 | Sim (13 arquivos: `Esqueleto.tsx`, `loading.tsx`…) | **Sim** | squash da **#81** `b91359aa` |
| `claude/pr16-ficha-rotulos` | 3 | Sim (`FichaAluno.tsx` + teste) | **Sim** | squash da **#82** `a4e9f7ba` |
| `cursor/coolify-deploy-d4f5` | 1 (`40b8aefa`, `docker-compose.coolify.yml`) | Não | Sim | `git cherry` = "−", equivalente na `main` (db-init com `\gexec`, #124 `1610770c`) |
| `claude/nice-wright-mlddu2` | 1 (`33a933b3`, 22/06, `.gitignore` com `.claude`) | Não | Não (`.gitignore` da `main` não tem `.claude`) | Irrelevante para o UAT |

#### 3.3.1 Conferência do squash das pr13–16

O `git cherry` marca "+" nos commits individuais porque o squash junta tudo num patch só. Foi conferido pelo conteúdo final:

| PR | Squash (1 pai) | Árvore do squash = árvore do tip da branch | patch-id `diff squash^ squash` | patch-id `diff origin/main...branch` | Arquivos |
|---|---|---|---|---|---|
| #79 | `e9b1c29d` (pai `4472eab5`) | **IDÊNTICA** (`git diff --quiet` = 0) | `c90d16c54dac` | `c90d16c54dac` | 10 = 10 |
| #80 | `c9d2f67c` (pai `e9b1c29d`) | **IDÊNTICA** | `258c7c15db98` | `258c7c15db98` | 3 = 3 |
| #81 | `b91359aa` (pai `c9d2f67c`) | **IDÊNTICA** | `ab508b4b21ab` | `ab508b4b21ab` | 13 = 13 |
| #82 | `a4e9f7ba` (pai `b91359aa`) | **IDÊNTICA** | `a277cd2484ea` | `a277cd2484ea` | 2 = 2 |

Os quatro squashes são ancestrais da `main`. Depois deles, alguns arquivos foram alterados de novo por PRs posteriores (ex.: `FichaAluno.tsx` por #87, #89, #111, #114, #121, #126, #138, #145 e #159; `globals.css` por #156 e #157). Isso é evolução normal, não perda.

Os arquivos que nenhuma PR posterior tocou continuam iguais ao tip da branch: `tipografia.test.ts`, `paleta.test.ts`, `Esqueleto.tsx`/`.test.ts` e os `loading.tsx` novos.

---

### 3.4 Como a `main` vai para o UAT

| Peça | O que faz | Evidência |
|---|---|---|
| Gatilho | **Webhook Git do Coolify** a cada merge na `main` | `SETUP.md:184-185` ("Cada merge no branch `main` dispara um novo deploy (webhook Git do Coolify)"); `docker-compose.coolify.yml:2` ("deploy automático no merge do main"); `SETUP.md:138-141` (Resource Docker Compose (Git), branch `main`, arquivo `docker-compose.coolify.yml`) |
| CI do GitHub | Só verifica: typecheck, lint e testes unitários em dois fusos. **Não faz deploy** e **não roda integração** | `.github/workflows/ci.yml:1-2` ("Só CI — deploy (CD) fica fora deste workflow"), `:22-23` (`*.int.test.ts` fora do `npm test`), `:63-88` |
| Build | `Dockerfile` multi-stage: `npm ci` → `prisma generate` → checagem do schema engine → `next build` (standalone) → runner com `NODE_ENV=production` | `Dockerfile:11-30`, `:34` |
| **Migrations** | Serviço one-shot `migrate` (imagem `builder`) roda **`npx prisma migrate deploy`** contra o Postgres do próprio compose, **antes** do app. O `app` só sobe se o `migrate` terminar com sucesso | `docker-compose.coolify.yml:62-75` (comando na `:67`); `app.depends_on.migrate: service_completed_successfully` em `:117-118`; `Dockerfile:4-5` |
| Saúde | Healthcheck do `app` em `/api/ready` (`SELECT 1` via Prisma) | `docker-compose.coolify.yml:119-129`; `src/app/api/ready/route.ts:14-29` |
| Alternativa manual (VPS sem Coolify) | `docker compose -f docker-compose.prod.yml up -d --build`, com o mesmo `migrate deploy` | `docker-compose.prod.yml:33-38`; `docs/31-whatsapp-go-live.md:102-110` |

**O deploy não espera o CI.** O webhook do Coolify dispara no push, com qualquer resultado do CI. O CI do tip `e5418550` passou (4 check-runs `success`), mas nada amarra uma coisa à outra.

#### 3.4.1 Indícios de que o UAT pode estar atrás da `main`

Não há nada no repositório que prove qual commit o UAT roda:
1. **Nenhum registro de deploy no GitHub:** `gh api …/deployments` volta vazio; o status combinado de `e5418550` é `pending` com 0 statuses; os check-runs são só do `github-actions`.
2. **Nenhum webhook de repositório:** `gh api …/hooks` devolve `[]`. Se o Coolify estiver ligado por GitHub App, o webhook não aparece ali. Se estiver por webhook manual, **não há webhook configurado**, e então o "deploy automático" do `SETUP.md:185` não está ativo. Só o painel do Coolify confirma.
3. **Nenhum endpoint expõe a versão:** `/api/health` (`src/app/api/health/route.ts:10`) e `/api/ready` devolvem só `ok`/`ready` e `timestamp`, sem SHA de commit. Não dá para conferir de fora.
4. **Falha de migration trava o deploy sem alarde:** se `migrate deploy` falhar, o `app` novo não sobe (`docker-compose.coolify.yml:117-118`). Conforme a configuração do Coolify, o container anterior pode continuar no ar, e o UAT fica num commit antigo sem aviso no repositório.
5. **O banco tem uso real:** o comentário da migration `prisma/migrations/20260929120000_contato_whatsapp_nome_perfil/migration.sql:1` fala em "bug de produção 29/09/2026". Logo, `migrate deploy` roda sobre dados reais a cada merge.

---

### 3.5 Risco de portar a #62 agora

#### 3.5.1 Simulação de merge (`git merge-tree --write-tree --name-only origin/main origin/codex/consolidacao-specs-20260916`)

O resultado é `exit 1` com **27 arquivos em conflito de conteúdo**, todos em `src/app/(app)/**` (UI e testes de página). **Nenhum** em `src/server`, `prisma` ou `docs`.

| Grupo | Arquivos | Quantidade |
|---|---|---|
| Em conflito | 27 (lista abaixo) | 27 |
| Alterados pela #62 **e** pela `main`, mas com merge automático | `docs/planejamento/quadro-entregas.md`, `prisma/schema.prisma`, `financeiro/permuta/PermutaOperacional.tsx`, `aditivos/[propostaId]/originais/[artefatoId]/page.test.ts`, `contrato/originais/[artefatoId]/page.tsx`, `indisponibilidade-oferta/[registroId]/termino/page.tsx`, `RevisoesCorrecaoAula.callbacks.test.ts`, `revisoes-correcao-aula/page.test.ts`, `matriculas/[id]/reserva/page.tsx`, `src/server/academico/regras.ts` (#92), `src/server/cobrancas/consultas.ts` (#144) | 11 |
| Alterados pela #62 e **intocados** na `main` desde `1ca53675` | todo o resto do servidor (contratos, matrícula, financeiro, cobranças, avaliações, agenda), `validacao.ts`, `test-profile.mjs`, `env.production.example`… | 63 |
| Novos na #62 (sem conflito possível) | 54 (inclui as 9 migrations) | 54 |

**Os 27 conflitos, com o commit da #62 que mexeu e as PRs da `main` que mexeram (`git log --first-parent 1ca53675..origin/main`):**

| Arquivo (`src/app/(app)/…`) | Commit da #62 | PRs da `main` |
|---|---|---|
| `academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/SegundaChamadaPainel.tsx` | `d3109641` (fuso) | #66 #113 #118 #121 #126 #138 #153 #160 |
| `…/[codigoAvaliacao]/historico/page.tsx` | `2bc19ef7` (Q164) | #110 #120 #126 #138 |
| `…/propostas/[propostaId]/agenda/Formulario.tsx` | `d3109641` | #78 #113 #118 #121 #155 #159 |
| `…/propostas/[propostaId]/agenda/page.test.ts` | `d3109641` | #159 |
| `…/propostas/[propostaId]/agenda/page.tsx` | `d3109641` | #126 #159 |
| `…/reservas/[reservaId]/substituicao/page.test.ts` | `d3109641` | #155 #159 |
| `…/reservas/[reservaId]/substituicao/page.tsx` | `d3109641` | #110 #126 #138 #155 #159 |
| `alunos/[id]/movimentacoes/AcertoEncerramento.tsx` | `d3109641` | #67 #83 #93 #111 #114 #118 #121 #138 |
| `alunos/[id]/movimentacoes/ImpactosAcademicosAcerto.tsx` | `d3109641` | #138 |
| `matriculas/[id]/contrato/aditivos/Formularios.test.ts` | `db854944` (origem histórica) | #153 |
| `matriculas/[id]/contrato/aditivos/Formularios.tsx` | `db854944` | #83 #116 #118 #121 #153 |
| `…/aditivos/[propostaId]/originais/[artefatoId]/page.tsx` | `1583df0a` (assinatura) | #93 #110 #126 #134 #138 |
| `…/aditivos/[propostaId]/page.tsx` | `5fb66ea2`, `3d6aa061`, `db854944` | #110 #111 #134 #160 |
| `…/aditivos/agenda/ConferenciaAgendaFormulario.tsx` | `d3109641` | #116 #118 #126 #153 #159 |
| `…/aditivos/agenda/page.tsx` | `d3109641` | #110 |
| `…/aditivos/page.tsx` | `db854944` | #110 #126 #134 |
| `matriculas/[id]/desistencia/documentos/page.tsx` | `d2cf08f2` (assinatura) | #110 #126 #138 |
| `matriculas/[id]/indisponibilidade-oferta/RelatosIndisponibilidadeOferta.tsx` | `c1b70186` (Q157), `d3109641` | #78 #83 #116 #118 #121 #126 #134 #159 |
| `…/[registroId]/termino/TerminoIndisponibilidadeOferta.tsx` | `d3109641` | #78 #83 #116 #118 #121 #126 #134 #159 |
| `matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx` | `d3109641` | #83 #93 #116 #121 #138 #153 |
| `matriculas/[id]/ocorrencias-financeiras/page.tsx` | `d3109641` | #110 #111 #126 #134 #160 |
| `…/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx` | `5f2b7de0`, `85938ed7` (Q175), `d3109641` | #83 #87 #93 #116 #121 #126 #135 #138 |
| `…/revisoes-correcao-aula/page.tsx` | `5f2b7de0`, `85938ed7`, `d3109641` | #110 #111 |
| `matriculas/[id]/preparacao/page.tsx` | `d3109641` | #110 #138 #159 |
| `secretaria/reservas/[id]/page.tsx` | `d3109641` | #110 #126 #138 |
| `secretaria/reservas/page.tsx` | `d3109641` | #110 #126 #138 |
| `secretaria/reservas/particulares/[id]/page.tsx` | `d3109641` | #110 #126 #138 |

O commit de fuso `d3109641` responde por **20 dos 27** conflitos. Ao todo, 22 PRs da `main` tocaram esses arquivos: #66 #67 #78 #83 #87 #93 #110 #111 #113 #114 #116 #118 #120 #121 #126 #134 #135 #138 #153 #155 #159 #160. São E1 (botões/componentes), E2 ("voltar para"), E3 (feedback separado), E5 (rótulos, enums, moeda, códigos e datas), E6 (fuso e instante), E7 (identificação e campo) e a12y.

**Por commit, aplicado isolado sobre a `main`:**
- Aplicam **limpos** `73c8a2a9` (Q161), `d379bbc3` (validadores), `ec5fd06b` (Q176) e `3c1e23b9` (docs).
- Os conflitos dos demais em `src/server`, `prisma/schema.prisma` e `docs/decisoes-…` são **dependências internas da própria #62**. Exemplo: `3d6aa061` (Q173) depende das mudanças de `5fb66ea2` (Q172) em `aditivo-aplicacao-campos*.ts`.
- Na ordem original, só os 27 arquivos de UI acima conflitam com a `main`.

#### 3.5.2 Migrations e ordem cronológica

A `main` tem **438 migrations** (439 entradas em `prisma/migrations`, contando o `migration_lock.toml`). As três mais novas são:

```
20260921000000_reconciliar_competencia_spec     (já na base b3e08c6b, veio pela #61)
20260929120000_contato_whatsapp_nome_perfil     (#131, 818ab822)
20260929130000_contato_whatsapp_nome_editado    (#132, d0b3bfb5)
```

As 9 da #62 ficam **entre** `20260921000000` e `20260929120000` na ordem do nome:

| Migration | Recurso | Linhas | Objetos em tabelas existentes |
|---|---|---|---|
| `20260921010000_resolucao_impedimento_segunda_chamada` | Q164 | 61 | tabela e trigger novos |
| `20260921020000_correcao_relato_indisponibilidade_oferta` | Q157 | 214 | redefine `validar_registro_indisponibilidade_oferta_matricula` |
| `20260921030000_aplicacao_adiantamento_aditivo` | Q172 | 304 | redefine `conferir_campos_aplicacao_direta_231`, `q165_delta_reconhecimento_guard_249` |
| `20260921040000_correcao_aula_nao_cobravel` | Q175-1 | 285 | `CreditoMatricula` (+coluna, FK, **recria** `credito_matricula_origem_unica_check`, trigger `BEFORE INSERT`); recria `PropostaRevFinCorrecaoAula_tipo_check` |
| `20260921050000_estorno_consumo_horas_nao_cobravel` | Q175-2 | 253 | redefine `proteger_reserva_horas_compradas`, `q23_foto_financeira_valida_257` |
| `20260921060000_aplicacao_moeda_aditivo` | Q173 | 251 | redefine guardas 231/249 de novo |
| `20260921070000_destinacao_excedente_permuta` | Q171/Q167C | 319 | `CreditoMatricula` (+coluna, FK, **recria de novo** o CHECK de origem única, novo trigger) |
| `20260921080000_uso_saldo_servico_permuta` | Q171 | 136 | `AplicacaoCompensacaoPermuta`: `destinoId`/`decisaoId` `DROP NOT NULL`, +`usoSaldoServicoId`, novo CHECK `…_origem_unica_171` validado sobre as linhas existentes; redefine `validar_aplicacao_permuta_223` |
| `20260921090000_origem_contratual_historica` | origem histórica | 547 | `PropostaAditivoContratual`/`PropostaAgendaAditivoParticular` (FK `conclusao*` opcional + CHECK conclusão XOR origem); redefine 8 guardas `*_117` |

Total: 2.370 linhas de SQL.

**Riscos:**
- **Redefinições de função continuam válidas.** A #62 diz que cada `CREATE OR REPLACE FUNCTION` copia a definição vigente e acrescenta um ramo. Desde a #61 a `main` só ganhou as duas migrations de WhatsApp (dois `ALTER TABLE "ContatoWhatsApp" ADD COLUMN` e um `UPDATE` nessa tabela). Assim, **nenhuma função ou constraint** que a #62 redefine mudou na `main`, e as cópias não desfazem correção posterior. `prisma/schema.prisma` mudou só +3/−1 na `main` desde a #61 (#131, #132).
- **Ordem.** `prisma migrate deploy` aplica toda migration pendente, mesmo com nome anterior ao da última já aplicada. No UAT as 9 seriam aplicadas **depois** das de 29/09, fora da ordem dos nomes. Não há dependência entre elas e as de WhatsApp, então funciona. O efeito colateral é a tabela `_prisma_migrations` ficar com a ordem de aplicação diferente da ordem dos nomes.
- **IDs já usados fora do UAT.** Essas 9 foram aplicadas em banco descartável (perfil `claude`, `erp_genius_test_claude`, segundo o corpo da #62). Pela regra do `AGENTS.md` ("O integrador reserva IDs de migração; não reutilizar migração aplicada"), cabe ao integrador decidir:
  - **(a)** manter os nomes: o UAT nunca as aplicou;
  - **(b)** renomear para IDs reservados depois de `20260929130000`: deixa a ordem cronológica honesta, mas exige recriar os bancos descartáveis que aplicaram os nomes antigos.
- **Dados reais.** O CHECK novo `AplicacaoCompensacaoPermuta_origem_unica_171` e o CHECK recriado `credito_matricula_origem_unica_check` são validados sobre as linhas existentes, sem `NOT VALID`. Os triggers `BEFORE INSERT` novos em `CreditoMatricula` passam a valer para **todo** crédito. A #62 declara "Não executado: … nenhuma aplicação em banco com dados reais", e a dívida assumida inclui "aplicação das migrations em produção (backup + ensaio)". Como a `main` aplica tudo no UAT sozinha (§3.4), **portar já é aplicar em dados reais**.

#### 3.5.3 O que mudou desde então nos mesmos arquivos

- **Servidor e schema:** praticamente nada. Só `academico/regras.ts` (a #92 tipou `rotuloTurmaAcademica`, longe do schema da #62) e `cobrancas/consultas.ts` (a #144 trocou os contadores por `contarIndicadoresFila`; a Q176 se encaixa em `montarReguaPorCobranca`, outro trecho). O merge automático desses dois foi limpo. Atenção: `filtros-fila.ts` (#144) usa o `diasAtraso` vindo de `proximaAcao`, então herda a Q176 sem mudança extra.
- **UI:** muito. Desde a #61 entraram as etapas da auditoria UX (`docs/42`/`docs/43`) com **28 travas** em `src/app/*.test.ts`, que não existiam na base `b3e08c6b`: `botoes`, `campos`, `campos-texto`, `confirmacoes`, `contraste`, `contraste-elementos`, `datas-civis`, `dialogos`, `enums-rotulos`, `estados-vazios`, `feedback-separado`, `formularios-preservados`, `fuso-instante`, `identificacao-registro`, `paginacao-dois-sentidos`, `paleta`, `responsivo`, `rotulos`, `rotulos-dominio`, `status-encontro`, `tipografia`, `vazio-paginado`, `voltar` e outras.
  - As 14 telas novas da #62 caem nas áreas migradas (`src/app/botoes.test.ts:21`, `AREAS_MIGRADAS` inclui `academico`, `financeiro` e `matriculas`).
  - Elas usam `<button>` com classes à mão (13 ocorrências; ex.: `7d281719:src/app/(app)/matriculas/[id]/contrato/EnviarAssinatura.tsx:30`, `className="rounded border px-4 py-2"`) e 52 `<input>`/`<select>`/`<textarea>` sem `Campo`/`CampoFuso`.
  - **Devem reprovar** pelo menos as travas de botões e de campos. Elas precisam ser reescritas no padrão atual (`Botao`/`botaoClasses`, `Campo`, `CampoFuso`, `formatarInstanteExibicao`, mapas `botoes-mapa.ts`/`campos-mapa.ts`).
- **Fuso:** a #159 reestruturou exatamente as telas do `d3109641`, com `CampoFuso` controlado, `fusoInicialDeEntrada`, `AvisoFusoNaoConfigurado` e a trava `fuso-instante.test.ts`. Por isso esse commit não deve ser cherry-picked.

#### 3.5.4 Recomendação (não executada)

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| **PR única** (merge da branch ou cherry-pick dos 21 de uma vez) | Rápida; preserva o histórico | 155 arquivos e 7,5 mil linhas numa revisão; 27 conflitos de UI resolvidos às cegas; UI antiga contra 28 travas; 9 migrations de uma vez no banco real do UAT a cada merge; vai contra o `AGENTS.md` (no máximo 2 funcionalidades em implementação, commit por funcionalidade) | **Não** |
| **Reimplementação total** | UI nasce no padrão atual | Joga fora servidor e SQL já testados e que aplicam limpo | **Não** para o servidor |
| **Cherry-pick por recurso (servidor, schema, migration) + UI reescrita** | O servidor aplica limpo (a `main` não mexeu); a UI segue as travas; migrations em lotes pequenos, com ensaio | Mais PRs; exige ordem | **Sim** |

**Ordem sugerida** (respeita as dependências internas da #62; cada lote é uma PR para a `main`, com o integrador reservando IDs de migração):

1. **Lote 0 (docs):** `docs/planejamento/decisoes-2026-09-21.md` e `q175-desenho-tecnico.md` (de `ec5fd06b`, `b6baf516`, `3c1e23b9`, `ee3a9cf6`), mais a atualização das linhas 101/103–105 do `quadro-entregas.md` e da `docs/04-fase1-dominio.md:35`. Sem risco de deploy.
2. **Lote A (sem migration, só servidor):** `ec5fd06b` (Q176), `d379bbc3` (validadores), `73c8a2a9` + `6cee069e` (Q161), `08ad8462` (Q174, só servidor; o `ValorEstruturadoCampo.tsx` está intocado na `main`). Os três primeiros aplicam limpos; `6cee069e` depende de `73c8a2a9`.
3. **Lote B (Q164):** `2bc19ef7` + migration `…010000`. `ResolverImpedimento.tsx` e `historico/page.tsx` reescritos no padrão atual.
4. **Lote C (Q157):** `c1b70186` + `…020000`. Tela de correção reescrita; o link em `RelatosIndisponibilidadeOferta.tsx` vai sobre a versão da #159.
5. **Lote D (assinatura, sem migration):** `d2cf08f2`, `1583df0a`, `f09201ea`. UI reescrita.
   - O `docker-compose.coolify.yml` não repassa `ASSINATURA_DRIVER`, e `provedor-assinatura.ts:128` recusa o `simulado` em produção. No UAT o port fica inerte, o que atende a regra de não ativar integração externa.
6. **Lote E (cadeia financeira, nesta ordem):** `5fb66ea2` (Q172, `…030000`) → `5f2b7de0` + `85938ed7` (Q175, `…040000`/`…050000`) → `3d6aa061` (Q173, `…060000`) → `5f2354ee` + `4f09181e` (Q171, `…070000`/`…080000`) → `db854944` (origem histórica, `…090000`).
   - É preciso manter a sequência: as migrations recriam em cadeia o mesmo `credito_matricula_origem_unica_check` e as guardas 231/249/117.
   - Telas novas (`acertos-adiantamento`, `acertos-moeda`, `permuta/excedente`, `origem-historica`) reescritas; `aditivos/[propostaId]/page.tsx` e `aditivos/Formularios.tsx` integrados à versão atual.
7. **Lote F (fuso pessoal):** **refazer** o `d3109641` sobre a #159, usando a lista de telas restantes da §3.1.2, item 3. Sem cherry-pick.

**Antes de cada merge com migration:**
- backup do banco do UAT (`docs/31-whatsapp-go-live.md:173-177`);
- `prisma migrate deploy` ensaiado num restore desse dump;
- suíte de **integração completa** num banco descartável do perfil do worktree (o CI não roda integração, `.github/workflows/ci.yml:22-23`);
- depois do deploy, confirmar no painel do Coolify que o `migrate` terminou e o `app` novo subiu (§3.4.1, itens 2–4).

---

## 4. Issues de follow-up

Estado em 13/10/2026. As issues #139–#142 nasceram das PRs que o usuário mandou mergear depois da R3 sem APPROVE (#134, #135, #136 e #138); a #152, da #143; a #162, das #158 e #161.

| Issue | Origem | Estado | Fechada por | Situação real |
|---|---|---|---|---|
| #139 | #134, R3 B1/B2: trava do vazio paginado (montagens de "nesta página" que a trava não via; render da reserva sem normalizar o HTML) | Fechada em 07/10/2026 | #147 (`Closes #139`) | Resolvida. Ficaram limites declarados na própria #147, sem issue: retorno antecipado sem `else`, palavra partida e texto que não nasce de literal |
| #140 | #135, R3 B1–B6 + A16f: trava de botões | Fechada em 07/10/2026 | #148 (`Closes #140`) | Resolvida. Resíduo sem issue: "Anular" e "estorno" sem caso de teste |
| #141 | #136, R3 B9 + R1 B2: trava de `aria-sort` e ordenação com acento no Postgres | **Aberta** | — (a #149, com "Refs #141", fechou só uma parte) | B9 resolvido pela #149; **B2 (collation/ICU) aberto**. Vale para `/alunos`, `/empresas`, `/comissoes` e a aba de comissões do `/financeiro`. Na `main` não há `POSTGRES_INITDB_ARGS`/`--locale-provider=icu` nos compose nem `COLLATE` ICU nas migrations. Depende de decisão do responsável e de ID de migração reservado pelo integrador |
| #142 | #138, R3 B11–B15, C7–C9 e C13: trava de enum cru e checker de tipos | Fechada em 08/10/2026 | #150 (`Closes #142`) | Fechada pela #150, mas os **C7–C9 da R3 da #138 ficaram sem issue**: `MAPA[x]` sem fallback, `rotular` com `string` (o mapa errado compila) e listas de valores à mão em `MAPAS_NOVOS` |
| #152 | #143, R3 B7–B9: trava `guard-pagina` | **Aberta** (desde 07/10, sem comentários) | — | **B7, B8 e B9 abertos**, sem risco nas páginas atuais (as 23 estão corretas); o buraco é só na trava. `src/test/guard-pagina.ts` não mudou desde `851ba76e`, e não há PR para ela |
| #162 | #158 e #161: paginação nos dois sentidos e filas por cursor | **Aberta** (desde 10/10, sem comentários) | — | Os **13 `*.int.test.ts` nunca rodaram**, e o código das duas PRs **já está no UAT**. São 24 consultas (#158) e 11 filas (#161) com `skip`/`take`, `LIMIT`/`OFFSET`, cursor composto e SQL cru, validados só por mock. É a pendência de maior risco |

## 5. Pendências abertas sem issue

Junção, sem duplicatas, das listas "pendências que continuam abertas hoje" dos cinco relatórios da §7. A coluna "Evidência" aponta o estado na `main` `e5418550`. Antes de escrever esta seção, 37 itens foram reconferidos com `git show origin/main:<arquivo>`, `git grep`, `git ls-tree` ou `git log`; a evidência conferida leva ✔. As evidências sem ✔ vêm dos relatórios, que as conferiram na mesma `main`. Um deles teve a linha corrigida: o rótulo de turma em `src/server/alunos/consultas.ts` está na linha 243, não na 241 citada no relatório. Nenhum item deixou de se confirmar.

### 5.1 Operacionais

| # | Pendência | PR de origem | Evidência na `main` |
|---|---|---|---|
| O1 | **A #62 não está publicada**: 21 commits, 9 migrations e 155 arquivos só em `codex/consolidacao-specs-20260916`. Recurso por recurso e recomendação de porte na §3.1 e na §3.5 | #62 | ✔ `src/server/_shared/validacao.ts:137-142` (só `cpf`, com o TODO dos demais); `src/server/cobrancas/regua.ts:79`; `src/server/contratos/aditivo-coerencia.ts:18-20`; 0 dos 23 modelos novos em `prisma/schema.prisma` |
| O2 | **Redeploy da #127 não confirmado**: falta ver o container `healthy`, o `migrate` com saída 0 e `/api/ready` com 200, e rodar o `tsc` no ambiente do integrador | #127 | ✔ `docs/planejamento/quadro-entregas.md:1296` ("aguardando o redeploy no Coolify. Não concluído") |
| O3 | **Script de reparo dos nomes de contato não rodado no UAT**: rodar em modo leitura, depois com `--aplicar`, e renomear os leads que ficaram com o nome da linha | #131, #132 | ✔ `scripts/reparar-nome-contato-whatsapp.ts` existe; ✔ `quadro-entregas.md:1343` e `:1384` ("Não concluído"); ✔ a migration `prisma/migrations/20260929120000_contato_whatsapp_nome_perfil/migration.sql:9` (`UPDATE "ContatoWhatsApp"`) já foi aplicada pelo deploy |
| O4 | **Testes de integração nunca rodados, além dos 13 da #162**: `src/app/api/exportacoes/[tipo]/route.int.test.ts` (expectativas alteradas 3 vezes); `linha-comercial.int.test.ts` (438 linhas, novo), `acesso-atendimento` e `destinatario-atual`; os `int` da #130 e da #151 | #92, #93, #95, #128, #130, #151 | ✔ `vitest.config.ts:12` exclui `src/**/*.int.test.ts`; ✔ `.github/workflows/ci.yml` só roda `npm test` ("sem *.int.test.ts") |
| O5 | **Integrações cujas consultas mudaram e não rodaram**: `inbox.int`, `acesso-atendimento.int`, `linha-comercial.int`, `financeiro-matricula.int`, `diario.int`, `correcao-aula.int` e `visibilidade.int` | #102, #104 | idem O4; a #162 cobre só a #158 e a #161 |
| O6 | **Integrações do WhatsApp em perfil isolado**, pedidas no quadro para a fase da inbox | #131, #132 | ✔ `quadro-entregas.md:1343` ("migração, TypeScript, integrações") |
| O7 | **WhatsApp real**: confirmar o campo `remoteJidAlt`/`senderPn` na Evolution 2.3.7; as linhas já conectadas precisam de novo QR e novo vínculo do aparelho para o histórico chegar | #128 | depende do ambiente real; o cabeçalho da SPEC-ERP-005 ainda diz "sem execução" |
| O8 | **Trilha de exportação antiga**: eventos `DadosExportados` anteriores a 25/09 seguem com o texto da busca (possível dado pessoal). Não declarado na PR | #119 | dado no banco; não conferido, porque o UAT não foi aberto |
| O9 | **Branches órfãs no remoto**: `claude/pr1-bordas-de-rota` (contém o merge `ebcd5e01` da #65) e `claude/pr2-brand-solid-shell`. Apagar ou não é decisão do dono | #65 | `git branch -r --no-merged origin/main` (§3.3) |

### 5.2 Revisão

Nenhuma das 94 PRs tem APPROVE formal no GitHub (§6.2). Abaixo, as que entraram **sem APPROVE escrito sobre o head mergeado**, com a lista exata. Detalhe de cada uma na §7.

| # | Situação | PRs | Quantidade |
|---|---|---|---|
| V1 | Sem revisão nenhuma: nem review no GitHub, nem rodada reconstruível pelos commits | #63, #65, #67, #88 | 4 |
| V2 | **Com migration e sem revisão nenhuma.** A da #131 tem `UPDATE` de dados; a #132 não menciona a migration no corpo e quebrou a `main` (consertada pela #133). As duas já foram aplicadas no UAT. **Revisar as duas migrations** | #131, #132 | 2 |
| V3 | Revisão fora do GitHub, sem veredito registrado (só commits "Resposta ao review…" ou o comentário "Revisão atendida em…") | #64, #66, #68, #69, #70, #71, #72, #73, #74, #75, #76, #77, #78, #83, #84, #85, #86, #87, #89, #90, #91 | 21 |
| V4 | Último veredito em REQUEST CHANGES, ou correção final sem nova revisão, sem issue nem regra que autorize | #93, #112, #117, #120, #121, #122, #126, #127, #128, #129 | 10 |
| V5 | Mergeadas antes ou durante a revisão (Coolify); as pendências B1–B4 foram fechadas pelas #124, #125 e #133 | #123, #124, #125 | 3 |
| V6 | Mergeadas depois da R3 por decisão do usuário, com issue de follow-up | #134, #135, #136, #138 (issues #139–#142), #143 (issue #152) | 5 |
| V7 | Mergeadas pela regra pós-R3 (§6.4) | #144, #145, #147, #148, #149, #153 | 6 |
| V8 | Sem R3, sem APPROVE e sem nota de merge | #150 | 1 |
| | **Total sem APPROVE escrito no head** | | **52** |

Além dessas, entraram com APPROVE escrito, mas com um commit ou merge pequeno depois do APPROVE e sem nova rodada: #100, #101, #108, #109 e #115. A #102 foi mergeada antes de a R2 terminar; a R2 confirmou depois.

### 5.3 Código

| # | Pendência | PR de origem | Evidência na `main` |
|---|---|---|---|
| C1 | Rotas fora do shell sem `error.tsx`/`loading.tsx`: `/`, `/login`, `/pagar/[token]`, `/certificado/[codigo]` e `/portal` | #64 | ✔ `git ls-tree origin/main src/app`: `error.tsx` só em `(app)` e `portal-aluno`, mais `global-error.tsx` na raiz |
| C2 | Esqueletos próprios ausentes em `/matriculas/[id]`, `/academico`, `/diario`, `/secretaria` e `/configuracao`; `<Suspense>` = 0 em `src` | #64, #81 | ✔ os `loading.tsx` existem só em `(app)`, `alunos/(lista)`, `financeiro/(painel)`, `financeiro/continuidade`, `inbox`, `leads/(lista)`, `pipeline`, `segundas-chamadas/minhas` e `portal-aluno` |
| C3 | Esqueleto duplicado no `/financeiro`: o `loading.tsx` desenha título e abas dentro de um layout que já os desenha (por leitura de código, não visto rodando) | #81 × #109 | `src/app/(app)/financeiro/(painel)/loading.tsx` e `(painel)/layout.tsx` |
| C4 | `/portal` legado: usuário só-portal é redirecionado sem explicação do acesso (L2593 parcial) | #64 | ✔ `src/server/_shared/sessao.ts:153` |
| C5 | `parseMoeda("1.23")` aceita 1,23, contrariando o corpo da #68, que dava o "resíduo de 2 dígitos" como fechado | #68 | ✔ `src/lib/dinheiro.ts:99-103` |
| C6 | Arredondamento silencioso no blur em moeda sem centavos (CRC/CLP): `100,50` vira `101` | #68 | ✔ `src/lib/dinheiro.ts:114-117` (`toFixed(casas)`), chamado por `src/components/CampoMoeda.tsx:54` |
| C7 | Sem fuso da escola, a entrada da avaliação continua em UTC (hoje anunciado na tela) | #69 | ✔ `src/app/(app)/academico/avaliacoes/[alocacaoId]/[codigo]/page.tsx:22` (aviso em `:25-27`) |
| C8 | Prorrogação sem `min` igual ao prazo vigente (L1566 parcial) | #78 | ✔ `src/app/(app)/academico/recuperacoes/planos/[propostaId]/prorrogacoes/Formularios.tsx:24` |
| C9 | Designação de 2ª chamada sem `max` = agora no início | #78 | `src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/designacao/Formulario.tsx:55` |
| C10 | Mensagem avulsa de resultado incerto, fora das constantes e fora da trava (não está num `catch`); `SegundaChamadaPainel` usa `_SEM_CHAVE` para todas as ações | #77, #118 | ✔ `src/app/(app)/secretaria/reservas/ConferirReserva.tsx:18`; `SegundaChamadaPainel.tsx:49-51` |
| C11 | Leituras extras de `permissoes` (o padrão que a #73 eliminou); `UsuarioSessao.permissoes?` opcional; `podeConfigurarComissoes` relê o usuário | #73, #88 | `alunos/[id]/financeiro/page.tsx:40`, `alunos/[id]/movimentacoes/page.tsx:47`, `financeiro/permuta/page.tsx:15`; `src/server/_shared/sessao.ts:18`; ✔ `src/server/financeiro/consultas.ts:242` |
| C12 | Sem chave de idempotência no servidor: `criarMatricula` e os painéis de catálogo e WhatsApp seguem `idempotente: false` | #85, #86, #87 | ✔ `src/server/matricula/acoes.ts:622`; ✔ `MatriculaFormulario.tsx:167`; `IdiomasPainel.tsx:27`, `PrecosPainel.tsx:48`, `TemplatesPainel.tsx:54` |
| C13 | Países: a edição descarta o `id` dos tipos de documento; renomear um tipo em uso é recusado | #86 | ✔ `src/app/(app)/configuracao/paises/PaisesPainel.tsx:160-163` (só `nome` e `validador`) |
| C14 | `Modal` sem portal, sem `inert` no `<main>` e sem bottom-sheet abaixo de `sm` | #89 | `src/components/Modal.tsx` (`fixed inset-0` no lugar) |
| C15 | Testes de interação sem DOM: sem jsdom nem `@testing-library`; o `onChange` da busca e os modificadores de `useFiltrosUrl` seguem sem teste | #92, #95, #98, #101 | ✔ `vitest.config.ts:10` (`environment: "node"`); `src/test/tela-sem-dom.ts` cobre parte |
| C16 | `listarAlunos` carrega todas as cobranças; a exportação chama duas vezes, sem paginação | #92 | ✔ `src/server/alunos/consultas.ts:226-229`; `src/app/api/exportacoes/[tipo]/route.ts:60` e `:78` |
| C17 | Rótulo de turma ambíguo na célula e na planilha de alunos (o filtro já usa `rotuloTurmaAcademica`) | #92 | ✔ `src/server/alunos/consultas.ts:243` (o relatório citava `:241`) |
| C18 | Sem índice `pg_trgm` para a busca `contains` de alunos, leads e empresas; mitigado pelo teto de 6 palavras (#107) | #92 | ✔ `git grep pg_trgm` em `prisma` e `src`: nenhuma ocorrência |
| C19 | `rotular` sem telemetria fora de `development` | #93 | ✔ `src/lib/labels.ts:80` |
| C20 | `acordo.moeda` nulo na permuta formatado com moeda vazia | #93 | ✔ `src/app/(app)/financeiro/permuta/PermutaOperacional.tsx:138-155` |
| C21 | `ThemeToggle` com estado duplicado entre Sidebar e `BarraMobile` (cosmético); "Alternar tema" sem `aria-pressed` | #94, #135 | `src/components/Sidebar.tsx:40-50`; ✔ `Sidebar.tsx:59` |
| C22 | Mapa da trilha incompleto: 60 das 181 páginas fora de `ROTULOS_TRILHA`, inclusive `…/aditivos/*/alcadas` e as 5 de `tentativas/*` | #99 | `src/lib/trilha.ts:136-137` |
| C23 | Rótulo de volta errado em `tentativas/*/autorizacao` (L1617); 49 `VoltarPara … para=` sem trava para href dinâmico | #110 | `…/tentativas/[itemReservaId]/autorizacao/page.tsx:29` |
| C24 | Inbox: teto de 500 não lidas fora da janela sem aviso; `limitada` só olha as 200; thread cortada em 300 mensagens (L2299) | #102 | ✔ `src/server/whatsapp/busca-inbox.ts:11`; `src/server/whatsapp/consultas-inbox.ts:87` |
| C25 | Histórico do diário só para trás (exceção pendente na trava da #158, não resolvida pela #161); "nesta página" com cursor inválido; sem contador "N de M" | #104 | `src/app/paginacao-dois-sentidos.test.ts:603,629`; `diario/page.tsx:24`; `vazio-paginado-mapa.ts:19` |
| C26 | `Botao` sem estado de carregamento nem tamanho de ícone; por isso os botões só de ícone seguem isentos da trava | #105 | ✔ `src/components/Botao.tsx` (0 ocorrências de `aria-busy`); `botoes.test.ts:58` |
| C27 | Título de aba só em 4 registros (`alunos`, `leads`, `empresas`, `matriculas`); allow-list de papéis duplicada do guard das fichas | #106 | `src/server/titulos-registro.ts:27,36` |
| C28 | Sem trava de `type="button"`; painéis do WhatsApp com botão à mão, sem `<Botao>` | #108 | `NumerosPainel.tsx:82,119,237,306` |
| C29 | "Revogar" cobertura em um clique, sem `ConfirmarAcao` (L2244); `/carteiras` fora de `confirmacoes-mapa.ts` | #117 | ✔ `src/app/(app)/carteiras/CoberturasPainel.tsx:36` |
| C30 | Assistente de matrícula: "Salvar matrícula" é `secundario/lg` e "Próximo" é `primario/lg`; o mapa congela isso | #116 | `MatriculaFormulario.tsx:790-795`; `botoes-mapa.ts:875` |
| C31 | `<Link>` com `p-N` fora do detector de botões (hoje sem caso real) | #116 | `src/app/botoes.test.ts:200` |
| C32 | WhatsApp: indicador de pendência e aviso ao sair só em `TemplatesPainel`; números, política, avisos, comercial e régua sem (L2519) | #100 | `TemplatesPainel.tsx` é o único com `aviso-ao-sair` |
| C33 | Cosméticos: `/comissoes` redireciona depois da consulta; `tamanho` implícito no "Revisar"; "limpar filtro" `fantasma/sm` dentro de `<p>` (não verificado no celular) | #103, #113, #117 | `comissoes/page.tsx:26-28`; `ConferenciaRegraHistorica.tsx:80` |
| C34 | `ConfirmarAcao`, fatia B: encerrar país, "Faltou" no check-in, inbox (vincular contato e opt-out), replanejamento, quantidade de aulas, presença histórica, desativar usuário, preço ou idioma, inativar empresa | #154 | ✔ `git grep ConfirmarAcao`: só as 10 telas da fatia A |
| C35 | `enviarLote` sem `try/catch`: falha de transporte deixa `enviandoLote` preso em `true` | #154 (C2 da R3, anterior à PR) | ✔ `src/app/(app)/financeiro/FilaCobranca.tsx:236-241` |
| C36 | Link morto para `/financeiro` na emissão, sem `abreFinanceiro` (o mesmo beco que a #160 fechou em `entrada-particular`) | #160 | ✔ `src/app/(app)/matriculas/[id]/emissao/page.tsx:23` |
| C37 | Paginação: 26 telas (27 links) de versões e históricos ainda só para frente; L431 (filtro de situação nos envios do portal) e L1709 (busca e data nas agendas de 2ª chamada) abertos | #158 | ✔ `src/app/paginacao-dois-sentidos.test.ts:603` (constante `PENDENCIA` e 27 usos) |
| C38 | Âncora sem escopo na fila de agenda de 2ª chamada (C1 da #161); inofensivo enquanto a fila for administrativa | #161 | `segunda-chamada-fila-agenda.ts` |
| C39 | Não perder o digitado: 22 exceções (17 `VERSAO_PENDENTE`, keys com versão); L1059 (diálogo na navegação interna) e L2367 (rascunho em `localStorage`) | #155 | `src/app/formularios-preservados.test.ts` |
| C40 | Identificação: 66 ids crus e 12 telas de detalhe sem identificação, com teto na trava; L934 e a data nos impactos de correção | #160 | `src/app/identificacao-registro.test.ts:378` e `:421` |
| C41 | Fuso: L1566, L1747, L406 e L1256; `fusoIanaValido` recusa `EST5EDT`, que o `Intl` pode oferecer; ramo `fuso === ""` morto no `.refine` do `PaisSchema`; a validade não roda no valor inicial | #159 | ✔ `src/server/operacao/fuso.ts:9`; `src/server/paises/schema.ts:29` |
| C42 | `Campo` único em só 2 telas; a maior parte dos `required` segue sem `aria-invalid` ligado; justificativa sem tabela de preço validada só no servidor | #145 | `FichaAluno.tsx` e `MatriculaFormulario.tsx` são os únicos usuários |
| C43 | Fila de cobrança sem `take`; falta busca por aluno em `/comissoes` | #144 | ✔ `src/server/cobrancas/consultas.ts:202` (`findMany` sem limite em `:212`) |
| C44 | Contraste: `--border` e `--brand-border` reprovam (1,25–1,56:1, decorativos); a família `#fff/--brand` continua contada por token | #156 | `src/app/globals.css:84`; doc 43 §7.1 |
| C45 | Abas de área: 14 de 16 quebram em várias linhas a 375 px; `ariaLabel` padrão "Sub-navegação"; `matriculas/[id]/secoes.test.ts` lê o guard por regex textual | #143 | `src/components/SubTabs.tsx:21` (`flex-wrap`) |
| C46 | CI: sem `--max-warnings`; `no-explicit-any` desligada em todos os testes; `testTimeout` global de 30 s; `TypeError` em vez de `ErroRegra` em `aditivo-cobertura` | #151 | ✔ `.github/workflows/ci.yml:61` (`npx eslint .`); ✔ `vitest.config.ts:15`; ✔ `src/server/contratos/aditivo-cobertura.ts:84` (`.find(...)!.fotografiaHash`) |
| C47 | Infra: `docker build` fora do CI; digest de imagem fixado exige atualização manual; `coolify-db-init.test.ts` trava só as chaves do serviço, não `image` nem `depends_on` | #127, #133 | `coolify-db-init.test.ts:94` |
| C48 | Travas de enum: C7, C8 e C9 (ver #142 na §4); `ETAPA_LABEL` em Title Case (A12 do doc 42); fornecedor CLICKSIGN/ZAPSIGN cru (L718); `o.resultado`; badges `{label, cls}` | #138, #150 | `src/lib/labels.ts:84-95` |
| C49 | a11y da #135: wizard sem `aria-current="step"`; chip de temperatura com `disabled` em vez de `aria-disabled` | #135 | `InboxCliente.tsx:1087-1088` |
| C50 | Ordenação: `/empresas` sem caminho de volta à ordem padrão (C1); `PADRAO` solto (C4); `/comissoes` sem a coluna "Previsão de pagamento" (L2259) | #136 | `ordem-comissoes.ts:14` |
| C51 | Trava de anúncio aceita qualquer `role=` (até `presentation`); o detector de "resultado incerto" não resolve texto em variável ou template | #133 | `anuncios.test.ts:33` |
| C52 | `datas-civis.test.ts` não trata `toLocaleDateString` sobre campo civil; candidatos que podem mostrar o dia anterior em UTC−3 (não verificado); `pool: "forks"` não fixado | #137 | `TurmasPainel.tsx:195-196`, `FichaEmpresa.tsx:190`, `PagarCliente.tsx:53`; `vitest.config.ts` |
| C53 | `EstadoVazio`: uma exceção exata somada à edição do manifesto engole um `<p>` cru (B2); piso `USOS_DA_MIGRACAO_E1 = 219` constante solta (C6) | #126 | `EstadoVazio.test.ts:107` |
| C54 | Limites declarados de travas: `paleta.test.ts` (comentário que cita classe, `bg-[red]`, `src/server` fora); `tipografia.test.ts` (`legend`/`caption`); `mensagens.test.ts` (só `catch`); #147 (retorno antecipado sem `else`, palavra partida, texto que não nasce de literal); #148 ("Anular" e "estorno" sem caso); #149 (parâmetro reatribuído, alias de objeto); #153 (`useReducer`, texto fora dos prefixos) | #77, #79, #80, #147, #148, #149, #153 | arquivos de trava em `src/app/*.test.ts` e `src/lib/mensagens.test.ts` |
| C55 | Achados do doc 43 ligados à faixa #81–#98 que seguem parciais ou abertos: L224/L225 (importação sem download das rejeitadas, "Importar" habilitado), L471 (placeholder como único rótulo), L703 (Alçadas sem versão e PDF), L1184 (sem `<label>` visível nem `fieldset`), L2187 (leads sem ordenação por coluna), L2430 (países sem estado otimista), L2712 (botão de preferências) | faixa #81–#98 (§7.2) | doc 43 §7.2 e §7.3 |

### 5.4 Documentação

| # | Pendência | PR de origem | Evidência na `main` |
|---|---|---|---|
| D1 | **O quadro de entregas não foi atualizado desde a #132.** Nenhuma PR da auditoria de UX registrou entrega; três entradas seguem "Não concluído" | #63–#161 (exceto #127, #128, #131 e #132) | ✔ último commit no arquivo: `f40065ce`, 29/09/2026 ("correções da revisão da #132"); ✔ `quadro-entregas.md:1296`, `:1343`, `:1384` |
| D2 | **Linhas do quadro e de outros docs atrasadas nas decisões de 21/09**, implementadas na #62 e não publicadas. O registro `decisoes-2026-09-21.md` só existe na branch | #62 | ✔ `quadro-entregas.md:101` (Q176), `:103` (Q167/Q171), `:104` (Q172–Q174), `:105` (Q164), `:1053`, `:1056`; `docs/41-situacao-consolidada-do-projeto.md:24`; `docs/planejamento/auditoria-609-alcance.md:48`; `docs/planejamento/fornecedor-assinatura-q155.md:24` |
| D3 | **`docs/04-fase1-dominio.md:35` diz que os validadores "já vêm prontos", e eles não existem**: só `cpf` está implementado | anterior à #62 (a #62 resolveria) | ✔ `docs/04-fase1-dominio.md:35`; ✔ `src/server/_shared/validacao.ts:139` (TODO de `cedula_cr`, `curp`, `dni_ar`, `dui_sv`, `passaporte`) |
| D4 | `docs/18` diz que `--ai-solid` "não inverte — mesma lógica de `--brand-solid`", mas `--brand-solid` passou a ter um valor por tema | #66, #157 | ✔ `docs/18-design-system.md:67`; `src/app/globals.css:42` e `:94` |
| D5 | O doc 43 de 07/10 listava como abertos os itens 1–7 da §6, já tratados nas #153–#161; faltavam a métrica 7.7 (fluxo com operador) e a nova amostra | #146 | remedição de 13/10 no doc 43 §7; a 7.7 depende de um operador real |
| D6 | Cabeçalho da SPEC-ERP-005 ainda diz "sem execução" | #128 | ver §7.4, PR #128 |

## 6. Padrões de processo

### 6.1 O CI só nasceu na #151, em 07/10

- O primeiro workflow do repositório entrou com a #151 (`c3685565`, 07/10/2026). Até a #150, toda revisão registra "0 check runs", e todo número de `tsc` ou `vitest` é local, declarado por autor, revisor ou integrador.
- Hoje o CI roda `typecheck`, `lint` e `npm test` em dois fusos (UTC e America/Sao_Paulo). **Não roda `*.int.test.ts`** (`vitest.config.ts:12`) e **não faz deploy**.
- O deploy do Coolify **não espera o CI**: o webhook dispara no push com qualquer resultado (§3.4).

### 6.2 Autor e revisor são a mesma conta

- O GitHub recusa APPROVE e REQUEST_CHANGES na própria PR (erro 422). Por isso **todo APPROVE aparece como COMMENT**, o `reviewDecision` fica vazio e o veredito vale pelo texto ("Veredito (Rn): …").
- O GitHub não distingue o autor, o revisor, o integrador e o dono do produto: os merges são todos da conta `diogenesmendes01`. Quando uma PR entra com RC, não há como saber pelo GitHub se foi decisão do usuário (ex.: #117).
- Em parte das PRs a revisão nem ficou no GitHub: de #64 a #78 as rodadas só aparecem nos commits ("Resposta ao review da PR 68"); de #83 a #91 só existe o comentário do autor "Revisão atendida em…". As reviews da #79 e da #80 se identificam como automatizadas ("Cursor GitHub", "Grok Bot").

### 6.3 Merges sem APPROVE, por faixa

| Faixa | PRs | Com APPROVE escrito no head | Sem APPROVE escrito no head | Quais entraram sem |
|---|---|---|---|---|
| #63–#80 | 18 | 2 (#79, #80, "APPROVE in substance") | 16 | todas as outras: #63, #65 e #67 sem rodada; as demais com rodadas só nos commits |
| #81–#98 | 18 | 8 | 10 | #83–#91 (revisão fora do GitHub; a #88 sem revisão) e #93 (RC na R3, fix sem nova revisão) |
| #99–#117 | 19 | 17 | 2 | #112 (R1 aprovou com classificação errada; a R2, que bloqueava, chegou depois do merge) e #117 (RC, mergeada sem R5) |
| #118–#138 | 21 | 5 (#118, #119, #130, #133, #137) | 16 | #120–#129, #131, #132 (sem revisão), #134, #135, #136, #138 |
| #143–#161 | 18 | 10 (#146, #151, #154–#161) | 8 | #143, #144, #145, #147, #148, #149, #150, #153 |
| **Total** | **94** | **42** | **52** | lista por motivo na §5.2 |

Merges muito rápidos depois da última rodada também se repetem: a #76 entrou 31 s depois do commit de revisão; a #77 levou 9 min do início ao merge e a #78, 10 min; na 3ª leva, a #156 levou 8 min, a #157 11 min, a #159 14 min (78 arquivos) e a #161 14 min (61 arquivos e 11 consultas).

### 6.4 A regra pós-R3, aprovada pelo usuário

- **Antes da regra:** régua "estrita" confirmada em 25/09 (qualquer mutação que sobreviva à trava prometida é BLOCKER), com limite de 3 rodadas automáticas; R4 só a pedido do responsável (#120, #136, #138). Nas #134, #135, #136 e #138 o usuário decidiu mergear depois da R3 e mandou abrir as issues #139–#142; na #143, a issue #152.
- **A regra**, citada nos comentários de merge: "blocker só de teste, com conserto especificado, aplica, verifica e mergeia". O integrador aplica ou verifica a correção especificada pelo revisor e exige CI verde. Foi usada nas #144, #145, #147, #148 e #149, e também na #153.
- As quatro PRs de follow-up (#147–#150) entraram depois de REQUEST CHANGES; a #150 sem R3 e sem nota de merge.

### 6.5 O modo leve de revisão, desde a R3 da #154

- Da #143 à #153: três rodadas com dezenas de mutações e evasões por rodada; qualquer mutação não equivalente que sobrevivesse era blocker.
- A partir da R3 da #154: "modo leve" — CI verde, leitura do diff e do fluxo, sem mutação do revisor. Evasões de trava deixam de bloquear ("No modo atual isso não bloqueia"), e o APPROVE passa a sair na R1 ou na R2 (#155–#161).
- As mutações ficaram só com o integrador: de 11 a 21 por PR, todas KILLED.

### 6.6 Dez heads quebrados, corrigidos pelo integrador (#143–#161)

O autor não roda testes (worktree sem `node_modules`, pela regra do `AGENTS.md`). O integrador achou o head entregue quebrado em 10 PRs:

| PR | O que estava quebrado |
|---|---|
| #145 | 8 erros de lint; validações sem teste |
| #147 | `tsc` com 2 erros na R1 e 4 na R2 |
| #148 | 2 testes falhando |
| #150 | 1 teste falhando (3 achados do checker) |
| #153 | 10 testes falhando |
| #154 | 3 testes falhando |
| #155 | `tsc` com 2 erros e 3 testes falhando |
| #158 | `tsc` com 1 erro e 1 teste falhando |
| #159 | 5 testes falhando (um teste unitário ia ao banco) |
| #160 | 1 teste falhando |

Em todos os casos o integrador corrigiu antes do merge, e o merge saiu com `tsc` 0 e suíte verde. Depois da #159 o integrador passou a rodar a suíte local sem banco configurado, para pegar teste unitário que toca o banco antes do CI.

### 6.7 O quadro de entregas não foi atualizado pelas PRs

- O `AGENTS.md` pede "commit por funcionalidade, com evidências e pendências no quadro único". Das 94 PRs, só as #127, #128, #131 e #132 registraram entrega em `docs/planejamento/quadro-entregas.md`, e as três de infraestrutura e WhatsApp ainda estão "Não concluído".
- O último commit no quadro é `f40065ce`, de 29/09. Várias PRs da 3ª leva dizem "fica para o integrador". As evidências e pendências ficaram só nos corpos e comentários das PRs.
- Outra regra do `AGENTS.md` foi quebrada no começo da série: as #64–#67 foram verificadas com `npx` e com o servidor de dev ligado ao banco de produção, só leitura. A #68 admitiu isso; da #68 em diante os comandos passam por `node_modules/.bin`.

### 6.8 Corpos de PR divergentes do diff

Exemplos (o detalhe está em cada PR na §7):

| PR | O corpo diz | O diff ou o código mostra |
|---|---|---|
| #65 | `--brand` escuro passa de "4,47:1 → ≥4,5:1 contra branco" | dá 4,06:1, como reconheceu o commit `23f58e6c` da #66 |
| #66 | "`bg-brand-600` mantido como está (opção a)" | 70 ocorrências promovidas a `bg-brand-solid` em 62 arquivos; corpo nunca atualizado depois das rodadas |
| #68 | "Empilhada sobre a PR #67 (ainda aberta)"; resíduo "1.23" fechado | base `main`, #67 já mergeada; `parseMoeda("1.23")` continua aceitando 1,23 |
| #73 | `react` 18.3.1 não exporta `cache` e "teria quebrado em produção" | o App Router usa o React embutido no Next, que exporta `cache`; corrigido na #91 |
| #83 | "11 avisos com região polite" (título) | a PR migrou 110 avisos; o corpo foi atualizado, o título não |
| #99 | exemplo de trilha em `…/aditivos/…/alcadas` | `alcadas` não está no mapa: a trilha para num link, sem `aria-current` |
| #117 | "todo o painel `(app)` fica sob a trava", com 22 telas | o merge final tem 45 arquivos e mexe em áreas antigas |
| #121 | 266 campos migrados; "os 53 sem `minLength` ficam como estão" | os 53 também migraram (≥ 319 usos) e a trava mudou duas vezes de desenho |
| #131 | "A migração não foi aplicada em nenhum banco" | o merge na `main` a aplica no UAT automaticamente |
| #132 | não menciona a coluna `nomeEditadoEm` nem a migration `20260929130000_contato_whatsapp_nome_editado` | as duas estão no diff |
| #151 | descreve partes da versão antiga do workflow (C11 da R3) | `cancel-in-progress`, "os runners rodam em UTC", `test` sem `typegen`, mudança em `aditivo-cobertura` revertida |
| #158 | "Achados que fecha" cita "#419", "#924", "#1469"… | são linhas do doc 42; o GitHub transforma em links para outras PRs e issues |

## 7. Análise por PR

Conteúdo integral dos cinco relatórios de análise, com os títulos descidos de nível. Cada subseção tem seus próprios achados gerais, a análise PR a PR (identificação, objetivo, rastreabilidade, revisão, testes, pendências, publicação e riscos), a tabela-resumo da faixa e a lista de pendências abertas conferida na `main` `e5418550`. As referências "§0…" dentro de cada subseção apontam para os achados gerais da própria faixa.

### 7.1 PRs #63–#80

- **Data da análise:** 13/10/2026.
- **Referência:** `origin/main` = `e5418550` (conferido depois de `git fetch --all`). O worktree da análise está nesse mesmo commit, então as citações `arquivo:linha` sem outra indicação valem para a `main` atual.
- **Fontes:** `gh pr view N --json …` (corpo, commits, reviews, comentários e arquivos), `gh pr diff N --name-only`, `gh api …/pulls/N/comments` (comentários inline), `git merge-base --is-ancestor`, `docs/42-auditoria-frontend-ux.md` ("doc 42") e `docs/43-medicao-auditoria-ux.md` ("doc 43").
- **Convenções:** "L…" é a linha do achado no doc 42, a mesma notação do doc 43. "G n" é o ganho rápido n da seção 3 do doc 42: o G1 está na L33 e o G24 na L56, ou seja, Gn fica na L(32+n). "Rk n" é a posição n do ranking da seção 2 (Rk1 na L18 … Rk10 na L27). Horários em UTC.

#### 0. Achados gerais da faixa (leia antes)

1. **As 18 são PRs, nenhuma é issue.** Todas estão `MERGED` e todas foram mergeadas por `diogenesmendes01`. Quinze entram na série da auditoria UX: #64–#80, com exceção da #63, que é o próprio doc 42. **Não há na faixa PR de WhatsApp, infraestrutura ou SPEC.** A única que toca a inbox é a #74, e ela é UX.
2. **A #65 não está na `main`.** Ela foi mergeada na branch `claude/pr1-bordas-de-rota` às 16:20:22, 11 s depois de a #64 ser mergeada na `main` (16:20:11).
   - `git merge-base --is-ancestor ebcd5e01 origin/main` devolve **1, não é ancestral**. O commit `4122e644` também não é.
   - A branch remota `origin/claude/pr1-bordas-de-rota` continua apontando para `ebcd5e01`, e `claude/pr2-brand-solid-shell` aponta para `4122e644`. São branches órfãs que sobraram.
   - O conteúdo chegou à `main` pela **#66**. O commit `373dc1de` é um cherry-pick com árvore idêntica: `git diff 4122e644 373dc1de` sai vazio.
3. **Quase não há revisão registrada no GitHub.**
   - 16 das 18 PRs não têm nenhuma review, nenhum comentário de issue e nenhum comentário inline.
   - Só a #79 e a #80 têm reviews no GitHub: duas rodadas cada, com evento `COMMENTED` e veredito "APPROVE in substance". O APPROVE formal falha com 422 porque o revisor autenticado é o próprio autor.
   - `reviewDecision` está vazio nas 18. **Nenhuma entrou com APPROVE formal.**
   - Nas outras PRs, as "rodadas" só aparecem nos commits ("Resposta ao review da PR 68", "Pontos da revisão da PR #71"). Ou seja, a revisão aconteceu fora do GitHub, na sessão do agente.
   - Abaixo, cada rodada é reconstruída pelos commits e chamada de R1, R2…, com a ressalva de que **não existe registro verificável do veredito**.
4. **Não houve integrador nem CI.**
   - Não há comentário de verificação de integrador (tsc, suíte, mutação) em nenhuma PR. Todos os números de teste vêm de auto-relato no corpo ou no commit.
   - O workflow `.github/workflows/ci.yml` só nasceu em 07/10 (`a08da204`), depois de toda a faixa. As reviews R1 da #79 e da #80 registram "0 check runs" no head.
5. **Processo e AGENTS.md** (regra aprovada em 16/09, anterior à faixa):
   - O corpo da #68 admite que as PRs anteriores (#64–#67) rodaram `npx` e usaram o banco de **produção** para verificação visual, só leitura: "Navegador: `getComputedStyle`…". Isso viola duas regras do AGENTS.md: "Agentes não executam … npx" e "Nunca usar banco de produção".
   - Da #68 em diante, os comandos rodam por `node_modules/.bin/*` e não há verificação em navegador.
   - Nenhuma PR atualizou o quadro único `docs/planejamento/quadro-entregas.md`. `grep` por `#6x/#7x/docs/42` em `docs/planejamento` não encontra nada.
   - Os merges foram muito rápidos depois da última rodada: #76 abriu às 17:54, recebeu o commit de revisão às 18:05:10 e foi mergeada às 18:05:41; #77 levou 9 min do início ao merge; #78, 10 min.
6. **Nenhuma PR da faixa mexe em `prisma/`, migration ou `*.int.test.ts`** (`gh pr diff --name-only` em todas).
   - Cinco tocam `src/server`: #64 (`portal-aluno/sessao.ts`), #68 (`comercial/schema.ts`), #69 (`operacao/consultas.ts`), #73 (`_shared/sessao.ts`) e #74 (`whatsapp/consultas-inbox.ts`). As outras só mexem em front, CSS, testes ou documentos.
   - Tudo o que está na `main` foi para o UAT. **A #65 é a única que não foi**, e a #63 só tem documento.
7. **Issues abertas por causa destas PRs: nenhuma.** Nenhuma issue do repositório cita #63–#80. As issues #139–#162 são follow-ups de PRs posteriores, e #1–#25 são de junho. Os follow-ups foram resolvidos por **PRs** posteriores: #81–#84, #91, #94, #102, #118, #154, #156, #157 e #159, detalhadas por PR abaixo.
8. **Atribuições erradas no doc 43** (achadas ao cruzar com os diffs):
   - A regra global de `focus-visible` aparece como "✅ (#71)" (doc 43:141). Ela veio da #65/#66 (`373dc1de`) e foi consertada em `23f58e6c`. A #71 nem toca `globals.css`.
   - `--border-control` é chamado de "token novo da #71" (doc 43:145). Ele é da #65/#66.
   - A "trava `responsivo.test.ts`" aparece junto da #75 (doc 43:156). O arquivo nasceu na #94.

---

#### PR #63 — docs: auditoria de UI/UX do frontend (178 rotas)

1. **Identificação**
   - Aberta em 22/09 15:45 e mergeada em 22/09 16:25:50.
   - Base `main`, head `claude/frontend-ui-ux-analysis-490332`. Merge `9bd583d2`, commit único `c8a27bd6`.
   - Tamanho: 1 arquivo, +2852 / −0.
   - Área: documentação (`docs/42-auditoria-frontend-ux.md`).
2. **Objetivo e conteúdo**
   - O que entrou: a auditoria de 178 rotas mais 10 lentes, com 982 achados restantes depois de 385 descartados, e as seções 1–7 (diagnóstico, ranking, ganhos rápidos G1–G24, projetos E1–E8, achados transversais, página por página, métricas).
   - O corpo diz "Só adiciona o documento", e o diff confirma.
   - **Divergência de ordem:** o merge aconteceu **depois** da #64 (16:20). Por isso `9bd583d2` já contém as bordas de rota, e o doc 43 usa `1ca53675` como linha de base, não esse merge (doc 43:3, :26).
3. **Rastreabilidade:** é a fonte dos L…. Não cita Q-ids nem a SPEC.
4. **Revisão:** nenhuma rodada, nenhum review. Mergeada sem APPROVE.
5. **Testes e travas:** não se aplica.
6. **Pendências:** a própria auditoria. A medição dela é o doc 43 (#146): 87 de 145 achados Alta ainda abertos e cerca de 71% dos Média/Baixa abertos (doc 43:15-16).
7. **Publicação:** está na `main`. É documento, então não muda nada no UAT.
8. **Riscos e observações**
   - Algumas métricas do doc 42 não são reproduzíveis com o comando que ele cita (doc 43 §2.1: tabelas 7+ colunas, % fora do token).
   - **A recomendação G8 (L40) tinha uma conta errada:** "clarear `--brand` no escuro de `#6366f1` para `#6b6ef5` (hoje 4,47:1 …)". Com essa troca, o contraste de `#fff` sobre `--brand` **cai** para 4,06:1. A #65/#66 seguiu a recomendação e piorou o par (doc 43:12, :145).
   - Outra recomendação seguida e depois desfeita: o G14 pedia `CampoFuso` como `<select>`, e a #69 fez `input` + `datalist`.

---

#### PR #64 — PR 1: bordas de rota (error/not-found/loading no shell e no portal do aluno)

1. **Identificação**
   - Aberta em 22/09 15:51 e mergeada em 22/09 16:20:11.
   - Base `main`, head `claude/pr1-bordas-de-rota`. Merge `5e8a450e`.
   - Tamanho: 17 arquivos, +295 / −9.
   - Área: casca do App Router (`(app)`, raiz, `portal-aluno`) e guard de sessão do portal.
2. **Objetivo e o que entrou**
   - Arquivos novos:
     - `src/app/(app)/error.tsx`, `(app)/not-found.tsx` e `(app)/loading.tsx`;
     - `src/app/not-found.tsx` e `src/app/global-error.tsx`;
     - `portal-aluno/error.tsx`, `loading.tsx` e `not-found.tsx`;
     - `src/components/EstadoRota.tsx`.
   - Novo guard `exigirSessaoPortalAlunoPagina` (`src/server/portal-aluno/sessao.ts:112-116`, hoje): sem sessão faz `redirect("/portal-aluno/entrar")`. O `exigirSessaoPortalAluno`, usado por actions e rotas, continua lançando (`:100-104`).
   - Em `/` o guard passou a ser aguardado antes do `Promise.all`.
   - `/resultados` e `/reposicoes/[id]` capturam `ErroAutenticacao` e fazem redirect (`portal-aluno/resultados/page.tsx:120`, `reposicoes/[id]/page.tsx:27`).
   - **Divergência:** o corpo lista 9 arquivos de escopo e não menciona `portal-aluno/not-found.tsx`, que entrou no segundo commit (`0c6e1cab`) junto com o tratamento `ErroPermissao → notFound()` (`reposicoes/[id]/page.tsx:28`). A seção "Verificação" foi atualizada ("3 not-found.tsx"), mas a tabela de escopo não.
3. **Rastreabilidade**
   - Doc 42: G1 (L33), G2 primeira parte (L34) e G3 (L35); Rk1 (L18) e Rk2 (L19); achado N1 da seção 5.10 (L200).
   - Doc 43: L2602 /portal-aluno resolvido; L1342 resolvido (404 no shell); parciais L2324 (/configuracao sem loading próprio), L2593 (/portal legado), L2031 (/financeiro/acertos-taxa) e L2190 (/leads, com a #81).
   - Métricas 7.1: `error.tsx` ✅ e `not-found`/`global-error` ✅; `loading.tsx` ◐; `<Suspense>` ✖.
   - Sem Q-ids.
4. **Revisão**
   - R1, fora do GitHub e sem veredito registrado. Blocker: `reposicoes/[id]` deixava `ErroPermissao` cair no `error.tsx`, que dizia "sua sessão pode ter expirado", e isso era falso.
   - Resolvido em `0c6e1cab`: `notFound()` com mensagem neutra e um `not-found.tsx` próprio do portal. O commit registra ainda que "a asserção antiga esperava que ErroPermissao subisse… (estava validando o bug)".
   - Sem integrador. Mergeada sem APPROVE.
5. **Testes e travas**
   - `reposicoes/[id]/page.test.ts` (novo, +40) e `resultados/page.test.ts` (+10): cobrem o redirect e um teste novo de `ErroRegra` subindo.
   - Suíte auto-relatada: 2077 testes, usando **`npx vitest`**.
   - Nenhuma trava em `src/app/*.test.ts`. Nenhuma mutação reportada.
6. **Pendências declaradas e situação hoje**
   - `not-found.tsx` por segmento: parcial. Hoje só existe `matriculas/[id]/not-found.tsx`, além de raiz, `(app)` e portal.
   - `error.tsx` em `/login`, `/pagar` e `/certificado`: **continua aberto**. O `git ls-tree` da `main` não mostra `error.tsx` nem `loading.tsx` nesses segmentos, e o doc 43:104 confirma.
   - Esqueleto de tabela: parcial pela #81. Ainda não há `loading.tsx` próprio em `matriculas/`, `academico/`, `diario/` e `secretaria/` (doc 43:98).
   - `<Suspense>`: 0 até hoje (`grep -c "<Suspense"` = 0).
   - `exigirSessaoPagina` da equipe: `src/server/_shared/sessao.ts:153` ainda faz `redirect("/portal")` (L2593 parcial).
   - Não há issue aberta.
7. **Publicação:** está na `main`, então foi para o UAT. Mexe em servidor: guard do portal. Sem schema, sem migration, sem `*.int.test.ts`.
8. **Riscos e observações**
   - Em `/`, `listarReposicoesDoPortalAluno` continua usando o guard que lança. Uma sessão revogada entre o guard e a consulta ainda vira `error.tsx`, e o próprio código documenta isso (`portal-aluno/page.tsx:14`).
   - A verificação no navegador foi feita contra o servidor de dev ligado ao banco de produção. A violação foi admitida na #68.
   - O `(app)/error.tsx` autenticado não foi testado.

---

#### PR #65 — PR 2: token brand-solid, bg-white→surface, shell sticky (empilhada)

1. **Identificação**
   - Aberta em 22/09 16:12:54 e mergeada em 22/09 16:20:22.
   - **Base `claude/pr1-bordas-de-rota`**, head `claude/pr2-brand-solid-shell`. Merge `ebcd5e01`, commit único `4122e644`.
   - Tamanho: 91 arquivos, +174 / −127.
   - Área: design system (`globals.css`, `tailwind.config.ts`, `docs/18`), 86 `.tsx`, Sidebar e layout.
2. **Objetivo e o que entrou**
   - Bloco A: token `--brand-solid: #4338ca`, "mesmo hex nos dois temas, não inverte".
   - Bloco B:
     - `--text-terciary` `#6d6c64` / `#979692`;
     - `--border-control` novo, com `gray.300` apontando para ele;
     - `--brand` escuro `#6b6ef5`;
     - `h1–h4 {font-weight:500}`;
     - `:focus-visible` global;
     - `font-size:16px` abaixo de 768 px.
   - Bloco C: substituição mecânica (`bg-white→bg-surface` 39×, `bg-brand-700→bg-brand-solid` 33×, `hover:bg-brand-700→hover:opacity-90` 41×, 6 `shadow*` removidos).
   - Bloco D: Sidebar `sticky top-0 h-screen` e `<main className="min-w-0 … p-4 md:p-8">`.
   - **Divergência:** o corpo afirma que `--brand` escuro passa de "4,47:1 → ≥4,5:1 contra branco". A conta está errada: dá 4,06:1, como reconheceu o commit `23f58e6c` da #66.
3. **Rastreabilidade:** doc 42 G4 (L36), G5 (L37), G7 (L39), G8 (L40), G10 (L42) e G11 (L43); Rk5 (L22).
4. **Revisão:** nenhuma. Mergeada sem APPROVE, em menos de 8 min.
5. **Testes e travas:** nenhum teste novo. Greps de aceite auto-relatados. Suíte (2076) rodada com `npx`.
6. **Pendências:** é a própria PR que ficou pendente, porque **não chegou à `main`**. Foi substituída pela #66.
7. **Publicação**
   - **Não está na `main`, logo não foi para o UAT.** `git merge-base --is-ancestor ebcd5e01 origin/main` devolve 1 (não ancestral), e `4122e644` também não é ancestral.
   - Ficou viva só em `origin/claude/pr1-bordas-de-rota`, que ainda aponta para `ebcd5e01`.
8. **Riscos e observações**
   - Isso é risco de processo: um empilhamento mergeado depois da base fechada **não muda nada na `main` e não avisa ninguém**.
   - As branches órfãs continuam no remoto. Apagar ou não é decisão do dono; aqui só registro que existem.
   - Nada da #65 foi perdido: a #66 tem a mesma árvore no primeiro commit.

---

#### PR #66 — PR 2 reaplicada em main: token brand-solid, bg-white→surface, shell sticky

1. **Identificação**
   - Aberta em 22/09 16:25:04 e mergeada em 22/09 18:59:15.
   - Base `main`, head `claude/pr2-redo-para-main`. Merge `7ba0b3c2`.
   - Commits: `373dc1de` (cherry-pick da #65), `23f58e6c` (R1) e `7bdefd06` (R2).
   - Tamanho: 110 arquivos, +227 / −160. O JSON do `gh` corta a lista em 100; `gh pr diff --name-only` dá 110.
   - Área: design system mais cerca de 100 telas.
2. **Objetivo e o que entrou**
   - O corpo diz que reaplica a #65 "**árvore idêntica**", o que só vale para o 1º commit (diff vazio, conferido).
   - **Divergência relevante:** o corpo não foi atualizado depois das rodadas de revisão. Entraram mais 19 arquivos e uma decisão oposta à descrita:
     - "`bg-brand-600` mantido como está (opção a)" virou **70 ocorrências promovidas a `bg-brand-solid` em 62 arquivos**;
     - `hover:opacity-90` virou `hover:brightness-95` (50 ocorrências / 45 arquivos);
     - o `:where()` saiu do seletor de `focus-visible`;
     - `h-screen` virou `h-dvh`.
3. **Rastreabilidade**
   - Doc 42: os mesmos da #65 (G4, G5, G7, G8, G10, G11; Rk5).
   - Doc 43, resolvidos: L323, L1901 (com a #67), L1947, L1990, L2300 (com a #67), L2603, L2616, L2628, L2640, L2651, L2677 (com a #67) e L2707.
   - Métricas 7.2: `bg-brand-700` 65→0 ✅, `bg-white` 40→0 ✅, `shadow-*` 5→0 ✅.
   - Métrica 7.4: `focus-visible` ✅. O doc 43 atribui isso à #71; o certo é a #66.
4. **Revisão**
   - **R1** (fora do GitHub, sem veredito registrado), corrigida em `23f58e6c`:
     - **bloqueante:** `bg-brand-600` em botão reprovava AA no escuro (4,06:1). Resolvido promovendo 70 ocorrências e deixando 7 de "seleção";
     - **alto:** `:focus-visible` perdia para `outline-none`, porque `:where()` zera a especificidade e empata em 0-1-0. Resolvido com o seletor sem `:where()`, especificidade 0-1-1 (`globals.css:167-172`);
     - **alto:** doc e código desalinhados (`docs/18`);
     - **médio:** `hover:opacity-90` era frágil e virou `brightness-95`;
     - **médio:** `gray-300` com 0 ocorrências de `bg-gray-300`;
     - **médio:** sombra removida dos modais (não verificado ao vivo);
     - **baixo:** `h-dvh`.
     - O item 10, "CI não rodou no SHA", ficou fora por pedido do usuário.
   - **R2**, corrigida em `7bdefd06`: cosméticos de `docs/18` (hex de `--text-terciary`, `brightness-95`, `--border-control` na tabela).
     - O item 1, chips e abas em `bg-brand-600` com 4,06:1, foi **aceito como débito consciente**.
   - Sem integrador. Mergeada sem APPROVE.
5. **Testes e travas:** nenhum teste novo e nenhuma trava. Verificação no navegador com `getComputedStyle` (banco de produção, ver §0.5). Suíte 2077.
6. **Pendências e situação hoje**
   - **Débito dos 7 `bg-brand-600` de seleção: FECHADO pela #156.** Hoje só resta `HomeVendedor.tsx:160` (`h-full bg-brand-600`), uma barra de progresso sem texto, o que é aceitável.
   - **`--border-control` abaixo de 3:1 sobre `surface-muted`:** apontado no doc 43:145 e **fechado pela #156**. Hoje `rgba(0,0,0,.44)` / `rgba(255,255,255,.36)` (`globals.css:22,77`); antes eram .42/.34.
   - **`#fff` sobre `--brand` no escuro (4,06:1):** o par continua existindo (`--brand: #6b6ef5`, `globals.css:84`). O `docs/18:73-74` agora proíbe usá-lo com texto, e não há mais `bg-brand-600 text-white`, então está mitigado.
   - Modais de importação "sem sombra colando no fundo": nunca verificados ao vivo, e isso continua sem verificação.
   - Os 51 `outline-none` não foram removidos de propósito. Hoje são 0 efetivos (doc 43:142).
7. **Publicação:** está na `main`, então foi para o UAT (UAT ganhou o tema dos botões e o shell sticky). Só CSS e `.tsx`, sem servidor nem schema.
8. **Riscos e observações**
   - **Uma decisão desta PR foi desfeita depois.** "`--brand-solid` mesmo hex nos dois temas, não inverte" foi revertido pela **#157**: no escuro passou a `#6264ec` (`globals.css:94`; `docs/18:79-86`, "tem um valor por tema"). O `docs/18:67` ainda diz que `--ai-solid` "não inverte … mesma lógica de `--brand-solid`", frase que ficou obsoleta.
   - `hover:brightness-95` sobre `bg-success` (`CopilotoSugestoes`) foi pego "de brinde", sem revisão visual.
   - PR de 110 arquivos revisada só por auto-relato.

---

#### PR #67 — PR 2c: shades não mapeadas (rose/emerald/sky/slate/violet + tons soltos)

1. **Identificação**
   - Aberta em 22/09 19:09:56 e mergeada em 22/09 19:39:07.
   - Base `main`, head `claude/pr2c-shades-nao-mapeadas`. Merge `9f0b0154`, commit único `089f4f92`.
   - Tamanho: 32 arquivos, +106 / −65.
   - Área: design system (`globals.css`, `tailwind.config.ts`, `docs/18`) e 29 telas (fechamento de avaliações, migração, correção de aula, `FilaCobranca`, inbox, `CopilotoSugestoes`, portal, certificado).
2. **Objetivo e o que entrou**
   - 93 ocorrências corrigidas.
   - Tokens novos `--ai-bg/--ai-text/--ai-border/--ai-solid` para o copiloto (doc 27 C3). Hoje em `globals.css:63-66` e `:108-111`, mapeados em `tailwind.config.ts:57-60`.
   - `green.200` e `blue.200` mapeados (`tailwind.config.ts:49,52`).
   - Equivalências aplicadas: `rose→red`, `emerald→green`, `sky→blue`, `slate→gray`.
   - Remoção de 3 `dark:` manuais.
   - O badge "aula experimental" da inbox foi para azul, não para o token de IA.
   - O corpo condiz com o diff.
3. **Rastreabilidade**
   - Doc 42: G6 primeira metade (L38); Rk5 (L22).
   - Doc 43, resolvidos: L1182, L1365, L2484, L2581, L2664 e L2207; L1925 e L2021 (amostra); e, junto com a #66, L1901, L2300 e L2677.
   - Métrica 7.2: shades fora do mapa 98→0 ✅.
4. **Revisão:** nenhuma rodada registrada. As "duas decisões" foram combinadas com o usuário antes. Mergeada sem APPROVE, 29 min depois de aberta.
5. **Testes e travas:** nenhum teste. Grep de auditoria = 0 (auto-relato). A trava só veio na #80.
6. **Pendências:** nenhuma declarada. A trava de regressão (segunda metade do G6) ficou para a #80, e foi feita.
7. **Publicação:** está na `main`, então foi para o UAT. Só CSS e `.tsx`.
8. **Riscos e observações**
   - `green.200`/`blue.200` apontam para o **mesmo** token de fundo (`--success-bg`/`--info-bg`) que `*-50`/`*-100` (`tailwind.config.ts:49-52`). Uma `border-green-200` em volta de um `bg-green-50` fica **invisível**: é borda decorativa, sem contraste.
   - `docs/18:65-67` reserva `--ai-*` ao copiloto. Não há trava que impeça o uso fora dele.

---

#### PR #68 — PR 2d: CampoMoeda (dinheiro para de aceitar 1.234 como 1234)

1. **Identificação**
   - Aberta em 22/09 19:57:03 e mergeada em 23/09 12:02:12.
   - Base `main`, head `claude/pr2d-campo-moeda`. Merge `5097b273`.
   - Commits: `d790841f`, `32d57bff`, `aea83a44` e `4e4dfb48`. Os quatro foram rebaseados juntos às 20:28:07 e escritos entre 19:56 e 20:27.
   - Tamanho: 16 arquivos, +424 / −64.
   - Área: dinheiro no financeiro (`PagamentoModal`, `FichaFinanceira`, `ResumoFinanceiroComercial`, créditos), catálogo (`PrecosPainel`), comissões, leads, contratação, matrícula, condições por hora, e o servidor `comercial/schema.ts`.
2. **Objetivo e o que entrou**
   - `parseMoeda`, `formatarMoedaParaCampo` e `casasDecimais` em `src/lib/dinheiro.ts:51,99-117`.
   - `src/components/CampoMoeda.tsx`: `type="text"`, `inputMode="decimal"`, símbolo da moeda e normalização no blur.
   - 15 campos de dinheiro mais 1 caso duplo trocados.
   - `Controller` do RHF no `LeadFormulario`.
   - `valorMonetarioOpcional` no servidor (`src/server/comercial/schema.ts:13-17`): texto inválido vira `NaN`, rejeitado pelo zod.
   - **Divergências entre corpo e código:**
     - O corpo diz "Empilhada sobre a PR #67 (ainda aberta)", mas a base é `main` e a #67 já estava mergeada desde 19:39, antes de a #68 abrir.
     - O corpo diz "2089 testes", mas o último commit relata 2092.
     - O corpo não descreve as rodadas de revisão (o fim do `?? 0` no caminho de escrita, casas por moeda, `validarPasso2`).
     - **Afirmação não cumprida:** o corpo diz que a migração dos 5 arquivos fecha "o resíduo de 2 dígitos ('1.23' ambíguo com '123')". Só que `parseMoeda` aceita `"1.23"` como 1,23 (`dinheiro.ts:100-101`: `/^\d+(?:\.\d{1,2})?$/` depois de trocar a primeira vírgula por ponto). **Esse resíduo continua.**
3. **Rastreabilidade:** doc 42 G13 (L45); Rk6 (L23). Doc 43 7.6: dinheiro `type=number step=0.01` 16→0 ✅, com 15 usos de `CampoMoeda`.
4. **Revisão**
   - **R1**, em `32d57bff`. Blocker real: `parseMoeda(valor) ?? 0` no payload transformava texto inválido em R$ 0,00 silencioso (pagamento zero, preço zero, taxa zero). Resolvido com parse antes, erro de validação e `return` antes da action, em `PagamentoModal`, `FichaFinanceira` (Renegociar), `ResumoFinanceiroComercial`, `PrecosPainel` e `MatriculaFormulario` (`validarPasso2`).
   - Ainda na R1, um item médio: símbolo largo e `pl-9→pl-14` (`CampoMoeda.tsx:82-84`).
   - **R2**, em `aea83a44`: casas decimais por moeda (CRC/CLP sem centavos). Era um nit opcional, feito a pedido.
   - **R3**, em `4e4dfb48`: `montarInput` deixa de ter `?? 0` interno e passa a exigir os números já validados, numa defesa por tipo; `prefillPrecos` usa `formatarMoedaParaCampo`.
   - Sem integrador. Mergeada sem APPROVE.
5. **Testes e travas**
   - `dinheiro.test.ts` +88: 14 testes mais 3 de casas, com round-trip.
   - `DevolucaoCredito.test.ts`: 1 teste novo de rejeição e 1 asserção fortalecida.
   - Nenhuma trava estática em `src/app/*.test.ts`. Nenhuma mutação reportada.
6. **Pendências e situação hoje**
   - Na `main` não sobra `?? 0` em escrita. As três ocorrências restantes são prévia ou exibição: `PagamentoModal.tsx:72`, `FichaFinanceira.tsx:322` e `MatriculaFormulario.tsx:774`.
   - `type=number step=0.01` só aparece em percentuais: `UsuarioFormulario.tsx:113,118` e `PoliticasComissao.tsx:50`.
   - O resíduo `"1.23"` está **aberto**, sem PR e sem issue.
7. **Publicação:** está na `main`, então foi para o UAT. Mexe em servidor (zod de `comercial/schema.ts`), sem schema nem migration.
8. **Riscos e observações**
   - `formatarMoedaParaCampo(…, "CRC")` faz `toFixed(0)` (`dinheiro.ts:114-116`). Digitar `100,50` num campo CLP ou CRC vira `101` ao sair do campo: um **arredondamento silencioso**, ainda que visível.
   - `CampoMoeda` não valida sozinho (`CampoMoeda.tsx:11-15`). Cada chamador precisa tratar `null`, e o bug da R1 nasceu justamente disso.
   - O componente foi alterado depois pela #145 (`aria-*`).

---

#### PR #69 — fix(ux-14): fuso institucional real substitui `defaultValue="UTC"` fixo

1. **Identificação**
   - Aberta em 23/09 12:24:26 e mergeada em 23/09 12:59:47.
   - Base `main`, head `claude/pr3-campo-fuso`. Merge `2ad99d23`.
   - Commits: `4f75f046`, `148f2005` (R1) e `a8b21897` (R2).
   - Tamanho: 38 arquivos, +248 / −83.
   - Área: acadêmico (recuperações, planos, tentativas, segundas chamadas) e servidor `operacao/consultas.ts`.
2. **Objetivo e o que entrou**
   - `consultarFusoInstitucional()` (novo, `src/server/operacao/consultas.ts`): lê `ConfiguracaoOperacional.fusoInstitucional` e devolve `null` quando não há.
   - `src/components/CampoFuso.tsx` (novo): `input` + `datalist`, com `padrao` obrigatório.
   - 10 formulários mais 3 em cascata recebem `fusoInstitucional` do `page.tsx`.
   - **Divergência com o doc 42:** o G14 pedia `<select>`, e a PR fez `input+datalist`, decisão declarada no componente.
   - O corpo cita eslint em "34 arquivos", mas a PR tem 38 arquivos.
3. **Rastreabilidade**
   - Doc 42: G14 (L46), Rk3 (L20) e o grupo L1454.
   - Doc 43 (07/10): L1603 resolvido (com a #78); parciais L1540, L1566, L1590, L1747 e L1786.
   - Métrica 7.6, fuso: ◐.
4. **Revisão**
   - **R1**, em `148f2005`:
     - id do `datalist` via `useId()`: duas instâncias com o mesmo `name` colidiam;
     - residual de UTC em `avaliacoes/[alocacaoId]/[codigo]/page.tsx`: `busca.fuso ?? "UTC"` passou a usar o fuso institucional;
     - mock de `consultarFusoInstitucional` sem `mockResolvedValue` em `planos/[propostaId]/page.test.ts`;
     - novo `CampoFuso.test.ts`.
   - **R2**, em `a8b21897`: não consulta o fuso institucional quando há `?fuso=`, como otimização. O "UTC como último recurso" foi mantido de forma consciente.
   - Sem integrador. Mergeada sem APPROVE.
5. **Testes e travas**
   - `CampoFuso.test.ts` (novo) e 10 `page.test.ts` atualizados.
   - Testes dos dois ramos do fallback em `avaliacoes/[codigo]/page.test.ts`.
   - Suíte auto-relatada: 2097.
   - Nenhuma trava estática. A trava `fuso-instante.test.ts` veio depois, na #159.
6. **Pendências e situação hoje**
   - "3 campos sem pré-preenchimento" (remarcação, agenda de segunda chamada, fechamento de horas): **FECHADO pela #159**. Hoje `remarcacao/Formulario.tsx:54`, `propostas/[propostaId]/agenda/Formulario.tsx:41` e `fechamentos-horas/PrepararFechamento.tsx:54` usam `CampoFuso padrao={fusoInicial}`.
   - "Mostrar a conversão resultante" (motivo de L1540, L1590 e L1786 parciais): a #159 ("prévia de conversão") abordou isso; existe `recuperacoes/planos/[propostaId]/Horario.interacao.test.ts`. Não reverifiquei tela a tela.
   - **UTC como último recurso continua** em `avaliacoes/[alocacaoId]/[codigo]/page.tsx:22`, hoje anunciado na tela (`:25-27`, #159).
   - Não há issue.
7. **Publicação:** está na `main`, então foi para o UAT. Mexe em servidor (consulta nova, só leitura), sem schema nem migration.
8. **Riscos e observações**
   - Hoje `CampoFuso`, um client component, importa `@/server/operacao/fuso` (`CampoFuso.tsx:3`, introduzido depois). Depende de esse módulo ser seguro para o cliente.
   - O campo continua em texto livre. Com a escola sem fuso configurado, ele vem vazio.

---

#### PR #70 — fix(ux-18): encontro em rascunho deixa de aparecer como "Em conferência"

1. **Identificação**
   - Aberta em 23/09 13:02:22 e mergeada em 23/09 13:35:04.
   - Base `main`, head `claude/pr4-rascunho-encontro`. Merge `bdc95a0a`.
   - Commits: `e6fe2a16` e `655fc5b1` (R1).
   - Tamanho: 2 arquivos, +44 / −6.
   - Área: `/academico/segundas-chamadas/agendas`.
2. **Objetivo e o que entrou:** `RASCUNHO: "Rascunho"` no mapa e fallback `?? valor` em vez de `?? "Em conferência"`. O corpo condiz com o diff. A R1 amarrou os mapas ao enum com `satisfies Record<Enum,string>`.
3. **Rastreabilidade:** doc 42 G18 (L50).
4. **Revisão**
   - **R1**, em `655fc5b1`: `Record<string,string>` não quebrava o build quando o enum ganhava valor, e virou `satisfies`. Foi acrescentado teste do fallback cru (`STATUS_FUTURO`).
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** `agendas/page.test.ts` +37 (RASCUNHO e fallback cru). Sem trava estática nem mutação.
6. **Pendências:** nenhuma declarada.
7. **Publicação:** está na `main`, então foi para o UAT. Só `.tsx`.
8. **Riscos e observações**
   - **Esta mudança foi substituída depois.** Os mapas locais foram removidos pelas #110, #138 e `e73987ad` ("status do encontro… no masculino").
   - Hoje `agendas/page.tsx:13-14` aponta para `STATUS_RESERVA_SEGUNDA_CHAMADA_LABEL`/`STATUS_ENCONTRO_LABEL` em `src/lib/labels.ts:237-238` (`RASCUNHO: "Rascunho"`), com `rotular(...)` e a trava `enums-rotulos.test.ts`/`status-encontro.test.ts`.
   - O resultado da #70 está preservado. O código dela, não.

---

#### PR #71 — fix(ux-16,17): sidebar acessível (sem destaque duplo, aria-current, skip link)

1. **Identificação**
   - Aberta em 23/09 13:39:56 e mergeada em 23/09 14:07:43.
   - Base `main`, head `claude/pr5-sidebar-a11y`. Merge `8ec4dfc5`.
   - Commits: `b95605a0` e `75b9c519` (R1).
   - Tamanho: 8 arquivos, +171 / −16.
   - Área: shell (`Sidebar`, `SubTabs`, `(app)/layout.tsx`, `lib/nav.ts`).
2. **Objetivo e o que entrou**
   - Ativo calculado por prefixo mais longo com borda de segmento. Na R1 virou uma função só, `hrefAtivoMaisLongo` (`src/lib/nav.ts:97-101`).
   - `aria-current="page"` (`Sidebar.tsx:90`).
   - `aria-label="Navegação principal"` e `"Sub-navegação"`.
   - `sr-only` "mensagens não lidas" (`Sidebar.tsx:103`).
   - Item morto `/portal` removido do `nav.ts`.
   - Skip link e `<main id="conteudo">` (`(app)/layout.tsx:18,22`).
   - O corpo condiz com o diff.
3. **Rastreabilidade**
   - Doc 42: G16 (L48), G17 (L49) e L2325 (`SubTabs` sem `aria-current`).
   - Doc 43 7.4: skip link e `aria-current` ✅ (#71). Já "`focus-visible` (#71)" e "`--border-control` (#71)" estão **mal atribuídos** (§0.8).
4. **Revisão**
   - **R1**, em `75b9c519`: algoritmo duplicado extraído para `nav.ts`; testes passam a conferir também a **classe visual**, não só `aria-current`; `ariaLabel` customizável no `SubTabs`.
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** `nav.test.ts`, `Sidebar.test.ts`, `SubTabs.test.ts` e `layout.test.ts` (novos). Sem trava em `src/app/*.test.ts` e sem mutação reportada. A falha de cobertura da classe visual foi apontada na R1 e fechada.
6. **Pendências:** nenhuma declarada.
7. **Publicação:** está na `main`, então foi para o UAT. Só front.
8. **Riscos e observações**
   - **Regressão introduzida aqui e consertada na #80:** o skip link usava `focus:shadow`, contra a regra de sombra que a #66 tinha zerado.
   - A Sidebar mudou depois pela #94 (`hidden md:flex`, `NavLinks`) e o `nav.ts` pela `efc6224b` (desempate de prefixo aninhado em `/academico` e `/diario`, que o doc 42:78 já previa).

---

#### PR #72 — fix(ux-23): financeiro (Aprovar/Rejeitar/Fechar mês sem duplo clique)

1. **Identificação**
   - Aberta em 23/09 14:13:17 e mergeada em 23/09 14:54:42.
   - Base `main`, head `claude/pr6-financeiro-double-click`. Merge `0098ce99`.
   - Commits: `21e52275` e `7e10de41` (R1).
   - Tamanho: 2 arquivos, +86 / −13.
   - Área: `/financeiro` (`FinanceiroPainel`: comissões e aprovações).
2. **Objetivo e o que entrou**
   - `run()` com estado ocupado em `try/finally` e `isPending` nos filhos.
   - `Comissoes` e `Aprovacoes` exportadas.
   - **Divergência deliberada do G23:** o `router.refresh()` foi mantido. A justificativa é que `revalidatePath` não atualiza a árvore cliente montada quando a action é chamada como promise.
3. **Rastreabilidade:** doc 42 G23 (L55), em parte; Rk8 (L25); L2016 ("Fechar mês" sem confirmação), que **segue aberto** no doc 43:373.
4. **Revisão**
   - **R1**, em `7e10de41`, com dois blockers:
     - `run(fecharMesComissoes())` disparava a action **antes** de `setOcupado`, então dois cliques no mesmo frame ainda geravam duas requisições. Resolvido com fábrica (`() => Promise`) mais trava síncrona `ocupadoRef`;
     - o rótulo "Fechando…" aparecia durante o toggle automático e foi retirado.
   - Teste de corrida não foi feito ("sem infra DOM").
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** `FinanceiroPainel.test.ts` (novo, +45, markup estático). Sem trava e sem mutação.
6. **Pendências e situação hoje**
   - A confirmação de "Fechar mês" estava fora do escopo. Foi **fechada depois** por `a5045bba` ("ConfirmarAcao… E1, fatia A", PR #154): `FinanceiroPainel.tsx:87-115` agora abre uma confirmação com quantidade e valor.
   - O `ocupadoRef` desta PR **não existe mais**. Foi substituído por `useAcaoCliente` (#85+), que mantém uma trava síncrona `emCurso` (`src/lib/acao-cliente.ts:50-53`), e o painel foi dividido por rota (E8).
   - O que a PR declarou ("sem infra de teste DOM") deixou de valer: hoje existem `*.interacao.test.ts`.
7. **Publicação:** está na `main`, então foi para o UAT. Só front.
8. **Riscos e observações:** o código da #72 foi totalmente reescrito por PRs posteriores, e a intenção dela (trava síncrona) sobreviveu.

---

#### PR #73 — fix(ux-15): elimina o segundo findUnique de ExportarPlanilha; `cache()` fica bloqueado

1. **Identificação**
   - Aberta em 23/09 15:02:17 e mergeada em 23/09 17:25:49.
   - Base `main`, head `claude/pr7-permissoes-select`. Merge `fdaa86ee`.
   - Commits: `7f38ad1c` e `1a9ba857` (R1).
   - Tamanho: 5 arquivos, +119 / −8.
   - Área: servidor `_shared/sessao.ts`, `lib/guards.ts` e `ExportarPlanilha`.
2. **Objetivo e o que entrou**
   - `permissoes` no `select` de `carregarUsuarioFresco` (hoje `sessao.ts:72`).
   - `UsuarioSessao.permissoes?` opcional (`sessao.ts:18`).
   - `temPermissao()` centralizado na R1 (`sessao.ts:26`).
   - Testes diretos de `exigirSessao`/`exigirSessaoPagina`.
   - **Diagnóstico errado no corpo:** "`react` 18.3.1 não exporta `cache` … teria quebrado em produção". Na verdade o App Router usa o React embutido no Next, que exporta `cache`. Isso foi reconhecido na #90 ("No App Router ele está") e no `src/server/_shared/memo-requisicao.ts:6-10`. O erro só aparecia no Vitest.
3. **Rastreabilidade:** doc 42 G15 (L47), em parte. Doc 43 7.6, guards de `/financeiro`: ◐ (cerca de 3 por render).
4. **Revisão**
   - **R1**, em `1a9ba857`:
     - JSDoc ainda citava `cache()`;
     - risco de inverter a checagem com `?? []` resolvido com `temPermissao` tratando ausência como negado;
     - **o teste conferia o valor, não o `select`**: o mock passaria mesmo sem `permissoes: true`, um mutante sobrevivente apontado na revisão. Morto com uma asserção sobre o `select`.
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** `sessao-guards.test.ts` (novo, +64) e `sessao.test.ts` +18. Sem trava estática. Mutação: 1 sobrevivente identificado na R1 e morto.
6. **Pendências e situação hoje**
   - **`cache()`: FECHADO pela #91** (`45ed4039`, `5da6290c`, `70f4f125`): `memoPorRequisicao`.
   - **`escopoComercialAtual`:** a #73 recusou memoizar por risco de transação. A #91 memoizou **só fora de transação** (`escopo-comercial.ts:12-18`), o que resolve a objeção.
   - `permissoes?` continua opcional (`sessao.ts:18`), um débito de tipo mitigado por `temPermissao`.
   - **O mesmo padrão que a #73 eliminou continua em outras telas:** um `findUnique` só para ler `permissoes`, em `alunos/[id]/financeiro/page.tsx:40`, `alunos/[id]/movimentacoes/page.tsx:47` e `financeiro/permuta/page.tsx:15`. Isso é a "sobra" do doc 43:170.
7. **Publicação:** está na `main`, então foi para o UAT. **Mexe em servidor** (guard de sessão de todas as páginas: o `select` ganha uma coluna). Sem schema nem migration.
8. **Riscos e observações:** o raciocínio sobre o React estava errado. Se tivesse sido aceito como definitivo, teria travado o G15 à toa; a #91 corrigiu duas semanas antes do previsto.

---

#### PR #74 — fix(ux-22): inbox (polling pausa em segundo plano; lista para de saltar)

1. **Identificação**
   - Aberta em 23/09 17:32:45 e mergeada em 23/09 17:46:31.
   - Base `main`, head `claude/pr8-inbox-polling`. Merge `6a3ce168`.
   - Commits: `3154e7ff` e `11a9bbab` (R1).
   - Tamanho: 3 arquivos, +64 / −5.
   - Área: inbox (`InboxCliente.tsx`) e servidor `whatsapp/consultas-inbox.ts`.
2. **Objetivo e o que entrou**
   - `router.refresh()` só com `visibilityState==="visible"`.
   - Removido o `.sort()` de "não lidas primeiro", ficando só `orderBy` por recência.
   - Na R1, refresh imediato ao voltar para a aba.
   - Hoje em `InboxCliente.tsx:116-132` e `consultas-inbox.ts:84,100`. O corpo condiz com o diff.
3. **Rastreabilidade:** doc 42 G22 (L54). Doc 43:171, reconstruções em segundo plano: cerca de 120/h → 0 ✅.
4. **Revisão**
   - **R1**, em `11a9bbab`:
     - comentário JSX obsoleto;
     - "pausa" prometia mais do que fazia, porque o `setInterval` segue rodando;
     - faltava o refresh ao voltar;
     - **o teste só provava a ordem do próprio mock**, um mutante sobrevivente. Morto com uma asserção de `orderBy`.
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** `consultas-inbox.test.ts` (novo, +38). O gate de visibilidade ficou sem teste (sem DOM). Mutação: 1 sobrevivente identificado na R1 e morto.
6. **Pendências:** teste de interação do gate (não feito, e hoje já existe infra). O `setInterval` continua ticando, o que está documentado.
7. **Publicação:** está na `main`, então foi para o UAT. **Mexe em servidor** (consulta da inbox, só leitura). Sem `*.int.test.ts`: os de inbox não foram tocados.
8. **Riscos e observações**
   - A ordem por recência foi mantida pela #102 ("mantém a decisão do ganho rápido 22").
   - O arquivo foi muito alterado depois (Fase 2 do WhatsApp: #131/#132). A regra sobreviveu (`consultas-inbox.ts:100`).
   - Perder "não lidas primeiro" foi uma escolha de produto. Não há registro de decisão do usuário no corpo.

---

#### PR #75 — fix(ux-12): tabelas rolam na horizontal em vez de cortar colunas

1. **Identificação**
   - Aberta em 23/09 17:50:00 e mergeada em 23/09 18:03:00.
   - Base `main`, head `claude/pr9-tabelas-overflow`. Merge `45ace04f`.
   - Commits: `a8061401` e `26a373bc` (R1). Na R1 o coautor passa de Sonnet 5 para Opus 5.5.
   - Tamanho: 15 arquivos, +33 / −31.
   - Área: listas (`/alunos`, `/leads`, `/empresas`, `/financeiro`, `/configuracao/*`).
2. **Objetivo e o que entrou**
   - `overflow-hidden→overflow-x-auto` em 20 wrappers e 15 arquivos.
   - `min-w-[640px]` nas 12 tabelas de 5+ colunas.
   - `FichaFinanceira` com o título fora da rolagem.
   - **Divergência interna:** o commit 1 dizia "19 wrappers / 16 de 19 com min-w", corrigido na R1. O corpo final está correto.
3. **Rastreabilidade:** doc 42 G12 (L44). Doc 43:156: ✅ (0 de 6 tabelas largas sem `overflow-x`).
4. **Revisão**
   - **R1**, em `26a373bc`:
     - contagem de colunas errada por um: `grep "<th"` casava `<thead`, e 4 tabelas de 4 colunas tinham recebido `min-w` sem precisar;
     - título da `FichaFinanceira` rolando junto com a tabela;
     - wrapper faltante em `ReguaComercialPainel` (`rounded-md`).
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** **nenhum teste.** A trava `responsivo.test.ts` só chegou na #94. Sem mutação.
6. **Pendências:** 4 `overflow-hidden` que não são tabela ficaram de fora de propósito. Não há pendência aberta.
7. **Publicação:** está na `main`, então foi para o UAT. Só CSS.
8. **Riscos e observações:** foi mergeada sem nenhum teste, 13 min depois de aberta. A divisão do `/financeiro` por rota (E8) e a #94 mexeram depois nos mesmos arquivos.

---

#### PR #76 — fix(ux-19): login e listas principais com nomes acessíveis e erros anunciados

1. **Identificação**
   - Aberta em 23/09 17:54:53 e mergeada em 23/09 18:05:41.
   - Base `main`, head `claude/pr10-a11y-rotulos`. Merge `1e96cf0b`.
   - Commits: `f2d4a3f5` e `6736da28` (R1, junto com o rebase sobre a #75).
   - Tamanho: 6 arquivos, +88 / −20.
   - Área: `/login`, `AlunosLista`, `LeadsLista`, `FilaCobranca` e `FichaAluno`.
2. **Objetivo e o que entrou**
   - `htmlFor`/`id` no login (`login/page.tsx:47,63`).
   - `aria-invalid`/`aria-describedby`.
   - Erros de campo em `aria-live="polite"` e falha de autenticação em `role="alert"` (`:76`).
   - `aria-label` em busca e filtros.
   - Recorte declarado: é o primeiro de quatro.
3. **Rastreabilidade:** doc 42 G19 (L51), primeiro recorte. Doc 43:138, controles sem nome 187→0 ✅ (com #82–#84).
4. **Revisão**
   - **R1**, em `6736da28`:
     - spread do `register` antes dos overrides de a11y;
     - `role="alert"` nos campos trocado por `polite`;
     - região sempre montada;
     - teste do caminho de erro.
   - Sem integrador. Sem APPROVE. **Mergeada 31 s depois do commit de revisão.**
5. **Testes e travas:** `login/page.test.ts` (novo, +58). Mutação: **1 morta** (inverter a ordem do spread faz 2 testes falharem).
6. **Pendências e situação hoje**
   - Cerca de 25 campos do drawer da `FichaAluno`: **FECHADO pela #82** (26 rótulos).
   - 32 selects e 34 estados de erro sem live region: **FECHADO pelas #83 e #84**.
   - Falta teste do `role="alert"` de autenticação. Continua sem cobertura específica.
7. **Publicação:** está na `main`, então foi para o UAT. Só front.
8. **Riscos e observações**
   - **Bug introduzido nesta PR e corrigido depois:** as regiões `aria-live` levavam `empty:hidden`. `display:none` tira a região da árvore de acessibilidade, o que anula o "sempre montada" que a própria R1 pedia (`git show 1e96cf0b:src/app/login/page.tsx:58,72`).
   - Foi corrigido pelo commit `219d7ff6` da **#83** ("região polite sempre montada"). Hoje está como `empty:mt-0` (`login/page.tsx:59,73`), com o comentário em `:57`.
   - O teste da #76 não pegou isso, porque o render estático não avalia CSS.

---

#### PR #77 — fix(ux-20): resultado incerto nunca convida a alterar os dados

1. **Identificação**
   - Aberta em 23/09 18:09:59 e mergeada em 23/09 18:18:53.
   - Base `main`, head `claude/pr11-resultado-incerto`. Merge `6c09d5da`.
   - Commits: `fc5bccbe` e `c43c1264` (R1).
   - Tamanho: 18 arquivos, +104 / −19.
   - Área: acadêmico (segundas chamadas, recuperações, avaliações, admissões, reposições), secretaria e matrículas.
2. **Objetivo e o que entrou**
   - `src/lib/mensagens.ts` com `MSG_RESULTADO_INCERTO`/`MSG_DECISAO_INCERTA`.
   - 5 mensagens erradas corrigidas, mais 4 na R1.
   - 10+1 literais migrados.
   - Trava por bloco `catch` (`mensagens.test.ts`).
   - Recorte consciente: cerca de 80 redações não foram unificadas.
   - **Divergência:** o commit 1 falava em "3 telas e 11 literais idênticos". O corpo final corrige para "5 + 10 idênticos + 1".
3. **Rastreabilidade:** doc 42 G20 (L52). Doc 43:131: redações 25→4 ◐.
4. **Revisão**
   - **R1**, em `c43c1264`: a trava era uma regex por linha na redação exata e não pegava string quebrada nem concatenada. Virou uma extração por bloco `catch` com chaves balanceadas.
   - A trava ampliada **achou 4 mensagens** que passavam, ou seja, a trava R0 tinha 4 sobreviventes: `ExcecaoFrequencia` (2), `RelatarIndisponibilidadeReposicao` e `CorrecoesConclusaoReposicao`.
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** `src/lib/mensagens.test.ts` (novo, +66), fora de `src/app/` mas com o mesmo papel de trava. Mutação: **1 morta** (o arquivo antigo faz falhar). Na R1, 4 casos que a versão anterior deixava passar.
6. **Pendências e situação hoje**
   - Unificação das cerca de 80 redações: **feita pela #118**, que trouxe uma terceira constante, `MSG_RESULTADO_INCERTO_SEM_CHAVE`, e mudou o texto de `MSG_RESULTADO_INCERTO` para "Reenvie sem alterar os dados…" (`mensagens.ts:4-10`). A #133 corrigiu a trava no inbox.
   - **Continua aberta a mensagem avulsa** em `secretaria/reservas/ConferirReserva.tsx:18` ("Resultado não confirmado. Atualize a página…"), introduzida por esta PR. O doc 43:131 marca ◐ por causa dela.
7. **Publicação:** está na `main`, então foi para o UAT. Só front.
8. **Riscos e observações:** a trava só olha blocos `catch`. A avulsa de `ConferirReserva` está num `if (!d.dado)` fora de `catch`, e por isso escapa.

---

#### PR #78 — fix(ux-24): pares de data com `min` cruzado

1. **Identificação**
   - Aberta em 23/09 18:24:23 e mergeada em 23/09 18:34:45.
   - Base `main`, head `claude/pr12-datas-min`. Merge `4472eab5`.
   - Commits: `46bd3dfb` e `85c71d73` (R1).
   - Tamanho: 18 arquivos, +162 / −28.
   - Área: acadêmico (indisponibilidades, recuperações, segundas chamadas), carteiras, diário de reposições, permuta e matrículas (período integral, continuidade, oferta).
2. **Objetivo e o que entrou**
   - `src/lib/periodo-form.ts` com `useInicioDoPeriodo()` e `vincularInicio()` puro (`:10-31`).
   - `min` no fim de 15 pares e de 1 campo isolado, em 14 formulários.
   - `CamposPeriodo` por acordo em `PermutaOperacional`.
   - **Divergência:** o commit 1 diz "16 pares", e o corpo diz "15 pares + 1 campo isolado", que é o certo.
3. **Rastreabilidade**
   - Doc 42: G24 (L56) e L857, L938, L949, L964, L1235 e L2248.
   - Doc 43: L1603 resolvido (com a #69); L857 resolvido (amostra).
   - Prorrogação L1566: parcial, por falta do `min`.
4. **Revisão**
   - **R1**, em `85c71d73`:
     - o `min` ficava obsoleto depois de `form.reset()`;
     - em `PeriodoIntegral`, a remontagem deixava o estado diferente do que a tela mostrava, o que é sério.
   - As duas causas foram resolvidas com um hook preso ao ciclo de vida do campo, mais um dublê de `useCallback` em `PermutaOperacional.test.ts`.
   - Sem integrador. Sem APPROVE.
5. **Testes e travas:** `periodo-form.test.ts` e `TerminoIndisponibilidadeOferta.test.ts` (novos). Sem trava estática e sem mutação. Os `min` que dependem de estado não foram testados, por falta de DOM.
6. **Pendências e situação hoje**
   - **Prorrogação sem `min`: continua aberta.** `planos/[propostaId]/prorrogacoes/Formularios.tsx:24` usa `<Horario …>` sem `min` ligado ao prazo anterior.
   - **`max`=agora no início da designação: continua aberto.** `designacao/Formulario.tsx:55` só tem `min` no fim.
   - "`min` aceita igualdade" onde o servidor exige estritamente maior (encontros): aberto por natureza, com recusa só no servidor.
   - O hook segue em uso em 13 formulários e foi alcançado por um teste de interação (`designacao/feedback.interacao.test.ts`).
7. **Publicação:** está na `main`, então foi para o UAT. Só front.
8. **Riscos e observações**
   - `propsInicio` injeta `onChange`. Em campo controlado por `register` do RHF, o spread em ordem errada sobrescreveria o handler; hoje nenhum dos 13 usa RHF no início.
   - `min` só funciona quando o início e o fim têm o mesmo tipo (`date` × `datetime-local`). Isso não tem trava.

---

#### PR #79 — fix(ux-9): só os pesos 400/500 (sem negrito sintético)

1. **Identificação**
   - Aberta em 23/09 18:39:33 e mergeada em 24/09 00:44:53.
   - Base `main`, head `claude/pr13-pesos-titulos`. Merge `e9b1c29d`.
   - Commits: `2f409797` e `45944e4e` (R2).
   - Tamanho: 10 arquivos, +62 / −15, incluindo 2 binários removidos.
   - Área: tipografia (`globals.css`, `src/app/fonts/`, `docs/18`), com 8 `font-semibold` em 5 arquivos.
2. **Objetivo e o que entrou**
   - `font-semibold→font-medium` (8×).
   - Removidos `AnthropicSans-Text-Semibold.otf` e `-Bold.otf`. Hoje `src/app/fonts/` só tem Regular e Medium.
   - Regra base ampliada para `b`, `strong` e `th`, e na R2 também `h5`, `h6` e `dt` (`globals.css:142-154`).
   - Trava `src/app/tipografia.test.ts`. O corpo condiz com o diff.
3. **Rastreabilidade**
   - Doc 42: G9 (L41), L910 e L2343 (`font-semibold`), L925 e L1700 (`<strong>` sintético).
   - Doc 43:124-125: headings sem peso → 0 ✅; `font-semibold` 8→0 ✅.
4. **Revisão (no GitHub)**
   - **R1**, review `COMMENTED` de 23/09 23:26:53, "APPROVE in substance", sem blockers. Três nits: `h5/h6/dt` fora da regra; o teste não varria `.css`; a regex não pegava `font-[650]`. Mais 2 comentários inline (`globals.css:139`, `tipografia.test.ts:36`).
   - **R2**, review `COMMENTED` de 24/09 00:40:00, "APPROVE in substance (R2)": os 3 nits estão FIXED em `45944e4e`. `legend`/`caption` ficam fora.
   - Os checks do GitHub estão vazios nas duas rodadas.
   - **Entrou sem APPROVE formal** por causa do 422 (o revisor é o autor). As reviews dizem ser automatizadas: "Cursor GitHub".
5. **Testes e travas:** `src/app/tipografia.test.ts` (novo, +41). Mutações: R1 com **2 mortas** (voltar um `font-semibold`; tirar `strong`); R2 com **1 morta** (`font-weight: 600` em CSS). Total de 3 mortas e 0 sobreviventes reportados.
6. **Pendências:** `legend`/`caption` fora da regra (residual aceito na R2). Variantes exóticas (`fontWeight:"700"` com aspas tipográficas) também não são pegas. Não há issue.
7. **Publicação:** está na `main`, então foi para o UAT. Só CSS, fontes e teste.
8. **Riscos e observações:** a remoção dos OTF é irreversível sem histórico, mas a trava impede que voltem. O efeito visual (tudo em 500) não foi verificado em navegador.

---

#### PR #80 — test(ux-6): trava da paleta do design system

1. **Identificação**
   - Aberta em 23/09 18:42:20 e mergeada em 24/09 00:45:38.
   - Base `main`, head `claude/pr14-trava-paleta`. Merge `c9d2f67c`.
   - Commits: `2053c66d`, `774a3a4d` (R2) e `04daa9ef` (merge da `main` na branch, feito pelo usuário às 00:45:02).
   - Tamanho: 3 arquivos, +69 / −1.
   - Área: trava de design system (`src/app/paleta.test.ts`), `docs/18` e skip link.
2. **Objetivo e o que entrou**
   - Detector que lê o mapa de cores do `tailwind.config.ts`. Ele falha com cor ou shade fora do mapa (com qualquer variante), com `shadow-*` e com hex. Na R2 passou a pegar também `drop-shadow`, `shadow-[…]`, `rgb()` e `hsl()`.
   - Varre `src/app`, `src/components` e `src/lib`.
   - A única violação encontrada foi `focus:shadow` no skip link da #71, trocado por `focus:border focus:border-gray-300` na R2.
   - O corpo condiz com o diff. O corpo não menciona a R2 (`gray-300`, rgb/hsl), mas os commits sim.
3. **Rastreabilidade:** doc 42 G6 segunda metade (L38: "adicionar ao CI um grep"). Doc 43:112: shades 0 ✅, "trava `paleta.test.ts`, #80".
4. **Revisão (no GitHub)**
   - **R1**, review `COMMENTED` de 23/09 23:26:46, "APPROVE in substance", sem blockers. Cinco nits: `drop-shadow` e `shadow-[…]`; hex apenas; comentário que cita classe proibida falha; `shadow` morto no regex de cor; borda do skip link sutil. Mais 3 comentários inline. A review se identifica como "Grok Bot".
   - **R2**, review `COMMENTED` de 24/09 00:40:31, "APPROVE in substance (R2)": 4 nits FIXED. O nit de comentário de código ficou **STILL OPEN**, como tradeoff aceito.
   - **Entrou sem APPROVE formal** (422 de própria PR).
5. **Testes e travas:** `src/app/paleta.test.ts` (novo, +64), com teste do próprio detector. Mutação: **1 morta** (voltar o `focus:shadow`).
6. **Pendências e situação hoje**
   - A varredura por linha falha em comentário que cita classe proibida. Continua assim, e "hoje não há nenhum".
   - Nomes CSS (`bg-[red]`) não são pegos, o que está declarado num comentário.
   - `src/server` está fora da varredura.
   - Cosmético: o `it()` ainda diz "sombra e hex".
   - Não há issue.
7. **Publicação:** está na `main`, então foi para o UAT (o skip link mudou). Só teste e `.tsx`.
8. **Riscos e observações:** é a trava mais reutilizada depois. As #145, #156 e #157 a citam nas listas de verificação. O doc 43 a reproduz em `metricas.mjs`.

---

#### Tabela-resumo da faixa

| PR | Título curto | Área | Rodadas (fonte) | Veredito final | Publicado (`main`/UAT) | Pendências abertas hoje |
|---|---|---|---|---|---|---|
| #63 | Doc 42: auditoria UI/UX | docs | 0 | sem review | sim (só doc) | medida no doc 43: 87/145 Alta abertos |
| #64 | Bordas de rota | shell, portal, guard | R1 (commit) | sem review no GitHub | sim | `error`/`loading` fora do shell; `<Suspense>`=0; `/portal` legado (`sessao.ts:153`); esqueletos de 4 áreas |
| #65 | brand-solid (empilhada) | DS | 0 | sem review | **não** (merge em branch órfã) | substituída pela #66 |
| #66 | brand-solid reaplicada | DS, ~100 telas | R1, R2 (commits) | sem review no GitHub; débito aceito | sim | chips: fechado pela #156; `--brand-solid` reinterpretado pela #157; `docs/18:67` obsoleto |
| #67 | Shades fora do mapa | DS, 29 telas | 0 | sem review | sim | borda `*-200` = cor de fundo (decorativa) |
| #68 | CampoMoeda | financeiro, comercial, matrícula | R1, R2, R3 (commits) | sem review no GitHub | sim | `"1.23"` ainda ambíguo; arredondamento CRC/CLP no blur |
| #69 | CampoFuso / fuso institucional | acadêmico | R1, R2 (commits) | sem review no GitHub | sim | fallback UTC em `avaliacoes/[codigo]/page.tsx:22` (hoje anunciado); 3 campos fechados pela #159 |
| #70 | RASCUNHO no encontro | segundas chamadas | R1 (commit) | sem review no GitHub | sim | nenhuma (código substituído pela #138) |
| #71 | Sidebar a11y + skip link | shell | R1 (commit) | sem review no GitHub | sim | nenhuma (`focus:shadow` corrigido pela #80) |
| #72 | Duplo clique no financeiro | financeiro | R1 (commit) | sem review no GitHub | sim | nenhuma da PR; confirmação feita pela #154 |
| #73 | `permissoes` no select | sessão (servidor) | R1 (commit) | sem review no GitHub | sim | `cache` fechado pela #91; 3 `findUnique` de `permissoes` em outras páginas; `permissoes?` opcional |
| #74 | Polling e ordem da inbox | inbox (servidor) | R1 (commit) | sem review no GitHub | sim | gate de visibilidade sem teste |
| #75 | Tabelas `overflow-x` | listas | R1 (commit) | sem review no GitHub | sim | nenhuma (trava da #94) |
| #76 | Login e listas a11y | login, listas | R1 (commit) | sem review no GitHub | sim | `empty:hidden` corrigido pela #83; resto fechado pelas #82–#84 |
| #77 | Resultado incerto | acadêmico, secretaria | R1 (commit) | sem review no GitHub | sim | avulsa em `ConferirReserva.tsx:18` |
| #78 | `min` cruzado em datas | vários formulários | R1 (commit) | sem review no GitHub | sim | prorrogação sem `min`; designação sem `max`=agora |
| #79 | Pesos 400/500 | tipografia | R1, R2 (GitHub) | APPROVE in substance (COMMENT, 422) | sim | `legend`/`caption` |
| #80 | Trava da paleta | DS (teste) | R1, R2 (GitHub) | APPROVE in substance (COMMENT, 422) | sim | comentário que cita classe; `bg-[red]`; `src/server` fora |

Mutações reportadas na faixa: **6 mortas** (#76: 1, #77: 1, #79: 3, #80: 1) e **0 sobreviventes declaradas** pelo autor. As revisões, porém, acharam **3 mutantes sobreviventes**, todos mortos depois: o mock do `select` na #73, a ordem do mock na #74 e 4 mensagens que a trava R0 da #77 deixava passar.

#### Pendências que continuam abertas hoje (conferidas na `main` `e5418550`)

1. **Rotas fora do shell sem `error.tsx`/`loading.tsx`** (#64): `/`, `/login`, `/pagar/[token]`, `/certificado/[codigo]` e `/portal`. O `git ls-tree origin/main src/app` não mostra esses arquivos nesses segmentos; só `not-found.tsx` e `global-error.tsx` na raiz.
2. **Esqueletos próprios ausentes** em `matriculas/`, `academico/`, `diario/` e `secretaria/` (#64 e #81). Os únicos `loading.tsx` estão em `(app)`, `alunos/(lista)`, `financeiro/(painel)`, `financeiro/continuidade`, `inbox`, `leads/(lista)`, `pipeline`, `segundas-chamadas/minhas` e `portal-aluno`.
3. **`<Suspense>` = 0** em `src` (#64; meta do doc 42 L34).
4. **`/portal` legado:** `src/server/_shared/sessao.ts:153` ainda faz `redirect("/portal")` sem explicar o acesso (L2593 parcial, #64).
5. **`parseMoeda("1.23")` aceita 1,23** (`src/lib/dinheiro.ts:99-103`). Isso contraria a afirmação do corpo da #68 de que o "resíduo de 2 dígitos" estaria fechado.
6. **Arredondamento silencioso no blur em moeda sem centavos** (`dinheiro.ts:114-116` com `toFixed(0)`, chamado por `CampoMoeda.tsx:54`; #68).
7. **Fallback para UTC sem fuso da escola** em `academico/avaliacoes/[alocacaoId]/[codigo]/page.tsx:22`. Hoje é anunciado (`:25-27`), mas a entrada continua em UTC (#69).
8. **Prorrogação sem `min` igual ao prazo vigente:** `recuperacoes/planos/[propostaId]/prorrogacoes/Formularios.tsx:24` (L1566 parcial; #78).
9. **Designação de segunda chamada sem `max`=agora no início:** `segundas-chamadas/propostas/[propostaId]/designacao/Formulario.tsx:55` só tem `min` no fim (#78).
10. **Mensagem avulsa de resultado incerto** em `secretaria/reservas/ConferirReserva.tsx:18`, fora das constantes e fora da trava, porque não está num `catch` (#77; doc 43:131 ◐).
11. **Leituras extras de `permissoes`** (o mesmo padrão que a #73 eliminou) em `alunos/[id]/financeiro/page.tsx:40`, `alunos/[id]/movimentacoes/page.tsx:47` e `financeiro/permuta/page.tsx:15`. `UsuarioSessao.permissoes?` continua opcional (`sessao.ts:18`).
12. **`docs/18-design-system.md:67` obsoleto:** diz que `--ai-solid` "não inverte — mesma lógica de `--brand-solid`", mas `--brand-solid` passou a ter valor por tema (#157; `globals.css:42,94`).
13. **Branches órfãs no remoto:** `claude/pr1-bordas-de-rota` (contém o merge `ebcd5e01` da #65) e `claude/pr2-brand-solid-shell`.
14. **Travas com limite declarado:**
    - `paleta.test.ts` falha em comentário que cita classe proibida, não pega nomes CSS (`bg-[red]`) e não varre `src/server` (#80);
    - `tipografia.test.ts` não cobre `legend`/`caption` (#79);
    - `mensagens.test.ts` só olha blocos `catch` (#77).
15. **Processo** (não é código, mas continua sem registro): nenhuma das 18 PRs está no `docs/planejamento/quadro-entregas.md`. As #64–#67 foram verificadas com `npx` e banco de produção, o que foi admitido na #68 e contraria o AGENTS.md.

**Fechadas depois, para não contar como abertas:**
- chips `bg-brand-600` e `--border-control` < 3:1, pela #156;
- `cache()` de sessão, pela #91;
- fuso dos 3 campos sem padrão, pela #159;
- drawer da `FichaAluno` e live regions, pelas #82–#84;
- `empty:hidden` da #76, pela #83 (`219d7ff6`);
- confirmação de "Fechar mês", pela #154 (`a5045bba`);
- unificação das redações de resultado incerto, pela #118;
- trava de responsividade, pela #94.

---

### 7.2 PRs #81–#98

Data da análise: 13/10/2026. `origin/main` em `e5418550`, depois de `git fetch --all`.

Fontes usadas: `gh pr view N --json …` (corpo, revisões, comentários, commits e arquivos), `gh pr diff N --name-only`, `gh api …/pulls/N/reviews|comments`, `git log`/`git show origin/main:<arquivo>`, `docs/42-auditoria-frontend-ux.md` (doc 42) e `docs/43-medicao-auditoria-ux.md` (doc 43, medição de 07/10 sobre `6b105093`).

#### Convenções e fatos gerais da faixa

- **Os 18 números são PRs.** Nenhum deles é issue. Todos estão `MERGED`, com base `main` e autor `diogenesmendes01`.
- **Squash x merge.** #79, #80, #81 e #82 são squash: cada commit tem um pai só e encadeia no anterior (`e9b1c29d` → `c9d2f67c` → `b91359aa` → `a4e9f7ba`). As quatro estão na `main` (`git merge-base --is-ancestor` → 0). Da #83 em diante entram por merge commit ("Merge pull request #N").
- **Publicação.** O merge commit das 18 PRs é ancestral de `origin/main`. Como toda a `main` vai para o UAT, as 18 estão publicadas.
- **Nenhuma mexe em `prisma/`, schema ou migration.** Mexem em servidor (`src/server/**`, `src/app/api/**`, `src/lib/guards.ts`): #88, #90, #91, #92, #93, #95 e #98. As outras são só cliente ou teste.
- **`*.int.test.ts`.** Só `src/app/api/exportacoes/[tipo]/route.int.test.ts` foi alterado, pela #92, #93 e #95. Esse teste **nunca rodou** nessas PRs: elas declaram que ele "exige banco", e a #119 explica que a variável de conexão do banco do ambiente aponta para produção. O `vitest.config.ts` da `main` exclui `src/**/*.int.test.ts`.
- **CI.** Nenhuma das 18 teve CI: toda revisão registra "0 check runs". O workflow `.github/workflows/ci.yml` só entrou em 07/10/2026 (`a08da204`). O que vale como evidência de tsc/vitest é o que o autor e o revisor relatam.
- **APPROVE formal.** Autor e revisor são a mesma conta, então o GitHub recusa APPROVE e REQUEST_CHANGES (erro 422). Todas as revisões são `COMMENTED`, e o veredito vem escrito no texto. Por isso **nenhuma PR da faixa tem APPROVE formal**. Abaixo, "APPROVE" quer dizer o veredito escrito na revisão.
- **Revisões fora do GitHub.** Da #83 à #91 não há nenhuma revisão no GitHub (`pulls/N/reviews` = 0). Existe só o comentário do autor "Revisão atendida em …", respondendo a uma revisão que não ficou registrada. A #92 tem só a R3 no GitHub. Da #93 à #98 as rodadas estão completas no GitHub.
- **Rastreabilidade.** Nenhuma PR cita linha `L…` do doc 42 nem Q-id da SPEC. A única exceção é a #93, que menciona Q23, Q92 e Q165, mas como códigos a **remover da tela**. As PRs citam o ganho rápido (GR) ou o projeto estrutural (E1–E8) do doc 42. O vínculo com as linhas `L…` vem da tabela 4.1 e da 5.1 do doc 43, que é posterior. Linhas do doc 42 para cada item: ranking #2 L19, #4 L21, #7 L24, #9 L26, #10 L27; GR2 L34, GR15 L47, GR19 L51, GR20 L52, GR21 L53, GR23 L55; E2 L70, E3 L80, E4 L90, E5 L100, E6 L110, E7 L120, E8 L130.
- **Processo (AGENTS.md).** Nenhuma das 18 PRs alterou `docs/` (verificado com `gh pr diff --name-only`). Com isso, nenhuma atualizou `docs/planejamento/quadro-entregas.md`, que o AGENTS.md exige ("Commit por funcionalidade, com evidências e pendências no quadro único"). As evidências e as pendências ficaram só no corpo e nos comentários das PRs.
- **Issues.** Nenhuma issue foi aberta por causa destas PRs. Procurei `#81`–`#98` em todas as issues e não há nenhuma referência. As issues abertas hoje são #141, #152 e #162, de outras PRs. Os follow-ups desta faixa foram tratados em PRs posteriores (#101, #107, #109, #111, #118, #119, #120, #138, #153, #154, #160), apontadas em cada seção.

---

#### #81 — feat(ux-2): esqueletos de carregamento no formato de cada tela

**1. Identificação**
- Aberta em 23/09 18:47Z e mergeada em 24/09 00:46Z, com squash `b91359aa`. Branch `claude/pr15-esqueletos`.
- 13 arquivos, +186/−18.
- Área: estados de rota em `/alunos`, `/leads`, `/financeiro`, `/inbox` e `/pipeline`.

**2. Objetivo e o que entrou**
- O objetivo era o GR2, segunda parte: esqueletos próprios onde o formato da tela difere do `(app)/loading.tsx` genérico.
- Novo `src/components/Esqueleto.tsx`, com quatro formatos: `EsqueletoLista`, `EsqueletoAbas`, `EsqueletoConversas` e `EsqueletoColunas`. Todos usam `aria-busy` e `<p role="status" class="sr-only">Carregando …</p>`.
- Decisão estrutural: as páginas-índice foram movidas por `git mv` para grupos de rota (`alunos/(lista)`, `leads/(lista)`, `financeiro/(painel)`), com a URL inalterada. Assim o `loading.tsx` não vaza para as filhas.
- A R1 pediu e o commit `1c0d27b3` fez: `pipeline/colunas.ts` extrai `COLUNAS` (9 etapas) do `KanbanBoard`, e `pipeline/loading.tsx` passa `colunas={COLUNAS.length}`.
- Divergência leve: o corpo informa 2146 testes; o commit da R2 informa 2147.

**3. Rastreabilidade**
- GR2 (L34) e ranking #2 (L19).
- No doc 43: L2190 (`/leads`, Média) fica **parcial**, creditado a "#64/#81", porque `leads/[id]` não tem `loading.tsx` próprio. Na 7.1, o `loading.tsx` aparece como ◐: 9 arquivos, contra a meta de ≥ 14.

**4. Revisão**
- R1 (`4734e443`): APPROVE em substância, com 4 nits. Os comentários inline estão em `Esqueleto.tsx:89`, `:62` e `pipeline/loading.tsx:4`: 5 colunas contra as 9 reais, a inbox sem o título, a falta de `animate-pulse` e a regex de a11y que dependia da ordem dos atributos.
- R2 (`1c0d27b3`): APPROVE. Os nits foram corrigidos em `1c0d27b3`. A falta de `animate-pulse` ficou de propósito.
- Não houve blocker.

**5. Testes e travas**
- `Esqueleto.test.ts` trava a regra estrutural: loading de formato específico só no grupo da página-índice, nunca na raiz da seção.
- Nenhuma mutação foi reportada.

**6. Pendências**
- Ficaram sem esqueleto próprio, de propósito, `matriculas`, `academico`, `diario` e `secretaria`, cobertos pelo genérico.
- Na `main` de hoje continuam sem `loading.tsx` próprio: `/matriculas/[id]`, `/academico`, `/diario`, `/secretaria` e `/configuracao` (é o item 10 do doc 43 §6). Os `loading.tsx` que existem hoje são 9 (`git ls-tree`).

**7. Publicação**
- Está na `main` e no UAT. Não mexe em servidor nem em schema.

**8. Riscos e observações**
- **Conflito com a #109** (E8 definitivo, 25/09). O `/financeiro` passou a ter `(painel)/layout.tsx`, que desenha o título "Financeiro" e a `BarraAbasFinanceiro`. O `(painel)/loading.tsx` da #81 continua com `EsqueletoAbas`, que desenha título + 5 abas + tabela (`Esqueleto.tsx:47-56`). Como o loading de um segmento fica **dentro** do layout desse segmento, a troca de aba deve mostrar o título e a barra reais com um **segundo** título e uma **segunda** barra falsos logo abaixo.
  - Isso é leitura de código; não vi no navegador.
  - Hoje o esqueleto certo para esse segmento seria só a tabela.

---

#### #82 — fix(ux-19): ficha do aluno — 26 rótulos do painel de edição ligados aos campos

**1. Identificação**
- Aberta em 23/09 18:50Z e mergeada em 24/09 00:47Z, com squash `a4e9f7ba`. Branch `claude/pr16-ficha-rotulos`.
- 2 arquivos, +74/−57.
- Área: `/alunos/[id]` (`FichaAluno.tsx`).

**2. Objetivo e o que entrou**
- Os 26 pares `<label htmlFor>`/`id="ficha-<campo>"`. O id sai de `ed.<campo>`.
- `SelectISO` passa a aceitar `id` e o repassa ao `<select>`.
- `aria-describedby` nas ajudas de documento e de motivo, e `role="alert"` no erro da ficha.
- Na R2 (`05e04682`) entrou `aria-required="true"` no `#ficha-motivo`.
- O corpo e o diff batem.

**3. Rastreabilidade**
- GR19 (L51), a parte que tinha ficado de fora da #76.
- No doc 43 §7.4, "Controles sem nome" fica ✅, creditado a #76 e #82–84.

**4. Revisão**
- R1 (`39d443de`): APPROVE em substância, com 3 nits. O inline está em `FichaAluno.tsx:405` (falta `aria-required`).
- R2 (`05e04682`): APPROVE. O nit 1 foi corrigido. Ficaram de propósito o nit 2 (formatação) e o nit 3 (o 26 fixo no teste).

**5. Testes e travas**
- `FichaAluno.test.ts` exige exatamente 26 `for="ficha-…"`, cada um com um `id` único, e as duas ligações por `aria-describedby`.
- Mutação: tirar um `id` faz o teste falhar (1 morta).

**6. Pendências**
- Os selects e os erros do resto do app foram para a #83 e a #84, que fecharam esse ponto.

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- O teste conta 26: qualquer campo novo no painel exige atualizar o número. Isso é intencional.
- A #87 depois mexeu no mesmo arquivo (`FeedbackAcao` dentro do Drawer) e declara ter preservado os 26 `ficha-*`.

---

#### #83 — fix(ux-19): resultado de ação anunciado — 33 erros com role="alert", 11 avisos com região polite

**1. Identificação**
- Aberta em 24/09 12:21Z e mergeada às 12:55Z, com o merge `460192d6`. Branch `claude/pr17-a11y-restante`.
- **128 arquivos**, +401/−158.
- Área: transversal (acadêmico, alunos, configuração, diário, empresas, financeiro, inbox, leads, matrículas, secretaria, login, `/pagar`, portal).

**2. Objetivo e o que entrou**
- Erros: `role="alert"` em 33 ocorrências, espalhadas por 32 arquivos.
- Sucesso e aviso: o novo `src/components/MensagemStatus.tsx` cria uma região `sr-only` sempre montada, com a mensagem visível em `aria-hidden` e uma prop `progresso` opcional. Ele substituiu **110 ocorrências em 91 arquivos** (`{x && <p role="status">…}`) e mais 11 avisos que estavam mudos.
- Também corrige um erro da própria #76: o login usava `empty:hidden` na região polite, e isso tirava a região da árvore de acessibilidade. Agora usa `empty:mt-0`.
- `TrocaFonteReposicao` virou `<p>` comum, porque o aviso não é resultado de uma ação.
- **Divergência entre título e conteúdo.** O título fala em "11 avisos com região polite", mas a PR cresceu na revisão (`219d7ff6`) para migrar 110 avisos. O corpo foi atualizado; o título não.

**3. Rastreabilidade**
- GR19 (L51): "role=alert nos 34 componentes".
- No doc 43 §7.4, "Telas com erro/sucesso sem live region" caiu de 34 para 0, contando `MensagemStatus` e `FeedbackAcao`. Fica ◐, com uma ressalva: em uns 12 formulários o **erro** sai num `MensagemStatus` (`role="status"`, sem cor). Esse defeito de padrão nasceu aqui e só foi corrigido pela #153 (item 2 do doc 43 §6).

**4. Revisão**
- Não há nenhuma revisão no GitHub.
- O comentário do autor (12:32Z) responde a uma revisão de fora do GitHub em quatro pontos: endurecer o teste, migrar os 110 avisos, deixar os erros do react-hook-form para a #84 e o `empty:mt-0` do login.
- Depois veio mais um commit sem comentário (`48cfc594`), em que o teste passa a ler o bloco condicional inteiro. Isso indica uma segunda rodada.
- Nenhum veredito ficou registrado.

**5. Testes e travas**
- Nova trava `src/app/anuncios.test.ts`. Ela exige:
  - todo erro condicional tem `role` ou `aria-live`;
  - nenhum sucesso é um `<p>` condicional mudo;
  - em tela cliente, nenhuma região polite é montada junto com o texto (`&&` e ternário, com o bloco inteiro lido);
  - nenhuma região polite usa `hidden`/`empty:hidden`.
- Mutações relatadas, 6, todas mortas: tirar o `alert`, voltar o `empty:hidden`, `FichaEmpresa`, `ChamadaEncontro` e as duas formas de fragmento em `RecebimentoDestinadoForm`.

**6. Pendências**
- Os ~42 selects com label irmão e os erros do react-hook-form foram para a #84, que os fechou.
- O `MensagemStatus` com variante de erro foi sugerido na #84 e nunca criado. A separação entre erro e sucesso foi resolvida pela #153 (08/10).

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- Com `aria-hidden` na mensagem visível e o texto copiado numa região `sr-only` absoluta, quem usa leitor de tela navegando pelo conteúdo (e não pela região anunciada) não "vê" a mensagem no ponto em que ela aparece.
- 128 arquivos sem CI e sem revisão registrada no GitHub. A evidência é o relato do autor (vitest 2162/2162).
- Os 5 erros de eslint são declarados como anteriores à PR (`acertos-vencimento/…/Formulario.tsx` e `useMemo` de fuso).

---

#### #84 — fix(ux-19): rótulos ligados aos campos (216 em 25 telas) e erros de campo anunciados

**1. Identificação**
- Aberta em 24/09 13:05Z e mergeada às 13:25Z, com o merge `0bdeca42`. Branch `claude/pr18-rotulos-campos`.
- 27 arquivos, +465/−266.
- Área: formulários de matrícula, lead, turma, país, modalidade, usuário e preços, ficha financeira, `PagamentoModal`, modais de importação, WhatsApp e inbox.

**2. Objetivo e o que entrou**
- **216 pendências**, de três tipos:
  - `htmlFor`/`id`, com id fixo prefixado pela tela ou `useId()` nos componentes que se repetem;
  - `aria-label` ou `aria-labelledby` nos campos que só tinham placeholder;
  - `<label>` que não nomeava nada virou elemento comum.
- "Papéis" passou a `<fieldset><legend>`.
- O `Campo` da matrícula entrega o `id` aos filhos por *children as function*.
- 17 erros do react-hook-form ganharam `role="alert"`, com `aria-invalid` e `aria-describedby` no campo.
- `aria-required` nos campos marcados com `*` e no "Motivo (obrigatório)" da `FichaFinanceira`.

**3. Rastreabilidade**
- GR19 (L51) e E7 (L120: "198 campos sem nome… wrapper `Campo` da matrícula quebra 24").
- No doc 43:
  - L471 (`/matriculas/nova`) **parcial**: o `Campo` liga, mas emergência e responsável seguem com placeholder como único rótulo visível;
  - L1184 (`historica`) **parcial**: só `aria-label`.
- Na 7.4, `aria-invalid` sobe de 0 para 22 (◐).

**4. Revisão**
- Não há revisão no GitHub.
- O comentário do autor (13:14Z) responde a 5 pontos de uma revisão externa:
  - `aria-required` no motivo;
  - fim da isenção geral para `id={variável}`;
  - `htmlFor`↔`id` comparados pela expressão inteira;
  - "Papéis" em `fieldset`;
  - `role="alert"` contra a região polite, que fica como está.
- O commit é `83499847`.

**5. Testes e travas**
- Nova trava `src/app/rotulos.test.ts`:
  - todo `input`, `select` e `textarea` tem nome;
  - componente que repassa `id` é detectado pela assinatura, e cada uso dele é conferido;
  - não há `<label>` solto;
  - todo `htmlFor` aponta para um `id` existente, comparado pela expressão inteira.
- `anuncios.test.ts` ganhou o caso `errors.campo`.
- Mutações, 5, todas mortas: `htmlFor` e `role="alert"` em `UsuarioFormulario`, `<input id={x}>` sem rótulo, erro de digitação no template do `htmlFor` e `<CampoFuso>` sem id.

**6. Pendências**
- Unificar o padrão de erro (`MensagemStatus` com variante de erro) ficou "numa PR separada". Isso não foi feito nessa forma: o erro passou a sair pelo `FeedbackAcao` (#85 e #153).
- O `Campo` unificado com `useId` (E1/E7) foi feito na #145.

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- A trava compara expressões de texto. Ela não prova que o `id` renderizado é único na página quando o mesmo formulário aparece duas vezes. O `useId` só foi usado onde o autor previu repetição.
- O doc 43 aponta 0 controles sem nome, com 7 falsos positivos verificados. A trava se manteve.

---

#### #85 — feat(e3): padrão único de ação no cliente — useAcaoCliente + FeedbackAcao nas telas de dinheiro

**1. Identificação**
- Aberta em 24/09 13:34Z e mergeada às 14:05Z, com o merge `e8a4f8c2`. Branch `claude/e3-acao-cliente`.
- 13 arquivos, +467/−100.
- Área: `PagamentoModal` (ficha financeira, fila de cobrança e inbox), `FichaFinanceira`, `ResumoFinanceiroComercial`, `ConcluirMatriculas`, `FichaEmpresa`, `AlterarQuantidadeAulas` e `InboxCliente`.

**2. Objetivo e o que entrou**
- `src/lib/acao-cliente.ts`:
  - `executarAcaoCliente(acao, { idempotente })`, que devolve `ok | erro | incerto` (`acao-cliente.ts:28-33`);
  - `criarExecutor`, a lógica sem React, com trava de duplo clique e `finally` (`:48`);
  - `useAcaoCliente` (`:75`).
- `idempotente` é **obrigatório** e escolhe entre duas mensagens: `MSG_RESULTADO_INCERTO` e a nova `MSG_RESULTADO_INCERTO_SEM_CHAVE` (`src/lib/mensagens.ts`).
- `src/components/FeedbackAcao.tsx`: o erro sai em `role="alert"` e recebe `scrollIntoView({block:"center"})` e `focus()` (`FeedbackAcao.tsx:22-29`). A região polite só existe se a tela passa `sucesso`/`progresso`.
- Correções de comportamento:
  - o erro do `PagamentoModal` vai para dentro do modal, e a prop `onErro` sai dos 3 chamadores;
  - `FichaEmpresa` travava inteira numa falha de rede;
  - `AlterarQuantidadeAulas` gerava `crypto.randomUUID()` a cada clique, o que duplicava a proposta. Agora a chave acompanha a assinatura da entrada.
- Na revisão (`7531ae2f`), o callback `aoConcluir` virou "mensagem de sucesso", e os efeitos (`onDone`, refresh, navegação) passaram a rodar depois do `await`.

**3. Rastreabilidade**
- E3 (L80), ranking #4 (L21) e #7 (L24), e GR20 (L52), em parte: cria a variante sem chave.
- No doc 43, **resolvidos** L294, L295, L1204 e L1205. Na 7.6, `.focus()`/`scrollIntoView` ✅ e "sem catch" ◐.

**4. Revisão**
- Não há revisão no GitHub. Houve 2 rodadas externas, respondidas em comentários (13:50Z e 14:04Z).
- Os pontos da R1 e os commits que os resolveram:
  - os efeitos dentro do `aoConcluir` foram resolvidos em `7531ae2f`;
  - o teste de catch contava texto e comentário; passou a contar só código em `7531ae2f`;
  - o comportamento do hook não tinha teste, porque não há jsdom. A lógica foi extraída para `criarExecutor`, que é testado.
- A R2 tratou do comentário do `FeedbackAcao` (`3cdf29dc`).
- Nenhum veredito ficou registrado.

**5. Testes e travas**
- Nova trava `src/app/acoes-cliente.test.ts`, com um passivo de **48 arquivos numa lista que só pode diminuir**.
- `src/lib/acao-cliente.test.ts` cobre os desfechos e o executor.
- Mutações relatadas, cerca de 6, todas mortas:
  - componente novo sem `catch`;
  - pendente da lista que passou a tratar;
  - `// } catch {` em comentário e `"useAcaoCliente("` em string não contam como tratamento;
  - tirar a trava de duplo clique;
  - não liberar o `ocupado`.

**6. Pendências**
- Os outros 48 arquivos foram tratados na #86 e na #87.
- **Actions sem chave de idempotência que merecem uma** (`DecidirSubstituicao`, a decisão da `JanelaFormulario` e a realização da segunda chamada) ficaram para "coordenação técnica".
  - Hoje as duas primeiras usam `MSG_DECISAO_INCERTA`, introduzido pela #118. Ou seja, foram tratadas como decisão, não como chave.
  - A mudança de contrato no servidor nunca aconteceu.

**7. Publicação**
- Está na `main` e no UAT. Só cliente. Não mexe nas actions.

**8. Riscos e observações**
- O `executar` só aceita **mensagem**, e o efeito fica no chamador. Se uma tela esquecer de testar `d?.tipo === "ok"` antes do efeito, o efeito roda numa falha. O padrão depende de disciplina, e a trava não verifica isso.
- `idempotente: true` em `AlterarQuantidadeAulas` depende da assinatura da entrada. O autor conferiu `preparadorId_chaveIdempotencia` no servidor.

---

#### #86 — feat(e3): /configuracao no padrão de ação — 18 telas migradas

**1. Identificação**
- Aberta em 24/09 14:11Z e mergeada às 15:11Z, com o merge `21db3613`. Branch `claude/e3-configuracao`.
- 21 arquivos, +371/−315.
- Área: `/configuracao` (catálogo, países, usuários, turmas, operação, migração e WhatsApp).

**2. Objetivo e o que entrou**
- 18 telas migradas para `useAcaoCliente` + `FeedbackAcao`. O passivo da trava cai de 48 para 30.
- Uma tabela no corpo justifica `idempotente` action por action:
  - migração com `true`, porque `chaveLote` é estável (`server/migracao/acoes.ts:44-57`);
  - todo o resto com `false`.
- Correções:
  - `TemplatesPainel` fechava o formulário mesmo quando falhava;
  - o kill switch e ativar/desativar usuário ganharam `disabled`;
  - "Lendo…" e "Preparando…" passaram a ter estados separados.
- Novo `src/lib/busca-recente.ts` (`criarBuscaMaisRecente`): uma resposta antiga não sobrescreve a nova na busca por tecla da régua. Ele cancela ao desmontar.
- Duas chamadas ficam fora do hook, de propósito, com `executarAcaoCliente`: o polling do QR e a busca por tecla.
- **Divergência ou afirmação imprecisa.** O corpo e o comentário afirmam que "repetir `editarPais` recria os tipos de documento, porque o pai os envia sem `id`". Mas `src/server/paises/tipos-documento.ts` (`planejarTiposDocumento`, presente desde `afc9a42d`, 16/09, e já usado por `editarPais` em `21db3613`) **casa por `nome`+`validador` quando falta o `id`**. Um reenvio idêntico atualiza, não recria. O defeito real é outro; está no item 8.

**3. Rastreabilidade**
- E3 (L80).
- No doc 43:
  - L2469 (migração) **resolvido**;
  - L2442 (operação) **parcial**: `Prazos*` ficaram de fora e foram fechados pela #153;
  - L2430 (países, Média) **parcial**.
- Na 7.6, "alto impacto: só estado de ocupado (#72, #86, #87)".

**4. Revisão**
- Não há revisão no GitHub. Houve 2 rodadas externas.
- R1, respondida às 14:49Z com o commit `c8f3296b`:
  - busca com `buscaSeq`;
  - "Novo template" desativado durante a ação;
  - erro do template dentro do card;
  - chave de lote vazia recusada no cliente;
  - confirmação curta nos toggles.
- R2, respondida às 15:02Z com o commit `68e551fa`: a proteção da busca virou função pura testada, cancela ao desmontar e limpa as opções quando a busca atual falha.

**5. Testes e travas**
- `busca-recente.test.ts`.
- A lista de pendentes de `acoes-cliente.test.ts` foi reduzida.
- Mutações: tirar a comparação de sequência e esvaziar o `cancelar()` (2 mortas).

**6. Pendências**
- Chaves de idempotência para catálogo e WhatsApp, e o `editarPais`, foram declarados como correção de servidor futura.
- Na `main` de hoje, todos os painéis de catálogo e WhatsApp continuam `idempotente: false` (`IdiomasPainel.tsx:27`, `PrecosPainel.tsx:48`, `TemplatesPainel.tsx:54`, …). **Continua aberto.**
- Os toggles e o encerramento de país sem confirmação foram tratados depois pela #154 (`ConfirmarAcao`).

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- **O defeito real de países, achado nesta leitura.** `PaisesPainel.tsx:160-163` monta o `inicial` do formulário **sem o `id`** dos tipos de documento (`tiposDocumento: p.tiposDocumento.map((d) => ({ nome, validador }))`), embora `configuracao/paises/page.tsx:18` traga o `id`.
  - Com isso, **renomear** um tipo de documento já usado por algum aluno não casa com nenhum existente.
  - O planejador então tenta remover o antigo e o servidor recusa: "Não é possível excluir tipo de documento usado por alunos".
  - Nada disso é reenvio; é a pendência descrita com o motivo errado.
- Toggle com `idempotente: false`: um reenvio depois de um resultado incerto desfaz o toggle. A mensagem "confira antes de repetir" é a única proteção.

---

#### #87 — feat(e3): últimos 30 componentes no padrão de ação — passivo zerado

**1. Identificação**
- Aberta em 24/09 15:23Z e mergeada às 18:37Z, com o merge `ee8ac2e9`. Branch `claude/e3-restante`.
- 33 arquivos, +682/−520.
- Área: recuperações, fechamento e replanejamento do acadêmico; `FichaAluno`; portal do aluno; financeiro (acesso a aulas, retomadas, informes, comissões, `FinanceiroPainel`); inbox; leads; kanban; contrato; matrícula nova; home do professor; preferências; copiloto.

**2. Objetivo e o que entrou**
- Zera o passivo do E3: 54 → 48 → 30 → 0. A trava deixa de ter lista de exceções.
- `idempotente` justificado com a linha do servidor (`fechamento.ts:38-43`, `excecao-admissao.ts:29-30`, `originais.ts:27-28`, …). **Todas as decisões ficam `false`.**
- Correções:
  - erro da `FichaAluno` dentro do Drawer, e "Confirmar pausa/encerramento" com estado de ocupado;
  - o modal de perda do kanban não fecha mais numa falha;
  - `FichaLead` e `CopilotoSugestoes` não perdem mais o texto numa falha;
  - `MatriculaFormulario` continua travado até a navegação terminar;
  - o portal só faz refresh no sucesso.
- O R1 (`6e1b9a2c`) acrescentou três coisas:
  - `FinanceiroPainel` (câmbio, comissões e aprovações) no hook, trocando o `ocupadoRef` manual;
  - a trava passa a aceitar `catch` só quando o `try` tem `await`/`.then(`, e só cobra quem importa um módulo `"use server"`;
  - `FusoExibicaoFormulario`, um caso real encontrado pela regra nova.
- Mais: `useDraggable({ disabled })` no kanban enquanto há uma ação, e `acao.limpar()` ao fechar o Drawer.
- **Conflito com a #88.** Resolvido por rebase depois que a #88 entrou (comentário das 18:31Z).

**3. Rastreabilidade**
- E3 (L80) e GR23 (L55), em parte: o `FinanceiroPainel` passa a usar o executor.
- No doc 43, **resolvidos**: L240, L241, L324, L1036, L1103, L2201, L2229 (com a #89), L2692 e L2303 (Baixa).
- **Parciais**: L472, L1219 (o `window.location.reload()` ficou; fechado pela #153) e L2712.
- **Escapou da trava**: L1183. `ConferenciaRegraHistorica.tsx:14` tinha `try/finally` sem `catch` e passou, provavelmente porque o arquivo tinha outro `catch` válido. Foi corrigido pela #153.

**4. Revisão**
- Não há revisão no GitHub. Houve 1 rodada externa (comentário das 16:00Z) e depois a resolução de conflito.
- Pontos tratados: `FinanceiroPainel` ainda manual; trava frouxa; arraste durante a ação; Drawer com erro antigo.

**5. Testes e travas**
- `acoes-cliente.test.ts` agora tem dois testes: todos os componentes tratam a falha, e a varredura acha mais de 150 componentes (sanidade).
- Mutações: catch só do `localStorage` e componente que só importa utilitário (2 mortas).

**6. Pendências**
- Chave de idempotência em `DecidirSubstituicao`, `JanelaFormulario`, segunda chamada, **`criarMatricula`**, catálogo e WhatsApp, além do `editarPais`.
  - Hoje `criarMatricula` (`server/matricula/acoes.ts:622`) continua sem chave, e `MatriculaFormulario.tsx:167` usa `idempotente: false`. **Aberto.**
- A mensagem "reenvie a mesma decisão" (`MSG_DECISAO_INCERTA`) foi deixada para uma PR à parte e **fechada pela #118** (25/09).

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- A trava é heurística (texto do arquivo). O caso `ConferenciaRegraHistorica` mostra que um `try/finally` sem `catch` pode passar quando há outro `catch` no arquivo.
- `RevisoesCorrecaoAula` usa `executarAcaoCliente` com `useTransition` por causa de um teste que mocka hooks. É uma exceção de padrão motivada pelo teste.

---

#### #88 — feat(e8): /financeiro com aba na URL — só as consultas da aba ativa

**1. Identificação**
- Aberta em 24/09 15:27Z e mergeada às 18:30Z, com o merge `ad46609d`. Branch `claude/e8-financeiro-aba`.
- 7 arquivos, +239/−36.
- Área: `/financeiro` e `src/server/financeiro/consultas.ts`.

**2. Objetivo e o que entrou**
- `financeiro/abas.ts` (`abasVisiveis` e `resolverAba`). A `page.tsx` lê `searchParams.aba` e só dispara as consultas daquela aba. Aba proibida ou inválida cai na padrão sem consultar nada.
- `podeConfigurarComissoes()`, novo no servidor.
- As abas viraram `<Link href="/financeiro?aba=…">` com `aria-current`.
- `listarAprovacoesPendentes` passa a rodar só para quem aprova.
- **Divergência.** O corpo diz "Independente da #87: não toca nenhum arquivo dela". Mas a #87, na R1, passou a mexer no `FinanceiroPainel.tsx`, e houve conflito real (resolvido na #87).

**3. Rastreabilidade**
- E8, "passo barato" (L130), e ranking #2 (L19, "/financeiro com 11 consultas").

**4. Revisão**
- **Nenhuma revisão e nenhum comentário**, nem no GitHub nem respondidos pelo autor. Mergeada 3 horas depois de aberta sem rastro de revisão.

**5. Testes e travas**
- `abas.test.ts`, `page.test.ts` (que consultas disparam em cada aba e regras de papel) e `FinanceiroPainel.abas.test.ts`.
- Mutação: voltar a consultar a fila fora de Cobranças quebra 4 testes (1 morta).

**6. Pendências**
- O passo definitivo do E8 (rota por aba com `layout.tsx`) foi **feito pela #109** (25/09, commit `9b0ddb69`).
- A troca de aba mostrando esqueleto não foi verificada no navegador.

**7. Publicação**
- Está na `main` e no UAT. Mexe em servidor (consultas). Não mexe em schema.

**8. Riscos e observações**
- **Parcialmente desfeita pela #109.** `(painel)/page.tsx` hoje só redireciona para `hrefAba(resolverAba(…))`. A barra passou para `BarraAbasFinanceiro` no layout, e `FinanceiroPainel.abas.test.ts` **não existe mais** na `main`. Ficaram `abas.ts` e a compatibilidade com `?aba=`.
- `podeConfigurarComissoes` (`financeiro/consultas.ts:239-244`) faz um `prisma.usuario.findUniqueOrThrow` para ler `permissoes`. Desde a #91, as permissões já vêm no memo de `carregarUsuarioFresco`, então essa leitura é redundante (o doc 43 §7.6 cita: "Sobram `podeConfigurarComissoes`…"). **Aberto, de baixo impacto.**

---

#### #89 — feat(e7): diálogos acessíveis e teclado — Modal/useDialogo, fila de cobrança e kanban

**1. Identificação**
- Aberta em 24/09 18:46Z e mergeada às 19:01Z, com o merge `2cdba948`. Branch `claude/e7-dialogos`.
- 17 arquivos, +800/−320.
- Área: `PagamentoModal`, renegociação, importação de alunos e turmas, QR do WhatsApp, formulário de turma, fila de cobrança, kanban, `Drawer` e `FichaAluno`.

**2. Objetivo e o que entrou**
- `src/lib/dialogo.ts` (`useDialogo`: Escape, foco inicial, Tab preso por `proximoFocoPreso`, devolução de foco).
- `src/components/Modal.tsx` (`role="dialog"`, `aria-modal`, `aria-labelledby`, `max-h-[90dvh]`, `bloquearFechamento`).
- `Drawer` fechado fica `inert`. Na R1 (`85cadd5a`), `role`/`aria-modal` passaram a valer só quando ele está aberto.
- Fila de cobrança: a linha virou `<button>` com área estendida por `::after`. O painel de detalhe virou diálogo.
- Kanban:
  - `KeyboardSensor` que pula de coluna em coluna;
  - `TouchSensor` e `touch-none`;
  - anúncios em pt-BR;
  - **"Mover para…"** (`select`).
- Importações: depois do resultado, só o "Fechar" fecha o modal. Isso evita perder o relatório e reimportar em duplicidade.
- Na R1, "Cancelar" fica `disabled` durante a ação.

**3. Rastreabilidade**
- E7 (L120) e E6 (L110: `max-h` do modal, `TouchSensor`).
- No doc 43:
  - L2015 (fila) **resolvido**;
  - L2229 (kanban) **resolvido** (com a #87);
  - L225 (importar alunos) **parcial**: o fundo não fecha, mas não há download das linhas rejeitadas.
- Na 7.4, overlays com semântica de diálogo ✅ (de 1 de 9 para 4 de 4 arquivos).

**4. Revisão**
- Não há revisão no GitHub. Houve 1 rodada externa, respondida às 18:56Z com `85cadd5a`:
  - "Cancelar" não fecha durante a ação;
  - o Drawer fechado não se anuncia como modal.

**5. Testes e travas**
- Nova trava `src/app/dialogos.test.ts`: todo `fixed inset-0` precisa de `role="dialog"`, `aria-modal` e `useDialogo`. Mutação com overlay cru morta.
- `dialogo.test.ts`, `FilaCobranca.test.ts` (sem checkbox dentro de botão) e `KanbanBoard.test.ts`.
- 1 mutação relatada, morta.

**6. Pendências**
- `Campo` com `useId` (E1): feito na #145.
- **`inert` no `<main>` com portal** enquanto há modal aberto: "Continua fora".
  - Na `main` de hoje, `Modal.tsx` continua sem portal e sem `inert` no `main`.
  - Também não há o **bottom-sheet abaixo de `sm`** que o E1 e o E6 propõem.
  - **Aberto.**

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- Escape, foco preso e anúncios **não foram exercitados num navegador** (o corpo declara). Só funções puras e marcação foram testadas.
- Mergeada 11 segundos antes da #90 (19:01:56 e 19:02:07), sem CI. As duas não têm arquivo em comum.
- Na `main`, o `Modal` evoluiu depois na #154 (`ConfirmarAcao`, `alertdialog`, `focoInicial`) e o `dialogo.ts` ganhou `criarPilhaDialogos`. O desenho da #89 foi estendido, não desfeito.

---

#### #90 — feat(e2): /matriculas/[id] com cabeçalho de registro, abas por papel, hub e título de aba

**1. Identificação**
- Aberta em 24/09 18:55Z e mergeada às 19:02Z, com o merge `313ad346`. Branch `claude/e2-matricula-layout`.
- 14 arquivos, +342/−4.
- Área: as 33 telas de `/matriculas/[id]/*`, layout raiz, portal e `SubTabs`.

**2. Objetivo e o que entrou**
- `matriculas/[id]/layout.tsx`: cabeçalho (código, aluno, estado e produto), abas por papel (`SubTabs` com o prefixo mais longo) e `generateMetadata` ("M-000123 · Ana Silva · ERP Genius").
- `secoes.ts`: as 16 seções, cada uma com os papéis do guard da sua página.
- `src/server/matricula/cabecalho.ts`: um `findFirst` com `select`, respeitando o alcance de cada papel (Vendedor e Gerente comercial pela carteira).
- `carregar-cabecalho.ts` com o `cache` do React.
- Hub em `matriculas/[id]/page.tsx` (antes era 404) e `not-found.tsx` em pt-BR.
- "← Voltar ao aditivo" nas Alçadas.
- `title.template` na raiz.
- `SubTabs` sai de `configuracao/_componentes` para `src/components`.
- Na R1 (`d9475686`): o hub deixou de repetir o cabeçalho, e o leitor do guard (`papeisDoGuardFonte`) passa a **falhar alto** quando não há guard ou quando os papéis não são literais.

**3. Rastreabilidade**
- E2 (L70), ranking #9 (L26) e §5.5.
- No doc 43:
  - L703 (Alçadas) **parcial**: falta a versão e o PDF;
  - L905 (fechamentos de horas) **parcial**, e **resolvido depois pela #160** (`contextoAluno: true` em `secoes.ts:36`, com o aluno vindo do cabeçalho);
  - L608 **resolvido**;
  - L603 aberto;
  - L762 parcial.
- Nos extras, `metadata` sobe de 2 para 6 (com a #106).

**4. Revisão**
- Não há revisão no GitHub. Houve 1 rodada externa (19:01Z, `d9475686`):
  - hub duplicando o cabeçalho;
  - regex do guard, que agora tem teste multilinha e falha alto;
  - Alçadas para FIN, GC e GP aparecem sem aba marcada, de propósito.

**5. Testes e travas**
- `secoes.test.ts` (lê os `page.tsx`): cada aba tem exatamente os papéis do guard, e nenhuma página libera um papel fora da união do layout. Mutação com `PROFESSOR` em `fechamentos-horas` morta.
- `layout.test.ts`.

**6. Pendências**
- `VoltarPara` padronizado: feito na #110.
- Memoizar `carregarUsuarioFresco`: sugerido no corpo e feito na #91.

**7. Publicação**
- Está na `main` e no UAT. Mexe em servidor (consulta nova de leitura). Não mexe em schema.

**8. Riscos e observações**
- O guard do layout é a **união** dos papéis das seções. Uma página nova abaixo de `[id]` com um papel que não está em nenhuma seção fica bloqueada pelo layout; a trava pega esse caso.
- O layout soma uma consulta por navegação, como o E2 previa. A #91 reduziu o custo.
- Depois da #90, o `SubTabs` virou componente compartilhado. A troca `bg-brand-600 → bg-brand-solid` no contraste entrou depois (`SubTabs.tsx:32` na `main`).

---

#### #91 — perf(ux-15): sessão, papéis e escopo comercial memoizados por requisição

**1. Identificação**
- Aberta em 24/09 19:05Z e mergeada às 19:54Z, com o merge `c317f4b8`. Branch `claude/ux15-cache-sessao`.
- 6 arquivos, +172/−20.
- Área: servidor transversal (`sessao.ts`, `guards.ts`, `escopo-comercial.ts`).

**2. Objetivo e o que entrou**
- `src/server/_shared/memo-requisicao.ts`:
  - `memoPorRequisicao` usa o `React.cache` do React embutido no Next (`:24`);
  - no Vitest e em Server Action, roda sem memo;
  - a leitura de `React.cache` fica protegida por `try` (`:12-22`).
- `congelar` faz deep freeze do que sai do memo (`:31`).
- `carregarUsuarioFresco` (`sessao.ts:67-75`) é o **único** memo de usuário, e `papeisDaSessao` passa por ele.
- `escopoComercialAtual` usa memo **só fora de transação** (`escopo-comercial.ts:17`, `tx === prisma`), com a chave `JSON.stringify(papéis ordenados)`.

**3. Rastreabilidade**
- GR15 (L47).
- No doc 43 §7.6, os guards por render de `/financeiro` caíram de ~12 para ~3 (◐).

**4. Revisão**
- Não há revisão no GitHub. Houve 2 rodadas externas.
- **R1, blocker real.** O commit `45ed4039` **quebrava o carregamento** de `vencimento-civil-render.test.ts`, que faz `vi.mock("react")` sem `cache`: 1 arquivo falhava com 0 testes contados. O autor admite que conferia só a linha "Tests" e não a "Test Files". Corrigido em `5da6290c`, junto com:
  - o memo único de usuário;
  - a chave em JSON.
- R2 (`70f4f125`): teste do memo único e congelamento.

**5. Testes e travas**
- `guards-memo.test.ts`: uma leitura por requisição, e o objeto vem congelado.
- `memo-requisicao.test.ts`: dentro de transação, nunca usa o memo.
- Mutações: `guards.ts` voltar a consultar o banco direto e aplicar o memo dentro de transação (2 mortas).

**6. Pendências**
- Não declara pendência. O **ganho de latência não foi medido**, só a semântica.

**7. Publicação**
- Está na `main` e no UAT. **Mexe em servidor**, na autenticação e no escopo de todas as requisições. Não mexe em schema.

**8. Riscos e observações**
- O memo de escopo chama `calcularEscopo({ id, nome: "", papeis })` (`escopo-comercial.ts:21-22`). Hoje é seguro, porque `calcularEscopo` lê só `id` e `papeis`. Mas se um dia passar a ler outro campo do usuário (permissões, por exemplo), o memo vai calcular errado em silêncio.
- `tx === prisma` compara identidade: um client com `$extends` perde o memo, sem risco de leitura fora da transação.
- O `congelar` vale também no Vitest, então uma mutação do usuário aparece em teste.
- Mudança de alto alcance (toda página) entrou sem CI e sem medição.

---

#### #92 — feat(e4): /alunos com filtros na URL, busca e paginação no servidor, exportação com o mesmo recorte

**1. Identificação**
- Aberta em 24/09 19:14Z e mergeada às 20:20Z, com o merge `71c533f9`. Branch `claude/e4-alunos-url`.
- 15 arquivos, +786/−77.
- Área: `/alunos`, `src/server/alunos/*`, a rota de exportação e `ExportarPlanilha`.

**2. Objetivo e o que entrou**
- `src/server/alunos/filtros.ts`, puro:
  - `lerFiltrosAlunos` valida busca (até 100 caracteres), status, ids e página;
  - `filtrosParaQuery`, `whereFiltrosAlunos`;
  - `sanearFiltrosAlunos`, `destinoPaginaAlunos`, `sincronizarCampos`.
- `listarAlunos(usuario, filtros?, pagina?)`:
  - os filtros entram em `AND` com o escopo;
  - o filtro de turma do professor fica preso às turmas dele;
  - cobranças só para quem vê financeiro;
  - desempate por `id`.
- `listarAlunosPagina` (50 por página, com total filtrado e total do escopo) e `opcoesFiltroAlunos`.
- `AlunosLista`:
  - campos controlados sem `key`;
  - `useTransition`;
  - `criarEspera(400)` (`src/lib/espera.ts`);
  - contador "1–50 de 120 (de 400)";
  - vazio triplo;
  - paginação.
- Exportação:
  - lê só as chaves de filtro;
  - exporta o recorte inteiro, sem paginação;
  - os mesmos filtros nas duas projeções da assinatura;
  - o evento `DadosExportados` registra os filtros.
- **GR21 recusado de propósito.** A segunda `listarAlunos` foi mantida, porque a assinatura inclui os rótulos de turma escopados e quatro testes de integração dependem dela.

**3. Rastreabilidade**
- E4 (L90), ranking #10 (L27) e GR21 (L53, recusado; a memória do usuário confirma a decisão "#21 mantém checagem").
- No doc 43, L229 (Média) **resolvido**. Na 7.5, "sem `take`" ◐: alunos paginados.

**4. Revisão**
- R1 e R2 fora do GitHub. Respostas às 19:49Z (`bd04e258`) e às 20:14Z (`09af7036`).
- R1 externa:
  - campos com valor antigo;
  - falta de carregamento visível;
  - busca por nome completo;
  - página além do fim;
  - turmas repetidas;
  - 4 mutações do revisor que passavam.
- R2 externa:
  - **N1**: a `key` recriava o formulário e perdia foco e texto;
  - **N2**: correções que dava para desfazer sem falhar teste.
- R3 no GitHub (`09af7036`): **APPROVE**. N1 e N2 FIXED, com 9 mutações conferidas e todas mortas. É a rodada final pela regra das 3.

**5. Testes e travas**
- `filtros.test.ts`, `lista-escopo.test.ts`, `page.test.ts`, `AlunosLista.test.ts`, `route.test.ts` (unitário), `espera.test.ts`.
- `route.int.test.ts` ganhou o caso `?status=ATIVO`, **não executado**.
- Mutações: na R3 o revisor matou 9; o autor relatou mais 6 da R3 e as 4 do revisor da R1.
- Um teste instável (`new Date()` em `escopoTurmasDocente`) foi fixado com relógio falso.

**6. Pendências**
- Ligação de eventos e foco sem teste, por falta de jsdom e RTL.
  - Hoje o `package.json` não tem jsdom e o `vitest.config.ts` usa `environment: "node"`.
  - Existe um harness `src/test/tela-sem-dom.ts`, usado a partir de PRs posteriores.
  - **Parcial.**
- **Busca livre gravada na auditoria** (decisão de LGPD): **fechada pela #119** (25/09). `filtrosRegistrados` grava `{ aplicada, caracteres }` (`route.ts:27-36`).
- Índice `pg_trgm` para o `contains`: não existe em `prisma/` (`git grep pg_trgm` vazio). **Aberto.**
- Lista e contagens fora de transação: aceito como está.
- Rótulo de turma ambíguo na **célula** (R3, comentário 2): `consultas.ts:241` ainda monta `` `${turma.modalidade.nome} ${turma.nivel.codigo}` ``, e a planilha também. As opções do filtro usam `rotuloTurmaAcademica`. **Aberto.**
- Adotar `useFiltrosUrl` e `Paginacao`: feito pela #101.

**7. Publicação**
- Está na `main` e no UAT. **Mexe em servidor** (consultas, `regras.ts` e a rota de exportação). Mexe em `route.int.test.ts`, que não roda no CI e não foi rodado.

**8. Riscos e observações**
- `listarAlunos` ainda carrega **todas as cobranças** de cada aluno para pintar a situação (`consultas.ts:226-229`). O doc 43 propõe `groupBy`.
- Na exportação, sem paginação e chamada **duas vezes** (`route.ts:60` e `:78`), isso pesa para quem vê financeiro em escopo amplo.
- A busca `contains` sem índice tem o teto de 6 palavras dado pela #107.
- Os 4 testes de integração que justificaram manter a segunda chamada não rodaram em nenhuma das PRs que mexeram na rota.

---

#### #93 — feat(e5a): dinheiro sempre formatado, enums com rótulo, fim do estado inventado

**1. Identificação**
- Aberta em 24/09 20:07Z e mergeada em **25/09 09:42Z**, com o merge `a90dd803`. Branch `claude/e5a-rotulos-moeda`.
- 58 arquivos, +496/−147.
- Área: transversal de dinheiro e rótulos (créditos, movimentações, financeiro, migração, matrículas e contrato, secretaria, exportação, `/pagar/[token]`, portal do aluno).

**2. Objetivo e o que entrou**
- `formatarMoeda` aceita texto decimal.
- Na R1, `dinheiro.ts:74` passa a usar 0 casas só quando o valor é inteiro, e vazio, inválido ou `null` vira "—".
- `rotular(mapa, valor)` em `src/lib/labels.ts:76-82`.
- Dinheiro cru migrado em 31 arquivos, ampliado na R1 a mais telas.
- Enums com mapa passam por `rotular`.
- A planilha sai com rótulos ("Ativo", "Novo", "Morno" e, depois do rebase sobre a #95, o segmento).
- `SITUACAO_RELATO_MATERIAL_REPOSICAO_LABEL` no portal do aluno.
- O `rotuloForma` errado da migração ("Greenpay") deu lugar ao `FORMA_PAGAMENTO_LABEL`.
- Saiu o estado inventado ("Habilidade em conferência", "…em conferência").
- **Divergência.** O corpo não foi atualizado depois das 3 rodadas:
  - continua dizendo que "a lista de pendentes está vazia" (a R1 mostrou que não estava);
  - deixa "Colón sem centavos" como ponto a decidir (resolvido na R1, B1);
  - mantém os números de verificação antigos (2261 testes, contra 2435 no fim).

**3. Rastreabilidade**
- E5 (L100) e §5.7. Q23, Q92 e Q165 aparecem só como códigos a remover no E5b, feito na #111.
- No doc 43:
  - 7.3 `{valor} {moeda}` caiu de 44 para 0 ✅ (#93);
  - enum cru ◐ (#93 e #138);
  - L2566 (`/pagar`) **resolvido**;
  - L2145 e L2682 **resolvidos**;
  - L283 e L829 **parciais**.

**4. Revisão**
- **R1 (`f9019937`): REQUEST CHANGES, 5 blockers.**
  - **B1.** CRC/CLP escondiam centavos: `formatarMoeda("1250.50","CRC")` dava "₡ 1.251", e o servidor compara exato (`devolucao-credito.ts:33`).
  - **B2.** Inválido ou ausente virava zero monetário.
  - **B3.** A migração tinha ficado incompleta, e a trava não enxergava valor sem a moeda ao lado.
  - **B4.** Cinco enums com mapa continuavam crus.
  - **B5.** Onze de 16 mutações sobreviviam.
  - Tudo corrigido no commit da resposta (head `7f6b4494`, depois `c07fd0bc` ou `8f5327f1` no histórico rebaseado). Depois veio o rebase sobre a #95 (`f90ef4e1`).
- **R2 (`f90ef4e1`): REQUEST CHANGES, 1 blocker (N1).** `AcertoEncerramento` usava um ternário local ("Particulares por hora", "Outra cobrança") em vez de `TIPO_COBRANCA_LABEL`. Corrigido em `defa0ba9`, junto com o C1 (`?? 0` virando zero) e a trava nova `ZERO_FALSO`.
- **R3 (`defa0ba9`): REQUEST CHANGES, 1 blocker (B7).** A mutação que volta o ternário (M5) **sobrevivia**, e o M6 também. O revisor declara que é a rodada final e que o autor "pode corrigir o B7 e mergear".
- **Fix pós-R3 em `2227a6d8`.** Uma trava de fonte nos 9 pontos migrados exige `rotular(<MAPA>, …)` e proíbe os rótulos antigos. O autor diz que M5 e M6 passaram a morrer.
- **Entrou sem APPROVE.** O último veredito registrado é REQUEST CHANGES. O `2227a6d8` **não foi revisado**, e o merge veio 12 horas depois. A política de 3 rodadas permitia isso.

**5. Testes e travas**
- Nova trava `src/app/rotulos-dominio.test.ts`, com `DINHEIRO_CRU`, `DINHEIRO_SEM_FORMATO`, `ENUM_CRU` (escopo pelo import de `@/lib/labels`), `INVENTA_ESTADO`, `ZERO_FALSO` e a trava por ponto migrado. As exceções são contadas.
- `labels.test.ts`, `dinheiro.test.ts` e `route.test.ts`, que lê a planilha.
- Mutações:
  - R1: 16, com 5 mortas e **11 sobreviventes**;
  - R2: 6 de 6 mortas;
  - R3: M1–M4 mortas e **M5 e M6 sobreviventes**;
  - depois do fix, o autor relata M5 e M6 mortas, **sem confirmação do revisor**.

**6. Pendências e follow-ups**
- E5b (datas civis e competência, códigos Q): **#111** (25/09).
- "Previsto/Prevista": **#120** (25/09), no masculino.
- Os ~91 enums sem mapa: **#138** (06/10); as brechas da trava foram para a issue **#142**, fechada em 08/10.
- Telemetria de `rotular` em produção: **aberto**. `labels.ts:80` só avisa com `NODE_ENV === "development"`.
- `acordo.moeda` nulo na permuta, "investigar no E5b": **aberto**. `PermutaOperacional.tsx:138-155` ainda usa `acordo.moeda ?? ""`.
- Uma trava genérica contra ternário que rotula enum: ficou para o E5b e não foi encontrada.

**7. Publicação**
- Está na `main` e no UAT, incluindo a **página pública `/pagar/[token]`** e o portal do aluno. Mexe na rota de exportação (servidor) e em `route.int.test.ts`, **não executado**. Não mexe em schema.

**8. Riscos e observações**
- O merge final juntou o head `2227a6d8` (rebaseado sobre `d8b90958`) com uma `main` que já tinha a #105 e a #108 (`Botao`, que mexe em muitos arquivos). Foi um merge automático, sem CI e sem rodar a suíte nessa combinação.
- O B1 (arredondar centavos em tela de decisão) ficou exposto em revisão e foi corrigido **antes** do merge, então não chegou ao UAT.
- O doc 43 aponta 2 enums crus restantes, `{c.tipo}` em `acertos-taxa/.../page.tsx:22` (arquivo que a #93 tocou), fechados depois pela #138/#142.

---

#### #94 — feat(e6): shell mobile — barra no topo, navegação em gaveta, formulários em uma coluna

**1. Identificação**
- Aberta em 24/09 20:21Z e mergeada às 20:49Z, com o merge `8b97b771`. Branch `claude/e6-shell-mobile`.
- 18 arquivos, +412/−45.
- Área: shell (`layout`, `Sidebar`, `BarraMobile`, `Drawer`) e 19 grades de formulário.

**2. Objetivo e o que entrou**
- `BarraMobile` (`md:hidden`) com menu, nome da área, tema, fuso e sair.
- `Drawer` ganha as props `lado` e `largura`.
- `Sidebar` com `hidden md:flex`, `sticky h-dvh`; `NavLinks` e `ThemeToggle` extraídos.
- Layout `flex-col md:flex-row`.
- 19 grades passam a `grid-cols-1 sm:grid-cols-2`.
- Correção do ícone de "Envios do portal" (`IconMail` → `Mail`).
- Nas rodadas:
  - `sm:col-span-2`;
  - `min-h-10 min-w-10`;
  - `rotuloBotaoMenu` com as não lidas no `aria-label` (`BarraMobile.tsx:16,48`);
  - `matchMedia(CONSULTA_MD)` fecha a gaveta em `md+` (`:36`);
  - `aria-controls="menu-navegacao"`;
  - rótulo próprio "Menu de navegação".

**3. Rastreabilidade**
- E6 (L110).
- No doc 43, L2691 (`/home`) **resolvido**. Nos extras: `grid-cols-2` sem breakpoint cai de 25 para 6, e as classes por breakpoint sobem de 0 para 3.

**4. Revisão**
- **R1 (`3ce1082f`): REQUEST CHANGES**, B1–B4:
  - `col-span-2` desfazia a coluna única;
  - alvos de toque abaixo de 40px;
  - o layout não travava a `BarraMobile`;
  - "a gaveta fecha ao navegar" sem trava.
- Complemento da R1, também REQUEST CHANGES, B5–B9:
  - as não lidas ficavam mudas por causa do `aria-label`;
  - o `inert` não tinha trava;
  - o link de fuso com ~32px;
  - a exceção de KPI valia para o arquivo inteiro;
  - a gaveta continuava aberta ao passar de `md`, com as duas `<nav>` de mesmo nome.
- **R2 (`cd329acd`): REQUEST CHANGES.** B1–B4 e B7 fixos; B5, B6, B8 e B9 abertos.
- **R3 (`b6a1c8e2`): APPROVE.** B5, B6, B8 e B9 fixos. Ficou o N4: o eslint `react/no-children-prop` no teste.
- O N4 foi corrigido em `98351ab3` **depois do APPROVE**, só no teste, e entrou sem nova revisão.

**5. Testes e travas**
- Nova trava `src/app/responsivo.test.ts`: nenhuma grade com base de 2+ colunas, `col-span-N` sem breakpoint proibido e a exceção de KPI contada por arquivo.
- `BarraMobile.test.ts`, `BarraMobile.navegacao.test.ts`, `Drawer.inert.test.ts`, `Sidebar.test.ts` e `layout.test.ts`.
- Mutações:
  - R1: 4 mortas, mais as lacunas (B3, B4, B6, B8) que sobreviviam;
  - R2: B6 e B8 sobreviveram;
  - R3: B5, B6, B8 e B9 mortas.

**6. Pendências**
- N3 (`FichaLead.test.ts` dependente do fuso): **fechado pela #97**.
- Inbox master-detail: #96.
- **Dois `ThemeToggle` com estado próprio** (comentário da R1). Hoje `Sidebar.tsx:40-50` ainda usa `useState` mais um `useEffect` de leitura única, sem `useSyncExternalStore`. Trocar o tema no celular e girar a tela deixa o ícone da Sidebar desatualizado. **Aberto, cosmético.**

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- O fuso dos testes de `FichaLead` só apareceu porque o revisor rodou em UTC. Os autores usam UTC−3.
- A navegação mobile depende de `inert` aplicado pela propriedade do DOM (`Drawer.tsx:40`), porque os tipos do React 18 não conhecem o atributo.

---

#### #95 — feat(e4): leads com filtros na URL, busca, paginação e exportação do mesmo recorte

**1. Identificação**
- Aberta em 24/09 20:27Z e mergeada às 21:00:26Z, com o merge `21b78f87`. Branch `claude/e4-leads-url`.
- 11 arquivos, +612/−70.
- Área: `/leads`, `src/server/comercial/*` e a rota de exportação.

**2. Objetivo e o que entrou**
- `src/server/comercial/filtros.ts`: busca, tipo, etapa, segmento, temperatura, dono e página.
- Busca por palavras em nome, código e telefone. O telefone é comparado só pelos dígitos, a partir de 3.
- Paginação de 50 com desempate por `id`, redirecionamento da página além do fim e vazio duplo.
- Filtro por dono só para gerente e admin, saneado.
- Exportação:
  - colunas iguais às da tabela, **sem o telefone**;
  - lê os mesmos filtros;
  - registra os filtros na auditoria.

**3. Rastreabilidade**
- E4 (L90) e ranking #10 (L27).
- No doc 43, L2187 (Média) **parcial**: sem ordenação por coluna, que depois veio com a #136 para alunos, empresas e comissões.

**4. Revisão**
- **R1 (`41b062ae`): REQUEST CHANGES, B1.** O mínimo de 3 dígitos do telefone podia ser removido sem quebrar nada.
- **R2 (`fde73152`): APPROVE.** As asserções para "a1", "12" e "123" matam 3 mutações.
- Ficaram:
  - N1: conflito com a #93, resolvido na #93;
  - N2: segmento cru na planilha, fechado na #93;
  - N3: dívida de jsdom.

**5. Testes e travas**
- `filtros.test.ts`, `consultas.test.ts`, `page.test.ts`, `LeadsLista.test.ts` e `route.test.ts`.
- 8 mutações listadas no corpo, todas mortas. A do B1 sobrevivia na R1 e morreu na R2.

**6. Pendências**
- Adotar `useFiltrosUrl`: #101.
- Teto de 6 palavras na busca: #107.
- jsdom: parcial, como na #92.

**7. Publicação**
- Está na `main` e no UAT. **Mexe em servidor** (`consultas.ts` comercial e rota). Mexe em `route.int.test.ts`, só a expectativa de colunas, **não executado**.

**8. Riscos e observações**
- **Mudança de contrato da planilha.** A coluna de telefone saiu da exportação de leads. Quem usava a planilha para contato perdeu o dado. É intencional, mas não foi comunicado fora da PR.
- Mergeada junto com a #97 e a #98 num intervalo de 9 segundos (21:00:22–31), sem CI. O estado combinado só foi validado depois, quando a R2 da #96 rodou a suíte sobre `main@08d7461a` (444/444).
- `/pipeline` continua chamando `listarLeads` sem `take` nem filtro (doc 43 §7.5: `pipeline/page.tsx:13`).

---

#### #96 — feat(e6): inbox em master-detail no celular

**1. Identificação**
- Aberta em 24/09 20:30Z e mergeada às 21:08Z, com o merge `c0ae4e02`. Branch `claude/e6-inbox-mobile`.
- 2 arquivos, +80/−12.
- Área: `/inbox` (`InboxCliente.tsx`).

**2. Objetivo e o que entrou**
- Master-detail abaixo de `md`, pelo `?c=`. Link "← Conversas" `md:hidden`.
- `100dvh`; `min-h-0` na thread; `type="button"` e `aria-current` nos itens; `section` rotulada.
- Na R2 (`b2d6eb92`):
  - `w-full`;
  - `min-h-10` no link;
  - a altura no celular passa a `calc(100dvh-16.5rem)`, descontando a `BarraMobile` da #94.
- **Divergência.** "Fica para depois: E6 kanban por toque, com `TouchSensor` e 'mover para…'". Isso **já tinha entrado na #89**, mergeada às 19:01Z, antes da #96 ser aberta.

**3. Rastreabilidade**
- E6 (L110: "a thread simplesmente não aparece").
- O doc 43 não tem linha própria para esta PR.

**4. Revisão**
- **R1 (`c9ad8aea`, head antes do rebase): REQUEST CHANGES**, B1 e B2. Tirar `min-h-0` ou `w-full` não quebrava nenhum teste. N1–N3 eram não bloqueantes.
- **R2 (`b2d6eb92`): APPROVE.** Todos fixos, com 9 mutações mortas.

**5. Testes e travas**
- `InboxCliente.test.ts`.
- Mutações: R1 com 4 mortas e 3 sobreviventes (M1, M2, M7); R2 com 9 de 9 mortas.

**6. Pendências**
- E4: o teto de 200 conversas antes do "não lidas primeiro". Hoje está parcial: o doc 43 §7.5 diz que a inbox avisa "Mostrando as 200 mais recentes…", tem busca no servidor e inclui as não lidas até 500.

**7. Publicação**
- Está na `main` e no UAT. Só cliente.

**8. Riscos e observações**
- A altura depende de constantes mágicas (16.5rem e 13rem) calibradas pelo chrome atual. Hoje existe também `min-h-[420px]` (`InboxCliente.tsx:158`), que veio depois.

---

#### #97 — test(leads): FichaLead sem depender do fuso de quem roda o teste

**1. Identificação**
- Aberta em 24/09 20:46Z e mergeada às 21:00:22Z, com o merge `ca0d71e9`. Branch `claude/testes-fuso-fichalead`.
- 1 arquivo, +10/−2.
- Área: infraestrutura de teste (`FichaLead.test.ts`).

**2. Objetivo e o que entrou**
- O valor esperado do `datetime-local` passa a ser calculado no fuso do runtime (helper `campoLocal`). Antes era fixo em `T07:30` (UTC−3).
- Só o teste muda.

**3. Rastreabilidade**
- Responde ao N3 da R1 da #94. Não tem relação direta com o doc 42.

**4. Revisão**
- **R1 (`7719dd84`): APPROVE**, com 2 nits: o `campoLocal` duplica o `soDataHora`, e há sobreposição com a #93.
- Mutação conferida: reverter faz falhar em `TZ=UTC`.

**5. Testes e travas**
- Suíte inteira passando em `TZ=UTC` (432/432 arquivos).
- 1 mutação, morta.

**6. Pendências**
- Extrair `soDataHora` e `campoLocal` para um utilitário compartilhado (N2, cosmético). Não verifiquei se foi feito.

**7. Publicação**
- Está na `main`. Só teste, sem efeito no UAT.

**8. Riscos e observações**
- A cópia do algoritmo no teste pode divergir do componente.
- O autor só confirmou `TZ=UTC` e o fuso local.

---

#### #98 — feat(e4): empresas com busca, filtros na URL e paginação; useFiltrosUrl e Paginacao compartilhados

**1. Identificação**
- Aberta em 24/09 20:51Z e mergeada às 21:00:31Z, com o merge `08d7461a`. Branch `claude/e4-empresas-url`.
- 11 arquivos, +579/−46.
- Área: `/empresas`, `src/server/empresas/*`, mais `src/lib/filtros-url.ts` e `src/components/Paginacao.tsx`, que são compartilhados.

**2. Objetivo e o que entrou**
- Lista de empresas:
  - busca por nome e código;
  - filtros de situação e país na URL;
  - 50 por página com desempate;
  - contador e vazio duplo;
  - país fora das opções descartado;
  - redirecionamento da página além do fim;
  - país buscado só para as linhas da página.
- `useFiltrosUrl`, que extrai a lógica de cliente de alunos e leads, e `Paginacao` bidirecional com links reais e `aria-current`.

**3. Rastreabilidade**
- E4 (L90), E1 (`Paginacao`, L60) e ranking #10.
- No doc 43, L2271 (Média) **resolvido** (com a #136).

**4. Revisão**
- **R1 (`c66bed72`): APPROVE**, 0 blockers. Comentários:
  - N1: dívida de jsdom;
  - N2: "Faturas em aberto" contava `FECHADA`;
  - N3: adotar as peças em alunos e leads;
  - N4: `aria-busy` some no estado vazio.

**5. Testes e travas**
- `filtros.test.ts`, `consultas.test.ts`, `page.test.ts`, `EmpresasCliente.test.ts` e `Paginacao.test.ts`.
- Mutações M1–M7, as 7 mortas (conferidas pelo revisor).

**6. Pendências e follow-ups**
- N2, N3 e N4: **fechados pela #101** (24/09 21:23Z):
  - o cabeçalho virou "Faturas a receber" (`EmpresasCliente.tsx:176-178`);
  - `aria-busy` também no vazio (`:158`);
  - alunos e leads passam a usar `useFiltrosUrl` e `Paginacao`.
- Teto de palavras: #107.

**7. Publicação**
- Está na `main` e no UAT. **Mexe em servidor** (`empresas/consultas.ts`, novo `filtros.ts`). Não mexe em schema.

**8. Riscos e observações**
- O revisor viu as 2 falhas de fuso da `FichaLead` em `TZ=UTC`, que já existiam e foram resolvidas pela #97, mergeada 9 segundos antes.
- `useFiltrosUrl` não tem teste de ligação a eventos, a mesma dívida de jsdom.

---

#### Tabela-resumo da faixa

Na coluna "Rodadas", "ext." significa revisão fora do GitHub, da qual só existe a resposta do autor. "APPROVE" é o veredito escrito numa revisão COMMENT; nenhuma PR tem APPROVE formal do GitHub.

| PR | Título curto | Área | Rodadas | Veredito final | Publicado (main/UAT) | Pendências abertas hoje |
|---|---|---|---|---|---|---|
| #81 | Esqueletos por formato | Estados de rota (alunos, leads, financeiro, inbox, pipeline) | R1, R2 | APPROVE (R2) | Sim (squash `b91359aa`) | Esqueletos de `/matriculas/[id]`, `/academico`, `/diario`, `/secretaria`, `/configuracao`; esqueleto duplicado no `/financeiro` depois da #109 |
| #82 | 26 rótulos da ficha do aluno | `/alunos/[id]` | R1, R2 | APPROVE (R2) | Sim (squash `a4e9f7ba`) | — |
| #83 | Anúncio de resultado (`alert` + `MensagemStatus`) | Transversal, 128 arquivos | 2 ext. | Sem veredito registrado | Sim | — (erro como `status` corrigido pela #153) |
| #84 | 216 rótulos e erros de campo | Formulários | 1 ext. | Sem veredito registrado | Sim | L471/L1184 parciais (rótulo visível) |
| #85 | `useAcaoCliente` + `FeedbackAcao` | Telas de dinheiro | 2 ext. | Sem veredito registrado | Sim | Chave de idempotência no servidor (decisões tratadas pela #118) |
| #86 | E3 em `/configuracao` | Configuração | 2 ext. | Sem veredito registrado | Sim | Chaves de catálogo/WhatsApp; países descarta o `id` dos tipos (renomear tipo em uso falha) |
| #87 | E3 restante, passivo zero | Transversal | 1 ext. + conflito | Sem veredito registrado | Sim | Chave de `criarMatricula` |
| #88 | `/financeiro?aba=` | Financeiro + servidor | Nenhuma | Sem revisão | Sim (substituída pela #109) | `podeConfigurarComissoes` relê o usuário |
| #89 | `Modal`/`useDialogo`, fila e kanban | Diálogos e teclado | 1 ext. | Sem veredito registrado | Sim | Portal / `inert` no `<main>`; bottom-sheet; download de rejeitadas (L225) |
| #90 | Layout de `/matriculas/[id]` | Matrículas + servidor | 1 ext. | Sem veredito registrado | Sim | L703 parcial (versão e PDF nas Alçadas) |
| #91 | Memo de sessão por requisição | Servidor (auth) | 2 ext. | Sem veredito registrado | Sim | Latência não medida |
| #92 | `/alunos` com URL e servidor | Alunos + exportação | R1, R2 ext.; R3 | APPROVE (R3) | Sim | `groupBy` das cobranças; rótulo de turma na célula; `pg_trgm`; `route.int.test.ts` nunca rodado |
| #93 | Moeda e rótulos (E5a) | Transversal + exportação | R1, R2, R3 (todas RC) + fix | **REQUEST CHANGES (R3); fix pós-R3 sem nova revisão** | Sim | Telemetria do `rotular`; `acordo.moeda ?? ""`; int test |
| #94 | Shell mobile | Shell | R1 (+complemento), R2, R3 | APPROVE (R3); N4 depois | Sim | `ThemeToggle` duplicado (cosmético) |
| #95 | `/leads` com URL e servidor | Leads + exportação | R1, R2 | APPROVE (R2) | Sim | int test; `/pipeline` sem `take` |
| #96 | Inbox master-detail | Inbox | R1, R2 | APPROVE (R2) | Sim | Teto de 200 conversas (parcial) |
| #97 | Teste de fuso da `FichaLead` | Infra de teste | R1 | APPROVE (R1) | Sim (sem efeito no UAT) | Helper duplicado (cosmético) |
| #98 | `/empresas` + `useFiltrosUrl`/`Paginacao` | Empresas + servidor | R1 | APPROVE (R1) | Sim | — (N2–N4 fechados pela #101) |

#### Pendências que continuam abertas hoje (conferidas em `origin/main` = `e5418550`)

1. **Chaves de idempotência no servidor** (#85, #86, #87).
   - `criarMatricula` (`src/server/matricula/acoes.ts:622`) não recebe chave, e `MatriculaFormulario.tsx:167` usa `idempotente: false`.
   - Todos os painéis de catálogo e WhatsApp seguem `idempotente: false` (`IdiomasPainel.tsx:27`, `ModalidadeFormulario.tsx:40`, `PrecosPainel.tsx:48`, `TemplatesPainel.tsx:54`, `PoliticaPainel.tsx:60`, …).
   - Só as decisões (`DecidirSubstituicao`, `JanelaFormulario`) ganharam instrução própria (`MSG_DECISAO_INCERTA`, #118), sem chave.
2. **Países: a edição descarta o `id` dos tipos de documento** (#86, motivo revisto).
   - `PaisesPainel.tsx:160-163` monta `tiposDocumento` só com `nome` e `validador`.
   - Renomear um tipo usado por algum aluno é recusado por `planejarTiposDocumento` (`src/server/paises/tipos-documento.ts`).
   - O "repetir recria os tipos" descrito na #86 não acontece, porque o planejador casa por nome e validador.
3. **`Modal` sem portal, sem `inert` no `<main>` e sem bottom-sheet abaixo de `sm`** (#89). `src/components/Modal.tsx` é um `fixed inset-0` renderizado no lugar.
4. **Testes de interação sem DOM** (#92, #95, #98, #101).
   - `package.json` não tem jsdom nem `@testing-library`, e `vitest.config.ts` usa `environment: "node"`.
   - O harness `src/test/tela-sem-dom.ts` cobre parte do problema.
   - Continua sem teste a ligação de transição e espera aos eventos, e a preservação do foco em `useFiltrosUrl`.
5. **`route.int.test.ts` da exportação** (#92, #93, #95). Teve as expectativas alteradas 3 vezes e **não há registro de execução**. O `vitest.config.ts` exclui `*.int.test.ts`, e o CI atual roda só os unitários.
6. **`listarAlunos` carrega todas as cobranças** (#92 / doc 43 §6 item 9).
   - `src/server/alunos/consultas.ts:226-229`.
   - A exportação chama duas vezes, sem paginação (`route.ts:60` e `:78`, por decisão do GR21).
7. **Rótulo de turma ambíguo na célula e na planilha de alunos** (#92 R3).
   - `consultas.ts:241` usa `` `${turma.modalidade.nome} ${turma.nivel.codigo}` ``.
   - As opções do filtro já usam `rotuloTurmaAcademica`.
8. **Sem índice `pg_trgm`** para a busca `contains` de alunos, leads e empresas (#92). Nada em `prisma/`. Mitigado pelo teto de 6 palavras (#107).
9. **`rotular` sem telemetria em produção** (#93). `src/lib/labels.ts:80` só avisa em `development`.
10. **`acordo.moeda` nulo na permuta** (#93). `PermutaOperacional.tsx:138-155` ainda usa `formatarMoeda(…, acordo.moeda ?? "")`.
11. **Esqueletos de formato próprio** (#81 / doc 43 §6 item 10). Faltam em `/matriculas/[id]`, `/academico`, `/diario`, `/secretaria` e `/configuracao`. `<Suspense>` continua em 0.
12. **Esqueleto duplicado no `/financeiro`** (#81 × #109). `(painel)/loading.tsx` usa `EsqueletoAbas` (título + abas) dentro de um `(painel)/layout.tsx` que já desenha o título e a `BarraAbasFinanceiro`. É leitura de código; falta conferir no navegador.
13. **`podeConfigurarComissoes` relê o usuário** (#88). `src/server/financeiro/consultas.ts:242`, embora as `permissoes` já venham no memo da #91.
14. **`ThemeToggle` com estado duplicado** entre a Sidebar e a `BarraMobile` (#94). `src/components/Sidebar.tsx:40-50`. Cosmético.
15. **Achados do doc 43 ligados à faixa que seguem parciais:**
    - L225: importação sem download das rejeitadas, e o "Importar" continua habilitado (L224, aberto);
    - L471: placeholder como único rótulo visível;
    - L703: Alçadas sem a versão e sem o PDF;
    - L1184: sem `<label>` visível nem `fieldset`;
    - L2187: leads sem ordenação por coluna;
    - L2430: países sem estado otimista;
    - L2712: estilo do botão de preferências.
16. **Processo.** Nenhuma das 18 PRs registrou evidências e pendências em `docs/planejamento/quadro-entregas.md`, como o AGENTS.md exige. As revisões de #83–#91 e a R1/R2 da #92 não deixaram veredito no GitHub. A #88 não teve revisão nenhuma. A #93 entrou com o último veredito em REQUEST CHANGES e o fix do B7 (`2227a6d8`) sem nova revisão.

**Fechadas depois, para não reabrir:**
- fuso nos testes da `FichaLead` (#97);
- segmento rotulado na planilha (#93);
- "Faturas a receber", `aria-busy` no vazio e adoção de `useFiltrosUrl` (#101);
- teto de palavras (#107);
- E8 por rota (#109);
- E5b, datas e códigos Q (#111);
- `MSG_DECISAO_INCERTA` (#118);
- busca fora da trilha de auditoria por LGPD (#119);
- "Previsto" no masculino (#120);
- enums sem mapa (#138 e #142);
- `Campo` único (#145);
- erro e sucesso separados, `ConferenciaRegraHistorica` e `reload()` (#153);
- `ConfirmarAcao` nas ações de alto impacto (#154);
- L905, fechamentos de horas sem `?aluno=` (#160);
- contraste do `SubTabs` (`bg-brand-solid`).

---

### 7.3 PRs #99–#117

Data da análise: 13/10/2026. `origin/main` em `e5418550` (merge da #161, 10/10/2026), depois de `git fetch --all`.

#### 0. Como ler este documento

- **Fontes.** Para cada PR: `gh pr view N --json …` (corpo, commits, arquivos, reviews e comentários), `gh pr diff --name-only`, `git diff <merge>^1 <merge>` e, para as pendências, `git show origin/main:<arquivo>` / `git grep … origin/main`.
- **Horários em UTC.** BRT = UTC−3. Os horários de criação e merge vêm do GitHub.
- **Números #99 a #117: todos são PRs** (nenhum é issue). Todas estão `MERGED` em `main` e foram mergeadas pela conta `diogenesmendes01`.
- **"Rodada" e "veredito".** Autor e revisor usam a mesma conta. O GitHub recusa `APPROVE`/`REQUEST_CHANGES` na própria PR (erro 422), então **toda revisão está registrada como `COMMENTED`**, e o veredito vale pela primeira linha do texto (`**Veredito (Rn): …**`). Formalmente, nenhuma das 19 PRs tem APPROVE no GitHub. Na seção 4 de cada PR, "entrou sem APPROVE" quer dizer **sem veredito APPROVE no texto sobre o head mergeado**.
- **CI.** Na época (24–25/09) o repositório não tinha CI: toda revisão diz "0 check runs". O GitHub Actions só chegou com a #151 (07/10), e mesmo ele roda só `npm test`, que exclui `*.int.test.ts` (`.github/workflows/ci.yml:22-23,87-88`). Todo "tsc limpo" ou "vitest N/N" abaixo é **local**, declarado pelo autor ou pelo revisor.
- **Publicação.** Todos os 19 merges são merge commits (2 pais) e ancestrais de `origin/main` (`git merge-base --is-ancestor` = sim). Como tudo que entra na `main` é publicado no UAT, **as 19 estão no UAT**.
- **Servidor, schema e integração.** Nenhuma das 19 mexe em `prisma/`, `schema.prisma`, migration ou `*.int.test.ts`. Mexem em `src/server`: #100, #101, #102, #103, #104, #106, #107 (só testes), #109.
- **Doc 42 / doc 43.** Os corpos das PRs citam o **projeto** do doc 42 (E1, E2, E4, E5b, E8, §4, linhas 58–138), e não linhas "L…". A ligação com os achados por linha vem do doc 43 (`docs/43-medicao-auditoria-ux.md`, medido em `6b105093`, depois da #138), que cita estas PRs como evidência. Listo essas linhas em cada PR.

---

#### #99 — feat(e2): trilha de navegação no shell (breadcrumb derivado do caminho)

**1. Identificação**
- Aberta 24/09 20:55, mergeada 24/09 21:05 (10 min). Base `main`, branch `claude/e2-trilha`. Merge `e8949f48`, commit único `c6c8ed8b`.
- 6 arquivos, +312/−1. Área: shell `(app)` (`src/app/(app)/layout.tsx`), `src/components/Trilha.tsx`, `src/lib/trilha.ts`.

**2. Objetivo e o que entrou**
- Objetivo (E2): nos níveis 4 a 6 não havia breadcrumb. O caso pior citado é `alcadas/page.tsx`.
- Entrou:
  - `src/lib/trilha.ts` (176 linhas): mapa `ROTULOS_TRILHA` (rota → rótulo, `*` para segmento dinâmico), `SEM_PAGINA` (`/matriculas` → `/secretaria`) e `trilhaDoCaminho`. O literal vence o dinâmico; um estático fora do mapa **encerra** a trilha.
  - `<Trilha/>`: `nav aria-label="Trilha de navegação"` + `ol`, atual com `aria-current="page"`. Inserida uma vez no `<main>` do shell, a partir do 2º nível.
- **Divergência corpo × diff.** O corpo dá como exemplo `/matriculas/…/aditivos/…/alcadas → … / Aditivos / Proposta de aditivo`. Mas `alcadas` não está no mapa, então nessa tela a trilha **para em "Proposta de aditivo" como link e sem `aria-current`**. O caso que motivou a PR fica sem página atual. Foi o N1 da própria revisão.

**3. Rastreabilidade**
- doc 42 E2 (linhas 70–78): "Breadcrumb derivado de `usePathname()` + mapa de segmentos, renderizado uma vez no shell".
- doc 43:
  - L703 (`…/aditivos/[propostaId]/alcadas`) **parcial**;
  - L762 (`/matriculas/[id]/desistencia`) **parcial** ("Layout (#90) e Trilha (#99) dão saída");
  - L2326 (`/configuracao`) **parcial** (#99 + #110).
- Sem Q-ids nem seção da SPEC.

**4. Revisão**
- **R1 — APPROVE** (`c6c8ed8b`), sem blockers. Não bloqueantes:
  - N1: mapa incompleto, com ~60 `page.tsx` fora, inclusive `alcadas` e `/academico/recuperacoes/tentativas/*`;
  - N2: sem teste de render do `SEM_PAGINA`;
  - N3: `VoltarPara` e `generateMetadata` ficam para depois.
- Verificação do revisor: `tsc` limpo; `vitest` 438/438 arquivos, 2322/2322 testes (também com `TZ=UTC`); `eslint` limpo; `mergeable_state: clean`.
- Mergeou no head aprovado.

**5. Testes e travas**
- Novos: `src/lib/trilha.test.ts` (64 linhas), `src/components/Trilha.test.ts`, `src/app/(app)/layout.test.ts` (+9). A trava "nunca 404" lê o sistema de arquivos: toda chave do mapa precisa existir como `page.tsx`.
- Mutações (autor e revisor): 7 mortas, 0 sobreviventes (estático→`*`, sem literal-primeiro, chave sem página, sem "Matrículas", layout sem trilha, sem `aria-current`, limiar de 1 item).

**6. Pendências e follow-ups**
- `VoltarPara`/`NOME_DA_AREA` → **feito na #110**.
- `generateMetadata` nas rotas de registro → **parcial na #106**.
- N1, mapa incompleto → **continua aberto**. Ver a seção final.
- Nenhuma issue aberta por causa dela.

**7. Publicação**
- `e8949f48` está na `main`, logo no UAT. Só front. Sem server, schema ou `.int`.

**8. Riscos e observações**
- A trava só garante **mapa ⊆ páginas**, não **páginas ⊆ mapa**. Toda rota nova sem entrada no mapa trunca a trilha em silêncio, e o teste não acusa.
- Hoje, na `main`, **60 das 181** `page.tsx` de `(app)` estão fora do mapa (contagem feita na análise). Entre elas:
  - `/matriculas/*/contrato/aditivos/*/alcadas`;
  - as 5 de `/academico/recuperacoes/tentativas/*`;
  - `/matriculas/*/condicoes`, `emissao`, `pagador` e outras.
- `trilha.ts` virou dependência compartilhada da #100, da #109 e da #110 (`rotuloDoDestino`, `DESTINOS_FORA_DO_SHELL`). Houve conflitos suaves de rebase, resolvidos.

---

#### #100 — feat(e8): configuração do WhatsApp com uma rota por seção

**1. Identificação**
- Aberta 24/09 20:59, mergeada 21:14. Base `main`, branch `claude/e8-whatsapp-rotas`. Merge `c37bd88d`. Commits `55b58aba` (feat) e `11ef7be2` (chore, depois da R1).
- 16 arquivos, +302/−115. Área: `/configuracao/whatsapp` (6 sub-rotas novas, `layout.tsx`, `secoes.ts`), `src/server/whatsapp/acoes.ts`, `src/server/comercial/acoes.ts`.

**2. Objetivo e o que entrou**
- Objetivo (E8, segundo alvo): o índice tinha 9 consultas num `Promise.all` e 6 painéis empilhados.
- Entrou:
  - rotas `numeros`, `templates`, `politica` e `avisos-agenda` só para admin (D21); `comercial` e `reguas` para admin e gerente comercial (doc 27 C1). Cada rota tem o próprio guard (`exigirPapelLeitura`) **antes** das consultas;
  - `layout.tsx` com `SubTabs aria-label="Seções do WhatsApp"`. O guard do layout só decide as abas;
  - o índice redireciona pela função (admin → Números; gerente → Comercial);
  - 11 `revalidatePath("/configuracao/whatsapp")` passam a `(…, "layout")`.
- Corpo e diff conferem. O corpo deixava a trilha "para depois", mas ela entrou no commit pós-aprovação `11ef7be2`.

**3. Rastreabilidade**
- doc 42 E8 (linhas 130–138): "Mesmo padrão em `/configuracao/whatsapp`".
- doc 43 L2519 (`/configuracao/whatsapp`) **parcial**: "Uma rota por seção (#100); sem indicador de alteração pendente nem `beforeunload`".
- Decisões citadas: D21 (canal só admin) e doc 27 C1 (gerente comercial).

**4. Revisão**
- **R1 — APPROVE** (`1e61d8d5`, antes do rebase), sem blockers. N1: as seções não estão na trilha (adiado). N2: o comentário de `tabs.ts` ficou desatualizado.
- Verificação: `tsc` limpo; `vitest` 437/2317; com `TZ=UTC`, 2 falhas pré-existentes em `FichaLead.test.ts`; eslint limpo.
- Antes do merge, o autor fez rebase e o commit `11ef7be2` (N1: 6 seções no mapa da trilha; N2: comentário). Ele reportou `vitest` 447/2376.
- **Esse commit entrou sem nova rodada.** É pequeno e só toca rótulo e comentário.

**5. Testes e travas**
- `page.test.ts` reescrito (+91/−32): índice por função, layout negando, gerente pedindo seção do canal direto (negado sem consulta), cada seção carregando só o que mostra.
- `revalidacao.test.ts` novo: varre `src/server` e falha em `revalidatePath` da configuração sem `"layout"`.
- Mutações: 6 mortas, 0 sobreviventes.

**6. Pendências e follow-ups**
- Trilha: feito no próprio merge.
- O resto do achado L2519 (indicador de pendência e aviso ao sair) não era escopo. Hoje só `TemplatesPainel.tsx` usa `aviso-ao-sair` (#155). Os outros 5 painéis não têm.

**7. Publicação**
- Na `main` e no UAT.
- **Mexe em servidor**: `revalidatePath` em `src/server/whatsapp/acoes.ts` (9 chamadas) e `src/server/comercial/acoes.ts` (2). Sem schema e sem `.int`.

**8. Riscos e observações**
- `revalidatePath(…, "layout")` invalida **todas** as seções a cada salvamento. Funciona, mas é menos cirúrgico do que o E8 propunha.
- A trava de revalidação só pega o literal `"/configuracao/whatsapp"`. Uma string montada escapa.
- A estrutura continua igual na `main` (`layout.tsx`, `secoes.ts` e as 6 pastas).

---

#### #101 — refactor(e4): alunos e leads usam useFiltrosUrl e Paginacao; ajustes da revisão da #98

**1. Identificação**
- Aberta 24/09 21:08, mergeada 21:23. Branch `claude/e4-listas-hook`. Merge `3ded0203`. Commits `a856ea49` e `9a7d2ebc` (depois da R1).
- 9 arquivos, +37/−117. Área: `/alunos`, `/leads`, `/empresas`; `src/server/alunos/filtros.ts`, `comercial/filtros.ts`, `empresas/consultas.ts`.

**2. Objetivo e o que entrou**
- Objetivo: o N3 da #98. `AlunosLista` e `LeadsLista` trocam a cópia embutida pelo `useFiltrosUrl` + `<Paginacao/>`, cerca de 100 linhas a menos.
- Saem `sincronizarCampos` e `sincronizarCamposLeads`.
- Em empresas: `aria-busy` também no estado vazio (N4 da #98) e o cabeçalho "Faturas a receber" (N2).
- Depois da R1, o commit `9a7d2ebc` renomeou `faturasAbertas` → `faturasAReceber` em `EmpresaResumo`, na consulta, na tela e no teste. **Isso mexe no contrato de `src/server/empresas/consultas.ts`.**
- Divergência menor: o corpo cita "1 aviso pré-existente `inputCls` em `FichaEmpresa`". O revisor notou que esse arquivo não está no diff.

**3. Rastreabilidade**
- doc 42 E4 (linhas 90–98). doc 43 L2269 (`/empresas`) **resolvido**: "Coluna 'Faturas a receber' (`EmpresasCliente.tsx:177`, #101)".

**4. Revisão**
- **R1 — APPROVE** (`2b00fe38`). Não bloqueantes: N1 indentação do `<th>`; N2 renomear o campo; N3 a dívida de jsdom.
- O revisor conferiu a paridade com a lógica embutida, incluindo o detalhe da chave de sync `JSON.stringify(campos)` sem `pagina`.
- `9a7d2ebc` (N1 e N2) entrou **sem nova rodada**. O autor reportou `vitest` 448/2388.

**5. Testes e travas**
- Os testes existentes das listas passam sem alteração. Novo: `EmpresasCliente.test.ts` (`aria-busy` no vazio e o cabeçalho).
- Mutações: M1–M6 mortas, **M7–M8 sobreviveram** (tirar o `onChange` da busca; quebrar o guard de modificadores em `aoClicar`). Ficaram como dívida de jsdom.

**6. Pendências**
- **N3 (jsdom) continua aberta.** Não há `jsdom`, `happy-dom` nem `testing-library` no `package.json` da `main`. Existe agora um harness sem DOM (`src/test/tela-sem-dom`), mas ninguém o usa para `useFiltrosUrl`.

**7. Publicação**
- Na `main` e no UAT. Mexe em servidor (o tipo `EmpresaResumo` e o campo da consulta). Sem schema e sem `.int`.

**8. Riscos**
- O campo renomeado está consistente na `main` (`server/empresas/consultas.ts:17`, `EmpresasCliente.tsx:192`, `colunas-ordenaveis.test.ts:1129`).
- Sem teste de interação, uma regressão no debounce ou nos modificadores de clique passa na suíte.

---

#### #102 — feat(e4): inbox sem teto mudo — não lidas nunca ficam de fora, busca no servidor

**1. Identificação**
- Aberta 24/09 21:13, mergeada 21:21:37. Branch `claude/e4-inbox-busca`. Merge `f34c7eec`. Commits `438b310a` e `886f8034` (fix do N1).
- 8 arquivos, +290/−54. Área: `/inbox`; `src/server/whatsapp/consultas-inbox.ts` e `busca-inbox.ts` (novo).

**2. Objetivo e o que entrou**
- Objetivo (E4: "inbox (200, aplicado antes do 'não-lidas primeiro')").
- `listarConversasInbox(usuario, { busca })`:
  - traz as 200 mais recentes (`take: LIMITE_CONVERSAS + 1`);
  - se a lista foi cortada, traz também **todas** as não lidas de fora, até 500;
  - junta tudo por recência, sem levar as não lidas ao topo (decisão do ganho rápido 22);
  - devolve `limitada`.
- Busca no servidor: cada palavra precisa aparecer no nome do contato, aluno ou lead, ou no telefone, com no mínimo 3 dígitos. Entra em `AND` com o escopo.
- `InboxCliente`: formulário GET (`role="search"`), estado vazio com o termo e o aviso de lista cortada.
- `listarConversas` mantém a assinatura de array, por causa dos `.int`.
- **Mudança de comportamento declarada:** a busca passa a valer no Enter. Antes ela filtrava a cada tecla, só dentro das 200 carregadas.

**3. Rastreabilidade**
- doc 42 E4. doc 43:
  - L2299 (`/inbox`) **parcial**: "Busca no servidor e aviso de lista limitada (#102); a thread corta em 300 mensagens";
  - 7.5: "Listas com teto fixo": a inbox ainda tem teto, mas avisa.
- Ganho rápido 22 preservado.

**4. Revisão**
- **R1 — APPROVE** (`438b310a`). N1: o texto do aviso não cita a busca ativa. N2: o teto de 500 não é sinalizado.
- O autor fez `886f8034` (N1) e **mergeou às 21:21:37**.
- **R2 — APPROVE** (`886f8034`) foi postada às 21:23:41, **depois do merge**. O próprio texto diz "no momento desta R2 a PR já estava merged".
- **Entrou antes da conclusão da R2.** O delta era pequeno (copy e teste), e a R2 confirmou depois.
- Verificação: `tsc` limpo; `vitest` 447/2381; eslint limpo.

**5. Testes e travas**
- Novos ou estendidos: `busca-inbox.test.ts`, `consultas-inbox.test.ts`, `page.test.ts`, `InboxCliente.test.ts`.
- Mutações: R1 6/6 mortas; R2 7/7 mortas.

**6. Pendências**
- **N2 continua aberta.** `LIMITE_NAO_LIDAS_FORA = 500` (`src/server/whatsapp/busca-inbox.ts:11`), mas `limitada` só reflete o corte das 200 (`consultas-inbox.ts:87`). Com mais de 500 não lidas fora da janela, o badge e a lista divergem sem aviso.
- Fora do escopo, mas ligado ao mesmo achado L2299: a thread cortada em 300 mensagens (doc 43 §6 item 9).

**7. Publicação**
- Na `main` e no UAT. **Mexe em servidor** (consulta da inbox). Sem schema.
- **Os `.int` da inbox não rodaram** (`inbox.int`, `acesso-atendimento.int`). Eles usam `listarConversas` (`src/server/whatsapp/inbox.int.test.ts`, `acesso-atendimento.int.test.ts`, `linha-comercial.int.test.ts`, `financeiro-matricula.int.test.ts`). A compatibilidade vem só da assinatura mantida.

**8. Riscos**
- A consulta extra de não lidas roda **sempre** que a janela corta, ou seja, em toda inbox com mais de 200 conversas.
- A #128 acrescentou `canal` à mesma função (`consultas-inbox.ts:79`). Interação não verificada aqui.

---

#### #103 — feat(e4): fim dos tetos mudos em secretaria, carteiras e comissões

**1. Identificação**
- Aberta 24/09 21:19, mergeada 21:41. Branch `claude/e4-listas-tetos`. Merge `2839e9a6`.
- Commits: `a43aa972` (amend do `913910de`), `516aeacf` (fix da R1) e `00cda17f` (teste do teto de 6 palavras).
- 11 arquivos, +379/−23. Área: `/secretaria`, `/carteiras`, `/comissoes`; `src/lib/pagina-url.ts` (novo); `src/server/secretaria/busca-matriculas.ts` (novo); `src/server/financeiro/consultas.ts`.

**2. Objetivo e o que entrou**
- `pagina-url.ts`: `lerPagina`, `lerTexto`, `lerOpcao`, `hrefLista`, `faixaDaPagina` e `paginaAlemDoFim`.
- `/secretaria`: busca por aluno ou código e 40 por página, com desempate por `id`.
- `/carteiras`: 50 por página, com contador.
- `/comissoes`: filtro por situação do enum e 50 por página.
- `listarComissoesPagina` com `escopoComissoes` compartilhado. A `listarComissoes` (aba do `/financeiro`) ficou sem teto.
- Na R1, a busca de `/secretaria` deixou de carregar o `matriculaId` escondido e ganhou o aviso "Mostrando a matrícula do link direto. Ver todas" (N2).

**3. Rastreabilidade**
- doc 42 E4 ("Três listas cortam em teto mudo"; "`<form>` GET de busca em … `/secretaria`, `/comissoes`").
- doc 43: L361 (`/secretaria`) **resolvido** (`secretaria/page.tsx:20-43`, #103). Em 7.5, `/secretaria` e `/carteiras` "têm `Paginacao` e contador (#103)". A §4 lista #103 entre as PRs transversais que resolveram Alta.

**4. Revisão**
- **R1 — REQUEST CHANGES** (`913910de`). **B1**: o guard de sessão de `/secretaria` não tinha teste. A mutação M11 (engolir `exigirSessaoPagina`) sobreviveu.
  - Resolvido em `516aeacf`: teste com `mockRejectedValueOnce` e `count`/`findMany` não chamados.
- **R2 — APPROVE** (`516aeacf`). B1 FIXED; N2 FIXED; N1 OPEN; N3 DEFERRED.
- O commit `00cda17f` (só teste) está no merge, mas **não está no head da R2**.
- Verificação: `tsc` limpo; `vitest` 452/2404; eslint limpo.

**5. Testes e travas**
- Novos: `pagina-url.test.ts`, `secretaria/page.test.ts`, `comissoes/page.test.ts`, `financeiro/comissoes-pagina.test.ts`. Estendido: `carteiras/page.test.ts`.
- Mutações: R1 10 mortas e 1 sobrevivente (M11 → B1); R2 6/6 mortas.

**6. Pendências**
- N3 (aba de comissões do `/financeiro` sem teto) → **fechada pela #122** (`7301718a`). Hoje `(painel)/comissoes/page.tsx` usa `listarComissoesPagina`, `Paginacao` e `paginaAlemDoFim`.
- **N1 continua** (cosmético e de custo): `/comissoes` ainda redireciona para além do fim **depois** da consulta paginada (`src/app/(app)/comissoes/page.tsx:26-28`). Secretaria e carteiras fazem `count` antes.

**7. Publicação**
- Na `main` e no UAT. **Mexe em servidor** (consulta de comissões e busca de matrículas). Sem schema e sem `.int`.

**8. Riscos**
- Mudança de comportamento: um deep link `?matriculaId=` não sobrevive a uma busca nova. É intencional (N2).
- Conflito potencial com a #93 (`SecretariaPainel`), declarado. Não se materializou.

---

#### #104 — feat(e4): busca no histórico do diário, mantida na paginação

**1. Identificação**
- Aberta 24/09 21:26, mergeada 21:49. Branch `claude/e4-diario-busca`. Merge `cf597271`. Commits `33f0220c` e `4502c586` (teste do teto).
- 7 arquivos, +142/−13. Área: `/diario`; `src/server/diario/busca-diario.ts` (novo) e `consultas.ts`.

**2. Objetivo e o que entrou**
- `whereBuscaAulas`: até 6 palavras, cada uma no conteúdo da aula, no código ou nome da turma ou no nome do professor.
- `listarAulasDiario(usuario, antesDe, busca?)`: a busca entra em `AND` com o escopo, **inclusive na validação do cursor**. Sem busca, a consulta é idêntica à anterior.
- Formulário GET, "Limpar busca", `<nav>` com "Aulas anteriores →" e "Aulas recentes" mantendo a busca, e `mensagemVazio` opcional em `DiarioAulas`.
- O corpo confere com o diff.

**3. Rastreabilidade**
- doc 42 E4 ("`<form>` GET de busca em … `/diario`").
- doc 43 7.5: o diário entra entre as 7 de 10 listas com busca. Continua **sem contador** ("faltam inbox e diário").

**4. Revisão**
- **R1 — REQUEST CHANGES** (`33f0220c`). **B1**: o teto de 6 palavras (`.slice(0, 6)`) não tinha teste; a mutação M2 sobreviveu.
  - Resolvido em `4502c586`: `whereBuscaAulas("a b c d e f g")` dá `AND` com 6 itens e sem `"g"`.
- **R2 — APPROVE** (`4502c586`, o head mergeado). 8/8 mortas.
- Verificação: `tsc` limpo; `vitest` 450/2396.
- Esse achado deu origem à #107 (o mesmo teste nas outras buscas).

**5. Testes**
- `busca-diario.test.ts` (novo), `diario.test.ts` (+9), `diario/page.test.ts` (novo).
- Mutações: R1 7 mortas e 1 sobrevivente; R2 8/8.

**6. Pendências**
- **N1 continua**: com um cursor inválido para a busca, a tela diz "Nenhuma aula para '…' nesta página" (`src/app/(app)/diario/page.tsx:24`). A frase agora está congelada no manifesto da #134 (`src/app/vazio-paginado-mapa.ts:19`, condição `antes`).
- **N2 continua (paginação nos dois sentidos)**: o histórico só anda para trás ("Aulas anteriores →" e "Aulas recentes", `diario/page.tsx:26-27`). A #158 registrou isso como exceção pendente (`src/app/paginacao-dois-sentidos.test.ts:629`, motivo `PENDENCIA` na linha 603). A #161 não tocou nisso.

**7. Publicação**
- Na `main` e no UAT. **Mexe em servidor** (`listarAulasDiario`).
- **Os `.int` do diário não rodaram**: `diario.int.test.ts`, `correcao-aula.int.test.ts` e `academico/visibilidade.int.test.ts` usam essa função. O 3º parâmetro é opcional.

**8. Riscos**
- A busca por `contains` em conteúdo de aula, sem índice de texto, pode pesar em histórico grande. Não foi medido.

---

#### #105 — feat(e1): Botao e botaoClasses como fonte única do botão; /configuracao migrada

**1. Identificação**
- Aberta 24/09 21:29, mergeada 22:02. Branch `claude/e1-botao`. Merge `5aacb5d1`. Commits `323d946a` e `5df1dd49` (fix da R1).
- 34 arquivos, +257/−51. Área: `src/components/Botao.tsx` (novo), 31 telas de `/configuracao` e a trava `src/app/botoes.test.ts`.

**2. Objetivo e o que entrou**
- `botaoClasses({ variante, tamanho })`, com as variantes primario, secundario, perigo e fantasma e os tamanhos sm, md e lg. Só tokens.
- `<Botao>` com `type="button"` por padrão e, depois da R1, `forwardRef`.
- Migração de `/configuracao` **sem trocar o elemento**: o submit implícito dentro de `<form>` é preservado.
- **Divergências corpo × diff (corrigidas na R1):**
  - a premissa "nenhuma tem foco visível" estava errada: o ganho rápido 7 já tinha a regra global `button:focus-visible`;
  - "24 arquivos, 33 botões" virou **56 de 80 `<button>`** pelo AST (C1);
  - "`/configuracao` migrada" não era verdade no head R1 (B3).

**3. Rastreabilidade**
- doc 42 E1 (linhas 60–68): "32 strings distintas do botão primário"; "`Botao` (variante × tamanho, com `focus-visible` e `disabled` embutidos)"; "migrando por área".
- doc 43 7.3: strings do botão primário 32 → 1, e 218 arquivos com `Botao`/`botaoClasses` "(#105, #112–117, #135; trava `botoes.test.ts`, follow-up #140)".
- docs/18 (design system flat). Ganho rápido 7 (foco global).

**4. Revisão**
- **R1 — REQUEST CHANGES** (`bda6e9d8`), 4 blockers:
  - **B1**: `focus-visible:outline-none` + `ring-*` anulavam a regra global (especificidade 0-2-0 contra 0-1-1), e o `ring-offset-1` pintava um halo **branco** no tema escuro (conferido no Chrome headless). Correção: tirar o anel próprio e deixar a regra global.
  - **B2**: classes prometidas sem trava (M3–M7 e M9 sobreviveram).
  - **B3**: `/configuracao` incompleta: primário `bg-black` em `ModeloFormulario`, cerca de 13 secundários crus e o kill switch. O detector por regex era cego a `{"…"}`, template e `bg-brand-600` (M13–M16).
  - **B4**: nenhum tamanho chegava a 40px de toque.
  - Placar: **6 mortas, 10 sobreviventes**.
- `5df1dd49` resolve:
  - B1: sem `outline-none`/`ring-`, com teste;
  - B2: strings exatas de `BASE_BOTAO`, `VARIANTES_BOTAO` e `TAMANHOS_BOTAO`;
  - B3: migração completa e **detector reescrito sobre o AST do TypeScript**, com exceções contadas;
  - B4: `max-sm:min-h-10`;
  - C2–C5 e C7: tamanhos, `transition`, `forwardRef` e `type="submit"` explícito.
- **R2 — APPROVE** (`5df1dd49`, o head mergeado): 14/14 mutações relevantes mortas. N1 (3× `rounded border p-2` no `ModeloFormulario`) e N2 (`type` explícito no WhatsApp) viraram a #108.
- Verificação: `tsc` limpo; `vitest` 456/2424.

**5. Testes e travas**
- `src/components/Botao.test.ts` (novo) e `src/app/botoes.test.ts` (**trava nova**, AST, áreas migradas).
- Mutações: R1 6/16; R2 14/14 (mais 1 "sobrevivente" que só remove um caso do autoteste).

**6. Pendências**
- N1 e N2 → **#108**.
- **C6 continua aberto** (sem estado de carregamento embutido). Na `main`, o `Botao.tsx` não tem `aria-busy` nem rótulo de progresso, e também **não tem tamanho de ícone**. Essa ausência justificou as exceções de ícone na #117. `TAMANHOS_BOTAO` em `src/components/Botao.tsx:31-35`.

**7. Publicação**
- Na `main` e no UAT. Só front. Sem server, schema ou `.int`.

**8. Riscos**
- Mudança visual ampla e não conferida no navegador real, porque o dev server usaria o banco de produção. Secundários ganham `bg-surface text-gray-700`, e primários `px-3 py-2` passam a `lg`.
- `max-sm:min-h-10` muda a altura de todo botão no celular. O C6 da #117 lembra o "limpar filtro" `fantasma/sm` dentro de uma frase.
- O detector AST nasceu aqui e foi endurecido em quase todas as PRs seguintes (#108, #112, #114, #116, #117, #135, #148). É sinal de que a trava teve brechas sucessivas.

---

#### #106 — feat(e2): título de aba nas fichas de aluno, lead e empresa

**1. Identificação**
- Aberta 24/09 21:33, mergeada 21:53. Branch `claude/e2-metadados`. Merge `d8b90958`. Commits `c776550d` e `447767c9` (testes da R1).
- 6 arquivos, +164/−0. Área: `alunos/[id]`, `leads/[id]` e `empresas/[id]` (um `layout.tsx` cada); `src/server/titulos-registro.ts` (novo).

**2. Objetivo e o que entrou**
- `generateMetadata` nos 3 layouts. O título fica, por exemplo, "Ana Souza · Aluno · ERP Genius", e as seções filhas herdam.
- `titulos-registro.ts` faz consultas mínimas com o mesmo escopo da página:
  - aluno: `escopoAlunos`;
  - lead: `PAPEIS_LEAD` + `escopoComercialAtual`;
  - empresa: admin ou financeiro.
- Sem sessão, sem acesso ou registro inexistente, o título é genérico, o que evita servir de oráculo de existência.
- Corpo e diff conferem.

**3. Rastreabilidade**
- doc 42 E2: "`metadata` em `page.tsx` (0 de 177)"; "`generateMetadata` nas rotas de registro".
- doc 43:
  - Extras: `metadata`/`generateMetadata` 2 → 6 (E2, #90 e #106);
  - L279 (`/alunos/[id]/creditos/[creditoId]`) **aberto**: "o nome está só no título da aba (#106)";
  - L268 (`agenda-aditivo`) **aberto**, pelo mesmo motivo.

**4. Revisão**
- **R1 — REQUEST CHANGES** (`edf39e77`). **B1**: a allow-list de papéis não tinha caso positivo; M8 (tirar `ADMINISTRADOR` de `PAPEIS_LEAD`) sobreviveu.
  - Resolvido em `447767c9`, só com testes: positivos para admin e gerente no lead e para admin na empresa. N1 (os 3 layouts) e N2 (mock fail-closed) também resolvidos.
- **R2 — APPROVE** (`447767c9`, o head mergeado): M1–M3 e M8–M12 mortas.
- Verificação: `tsc` limpo; `vitest` 454/2412.

**5. Testes**
- `titulos-registro.test.ts` e `alunos/[id]/layout.test.ts`.
- Mutações: R1 7 mortas e 1 sobrevivente; R2 8/8.

**6. Pendências**
- **C1 (outras fichas sem `generateMetadata`) continua aberta.** Na `main`, só 4 layouts têm título: `alunos/[id]`, `leads/[id]`, `empresas/[id]` e `matriculas/[id]` (via `carregar-cabecalho.ts`). Não têm, por exemplo: grades, calendário, encontros, reservas e propostas.

**7. Publicação**
- Na `main` e no UAT. **Mexe em servidor** (`titulos-registro.ts`, só leitura). Sem schema e sem `.int`.

**8. Riscos**
- **Allow-list duplicada.** `PAPEIS_LEAD` e o par admin/financeiro repetem a regra de `obterLead` e da ficha da empresa (`src/server/titulos-registro.ts:27,36`). Se a página mudar os papéis, o título diverge, sem trava que amarre os dois.
- `usuarioOuNull` engole **qualquer** erro de `exigirSessao` (`:13-19`).
- Uma consulta a mais por navegação de ficha, sem `cache()` compartilhado com a página.

---

#### #107 — test(e4): teto de 6 palavras travado nas buscas de alunos, leads, empresas e inbox

**1. Identificação**
- Aberta 24/09 21:37, mergeada 21:42. Branch `claude/testes-teto-palavras`. Merge `967b609c`, commit `b8653aae`.
- 4 arquivos, +32/−0, só testes em `src/server/{alunos,comercial,empresas,whatsapp}`.

**2. Objetivo e o que entrou**
- Estende o B1 da #104: cada busca já mergeada (#92, #95, #98, #102) ganha o teste "7 palavras → `AND` com 6, sem `g`".
- Divergência menor: o corpo diz que a #103 está "ainda aberta", mas ela já tinha mergeado (N1 da R1).

**3. Rastreabilidade**
- doc 42 E4. Sem L nem Q.

**4. Revisão**
- **R1 — APPROVE** (`b8653aae`, o head mergeado). N1: corpo desatualizado. N2: em leads o teste chama `whereFiltrosLead` direto (inconsistência cosmética).
- Verificação: `tsc` limpo; `vitest` 448/2392.

**5. Testes**
- Mutações: 7/7 mortas (remover `slice` nos 4 módulos; `slice(0,7)`; `slice(0,5)`; tirar `filter(Boolean)`).

**6. Pendências**
- Nenhuma.

**7. Publicação**
- Na `main` e no UAT. Só testes, embora em `src/server`. Sem efeito em runtime.

**8. Riscos**
- Nenhum.

---

#### #108 — chore(e1): arremates da #105 — botões "Adicionar" do modelo e type="button" explícito

**1. Identificação**
- Aberta 24/09 22:03, mergeada 22:09. Branch `claude/e1-botao-arremates`. Merge `e7f0cf21`. Commits `fff92d4c` e `b49820d6` (depois da R1).
- 7 arquivos, +20/−15. Área: `configuracao/contratos/ModeloFormulario.tsx`, 5 painéis do WhatsApp e `botoes.test.ts`.

**2. Objetivo e o que entrou**
- N1 da R2 da #105: os 3 "Adicionar …" passam a `secundario/sm`, e o detector passa a pegar padding `p-`/`px-`/`py-` (`/\bp[xy]?-\d/`).
- N2: `type="button"` explícito nos `btnPri`/`btnSec` do WhatsApp, nenhum dentro de `<form>`.
- **Divergência:** o corpo diz 13 botões, e a R1 contou 11 de 14. O commit `b49820d6` completou 14/14.

**3. Rastreabilidade**
- doc 42 E1 e a revisão da #105.

**4. Revisão**
- **R1 — APPROVE** (`fff92d4c`). N2 parcial (11/14). M3 (tirar `type="button"`) sobreviveu, porque não há trava.
- `b49820d6` entrou **sem nova rodada** (3 atributos).
- Verificação: `tsc` limpo; `vitest` 458/2428.

**5. Testes**
- Autoteste do detector com o caso `p-2`.
- Mutações: 2 mortas e 1 sobrevivente (M3).

**6. Pendências**
- **A trava do `type="button"` continua inexistente.** Não há teste em `src/app/*.test.ts` que exija `type` explícito. O autor deixou isso para quando os painéis migrarem para `<Botao>`, o que não aconteceu: eles seguem com `<button type="button" className={btnPri}>`, em `NumerosPainel.tsx:82,119,237,306` por exemplo.

**7. Publicação**
- Na `main` e no UAT. Só front.

**8. Riscos**
- Baixos. Um botão novo nesses painéis sem `type`, se cair dentro de um `<form>` futuro, vira submit sem que a suíte acuse.

---

#### #109 — feat(e8): /financeiro com uma rota por aba

**1. Identificação**
- Aberta 25/09 09:51, mergeada 10:05. Branch `claude/e8-financeiro-rotas`. Merge `6561701e`. Commits `9b0ddb69` e `6a114ca2` (depois da R1).
- 31 arquivos, +545/−375. Área: `financeiro/(painel)/` com 9 rotas e `layout.tsx`; `contexto.ts`, `BarraAbasFinanceiro.tsx`, `FinanceiroPainel.tsx` (−146 linhas) e `abas.ts`; **11 arquivos de `src/server`** (`revalidatePath`).

**2. Objetivo e o que entrou**
- Passo definitivo do E8: rotas cobrancas, informes, retomadas, comissoes, descontos, geral, politicas, aprovacoes e cambio. Cada uma chama `contextoDaAba` (o guard) **antes** das consultas.
- `contexto.ts` memoriza papéis, permissões e filas por requisição.
- `/financeiro` redireciona para a aba do papel e aceita o `?aba=` antigo (`resolverAba`).
- `FinanceiroPainel` vira os componentes `ComissoesAba`, `AprovacoesAba`, `CambioAba` e `GeralAba`.
- 24 `revalidatePath("/financeiro")` passam a `"layout"`. A trilha ganha as 9 abas.
- **Saiu** `FinanceiroPainel.abas.test.ts` (−41), substituído por `BarraAbasFinanceiro.test.ts` e `(painel)/page.test.ts`.
- Corpo e diff conferem.

**3. Rastreabilidade**
- doc 42 E8 (linhas 130–138), incluindo o risco "repetir o guard em cada uma".
- doc 43 7.6: os guards por render de `/financeiro` caíram de ~12 para ~3. O doc 43 atribui isso à memoização da #91; o `contexto.ts` desta PR contribui.
- Sem Q-ids.

**4. Revisão**
- **R1 — APPROVE** (`9b0ddb69`). Não bloqueantes:
  - N1: `aria-current` em subcaminho sem trava (M8 sobreviveu);
  - N2: comentário de `abas.ts`;
  - C1: sobreposição com a #110 em `trilha.ts`;
  - C2: a paginação de comissões fica para depois.
- `6a114ca2` (N1, com caso de subcaminho e de prefixo de texto; N2) entrou **sem nova rodada**. O autor diz que M8 agora morre.
- Verificação: `tsc` limpo; `vitest` 461/2447; eslint com 2 warnings pré-existentes (`setState` em efeito).

**5. Testes e travas**
- `(painel)/page.test.ts` reescrito; `BarraAbasFinanceiro.test.ts`; `financeiro/revalidacao.test.ts`, que varre `src/server`.
- Mutações: 7 mortas e 1 sobrevivente na R1 (M8, depois coberta).

**6. Pendências**
- Paginação da aba de comissões → **fechada pela #122**.
- Contraste da aba ativa (`bg-brand-600 text-white`, doc 43 7.4) → **fechado pela #156**: hoje é `bg-brand-solid` em `BarraAbasFinanceiro.tsx:27`.

**7. Publicação**
- Na `main` e no UAT. **Mexe bastante em servidor** (`revalidatePath` em `ajustes`, `alunos`, `cobrancas`, `empresas`, `financeiro`, `matricula` ×4, `retomada` e `whatsapp`). Sem schema e sem `.int`.
- Não há mais `revalidatePath("/financeiro")` sem `"layout"` em `src/server` (`git grep` vazio).

**8. Riscos**
- Os módulos das abas ainda vivem em `FinanceiroPainel.tsx`, importado pelas rotas (por exemplo `(painel)/comissoes/page.tsx:6`). O code-splitting depende do tree-shaking do bundler.
- As URLs mudaram, mas o `?aba=` antigo continua valendo pelo redirect.
- `revalidatePath(…,"layout")` também invalida todas as abas.

---

#### #110 — feat(e2): VoltarPara — um formato e um nome para os links de volta

**1. Identificação**
- Aberta 25/09 09:57, mergeada 10:14. Branch `claude/e2-voltar-para`. Merge `129c0b60`. Commits `212f2f1c` e `54d44571` (fix da R1).
- **111 arquivos**, +404/−165.
- O `gh pr view --json files` corta em 100. Fora do `(app)` entraram também:
  - `src/app/portal-aluno/{preferencias,recuperar,reposicoes/[id],resultados}/page.tsx`;
  - `src/components/VoltarPara.tsx` e `VoltarPara.test.ts`;
  - `src/app/voltar.test.ts`;
  - `src/lib/trilha.ts`.

**2. Objetivo e o que entrou**
- `<VoltarPara href para?/>`: formato `← Destino` e nome acessível "Voltar para Destino". O nome vem de `rotuloDoDestino` (o mapa da trilha). `para` só vale quando o mapa não nomeia o destino.
- 130 links migrados em 106 telas, pelo AST, com o `import Link` órfão removido. 12 exceções contadas (paginação, "Voltar para UTC" e outras).
- Depois da R1:
  - `DESTINOS_FORA_DO_SHELL` (`/portal-aluno` → "Área do aluno"; `/portal-aluno/entrar` → "Acesso ao portal");
  - remoção de 78 `para` redundantes;
  - as preferências da equipe passam a voltar para `/home`.
- Corpo e diff conferem. O levantamento foi de 142 links, contra os "45+" do doc 42.

**3. Rastreabilidade**
- doc 42 E2: "65 redações diferentes de 'Voltar', 6 rótulos para o mesmo destino `/secretaria`"; "`NOME_DA_AREA` + `<VoltarPara/>`".
- doc 43:
  - L608 (`/matriculas/[id]/contrato`) **resolvido**;
  - L703 (`alcadas`) **parcial**;
  - L1617 (`…/tentativas/[itemReservaId]/autorizacao`) **aberto**: "`VoltarPara` com rótulo e destino divergentes (#110 só trocou o componente)";
  - L1913 (`/diario/encontros/[id]/gravacao`) **parcial**;
  - L2326 (`/configuracao`) **parcial**.

**4. Revisão**
- **R1 — REQUEST CHANGES** (`c3da9f1b`):
  - **B1**: `para="Voltar"` gerava `aria-label="Voltar para Voltar"` (`preferencias` e `portal-aluno/preferencias`);
  - **B2**: `/portal-aluno` com 3 nomes diferentes;
  - N1: `para` redundantes.
- `54d44571` resolve B1, B2 e N1 (com trava AST) e faz o rebase sobre a #109.
- **R2 — APPROVE** (`54d44571`, o head mergeado): 7 mutações mortas.
- Verificação: `tsc` limpo; `vitest` 463/2456; eslint com os mesmos 12 problemas da `main` (10 erros, 2 warnings, JSX em `try/catch`).

**5. Testes e travas**
- `VoltarPara.test.ts`; **trava `src/app/voltar.test.ts`**: nenhum "Voltar…" à mão fora das exceções; `para` não pode começar com "Voltar" nem repetir o que o mapa já nomeia num href literal.
- Mutações: R1 4/4 mortas (os blockers eram de semântica, não de mutação); R2 7/7.

**6. Pendências**
- **N1 residual continua**: `para` em hrefs com template (`/alunos/${id}` etc.) fica sem trava AST. Na `main` há 49 `VoltarPara … para=`.
- Caso concreto ainda aberto (doc 43 L1617): `src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/autorizacao/page.tsx:29`
  ```tsx
  <VoltarPara href={`/academico/recuperacoes/tentativas/${…}/designacao`} para="Tentativa" />
  ```
  O destino é a designação, mas o rótulo diz "Tentativa". Como `tentativas/*/designacao` não está no mapa da trilha (pendência da #99), vale o `para` errado.

**7. Publicação**
- Na `main` e no UAT. Só front, inclusive 4 telas do **portal do aluno**. Sem server.

**8. Riscos**
- Mudança visual: todos os links de volta ficam com `text-sm text-brand-700`. Alguns eram `underline`, `text-xs` ou de outra cor.
- Conflitou com a #111 (`migracao/presenca/[linhaId]/page.tsx`, e o `import Link` removido em `revisoes-correcao-aula/page.tsx`, que a #111 precisava) e com a #112 (`regularizacoes-gravacao/page.tsx`). Os dois foram resolvidos nos merges `dcfadced` e `98fdc091`, e as revisões conferiram.

---

#### #111 — feat(e5b): sem códigos de especificação na tela; datas civis e competências formatadas

**1. Identificação**
- Aberta 25/09 10:04, mergeada 10:27. Branch `claude/e5b-codigos-datas`. Merge `fbf51a4d`.
- Commits: `45cb67a7`, `dcfadced` (merge da `main` com a #110) e `1f267c2d` (fix da R1).
- 54 arquivos, +344/−77. Área: cerca de 40 telas de `/alunos/[id]/movimentacoes`, `/financeiro/*`, `/matriculas/[id]/*`, `/secretaria`, `/inbox` e `/configuracao/migracao`. Libs `src/lib/data-civil.ts` (nova) e `vencimento-civil.ts`. Travas `codigos-internos.test.ts` e `datas-civis.test.ts`.

**2. Objetivo e o que entrou**
- Os códigos saem da tela:
  - Q165 → "acerto financeiro antes da ativação";
  - Q121 → "decisão sobre a desistência…";
  - Q23 → "correção de aula", com link para `/diario`;
  - Q92 → "regra de cobrança das condições por hora", com link para `condicoes-horas`;
  - M01 → "migração";
  - S15 → removido.
- `ORIGEM_VENCIMENTO_LABEL`.
- `formatarDataCivil` e `formatarCompetencia` não passam por `Date`, então não dependem de fuso. Ausente vira "—", e uma forma inesperada volta como veio.
- 46 impressões migradas na versão R1, mais 31 pontos em 16 telas na R2.

**3. Rastreabilidade**
- doc 42 E5 (linhas 100–108): "`formatarDataCivil` e `formatarCompetencia` ao lado de `formatarMoeda`"; "remoção dos códigos internos (Q23, Q92, Q165, M01, S15)… pelo nome do fluxo **e** por um link".
- **Q-ids/SPEC tratados:** Q165, Q121, Q23, Q92, M01 e S15.
- doc 43 7.3:
  - "Datas civis em ISO cru" 16 → **0** (#111, #137);
  - "Códigos internos" 14 → **0** (#111; trava `codigos-internos.test.ts`);
  - L549 (`/matriculas/[id]/emissao`) **parcial** e L582 (`entrada-particular`) **parcial**: os vencimentos formatados vêm desta PR.

**4. Revisão**
- **R1 — REQUEST CHANGES** (`45cb67a7`):
  - **B1**: datas cruas nas próprias telas tocadas (Secretaria, condições, acertos de cobertura, desistência);
  - **B2**: a trava `datasCruas` deixava passar `??`, `&&`, ternário e `.slice` (M6 sobreviveu);
  - **B3**: os links de Q23 e Q92 não tinham trava (M7 e M10 sobreviveram);
  - N1: `rotuloVencimento` duplicava a regra;
  - C1: conflito com a #110.
- `dcfadced` (merge com a #110) + `1f267c2d` resolvem B1 a B3 e N1. A trava passou a descer pelos operadores.
- **R2 — APPROVE** (`1f267c2d`, o head mergeado): 11/11 mortas. N2 novo: `c.inicio`/`c.fim` da Secretaria ficam fora do alfabeto da trava.
- Verificação: `tsc` limpo; `vitest` 466/2466.

**5. Testes e travas**
- **Travas novas:** `src/app/codigos-internos.test.ts` (texto de tela sem `Q00`/`M0x`/`S1x`/`D00`, e os links Q23 e Q92 existem) e `src/app/datas-civis.test.ts` (nenhum campo civil impresso direto).
- `src/lib/data-civil.test.ts`. 6 expectativas de teste atualizadas.
- Mutações: R1 7 mortas e 3 sobreviventes; R2 11/11.

**6. Pendências**
- N2 (`c.inicio`/`c.fim`) → **fechada pela #137** ("datas da Secretaria travadas (resíduo N2 da #111)"). Na `main`, `SecretariaPainel.tsx:51` usa `formatarDataCivil(c.inicio)`.
- Os cerca de 91 enums sem mapa → **#138** (e5c), com brechas no follow-up **#142**, fechado pela **#150**.
- "Previsto"/"Prevista" → **#120** (no masculino, `src/lib/labels.ts:234-239`).

**7. Publicação**
- Na `main` e no UAT. Só front e `src/lib`. Sem server, schema ou `.int`.

**8. Riscos**
- `formatarDataCivil(c.vencimento.slice(0,10))` na desistência depende de o campo continuar ISO. Uma forma inesperada volta crua sem quebrar (desenho intencional).
- A trava de códigos proíbe padrões genéricos (`D00`…). Um texto legítimo com esse formato vai ser barrado. É um falso positivo aceitável.

---

#### #112 — feat(e1): /diario migrado para botaoClasses; trava resolve className por constante

**1. Identificação**
- Aberta 25/09 10:13, mergeada 10:28:59. Branch `claude/e1-botao-diario`. Merge `e420f94d`.
- Commits: `ea7406e8`, `98fdc091` (merge com a #110) e `b65b5c25` (merge com a #111).
- 21 arquivos, +85/−53. Área: 20 telas de `/diario` e `botoes.test.ts`.

**2. Objetivo e o que entrou**
- 58 classes de botão passam a `botaoClasses`, incluindo constantes compartilhadas com input (`campo`, `estilo`).
- Regras:
  - borda verde → primario; borda vermelha → perigo; borda azul → secundario;
  - `py-1` → sm, `py-1.5` → md, `py-2` → lg.
- O detector passa a resolver `className={x}` quando `x` é uma constante string do arquivo.
- Mudança visual deliberada: os contornos coloridos viram variantes do design system.

**3. Rastreabilidade**
- doc 42 E1 §4. doc 43 7.3 (#112–117).

**4. Revisão**
- **R1 — APPROVE** (`ea7406e8`), com C1 (rebase obrigatório depois da #110, mantendo `VoltarPara` e `botaoClasses`). Mas:
  - N1: `/diario` em `AREAS_MIGRADAS` podia ser removido sem quebrar (M2b sobreviveu);
  - N2: variante e tamanho sem trava (M4 e M5 sobreviveram).
- Merges `98fdc091` e `b65b5c25` (conflitos resolvidos, verificados pelo autor: `vitest` 466/2466).
- **Mergeada às 10:28:59.**
- **R2 — REQUEST CHANGES** (`b65b5c25`) postada às 10:33, **depois do merge**. Reclassifica N1 e N2 como **B1 e B2** ("mal classificados na R1") e pede follow-up.
- **Entrou sem APPROVE válido**: a R1 aprovou com classificação errada, e a R2, que bloqueava, chegou depois do merge.
- Placar: R1 3 mortas e 3 sobreviventes; R2 3 e 3.

**5. Testes e travas**
- `botoes.test.ts` (+14/−2): resolução de constante, com autoteste positivo e negativo.

**6. Pendências**
- B1 (pertencer a `AREAS_MIGRADAS`) → **fechado na #113** (teste "a lista de áreas migradas só cresce").
- B2 (variante e tamanho) → **fechado na #113** (`botoes-mapa.ts`). As mutações M4 e M5 da #112 morrem na R2 da #113.
- N3 (template, ternário e `<Link>`) → `<Link>` **na #114**; template e concatenação **na #117** (B3 da R1).

**7. Publicação**
- Na `main` e no UAT. Só front.

**8. Riscos**
- Ficou 17 minutos na `main` (10:29–10:47) sem as travas que a revisão exigia. Não houve regressão conhecida: a #113 travou logo depois.
- 5 erros `react-hooks/refs` pré-existentes em `OperacaoEntregaReposicao.tsx`.

---

#### #113 — feat(e1): /academico migrado para botaoClasses

**1. Identificação**
- Aberta 25/09 10:25, mergeada 10:47. Branch `claude/e1-botao-academico`. Merge `a5a6e790`.
- Commits: `d93d109c`, `a0308df2` e `1cfff127` (merges) e `221d8b99` (fix da R1).
- 56 arquivos, +636/−86. Área: 54 telas de `/academico`, **`src/app/botoes-mapa.ts` (novo, +421)** e `botoes.test.ts`.

**2. Objetivo e o que entrou**
- 90 classes em 54 telas: 58 `secundario/lg`, 25 `primario/lg`, 1 `secundario/md` e 4 com classe de layout ao lado.
- Teste "a lista de áreas migradas só cresce" (fecha o B1 da #112).
- **Mapa de variante e tamanho** (`botoes-mapa.ts`): cada `botaoClasses(...)` por tela, no formato `"<rótulo> → variante/tamanho"`, comparado com o fonte. Na #113 eram 105 telas e 199 chamadas.
- Divergência (N1 da R1): o corpo dizia que a resolução de constantes ainda não estava na `main`. Já estava. O corpo foi corrigido.

**3. Rastreabilidade**
- doc 42 E1 §4. doc 43 7.3.

**4. Revisão**
- **R1 — REQUEST CHANGES** (`1cfff127`). **B1**: variante e tamanho sem trava (M2, M3 e M7 sobreviveram). N2: tamanho `md` implícito no "Revisar". C1: o B2 da #112 continuava aberto.
- `221d8b99` resolve com o `MAPA_BOTOES`.
- **R2 — APPROVE** (`221d8b99`, o head mergeado): 6/6 mortas, incluindo M8 (o "Buscar" do `/diario`). Fecha o B2 da #112.
- Verificação: `tsc` limpo; `vitest` 466/2469.

**5. Testes e travas**
- Mapa novo com trava semântica e autoteste do extrator.
- Mutações: R1 3 mortas e 4 sobreviventes (M6 é edição dupla consciente); R2 6/6.

**6. Pendências**
- **N2 (cosmético) continua**: `src/app/(app)/academico/regras/turmas/[turmaId]/historica/ConferenciaRegraHistorica.tsx:80` usa `botaoClasses({ variante: "secundario" })`, com `md` implícito.

**7. Publicação**
- Na `main` e no UAT. Só front.

**8. Riscos**
- **O mapa é um snapshot.** Toda mudança de botão exige regenerá-lo (hoje com 1.031 linhas na `main`), e ele também congela decisões discutíveis. O próprio desenho admite isso ("o diff do teste mostra o mapa real").
- Gerou conflito textual em todas as PRs seguintes da série (#114 a #117).

---

#### #114 — feat(e1): /alunos migrado para botaoClasses

**1. Identificação**
- Aberta 25/09 10:33, mergeada 10:54. Branch `claude/e1-botao-alunos`. Merge `484aeb98`.
- Commits: `b9e5c432`, `c9c1e0d4` (fix da R1, empilhado sobre a #113) e `6967f583` (merge da `main` com a #113).
- 24 arquivos, +213/−73. Área: 20 telas de `/alunos` (lista, ficha, financeiro, movimentações, créditos, portal), 2 links de `/academico` (calendário e grades), `botoes-mapa.ts` e `botoes.test.ts`.

**2. Objetivo e o que entrou**
- Literais, constantes só de botão e constantes compartilhadas com input (troca só nos `<button>`).
- Concatenações de "Encerrar" e "Confirmar encerramento" viram `perigo`.
- O Link "Cadastrar aluno" vira `primario/lg`.
- Na R1, o detector passou a olhar `<Link>`/`<a>`, exigindo `px-` **e** `py-`. Achou 2 links em `/academico` ("Preparar nova versão" e "Preparar nova grade") e acrescentou a exceção do selo de `FichaFinanceira`.
- Mudança visual: "Encerrar" passa de contorno vermelho a `perigo` sólido.

**3. Rastreabilidade**
- doc 42 E1. doc 43: L327 (`/alunos/[id]/portal`) **resolvido** ("Botões com `botaoClasses` (`painel.tsx:51-53`, #114/#135)").

**4. Revisão**
- **R1 — REQUEST CHANGES** (`b9e5c432`):
  - **B1**: a área podia sair de `AREAS_MIGRADAS` (M1 e M2 sobreviveram);
  - **B2**: mapeamento sem trava (M3, M4, M5 e M8 sobreviveram);
  - N2: `<Link>` secundário à mão escapava (M10).
  - Placar: 3 mortas e 7 sobreviventes.
- `c9c1e0d4` empilha a #113 e resolve tudo.
- **R2 — APPROVE** (`6967f583`, o head mergeado): cerca de 12 mutações mortas.
- Verificação: `vitest` 466/2469; 1 erro de eslint pré-existente em `DevolucaoCredito.tsx:27`.

**5. Testes e travas**
- Mapa ampliado para 127 telas e 265 chamadas. O detector ganha `<Link>`/`<a>`.

**6. Pendências**
- C1 (eslint pré-existente) → não é desta PR.

**7. Publicação**
- Na `main` e no UAT. Só front.

**8. Riscos**
- O empilhamento sobre a #113 exigia mergear a #113 primeiro. A ordem foi respeitada.

---

#### #115 — feat(e1): /financeiro migrado para botaoClasses

**1. Identificação**
- Aberta 25/09 10:50, mergeada 10:57:59. Branch `claude/e1-botao-financeiro`. Merge `067a7994`. Commits `c701bd0d` e `18f058c6` (merge com a #114).
- 15 arquivos, +96/−29. Área: 13 telas de `/financeiro`, mapa e trava.

**2. Objetivo e o que entrou**
- 19 literais e as constantes de `FinanceiroPainel`, `FilaCobranca`, `RetomadasPainel` e `AcessoAulasPainel`.
- "Aprovar" (`bg-success`) → `primario`. "Consultar acesso" (contorno vermelho) → `perigo`. A regra de cor passa a valer para qualquer tom.
- Exceções: a aba ativa de `BarraAbasFinanceiro` e o cartão-indicador de `FilaCobranca`.

**3. Rastreabilidade**
- doc 42 E1. doc 43 7.3.

**4. Revisão**
- **R1 — APPROVE** (`c701bd0d`): 11 mortas e 2 sobreviventes (M2 meta, M9 reversão deliberada completa).
- Depois, o merge `18f058c6` (`main` com a #114) regenerou o mapa (140 telas, 291 chamadas) e **subiu a exceção de `BarraAbasFinanceiro` de 1 para 2**. Entrou **sem revisão**.
- Foi conferido só depois, na R1 da #117: "merge não revisado `18f058c6` … conferi e está tudo certo… o mapa é exatamente a união".

**5. Testes**
- Mutações: 11 mortas (13 testadas).

**6. Pendências**
- Nenhuma própria.

**7. Publicação**
- Na `main` e no UAT. Só front.

**8. Riscos**
- Um delta não revisado no momento do merge, sanado a posteriori.

---

#### #116 — feat(e1): /matriculas migrado para botaoClasses

**1. Identificação**
- Aberta 25/09 10:59, mergeada 12:58:40. Branch `claude/e1-botao-matriculas`. Merge `7e304023`.
- Commits: `889f314f`, `c90c08aa` (merge) e `f3625a81` (fix da R1).
- 46 arquivos, +296/−78. Área: 42 telas de `/matriculas`, mapa e trava.

**2. Objetivo e o que entrou**
- 76 botões, todos literais: 74 `secundario/lg`, 1 `secundario/md` e 1 `primario/lg`.
- Exceção contada: a bolinha numerada do assistente.
- No head R1 havia uma regra que isentava `<Link>` com `block`. A R1 mandou revertê-la.
- Na R1 entraram também os 7 botões sem classe: "Propor acerto" e "Preparar conjunto de impactos" → `primario/lg`; paginação e "Remover" → `secundario/md`.
- **Divergência:** o corpo diz "regra `block`". Ela não existe no head mergeado (revertida em `f3625a81`) e virou a exceção contada do hub `matriculas/[id]/page.tsx`.

**3. Rastreabilidade**
- doc 42 E1. doc 43 7.3.

**4. Revisão**
- **R1 — REQUEST CHANGES** (`c90c08aa`):
  - **B1**: a isenção global de `block` deixava passar um link-botão largo cru (M16);
  - **B2**: 7 `<button>` de ação sem classe nenhuma (M22).
  - Comentários C1 a C7: destrutivas em `secundario`, `<button>` sem classe nas áreas antigas, `<Link>` com `p-N`, hierarquia "Salvar matrícula" e outros.
  - Placar: 19 mortas e 4 sobreviventes (M2, M16, M22, M23).
- `f3625a81` resolve B1 e B2. Mapa com 184 telas e 374 chamadas.
- **R2 — APPROVE** às 12:57:31 (`f3625a81`). Mergeada 1 minuto depois, no head aprovado.
- Verificação: `vitest` 466/2469.

**5. Testes e travas**
- Exceção do hub e caso positivo de `<Link block…>`.
- Mutações: R2 com cerca de 13 mortas e 2 sobreviventes (M22b, porque `<button>` novo sem classe ainda passava; M2 meta).

**6. Pendências**
- C2 (destrutivas como `perigo`) → **fechado pela #135**. Trava "todo botão do design system com rótulo destrutivo tem perigo" em `src/app/botoes.test.ts:1270`, com a lista `VERBOS_DESTRUTIVOS` na `:287`.
- C3 (`<button>` sem classe nas áreas migradas; M22) → **fechado na #117** (`3001fcb6`), com a trava "todo `<button>` do painel passa por botaoClasses" em `botoes.test.ts:1200`.
- **C4 continua**: `<Link className="rounded border p-2">` não é pego, porque o detector exige `px-` e `py-` em Link/a (`botoes.test.ts:200`). É uma escolha de desenho para não pegar card.
- **C5 continua**: o passo final "Salvar matrícula" segue `secundario/lg` enquanto "Próximo" é `primario/lg` (`src/app/(app)/matriculas/nova/MatriculaFormulario.tsx:790-795`), congelado no mapa (`src/app/botoes-mapa.ts:875`).

**7. Publicação**
- Na `main` e no UAT. Só front.

**8. Riscos**
- Mudança visual: 33 botões `p-2` passam a `px-4 py-2 text-sm rounded-md`, mais largos.

---

#### #117 — feat(e1): demais áreas do painel migradas para botaoClasses

**1. Identificação**
- Aberta 25/09 11:03, mergeada 16:09:55. Branch `claude/e1-botao-demais`. Merge `cff75af4`.
- Commits:
  - `25cabb2a` (feat);
  - `ced34298` (R1);
  - `b4885b15` (merge com a #116);
  - `3001fcb6` (R2);
  - `e590b13b` (R4);
  - `fca107d9` (merge com a #118).
- 45 arquivos, +560/−114. Área: secretaria, leads, empresas, inbox, pipeline, home, carteiras, comissoes, preferencias e acesso-negado. Também retoques em configuracao, academico, alunos, diario, financeiro e matriculas, a migração das "16 ações sem classe" das áreas antigas. Trava `botoes.test.ts` (+207/−23) e mapa (+238).

**2. Objetivo e o que entrou**
- No head inicial: 22 telas, 32 literais, constantes, concatenações da `FichaLead` como `perigo`, Links com cara de botão e 12 exceções.
- Ao longo de 4 rodadas, o escopo cresceu:
  - `btnSec` da `FichaEmpresa`;
  - "Enviar para aprovação" da `CondicoesEncerramento`;
  - 6 botões sem classe ou só texto ("Revogar", "Arquivar" e outros, como `fantasma/sm`);
  - os 3 de `ConciliacaoEnvio`;
  - **todo `<button>` do painel** (57 varridos: 16 sem classe, 22 com cara de texto e 19 controles isentos por nome).
- Teste novo: "todo o painel está migrado", em que cada pasta de `src/app/(app)` precisa estar em `AREAS_MIGRADAS` (16 áreas).
- Mapa final: 211 telas e 556 entradas.
- **Divergência corpo × diff:** o corpo (head R1) diz "Com esta PR e a #116 … todo o painel `(app)` fica sob a trava" e lista 22 telas. O merge final tem 45 arquivos e também mexe em áreas antigas. O corpo nunca foi atualizado depois das rodadas.

**3. Rastreabilidade**
- doc 42 E1 §4. doc 43:
  - L434 (`/secretaria/envios-portal`) **parcial** ("Botões com `botaoClasses` (#117); campos `className="block w-full border"`");
  - L2244 (`/carteiras`) **aberto** ("`revogar(c.id)` em um clique (variante perigo, #117)").

**4. Revisão (4 rodadas, mais um complemento)**
- **R1 — REQUEST CHANGES** (`25cabb2a`):
  - **B1**: `FichaEmpresa` com `btnSec` literal e 3 botões crus;
  - **B2**: `CondicoesEncerramento:111` cru;
  - **B3**: o detector era cego (isenção por nome `btn[A-Z]`; constante não expandida em template ou concatenação; M24 e M25 sobreviveram).
  - **Complemento R1: B4**, 6 botões de ação sem classe.
  - Placar: 23 mortas e 3 sobreviventes.
- `ced34298` resolve B1 a B4. A isenção passa a ser pelo **valor** (`constantesDeBotao`), e o mapa passa a registrar o uso de constante.
- **R2 — REQUEST CHANGES** (`ced34298`). **B5**: 3 ações só com `underline` em `ConciliacaoEnvio`.
- `b4885b15` (merge com a #116; 16 áreas; teste "todo o painel"). Antes da R3 subiu também `3001fcb6`, que resolve o B5 e cobre a classe inteira ("todo `<button>` passa por botaoClasses").
- **R3 — REQUEST CHANGES** (`b4885b15`, um head já superado): B5 aberto, "rodada final (3/3)".
  - Nessa rodada houve também um review acidental "schema-probe" (`5317985127`), que o autor pediu para ignorar.
  - O autor declarou: "**não vou mergear por conta própria**. Fica para decisão manual".
- **R4 — REQUEST CHANGES** (`3001fcb6`), uma rodada extra pedida explicitamente. B1 a B5 FIXED. Novos:
  - **B6**: `botoesForaDoDesign` aceitava qualquer `className` que só *contivesse* `botaoClasses` (ternário com ramo cru, `&&`, extras crus no template; e3, e3b e e4 sobreviveram);
  - **B7**: exceções contadas por arquivo; trocar um controle isento por uma ação crua passava (f2);
  - **B8**: os `.tsx` da raiz de `(app)` estavam fora da trava (k).
  - Placar: 12 mortas e 5 sobreviventes. Comentários C1 a C7, entre eles o C4: componentes compartilhados fora da trava (`CopilotoSugestoes`, `PagamentoModal`, `EstadoRota`).
- `e590b13b` resolve B6 a B8 (folhas da expressão, lista branca `SO_LAYOUT`, `CONTROLES_QUE_NAO_SAO_BOTAO` como `Record<string, string[]>` por nome, raiz de `(app)` varrida) e C1/C3. O autor reporta 5/5 mutações da R4 mortas e `vitest` 466/2472.
- `fca107d9` (merge com a #118): conflitos em 11 arquivos (`botaoClasses` × `MSG_*`). O autor diz que o diff não toca `MSG_*`; `vitest` 466/2478.
- **Mergeada às 16:09:55, cerca de 2h30 depois do último commit, sem R5.**
- **Entrou com o último veredito em REQUEST CHANGES.** As correções de B6 a B8 e o merge com a #118 nunca foram revisados dentro da PR. O merge parece ter sido a "decisão manual" que o autor pediu, mas o GitHub não distingue: a conta é a mesma.

**5. Testes e travas**
- `botoes.test.ts`: expansão de constantes; trava "todo `<button>`"; controles por nome; `SO_LAYOUT`; raiz de `(app)`; "todo o painel está migrado".
- Mutações: R1 23 mortas e 3 sobreviventes; R2 cerca de 9 mortas; R3 5 mortas e 1 sobrevivente; R4 12 mortas e 5 sobreviventes; pós-R4, pelo autor, 5/5.

**6. Pendências e follow-ups**
- C4 (src/components fora da trava) → **fechado pela #135**. Hoje existe o teste "src/components está sob a trava" (`botoes.test.ts:1162`), e `CopilotoSugestoes` entra nos controles por nome (`:74`).
- C2 (rejeição em `perigo`) e C5 (`aria-pressed` nos chips e no segmentado) → **fechados pela #135**: travas nas `botoes.test.ts:1270` e `:1359`.
- A brecha das travas continuou: a #135 gerou o **issue #140** ("Follow-up #135: trava de botões — evasões restantes (R3 B1–B6)"), **fechado em 07/10 pela #148**.
- **Ainda aberto (L2244):** "Revogar" a cobertura continua em um clique, sem confirmação (`src/app/(app)/carteiras/CoberturasPainel.tsx:36`, `onClick={() => revogar(c.id)}`). A #154 (`ConfirmarAcao`) não cobriu `/carteiras`: não há entrada em `confirmacoes-mapa.ts`.
- C6 ("limpar filtro" `fantasma/sm` dentro de `<p>`, alinhamento no celular): não verificado no navegador. Fica aberto.

**7. Publicação**
- Na `main` e no UAT. Só front. Sem server, schema ou `.int`.

**8. Riscos**
- É a PR de maior risco da faixa: o último head e o merge com a #118 não tiveram revisão.
- O próprio autor mostrou que a trava acusava brechas a cada rodada. Depois do merge, a R3 da #135 achou mais 6 evasões (issue #140).

---

#### Tabela-resumo

| PR | Título curto | Área | Rodadas (vereditos) | Veredito final | Publicado (main/UAT) | Pendências abertas hoje |
|---|---|---|---|---|---|---|
| #99 | Trilha (breadcrumb) | shell, `lib/trilha` | R1 APPROVE | APPROVE | sim (`e8949f48`) | Mapa incompleto: 60/181 páginas, inclusive `alcadas` e `tentativas/*` |
| #100 | WhatsApp: uma rota por seção | `/configuracao/whatsapp`, server (revalidate) | R1 APPROVE (+commit pós-R1) | APPROVE | sim (`c37bd88d`) | Indicador de pendência e aviso ao sair só em `TemplatesPainel` (L2519) |
| #101 | Alunos e leads com `useFiltrosUrl` | `/alunos`, `/leads`, `/empresas`, server | R1 APPROVE (+commit pós-R1) | APPROVE | sim (`3ded0203`) | Dívida de jsdom: `onChange` e modificadores sem teste |
| #102 | Inbox sem teto mudo | `/inbox`, server | R1 APPROVE, R2 APPROVE (depois do merge) | APPROVE | sim (`f34c7eec`) | Teto de 500 não lidas sem aviso; `.int` não rodados |
| #103 | Tetos mudos: secretaria, carteiras, comissões | 3 listas, `lib/pagina-url`, server | R1 RC, R2 APPROVE | APPROVE | sim (`2839e9a6`) | `/comissoes` redireciona depois da consulta (cosmético) |
| #104 | Busca no diário | `/diario`, server | R1 RC, R2 APPROVE | APPROVE | sim (`cf597271`) | Cursor só para trás (exceção na #158); "nesta página" ambíguo; `.int` não rodados |
| #105 | `Botao`/`botaoClasses` + `/configuracao` | `components`, `/configuracao` | R1 RC (4B), R2 APPROVE | APPROVE | sim (`5aacb5d1`) | C6: sem estado de carregamento nem tamanho de ícone |
| #106 | Título de aba nas fichas | 3 layouts, server | R1 RC, R2 APPROVE | APPROVE | sim (`d8b90958`) | Outras fichas sem `generateMetadata`; allow-list duplicada |
| #107 | Teste do teto de 6 palavras | testes de server | R1 APPROVE | APPROVE | sim (`967b609c`) | — |
| #108 | Arremates da #105 | `/configuracao` | R1 APPROVE (+commit pós-R1) | APPROVE | sim (`e7f0cf21`) | Sem trava do `type="button"` |
| #109 | `/financeiro` por rota | `/financeiro`, 11 arquivos de server | R1 APPROVE (+commit pós-R1) | APPROVE | sim (`6561701e`) | — (comissões: #122; contraste: #156) |
| #110 | `VoltarPara` | 106 telas + portal | R1 RC, R2 APPROVE | APPROVE | sim (`129c0b60`) | `para` em href dinâmico sem trava; L1617 com rótulo errado |
| #111 | Sem códigos Q/M/S; datas civis | cerca de 40 telas, `lib` | R1 RC, R2 APPROVE | APPROVE | sim (`fbf51a4d`) | — (N2: #137; enums: #138/#150; "Previsto": #120) |
| #112 | `/diario` com `botaoClasses` | `/diario` | R1 APPROVE, R2 RC (depois do merge) | **RC depois do merge** | sim (`e420f94d`) | — (B1 e B2 fechados na #113) |
| #113 | `/academico` + mapa | `/academico`, `botoes-mapa` | R1 RC, R2 APPROVE | APPROVE | sim (`a5a6e790`) | N2 cosmético (`md` implícito) |
| #114 | `/alunos` | `/alunos` | R1 RC, R2 APPROVE | APPROVE | sim (`484aeb98`) | — |
| #115 | `/financeiro` (botões) | `/financeiro` | R1 APPROVE (+merge não revisado) | APPROVE | sim (`067a7994`) | — |
| #116 | `/matriculas` (botões) | `/matriculas` | R1 RC, R2 APPROVE | APPROVE | sim (`7e304023`) | C4: Link `p-N`; C5: hierarquia "Salvar matrícula" |
| #117 | Demais áreas (botões) | 10 áreas + retoques | R1 RC (+B4), R2 RC, R3 RC, R4 RC | **RC (mergeada sem R5)** | sim (`cff75af4`) | "Revogar" sem confirmação (L2244); C6 não verificado |

Legenda: RC = REQUEST CHANGES; B = blocker. Nenhuma PR da faixa mexe em schema, migration ou `*.int.test.ts`.

---

#### Pendências que continuam abertas hoje (conferidas em `origin/main` = `e5418550`)

1. **Mapa da trilha incompleto (#99 N1).** 60 das 181 `page.tsx` de `src/app/(app)` não estão em `ROTULOS_TRILHA` (contagem feita na análise).
   - Incluem o caso que motivou a PR, `/matriculas/*/contrato/aditivos/*/alcadas`, e as 5 de `/academico/recuperacoes/tentativas/*`. Só existem as chaves `…/aditivos` e `…/aditivos/*` (`src/lib/trilha.ts:136-137`).
   - Nessas telas a trilha termina num link, sem `aria-current`. A trava não exige páginas ⊆ mapa.
2. **Rótulo de volta errado em `tentativas/*/autorizacao` (#110 N1, doc 43 L1617).** `autorizacao/page.tsx:29` aponta para `…/designacao` com `para="Tentativa"`. Depende do item 1: com a chave no mapa, `rotuloDoDestino` resolveria o nome. Há 49 `VoltarPara … para=` sem trava para href dinâmico.
3. **Inbox: teto de 500 não lidas fora da janela sem aviso (#102 N2).**
   - `LIMITE_NAO_LIDAS_FORA = 500` (`src/server/whatsapp/busca-inbox.ts:11`);
   - `limitada` só olha as 200 (`consultas-inbox.ts:87`).
   - Também segue a thread cortada em 300 mensagens (doc 43 L2299).
4. **Histórico do diário só para trás (#104 N2).** Registrado como exceção pendente na trava da #158 (`src/app/paginacao-dois-sentidos.test.ts:603,629`). Não foi resolvido pela #161. Junto fica o **#104 N1**: "nesta página" quando o cursor é inválido para a busca (`diario/page.tsx:24`), agora congelado em `vazio-paginado-mapa.ts:19`. O diário também segue sem contador "N de M" (doc 43 7.5).
5. **`Botao` sem estado de carregamento e sem tamanho de ícone (#105 C6).** `src/components/Botao.tsx:20-35` não tem `aria-busy` nem `tamanho` de ícone. É por isso que os botões só de ícone (inbox, ✕, lixeira) seguem como "controles isentos" em `CONTROLES_QUE_NAO_SAO_BOTAO` (`botoes.test.ts:58`).
6. **Títulos de aba só em 4 registros (#106 C1).** `generateMetadata` existe só em `alunos/[id]`, `leads/[id]`, `empresas/[id]` e `matriculas/[id]`. A allow-list de papéis de `titulos-registro.ts:27,36` continua duplicada do guard das fichas, sem trava que amarre os dois.
7. **Sem trava de `type="button"` (#108 N2).** Os painéis do WhatsApp continuam com `<button type="button" className={btnPri|btnSec}>` à mão (por exemplo `NumerosPainel.tsx:82,119,237,306`), sem migrar para `<Botao>` e sem teste que exija o `type`.
8. **Dívida de jsdom (#101 N3, desde a #92).** Não há DOM de teste no `package.json`. As interações de `useFiltrosUrl` (o `onChange` da busca e os modificadores em `aoClicar`) seguem sem teste. As mutações M7 e M8 da #101 continuariam sobrevivendo.
9. **"Revogar" cobertura em um clique (#117, doc 43 L2244).** `src/app/(app)/carteiras/CoberturasPainel.tsx:36` chama `onClick={() => revogar(c.id)}` sem `ConfirmarAcao`. A #154 não incluiu `/carteiras` em `confirmacoes-mapa.ts`.
10. **Hierarquia do assistente de matrícula (#116 C5).** O passo final "Salvar matrícula" é `secundario/lg`, e "Próximo" é `primario/lg` (`MatriculaFormulario.tsx:790-795`). O mapa congela isso (`botoes-mapa.ts:875`).
11. **`<Link>` com `p-N` fora do detector (#116 C4).** `botoes.test.ts:200` exige `px-` e `py-` em Link/a. Um link-botão `rounded border p-2` passaria. Hoje não existe nenhum caso assim.
12. **Indicador de pendência e aviso ao sair no WhatsApp (#100, doc 43 L2519).** Só `TemplatesPainel.tsx` usa `aviso-ao-sair` (#155). Números, política, avisos, comercial e régua não usam.
13. **Cosméticos ainda presentes.**
    - #103 N1: o `/comissoes` redireciona depois da consulta (`comissoes/page.tsx:26-28`).
    - #113 N2: `tamanho` implícito no "Revisar" (`ConferenciaRegraHistorica.tsx:80`).
    - #117 C6: o "limpar filtro" `fantasma/sm` dentro de `<p>`, não verificado no celular.
14. **Integração não executada.** As PRs #102 e #104 mudaram consultas usadas por `inbox.int`, `acesso-atendimento.int`, `linha-comercial.int`, `financeiro-matricula.int`, `diario.int`, `correcao-aula.int` e `visibilidade.int`, e esses testes não rodaram em nenhuma das revisões. O CI de hoje também não os roda (`ci.yml:22-23`). Não há evidência de que tenham sido executados depois. O issue #162, sobre `.int`, cobre só a #158 e a #161.

**Já fechadas por PRs posteriores (para não reabrir):**
- comissões no `/financeiro` (#103 N3, #109) → #122;
- `c.inicio`/`c.fim` (#111 N2) → #137;
- enums sem mapa (#111) → #138, #142 e #150;
- "Previsto/Prevista" → #120;
- B1 e B2 da #112 → #113;
- `<Link>` no detector (#112 N3) → #114;
- template e concatenação no detector → #117;
- `<button>` sem classe (#116 C3) → #117;
- destrutivas em `perigo` e `aria-pressed` (#116 C2, #117 C2/C5) → #135;
- `src/components` sob a trava (#117 C4) → #135, com o issue #140 fechado pela #148;
- contraste da aba ativa do financeiro (#109) → #156.

---

### 7.4 PRs #118–#138

Data da análise: 13/10/2026.

`origin/main` conferida em `e5418550` (depois de `git fetch --all`). Todos os números de 118 a 138 são **PRs** (nenhum é issue). Os números de 139 a 142 são **issues** de follow-up.

Fontes: `gh pr view N --json …` (corpo, revisões, comentários, commits, arquivos), `gh pr diff N --name-only` (a lista completa: o JSON corta em 100 arquivos nas #118, #121, #126 e #138), `git merge-base --is-ancestor <merge> origin/main` e `git show origin/main:<arquivo>` para conferir o estado atual. Docs de referência: `docs/42-auditoria-frontend-ux.md` (achados por linha "L…") e `docs/43-medicao-auditoria-ux.md` (medição de 07/10, feita sobre `6b105093`, logo após a #138).

---

#### 0. Leitura transversal (o que vale para a faixa inteira)

1. **Não existe APPROVE formal em nenhuma PR.** Autor e revisor usam a mesma conta do GitHub, então todas as revisões são `COMMENTED` ("Postado como COMMENT porque autor e revisor são a mesma conta GitHub (APPROVE/REQUEST_CHANGES → 422)"). Abaixo, "APPROVE" e "REQUEST CHANGES" são o **veredito escrito** na primeira linha da revisão.
2. **Não havia CI no período.** Todas as revisões registram "0 check runs". O `.github/workflows/ci.yml` (typecheck, lint e `npm test` em UTC e America/Sao_Paulo) só entrou em 07/10 (`a08da204`, `d7de0432`, `a8dbdc40`), depois da #138. Os números de `tsc`/`vitest` destas PRs são **locais** (do autor ou do revisor).
3. **`*.int.test.ts` nunca rodam no CI.** `vitest.config.ts:12` exclui `src/**/*.int.test.ts`, e o `ci.yml` só roda `npm test`. Nesta faixa, mexem em testes de integração: **#128** (3 arquivos, incluindo `linha-comercial.int.test.ts` novo com 438 linhas) e **#130** (1). Nenhuma das duas executou esses testes.
4. **Tudo que está aqui está publicado.** Os 21 merges são ancestrais de `origin/main` (conferido um a um com `merge-base --is-ancestor`), logo foram para o UAT. O deploy do Coolify roda `npx prisma migrate deploy` antes do app (`docker-compose.coolify.yml:62-67`), então as duas migrações da faixa (#131, #132) foram **aplicadas automaticamente no banco do UAT**.
5. **Entraram sem APPROVE muito mais PRs do que as quatro com issue.** O usuário decidiu formalmente, com issue de follow-up, nas #134, #135, #136 e #138 (issues #139–#142). Mas também entraram com o último veredito em REQUEST CHANGES, ou sem revisão do último commit: **#120, #121, #122, #123, #124, #125, #126, #127, #128 e #129**. As **#131 e #132 não tiveram revisão nenhuma no GitHub**. Só têm APPROVE escrito no head mergeado as **#118, #119, #130, #133 e #137**. A seção de cada PR detalha o caso; a tabela final resume.
6. **Padrão de revisão.** Régua "estrita" confirmada em 25/09: qualquer mutação que sobreviva à trava prometida é BLOCKER. O limite é de 3 rodadas automáticas (R1–R3); R4 só a pedido do responsável (#120, #136, #138). Esse padrão produziu travas estáticas cada vez mais sofisticadas (AST, depois lista do permitido, depois `ts.TypeChecker`), com custo de manutenção alto (ver riscos).
7. **Quadro de entregas (AGENTS.md).** Só as #127, #128, #131 e #132 registraram entrega em `docs/planejamento/quadro-entregas.md`. As PRs da auditoria de UX (#118–#126, #129, #130, #133–#138) não tocam o quadro. Três entradas seguem "Não concluído" hoje: #127 (`quadro-entregas.md:1291-1296`), #131 (`:1337-1343`) e #132 (`:1380-1384`).

---

#### PR #118 — fix(ux-20): resultado incerto com uma instrução por evento em todas as telas

**1. Identificação**
- Aberta em 25/09 13:10 e mergeada às 13:39 (29 min). Base `main`, branch `claude/qw20-resultado-incerto`.
- 133 arquivos, +425/−179. Merge `6a4e19fb`.
- Área: transversal. São ~130 client components em acadêmico, alunos, diário, financeiro, matrículas, configuração, carteiras e leads, mais a trava `src/lib/mensagens.test.ts`. `src/lib/mensagens.ts` **não** muda: as três constantes já existiam.

**2. Objetivo × o que entrou**
- Objetivo: o mesmo evento técnico (falha de transporte com resultado desconhecido) dá a mesma instrução em todas as telas. São três constantes, escolhidas pelo que o `try` faz:
  - `MSG_DECISAO_INCERTA` para decisão;
  - `MSG_RESULTADO_INCERTO` quando há chave de idempotência;
  - `MSG_RESULTADO_INCERTO_SEM_CHAVE` no resto (`mensagens.ts:4,6,10`).
- O que entrou: o corpo fala em **84 mensagens**. Depois da R1 (`99988227`), a PR migrou **166** (mais 82 textos em 53 telas, segundo a resposta à R1). **O corpo não foi atualizado**, então ainda diz 84 e "48/14/22".
- A trava faz análise AST do `catch`. Ela proíbe texto à mão de "resultado não confirmado" e de falha afirmada ("Não foi possível registrar/salvar…") em ação que muda dados. Também confere a coerência entre a constante e a ação (`incoerentes()`).

**3. Rastreabilidade**
- Doc 42, §3, ganho rápido **#20** (`42:52`) e E3 (`42:84`).
- Doc 43, §7.3: "Redações de Resultado não confirmado" caiu de 25 para **4** (◐). A sobra é `secretaria/reservas/ConferirReserva.tsx:18`, que fica fora de `catch` (ramo `!d.dado`).
- Sem Q-id nem SPEC.

**4. Revisão**
- **R1** (`8f6c7227`): REQUEST CHANGES.
  - B1: a regex não via "não **foi** confirmado" (M2 sobreviveu).
  - B2: faltavam 21 `catch` com redação própria.
  - B3: `SEM_CHAVE` sem trava contra "reenvie".
  - B4: a regra de coerência podia ser anulada.
  - Fix `99988227`: B2, B3 e B4 corrigidos.
- **R2** (`99988227`): REQUEST CHANGES. B1 ficou parcial, porque a fixture do autoteste também casava "antes de repetir". Fix `1fb77f93`: uma frase por braço da regex, com 27 de 27 braços derrubando a trava.
- **R3** (`1fb77f93`): **APPROVE**.
- Verificação: `tsc` 0; `vitest` com 466/466 arquivos e 2475/2475 testes; eslint com 10 erros idênticos aos da `main` (`react-hooks/refs`).
- Entrou com APPROVE no head.

**5. Testes e travas**
- Trava: `src/lib/mensagens.test.ts` (AST).
- Testes de tela ajustados: `DecisaoTaxa.test.ts`, `AcertoTaxaFormulario.test.ts` e `ConferenciaAgendaFormulario`.
- Mutações: na R1, 10 rodadas, com 3 sobreviventes (M2, M5, M7). Na R3, 7 de 7 mortas. O autor reporta 27 de 27 mortas.

**6. Pendências e follow-ups**
- N1, declarado: `SegundaChamadaPainel` mantém `_SEM_CHAVE` no `executar` compartilhado, mesmo no ramo "propor", que tem chave. Na `main` atual o painel usa `useAcaoCliente({ idempotente: false })` (`SegundaChamadaPainel.tsx:49-51`), com a mesma escolha conservadora. A pendência continua.
- A #133 achou evasões da trava, sobreviventes e fora do escopo dela: texto à mão via variável intermediária (I6) e via template com `${}` (I7). **Não há issue** para isso.

**7. Publicação.** Na `main` e no UAT. Não mexe em servidor, schema ou `*.int.test.ts`.

**8. Riscos e observações**
- Conflito "soft" com a #117 (botões): 11 conflitos de conteúdo nos mesmos `catch`, segundo a R3. Foi resolvido na integração da #117.
- A escolha "decisão + outra ação → `_SEM_CHAVE`" é conservadora. O efeito é pedir recarga onde um reenvio seria seguro.
- A regra depende do **nome** da chamada (`decidir*`/`oficializar*`). Uma ação nova com outro verbo cai no texto genérico.

---

#### PR #119 — fix(lgpd): trilha da exportação registra que houve busca, sem o texto digitado

**1. Identificação**
- Aberta em 25/09 13:43 e mergeada às 14:03. Branch `claude/lgpd-busca-exportacao`.
- 2 arquivos, +30/−3. Merge `2aff2fb9`.
- Área: servidor e API de exportação (`src/app/api/exportacoes/[tipo]/route.ts`), evento `DadosExportados`.

**2. Objetivo × o que entrou**
- A busca livre passa a ir para a trilha como `{ aplicada: true, caracteres: n }`, e não como o texto digitado (`route.ts:33`). O recorte exportado continua usando a busca inteira.
- O diff confere com o corpo.

**3. Rastreabilidade**
- Decisão do responsável de 25/09 ("LGPD busca sem conteúdo").
- `docs/specs/erp-educacional.md` §85, sobre metadados que revelam informação restrita.
- Fora dos docs 42 e 43.

**4. Revisão**
- **R1** (`f6384f0c`): REQUEST CHANGES. B1: a mutação M7, que grava a busca em base64 numa chave extra, sobrevivia ao `toMatchObject`. C1: em leads, a consulta não era conferida.
- Fix `f94ab657`: `toStrictEqual` em `payload.filtros` e as chaves do evento fixadas.
- **R2** (`f94ab657`): **APPROVE**, com M1–M8 mortas.

**5. Testes e travas**
- `route.test.ts`, com +22 linhas.
- 8 mutações na R2, todas mortas.
- O `route.int.test.ts` não mudou e não foi executado.

**6. Pendências**
- Nada declarado.
- **Não declarado:** eventos `DadosExportados` gravados antes de 25/09 continuam com a busca em claro. A PR não faz limpeza retroativa.

**7. Publicação.** Na `main` e no UAT. Mexe em rota de servidor (API). Sem schema e sem `*.int.test.ts`.

**8. Riscos.** São baixos. Ver a falta de limpeza do passivo acima.

---

#### PR #120 — fix(e5): status do encontro com um rótulo por estado, no masculino

**1. Identificação**
- Aberta em 25/09 14:06 e mergeada às 17:08. Branch `claude/status-encontro-masculino`.
- 7 arquivos, +158/−13. Merge `14714f91`.
- Área:
  - `/diario/encontros`, `/diario/regularizacoes`;
  - agendas e histórico de segunda chamada;
  - replanejamento do calendário;
  - `src/lib/labels.ts` e a trava `src/app/status-encontro.test.ts`.

**2. Objetivo × o que entrou**
- Um único `STATUS_ENCONTRO_LABEL` no masculino. Na `main`: `labels.ts:237`, `Readonly<Record<StatusEncontroAgenda,string>>` com `Object.freeze`.
- Cinco mapas locais saíram.
- **Divergência:** o corpo descreve uma trava AST ("nenhuma tela monta objeto com `PREVISTO` e `MINISTRADO`"). Ela foi **substituída** no último commit (`7b260f2a`) por uma trava de **comportamento**:
  - render das 5 telas × 6 status, comparado com uma linha de base;
  - vocabulário "Previsto/a", "Ministrado/a" e "Impedido/a pela escola" proibido fora de `labels.ts`, inclusive em `.js`/`.jsx`.

  O corpo não foi atualizado.

**3. Rastreabilidade**
- Decisão do responsável de 25/09 ("status do encontro no masculino").
- Relaciona-se ao ganho rápido #18 do doc 42 (`42:50`, `rotulosEncontro`).
- Doc 43, §7.3: 12 dos 22 "mapas ad-hoc" do grep atual são apelidos de `labels.ts` (`const rotulo = STATUS_ENCONTRO_LABEL`).

**4. Revisão**

| Rodada | Head revisado | Veredito | Achados | Fix |
|---|---|---|---|---|
| R1 | `e73987ad` | REQUEST CHANGES | B1–B4: chave computada, shorthand, getter, `Object.fromEntries` | `df8bcb60` |
| R2 | `df8bcb60` | REQUEST CHANGES | B5: par com `StatusEncontroAgenda.X` | `052a0b6a` |
| R3 (final) | `052a0b6a` | REQUEST CHANGES | B6 (`Identifier`) e B7 (`ElementAccess`) | `c86d0958` |
| R4 (extra, a pedido do responsável) | `c86d0958` | REQUEST CHANGES | B8–B14 (17 mutações sobreviventes); recomendou trocar de abordagem | `7b260f2a` + merge da `main` (`1554185a`) |

- A PR foi mergeada **3 minutos depois** do commit `7b260f2a`, sem R5.
- **Entrou sem APPROVE** e sem issue. O último commit não foi revisado.

**5. Testes e travas**
- `status-encontro.test.ts`: +132 linhas, com render e vocabulário.
- O autor reporta 9 de 9 mutações mortas na resposta à R4.
- Suíte: 467 arquivos e 2488 testes.

**6. Pendências declaradas**
- Numa tela **nova**, sobrescrever um rótulo comum ("Cancelado", "Rascunho") só é pego se a tela entrar em `TELAS`.
- C1: mapa de classe CSS por status também era barrado (isso deixou de valer com a troca de abordagem).
- C2: `src/lib` e `src/server` não são cobertos.

**7. Publicação.** Na `main` e no UAT. Só front-end e teste.

**8. Riscos**
- A trava depende da lista `TELAS`.
- O detector de formas das R1–R3 foi descartado, então todo o esforço daquelas rodadas foi jogado fora.

---

#### PR #121 — feat(e7): CampoTexto — mínimo de caracteres visível nos 266 campos de texto longo

**1. Identificação**
- Aberta em 25/09 17:16 e mergeada às 18:03. Branch `claude/e7-campo`.
- 148 arquivos, +774/−308. Merge `e20f671f`.
- Área: transversal (~122 telas). Inclui:
  - `src/components/CampoTexto.tsx` e `CampoTexto.test.ts`;
  - as travas `src/app/campos-texto.test.ts` e `src/app/rotulos.test.ts`.

**2. Objetivo × o que entrou**
- `CampoTexto` substitui `<textarea>` 1:1. Ele mostra a dica "Mínimo N · x/max" ligada por `aria-describedby`, com `aria-hidden` na dica e `aria-invalid` quando o texto está abaixo do mínimo.
- **Divergência:** o título e o corpo dizem que **266** campos migraram e que "os 53 sem `minLength` ficam como estão". Na R1 (`250773ba`), os 53 também migraram (≥ **319** usos), e a trava virou **textual** (a palavra `textarea` proibida fora de `CampoTexto.tsx`). Depois virou lista do permitido com `ts.TypeChecker` (`b80957d6`). Nada disso foi para o corpo.

**3. Rastreabilidade**
- Doc 42, E1/E7: "254 textareas com mínimo invisível" (`42:62`).
- Doc 43:
  - `<textarea minLength>` sem contador caiu de 254 para **2**, com 319 usos de `CampoTexto`;
  - L504 (reserva) resolvido;
  - L2065 (acertos-cobertura) parcial;
  - L2133 (migração financeira) aberto.

**4. Revisão**

| Rodada | Head revisado | Veredito | Achados | Fix |
|---|---|---|---|---|
| R1 | `5121943e` | REQUEST CHANGES | B1 `createElement`, B2 tag dinâmica, B3 `minlength` minúsculo | `250773ba` |
| R2 | `250773ba` | REQUEST CHANGES | B4: nome montado (`"text"+"area"`, `fromCharCode`…) | `14527e4d` (`tagsDinamicas`) |
| R3 (final) | `14527e4d` | REQUEST CHANGES | B5: alias de `createElement`, reatribuição, fábrica | `b80957d6` (lista do permitido + checker) |

- O autor escreveu "não vou mergear por conta própria", e a PR foi mergeada 19 minutos depois **sem nova revisão**.
- **Entrou sem APPROVE** e sem issue.

**5. Testes**
- Suíte com 469 arquivos e 2500 testes.
- Mutações: na R1, 4 sobreviventes; na R2, 5; na R3, 4. Todas foram dadas como mortas pelo autor no commit seguinte.
- C2' (remover o `clearTimeout`) sobrevive, porque não há jsdom.

**6. Pendências**
- C1 (dark mode): o autor contestou, porque `red-700`/`gray-500` já são tokens. Encerrado.
- C2': falta teste de desmontagem.
- Limite declarado: um valor tipado como componente que, em execução, é texto (`as unknown as ComponentType`).

**7. Publicação.** Na `main` e no UAT. Só UI e testes.

**8. Riscos**
- A trava cria um `ts.Program` (~8 s) para os arquivos que sobram da prova sintática.
- Telas novas precisam usar `CampoTexto`. A palavra "textarea" é proibida até em comentário.
- A #145 compôs depois o `Campo` com o `CampoTexto`, sem conflito.

---

#### PR #122 — feat(e4): aba de comissões do /financeiro paginada, com filtro e total do servidor

**1. Identificação**
- Aberta em 25/09 17:25 e mergeada às 18:02. Branch `claude/e4-comissoes-paginacao`.
- 7 arquivos, +179/−35. Merge `7301718a`.
- Área: `/financeiro` (aba comissões) e `src/server/financeiro/consultas.ts`.

**2. Objetivo × o que entrou**
- `listarComissoes`, que não tinha teto, foi removida.
- Entram `listarComissoesPagina` (50 por página, filtro `status` na URL, `Paginacao`, redirecionamento além do fim) e `totaisComissoesAPagar` (`groupBy` por moeda, no escopo do usuário, só `APROVADA`; `consultas.ts:57`).
- O total "A pagar" deixa de ser somado no cliente, o que evita valor de dinheiro errado com a paginação.
- O diff confere com o corpo. As rodadas acrescentaram o vazio filtrado ("Nenhuma comissão nesta situação" + "Ver todas") e "Limpar filtro".

**3. Rastreabilidade**
- N3 da revisão da #103.
- Doc 42 E4 (`42:90-98`).
- Doc 43, §7.5: comissões aparecem como paginadas ("#103/#122").

**4. Revisão**

| Rodada | Head revisado | Veredito | Achado | Fix |
|---|---|---|---|---|
| R1 | `3d8f8c70` | REQUEST CHANGES | B1: redirecionamento sem `status` (sobreviveu) | `f0833bd6` |
| R2 | `f0833bd6` | REQUEST CHANGES | B2: exibição do vazio só testada como prop | `3bf24751` |
| R3 (final) | `3bf24751` | REQUEST CHANGES | B3: o teste usava `string`, mas a produção passa `ReactNode` | `9c32bd56` |

- Mergeada 8 minutos depois do fix da R3, **sem nova revisão**. **Entrou sem APPROVE.**

**5. Testes**
- `(painel)/page.test.ts`, `FinanceiroPainel.test.ts` e `comissoes-pagina.test.ts`.
- Mutações na R3: 3 sobreviventes. O autor reporta que morreram em `9c32bd56`.
- Suíte com 467 arquivos e 2496 testes.

**6. Pendências.** C2 (UI sem `dark:`) é cosmético. Pelo autor, os tons já são tokens.

**7. Publicação.** Na `main` e no UAT. **Mexe em servidor:** consulta de dinheiro e remoção de função. Sem schema e sem `*.int.test.ts`.

**8. Riscos.** As #136 (ordenação) e #144 (busca) mexeram depois na mesma página e na mesma consulta. O comportamento foi preservado nas revisões delas.

---

#### PR #123 — feat: Suporte para deploy no Coolify v4

**1. Identificação**
- Aberta em 25/09 17:42 e mergeada às 17:48 (**6 min**). Branch `cursor/coolify-deploy-d4f5` (agente Cursor).
- 3 arquivos, +273/−0. Merge `d53212b5`.
- Área: infra. São `docker-compose.coolify.yml` (novo), `SETUP.md` e `src/app/api/health/route.ts` (novo).

**2. Objetivo × o que entrou**
- Deploy no Coolify (Traefik, sem Caddy, sem portas publicadas, `db-init` one-shot).
- **Divergências do corpo:**
  - diz "Não altera nenhum código", mas cria uma rota de API;
  - diz "PR em DRAFT", mas a PR não era draft;
  - diz que o healthcheck é `/api/whatsapp/health`, mas o compose usa `/api/health`.

**3. Rastreabilidade.** Nenhuma (infra). Doc 31 (deploy).

**4. Revisão**
- **R1** (`b0ae3dad`), postada às 17:56, **depois do merge**: REQUEST CHANGES.
  - B1: `CREATE DATABASE` dentro de `DO $$` **quebra o deploy**. O "fix" `b0ae3dad` **regrediu** o shell válido de `2c8f3283`.
  - B2: usa `$POSTGRES_USER`, mas o serviço só exporta `PGUSER`.
  - B3: o `SETUP.md` documenta o healthcheck errado.
  - B4: `/api/health` sem teste (mutações de 503 e de remoção do `HEAD` sobrevivem).
- **Entrou sem revisão** e com o `db-init` quebrado. O UAT ficou sem o banco da Evolution até a #124 (7 minutos depois).

**5. Testes.** Nenhum.

**6. Pendências e follow-ups**
- B1 e B2 foram corrigidos pela #124.
- B3 e B4 foram corrigidos pela #125. Na `main`, `SETUP.md:176-196` e o compose (`:125`) apontam `/api/ready` e `/api/health` corretamente (o `/api/ready` veio na #127).

**7. Publicação.** Na `main` e no UAT. Mexe em infra e cria uma rota de API.

**8. Riscos.** Foi o caso mais claro de merge antes da revisão, com quebra real do deploy automático.

---

#### PR #124 — fix(coolify): corrigir db-init idempotente com SELECT + \gexec

**1. Identificação**
- Aberta em 25/09 17:52 e mergeada às 17:55 (**3 min**). Branch `cursor/fix-db-init-d4f5`.
- 1 arquivo, +6/−13. Merge `1610770c`. Commit `1a61c48e`.

**2. Objetivo × o que entrou**
- O `db-init` passa a usar `SELECT 'CREATE DATABASE evolution' WHERE NOT EXISTS (…)\gexec` e `-U "$$PGUSER"`.
- O corpo diz que foi "testado em produção real" (`docker compose -p erptest`, duas execuções com saída 0).
- O diff confere.

**3. Rastreabilidade.** Hotfix de B1 e B2 da #123.

**4. Revisão**
- **R1** (`1a61c48e`), postada às 17:58, **depois do merge**: REQUEST CHANGES.
  - B1: idempotência, criação só se faltar e falha em erro real **sem trava de regressão**.
  - C1: o comentário dizia "executa o SELECT", quando executa o resultado dele.
- A correção em si foi julgada certa.
- **Entrou sem revisão.**

**5. Testes.** Nenhum.

**6. Follow-up**
- A #125 criou a trava, ainda burlável.
- A #133 a fechou (R3 APPROVE).

**7. Publicação.** Na `main` e no UAT. Só infra.

**8. Riscos.** Validação feita diretamente no servidor de produção. Não há trava automática de `docker build`.

---

#### PR #125 — test: resolver pendências R1 dos PRs #123 e #124

**1. Identificação**
- Aberta em 25/09 18:18 e mergeada às 18:28. Branch `cursor/r1-followup-d4f5`.
- 4 arquivos, +124/−4. Merge `fe100eaf`. Commits `c2b425b2` e `2cd9636d`.

**2. Objetivo × o que entrou**
- `SETUP.md` corrigido, para `/api/health` como liveness.
- `src/app/api/health/route.test.ts` (GET 200, `HEAD`).
- `src/deploy/coolify-db-init.test.ts`, que lê o YAML como texto.
- Comentário do `\gexec` corrigido.
- O corpo admite: "**Testes e mutações NÃO foram executados pelo agente**".

**3. Rastreabilidade.** B3 e B4 da #123, B1 e C1 da #124.

**4. Revisão**
- **R1** (`2cd9636d`), postada às 18:29, **depois do merge**: REQUEST CHANGES.
  - B1: remover `-v ON_ERROR_STOP=1` sobrevive, porque o token continua no comentário.
  - B2: evasões por comentário (E1, E3).
- O contrato do `/api/health` foi confirmado (4 mutações mortas).
- **Entrou sem revisão.**

**5. Testes.** São 2 arquivos novos. Mutações: 11 mortas e 3 sobreviventes, segundo a R1.

**6. Follow-ups e defeito introduzido**
- O teste do `db-init` usava `.*\n` e **falhava em checkout Windows** com `autocrlf` (5 testes). Isso foi detectado na #126, na #127 e na #128.
- A #133 (06/10) corrigiu a falha no Windows e as evasões da R1 (B1 e B2), com R3 APPROVE.
- **Ainda aberto:** C6 e N9 da #133. A trava confere as **chaves** do serviço, não os **valores**. `coolify-db-init.test.ts:94` só exige `image`, `restart`, `environment`, `command` e `depends_on`. `image: busybox`, `postgres:15` e `migrate … condition: service_started` passam.

**7. Publicação.** Na `main` e no UAT. Mexe em teste de API, infra e docs.

**8. Riscos.** É uma PR de travas que nunca foi executada pelo autor e que foi mergeada sem rodar. A falha só apareceu em outras PRs.

---

#### PR #126 — feat(ui): EstadoVazio no design system e migração dos estados vazios (E1)

**1. Identificação**
- Aberta em 25/09 18:29 e mergeada em **26/09 18:52**. Branch `claude/e1-estado-vazio`.
- 179 arquivos, +1747/−254. Merge `6bafa89c`. Commits `9bd0a578`, `09686680` (merge da `main`) e `ed6ec8c8`.
- Área: transversal (~173 arquivos). Inclui:
  - `src/components/EstadoVazio.tsx` (`EstadoVazio` + `EstadoVazioLinha`) e `EstadoVazio.test.ts`;
  - `src/app/estados-vazios.test.ts`;
  - o manifesto `src/app/estados-vazios-mapa.ts`.

**2. Objetivo × o que entrou**
- Componente único de estado vazio. A variante compacta é a padrão; `bloco` para a lista principal; `acao` traz o próximo passo.
- O corpo fala em **204 usos em 170 arquivos**. Depois da R3, foram **219 em 173**, com mais 12 vazios crus achados em condições compostas. O corpo não foi atualizado.
- Itens pontuais: `revisoes-correcao-aula`, `recuperacoes/reservas/[id]/cancelamento` e `configuracao/contratos` (CTA "Preparar novo modelo").

**3. Rastreabilidade**
- Doc 42, E1: "129 estados vazios em texto cru" (`42:62`).
- Doc 43: `<p>Nenhum…</p>` cru caiu de 129 para **9**, com 260 usos de `EstadoVazio` (E1 #126/#134).
- A microcopy "nesta página" (doc 42 L421 e L606) ficou para a #134.

**4. Revisão**
- **R1** (`9bd0a578`): REQUEST CHANGES.
  - B1: `createElement` não detectado.
  - B2: uma exceção por substring engole um vazio real.
  - B3: o piso de ≥200 é editável.
  - B4: o teste visual é um snapshot de string.
  - C1: **48 conflitos** com a `main`.
- **R2** (`09686680`): REQUEST CHANGES. O commit era só o merge da `main`; B1–B4 continuavam abertos.
- **R3** (`ed6ec8c8`): REQUEST CHANGES.
  - B1, B3 e B4 corrigidos: lista do permitido; manifesto `MAPA_ESTADOS_VAZIOS` com contagem por outro caminho; invariantes de token lidos do `tailwind.config`.
  - **B2 aberto**: exceção exata + `<p>` cru + manifesto editado junto passam (E6).
  - C5 e C6 residuais.
- Mergeada **24 horas depois da R3, sem nenhum commit novo e sem comentário de autorização**. **Entrou sem APPROVE**, com B2 aberto e sem issue.

**5. Testes e travas**
- `estados-vazios.test.ts`: autoteste com 32 ramos + 4 de `className`, depois ampliado.
- Manifesto `estados-vazios-mapa.ts` (21 exceções ancoradas).
- `EstadoVazio.test.ts`, com invariantes de design e contagem por arquivo.
- O autor reporta 26 de 26 mutações mortas, com controle. A R3 aponta 4 sobreviventes: E6, E5, E9 e E12c.

**6. Pendências**
- B2 (exceção exata + manifesto editado junto) continua sem issue.
- C6: o piso `USOS_DA_MIGRACAO_E1 = 219` ainda é uma constante solta (`EstadoVazio.test.ts:107`).
- C5: dá para editar junto o "oráculo" de tokens.
- C3: o texto do contador (`aria-live`) nas listas.

**7. Publicação.** Na `main` e no UAT. Só UI e testes.

**8. Riscos**
- O manifesto exato de 219 entradas torna **toda mudança de texto de vazio** uma edição em dois arquivos. Isso apareceu na #128, na #130, na #134 e na #136, todas obrigadas a editar `estados-vazios-mapa.ts`.
- Conflitos grandes com a #128, resolvidos em `c5140f8a`.

---

#### PR #127 — fix: corrige falha do Prisma em Alpine 3.24 (OpenSSL 3.0)

**1. Identificação**
- Aberta em 25/09 18:36 e mergeada às 19:18. Branch `cursor/fix-prisma-openssl-alpine-99a4`.
- 8 arquivos, +510/−12. Merge `50749246`.
- Commits finais: `318989f4`, `af60eb96`, `0db7df9f`, `6fc3ad28` e `5df0ae32`. As revisões citam `2b484c0c` e `90b482ae`, que foram reescritos por **push forçado** e não existem no histórico final.
- Área: infra e API.
  - `Dockerfile`;
  - `docker-compose.coolify.yml` e `SETUP.md`;
  - `src/app/api/ready/route.ts` (novo) e os testes `ready/route.test.ts` e `src/deploy/dockerfile-prisma.test.ts` (203 linhas);
  - `docs/planejamento/quadro-entregas.md`.

**2. Objetivo × o que entrou**
- Estágio `base` fixado em `node:22-alpine3.24@sha256:0a7108bf…e402`, com `apk add --no-cache openssl` (`Dockerfile:8-9`).
- `ENV HOSTNAME=0.0.0.0` (`:40`).
- Checagens no build que **carregam os engines**: `migrate status` e `$connect` precisam dar `P1001`.
- `/api/ready` faz `SELECT 1` com timeout de 3 s e devolve 503 `{ready:false}` sem expor o erro.
- O healthcheck do Coolify usa `http://127.0.0.1:3000/api/ready` (`compose:125`). Com `localhost`, o BusyBox resolve `::1`.
- **Divergência:** a R1 tinha `binaryTargets` no `schema.prisma`; a versão final **removeu** esse ajuste. A `main` atual não tem `binaryTargets` (`schema.prisma:8`). A decisão foi do dono do projeto.

**3. Rastreabilidade.** Nenhuma (infra). Está registrada no quadro (`quadro-entregas.md:1194-1296`).

**4. Revisão**
- Houve uma revisão "COMMENT" inicial (Claude Code), sem blockers, e uma R1 "placeholder" postada por engano.
- **R1** (`2b484c0c`): REQUEST CHANGES. B1: sem trava do Dockerfile. B2: sem trava de `binaryTargets`.
- **R2** (`90b482ae`): REQUEST CHANGES.
  - B3: importava `@/server/db`, módulo que não existe; `tsc` saía com 2 e os testes davam **falso verde** por causa do mock.
  - B2 virou regressão.
- **R3** (`0db7df9f`): REQUEST CHANGES. B1 e B2 continuavam abertos; B3 corrigido.
- Depois da R3, o autor respondeu às 19:12:
  - `6fc3ad28`: trava do Dockerfile, 13 de 13 mutações;
  - B2 fica fora "por decisão do dono do projeto";
  - `5df0ae32`: troca para 127.0.0.1.
- Mergeada às 19:18, **sem revisão desses commits**. **Entrou sem APPROVE**, com B2 recusado por decisão e B1 corrigido mas não revisado.

**5. Testes**
- `dockerfile-prisma.test.ts` executa o JS da checagem contra um `@prisma/client` falso.
- `ready/route.test.ts`.
- 15 mutações detectadas, segundo o corpo.
- O `tsc` final só foi validado na R3 (saída 0, sobre `0db7df9f`).

**6. Pendências declaradas**
- `tsc` no ambiente do integrador.
- Confirmar o redeploy no Coolify: container `healthy`, `migrate` com saída 0 e `/api/ready` 200.
- O quadro ainda marca "**Não concluído**" (`quadro-entregas.md:1291-1296`). O `docker build` não está no CI.

**7. Publicação.** Na `main` e no UAT. É a própria imagem do UAT. Cria uma rota de API.

**8. Riscos**
- Com o digest fixado, atualização de segurança do Alpine e do Node exige troca manual.
- A garantia do engine depende de o build quebrar. Sem `docker build` no CI, isso só aparece no deploy.

---

#### PR #128 — fix(whatsapp): linha comercial — conversas do número de vendas na inbox do vendedor (SPEC-ERP-005, Fases 0–4)

**1. Identificação**
- Aberta em 26/09 15:25 e mergeada às 21:11. Branch `claude/whatsapp-conexao-inbox-3fa5c2`.
- 37 arquivos, +2021/−82. Merge `1db11055`.
- Commits, um por fase:
  - `67a842f9`: SPEC;
  - `ce6b7335`: Fase 0, LID;
  - `13afe532`: Fase 2;
  - `f99a25a3`: Fase 3;
  - `bc8c14be`: Fase 4;
  - `ea171c8d`: travas unitárias;
  - `c5140f8a`: merge da `main` com a #126.
- Área: WhatsApp e inbox.
  - Servidor: `linha-comercial.ts` (novo, 171 linhas), `historico.ts` (novo), `evolution-jid.ts` (novo), `escopo.ts`, `atendimentos.ts`, `consultas-inbox.ts`, `acoes.ts`, `busca-inbox.ts`, `operacoes-atendimento.ts` e `sessao.ts` (`MESSAGES_SET`).
  - Rotas: webhook Evolution e cron.
  - UI: inbox (`InboxCliente`, `AtendimentosPainel`, `page`), `leads/[id]/page` e `comercial/captura`.

**2. Objetivo × o que entrou**
- Número de VENDAS passa a ser **linha comercial**: toda conversa 1:1 aparece para o dono, com ou sem lead.
- Contato por `@lid` resolvido via `remoteJidAlt`/`senderPn` (`evolution-jid.ts:11-19`).
- Histórico do aparelho dos últimos 30 dias, só Baileys, sem efeitos colaterais.
- Backfill LC-15: mensagens que estavam na triagem vão para a inbox do dono.
- Telas: filtro de canal, faixa "Sua linha", selo "sem lead" e botão "Criar lead".
- Sem migração. O diff confere com o corpo.

**3. Rastreabilidade**
- **SPEC-ERP-005** (`docs/specs/whatsapp-linha-comercial.md`).
- Decisões LC-D01 a D06 e regras LC-01 a LC-15, LC-I01, LC-L02/L03/L05.
- Docs 00, 26 e 37 e o quadro.
- Fora dos docs 42 e 43.

**4. Revisão**
- **R1** (`bc8c14be`): REQUEST CHANGES. B1: as garantias de escopo, histórico e LC-15 só estavam travadas em `*.int.test.ts`, fora do `npm test`. Fix `ea171c8d` (travas unitárias).
- **R2** (`c5140f8a`): **APPROVE** às 19:06.
- **R2, correção** (mesmo head), às 20:12: **REQUEST CHANGES**. B2 (ex-C4): opt-out gravado por `update` do contato sobrevive ao `npm test`.
- Mergeada às 21:11 **com B2 aberto**. A #129 foi aberta às 21:13 para fechar o B2. **Entrou sem APPROVE válido.**

**5. Testes**
- Novos: `linha-comercial.test.ts`, `escopo-atendimentos.test.ts`, `historico.test.ts`, `evolution-jid.test.ts` e o da rota do webhook.
- **Int:** `linha-comercial.int.test.ts` (novo, 438 linhas), `acesso-atendimento.int.test.ts` e `destinatario-atual.int.test.ts`. Os dois últimos foram ajustados para a mudança deliberada de comportamento. **Não executados**, e fora do CI.
- O autor reporta 13 mutações unitárias mortas; o revisor reporta "≥ 20 mortas".

**6. Pendências declaradas**
- `vitest -c vitest.integration.config.ts` com perfil isolado.
- `next build`.
- Confirmar, num `messages.upsert` real da Evolution 2.3.7, o nome do campo do telefone alternativo do LID.
- Linhas já conectadas precisam de "Conectar QR" **e de um novo vínculo do aparelho** para o histórico chegar.
- C2 (mutações fracas no LID) ficou como nit.
- O cabeçalho da SPEC ainda diz "codificadas com testes escritos, ainda sem execução".

**7. Publicação.** Na `main` e no UAT. **Mexe muito no servidor**: acesso, roteamento e webhook. Mexe em `*.int.test.ts`. Sem schema.

**8. Riscos**
- Muda **acesso**: o dono da linha passa a ver conversas sem lead.
- O backfill LC-15 move registros da triagem no banco do UAT ao salvar o número ou no cron.
- As integrações que provariam o escopo (LC-03, LC-04, LC-09) nunca rodaram.
- AGENTS.md proíbe ativar integração externa nesta fase. A PR nasceu de "teste em produção" com WhatsApp real (observação de processo).

---

#### PR #129 — test(whatsapp): LC-10 — trava de opt-out no histórico (B2 da revisão da #128)

**1. Identificação**
- Aberta em 26/09 21:13 e mergeada às 23:35. Branch `claude/whatsapp-linha-trava-optout`.
- 1 arquivo (`historico.test.ts`), +82/−8. Merge `437bfac2`.
- Commits: `00fc4c84`, `11ab877e`, `87add60a` e `9ae2aff9`.

**2. Objetivo.** Fechar o B2 da #128, só com teste: nenhuma escrita no contato durante a importação do histórico toca `optOutEm`.

**3. Rastreabilidade.** LC-10 da SPEC-ERP-005.

**4. Revisão**

| Rodada | Head revisado | Veredito | Achado | Fix |
|---|---|---|---|---|
| R1 | `00fc4c84` | REQUEST CHANGES | B1: mutações condicionais (`fromMe`, triagem, corpo vazio) | `11ab877e` (`afterEach` em todo cenário) |
| R2 | `11ab877e` | REQUEST CHANGES | B2: escrita por `prisma.contatoWhatsApp`, fora da transação | `87add60a` |
| R3 (final) | `87add60a` | REQUEST CHANGES | B3: `$queryRaw`/`$queryRawUnsafe` | `9ae2aff9` (`METODOS_SQL_CRU`) |

- Mergeada 1 minuto depois de `9ae2aff9`, **sem revisão**. **Entrou sem APPROVE.**

**5. Testes.** O autor reporta 7 de 7 mutações mortas em `9ae2aff9`. Na `main`: `historico.test.ts:45` (`METODOS_SQL_CRU` com os 4 métodos).

**6. Pendências.** C3: `deleteMany` com `?.` fica fora da superfície espionada. Não grava opt-out; está fora do contrato.

**7. Publicação.** Na `main` e no UAT. Só teste.

**8. Riscos.** Baixos. O código de produção não mudou.

---

#### PR #130 — fix(inbox): "Abrir atendimento" sem destinatário não culpa a falta de canal

**1. Identificação**
- Aberta em 26/09 23:50 e mergeada em 27/09 10:29. Branch `claude/inbox-abrir-atendimento-sem-destino`.
- 6 arquivos, +143/−5. Merge `9059924c`. Commits `05c65688` e `9aea66d0`.

**2. Objetivo × o que entrou**
- `listarOpcoesAtendimento` passa a devolver `comercial` (`operacoes-atendimento.ts:27-28`).
- O painel distingue três casos: "sem lead na carteira", "sem destinatário no escopo" e "sem canal ativo".
- Nova entrada no manifesto de vazios. O diff confere.

**3. Rastreabilidade.** Defeito da #128 visto em produção. SPEC-ERP-005 §5.5.

**4. Revisão**
- **R1** (`05c65688`): REQUEST CHANGES. B1: o `comercial` não estava preso por teste unitário. B2: o retorno antecipado sem canais também não.
- Fix `9aea66d0`: `operacoes-atendimento.test.ts`, +95 linhas.
- **R2** (`9aea66d0`): **APPROVE**, com M1–M5 e U1–U3 mortas.
- Suíte: 481 arquivos e 2627 testes.

**5. Testes.** `operacoes-atendimento.test.ts` e `AtendimentosPainel.test.ts` (3 casos). Também `linha-comercial.int.test.ts` (+6 linhas, **não executado**).

**6. Pendências.** Nenhuma.

**7. Publicação.** Na `main` e no UAT. Mexe em servidor e em `*.int.test.ts`.

**8. Riscos.** Baixos.

---

#### PR #131 — fix(inbox): nome do contato não vem mais do perfil da própria linha

**1. Identificação**
- Aberta em 29/09 13:52 e mergeada às 17:34. Branch `claude/prod-duplicate-names-016cff`.
- 20 arquivos, +352/−18. Merge `818ab822`.
- Commits: `25b38796` e `f63274e9`. Este último se chama "revisão da #131", mas **não há revisão no GitHub**.

**2. Objetivo × o que entrou**
- Nova coluna `ContatoWhatsApp.nomePerfil`.
- Migração `20260929120000_contato_whatsapp_nome_perfil`. Além do `ALTER TABLE`, ela tem um **`UPDATE` de dados**: o nome de contato sem vínculo e sem intenção do ERP é movido de `nomeExibicao` para `nomePerfil`.
- O `pushName` de `fromMe` é descartado.
- `nome-contato.ts` vira o ponto único de exibição: aluno → lead → responsável → nome do ERP → perfil → número.
- Busca também em `nomePerfil`.
- Script `scripts/reparar-nome-contato-whatsapp.ts`, só leitura por padrão; `--aplicar` limpa.
- `.gitattributes` (`-text` para a migração), docs 12 e 30 e o quadro.

**3. Rastreabilidade.** Bug de produção de 29/09. Doc 12 (evento `NomeContatoReparado`) e doc 30.

**4. Revisão.** **Nenhuma** revisão nem comentário no GitHub. **Entrou sem revisão.**

**5. Testes**
- `nome-contato.test.ts` (novo), mais ajustes em `busca-inbox` e `historico`.
- "Unitários por arquivo: 8 arquivos, 65/65". **Não é a suíte completa.**
- **`tsc` não aprovado**: o client do Prisma estava atrás do schema.
- `inbound.test.ts` não rodou.

**6. Pendências declaradas** (o quadro marca "Não concluído", `quadro-entregas.md:1337-1343`)
- O integrador confirma o ID da migração, regenera o client e roda `tsc` e as integrações do WhatsApp.
- Produção: rodar o reparo só leitura, conferir e então `--aplicar`. Renomear os leads listados.
- Hoje a suíte e o `tsc` estão verdes na `main`, pelo CI das PRs posteriores, então a parte do client foi resolvida de fato. **O reparo em produção e as integrações não têm evidência.**

**7. Publicação.** Na `main` e no UAT. **Mexe em schema e migração, com `UPDATE` de dados aplicado automaticamente no UAT pelo `migrate deploy`**, e em servidor. Sem `*.int.test.ts`.

**8. Riscos**
- **Divergência:** o corpo diz "A migração não foi aplicada em nenhum banco", mas o merge na `main` a aplica no UAT automaticamente. O banco do UAT tem dados reais (§3.4.1, item 5).
- O `UPDATE` não tem volta automática.
- Mergeada sem revisão e com `tsc` reprovado no ambiente do autor.

---

#### PR #132 — feat(inbox): editar o nome salvo do contato pela conversa

**1. Identificação**
- Aberta em 29/09 17:53 e mergeada às 18:08 (**15 min**). Branch `claude/inbox-editar-contato`.
- 19 arquivos, +361/−31. Merge `d0b3bfb5`. Commits `1d1a1fdc` e `f40065ce`.

**2. Objetivo × o que entrou**
- Ação `editarNomeContatoWhatsApp`: até 80 caracteres, gravação condicional ao nome lido e evento `ContatoRenomeado`.
- Capacidade `whatsapp.editar_contato` (doc 37) e painel "Editar nome" no `InboxCliente`.
- **Divergência:** o corpo **não menciona** a coluna `nomeEditadoEm` nem a migração `20260929130000_contato_whatsapp_nome_editado`, que entraram no diff (`schema.prisma`, `migration.sql`, `.gitattributes`).

**3. Rastreabilidade.** Docs 12 e 37.

**4. Revisão.** **Nenhuma** no GitHub. O commit `f40065ce` cita "correções da revisão", sem rastro no GitHub. **Entrou sem revisão.**

**5. Testes**
- `editar-nome-contato.test.ts` (5 casos). "8 arquivos, 56/56" por arquivo.
- **`tsc` não aprovado.**

**6. Defeito introduzido e follow-up**
- A PR **deixou a `main` vermelha**. Em `d0b3bfb5`, falham 2 travas por causa do novo código do `InboxCliente`: `src/app/anuncios.test.ts` (nota `<p>` condicional sem `role`) e `src/lib/mensagens.test.ts` (`catch` com texto à mão).
- No Windows eram 7 falhas, somando as 5 do Coolify com CRLF.
- Corrigido pela **#133** em 06/10. A `main` ficou vermelha de 29/09 a 06/10.
- Pendência do quadro: o integrador confirma o ID da migração e roda as integrações (`quadro-entregas.md:1380-1384`).

**7. Publicação.** Na `main` e no UAT. **Mexe em schema e migração**, aditiva, sem `UPDATE`, e em servidor.

**8. Riscos.** Mergeada em 15 minutos, sem revisão, com a suíte quebrada.

---

#### PR #133 — fix: suíte verde no main — travas de anúncio e de resultado incerto no inbox; db-init no Windows

**1. Identificação**
- Aberta em 06/10 14:13 e mergeada às 18:33. Branch `claude/inbox-travas-main`.
- 3 arquivos, +80/−13. Merge `20872f66`. Commits `9c9ef533`, `dc6af51f` e `a8bdfb1f`.

**2. Objetivo × o que entrou**
- `InboxCliente`:
  - a nota do cadastro ganha `role="note"`;
  - o `catch` de "salvar nome" passa a `MSG_RESULTADO_INCERTO_SEM_CHAVE`;
  - na R1 entraram `useId` e `aria-describedby` para a nota e a dica (B4).
- `coolify-db-init.test.ts`:
  - normaliza CRLF e ignora linhas de comentário;
  - confere as linhas exatas do `psql` e do `SELECT … \gexec` (R1);
  - confere o **script inteiro** e as chaves fechadas do serviço (R2).

**3. Rastreabilidade.** Corrige as regressões da #132 e da #125. Relaciona-se ao ganho rápido #20 (#118).

**4. Revisão**
- **R1** (`9c9ef533`): REQUEST CHANGES.
  - B1–B3: 8 evasões sobreviviam no `db-init` (comentário inline, `-v` repetido, `\gexec` dentro de literal, `OR true`, `${PGUSER}`, linha em branco).
  - B4: a nota não chegava ao leitor de tela.
- **R2** (`dc6af51f`): REQUEST CHANGES. B5: a trava conferia linhas, não o script; N1–N6 sobreviviam (`exit 0`, `true`, heredoc `:`, `if false`, `entrypoint`).
- **R3** (`a8bdfb1f`): **APPROVE**, com N1–N6 e R3a–R3h mortas.

**5. Testes**
- Suíte com 483 arquivos e 2649 testes.
- Placar da R2: 28 mutações mortas, 6 blockers, 4 fora de escopo.

**6. Pendências (abertas hoje)**
- **C6 e N9:** os **valores** de `image` e de `depends_on` não estão travados (`coolify-db-init.test.ts:94`, só as chaves).
- **C1:** I5–I7 nas travas antigas. Na `main`, `anuncios.test.ts:33` ainda aceita qualquer `role=` (`/\brole=|aria-live=/`), então `role="presentation"` passa. O detector de "resultado incerto" não resolve texto em variável intermediária nem em template.
- Não há issue para nenhum dos dois.

**7. Publicação.** Na `main` e no UAT. Só UI e testes.

**8. Riscos.** Baixos. Foi pré-requisito das #134–#138.

---

#### PR #134 — fix(e1): estado vazio paginado — a página 1 diz "nenhum registro", não "nesta página"

**1. Identificação**
- Aberta em 06/10 14:23 e mergeada às 20:42. Branch `claude/e1-vazio-paginado`.
- 65 arquivos, +1079/−66. Merge `5f28b7ea`.
- Commits: `5448e12e`, `9b443b5c`, `07ff129d`, `084540d3` e `f42f6382` (merge da `main`).
- Área: 43 estados vazios paginados em acadêmico, alunos, financeiro, matrículas e secretaria. Inclui:
  - as travas `src/app/vazio-paginado.test.ts` (404 linhas) e o manifesto de guardas `vazio-paginado-mapa.ts`;
  - `estados-vazios-mapa.ts` (+44) e `botoes-mapa.ts`.

**2. Objetivo × o que entrou**
- Na página 1, o texto é concreto ("Nenhum pedido aguardando decisão administrativa."). Nas páginas seguintes, "… nesta página." e "Ir para a primeira página", preservando os outros parâmetros da tela.
- Na R1 a PR mudou mais do que o corpo diz:
  - `equivalencias` só afirma "nesta matrícula" sem `cursor` nem `proximoCursor`;
  - os painéis do aditivo recebem a página do outro painel como prop obrigatória;
  - `antesVersao: number | undefined` e `cursor: string | undefined` ficam obrigatórios.

**3. Rastreabilidade**
- Doc 42: **L421** (`secretaria/desistencias`) e **L606** (`contrato` e `participantes`), continuação do E1.
- Doc 43:
  - `<p>Nenhum…</p>` cru: 9 (#126/#134; trava em #139);
  - achado **L1469** parcial (volta só com a página vazia).

**4. Revisão**
- **R1** (`9b443b5c`): REQUEST CHANGES.
  - B1: em `equivalencias`, a página 1 afirmava algo falso, uma regressão.
  - B2: 3 links perdiam a outra lista.
  - B3: 5 evasões só de condição.
  - B4: direção inversa.
  - B5: links sem teste.
  - 10 mutações sobreviveram.
- **R2** (`07ff129d`): REQUEST CHANGES.
  - B1: `.join` e `*-mapa.ts` invisíveis.
  - B2: `antesVersao={antes ?? 1}`.
  - B3: `acao` da reserva removível.
  - B4: a fiação do pai do aditivo.
- **R3** (`f42f6382`): REQUEST CHANGES.
  - B1: montagens XV1–XV10 invisíveis.
  - B2: o render da reserva não pega `<strong>` nem `&nbsp;`.
- Comentário às 20:42: "**Merge autorizado pelo responsável com os blockers da R3 como follow-up: #139.** Integração local `main` + #134 + #135: `tsc` 0; `vitest` 492/492 arquivos, 2708/2708 testes."
- **Entrou sem APPROVE** (decisão do usuário, issue #139).

**5. Testes**
- Render de página 1 × página N em cerca de 15 telas. Arquivos novos de teste: `designadas`, `contrato`, `aditivos`, `participantes`, `reserva`, `correcoes/[reposicaoId]` e `aditivos/[propostaId]`.
- Placar da R3: as sobreviventes da R2 morreram; 12 sobreviventes novas (XV1–XV10, R3, R4).

**6. Pendências e follow-ups**
- **#139** (B1 e B2 da R3) foi **fechada em 07/10 23:39 pela #147**. A #147 teve R1, R2 e R3 em REQUEST CHANGES; a correção final `8cc014b7` foi verificada pelo integrador ("20/20 KILLED", CI 4/4) e mergeada pela regra pós-R3.
- A #147 declara fora do alcance:
  - retorno antecipado sem `else`;
  - palavra partida (`"nes"+"ta"`);
  - texto que não nasce de literal;
  - "Página" maiúscula depois de algo desconhecido.
- Pendências de produto declaradas: os textos de página 1 em migração, acertos-taxa/cobertura e reserva.
- C5: as linhas JSX longas de `avisos-agenda` e `envios-portal`.

**7. Publicação.** Na `main` e no UAT. Só UI e testes.

**8. Riscos.** São três manifestos (vazios, guardas e botões) para manter. A trava reconhece a paginação pelo **nome** do identificador (cursor/página).

---

#### PR #135 — feat(ui): botões dos componentes no design system, perigo nas ações destrutivas e aria-pressed nas alternâncias (E1)

**1. Identificação**
- Aberta em 06/10 14:34 e mergeada às 20:43. Branch `claude/e1-botoes-componentes`.
- 58 arquivos, +1042/−137. Merge `ab21a068`.
- Commits: `1a9a3946`, `156240f6`, `ace76094`, `d5da9ad7`, `d1853d2d` e `1a1ef40a`.
- Área: `src/components` (`EstadoRota`, `PagamentoModal`, `ExportarPlanilha`, `CopilotoSugestoes`) e ~45 botões em 40 telas. A trava `src/app/botoes.test.ts` ganhou +874 linhas; `botoes-mapa.ts`, +79/−58.

**2. Objetivo × o que entrou**
- Botões dos componentes no design system.
- Verbo destrutivo vira `perigo`, por lista fechada, com conferência ramo a ramo.
- `aria-pressed` e `role="group"` nas alternâncias: dias da semana, filtros da `FilaCobranca`, PF/B2B no Kanban e temperatura no Inbox.
- Na R1 entraram mudanças de produto além do corpo:
  - "Encerrar" país (`PaisesPainel`, variante na tabela) passa a `perigo`;
  - "Confirmar desistência…", "Efetivar encerramento aprovado", "obsoletar" e "Reabrir… e descartar" passam a `perigo`;
  - "Aceitar" do copiloto vai para `ai-solid`;
  - "Descartar" sugestão volta a `secundario`, com exceção nomeada.

**3. Rastreabilidade**
- Doc 42, **L2400** (`TurmaFormulario`, `aria-pressed`) e E1.
- Doc 43:
  - `Botao`/`botaoClasses` em 218 arquivos (follow-up #140);
  - L531 (`DecidirPreco`) parcial;
  - L2428 (países, "Encerrar" em perigo, sem confirmação) parcial;
  - L327 resolvido.
- **Ações de alto impacto sem confirmação: 12 de 12** continuam assim. A cor `perigo` não é confirmação.

**4. Revisão**
- **R1** (`d5da9ad7`): REQUEST CHANGES.
  - B1: "Encerrar" país e a tabela.
  - B2: destrutivos fora da lista.
  - B3: inversão por condição escrita de outro jeito.
  - B4: evasões no `<Botao>`.
  - B5: valor e grupo do `aria-pressed`.
  - B6: isenções `ai-*`.
  - 15 mutações sobreviveram.
- **R2** (`d1853d2d`): REQUEST CHANGES. B1–B6 novos (T1–T3, A15, A16, A8b, K4b, H16): 7 blockers sobreviventes.
- **R3** (`1a1ef40a`): REQUEST CHANGES, com cerca de 20 sobreviventes.
- **R3 corrigida**: A16f (`aria-labelledby` para id inexistente) vira blocker. Registra conflito com a #138 em 3 arquivos.
- Comentário às 20:43: merge autorizado com follow-up **#140**. **Entrou sem APPROVE.**

**5. Testes**
- `botoes.test.ts`, com render de `TurmaFormulario` e `PoliticaPainel`.
- Placar da R1: 23 mortas e 15 sobreviventes. Na R3: as 9 sobreviventes da R2 morreram e ~20 novas sobreviveram.

**6. Pendências e follow-ups**
- **#140** (B1–B6 + A16f) foi **fechada em 07/10 22:24 pela #148**. A #148 teve R1, R2 e R3 em REQUEST CHANGES; o integrador aplicou `f2acc5bf` e o CI ficou verde.
- Resíduo declarado na #148: os verbos "Anular" e "estorno" sem caso de teste.
- **Follow-ups declarados e abertos hoje, sem issue:**
  - `aria-pressed` no "Alternar tema" (`Sidebar.tsx:59`, sem `aria-pressed` na `main`);
  - `aria-current="step"` no wizard de matrícula (ausente);
  - chip de temperatura com `disabled` em vez de `aria-disabled` (`InboxCliente.tsx:1087-1088`, inalterado);
  - C4/C5 (`children` como prop, `<strong>` no rótulo, constante sombreada, `&&` invertido): auto-edição do manifesto.

**7. Publicação.** Na `main` e no UAT. Só UI e testes.

**8. Riscos**
- Conflito textual com a #138 (`portal/painel.tsx`, `RevisoesCorrecaoAula.tsx`, `CopilotoSugestoes.tsx`), resolvido na #138 por merge de 3 vias "por token". O `btnMini` e o `VALOR_LABEL` foram removidos.
- O vermelho sólido em ações frequentes (`sm`) pesa no visual.

---

#### PR #136 — feat(e1): ColunaOrdenavel — ordenação no servidor em /comissoes, /alunos e /empresas

**1. Identificação**
- Aberta em 06/10 14:43 e mergeada às 20:50. Branch `claude/e1-coluna-ordenavel`.
- 31 arquivos, +1153/−58. Merge `6978127b`.
- Commits: `17eadc62`, `09dd094d`, `670a009f`, `f6b54946`, `a1029409` (merge) e `92126856` (R4).
- Área:
  - Servidor: `alunos/filtros` e `alunos/consultas`, `empresas/filtros` e `empresas/consultas`, `financeiro/consultas` e `financeiro/ordem-comissoes.ts` (novo).
  - `src/lib/ordenacao.ts` e `src/components/ColunaOrdenavel.tsx`.
  - Telas `/alunos`, `/empresas`, `/comissoes` e a aba do `/financeiro`; teste da rota de exportações.

**2. Objetivo × o que entrou**
- `<th scope="col" aria-sort>` com link real.
- Lista fechada de colunas por tela; desempate por `id`; a ordem padrão fica fora da URL.
- Na R1: `aria-sort` só na coluna ordenada (`ColunaOrdenavel.tsx:49`) e testes de "a ordem é mantida". Na R4: o clique com JavaScript é testado (`aoClicar`).
- O diff confere com o corpo.

**3. Rastreabilidade**
- Doc 42: §5.6 (A9), E1 e a métrica "colunas ordenáveis ≥ 3" (`42:2791`).
- Doc 43: `aria-sort` subiu de 0 para 4, com 11 usos de `ColunaOrdenavel`; L2271 resolvido.
- Não foi tratado o doc 42 **L2259**, a coluna "Previsão de pagamento" em `/comissoes`: continua ausente na `main`.

**4. Revisão**
- **R1** (`09dd094d`): REQUEST CHANGES.
  - B1: `aria-sort="none"` em todas as colunas.
  - **B2: collation do Postgres Alpine, que ordena por bytes.**
  - B3–B6: confiabilidade de teste. 13 mutações sobreviveram.
- **R2** (`670a009f`): REQUEST CHANGES.
  - B2 confirmado em `postgres:16-alpine` (`datlocprovider=c`; `Bruno, Zoila, ana, bea, Álvaro, Ñandú, Óscar`) e **DEFERRED** para o responsável.
  - B7 (evasões de `aria-sort`) e B8 (href da página 1).
- **R3** (`f6b54946`): REQUEST CHANGES. B9 (evasões X1–X21) e B10 (`aoClicar` sem teste).
- **R4**, autorizada pelo responsável e só para o B10: fix `92126856` com a `main` trazida. Mergeada 3 minutos depois. O comentário diz: "B9 e B2 seguem como follow-up em #141. Merge autorizado pelo responsável."
- **Entrou sem APPROVE.**

**5. Testes**
- `ordenacao.test.ts`, `ColunaOrdenavel.test.ts`, `colunas-ordenaveis.test.ts` (AST, sentinela, varredura de todo o `src`), `ordem-comissoes.test.ts` e os testes de página.
- Mutações: 39 na R1 (13 sobreviventes); o autor reporta 9 de 9 mortas no B10 da R4.
- Suíte final: 496 arquivos e 2787 testes.

**6. Pendências e follow-ups**
- **#141 continua ABERTA.**
  - O B9 foi resolvido pela **#149** ("Refs #141", mergeada em 07/10 23:54, R1–R3 em REQUEST CHANGES, ajuste do integrador `3fc690b5`, 20/20 mortas).
  - O **B2 (collation) não foi tratado**. Na `main` não há `POSTGRES_INITDB_ARGS`, `--locale-provider=icu` nem `COLLATE "und-x-icu"` nos composes nem nas migrações.
  - A #149 ainda deixou em aberto: parâmetro reatribuído e alias de objeto não entram na análise de valor.
- Abertos e sem issue:
  - C1: `/empresas` não tem como voltar à ordem padrão ("mais recentes primeiro"); não há link na `main`.
  - C4: `PADRAO` em `ordem-comissoes.ts:14` (código morto, segundo a R1).
  - C2: Valor agrupado por moeda.

**7. Publicação.** Na `main` e no UAT. **Mexe em servidor** (`orderBy` das consultas e exportação de alunos). Sem schema e sem `*.int.test.ts`.

**8. Riscos.** **Ordenação alfabética errada em produção** para nomes com acento ou minúscula ("Álvaro" depois de "Zoila"), agora anunciada como `aria-sort="ascending"`. Corrigir exige migração ou infra, com coordenação do integrador.

---

#### PR #137 — fix(e5b): campo de data do início da cobertura abre preenchido; datas da Secretaria travadas (resíduo N2 da #111)

**1. Identificação**
- Aberta em 06/10 14:44 e mergeada às 18:33. Branch `claude/secretaria-datas-mensalidade`.
- 2 arquivos, +79/−1. Merge `602e20b4`. Commits `b05e4329`, `8510d210` e `0238db58`.

**2. Objetivo × o que entrou**
- Nasceu como "só um teste". Na R1 virou **correção de defeito**: o `<input type="date">` do início da cobertura recebia `dd/mm/aaaa` e abria vazio. Era uma regressão da #111, commit `1f267c2`.
- Correção: `SecretariaPainel.tsx:61`, com `defaultValue={m.cobertura.inicio ?? ""}`.
- Teste com fuso fixo (`America/Sao_Paulo`) e uma **sentinela** de fuso.
- O título e o corpo foram atualizados (C4).

**3. Rastreabilidade.** N2 da revisão da #111 (E5). Doc 43: datas civis em ISO caíram de 16 para **0** (#111/#137).

**4. Revisão**
- **R1** (`b05e4329`): REQUEST CHANGES.
  - B1: o teste dependia do fuso da máquina.
  - B2: só olhava o `<tbody>` e não cobria o caso "sem início".
  - B3: bug real no input.
  - B4: cobertura sem trava.
- **R2** (`8510d210`): REQUEST CHANGES. B1 parcial: com `pool: threads`, o `process.env.TZ` não vale.
- **R3** (`0238db58`): **APPROVE**.

**5. Testes.** `SecretariaPainel.test.ts`, +78 linhas. Mutações: M0–M16 e N1–N13. Todas as não equivalentes morrem no pool padrão.

**6. Pendências (abertas hoje)**
- **C2:** `datas-civis.test.ts` não trata `new Date(x).toLocaleDateString()` sobre campo civil como impressão crua. Os candidatos continuam na `main`:
  - `configuracao/turmas/TurmasPainel.tsx:195-196`;
  - `empresas/[id]/FichaEmpresa.tsx:190`;
  - `pagar/[token]/PagarCliente.tsx:53`.

  Se esses campos forem datas sem hora, mostram o dia anterior em UTC-3. O formato dos dados não foi verificado.
- **C6:** `pool: "forks"` não foi fixado no `vitest.config.ts`. A sentinela evita o falso verde.

**7. Publicação.** Na `main` e no UAT. Só UI e teste.

**8. Riscos.** Baixos.

---

#### PR #138 — feat(e5c): enums com rótulo do mapa central em todas as telas; mapas soltos vão para labels.ts

**1. Identificação**
- Aberta em 06/10 15:14 e mergeada às 21:04. Branch `claude/e5-enums-rotulos`.
- 117 arquivos, +1784/−386. Merge `6b105093`.
- Commits: `4bd72707`, `db5f1f55`, `74dfe7f2`, `33f8b149`, `eae3f728` (merge), `bd063642`, `ef478cbc`, `5e2f7a87` (merge) e `a76f03db` (R4).
- Área: ~60 telas, `src/lib/labels.ts` e as travas `src/app/enums-rotulos.test.ts` e `rotulos-dominio.test.ts`.

**2. Objetivo × o que entrou**
- **46 mapas novos** em `labels.ts`, todos `Readonly<Record<Enum,string>>` e congelados.
- **43 mapas locais** retirados, entre eles 13 cópias do mapa de habilidades.
- Renders crus corrigidos e `rotular(MAPA, x)` no lugar de `MAPA[x] ?? x`.
- Nas rodadas:
  - mais 12 crus achados;
  - a trava (i) passou a **rastrear o campo até a posição de texto** (`ef478cbc`);
  - `codigosEmTexto` (`PAGAMENTO_COMPROVADO`) e o ternário sob guarda entraram na R4.
- Mudaram redações não declaradas no início: "Aguardando decisão", "cancelamento da escola", "Concluída"/"Cancelada", "Enviando".

**3. Rastreabilidade**
- Doc 42: §5.7 (microcopy) e **E5** (`42:100-108`). O A12 (`ETAPA_LABEL` em Title Case) ficou explicitamente fora.
- Doc 43:
  - mapas ad-hoc: 29 → 22 pelo grep, com 6 mapas literais restantes, citados (`rotulosAcao`, `rotulosPendencia`×2, `rotulosInsuficiencia`, `rotuloParticipacaoOrigem`, `rotuloReferenciaVencimento`);
  - enum cru: 31 → 2 candidatos. Os dois (`recuperacoes/page.tsx:27 item.estado` e `acertos-taxa/…/page.tsx:26 c.tipo`) são **exceções ancoradas** com motivo (`enums-rotulos.test.ts:1011-1012`): o texto já vem rotulado do servidor;
  - achados resolvidos: L326, L1353, L1698, L1788 e L2682; parciais: L718 (`fornecedor` cru), L1556 e L2082; aberto: L445.

**4. Revisão**
- **R1** (`33f8b149`): REQUEST CHANGES.
  - B1: alias, `String()`, colchete, campos fora de `CAMPOS_ENUM`.
  - B2: spread, constante e ternário.
  - B3: caixa alta disfarçada.
  - B4: crus em `RevisoesCorrecaoAula`.
  - 13 mutações sobreviveram.
- **R2** (`bd063642`): duas revisões no mesmo head. A `5433623330` foi postada por engano; a canônica, `5433661001`, aponta B5–B10, com **39 blockers sobreviventes**. A resposta do autor seguiu a numeração errada, e por isso o B10 ficou sem resposta.
- **R3 final** (`ef478cbc`): REQUEST CHANGES, com 34 blockers (B7 parcial, B10, B11–B15).
- **R4**, autorizada pelo responsável e só para B10 + B7: `a76f03db`. Inclui a resolução dos conflitos com #134 e #135. O comentário diz: "B11–B15 e C7–C9, mais o checker de tipos sugerido em C13, seguem como follow-up em #142. Merge autorizado pelo responsável."
- **Entrou sem APPROVE.**

**5. Testes**
- `enums-rotulos.test.ts` (AST, render de 5 telas com cada valor de enum, leitor do `schema.prisma`, formato dos rótulos).
- Mutações: 75–77 na R2 (34 mortas e 41–43 sobreviventes); 123 na R3 (83 mortas, 40 sobreviventes, 34 delas blockers).
- Suíte final: 497 arquivos e 2873 testes.

**6. Pendências e follow-ups**
- **#142** (B11–B15, C7–C9 e C13) foi **fechada em 08/10 01:45 pela #150**. A #150 usa checker de tipos. Teve R1 e R2 em REQUEST CHANGES; o integrador ajustou o client virtual (`groupBy`, `aggregate`, `count`) e reporta "24/24 KILLED".
- **A #150 fechou o issue, mas declarou "C7, C8 e C9 da R3 da #138 continuam abertos"**, e eles não têm issue:
  - **C7:** `MAPA[x]` sem fallback mostra vazio. Exemplo: `admissoes/page.tsx` com `STATUS_TURMA_LABEL[t.status]`.
  - **C8:** `rotular` aceita `string`; 106 de 165 usos recebem `z.string()`, então o mapa errado compila.
  - **C9:** listas de valores escritas à mão em `MAPAS_NOVOS`.
- **Fora do escopo declarado, ainda aberto:**
  - `ETAPA_LABEL` em Title Case (`labels.ts:84-95`: "1º Contato", "Exp. Agendada", "Aguardando Matrícula");
  - fornecedor CLICKSIGN/ZAPSIGN cru (doc 43 L718);
  - `o.resultado` ("Resultado: REGISTRADO");
  - badges `{label, cls}`.
- Decisões de produto declaradas "para seu olhar":
  - rótulos novos sem texto anterior ("Aplicado", "Substituído", "Aguardando decisão", "teste/produção"…);
  - divergências resolvidas: FALA → "Fala", que muda o portal do aluno; `StatusReservaVaga` na forma curta; "Falta registrada" → "Falta".

**7. Publicação.** Na `main` e no UAT. Só UI e testes. `labels.ts` é código compartilhado.

**8. Riscos**
- Os conflitos com a #134 e a #135 foram resolvidos por um "merge de 3 vias por token" feito pelo agente. Os merges de teste das revisões **reintroduziam crus**, como `replaceAll("_"," ")`, `{i.canal}` e `{troca.situacao}`. Fica mitigado pela trava, que estava verde (2873/2873).
- A trava ficou muito complexa (rastreador + checker na #150), e o custo de manutenção é alto.
- A semântica dos rótulos (trocar ATIVA por EXPIRADA) não é travada.

---

#### Issues #139–#142 (follow-ups das PRs mergeadas sem APPROVE por decisão do usuário)

| Issue | Origem | O que ficou aberto no merge | Situação | Como foi fechada |
|---|---|---|---|---|
| **#139** | #134 (R3 B1/B2) | Montagens de "nesta página" que a trava não via; render da reserva sem normalizar o HTML | **Fechada** em 07/10 23:39 | **#147** (`Closes #139`). R1, R2 e R3 em REQUEST CHANGES. A correção da R3 (`8cc014b7`) foi especificada pelo revisor, aplicada pelo autor e verificada pelo integrador (20/20 mortas, CI verde). Tem limites declarados |
| **#140** | #135 (R3 B1–B6 + A16f) | Tabela de botão, polaridade ARIA, grupo rotulado, função de seleção, `ai-*` via descendente, `ROTULOS_DINAMICOS` | **Fechada** em 07/10 22:24 | **#148** (`Closes #140`). R1–R3 em REQUEST CHANGES; o integrador aplicou `f2acc5bf`; CI verde. Resíduo: "Anular" e "estorno" sem caso |
| **#141** | #136 (R3 B9 + R1 B2) | Evasões da trava de `aria-sort`; **collation do Postgres** | **ABERTA** | A **#149** ("Refs #141", mergeada em 07/10 23:54) fechou **só o B9**. O **B2 (collation)** continua, porque exige schema e infra |
| **#142** | #138 (R3 B11–B15, C7–C9, C13) | Posições de texto e expressões invisíveis ao rastreador; mapas locais; formato; lógica removível; checker de tipos | **Fechada** em 08/10 01:45 | **#150** (`Closes #142`). Checker de tipos; R1 e R2 em REQUEST CHANGES; ajuste do integrador. **C7–C9 ficaram abertos**, sem issue |

Observação: as quatro PRs de follow-up (#147–#150) também foram mergeadas depois de REQUEST CHANGES, pela "regra pós-R3 aprovada pelo usuário". O integrador aplica ou verifica a correção especificada pelo revisor e exige CI verde.

---

#### Tabela-resumo da faixa

| PR | Título curto | Área | Rodadas | Veredito final | Publicado | Pendências abertas |
|---|---|---|---|---|---|---|
| #118 | Resultado incerto: uma instrução por evento | UI transversal + trava | R1–R3 | **APPROVE** (R3) | sim | N1 (`SegundaChamadaPainel`); avulsa em `ConferirReserva.tsx:18`; evasões I6/I7 |
| #119 | LGPD: trilha sem o texto da busca | API exportação | R1–R2 | **APPROVE** (R2) | sim | Eventos antigos com busca em claro (não declarado) |
| #120 | Status do encontro no masculino | Diário/acadêmico + labels | R1–R4 | RC (R4), fix final não revisado | sim | Telas novas fora de `TELAS`; `src/lib`/`src/server` sem cobertura |
| #121 | CampoTexto com mínimo visível | UI transversal | R1–R3 | RC (R3), fix não revisado | sim | C2' (sem teste de desmontagem); limite `as unknown` |
| #122 | Comissões do /financeiro paginadas | Financeiro + servidor | R1–R3 | RC (R3), fix não revisado | sim | — |
| #123 | Deploy no Coolify | Infra | R1 depois do merge | RC; mergeada antes da revisão | sim | Tudo fechado por #124/#125/#133 |
| #124 | Hotfix do db-init (`\gexec`) | Infra | R1 depois do merge | RC; mergeada antes da revisão | sim | Fechado por #125/#133 |
| #125 | Travas do Coolify e do health | Infra/teste | R1 depois do merge | RC; mergeada durante a R1 | sim | Valores de `image`/`depends_on` sem trava (C6/N9 da #133) |
| #126 | EstadoVazio (E1) | UI transversal | R1–R3 | RC (R3); merge sem autorização registrada | sim | B2 (exceção + manifesto editados juntos); C6 (piso constante); sem issue |
| #127 | Prisma/OpenSSL no Alpine, `/api/ready` | Infra/API | R1–R3 (+2 avulsas) | RC (R3); fix não revisado; B2 recusado por decisão | sim | Redeploy confirmado e `tsc` no quadro ("Não concluído"); `docker build` fora do CI |
| #128 | Linha comercial do WhatsApp (SPEC-ERP-005) | WhatsApp/servidor/inbox | R1, R2, R2 corrigida | RC (R2 corrigida) | sim | Int tests nunca rodados; campo LID da Evolution; reconexão; B2 → #129 |
| #129 | Trava de opt-out no histórico (LC-10) | Teste WhatsApp | R1–R3 | RC (R3), fix não revisado | sim | C3 `deleteMany` (fora do contrato) |
| #130 | "Abrir atendimento" sem destino | Inbox/servidor | R1–R2 | **APPROVE** (R2) | sim | — |
| #131 | `nomePerfil` no contato do WhatsApp | WhatsApp + **migração com UPDATE** | nenhuma | sem revisão | sim (migração aplicada no UAT) | Reparo em produção; integrações; quadro "Não concluído" |
| #132 | Editar o nome do contato | Inbox + **migração** | nenhuma | sem revisão; quebrou a `main` | sim | Integrações; quadro "Não concluído" |
| #133 | Suíte verde: inbox e db-init | Teste/UI | R1–R3 | **APPROVE** (R3) | sim | C6/N9 (valores do serviço); I5–I7 nas travas antigas |
| #134 | Vazio paginado (página 1) | UI E1 | R1–R3 | RC (R3); merge autorizado | sim | #139 fechada (#147); textos de produto; limites da #147 |
| #135 | Botões: perigo e `aria-pressed` | UI E1 | R1–R3 + R3 corrigida | RC (R3); merge autorizado | sim | #140 fechada (#148); ThemeToggle, wizard e temperatura sem issue |
| #136 | ColunaOrdenavel e ordenação no servidor | UI + servidor | R1–R4 | RC (R3), R4 parcial; merge autorizado | sim | **#141 aberta (collation)**; volta à ordem padrão em /empresas; código morto |
| #137 | Data da cobertura e datas da Secretaria | UI | R1–R3 | **APPROVE** (R3) | sim | `datas-civis` sem `toLocaleDateString`; `pool: forks` |
| #138 | Enums com rótulo central (E5) | UI transversal + labels | R1–R4 | RC (R3), R4 parcial; merge autorizado | sim | #142 fechada (#150) **mas C7–C9 abertos**; `ETAPA_LABEL` Title Case; fornecedor cru |

---

#### Pendências que continuam abertas hoje (conferidas em `origin/main` = `e5418550`)

**Com issue**
1. **#141 B2: ordenação por bytes no Postgres.**
   - Valem `/alunos`, `/empresas`, `/comissoes` e a aba do `/financeiro`.
   - Na `main`, nenhum `POSTGRES_INITDB_ARGS`/`--locale-provider=icu` em `docker-compose.coolify.yml` ou `docker-compose.prod.yml`, e nenhum `COLLATE` ICU nas migrações. Os únicos `COLLATE "C"` são de funções de hash.
   - Exige decisão do responsável e um ID de migração reservado pelo integrador.

**Sem issue (residuais declarados ou achados de revisão que ninguém registrou)**

2. **#138 / #150: C7, C8 e C9** da trava de enum.
   - C7: `MAPA[x]` sem fallback.
   - C8: `rotular` com `string`, onde o mapa errado compila.
   - C9: listas de valores à mão em `MAPAS_NOVOS`.

   A #150 os declarou abertos ao fechar a #142.
3. **#138, fora do escopo:**
   - `ETAPA_LABEL` em Title Case (`labels.ts:84-95`, achado A12 do doc 42);
   - fornecedor CLICKSIGN/ZAPSIGN cru (doc 43 L718, parcial);
   - `o.resultado`;
   - badges `{label, cls}`.
4. **#135, follow-ups de a11y:**
   - "Alternar tema" sem `aria-pressed` (`Sidebar.tsx:59`);
   - wizard sem `aria-current="step"`;
   - chip de temperatura com `disabled` em vez de `aria-disabled` (`InboxCliente.tsx:1087-1088`).
5. **#136, C1:** `/empresas` sem caminho de volta para a ordem padrão. **C4:** `PADRAO` em `ordem-comissoes.ts:14`. Doc 42 **L2259**: `/comissoes` sem a coluna "Previsão de pagamento".
6. **#133, C1 e C6/N9:**
   - `anuncios.test.ts:33` aceita qualquer `role=`, então `role="presentation"` passa.
   - O detector de "resultado incerto" não resolve texto em variável ou template.
   - `coolify-db-init.test.ts:94` trava só as chaves do serviço, não `image` nem `depends_on` (`condition`).
7. **#137, C2:** `datas-civis.test.ts` não trata `toLocaleDateString` sobre campo civil. Candidatos na `main`: `TurmasPainel.tsx:195-196`, `FichaEmpresa.tsx:190` e `PagarCliente.tsx:53`. Risco de mostrar o dia anterior em UTC-3, se forem datas sem hora (não verificado). **C6:** `pool: "forks"` não fixado (`vitest.config.ts`); a sentinela mitiga.
8. **#126:**
   - B2: uma exceção exata somada à edição do manifesto engole um `<p>` cru.
   - C6: o piso `USOS_DA_MIGRACAO_E1 = 219` é constante solta (`EstadoVazio.test.ts:107`).
9. **#118:**
   - "Resultado não confirmado" avulso em `secretaria/reservas/ConferirReserva.tsx:18`, fora de `catch`. O doc 43 pede que vire constante.
   - N1: `SegundaChamadaPainel` com `_SEM_CHAVE` para todas as ações (`:49-51`).
10. **#127:**
    - O quadro marca "Não concluído": falta confirmar o redeploy (container `healthy`, `migrate` com saída 0, `/api/ready` 200) e o `tsc` no ambiente do integrador.
    - O `docker build` não roda no CI.
    - O digest fixado exige atualização manual.
11. **#128 (SPEC-ERP-005):**
    - As integrações `linha-comercial.int.test.ts` (438 linhas), `acesso-atendimento` e `destinatario-atual` **nunca rodaram** e estão fora do CI.
    - Falta confirmar o campo `remoteJidAlt`/`senderPn` na Evolution 2.3.7 real.
    - Linhas já conectadas precisam de novo QR e novo vínculo do aparelho para o histórico chegar.
    - O cabeçalho da SPEC ainda diz "sem execução".
12. **#131 e #132:**
    - Rodar `scripts/reparar-nome-contato-whatsapp.ts` em modo leitura e depois com `--aplicar`, e renomear os leads com o nome da linha.
    - Rodar as integrações do WhatsApp em perfil isolado.
    - O quadro marca as duas como "Não concluído".
    - As migrações `20260929120000` (com `UPDATE` de dados) e `20260929130000` já estão aplicadas no UAT pelo `migrate deploy` do deploy.
13. **#119 (não declarado):** eventos `DadosExportados` anteriores a 25/09 seguem com o texto da busca (possível dado pessoal) na trilha.
14. **#147 / #148 / #149 (limites declarados nos follow-ups):**
    - #147: retorno antecipado sem `else`, palavra partida e texto que não nasce de literal.
    - #148: "Anular" e "estorno" sem caso de teste.
    - #149: parâmetro reatribuído e alias de objeto.

**Fechadas e confirmadas na `main`:** #139 (#147), #140 (#148), #142 (#150, com a ressalva do item 2), os B1–B4 da #123/#124/#125 (por #124, #125 e #133) e o B2 da #128 (por #129, com `METODOS_SQL_CRU` em `historico.test.ts:45`).

---

### 7.5 PRs #143–#161

> Fonte: `gh pr view` / `gh pr diff` de cada PR (corpo, reviews, comentários, commits e arquivos), `git log`/`git show` sobre `origin/main` em `e5418550` (depois de `git fetch --all`, em 13/10/2026). Datas em UTC, como o GitHub mostra.
>
> **Contexto.** Tudo que entra na `main` vai automaticamente para o UAT, o único ambiente. As PRs desta faixa seguem a §6 do `docs/43-medicao-auditoria-ux.md` (itens 1–7), fecham os follow-ups das issues #139–#142 e terminam os projetos E1/E2/E4 do `docs/42-auditoria-frontend-ux.md`. O autor, o revisor e o integrador usam a mesma conta (`diogenesmendes01`). Por isso **nenhuma review aparece como `APPROVED` no GitHub**: todas são `COMMENTED`, e o veredito está escrito no texto ("Veredito (Rn): …").
>
> **Regra pós-R3** (aprovada pelo usuário e citada nos comentários de merge): "blocker só de teste, com conserto especificado, aplica, verifica e mergeia". Ela foi usada nas #144, #145, #147, #148 e #149. A #143 entrou depois da R3 "por decisão do usuário", com os blockers B7–B9 na issue #152.

#### Visão geral da faixa

| Grupo | PRs | Observação |
|---|---|---|
| E1/E2/E4 da auditoria | #143, #144, #145 | abertas em 07/10 de manhã, junto com a medição |
| Medição | #146 | cria o doc 43 e a §6, que guia as PRs seguintes |
| CI | #151 | primeiro workflow do repositório (typecheck, lint, test em 2 fusos) |
| Follow-ups das travas (#139–#142) | #147, #148, #149, #150 | só arquivos de teste, menos a #150, que toca `src/server` |
| Itens 1–7 da §6 do doc 43 | #153, #154, #155, #156, #157, #158, #159, #160, #161 | abertas e mergeadas entre 08/10 e 10/10 |
| Issues | #152, #162 | ambas **abertas** hoje |

Ordem de merge na `main` (first-parent): #151 (`c3685565`) → #146 (`d20bda06`) → #143 (`f504a359`) → #144 (`b64e1a7a`) → #148 (`ebe4109c`) → #145 (`4f6aad16`) → #147 (`23b54768`) → #149 (`cf82be2c`) → #150 (`5b418b11`) → #153 (`0dc4d092`) → #154 (`14dd30b7`) → #155 (`c1b3a62c`) → #156 (`fbada6a2`) → #157 (`c107da32`) → #159 (`b59744b9`) → #158 (`60f14790`) → #160 (`19be34de`) → #161 (`e5418550`, a ponta atual da `main`).

Todos os 18 merge commits são ancestrais de `origin/main` (`git merge-base --is-ancestor` = verdadeiro para todos), então **tudo o que está abaixo está publicado no UAT**. Nenhuma PR da faixa mexe em `prisma/` nem em migration. Mexem em `src/server/`: #144, #150, #151, #154, #155, #158, #159, #160 e #161. Mexem em `*.int.test.ts` (que o CI **não** roda): #151 (2 arquivos), #158 (13) e #161 (8).

---

#### #143 — E2/E6: abas de área em `/academico` e `/diario` (prefixo aninhado) e grades responsivas

##### 1. Identificação
- **Aberta:** 07/10 11:45 · **mergeada:** 07/10 18:04 · base `main` · branch `claude/e2-layouts-academico-diario`.
- **Tamanho:** 20 arquivos, +1002/−33. Merge `f504a359`.
- **Área:** shell de navegação. `src/app/(app)/academico/{layout,secoes}.ts(x)`, `src/app/(app)/diario/{layout,secoes}.ts(x)`, `src/lib/nav.ts`, `src/components/SubTabs.tsx`, as raízes `academico/page.tsx` e `diario/page.tsx`, a trava `src/app/responsivo.test.ts` e o helper novo `src/test/guard-pagina.ts`.

##### 2. Objetivo declarado × o que entrou
- **Declarado:** criar o layout de área (barra `SubTabs`) acima das 64 páginas de `/academico` e das 13 de `/diario`, com uma aba por sub-seção filtrada pelos papéis do guard de cada página. Resolver o desempate do prefixo aninhado. Tirar os 12 links soltos antes do `<h1>` em `/academico`. No E6, tratar as "3 grades `grid-cols-2` sem breakpoint".
- **Entrou:**
  - `lib/nav.ts`: `hrefDaAbaAtiva` e `abasParaPapeis`, e as opções `exato` (a raiz acende só na própria rota) e `prefixo` (a aba "Quantidade de aulas" cobre `/academico/modalidades/[id]/…`) em `AbaSubnav`. Sem as opções o comportamento é o anterior, então `/configuracao`, WhatsApp e matrícula não mudam.
  - Os layouts **não decidem acesso**: chamam `exigirSessaoPagina()` sem papéis (memoizado por requisição). O guard continua em cada página. A barra com uma aba só não aparece (ex.: a Secretaria em `/diario/encontros`).
  - `/academico` ganhou abas para Aproveitamentos e Recuperações, que antes não tinham link na raiz.
  - **E6:** nenhuma tela mudou. As 3 grades do grep já tinham base de uma coluna (`xl:`/`lg:grid-cols-2`); o `\b` do grep casava depois do `:` do prefixo. A PR só reforçou os detectores de `responsivo.test.ts` (prefixo `lg:`/`xl:` não acusa; classe em ternário acusa).
- **Divergência corpo × diff:** a versão inicial do corpo dizia que `guard-pagina.ts` era "o mesmo leitor de `matriculas/[id]/secoes.test.ts`". A R2 apontou isso (C5) e o corpo foi corrigido: o leitor é próprio, sobre a AST, e a matrícula continua com o leitor textual antigo.

##### 3. Rastreabilidade
- Doc 42: projetos **E2** (camada de layout) e **E6** (celular); §5.5 **A11** (links antes do `<h1>`).
- Doc 43: listada na §6 como "em andamento". A §6 registra que os 6 `grid-cols-2` restantes são KPIs permitidos e não mudam.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador (antes da R1) | `75fd5947` | — | tsc 0; 501/501 arquivos, 2.922 testes; 8 mutações KILLED + controle |
| R1 | `75fd5947` | REQUEST CHANGES | **B1** a falha fechada de `papeisDoGuardFonte` não tinha teste (M25–M27 sobreviviam); **B2** a trava lia a 1ª ocorrência textual de `exigirSessaoPagina(`, inclusive em comentário (evasão E1) |
| R2 | `c1ac2d24` | REQUEST CHANGES (+ correção que promoveu C4 a **B6**) | **B3** a chamada contada não precisava ser o guard que segura a página (E3 alias + isca, E4 namespace, E5 IIFE não aguardada, E6 guard condicional); **B4** `Papel` local sombreando o enum (E7); **B5** o caso "JSX" do autoteste não tinha JSX (N8: parse TSX→TS sobrevivia); **B6** recusa extra depois do guard (E8) |
| R3 | `851ba76e` | REQUEST CHANGES | **B7** `import()`/`require` de `@/server/_shared` sem teste próprio (T5); **B8** recusas que editam só a página passavam (E14 `redirect` via `import("next/navigation")`, E15 `{ papeis: p } = sessao` + `return null`); **B9** três ramos da recusa branda sem teste (T13 `while`, T14 `switch`, T15 `\|\|`/`??`) |

- **Como cada blocker foi resolvido:**
  - B1/B2 → `c1ac2d24`: leitor reescrito sobre a AST (`ts.createSourceFile`, TSX), exige exatamente uma chamada com `await`, e autoteste `src/test/guard-pagina.test.ts` (9 casos).
  - B3–B6 → `851ba76e`: só vale `await exigirSessaoPagina(...)` como 1ª instrução da `export default`; qualquer outra ocorrência do identificador lança; `Papel` tem de vir de `import { Papel } from "@prisma/client"` sem alias nem sombra; `pagina()` do autoteste monta `return (<div>…</div>)`; a página das abas não pode ter outra recusa (dura: `throw`, `redirect`, `notFound`, `AcessoNegado`, import de `next/navigation`; branda: `return` sob condição que lê papel).
  - B7–B9: **não resolvidos**. Foram para a issue **#152**.
- **Verificações do integrador:** `75fd5947` (tsc 0; 501/2.922; 8/8 KILLED), `c1ac2d24` (503/2.933; 8/8 KILLED, inclusive E1 e M11), `851ba76e` (503/2.950; E3–E8 e N8 KILLED). Antes do merge, conferiu o head contra a `main` com o CI da #151 e a #146: tsc 0 e 504/504 arquivos, 2.986/2.986 testes.
- **Mutações do revisor:** R1 34 (29 KILLED, 5 SURVIVED: M11, M25, M26, M27, E1); R2 22 (15 KILLED, 7 SURVIVED: N8, E3–E8); R3 23 (16 KILLED, 7 SURVIVED: T5, T13, T14, T15, E14, E15 e T5+E16).
- **Entrou sem APPROVE:** sim. O comentário de merge diz: "Mergeada após a R3 por decisão do usuário. Os blockers B7, B8 e B9 (…sem risco de comportamento nas páginas atuais) ficam na issue #152."

##### 5. Testes e travas
- Novos: `src/lib/nav.test.ts` (casos aninhado, exato e prefixo), `src/components/SubTabs.test.ts` (`aria-current` com prefixos aninhados), `academico/{layout,secoes,layout.uma-aba}.test.ts`, `diario/{layout,secoes}.test.ts`, `src/test/guard-pagina.test.ts` (autoteste).
- `secoes.test.ts` de cada área confere a **paridade aba × guard**: lê o `page.tsx` de cada aba e compara os papéis com os da aba.
- Trava estática: `src/app/responsivo.test.ts` (detectores de grade).

##### 6. Pendências e follow-ups
- **#152 (aberta):** B7, B8 e B9 da R3. Conferido na `main`: `src/test/guard-pagina.ts` não mudou desde `851ba76e` (`git log` mostra só os 3 commits da PR). A regra de `import()`/`require` continua em `guard-pagina.ts:240` sem caso próprio; o import de `next/navigation` só é barrado como `ImportDeclaration` (`:106`).
- **C2 (aberto):** o `ariaLabel` padrão de `SubTabs` continua "Sub-navegação" (`SubTabs.tsx:11`).
- **C3 (aberto):** a Gerência pedagógica vê 14 abas e o Administrador 16, que quebram em várias linhas a 375 px (`flex-wrap` em `SubTabs.tsx:21`). `academico/secoes.ts` na `main` ainda tem 16 `href`.
- **C5 (aberto):** `matriculas/[id]/secoes.test.ts` ainda usa o leitor textual antigo (`fonte.match(/exigirSessaoPagina\(([^)]*)\)/)`), que lê comentário — a mesma classe da evasão E1.
- **C6:** recusa escondida numa função importada de outro módulo não é vista. É limite documentado no docstring.

##### 7. Publicação
- Merge `f504a359` na `main` → **no UAT**.
- Não mexe em servidor, schema, migration nem `*.int.test.ts`.

##### 8. Riscos e observações
- O layout pede só a sessão. Se uma página nova de `/academico` esquecer o guard, ela fica aberta a qualquer sessão: o layout não segura. `secoes.test.ts` pega isso só para as páginas que **têm aba**. Sub-rotas sem aba (como `segundas-chamadas/[alocacaoId]/…`) não passam pela trava.
- Os arquivos da PR foram tocados depois pela #156 (`SubTabs.tsx` e o teste: aba ativa em `bg-brand-solid`) e pelas #158 e #161 (`academico/page.tsx` e `page.test.ts`). Nada foi desfeito.
- A trava `guard-pagina` é grande (264 linhas) e cheia de regras sintáticas. É eficaz contra as evasões listadas, mas os buracos de #152 mostram que a família "recusa extra" ainda tem saídas.

---

#### #144 — E4: fila de cobrança com filtro na URL e busca em `/comissoes`

##### 1. Identificação
- **Aberta:** 07/10 11:52 · **mergeada:** 07/10 22:16 · base `main` · branch `claude/e4-fila-comissoes`.
- **Tamanho:** 17 arquivos, +822/−88. Merge `b64e1a7a`.
- **Área:** Financeiro. `/financeiro/cobrancas` (`FilaCobranca.tsx`, `(painel)/cobrancas/page.tsx`), `/comissoes` (`comissoes/page.tsx`); servidor `src/server/cobrancas/{filtros-fila,consultas}.ts` e `src/server/financeiro/consultas.ts`.

##### 2. Objetivo declarado × o que entrou
- **Fila de cobrança:**
  - módulo puro novo `src/server/cobrancas/filtros-fila.ts` com `lerFiltrosFila` (indicador só de `aVencer|emAtraso|bloquear|promessas`; busca/país/turma com trim e teto de 100), `hrefIndicador`, `filtrarFila` (palavras no nome ou no código, **teto de 6 palavras**) e `opcoesDaFila`;
  - os cartões viram `<Link>` reais com `role="button"`, `aria-pressed` e Espaço acionando (`espacoAciona`, hoje `FilaCobranca.tsx:48`); busca/país/turma num `<form role="search">` GET, com o indicador num campo oculto;
  - a página filtra no servidor; contadores, total ("X de Y") e opções seguem sobre a fila inteira.
- **`/comissoes`:** busca por palavra (teto de 6) no **nome do beneficiário**, em AND com escopo e situação, levada para cabeçalhos ordenáveis, `Paginacao` e o redirecionamento de página além do fim. Vazio próprio: "Nenhuma comissão com esses filtros."
- **Acrescentado na R1:** `contarIndicadoresFila` (em `filtros-fila.ts`) passou a ser a fonte única dos quatro contadores de `listarFilaCobranca` (`consultas.ts:351`), no lugar dos `itens.filter(...)` à mão. Isso é uma mudança de código de produção feita durante a revisão, e o corpo a descreve.
- **Divergência corpo × diff:** a seção "Testes" do corpo ainda diz que os commits da R1 "foram escritos sem executar" e não cita `fila-contadores.test.ts`. A R3 apontou isso (C2) e o corpo não foi atualizado.

##### 3. Rastreabilidade
- Doc 42: projeto **E4** e §5.6 (A9 na busca de `/comissoes`, segundo o comentário em `src/server/financeiro/consultas.ts:25`).
- Doc 43: "em andamento" na §6. O item 9 cita `listarFilaCobranca` como lista sem `take`, "que entra na #144".

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `6831ce73` | — | 499/2.903; 9/9 KILLED + controle |
| R1 | `6831ce73` | REQUEST CHANGES | **B1** "A vencer" sem a fronteira `diasAtraso: 0` (F11 `<= 0`→`< 0` sobrevivia); **B2** Espaço no cartão sem teste (U6) |
| R2 | `5b5a1715` | REQUEST CHANGES | **B1 (PARTIAL)** os contadores de `listarFilaCobranca` não tinham teste na suíte padrão — só `*.int.test.ts` a exercitavam; N2 e N3 sobreviviam |
| R3 | `25890403` | REQUEST CHANGES | **B1 (PARTIAL)** a fixture de `fila-contadores.test.ts` não tinha acesso já bloqueado, atraso de 15–29 dias nem promessa com atraso ≥ 30 (N9, N10, N11, N14 sobreviviam) |

- **Resolução:**
  - R1 → `d4385333` (`contarIndicadoresFila` + teste de fronteira + Espaço/Enter/outras teclas) e `5b5a1715` (contagens distintas por cartão).
  - R2 → `25890403`: `src/server/cobrancas/fila-contadores.test.ts`, teste unitário de `listarFilaCobranca` com mock do Prisma, da régua, de `vencimento-civil` e do WhatsApp.
  - R3 → `8584e27c`, aplicado **pelo integrador** com a fixture que o próprio revisor especificou (`atraso-medio` 20 dias, `ja-bloqueado` 45 dias, `promessa-antiga` 35 dias; cartões `{ aVencer: 4, emAtraso: 5, bloquear: 2, promessas: 3 }`). No mesmo commit corrigiu os comentários "atraso ≥ 15" e "Bloquear ⊂ Em atraso" de `consultas.ts` e `filtros-fila.ts` (hoje `consultas.ts:347` diz "mais a promessa com atraso ≥ 30").
- **Verificações do integrador:** `5b5a1715` (500/2.943; 8/8 KILLED; registrou a lacuna `contarIndicadoresFila([])`), `25890403` (501/2.946; N2, N3, N8, N9, N10 KILLED — fecha a lacuna), `8584e27c` (501/2.946; CI run 37673359539 com os 4 jobs verdes; N9, N10, N11, N14 KILLED).
- **Mutações do revisor:** R1 22 (20 KILLED); R2 9 (7 KILLED); R3 10 (6 KILLED).
- **Entrou sem APPROVE:** sim, pela regra pós-R3: "o blocker da R3 era só de teste e o conserto veio especificado pelo próprio revisor, então eu o apliquei, verifiquei e faço o merge sem R4."

##### 5. Testes e travas
- Novos: `filtros-fila.test.ts` (141 linhas), `fila-contadores.test.ts` (113), `cobrancas/page.test.ts`, `FilaCobranca.test.ts` (+150; captura `next/link` e o `onKeyDown`), `comissoes/page.test.ts`, `comissoes-pagina.test.ts`.
- Travas estáticas atualizadas: `botoes-mapa.ts` (o "limpar filtro" virou `<Link>`; botão "Buscar" novo), `botoes.test.ts` (saem as exceções do cartão-indicador), `estados-vazios-mapa.ts` (vazio de `/comissoes`), `vencimento-civil-render.test.ts` (o detalhe aberto passou a ser o 1º `useState`).

##### 6. Pendências e follow-ups
- Declaradas no corpo: busca de `/comissoes` por aluno/matrícula ficou fora (a tabela só mostra o beneficiário); o vazio da fila continua "Nada nesta visão.".
- A fila **continua sem paginação nem `take`**: `listarFilaCobranca` (`consultas.ts:202`) faz `prisma.cobranca.findMany` sem limite. O doc 43 §6 item 9 ainda lista isso.
- Nenhuma issue foi aberta por causa desta PR.

##### 7. Publicação
- Merge `b64e1a7a` na `main` → **no UAT**.
- Mexe em servidor (`src/server/cobrancas/consultas.ts`, `filtros-fila.ts`, `src/server/financeiro/consultas.ts`). Sem schema, migration ou `*.int.test.ts`.

##### 8. Riscos e observações
- A mudança de `consultas.ts:351` é de produção. Ela é coberta por teste unitário com mocks, e os `*.int.test.ts` de cobrança não foram rodados na PR.
- A busca de `/comissoes` sem palavra mantém o `where` idêntico ao anterior. Isso preserva a aba `/financeiro/comissoes`.
- Arquivos tocados depois: a #154 mexeu em `FilaCobranca.tsx` (`ConfirmarAcao` na cobrança por WhatsApp, hoje `:451`) e em `src/server/financeiro/consultas.ts`/`comissoes-pagina.test.ts`; as #148, #153, #155, #156, #159, #160 e #161 só tocaram os manifestos (`botoes-mapa.ts`, `estados-vazios-mapa.ts`) e a trava `botoes.test.ts`. Os testes de `FilaCobranca` continuam na suíte.

---

#### #145 — E1: `Campo` único — rótulo, dica, erro e obrigatoriedade ligados em `/matriculas/nova` e `/alunos/[id]`

##### 1. Identificação
- **Aberta:** 07/10 11:55 · **mergeada:** 07/10 23:33 · base `main` · branch `claude/e1-campo-unico`.
- **Tamanho:** 14 arquivos, +2465/−418. Merge `4f6aad16`.
- **Área:** formulários. `src/components/Campo.tsx` (novo), `CampoFuso.tsx`, `CampoMoeda.tsx`, `matriculas/nova/MatriculaFormulario.tsx`, `alunos/[id]/FichaAluno.tsx`; travas `src/app/campos.test.ts` (novo, 808 linhas), `campos-mapa.ts`, `rotulos.test.ts`; helper `src/test/tela-sem-dom.ts`.

##### 2. Objetivo declarado × o que entrou
- **`Campo`:** rótulo por `htmlFor`; `obrigatorio` → `aria-required` mais asterisco `aria-hidden` (sem `required` nativo); `erro` → `aria-invalid` só com mensagem (`role="alert"`, em `aria-describedby`); `dica` também em `aria-describedby`. O controle vem por render-prop: `{(campo) => <input {...campo} />}`. Exporta `focarPrimeiroComErro`, `ErrosDeCampos`, `LigacaoCampo` e `CONTROLE_INVALIDO`.
- **`/matriculas/nova`:** 46 campos pelo `Campo`, inclusive contato de emergência e responsável financeiro, que tinham só placeholder. Erro por campo nos dois passos, na ordem da tela, com foco no primeiro.
- **`/alunos/[id]`:** 26 campos da edição + pausa (2) + encerramento (2). "Salvar alterações" deixa de ficar desabilitado sem explicação (achado #4); pausa exige motivo e encerramento "Outro" exige observação no próprio campo (achado #5).
- **Durante a revisão** o integrador extraiu `errosDaEdicaoAluno` e `errosDoPasso1` (`a2bcb7f6`) como funções puras com as mesmas regras, e o autor extraiu `errosDoPasso2`. Isso é refatoração de produção, não só teste.
- **Divergência:** o corpo diz que "testes e TypeScript não foram executados", mas o integrador rodou tudo em cada rodada (C2 da R1). O cabeçalho de `campos-mapa.ts` prometia que o manifesto pegava "deixar de ligar o `erro`", e não pegava (F15, M16). Foi corrigido na R1 (o mapa passou a registrar a expressão do erro).

##### 3. Rastreabilidade
- Doc 42: projetos **E1** e **E7**; §5.2 (**A1**, **A7**) e §5.4. O corpo cita a base: 0 `aria-invalid` para ~619 `required`, 198 controles sem nome acessível.
- Doc 43: "em andamento" na §6; "cobre a métrica de `aria-invalid` da 7.4 e os achados 471/472".

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `a2bcb7f6` | — | corrigiu 8 erros `react/no-children-prop` e extraiu as validações puras; 500/2.904; 13 mutações KILLED (M10/M11 antes sobreviviam) |
| R1 | `a2bcb7f6` | REQUEST CHANGES | 94 mutações, **47 sobreviveram** (42 blockers). **B1** dica vazia/`false` ligava `aria-describedby`; **B2** validação da ficha sem teste (10 mutações); **B3** erro por campo da matrícula sem teste (16); **B4** mutações da trava sem autoteste (7); **B5** 6 evasões que a trava deixava passar; **B6** `rotulos.test.ts` isentava qualquer spread |
| R2 | `1d6cef23` | REQUEST CHANGES | as 47 morreram; **B1** o fio do passo 2 trocava as datas (NM2); **B2** EV6 `aria-invalid={Boolean(0)}`, EV7 `<label>{" "}<input/></label>`, EV12 `aria-labelledby` para o próprio id |
| R3 | `940a0367` | REQUEST CHANGES | **B1** EV13 (parâmetro de lambda passava como "lê a tela"); **B2** EV15/EV16 (U+3164 contava como texto do rótulo); **B3** P4, P5, P11, P12 (ramos do detector sem teste) |

- **Resolução:** R1 → `ac2db73b` (testes de interação sem DOM em `FichaAluno.interacao.test.ts` e `MatriculaFormulario.interacao.test.ts`, com o helper `tela-sem-dom.ts`; trava reescrita) + ajuste do integrador `1d6cef23` (regex com alternativa vazia em `rotulos.test.ts`; `naArea` sem a barra). R2 → `392a0256` e `940a0367`. R3 → `8f1fc9bb` (só `campos.test.ts`: `leDaTela` ignora nomes declarados na própria expressão; `temLetraOuNumero` tira `\p{Default_Ignorable_Code_Point}`).
- **Verificações do integrador:** `1d6cef23` (503/2.976; 41/41 KILLED), `940a0367` (503/2.981; 11/11 KILLED), R3 (com a `main` atual: 512/512 arquivos, 3.114/3.114 testes; 10/10 KILLED, controle sobrevive).
- **Entrou sem APPROVE:** sim, pela regra pós-R3 ("os blockers da R3 eram só da trava e o conserto veio especificado pelo revisor, então o autor o aplicou, eu verifiquei e o merge sai com o CI verde").
- **Coordenação com a #149:** o comentário de merge diz que esta entra primeiro e que a #149 seria adaptada para reconhecer o render-prop do `Campo` (B8 da R3 da #149: 73 achados).

##### 5. Testes e travas
- Novos: `Campo.test.ts` (`renderToStaticMarkup`, sem jsdom), `FichaAluno.interacao.test.ts` (174), `MatriculaFormulario.interacao.test.ts` (276), `validacao-passo1.test.ts`, `src/test/tela-sem-dom.ts` (132).
- Trava estática nova `src/app/campos.test.ts`, com o manifesto `MAPA_CAMPOS` e as exceções em `campos-mapa.ts` (começa vazia). Atualizada: `rotulos.test.ts`.
- Mutações: R1 94 (47 KILLED), R2 64 (60 KILLED), R3 23 (16 KILLED); verificação final 10/10.

##### 6. Pendências e follow-ups
- **Áreas seguintes declaradas no corpo** (por grep de `required`): `/matriculas/[id]/*` (~148 em 37 arquivos), `/academico/*` (~180), `/diario/*` (~60), sub-rotas de `/alunos/[id]` (~59), `/secretaria/*` (~28), `/configuracao/*` (~22), `/financeiro/*` (~19, mais `PagamentoModal.tsx`), `/leads/[id]/contratacao`, `/inbox`, `/carteiras` e `/portal-aluno`. **Continuam pendentes:** na `main`, só `FichaAluno.tsx` e `MatriculaFormulario.tsx` importam `@/components/Campo`.
- Justificativa sem tabela de preço em `/matriculas/nova` continua validada só no servidor (achado #6).
- Confirmação ao descartar edições do Drawer (achado #3 de `/alunos/[id]`): remetida ao E7/`useDialogo`. A #155 tratou "não perder o digitado" em outras telas.
- `tela-sem-dom.ts` não roda efeitos nem tem `useRef`/`useMemo`/`useId`. Se as telas passarem a usá-los, os testes de interação falham com "Invalid hook call" (aviso no cabeçalho do arquivo).

##### 7. Publicação
- Merge `4f6aad16` na `main` → **no UAT**. Sem servidor, schema, migration nem `*.int.test.ts`.

##### 8. Riscos e observações
- As duas telas mudaram muito (`MatriculaFormulario.tsx` +317/−249 e `FichaAluno.tsx` +229/−161). Validação e foco agora vivem no cliente. As mensagens são as mesmas, mas a "combinada" referência + início + vencimento foi separada por campo.
- `CampoMoeda` e `CampoFuso` passaram a repassar `aria-*`. Depois do merge, a #159 mexeu nas duas telas, no `CampoFuso` e em `campos-mapa.ts`; a #156 mexeu em `MatriculaFormulario.tsx` (passo ativo em `bg-brand-solid`); as #153 e #155 estenderam `src/test/tela-sem-dom.ts`.
- O detector de `campos.test.ts` é heurístico (globais, propriedades, nomes declarados na expressão). Dá falso positivo se uma tela usar uma variável local com nome de global (`crypto`, `navigator`) em `aria-invalid`. Hoje não há.

---

#### #146 — docs: medição da auditoria de UI/UX (doc 43)

##### 1. Identificação
- **Aberta:** 07/10 11:55 · **mergeada:** 07/10 15:44 (a segunda da faixa, 6 minutos depois da #151) · base `main` · branch `claude/medicao-auditoria-ux`.
- **Tamanho:** 12 arquivos, +2265/−0. Merge `d20bda06`.
- **Área:** documentação e scripts. `docs/43-medicao-auditoria-ux.md` (659 linhas), `docs/medicao-ux/metricas-{1ca53675,6b105093}.json`, `scripts/medicao-ux/{nucleo,metricas,achados,amostra}.mjs` com os `.d.mts`, e `src/test/medicao-ux.test.ts`.

##### 2. Objetivo declarado × o que entrou
- Mede quanto do doc 42 as PRs #64–#138 resolveram, com a mesma régua na base (`1ca53675`) e no head (`6b105093`). `achados.mjs` extrai os 872 achados (145 Alta, 515 Média, 212 Baixa); os 145 Alta foram conferidos um a um (tabela 4.1); `amostra.mjs 6 3 42` sorteia 126 Média/Baixa (tabela 5.1).
- **Números principais:** Alta 37 resolvidos / 21 parciais / 87 abertos; Média e Baixa 71% abertos (IC 95% 63–79%, ≈ 517 de 727). `aria-invalid` 22 para 631 `required`; 31 de 62 paginações só para frente; 12 de 12 ações de alto impacto sem confirmação; 41 de 169 fluxos só com `router.refresh()`.
- A **§6 "O que ainda falta (priorizado)"** virou o roteiro das #153–#161.
- **Divergências na R1, todas corrigidas:** o cabeçalho do script mandava medir a base errada (`9bd583d2`); contraste com "3 famílias" quando o script dizia 4; "7 elementos" `bg-brand-600 text-white` quando eram 6; "0 pelo grep" no catch central quando o grep dava 3. O corpo final já traz os números corrigidos.

##### 3. Rastreabilidade
- Doc 42 inteiro (seções 6 e 7.1–7.6). Reclassificou L1540 e L1590 de "resolvido" para "parcial" (B6 da R1), igualando a L1786.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `dcca2e7c` | — | só docs e scripts; `node scripts/medicao-ux/metricas.mjs` roda |
| R1 | `dcca2e7c` | REQUEST CHANGES | **B1** não rodava no Node 20 (`import()` de `tailwind.config.ts`); **B2** cabeçalho com a base errada; **B3** calibração incompleta; **B4** afirmações de contraste contra a saída do script; **B5** números divergentes; **B6** L1540/L1590 × L1786; **B7** amostra Média/Baixa não auditável; **B8** nenhum teste da medição (14/14 mutações sobreviviam) |
| R2 | `3b977815` | **APPROVE** | nenhum |

- **Resolução:** `bed6d1e3` (núcleo em funções puras, Node ≥ 18 com `exigirNode`, mapa de cores lido do texto do `tailwind.config.ts`, teste `src/test/medicao-ux.test.ts` com 31 casos), `da22a7c8` (tabela 2.1 completa "27 iguais e 12 diferentes", tabela 5.1 com as 126 linhas, estimativa estratificada), `3b977815` (integrador: cada forma do catch central coberta).
- **Verificação do integrador (`3b977815`):** tsc 0; 498/498 arquivos, 2.904 testes; `medicao-ux.test.ts` 31/31; 9 mutações KILLED + controle.
- **Mutações do revisor:** R1 14/14 SURVIVED (nada guardava a medição); R2 20/20 KILLED.
- **APPROVE escrito no veredito da R2.** Junto com a #151 (APPROVE na R3), é uma das poucas da faixa que entrou com aprovação explícita do revisor.

##### 5. Testes e travas
- `src/test/medicao-ux.test.ts` fixa os números publicados: 872/145/515/212, a amostra `6/3/42` = 126 linhas, e a soma das tabelas 2.1, 4.1 e 5.1. Ele quebra se alguém editar um veredito da tabela 4.1 (mutação Q9 do integrador).

##### 6. Pendências e follow-ups
- As métricas de fluxo da 7.7 (operador real com cronômetro) **não foram medidas**. O doc diz que precisam ser feitas antes de declarar a auditoria encerrada.
- **O doc 43 não foi reatualizado depois da faixa.** `git diff d20bda06 origin/main -- docs/43-medicao-auditoria-ux.md` é vazio. A §6 na `main` ainda descreve como abertos os itens que as #153–#161 trataram, e os números são de `6b105093`. Os scripts sim mudaram: a #159 acrescentou `scripts/medicao-ux/fuso.mjs` e ajustou `metricas.mjs`/`nucleo.mjs`.
- O item 11 da §6 pede para repetir a amostra com outra semente depois dos itens 1–4. Ainda não foi feito.

##### 7. Publicação
- Merge `d20bda06` na `main`. É só documentação e scripts; o teste entra na suíte padrão (e no CI).

##### 8. Riscos e observações
- Como `medicao-ux.test.ts` fixa os números do doc, qualquer re-medição precisa atualizar doc, JSON e teste juntos.
- Os números do doc ficam defasados à medida que as PRs entram (o próprio doc avisa que são de `6b105093`).

---

#### #147 — test(e1): follow-up #139 — trava do vazio paginado falha fechado; render da reserva compara o texto lido

##### 1. Identificação
- **Aberta:** 07/10 12:03 · **mergeada:** 07/10 23:39 · base `main` · branch `claude/fu139-vazio-paginado`.
- **Tamanho:** 4 arquivos, +1017/−65. Merge `23b54768`.
- **Área:** só testes. `src/app/vazio-paginado.test.ts` (+690/−60), `src/app/(app)/matriculas/[id]/reserva/page.test.ts`, e o helper novo `src/test/texto-lido.ts` com o autoteste `texto-lido.test.ts`.

##### 2. Objetivo declarado × o que entrou
- Fecha o #139 (R3 B1/B2 da #134). A trava passa a **rastrear o texto até a posição** (opção b), no lugar de um `EstadoVazioPaginado` único (opção a), que exigiria reescrever ~45 telas já aprovadas.
- Sinais: (1) "nesta página" no pedaço ou na posição; (2) "nesta" aberto; (3) "página" minúscula abrindo texto avulso. Nas rodadas vieram mais dois: (4) texto editado por método e (5) palavra de alfabetos misturados.
- A varredura passou a incluir `.js/.jsx/.mjs/.cjs/.json` de `src`. Três exceções ancoradas novas: `VoltarPara.tsx` ("página anterior"), `OriginaisPainel.tsx` e `previas/[previaId]/page.tsx` ("página(s)").
- A leitura de texto saiu para `src/test/texto-lido.ts` (entidades do HTML 4, classe Cf, NFKC, homóglifos, brancos visíveis), que o render da reserva também usa.
- Nenhuma tela mudou. O corpo não foi atualizado depois das rodadas: ainda descreve só os sinais 1–3 e "Fora do alcance" com limites que as rodadas fecharam.

##### 3. Rastreabilidade
- Issue #139 (follow-up da #134, E1 da auditoria). `Closes #139`; a issue foi fechada em 07/10 23:39.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `7f8d932c` | — | 497/2.886; XV1–XV12, R3–R5, E1, E2, M1 KILLED |
| R1 | `7f8d932c` | REQUEST CHANGES | 65 execuções, 22 blockers: **B1** invisíveis fora do conjunto (`&lrm;`, `️`); **B2** palavra partida por elemento; **B3** entidades nomeadas; **B4** limites declarados (`toLowerCase`, `slice`, helper, `reduce`); **B5** homóglifo cirílico; **B6** mutações da trava sem autoteste |
| R2 | `1f7fd387` | REQUEST CHANGES | **B1** homóglifo fora da tabela (`ո` armênio); **B2** brancos visíveis (U+2800, U+3164); **B3** `split` sem autoteste por método (ED2/X1) |
| R3 | `0aa0bc84` | REQUEST CHANGES | **B1 CI vermelho:** com a `main` (que já tinha a #143), a trava acusava `src/test/guard-pagina.ts:182 pagina.tsx`; **B2** palavra sem letra latina (`ոеѕτа`) e versalete `ꜱ`; **B3** U+1D159; **B4** montagens equivalentes ao `split` (`["split"]`, `.match`, `[...s]`) |

- **Resolução:** R1 → `94cadd0a` e `1f2756b5`, com o ajuste do integrador `106d9cf9` (TS7006 em `toString`/`valueOf`). R2 → `f49329e9`, com o ajuste do integrador `0aa0bc84` (`.map(textoComparavel)` passava o índice como 2º parâmetro: 4 erros TS2345). R3 → `8cc014b7` (`pagina(?=[ ,;:!?)]|\.(?!\p{L}))`, `src/test/` fora da varredura, sinal 4 pela regra contrária, mistura de alfabetos também no texto comparável, versaletes e IPA na tabela).
- **Verificações do integrador:** R1 36/36 KILLED; R2 21/21 KILLED (2 controles sobrevivem; tempo da trava 3,6 s); R3 com a `main` + #145: tsc 0; 513/513 arquivos, 3.152/3.152 testes; 20/20 KILLED.
- **Mutações do revisor:** R1 65 (38 KILLED); R2 45 (34 KILLED, 4 equivalentes); R3 30 (20 KILLED, 3 equivalentes, 7 blockers).
- **Entrou sem APPROVE:** sim, pela regra pós-R3.
- **Interação entre PRs:** o B1 da R3 nasceu da #143. O helper `guard-pagina.ts` tinha `ts.createSourceFile("pagina.tsx", …)`, que a trava lia como "página" abrindo texto avulso.

##### 5. Testes e travas
- Trava `src/app/vazio-paginado.test.ts`, render da reserva, `texto-lido.test.ts`. Listas fechadas (`METODOS_QUE_MANTEM`, `METODOS_QUE_JUNTAM`, `BRANCOS_VISIVEIS`, `HOMOGLIFOS`, entidades) conferidas contra cópia literal.
- G10, G17 e G22 ficaram como mutações **equivalentes** documentadas.

##### 6. Pendências e follow-ups
- Fora do alcance que sobrou: early return sem else; texto que não nasce de literal (dado do servidor, `String.fromCharCode`).
- Nenhuma issue aberta por causa dela. O #139 foi fechado.

##### 7. Publicação
- Merge `23b54768` na `main`. Só testes. Não toca servidor nem `*.int.test.ts`. Nenhum arquivo dela foi alterado depois.

##### 8. Riscos e observações
- A trava ficou muito grande e cara de manter (690 linhas novas), com uma corrida "evasão → regra nova" de três rodadas. Uma tela nova com texto legítimo do tipo "página X" pode exigir exceção ancorada.
- A dependência entre travas globais (a #147 leu um helper da #143) mostra que um `src/test/*.ts` novo pode quebrar outra trava. Isso foi resolvido aqui excluindo `src/test/`, e a #149 fez o mesmo.

---

#### #148 — test(e1): trava de botões — evasões restantes do follow-up #140 (B1–B6 + A16f)

##### 1. Identificação
- **Aberta:** 07/10 12:08 · **mergeada:** 07/10 22:24 · base `main` · branch `claude/fu140-trava-botoes`.
- **Tamanho:** 1 arquivo, +976/−217 (`src/app/botoes.test.ts`). Merge `ebe4109c`.
- **Área:** só a trava global de botões (variante `perigo` em ação destrutiva, alternância com `aria-pressed`, grupo rotulado, isentos `ai-*`, rótulos dinâmicos).

##### 2. Objetivo declarado × o que entrou
- Fecha o #140 (R3 B1–B6 da #135) e o A16f. Desenho "falhar fechado em vez de enumerar formas": nomes resolvidos pelo escopo (`declaracaoNoEscopo`), trecho desconhecido marcado, objetos com chave entre aspas/atalho/spread, `aria-current`/`aria-expanded` isentando só com a mesma condição e polaridade, `aria-haspopup` deixa de isentar, `aria-labelledby` com id existente, `<fieldset>` com `<legend>`, funções que decidem a classe (inclusive importadas), isentos `ai-*` com conteúdo restrito, `usosDoComponente` varrendo todo `src/app` e `src/components`.
- Nas rodadas entrou `textoLido` (NFKC, `\p{Cf}`/`Default_Ignorable` removidos, U+2800 como espaço) e a falha fechada para letra fora do alfabeto do português (`LETRA_FORA_DO_PORTUGUES = /(?=\p{L})[^A-Za-zªºÀ-ÖØ-öø-ÿ]/u`).
- Nenhuma tela precisou de correção nem de exceção nova.

##### 3. Rastreabilidade
- Issue #140 (`Closes #140`, fechada em 07/10 22:24). E1 da auditoria (hierarquia de botões).

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `8522eb58` | — | **no head do autor 2 testes falhavam** (falso positivo no `InboxCliente`; autoteste T8). Corrigido em `8522eb58`; 497/2.881; 21/21 KILLED |
| R1 | `8522eb58` | REQUEST CHANGES | **B1** invisível no rótulo de tabela (`"Encer­rar"`, `"Encerrar​"`); **B2** "desestruturação → opaco" sem teste (S4) |
| R2 | `0a1e926c` | REQUEST CHANGES | **B1** invisíveis fora de `\p{Cf}` (U+034F, U+FE0F, U+3164); **B2** homóglifo cirílico (`Еncerrar`) |
| R3 | `434f37c2` | REQUEST CHANGES | **B1** U+2800 (braille em branco); **B2** homóglifo dentro do próprio latim (`ɑ` U+0251, `ı` U+0131) |

- **Resolução:** R1 → `0a1e926c` (`textoLido`; desestruturação; o C1 "um caso por verbo" também foi feito, com cópias literais de `VERBOS_DESTRUTIVOS` e afins). R2 → `434f37c2` (`Default_Ignorable_Code_Point`; `LETRA_FORA_DO_LATIM`). R3 → `f2acc5bf`, **aplicado pelo integrador** conforme a sugestão do revisor.
- **Verificações do integrador:** `0a1e926c` (497/2.886; regressão 21/21); `434f37c2` (504/3.001); `f2acc5bf` (504/3.003; 8 mutações KILLED + controle). O merge esperou o CI verde nesse head.
- **Mutações do revisor:** R1 37 (30 KILLED; S1/S2 anteriores à PR); R2 19 (13 KILLED); R3 9 (7 KILLED).
- **Entrou sem APPROVE:** sim, pela regra pós-R3 ("Mergeada pela regra pós-R3 aprovada pelo usuário", com o CI verde).

##### 5. Testes e travas
- Tudo em `src/app/botoes.test.ts`: autotestes por evasão (B1–B6, R2 B1/B2, R3 B1/B2), cópias literais das listas de verbos, prefixos e substantivos.

##### 6. Pendências e follow-ups
- Nenhuma declarada. O #140 foi fechado.

##### 7. Publicação
- Merge `ebe4109c` na `main`. Só teste. A #156 tocou o arquivo depois (exceções de contraste).

##### 8. Riscos e observações
- `LETRA_FORA_DO_PORTUGUES` falha fechado em qualquer letra fora do latim básico + Latin-1. Um rótulo legítimo com outra letra (nome próprio estrangeiro, "ŋ") num botão vai acusar e pedir exceção.
- O integrador teve de consertar 2 testes no próprio head do autor antes da R1. Isso mostra o custo de escrever travas sem `node_modules` no worktree.

---

#### #149 — test(e1): trava de `aria-sort` falha fechada (B9 do #141)

##### 1. Identificação
- **Aberta:** 07/10 12:16 · **mergeada:** 07/10 23:54 · base `main` · branch `claude/fu141-trava-aria-sort`.
- **Tamanho:** 1 arquivo, +1404/−70 (`src/app/colunas-ordenaveis.test.ts`). Merge `cf82be2c`.
- **Área:** trava global "só `ColunaOrdenavel` escreve `aria-sort`".

##### 2. Objetivo declarado × o que entrou
- **Refs #141, sem fechar.** Fecha só o B9 (trava de `aria-sort`). O **B2 (ordenação com acento no Postgres/collation) ficou de fora**, porque depende de schema/infra e do integrador.
- (a) O avaliador AST do texto segue `replace`, `satisfies`, `+=`, `fromCharCode`, `atob`, `JSON.parse`, membros de objeto, imports (`.ts/.js/.json`, reexportação, `import * as`, CommonJS) e funções do projeto. (b) O destino: spread em `<th>` proibido; spread em HTML/componente repassador exige chaves conhecidas; `createElement`, `setAttribute`, `innerHTML`, `eval`, etc. proibidos fora do componente; lista fechada de externos confiáveis (`react-hook-form`, `@dnd-kit`).
- Nas rodadas: a varredura passou a fechar pelo **grafo de imports** (produção que importa `*.test.*`, `__mocks__`, `src/test/` ou fora de `src/` é acusada); só o objeto de props inteiro pode ser repassado; listas conferidas por cópia literal; regras de escopo (`CaseBlock`, `catch`, `for`, `var` içado, declaração repetida → opaco); e o **reconhecimento do render-prop do `Campo` da #145** (`CHAVES_CAMPO`).

##### 3. Rastreabilidade
- Issue #141 (B9). O B2 do #141 continua pendente.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `5ee858af` | — | 497/2.878; trava ~9,5 s; 19 KILLED + 2 controles |
| R1 | `5ee858af` | REQUEST CHANGES | **B1** a varredura não cobria `*.test.tsx`, `__mocks__` nem fora de `src/` (E1–E3); **B2** objeto por prop comum escapava (E4/E4b); **B3** itens das listas removíveis sem teste (T5, T6, T8) |
| R2 | `bdc9bf8c` | REQUEST CHANGES | **B4** import misto `{ type X, Y }` passava como "só tipos" (U4) |
| R3 | `ba2ba97d` | REQUEST CHANGES | **B5** regras de escopo sem autoteste (S1, S2, S3, S5, S7); **B6** `function` num `case` sem chaves (Z8c passava **no head**); **B7** declaração duplicada num `.js` (Z6/Z6b passavam no head); **B8** conflito semântico com a #145 (73 achados com o `Campo`) |

- **Resolução:** R1 → `8f7b6b7c` + ajuste do integrador `bdc9bf8c` (o autoteste percorria a própria lista, então T6/T8 sobreviviam). R2 → `ba2ba97d`. R3 → `c814bd46` + ajuste do integrador `3fc690b5` (o caso "function nomeada" não isolava a regra; B8c sobrevivia).
- **Verificações do integrador:** `bdc9bf8c` (497/2.882); `ba2ba97d` (504/2.995; trava 9,4 s); `3fc690b5` com a `main` + #145: 513/513 arquivos, 3.164/3.164 testes; os 73 achados do `Campo` sumiram; 20/20 KILLED.
- **Mutações do revisor:** R1 35 (25 KILLED); R2 20 (17 KILLED); R3 43 (23 KILLED, 16 nos blockers B5–B7).
- **Entrou sem APPROVE:** sim, pela regra pós-R3. O B8 era o único com risco real de quebrar a `main` (quem entrasse por último quebraria a suíte), e foi resolvido antes do merge, com a #145 já na `main`.

##### 5. Testes e travas
- Tudo em `colunas-ordenaveis.test.ts`. O `it` da varredura tem timeout de 120 s; o tempo medido ficou em ~10 s localmente.

##### 6. Pendências e follow-ups
- **#141 continua ABERTA** (B2, collation do Postgres).
- **Follow-up registrado sem issue:** parâmetro reatribuído ou mutado (`props = {…}`) e alias de objeto (`const b = a; b[k] = …`) não entram na análise de valor da trava.

##### 7. Publicação
- Merge `cf82be2c` na `main`. Só teste.

##### 8. Riscos e observações
- Ficou acoplada ao contrato do `Campo` (`CHAVES_CAMPO = ["id", "aria-required", "aria-invalid", "aria-describedby"]`). Se o `Campo` passar a entregar outra chave, esta trava falha. É de propósito, mas é uma dependência a lembrar.
- Com 1.400 linhas novas, é a trava mais complexa da faixa.

---

#### #150 — test(e5c): follow-up #142 — trava de enum cru com checker de tipos (R3 da #138, B11–B15)

##### 1. Identificação
- **Aberta:** 07/10 12:26 · **mergeada:** 08/10 01:45 · base `main` · branch `claude/fu142-enum-checker`.
- **Tamanho:** 10 arquivos, +1560/−267. Merge `5b418b11`.
- **Área:** trava `src/app/enums-rotulos.test.ts` (+1416/−225), mais produção: `src/lib/labels.ts`, `src/lib/roles.ts`, `src/server/whatsapp/cron-gestao.ts`, `configuracao/catalogo/ModalidadeFormulario.tsx`, `configuracao/usuarios/{UsuarioFormulario,UsuariosPainel}.tsx`, `leads/[id]/FichaLead.tsx`.

##### 2. Objetivo declarado × o que entrou
- **Trava:** acusa enum cru **pelo tipo**, com um `ts.Program` único (C13): `@prisma/client` vira uma declaração virtual gerada do `schema.prisma`, `react` vira miniatura e o resto de `node_modules` fica `any`. Fecha B11 (posições de texto: `children`, `<option label>`, `aria-valuetext`, `dangerouslySetInnerHTML`, props de componentes do projeto), B12 (expressões: `filter/find/at`, `reduce`, `push`, `await`, `useMemo`, `rotular({}, x)`), B13 (mapa de rótulo só em `labels.ts`, varrendo também `src/lib` e `src/server`), B14/B15 (formato de `labels.ts`, lista fechada de exports).
- **Mudanças de produção que a trava ampliada forçou:**
  - `PAPEL_LABEL` saiu de `src/lib/roles.ts` para `labels.ts` (`roles.ts` só reexporta). Na R1, três rótulos passaram a sentence case — **mudança visível** na tela de usuários: "Gerente comercial", "Gerente pedagógico", "Secretaria acadêmica" (`labels.ts:100` na `main`).
  - `cron-gestao.ts`: `ETAPA_ROTULO` local virou `ETAPA_EXTENSO_LABEL` em `labels.ts`; as linhas do relatório saíram para `linhasDoFunil` e `linhasDosGargalos`, e `montarRelatorioDiario` passou a ser exportada. Esse é o **texto do relatório diário que vai por WhatsApp à gestão**.
  - `ModalidadeFormulario`: `SEGMENTOS` montado de `SEGMENTO_LABEL`.
  - `FichaLead.tsx`: `ETAPA_LABEL[e] ?? e` (código cru no fallback) virou `rotular(ETAPA_LABEL, e)`. Isso foi achado real do checker, corrigido pelo integrador em `bb62abad`.
- **Divergência:** o corpo dizia que `MATRICULADO`/`PERDIDO` "caíam no código cru" no relatório. Na R1 o autor corrigiu: essas etapas nem chegavam ao relatório, porque o funil usa `ETAPAS_FUNIL_ATIVO`. O corpo também estimava 10–30 s para a trava; o revisor mediu 25–42 s por mutação com a máquina carregada.

##### 3. Rastreabilidade
- Issue #142 (`Closes #142`, fechada em 08/10 01:45). Follow-up da R3 da #138 (E5 da auditoria, enum cru na tela), B11–B15 e sugestão C13.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `bb62abad` | — | **no head do autor o checker achou 3 casos e 1 teste falhava**: 2 falsos positivos (alias pelo nome em `FichaLead.tsx:338`; tupla inteira marcada em `FormularioOcorrencia.tsx:50`) e 1 real (`ETAPA_LABEL[e] ?? e`). Corrigido em `bb62abad`; 497/2.884; Program com 1.314 arquivos em ~1,5 s, arquivo inteiro ~13 s |
| R1 | `bb62abad` | REQUEST CHANGES | 18 sobreviventes. **B1** formas não seguidas (rest, IIFE, alias no helper, `Object.values/entries`, `X[código]` com `X` que não é mapa); **B2** lista de pares; **B3** regras sem autoteste e **o checker podia ser desligado na varredura real** sem teste falhar; **B4** `PAPEL_LABEL` fora do laço de formato; **B5** opções do `ModalidadeFormulario` sem teste; **B6** relatório do `cron-gestao` sem teste |
| R2 | `ef546f42` | REQUEST CHANGES | **B1 CI vermelho:** a trava acusava 3 falsos positivos no head (`academico/regras/[nivelId]/Formularios.tsx:48` e `:62` `h`; `financeiro/(painel)/comissoes/page.tsx:49 total`); **B2** V1 `fromEntries`, V2 `Reflect.get`, V3 `Object["values"]`, V4 alias, V8 constante; **B3** N6 e N8 sem autoteste; **B4** a ligação de `montarRelatorioDiario` com `linhasDoFunil` sem teste (CR3) |
| R3 | — | **não houve** | — |

- **Resolução:** R1 → `ef546f42`. R2 → `e5bcc8a5` (segue o valor até a posição: objeto literal, `new X(…)`, objetos globais em lista fechada `NAMESPACES_GLOBAIS`, `mapaPorNome` seguindo o mapa até a origem, `semTexto` pelo tipo) + ajuste do integrador `17c696bf` (o client virtual do Prisma não tinha `groupBy`/`aggregate`, então o `total` chegava `any`).
- **Verificações do integrador:** `bb62abad` (497/2.884; 26 mutações KILLED, 2 controles sobreviveram); `17c696bf` (506/506 arquivos, 3.011/3.011 testes; 24/24 KILLED, controle sobrevive).
- **Mutações do revisor:** R1 23 na rodada oficial (5 KILLED, 18 SURVIVED), depois de uma triagem de 104 (86 KILLED); R2 42 (34 KILLED, 8 SURVIVED).
- **Entrou sem APPROVE e sem R3.** O último registro na PR é a verificação do integrador da resposta à R2 (07/10 22:51). O merge saiu 3 horas depois (08/10 01:45), **sem comentário de merge** explicando a decisão. É a única PR da faixa que pula a R3 sem nota na própria PR.

##### 5. Testes e travas
- Trava `enums-rotulos.test.ts`, com autotestes por rodada e o teste "a varredura real usa o checker" (confere `projetoDaTrava()` com Program e `MASCULINO` em `codigos`).
- Testes novos de produção: `ModalidadeFormulario.test.ts` (opções e ordem Adulto, Kids, Teens, Empresa) e `src/server/whatsapp/cron-gestao.test.ts` (unitário, com `prisma` mockado, conferindo o texto final do relatório).

##### 6. Pendências e follow-ups
- **Abertos, herdados da R3 da #138:** C7 (`MAPA[x]` sem fallback), C8 (`rotular` aceita `string`) e C9 (quatro listas à mão em `MAPAS_NOVOS`). Não há issue para eles.
- A confirmação de que os 3 achados falsos sumiram e de que nada novo aparecia veio só na verificação do integrador (`17c696bf`). Não houve revisão independente desse último delta.

##### 7. Publicação
- Merge `5b418b11` na `main` → **no UAT**.
- Mexe em servidor (`src/server/whatsapp/cron-gestao.ts`). Sem schema, migration nem `*.int.test.ts`. O `cron-gestao.int.test.ts` existente não foi rodado.
- **Efeito visível:** a tela de usuários mostra os três papéis em sentence case; o relatório da gestão por WhatsApp passa a usar `ETAPA_EXTENSO_LABEL`.

##### 8. Riscos e observações
- O relatório de gestão é mensagem externa. A mudança é só de texto, coberta por teste unitário, mas é uma mensagem real enviada pelo cron no UAT.
- O client virtual do Prisma dentro da trava (`$Delegado` com `findMany`, `count`, `groupBy`…) é uma réplica que precisa acompanhar o uso real. O B1 da R2 nasceu justamente de um método faltando (`count`, depois `groupBy`). Um método novo do Prisma usado numa tela pode virar `any` e gerar falso positivo ou falso negativo.
- O custo da trava subiu (13 s localmente; 25–55 s por mutação sob carga). Ela depende do `testTimeout: 30_000` da #151.
- Os arquivos foram tocados depois: `enums-rotulos.test.ts` pelas #158 e #161; `FichaLead.tsx` pelas #155 e #156.

---

#### #151 — ci: GitHub Actions com typecheck, lint e testes unitários

##### 1. Identificação
- **Aberta:** 07/10 14:46 · **mergeada:** 07/10 15:38 (a primeira da faixa a entrar) · base `main` · branch `claude/ci-github-actions`.
- **Tamanho:** 16 arquivos, +224/−21. Merge `c3685565`.
- **Área:** infraestrutura (`.github/workflows/ci.yml`, `.nvmrc`, `eslint.config.mjs`, `vitest.config.ts`) e 6 arquivos de produção mexidos para zerar o lint (`DevolucaoCredito.tsx`, `OperacaoEntregaReposicao.tsx`, `acertos-vencimento/…/Formulario.tsx`, `autorizacoes-comunicacao/page.tsx`, `portal-aluno/preferencias-formulario.tsx`, `src/server/contratos/aditivo-{acerto-taxa-acoes,cobertura}.ts`), além de 2 `*.int.test.ts`.

##### 2. Objetivo declarado × o que entrou
- **CI** em `pull_request` para a `main` e em `push` na `main`. Jobs `typecheck` (`npm ci` → `prisma generate` → `next typegen` → `tsc --noEmit`), `lint` (`npx eslint .`) e `test` numa matriz `TZ: [UTC, America/Sao_Paulo]` com `fail-fast: false`. Node 22 por `.nvmrc` (igual ao `Dockerfile`). Actions pinadas por SHA (checkout v7.0.1, setup-node v7.0.0). variável de conexão do banco falsa só para o `prisma generate`. **Sem CD.**
- **Concorrência:** em PR, grupo `pr-<branch>` com cancelamento; em push na `main`, grupo `main-<sha>`, sem cancelamento.
- **Lint zerado:** os 56 erros da `main` (`6b105093`) foram zerados. 28 saíram por configuração (`no-explicit-any` desligada em `**/*.test.ts(x)`) e 28 foram corrigidos no código: 6 `any` de produção viraram tipos; `react-hooks/refs` (9) em `OperacaoEntregaReposicao` e no `Formulario` de acerto de vencimento, que ganharam o estado `temTentativa`; `react-hooks/error-boundaries` (10) em `autorizacoes-comunicacao/page.tsx` (o JSX saiu do `try/catch`).
- **`vitest.config.ts`:** `testTimeout: 30_000` (as travas por AST passavam dos 5 s no runner).
- **Divergência:** o corpo final ainda descreve partes da versão antiga. A R3 registrou isso (C11): `cancel-in-progress: true` com grupo `head_ref || ref_name`, "os runners rodam em UTC", `test` sem `typegen`, a "mudança mínima" em `aditivo-cobertura` (revertida em `056f0553`), e não cita o `testTimeout`.

##### 3. Rastreabilidade
- Não fecha achado do doc 42. É a infraestrutura que as PRs seguintes usam como "CI verde" na regra de merge.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| R1 | `a08da204` | REQUEST CHANGES | **B1** o job `lint` nascia vermelho (56 erros pré-existentes); **B2** `cancel-in-progress: true` também em push na `main` (commit da `main` sem CI) |
| R2 | `9d903406` | REQUEST CHANGES | B1 FIXED; **B2** aberto; **B3** a trava de retry (`temTentativa`) sem teste no render (M1, M2 sobreviviam); **B4** caminho de falha de `autorizacoes-comunicacao/page.tsx` sem teste; **B5** mudança de runtime em `aditivo-cobertura.ts` (`?.` virando `ErroRegra`) sem teste |
| R3 | `86272c6f` | **APPROVE** | nenhum |

- **Resolução:** B1 → `9d903406`; B2 → `d7de0432` (grupo por SHA em push); C1/C2/C4 → `a8dbdc40` (matriz de fuso, pin por SHA, `typegen` no `test`); B3/B4/B5 → `056f0553` (render com `temTentativa` nos dois componentes; dois casos de falha em `page.test.ts`; `aditivo-cobertura` volta a `.find(...)!.fotografiaHash`, com JS transpilado idêntico ao da `main`); timeout do job `America/Sao_Paulo` → `86272c6f`.
- **Achado no meio da R3:** em `a8dbdc40` e `056f0553`, o job `test (America/Sao_Paulo)` falhou 2 de 2 vezes por `Test timed out in 5000ms` em `colunas-ordenaveis.test.ts:111`. Não era fuso: a trava levava ~3 s localmente e estourava no runner mais lento. `86272c6f` trouxe o `testTimeout`.
- **Verificação:** a do autor no head `056f0553` (tsc 0; 497/2.878; `eslint .` 0 erros; 8 mutações). O revisor usou o CI da própria PR: run 37644486053 no head `86272c6f`, 4/4 jobs verdes, 497/497 arquivos e 2.878/2.878 testes nos dois fusos.
- **Mutações do revisor:** R1 nenhuma (só YAML); R2 2 (M1 e M2 sobreviveram); R3 12/12 KILLED.
- **Entrou com APPROVE** escrito no veredito da R3. O texto diz: "O merge fica com o usuário."

##### 5. Testes e travas
- `OperacaoEntregaReposicao.test.ts` (+47), `acertos-vencimento/…/Formulario.test.ts` (+25), `autorizacoes-comunicacao/page.test.ts` (+17).

##### 6. Pendências e follow-ups (conferidas na `main`)
- **C6:** `npx eslint .` sem `--max-warnings`. Os 46 avisos não travam nada (`ci.yml:61`).
- **C8:** `no-explicit-any` desligada em todos os `*.test.ts(x)`, inclusive `*.int.test.ts`.
- **C10:** o `testTimeout: 30_000` é global (`vitest.config.ts:15`). Um teste travado leva 30 s para falhar, e uma trava 5× mais lenta não aparece.
- **C12:** com a matriz, os checks se chamam `test (UTC)` e `test (America/Sao_Paulo)`. A proteção de branch, quando existir, precisa exigir esses nomes.
- **Troca do `TypeError` por `ErroRegra` em `aditivo-cobertura.ts`:** prometida "para uma PR com teste". Na `main` o código ainda usa `.find((x)=>x.id===i.cobrancaId)!.fotografiaHash` (`aditivo-cobertura.ts:84`).
- **O CI não roda `*.int.test.ts`** (`vitest.config.ts:12` os exclui; o comentário em `ci.yml:23` manda rodá-los à parte com `npm run test:int`). Essa é a origem da issue #162. Nenhum dos arquivos de CI mudou depois do merge (`git log c3685565..origin/main -- .github vitest.config.ts eslint.config.mjs` vazio).

##### 7. Publicação
- Merge `c3685565` na `main` → **no UAT**. O workflow não faz deploy; o deploy no UAT continua por outro caminho.
- Mexe em servidor (`src/server/contratos/aditivo-cobertura.ts` e `aditivo-acerto-taxa-acoes.ts`, só tipo) e em dois `*.int.test.ts` (`recebimentos-destinados`, `ensaio-vinculo-adversarial`: `prefer-const`), que o CI não roda.

##### 8. Riscos e observações
- A PR deixou de ser "só CI". Mexe em fluxos financeiros (`DevolucaoCredito`, acerto de vencimento). As mudanças têm teste de render, e o revisor comprovou que o JS de `aditivo-cobertura` não mudou.
- O "CI verde" que a regra de merge cita não roda integração. Para as PRs que mudam consultas (#158, #161), verde no CI não diz nada sobre o SQL real.
- Os arquivos de produção desta PR foram tocados depois por #153 (`Formulario` de acerto de vencimento), #158 (`autorizacoes-comunicacao/page.tsx`) e #159 (`preferencias-formulario.tsx`).

---

#### #153 — E3: erro e sucesso separados nos formulários fora da E3 (doc 43 §6, item 2)

##### 1. Identificação
- **Aberta:** 08/10 02:28 · **mergeada:** 08/10 05:21 · base `main` · branch `claude/e3-feedback-separado`.
- **Tamanho:** 106 arquivos, +7285/−1264. É a maior PR da faixa em arquivos. Merge `0dc4d092`.
- **Área:** 56 componentes de formulário em `academico` (avaliações, correções, equivalências, regras, recuperações, segundas chamadas, quantidade de aulas), `alunos/[id]/movimentacoes`, `configuracao` (operação, migração), `diario`, `financeiro` (acertos de cobertura, taxa e vencimento), `matriculas/[id]` (aditivos, aceite, autorizações, condições, continuidade, desistência, fechamentos, nova reserva, ocorrências) e `secretaria`. Trava nova `src/app/feedback-separado.test.ts` e helpers `src/test/feedback-acao.ts` e `src/test/tela-sem-dom.ts`.

##### 2. Objetivo declarado × o que entrou
- **56 componentes** que punham sucesso e erro no mesmo estado (`setMensagem(ok ? sucesso : erro)`) num `MensagemStatus` (`role="status"`, sem cor) passam a `useAcaoCliente` + `FeedbackAcao`: erro em `role="alert"` (com foco e rolagem), sucesso em `role="status"`, falha de transporte como resultado incerto (`MSG_RESULTADO_INCERTO`, `…_SEM_CHAVE` ou `MSG_DECISAO_INCERTA`) e ocupado liberado em qualquer desfecho. A lógica de chave de idempotência não mudou.
- O doc 43 falava de ~12 componentes; a busca achou 56.
- `ConferenciaRegraHistorica.tsx`: o `try/finally` sem `catch` ganhou tratamento de falha.
- `window.location.reload()` → mensagem + `router.refresh()` em `SegundaChamadaPainel.tsx` e `DecidirQuantidadeAulas.tsx`.
- Erros de consulta que saíam em `role="status"` passam a `role="alert"` (consolidado da avaliação, prévia da continuidade mensal, conferência de participantes).
- **Mudanças de comportamento declaradas:** o catch que mostrava `e.message` agora mostra a mensagem única de resultado incerto; telas que só davam refresh ganharam texto de sucesso ("Proposta enviada para revisão.", "Nova reserva confirmada…").
- **Divergência:** a R2 apontou o corpo desatualizado em quatro pontos (C5). Foi corrigido antes da R3.

##### 3. Rastreabilidade
- Doc 43 §6 **item 2**; doc 42 **E3**.
- **Alta fechados:** L1315, L1438, L2442, L2457, L2485, L1219, L1671, L1183, L892. **Alta parciais:** L1389 e L1400 (fica a `key` com versão, que é o item 3) e L309 (falta a confirmação, que é o item 1). **Média fechados:** L776, L1328, L2041.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `386f5eba` | — | **no head do autor, 10 testes falhavam** (`void executar(…)` não devolvia a promessa); corrigido em `386f5eba`; 552/552 arquivos, 3.652 testes; 8/8 KILLED |
| R1 | `386f5eba` | REQUEST CHANGES | 13 sobreviventes. **B1** a regra A não seguia o fluxo (L1–L6); **B2** filho aninhado de `role="status"` (L7); **B3** variantes de recarga (L9–L12); **B4** exceção `onNota={setNota}` do `InboxCliente` isentava um caminho não verificado (X1); **B5** `ImpactosTaxaFormulario` sem teste de chave (C5: no incerto a chave era descartada e o reenvio podia **duplicar o conjunto de impactos**) |
| R2 | `93b73d82` | REQUEST CHANGES | 12 sobreviventes. B1–B4 PARTIAL (L14–L16 executor por `let`/função/alias; L19, L21, L23, L25 região por constante, `<output>`, `role="log"`, JSX na expressão; L26, L28, L33 recarga; X8 `memo`); **B6** exceção do tipo erro isentava qualquer erro novo no mesmo trecho (EX1) |
| R3 | `83e6e868` | REQUEST CHANGES | 16 sobreviventes, incluindo **N1, uma regressão** (`const { executar } = useAcaoCliente(…)` deixou de ser pego). B1, B2, B3, B6 PARTIAL |

- **Resolução:** R1 → `93b73d82` (E21–E30, e a exceção do `InboxCliente` saiu: o `onNota` passou a ser conferido no filho); R2 → `83e6e868` (E31–E44; exceção do tipo erro com lista de fontes aceitas); R3 → `6d8456e4` (executor reconhecido pela origem da ligação; `role` por tokens; `children` como conteúdo; destino literal só vale se absoluto; `self/top/parent/frames`; `push` como fonte).
- **Verificações do integrador:** `93b73d82` (552/3.670; 11/11 KILLED), `83e6e868` (552/3.691; 15/15 KILLED), `6d8456e4` (552/3.708; 9/9 KILLED nas evasões da R3 na tela real). O integrador **não rodou na tela real** N2–N7 e N10; para elas ficou o autoteste do autor.
- **Mutações do revisor:** R1 37 (23 KILLED, 13 SURVIVED), R2 50 (35 KILLED, 12 SURVIVED), R3 51 (32 KILLED, 16 SURVIVED).
- **Entrou sem APPROVE**, pela regra pós-R3.
- **Coordenação com a #154:** as duas tocavam os mesmos três formulários. A trava desta PR tinha 7 exceções `PR_PARALELA` (acerto contratual, reconferência delta, emissão de fechamento) e uma pendência no lote da `FilaCobranca`. Ficou combinado que "quem entrar por último migra". Esta entrou primeiro, e a migração foi feita na #154 (`2576cdf5`).

##### 5. Testes e travas
- 36 `feedback.interacao.test.ts` novos, um por pasta migrada, cada um com o contrato de 4 casos (`contratoFeedbackSeparado`): erro só em alerta, sucesso só em status, falha de rede como incerto, ocupado liberado.
- 7 testes reescritos com `criarGanchos` (antes eram mocks posicionais de `useState`).
- Trava `src/app/feedback-separado.test.ts` (hoje com 1.999 linhas na `main`): regras A (estado de mensagem não recebe erro), B (região de status não recebe erro), C (sucesso do `.executar` não é erro), D (nada recarrega a página), E (falha fechada).

##### 6. Pendências e follow-ups
- **Resolvido depois:** as 7 exceções `PR_PARALELA` e a do lote da fila saíram na #154. Conferido: `feedback-separado.test.ts` na `main` não tem `PR_PARALELA` nem exceção da `FilaCobranca`.
- **C3 (adiado, sem issue):** texto de erro fora da lista de prefixos e `useReducer` como estado de mensagem não são pegos.
- **C7:** o `useId` simulado em `tela-sem-dom.ts` não tinha consumidor nesta PR (mutação H4 equivalente aqui).
- Limite declarado: callback `on<Palavra>` passado a componente de biblioteca não é conferido do lado de lá.

##### 7. Publicação
- Merge `0dc4d092` na `main` → **no UAT**. Não mexe em servidor, schema nem `*.int.test.ts`.

##### 8. Riscos e observações
- O alcance é grande (56 telas). Os testes de interação são sem DOM (`tela-sem-dom.ts`), por posição de gancho. Um gancho novo numa dessas telas pode quebrar o teste por motivo técnico.
- O texto de erro mudou para muitos usuários: onde antes aparecia o `e.message` cru, agora aparece a mensagem padrão de resultado incerto.
- O B5 da R1 era risco real de dinheiro (duplicar impactos de taxa). Foi pego por mutação e corrigido com teste.
- A trava passou por três rodadas de "evasão → regra nova" e terminou com 16 evasões que a R3 achou e a R3-resposta fechou. É o padrão de toda a faixa: a trava só é tão boa quanto a última lista de evasões testada.

---

#### #154 — feat(ux): `ConfirmarAcao` e confirmação nas ações de efeito externo ou financeiro (E1, fatia A)

##### 1. Identificação
- **Aberta:** 08/10 02:28 · **mergeada:** 08/10 11:47 · base `main` · branch `claude/e1-confirmar-acao`.
- **Tamanho:** 36 arquivos, +3571/−170. Merge `14dd30b7`.
- **Área:** componente novo `src/components/ConfirmarAcao.tsx`; `Modal.tsx`, `src/lib/dialogo.ts`, `src/lib/acao-cliente.ts`; telas `financeiro/FilaCobranca.tsx`, `financeiro/FinanceiroPainel.tsx`, `desistencia/financeiro/{AcertoContratual,ReconferenciaDelta}Formularios.tsx`, `fechamentos-horas/EmitirFechamento.tsx`, `empresas/[id]/FichaEmpresa.tsx`, `configuracao/whatsapp/{Politica,Comercial,ReguaComercial,Templates}Painel.tsx`; servidor `src/server/financeiro/consultas.ts`; trava nova `src/app/confirmacoes.test.ts` + `confirmacoes-mapa.ts`.

##### 2. Objetivo declarado × o que entrou
- **`ConfirmarAcao`:** `role="alertdialog"`, `aria-modal`, título e consequência ligados; foco inicial no "Voltar"; Escape e fundo cancelam; botão `perigo` "Confirmar {o quê}"; caixa opcional de conferência ("Confirmo os valores acima"); a ação roda dentro do diálogo pelo `useAcaoCliente`, e erro ou incerto ficam **dentro** do diálogo, que só fecha no sucesso.
- **Suporte:** `useDialogo` com pilha de diálogos (a confirmação abre sobre a gaveta do detalhe da cobrança); `Modal` com `papel`, `descricaoId` e `focoInicial`; `useAcaoCliente` expõe `setSucesso`; `totaisComissoesAPagar` passa a devolver a `quantidade` por moeda (`_count`, leitura agregada, sem schema).
- **12 ações migradas:** cobrar/lembrar na linha da fila e "Enviar via WhatsApp (API)" na gaveta; fechar mês e marcar comissões pagas; aplicar acerto aprovado; aplicar reconferência; emitir cobrança de fechamento; pagar e cancelar fatura B2B; kill switch nos dois sentidos; política da régua → ATIVA; saudação/alertas do gestor → ATIVA; régua comercial → ATIVA e go-live do piloto (sai o único `window.confirm` do app); salvar template aprovado.
- **Entrou também a migração da #153** (`2576cdf5`): `AcertoContratualFormularios` e `ReconferenciaDeltaFormularios` com erro e sucesso separados, e o lote da `FilaCobranca` com as falhas em `role="alert"`. Isso não estava no escopo original e foi o acordo de ordem com a #153.
- **Bug achado na verificação** (`9528e648`): depois de uma tentativa incerta, a confirmação bem-sucedida mostrava o sucesso **e** o alerta de incerto ao lado.
- **Divergência:** a R2 apontou o corpo desatualizado em 4 pontos (C5); o autor atualizou.

##### 3. Rastreabilidade
- Doc 43 §6 **item 1** (fatia A, efeito externo ou financeiro); doc 42 **E1**.
- **Fechados:** L799, L906, L2014, L2016, L2516, L2517, L2518. **Parcial:** L2281 (pagar e cancelar fatura feitos; "Inativar empresa" fica para a fatia B).
- Métrica 7.6 "ações de alto impacto sem confirmação": cobre 6 das 12. "Confirmação de ação": de `window.confirm` 1 / componente 0 para `window.confirm` 0 / `ConfirmarAcao` em 10 telas.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `ab00bd83` | — | **3 testes falhavam** no head do autor (`disabled` casando com a classe Tailwind; o texto "nesta página" barrado pela trava da #147). Corrigido; 527/3.273; 18/18 KILLED |
| R1 | `ab00bd83` | REQUEST CHANGES | 96 mutações, 18 sobreviventes. **B1** trava de importação (relativo, re-export, wrapper em `src/lib`); **B2** `window.confirm` por alias, `window.window`, `Reflect.get`; **B3** pilha e foco inicial sem teste (O1, O2, O3, D1, D2); **B4** ocupado sem teste na caixa e no `aria-busy`; **B5** `FALHOU` no envio da fila podia virar nota de sucesso; **B6** a chave da reconferência não precisava trocar depois do sucesso; **B7** trechos da consequência sem teste |
| R2 | `f386108a` | REQUEST CHANGES | 42 mutações, 12 sobreviventes. B1/B2 PARTIAL (F1–F4, G1, G3–G5); **B8** ação executada **no render** dentro da prop `acao` (o pagamento B2B seria registrado ao abrir a confirmação); **B9** caixa de conferência não desmarcava; **B10** resumo ignorava ajuste só de saldo; **B11** "Reconciliar mesma tentativa" sem reenvio |
| R3 | `9528e648` | **APPROVE** ("modo leve") | nenhum. B1, B2 e B8 "viraram comentário" |

- **Resolução:** R1 → `059aa02f` + ajuste do integrador `f386108a` (`eslint-disable` de `rules-of-hooks` no `dialogo.interacao.test.ts`); R2 → `ec09c5e6`; migração da #153 → `2576cdf5`; bug do incerto → `9528e648`.
- **Verificações do integrador:** `f386108a` (529/3.308; 18/18 KILLED), `9528e648` (já com a #153: 566/566 arquivos, 3.867 testes; 19/19 KILLED).
- **Mudança de régua na R3.** A R3 rodou no "modo leve": CI verde, leitura do diff e do fluxo, **sem mutações**. Os blockers B1, B2 e B8 da R2 foram rebaixados a comentário com a justificativa "Era evasão de trava achada por mutação. No modo atual isso não bloqueia." A partir daqui (#154 R3, #155 em diante), as revisões passam a ser "modo leve" e o APPROVE volta a aparecer.
- **Entrou com APPROVE** escrito no veredito da R3.

##### 5. Testes e travas
- Novos: `ConfirmarAcao.test.ts` (SSR), `ConfirmarAcao.interacao.test.ts`, `src/lib/dialogo.interacao.test.ts` (efeito rodando com `document` falso), `Modal.test.ts`, e um `*.confirmacao.test.ts` por tela (10 arquivos), cada um conferindo "não dispara sem confirmar", "dispara uma vez ao confirmar" (`toHaveBeenCalledTimes(1)`, depois da R2) e a consequência.
- Trava `src/app/confirmacoes.test.ts` (879 linhas): lista fechada de 12 pares (arquivo, módulo, action, achado) comparada com cópia literal; a action só pode ser referenciada no **corpo** da função que é o valor da prop `acao` de um `<ConfirmarAcao>`; nenhum outro arquivo do `src` importa a action; `window.confirm` proibido em qualquer forma; código opaco (`eval`, `Function`, timer com texto, import de fora do `src`) acusa.

##### 6. Pendências e follow-ups
- **Fatia B (aberta, sem issue).** Ainda sem confirmação: encerrar país (L2428), "Faltou" no check-in (`HomeProfessor.tsx`, L2693), vincular contato e opt-out na inbox (L2298), aprovar replanejamento (L1102), quantidade de aulas (L1218), presença histórica (L2499), desativar usuário/preço/idioma e inativar empresa (resto de L2281). Na `main`, `ConfirmarAcao` só é usado nas 10 telas da fatia A.
- Outros Alta do padrão fora da lista do item 1: L309, L531, L547, L715, L853, L1058, L1156, L2295.
- Estimativa numérica de alcance ao ativar a régua (L2517): exige consulta nova; hoje a confirmação descreve o alcance em palavras.
- **C2 da R3 (anterior à PR, aberto):** `enviarLote` em `FilaCobranca.tsx` não tem `try/catch`; se o transporte falhar, `enviandoLote` fica preso em `true`. Conferido na `main`: o `await aprovarLoteCobranca(…)` segue sem proteção.

##### 7. Publicação
- Merge `14dd30b7` na `main` → **no UAT**.
- Mexe em servidor (`src/server/financeiro/consultas.ts`: `_count` em `totaisComissoesAPagar`). Sem schema, migration nem `*.int.test.ts`.
- **Efeito visível:** todas as ações de WhatsApp (kill switch, ativar régua, go-live do piloto, template aprovado) e as financeiras (fechar mês, pagar/cancelar fatura, aplicar acerto, emitir cobrança) passam a exigir confirmação.

##### 8. Riscos e observações
- O rebaixamento dos blockers de trava na R3 (B1, B2, B8) foi decisão de régua de revisão, não correção. O autor fez as correções em `ec09c5e6`, mas elas não foram mutadas por ninguém além do integrador (S1–S17).
- A #155 conflitava semanticamente com esta (4 testes): o `useAvisoAoSair` passava `window` como valor e o `TemplatesPainel.confirmacao.test.ts` não simulava `useEffect`. A #155 se ajustou depois do rebase.
- Componentes tocados depois: `FilaCobranca.tsx` (ainda é o arquivo mais mexido da faixa), `PoliticaPainel.tsx` (#156), `TemplatesPainel.tsx` (#155), `desistencia/financeiro/page.tsx` (#160) e `botoes-mapa.ts`.

---

#### #155 — fix(e5): não perder o que foi digitado (doc 43 §6, item 3)

##### 1. Identificação
- **Aberta:** 08/10 07:49 · **mergeada:** 08/10 12:02 · base `main` · branch `claude/e5-nao-perder-digitado`.
- **Tamanho:** 57 arquivos, +2976/−157. Merge `c1b3a62c`.
- **Área:** lançamento e correção de notas (`avaliacoes/[alocacaoId]/[codigo]`, `correcoes/[lancamentoId]`), designação, replanejamento, `calendario/novo`, `grades/nova`, agenda da 2ª chamada, substituição, `configuracao/contratos` (`ModeloFormulario`), turmas, templates do WhatsApp, diário (`DiarioAulas.tsx`), `leads/[id]` (`FichaLead`, contratação), participantes da prévia, pagador; `src/lib/aviso-ao-sair.ts` (novo); servidor `src/server/avaliacoes/lancamentos.ts`; trava nova `src/app/formularios-preservados.test.ts`.

##### 2. Objetivo declarado × o que entrou
- **Key sem versão, página nem filtro.** Refresh, troca de página ou de filtro não remontam o formulário. O fuso do lançamento de notas virou estado dentro do `LancarNotas` (saiu o `<form method="get">` aninhado). A consulta passou a devolver `anterior`, a última versão, em qualquer página do histórico (**mudança em `src/server/avaliacoes/lancamentos.ts`**). Designação, participantes (`SeletorMaioridade` novo), contratação (key só da oferta), substituição, correções, replanejamento e `grades/nova` perderam a key volátil. A chave de idempotência, antes trocada pela remontagem, agora é trocada à mão depois de salvar.
- **`PagadorFormulario`:** um rascunho por tipo (Responsável, Empresa, Aluno).
- **`FichaLead`:** a leitura mostra o valor persistido e acompanha o servidor depois do `router.refresh()`.
- **`useAvisoAoSair(sujo)`** (`beforeunload`): em `contratos/novo`, `calendario/novo` e templates do WhatsApp.
- **Outros Alta:** prévia da agenda da 2ª chamada (L1761), mescla da chamada ao trocar a data no diário (L1835), confirmação ao descartar turma preenchida (L2395), reenviar ou descartar a tentativa no modelo contratual (L2368).
- **Entrou na R1:** `form.reset()` depois do sucesso em `ProporCorrecao` (evita uma segunda proposta idêntica), limpeza de professor e motivo na designação, e `voltarDataSeFalhou` no diário.
- **Divergência:** o corpo dizia que os templates do WhatsApp "não dependem do `ConfirmarAcao`" e que o merge com a #154 "seria simples". Na prática, 4 testes quebravam (B1 da R1).

##### 3. Rastreabilidade
- Doc 43 §6 **item 3**.
- **Fechados:** L562 (pagador), L629 (participantes), L1081 (replanejamento), L1314 (`[codigo]`), L1327 (designação), L1761, L1814 (substituição), L1835 (diário), L2202, L2203 (`/leads/[id]`), L2217 (contratação), L2368, L2395 (turmas). **Parciais:** L1059 (`calendario/novo`) e L2367 (`contratos/novo`).

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `f8154766` | — | no head do autor, **tsc com 2 erros** (TS2345) e **3 testes falhando** (estados vazios, `method="get"` num comentário, `historicos-fuso`); corrigido pelo autor em `f8154766`; 567/3.806; 17/17 KILLED |
| R1 | `f8154766` | REQUEST CHANGES ("modo leve", sem mutações) | **B1** conflito semântico com a #154: juntas, 4 testes falham (`confirmacoes.test.ts:538` acusa `ligarAvisoAoSair(window, sujo)`; `TemplatesPainel.confirmacao.test.ts` quebra com `useEffect` nulo) |
| R2 | `7f7d0c35` | **APPROVE** ("modo leve") | nenhum |

- **Resolução:** merge da `main` com a #154 (`77addc81`) + `7f7d0c35` (`aviso-ao-sair.ts` registra direto em `window.addEventListener`; mock de `@/lib/aviso-ao-sair` no teste da #154; C1 e C2 corrigidos).
- **Verificação do integrador (`7f7d0c35`):** tsc 0; 581/581 arquivos, 3.968/3.968 testes; 21/21 KILLED.
- **Entrou com APPROVE** escrito na R2.

##### 5. Testes e travas
- Trava `src/app/formularios-preservados.test.ts` (910 linhas): K (nenhuma key de remontagem com valor volátil), F (nenhum `<form>` aninhado, inclusive por componente importado), E (falha fechada). `tela-sem-dom.ts` ganhou `identidadeNoReact` (caminho de posições + key).
- 15 testes de interação novos ("o digitado sobrevive") e testes de identidade no React nas 6 páginas.
- `src/lib/aviso-ao-sair.test.ts`.

##### 6. Pendências e follow-ups (conferidas na `main`)
- **22 exceções na trava, ainda lá.** `formularios-preservados.test.ts` na `main` ainda tem as 17 exceções `VERSAO_PENDENTE` (keys com versão fora do recorte do item 3), mais 2 da designação da recuperação, 1 de `contratos/[codigo]` e 2 de identidade escolhida na URL. O arquivo não mudou depois do merge.
- **L1059/L2367 (parciais):** falta o diálogo na navegação interna (link do Next) e o rascunho em `localStorage` do modelo contratual.
- **L1314:** o campo de fuso ficou texto com sugestões (decisão do `CampoFuso`). A busca GET de `grades/nova` continua recarregando a página.
- Nenhuma issue aberta.

##### 7. Publicação
- Merge `c1b3a62c` na `main` → **no UAT**.
- Mexe em servidor (`src/server/avaliacoes/lancamentos.ts`: `anterior`/`ultima` independente da página, exposto só a quem pode lançar). Sem schema, migration nem `*.int.test.ts`. O `lancamentos.int.test.ts` foi alterado depois pela #158 e é um dos arquivos da #162.

##### 8. Riscos e observações
- Tirar a key muda o ciclo de vida do estado. O risco típico é estado "preso" depois do refresh. A R1 achou dois casos (correção que permitia proposta duplicada; diário com lista antiga e data nova) e eles foram corrigidos. As 17 keys de versão que ficaram são justamente onde esse risco não foi conferido.
- O `beforeunload` cobre só reload e fechar aba. A navegação interna do Next não é interceptada.
- A partir desta PR, a revisão é "modo leve" (sem mutação do revisor). A cobertura por mutação ficou só com o integrador.

---

#### #156 — fix(e5): contraste — seleção em `bg-brand-solid` e `--border-control` acima de 3:1 (doc 43 §6, item 5)

##### 1. Identificação
- **Aberta:** 08/10 12:33 · **mergeada:** 08/10 12:41 (8 minutos) · base `main` · branch `claude/e5-contraste`.
- **Tamanho:** 16 arquivos, +1042/−23. Merge `fbada6a2`.
- **Área:** design system. `src/app/globals.css`, `docs/18-design-system.md`, e os 6 elementos de seleção: `SubTabs.tsx`, `BarraAbasFinanceiro.tsx`, `FichaLead.tsx`, `TurmaFormulario.tsx`, `PoliticaPainel.tsx` e `MatriculaFormulario.tsx`. Trava nova `src/app/contraste.test.ts` (864 linhas) + `contraste-mapa.ts`.

##### 2. Objetivo declarado × o que entrou
- `bg-brand-600 text-white` → `bg-brand-solid text-white` nos 6 elementos; o chip da turma também troca a borda. Sobra um `bg-brand-600`, a barra de progresso sem texto da `HomeVendedor`, numa lista fechada (`FUNDOS_DA_MARCA_SEM_TEXTO`).
- `--border-control`: alfa `.42 → .44` no claro e `.34 → .36` no escuro.
- Números: `#fff` sobre a seleção no escuro passa de **4,06** para **7,90**; `--border-control` sobre `--surface-muted` passa de **2,996** para **3,19** (claro) e de **2,991** para **3,18** (escuro).
- Trava: lê os tokens reais de `:root` e `.dark` e exige ≥ 4,5:1 para branco sobre fundos sólidos e ≥ 3:1 para `--border-control` sobre as superfícies; pela AST, proíbe `bg-brand-500|600` com `text-white` em qualquer forma (template, `cn`/`clsx`, ternário, função local, `botaoClasses`, `createElement`), com falha fechada.
- `docs/18`: a regra antiga ("estado ativo = `bg-brand-600`, não promova para `bg-brand-solid`") foi **invertida**.

##### 3. Rastreabilidade
- Doc 43 §6 **item 5** (as duas partes); §3 7.4 "pares de token reprovando AA" (sai `--border-control`, de 4 para 3 famílias); §1 item 6. Doc 42 **L150** e **L2778** (o par `#fff`/`--brand` no escuro deixa de ter uso com texto).

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `17366b8e` | — | 583/583 arquivos, 3.987 testes; 11/11 KILLED + controle |
| R1 | `17366b8e` | **APPROVE** ("modo leve") | nenhum |

- **C1 da R1:** no escuro, `#4338ca` sobre `--surface` dava 1,97:1 (antes, com `--brand`, 3,83:1). A seleção ficou **menos destacada** da superfície, abaixo dos 3:1 da WCAG 1.4.11 para componente não textual. **Foi corrigido na #157**, aberta 7 minutos depois do merge.
- C2: a trava soma 7,2 s no job de teste. C3: o teste do `MatriculaFormulario` cobre só o passo ativo, não o concluído.
- **Entrou com APPROVE.** Do "pronto" ao merge: 8 minutos.

##### 5. Testes e travas
- `contraste.test.ts`, `contraste-elementos.test.ts` (render com a classe exata) e testes novos de render em `SubTabs`, `BarraAbasFinanceiro` e `FichaLead`. `medicao-ux.test.ts` passou de 4 para 3 famílias.

##### 6. Pendências e follow-ups
- A família `#fff/--brand` **continua na conta** do `nucleo.mjs` (`paresReprovados` conta por token, não por uso). A próxima medição do doc 43 precisa reclassificá-la. Ela não foi feita.
- `--border` e `--brand-border` (bordas decorativas, 1,25–1,56:1) seguem reprovando, fora do item 5.
- Fora do alcance da trava: texto branco herdado do pai e classe montada letra a letra fora de `className`.
- C1 → resolvido na #157.

##### 7. Publicação
- Merge `fbada6a2` na `main` → **no UAT**. Só front e CSS. **Muda a aparência** de todas as telas com seleção e de todo controle com borda.

##### 8. Riscos e observações
- Entre o merge da #156 (12:41) e o da #157 (12:59), a `main` (e, com o deploy automático, o UAT) ficou 18 minutos com a seleção pouco destacada no escuro (1,8–2,2:1 sobre as superfícies).
- A #159 e a #157 voltaram a mexer em `docs/18`, `contraste-mapa.ts` e `contraste.test.ts`. A #158 mexeu em `src/test/medicao-ux.test.ts`.

---

#### #157 — fix(e5): `--brand-solid` próprio do escuro (`#6264ec`), ≥ 3:1 sobre as superfícies (C1 da #156)

##### 1. Identificação
- **Aberta:** 08/10 12:48 · **mergeada:** 08/10 12:59 (11 minutos) · base `main` · branch `claude/e5-brand-solid-escuro`.
- **Tamanho:** 4 arquivos, +137/−20. Merge `c107da32`.
- **Área:** `src/app/globals.css`, `src/app/contraste-mapa.ts`, `src/app/contraste.test.ts`, `docs/18-design-system.md`.

##### 2. Objetivo declarado × o que entrou
- O `.dark` ganha `--brand-solid: #6264ec` (o claro continua `#4338ca`). No escuro: branco sobre ele **4,612**; ele sobre `--bg-page`/`--surface`/`--surface-muted` **3,738 / 3,372 / 3,076**. Antes: 2,181 / 1,968 / 1,795.
- A faixa útil de luminância no escuro é **0,1720–0,1833**; `#6264ec` está em 0,1777. Os vizinhos `#6161ea` e `#6566ef` reprovam um lado cada.
- Nova lista fechada `SUPERFICIES_DA_SELECAO`. `--neutral-muted` fica de fora porque é **impossível** cumprir as duas contas sobre ele (3:1 pede L ≥ 0,1846; branco a 4,5:1 pede L ≤ 0,1833), e a trava confere essa impossibilidade pelos tokens.
- **Efeito colateral declarado:** no escuro, o branco sobre o botão primário cai de 7,90:1 para 4,61:1 (continua AA). No hover (`brightness-95`), o fundo fica a 2,83:1 sobre `--surface-muted`, transitório.

##### 3. Rastreabilidade
- C1 da R1 da #156; WCAG 1.4.11.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `b1477a48` | — | 583/3.988; 7/7 KILLED + controle |
| R1 | `b1477a48` | **APPROVE** ("revisão leve") | nenhum. O revisor recalculou à parte todos os números de WCAG |

- **Entrou com APPROVE.**

##### 5. Testes e travas
- `contraste.test.ts` passa de 16 para 22 pares e ganha autoteste com token virtual (`#4338ca`, `#6b6ef5`, `#6161ea`, `#6566ef`, `#6264ec`) e `selecaoImpossivelSobre`.

##### 6. Pendências e follow-ups
- **C1 (hover do primário no `docs/18`) e C2 (comentários "não inverte no dark" em `tailwind.config.ts` e `contraste-mapa.ts`)** foram resolvidos **na #159** (`b73ae133`), que não tem relação de escopo com contraste. Conferido na `main`: `docs/18-design-system.md:99` tem a nota "Hover do primário no escuro (C1 da revisão da #157)", e `tailwind.config.ts:42` diz "valor próprio por tema, sempre com texto branco".

##### 7. Publicação
- Merge `c107da32` na `main` → **no UAT**. Só CSS e trava. Muda a cor de todo `bg-brand-solid` no escuro (19 componentes, inclusive o botão primário).

##### 8. Riscos e observações
- Os testes de interação de outras telas não dependem do hex, então nada quebrou.
- Pendurar C1/C2 desta PR na #159 funciona, mas espalha a rastreabilidade: quem procurar o fechamento desses comentários tem de achar o item 7 do corpo da #159.

---

#### #158 — fix(e4): paginação nos dois sentidos (doc 43 §6, item 4)

##### 1. Identificação
- **Aberta:** 08/10 13:14 · **mergeada:** 10/10 15:57 · base `main` · branch `claude/e4-paginacao-dois-sentidos`.
- **Tamanho:** 110 arquivos, +2603/−663. Merge `60f14790`.
- **Área:** 28 telas (acadêmico, secretaria, diário, financeiro, configuração, matrícula); **24 consultas de servidor** em `src/server/{academico,agenda,avaliacoes,comunicacoes-agenda,diario,gravacoes,matricula,portal-aluno,migracao}`; `src/lib/pagina-url.ts`; medição `scripts/medicao-ux/{metricas,nucleo}.mjs`; trava nova `src/app/paginacao-dois-sentidos.test.ts` (754 linhas); **13 `*.int.test.ts`**.

##### 2. Objetivo declarado × o que entrou
- **Telas:** as 27 listas "só para frente" da medição, mais `/alunos/[id]/academico`, passam a `<Paginacao>` ("← Anterior · Página N · Próxima →") com `lerPagina`/`hrefLista`. Filtros na URL; a página 1 nunca leva `?pagina=1`.
- **Servidor:** as consultas por cursor só para frente (`cursor`, `depoisId`, `antesDe`, cursor base64 do diário, cursor composto da fila de 2ª chamada) passam a **página numerada**, com `janelaDaPagina`/`recorteDaPagina` (`skip`/`take` ou `LIMIT`/`OFFSET`) lendo um registro a mais. A ordem termina sempre no `id`. As conferências "cursor pertence ao escopo" **caem**, porque a página é contada no escopo de quem consulta.
- **Medição:** paginação só para frente de **31 de 63** para **4 de 36** (os 4 restantes são texto de domínio, como "Próxima aula experimental"). Arquivos com `<Paginacao`: de 7 para 35.
- **Divergência de notação:** a seção "Achados que fecha" cita "#419", "#924", "#1469", "#431", "#1709". São **linhas do doc 42**, não issues nem PRs, e o GitHub as transforma em links para outras PRs e issues com esses números.

##### 3. Rastreabilidade
- Doc 43 §6 **item 4**; métrica 7.5 (✖ → ◐).
- Fechados: L419 (`/secretaria/desistencias`), L924 (`autorizacoes-comunicacao`), L1469 (`/academico/recuperacoes`). Parciais: L431 (envios do portal: falta o filtro de situação) e L1709 (agendas de 2ª chamada: falta busca e filtro de data).

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `a7ca2ad3` | — | **tsc com 1 erro** (TS2353 num `*.int.test.ts`); `voltar.test.ts` falhava (5 exceções sobrando). Corrigido em `a7ca2ad3`. 591/591 arquivos, 4.065 testes; 11/11 KILLED. "**Os 13 `*.int.test.ts` alterados nesta PR não foram executados**" |
| R1 | `a7ca2ad3` | **APPROVE** ("modo leve") | nenhum |
| R2 | `43f5e8a9` | **APPROVE** ("modo leve") | nenhum. Delta = só o merge da `main` com a #159 (`git range-diff` dá `=`) |

- **A PR ficou parada dois dias**: aberta em 08/10 13:14, verificada pelo integrador às 13:19, e a R1 só veio em 10/10 15:47.
- Comentários da R1, todos adiados: **C1** página além do fim diz "Nenhum…" sem "nesta página" nas listas sem contagem; **C2** em fila de trabalho, a página numerada desloca a página 2 e quem avança pode pular registros (o integrador já tinha levantado isso como "ponto de produto"); **C3** favoritos com `?cursor=` antigo abrem a página 1; **C4** sobreposição com a #160.
- **Entrou com APPROVE**, mas **sem rodar os testes de integração** (o comentário de merge da #161 e a issue #162 registram isso).

##### 5. Testes e travas
- Novos: `paginacao-dois-sentidos.test.ts` (regra 1: link que avança uma chave de página precisa de link que recue a mesma chave; regra 2: tela que lê página da URL mostra navegação; exceções ancoradas), `src/server/paginacao-numerada.test.ts` (15 consultas: página 1, última, ida e volta, ordem terminando no `id`, `skip`/`take` ou `LIMIT`/`OFFSET`), `src/test/consulta-paginada.ts` (um `findMany` de mentira ordenado) e testes de render das telas.
- Integração **alterada e não executada**: `fluxo`, `rascunho`, `lancamentos`, `segunda-chamada-agenda-inicial`, `segunda-chamada`, `comunicacoes-agenda/consultas`, `avisos-diario`, `diario`, `regularizacao-designacao`, `continuidade-fila`, `desistencia-administrativa-fila`, `migracao/consultas-financeiras` e `portal-aluno/resultados`. Os que conferiam "cursor de outro escopo é recusado" passaram a conferir que nenhuma página do escopo traz o registro alheio.

##### 6. Pendências e follow-ups
- **#162 (aberta):** rodar os 13 `*.int.test.ts`.
- **Fatia seguinte: 26 telas (27 links) ainda só para frente** (versões e históricos por `antesVersao`, `antesId`, `depoisId`, `beforeId`, `cursor`), ancoradas como `PENDENCIA` em `EXCECOES_PAGINACAO`. Na `main` continuam lá (27 usos da constante em `paginacao-dois-sentidos.test.ts`).
- **C2 (fila que pula registros) → tratado na #161**, que tirou 12 das 28 telas da página numerada.
- Página além do fim sem redirecionamento nas listas sem contagem.
- L431 e L1709 continuam abertos.

##### 7. Publicação
- Merge `60f14790` na `main` → **no UAT**.
- **Mexe pesado em servidor:** 41 arquivos em `src/server` (consultas e testes), entre eles SQL cru em `segunda-chamada-fila-agenda.ts` e `desistencia-administrativa-fila.ts`. Sem schema nem migration.
- Mexe em **13 `*.int.test.ts`**, que o CI não roda e ninguém rodou.

##### 8. Riscos e observações
- **É o maior risco da faixa.** 24 consultas trocaram de modelo de paginação e foram ao UAT validadas só com mocks (`consulta-paginada.ts`) e testes unitários. O SQL com `LIMIT`/`OFFSET` e o desempate pelo `id` nunca rodaram contra o Postgres real.
- A queda das conferências de escopo do cursor está certa em teoria (a página é contada no escopo de quem consulta), mas a prova disso estava justamente nos testes de integração não executados.
- Favoritos e links antigos com `?cursor=` param de funcionar e abrem a página 1, sem aviso.
- **Parte foi desfeita dois dias depois.** A #161 trocou a página numerada desta PR por cursor nos dois sentidos em 12 das 28 telas (as filas de trabalho). Para essas telas, o que está no UAT hoje é o modelo da #161.

---

#### #159 — fix(e6): fuso e instante — `CampoFuso` em todo campo de fuso, instantes no fuso de exibição, prévia de conversão (doc 43 §6, item 6)

##### 1. Identificação
- **Aberta:** 10/10 15:30 · **mergeada:** 10/10 15:44 (**14 minutos**) · base `main` · branch `claude/e6-fuso-instante`.
- **Tamanho:** 78 arquivos, +1758/−223. Merge `b59744b9`.
- **Área:** `src/components/{CampoFuso,PreviaConversao,AvisoFusoNaoConfigurado}.tsx`; 20 campos de fuso em telas de acadêmico, matrícula, configuração, diário, leads, preferências e portal do aluno; servidor `src/server/operacao/{fuso,fuso-exibicao}.ts` e `src/server/paises/schema.ts`; medição `scripts/medicao-ux/fuso.mjs` (novo); trava nova `src/app/fuso-instante.test.ts` (526 linhas).

##### 2. Objetivo declarado × o que entrou
- **20 campos de fuso** digitados à mão passam pelo `CampoFuso` (a medição antiga contava 11). O `CampoFuso` valida IANA no próprio campo (`setCustomValidity`, mesmo critério do servidor, `fusoIanaValido`), tem modo controlado, sugestões com nome ("Brasil — São Paulo") e a lista completa do `Intl`.
- **Valor inicial:** `fusoInicialDeEntrada` dá o fuso da escola, senão a preferência, senão vazio. **Nunca "UTC" presumido.**
- **`PaisSchema` (servidor):** passa a validar o fuso como IANA, com mensagens claras. Sem mudança no schema do Prisma.
- **Fallback para UTC visível:** `AvisoFusoNaoConfigurado` ("Fuso da escola não configurado; horários exibidos em UTC.").
- **Instantes crus:** os `toISOString()` na tela viram `formatarInstanteExibicao` com "(fuso; origem UTC)" (emissão, pagador, substituição, exceção de ingresso, modelos contratuais, indisponibilidade de oferta).
- **Prévia de conversão** (`PreviaConversao`): "Isso será 22/09/2026, 14:00 em America/Sao_Paulo…", com aviso na dobra do horário de verão. Aplicada no `Horario` das recuperações e no cancelamento de 2ª chamada.
- **Fora do escopo do item 6, mas incluído:** C1/C2 da revisão da #157 (comentários em `docs/18`, `tailwind.config.ts` e `contraste-mapa.ts`).
- Medição: campos de fuso fora do `CampoFuso` de **20 para 0**; instantes crus na tela de **11 para 0**; usos de `<CampoFuso` de 10 para 30.

##### 3. Rastreabilidade
- Doc 43 §6 **item 6**.
- **Alta fechados:** L729, L1126, L2429, L530, e L1540, L1590, L1786 (que a #146 tinha rebaixado a "parcial" justamente pela falta da prévia). **Parciais:** L1566, L1747, L406, L1256.
- **Média/Baixa:** L549, L1037, L1800, L2652, L2709, L2382, L907, L939.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `c406fff7` | — | **no 1º head, 5 testes falhavam**: 4 em `segunda-chamada-remarcacao-pagina.test.ts` (o teste unitário **ia ao banco**, `PrismaClientInitializationError`) e 1 em `enums-rotulos` (`replace(/_/g, " ")`). Corrigido em `c406fff7`. Suíte com a variável de conexão do banco vazia: 593/593 arquivos, 4.062 testes; 11/11 KILLED |
| R1 | `c406fff7` | **APPROVE** ("modo leve") | nenhum |

- Comentários da R1: **C1** o `.refine(fuso => fuso === "" || …)` do `PaisSchema` nunca vê `""` (o `.min(1)` vem antes), e um país gravado com fuso inválido só volta a salvar depois de corrigir o fuso; **C2** a regex de `fusoIanaValido` recusa identificadores com dígito no 1º segmento (`EST5EDT`, `CST6CDT`), que podem aparecer na lista completa do `Intl` e ser recusados ao escolher; **C3** a validade só roda no `onChange`.
- **Entrou com APPROVE**, 4 minutos depois da review.

##### 5. Testes e travas
- Novos: `fuso-instante.test.ts` (A campo de fuso, B instante na tela, C falha fechada; a trava e a medição chegam ao mesmo conjunto), `medicao-fuso.test.ts`, `CampoFuso.interacao.test.ts`, `PreviaConversao.test.ts`, `Horario.interacao.test.ts`, `cancelamento/Formulario.interacao.test.ts`, `instantes-exibicao.test.ts`, `campos-fuso.render.test.ts`, `PrepararGrade.test.ts`, `src/server/paises/schema.test.ts`.
- O integrador passou a rodar a suíte com a variável de conexão do banco vazia a partir daqui, para garantir que nenhum teste unitário toca o banco.

##### 6. Pendências e follow-ups (conferidas na `main`)
- L1566 (`min` do novo prazo da prorrogação), L1747 (fuso do encontro e `min`/`max` na realização da 2ª chamada), L406 (cada horário sai no fuso do primeiro), L1256 (`CorrecoesConclusaoReposicao`, "Horário da validação (UTC)").
- `setCustomValidity` só ao digitar: valor inicial inválido só é barrado no servidor.
- A `datalist` com todos os fusos é calculada no servidor e no navegador; se o `Intl` diferir, pode haver aviso de hidratação.
- **C1 e C2 da R1 continuam:** `src/server/paises/schema.ts:29` ainda tem `.refine((fuso) => fuso === "" || fusoIanaValido(fuso), …)` depois do `.min(1)`, e `fusoIanaValido` (`src/server/operacao/fuso.ts:9`) ainda usa `^[A-Za-z_]+…`, que recusa `EST5EDT`.
- O doc 43 e o quadro de entregas não foram atualizados.

##### 7. Publicação
- Merge `b59744b9` na `main` → **no UAT**.
- **Mexe em servidor:** `PaisSchema` passa a recusar fuso inválido. **Efeito para quem opera:** um país já gravado com fuso inválido não salva mais até alguém corrigir o fuso. Sem schema nem migration, sem `*.int.test.ts`.

##### 8. Riscos e observações
- 78 arquivos, 20 campos de fuso e uma regra de validação de servidor foram do "pronto" ao UAT em 14 minutos, com uma revisão sem mutações.
- O `CampoFuso` agora importa `@/server/operacao/fuso` e `@/server/agenda/grade` no cliente. O revisor conferiu que a cadeia só tem `zod` e módulos puros, mas é um acoplamento cliente → `src/server` que uma mudança futura nesses módulos pode quebrar (por exemplo, um import de Prisma).
- O 1º head tinha um teste unitário indo ao banco. O CI pegou (os dois jobs de teste ficaram vermelhos em `b73ae133`), e o integrador passou a rodar a suíte local com a variável de conexão do banco vazia para pegar o mesmo caso antes do CI.

---

#### #160 — fix(e7): becos sem saída e identificação do registro fora de `/matriculas/[id]` (doc 43 §6, item 7)

##### 1. Identificação
- **Aberta:** 10/10 15:37 · **mergeada:** 10/10 17:10 · base `main` · branch `claude/e7-becos-identificacao`.
- **Tamanho:** 68 arquivos, +1972/−104. Merge `19be34de`.
- **Área:** `matriculas/[id]` (secoes, fechamentos de horas, entrada-particular, desistência/financeiro, aditivos, layout), `academico/reposicoes`, segundas chamadas, `alunos/[id]` (créditos, agenda de aditivo, financeiro), `diario/reposicoes` (troca de fonte), os três acertos do Financeiro, `portal-aluno/reposicoes`; componente novo `src/components/IdentificacaoRegistro.tsx`; servidor `src/server/identificacao-registro.ts`, `src/server/diario/reposicao-busca-matricula.ts`, `src/server/avaliacoes/impactos-legiveis.ts` e ajustes em `correcao.ts`, `recuperacao-correcao.ts`, `uso-credito-proposta.ts`; `src/app/(app)/financeiro/papeis.ts` (novo); trava nova `src/app/identificacao-registro.test.ts` (638) + leitor `src/test/identificacao-registro.ts` (333).

##### 2. Objetivo declarado × o que entrou
- **Becos:**
  - aba "Fechamentos de horas" com `contextoAluno`: leva `?aluno=` e some sem aluno; a página resolve o aluno pela matrícula;
  - o link para `/financeiro` em `entrada-particular` só aparece para quem abre o painel (`PAPEIS_FINANCEIRO` + `abreFinanceiro` em `financeiro/papeis.ts`, a mesma regra do guard);
  - proposta de aditivo com links para os acertos só para quem os abre;
  - `/academico/reposicoes` ganhou busca por aluno ou código (limite de 20);
  - "Preparar agenda inicial" só onde a prévia pode seguir; nos outros casos, o motivo;
  - formulários que sumiam (2ª chamada com matrícula não ativa, relato no portal) passam a dizer por quê.
- **Identificação:** `IdentificacaoRegistro` (generalização do `IdentificacaoAvaliacao`) em créditos, agenda de aditivo, troca de fonte e nos três acertos do Financeiro. IDs crus viraram texto ("Solicitação {id}" → "Mudança para a turma {código}"; cobrança como tipo · vencimento · valor; `codigo ?? id` → "sem código").
- **Trava:** regra 1, nenhuma tela imprime id cru (com **teto de 66 pendentes**, que só pode diminuir); regra 2, tela de detalhe identifica o registro (**teto de 12 pendentes**).

##### 3. Rastreabilidade
- Doc 43 §6 **item 7**.
- **Becos fechados:** L577, L691, L905, L1244, L1670, L1722, L2676. **Identificação:** L268, L269 (parcial), L279, L798, L1399, L1492, L1989.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `a51d4e1e` | — | **1 teste falhava** (mock do guard sem `papeis` em `historicos-fuso.test.ts`); corrigido; 591/591 arquivos, 4.057 testes; 12/12 KILLED |
| R1 | `8b144fb7` | REQUEST CHANGES | **B1** CI vermelho (o mesmo `historicos-fuso.test.ts`); **B2** conflito de conteúdo com a #159 em `fechamentos-horas/page.tsx` e `page.test.ts` |
| R2 | `0c487a3b` | **APPROVE** | nenhum |

- **Resolução:** B1 → `a51d4e1e`; B2 → `0c487a3b` (merge da `main` com a #159, mantendo o fallback do aluno e o `fusoInicial`). Depois da R2, entrou mais um commit, `f50608f5`: o merge da `main` com a #158, que deixou solta uma exceção da trava em `grades/nova/page.tsx` e a reancorou. Esse último commit teve só a verificação do integrador (609/609 arquivos, 4.208 testes), não uma revisão.
- **Entrou com APPROVE** escrito na R2.

##### 5. Testes e travas
- Novos: `academico/reposicoes/page.test.ts`, `pendentes-agenda/preparo.test.ts` (num arquivo à parte, para valer antes e depois da #158), `agenda-aditivo/page.test.ts`, `creditos/[creditoId]/page.test.ts`, `correcoes/[lancamentoId]/[propostaId]/page.test.ts`, `entrada-particular/page.test.ts`, `portal-aluno/reposicoes/[id]/relato.test.ts`, e a trava com autotestes I1–I10 e J1–J4.

##### 6. Pendências e follow-ups (conferidas na `main`)
- **66 IDs crus pendentes** (movimentações do aluno, memórias de `/matriculas/[id]`, migração, listas de acertos de cobertura/taxa, histórico de recebimentos, remarcação de 2ª chamada). O teto continua 66 em `identificacao-registro.test.ts:378`.
- **12 telas de detalhe sem identificação** (encontros do diário ×4, resoluções de reserva ×2, avaliações, replanejamento, correções de reposição, movimentações, equivalência). Teto 12 em `:421`.
- **`emissao/page.tsx` continua com o link morto para `/financeiro`** (mesmo caso da L577, que a própria PR registrou e não tocou por estar na PR do item 6): na `main`, `matriculas/[id]/emissao/page.tsx:23` tem `<Link className="underline" href="/financeiro">Abrir Financeiro</Link>` sem `abreFinanceiro`. Quem não abre o Financeiro, como a Secretaria, vê o link e cai em acesso negado.
- Não feitos: L934 (link para compensação), L1709 (busca na fila de agendas) e a data nos impactos de correção.

##### 7. Publicação
- Merge `19be34de` na `main` → **no UAT**.
- **Mexe em servidor:** consultas novas só de leitura (`identificacao-registro.ts`, `reposicao-busca-matricula.ts`, `impactos-legiveis.ts`). Sem schema, migration nem `*.int.test.ts`.
- **Observação do revisor:** `buscarMatriculasParaReposicao` não aplica escopo de carteira. É coerente com os papéis da página (Secretaria, Gestão Pedagógica, Administração), mas é uma busca nova de alunos sem recorte.

##### 8. Riscos e observações
- Esta PR, a #158 e a #159 foram desenvolvidas em paralelo e se cruzaram em `fechamentos-horas`, `pendentes-agenda` e `grades/nova`. A ordem foi resolvida no merge (#159 → #158 → #160 → #161), com reancoragem de exceção.
- `impactosLegiveisTx` não entra no hash da decisão, então a decisão continua presa ao mesmo recorte. O revisor conferiu isso.

---

#### #161 — feat(e4): filas de trabalho por cursor nos dois sentidos

##### 1. Identificação
- **Aberta:** 10/10 17:04 · **mergeada:** 10/10 17:18 (**14 minutos**) · base `main` · branch `claude/e4-filas-cursor`. É a ponta atual da `main` (`e5418550`).
- **Tamanho:** 61 arquivos, +1823/−686.
- **Área:** 12 telas de fila (`/academico`, `/academico/grades`, recuperações designadas, pendentes de agenda, exceções de gravação, pendências do diário, regularizações, continuidade, desistências financeiras e da secretaria, avisos de agenda, envios do portal); `src/lib/cursor-fila.ts` e `src/components/PaginacaoFila.tsx` (novos); **11 consultas de servidor** (`academico/consultas.ts` +112/−68, SQL cru em `segunda-chamada-fila-agenda.ts` e `desistencia-administrativa-fila.ts`); trava `paginacao-dois-sentidos.test.ts` (+257); **8 `*.int.test.ts`**.

##### 2. Objetivo declarado × o que entrou
- Follow-up do C2 da #158, "pela decisão de 10/10/2026": em **fila de trabalho**, a página numerada pula registros. Regra: é fila se o item sai da lista quando alguém age nele; na dúvida, também é fila.
- **12 filas** voltam para cursor, agora nos dois sentidos (`antes`/`depois`); **16 listas e históricos** continuam numerados. Uma escolha **diverge do pedido**: `autorizacoes-preparacao` ficou como histórico (o corpo explica por quê).
- `cursor-fila.ts`: `lerNavegacao`, validação do cursor (`^[A-Za-z0-9_-]{1,100}$`, `antes` e `depois` juntos é erro), leitura invertida ao voltar, releitura do início ao chegar no começo. Ordem composta com corte `(campo < a) OR (campo = a AND id < a.id)`, âncora lida no escopo de quem consulta mas sem o filtro da fila. Nenhuma consulta de fila usa `skip`/`OFFSET`.
- Cursor que não leva a nada mostra "Nenhum … a partir deste ponto da fila" com "Ir para o início da fila" (link, não redirect).
- Medição: arquivos com `<Paginacao` caem de 35 para 24 (as filas usam `<PaginacaoFila>`).
- **O autor ensaiou fora do repositório**, com um vitest mínimo numa pasta temporária e o `@prisma/client` defasado do checkout principal ("milhares de erros de modelo ausente"). O próprio corpo diz: "Isso é ensaio, não aprovação."

##### 3. Rastreabilidade
- Doc 43 §6 **item 4** (continuação) e C2 da R1 da #158.

##### 4. Revisão
| Rodada | Head | Veredito | Blockers |
|---|---|---|---|
| Integrador | `8c697968` | — | 604/604 arquivos, 4.194 testes (a variável de conexão do banco vazia); 15/15 KILLED + controle. "**Não rodados:** os 8 `*.int.test.ts` alterados" |
| R1 | `8c697968` | **APPROVE** ("review leve") | nenhum. Registrada 7 minutos depois da abertura |
| R2 | `0e1e8538` | **APPROVE** ("review leve") | nenhum. Delta = merge da `main` com a #160; o revisor recriou o merge automático e a árvore bate |

- Comentários: **C1** o subselect da âncora em `segunda-chamada-fila-agenda.ts` não aplica escopo (hoje a fila é administrativa e não vaza nada); **C2** os 8 `*.int.test.ts` não rodaram, "vale rodá-los com o perfil isolado antes do merge" — continuou OPEN na R2; C3 conflito com a #160 (não apareceu); C4 quadro de entregas.
- **Entrou com APPROVE e sem os testes de integração.** O comentário de merge diz: "Mergeada com o CI verde no head `0e1e8538`, por decisão do usuário. Os testes de integração alterados aqui e na #158 ainda não rodaram; a pendência ficou registrada na #162."

##### 5. Testes e travas
- Novos: `src/server/filas-cursor.test.ts` (314 linhas, mock do Prisma, 11 consultas e 12 filas: ida e volta, "resolver o 3º item e a própria âncora não faz o Próxima pular ninguém", ordem terminando no id, nenhum `skip`/`OFFSET`, cursor inválido recusado), `src/lib/cursor-fila.test.ts`, `PaginacaoFila.test.ts`; `src/test/consulta-paginada.ts` ganhou `findManyComOnde`.
- Trava: regra 3 nova (`FILAS` × `MIGRADAS`, somando 28; a tela de fila não pode ter nada de página numerada e tem de mostrar `<PaginacaoFila>`; a consulta tem de chamar `lerPaginaDaFila`). Limite declarado: helpers locais chamados pela consulta não são seguidos.

##### 6. Pendências e follow-ups
- **#162 (aberta):** os 8 `*.int.test.ts` desta PR estão entre os 13 da issue: `segunda-chamada-agenda-inicial`, `avisos-diario`, `desistencia-administrativa-fila`, `continuidade-fila`, `regularizacao-designacao`, `diario`, `lancamentos` e `comunicacoes-agenda/consultas`.
- **C1 (âncora sem escopo)**, registrado também na #162. O arquivo não mudou depois.
- Decisões de produto em aberto: `autorizacoes-preparacao` como histórico; link no vazio em vez de redirect.
- Quadro de entregas não atualizado.

##### 7. Publicação
- Merge `e5418550` = ponta da `main` → **no UAT**.
- **Mexe pesado em servidor** (24 arquivos em `src/server`, entre consultas e testes, inclusive SQL cru com comparação de linha `(p."criadaEm",p.id) < (SELECT …)`) e em **8 `*.int.test.ts`** não executados.

##### 8. Riscos e observações
- **Mesmo risco da #158, concentrado nas filas.** A ordem composta com âncora, a comparação de linha no Postgres e a ordem invertida no `antes` só foram testadas contra mock. O mock aplica o `where` (`atende`), mas não reproduz o SQL cru: para ele, o teste confere o operador `>`/`<` contra o `ORDER BY` lido do texto.
- O tempo de 14 minutos entre abrir e mergear, numa PR que reescreve 11 consultas, mostra que a "verificação" foi a do integrador (suíte unitária + mutações) e uma leitura do revisor.
- A #158 e a #161, somadas, mudaram três vezes o modelo de navegação das 12 filas: cursor só para frente → página numerada (08–10/10) → cursor nos dois sentidos (10/10). Como a tela de fila lê só `antes`/`depois` (`lerNavegacao`), um link salvo com `?pagina=` dessas filas deve abrir o início da fila.

---

#### Issues da faixa

##### #152 — Follow-up #143: trava `guard-pagina` — fechar B7, B8 e B9 da R3
- **Aberta** em 07/10 18:04, no momento do merge da #143. **Continua aberta**, sem comentários.
- Conteúdo: B7 (caso próprio para `import()`/`require` de `@/server/_shared`, com acesso por string), B8 (E14 `redirect` por `import("next/navigation")`; E15 `{ papeis: p } = sessao` + `return null`), B9 (T13 `while`, T14 `switch`, T15 `||`/`??`). Critério de pronto: cada mutação e evasão morre com autoteste, e um controle sobrevive. Lembra também os comentários C2 e C3 da #143.
- Situação no código: `src/test/guard-pagina.ts` não mudou desde `851ba76e`. Não há PR para ela.

##### #162 — Rodar os testes de integração alterados pelas #158 e #161
- **Aberta** em 10/10 17:17, logo antes do merge da #161. **Continua aberta**, sem comentários.
- Lista 13 arquivos (8 alterados pelas duas PRs), o passo a passo do AGENTS.md (cluster compartilhado coordenado, `.erp-test-profile` com banco da lista fechada, nunca o de produção, uma suíte por banco) e o que observar: ida e volta do cursor, `antes`/`depois`, cursor inválido, "resolver um item da página 1 não faz a próxima pular ninguém" contra o Postgres real (inclusive o SQL cru), ordem estável com desempate pelo id, e o C1 da #161 (âncora sem escopo).
- Situação: nenhum registro de execução. O código das duas PRs já está no UAT.

---

#### Observações transversais

1. **A régua de revisão mudou no meio da faixa.**
   - **#143 a #153:** três rodadas com dezenas de mutações e evasões por rodada. Qualquer mutação não equivalente que sobrevivesse à suíte padrão era blocker. Nenhuma dessas PRs teve APPROVE, exceto a #146 (R2) e a #151 (R3). As outras entraram pela regra pós-R3, ou, no caso da #143, por decisão do usuário com issue (#152).
   - **A partir da R3 da #154:** "modo leve" (CI verde, leitura do diff e do fluxo, sem mutação do revisor). Evasões de trava deixam de bloquear ("No modo atual isso não bloqueia"), e o APPROVE passa a sair na R1 ou R2 (#155–#161).
   - Na 3ª leva, as mutações ficaram só com o integrador (11 a 21 por PR, todas KILLED).
2. **Tempo entre abrir e mergear na 3ª leva.** #156 em 8 min, #157 em 11 min, #159 em 14 min (78 arquivos), #161 em 14 min (61 arquivos e 11 consultas). A exceção é a #158, que ficou dois dias parada antes da R1.
3. **O autor nunca roda testes** (worktree sem `node_modules`, por regra do AGENTS.md). O integrador achou o head entregue quebrado em quase todas as PRs com código:
   - #145: 8 erros de lint; validações sem teste;
   - #147: tsc com 2 erros na R1 e 4 na R2;
   - #148: 2 testes falhando;
   - #150: 1 teste falhando (3 achados do checker);
   - #153: 10 testes falhando;
   - #154: 3 testes falhando;
   - #155: tsc com 2 erros e 3 testes falhando;
   - #158: tsc com 1 erro e 1 teste falhando;
   - #159: 5 testes falhando (um ia ao banco);
   - #160: 1 teste falhando.

   Em todos os casos o integrador corrigiu antes do merge, e o merge saiu com tsc 0 e suíte verde.
4. **Testes de integração.** O CI exclui `*.int.test.ts` (`vitest.config.ts:12`). As #151, #158 e #161 mexeram em integração sem rodar. Para #158 e #161, é a issue **#162**, aberta.
5. **Quadro de entregas.** Nenhuma das 18 PRs atualizou `docs/planejamento/quadro-entregas.md`. O último commit no arquivo é `f40065ce`, de 29/09. Várias PRs dizem "fica para o integrador". O AGENTS.md pede "commit por funcionalidade, com evidências e pendências no quadro único".
6. **O doc 43 não foi re-medido.** A §6 na `main` ainda lista como abertos os itens 1–7, tratados nas #153–#161, e os números são de `6b105093`. O item 11 (repetir a amostra Média/Baixa) e a 7.7 (métricas de fluxo com operador) não foram feitos.
7. **As travas cresceram muito.** Só nesta faixa entraram ou foram reescritas: `guard-pagina`, `campos`, `vazio-paginado`, `botoes`, `colunas-ordenaveis`, `enums-rotulos`, `feedback-separado` (~2.000 linhas), `confirmacoes`, `formularios-preservados`, `contraste`, `paginacao-dois-sentidos`, `fuso-instante` e `identificacao-registro`. Elas dependem umas das outras: a #147 quebrou com um helper da #143; a #149 com o render-prop da #145; a #154 com o texto "nesta página" da trava da #147; a #155 com a trava de `window.confirm` da #154. E dependem do `testTimeout` global de 30 s.

---

#### Tabela-resumo da faixa

| PR | Título curto | Área | Rodadas (vereditos) | Veredito final | Publicado (na `main`/UAT) | Pendências abertas |
|---|---|---|---|---|---|---|
| #143 | Abas de área em `/academico` e `/diario` | navegação (E2/E6) | R1 RC · R2 RC (+B6) · R3 RC | merge sem APPROVE, decisão do usuário | sim (`f504a359`) | **#152** (B7–B9); C2, C3 (14/16 abas a 375 px), C5 (leitor textual da matrícula) |
| #144 | Fila de cobrança na URL e busca em `/comissoes` | financeiro (E4) | R1 RC · R2 RC · R3 RC | regra pós-R3 (conserto aplicado pelo integrador) | sim (`b64e1a7a`) | fila sem `take`; busca por aluno em `/comissoes` |
| #145 | `Campo` único | formulários (E1/E7) | R1 RC · R2 RC · R3 RC | regra pós-R3 | sim (`4f6aad16`) | migrar as demais áreas (só 2 telas usam `Campo`); achados #3 e #6 |
| #146 | Doc 43 (medição) | docs e scripts | R1 RC · R2 **APPROVE** | APPROVE | sim (`d20bda06`) | re-medição; 7.7 sem medir; amostra com outra semente |
| #147 | Trava do vazio paginado (#139) | trava | R1 RC · R2 RC · R3 RC | regra pós-R3 | sim (`23b54768`) | — (#139 fechada) |
| #148 | Trava de botões (#140) | trava | R1 RC · R2 RC · R3 RC | regra pós-R3 (conserto aplicado pelo integrador) | sim (`ebe4109c`) | — (#140 fechada) |
| #149 | Trava de `aria-sort` (B9 do #141) | trava | R1 RC · R2 RC · R3 RC | regra pós-R3 | sim (`cf82be2c`) | **#141** aberta (B2, collation); parâmetro reatribuído/alias sem issue |
| #150 | Trava de enum cru com checker (#142) | trava + labels + cron WhatsApp | R1 RC · R2 RC | **sem R3 e sem APPROVE**, sem nota de merge | sim (`5b418b11`) | C7, C8, C9 (da #138) |
| #151 | CI (GitHub Actions) | infra | R1 RC · R2 RC · R3 **APPROVE** | APPROVE | sim (`c3685565`) | `--max-warnings`; `any` liberado em testes; timeout global; `ErroRegra` em `aditivo-cobertura`; CI sem integração |
| #153 | Erro e sucesso separados (item 2) | 56 formulários | R1 RC · R2 RC · R3 RC | regra pós-R3 | sim (`0dc4d092`) | C3 (`useReducer`, texto fora dos prefixos) |
| #154 | `ConfirmarAcao`, fatia A (item 1) | financeiro, WhatsApp, B2B | R1 RC · R2 RC · R3 **APPROVE** (leve) | APPROVE | sim (`14dd30b7`) | **fatia B**; `enviarLote` sem `try/catch`; alcance numérico |
| #155 | Não perder o digitado (item 3) | ~15 telas + `beforeunload` | R1 RC (leve) · R2 **APPROVE** | APPROVE | sim (`c1b3a62c`) | 22 exceções (17 keys com versão); L1059/L2367 |
| #156 | Contraste: seleção e `--border-control` (item 5) | design system | R1 **APPROVE** (leve) | APPROVE | sim (`fbada6a2`) | `#fff/--brand` na conta; `--border`/`--brand-border` |
| #157 | `--brand-solid` do escuro | design system | R1 **APPROVE** (leve) | APPROVE | sim (`c107da32`) | — (C1/C2 resolvidos na #159) |
| #158 | Paginação nos dois sentidos (item 4) | 28 telas + 24 consultas | R1 **APPROVE** · R2 **APPROVE** (leve) | APPROVE, **sem integração** | sim (`60f14790`) | **#162**; 26 telas (27 links) pendentes; L431, L1709 |
| #159 | Fuso e instante (item 6) | 20 campos + `PaisSchema` | R1 **APPROVE** (leve) | APPROVE | sim (`b59744b9`) | L1566, L1747, L406, L1256; regex recusa `EST5EDT`; validade inicial |
| #160 | Becos e identificação (item 7) | 68 arquivos (matrícula, acadêmico, alunos, diário, financeiro, portal) + leituras novas | R1 RC · R2 **APPROVE** | APPROVE | sim (`19be34de`) | 66 ids crus; 12 telas; link morto em `emissao`; L934, L1709 |
| #161 | Filas por cursor nos dois sentidos | 12 filas + 11 consultas | R1 **APPROVE** · R2 **APPROVE** (leve) | APPROVE, **sem integração** | sim (`e5418550`, ponta da `main`) | **#162**; âncora sem escopo (C1) |

RC = REQUEST CHANGES. Todas as reviews estão como `COMMENTED` no GitHub (mesma conta de autor e revisor); o veredito é o escrito no texto.

---

#### Pendências que continuam abertas hoje (conferidas em `origin/main` = `e5418550`)

##### Issues abertas
1. **#162 — os 13 `*.int.test.ts` das #158 e #161 nunca rodaram.** Na `main`, `vitest.config.ts:12` exclui `src/**/*.int.test.ts`, e `ci.yml` só roda `npm test`. São 24 consultas (#158) e depois 11 filas (#161) com `skip`/`take`, `LIMIT`/`OFFSET`, cursor composto e SQL cru, validadas só por mock. **É a pendência de maior risco**, porque o código já está no UAT.
2. **#152 — buracos B7, B8 e B9 da trava `guard-pagina`** (#143). `src/test/guard-pagina.ts` não mudou desde `851ba76e`. Hoje não há risco nas páginas (as 23 estão corretas), só na trava.
3. **#141 — B2: ordenação com acento no Postgres (collation).** A #149 fechou só o B9. Depende de schema e infra.

##### Pendências sem issue, ainda válidas no código
4. **`ConfirmarAcao` — fatia B (#154):** encerrar país, "Faltou" no check-in, inbox (vincular contato e opt-out), replanejamento, quantidade de aulas, presença histórica, desativar usuário/preço/idioma e inativar empresa. Na `main`, `ConfirmarAcao` só aparece nas 10 telas da fatia A.
5. **`enviarLote` sem `try/catch`** (`FilaCobranca.tsx`): uma falha de transporte deixa `enviandoLote` preso em `true` (C2 da R3 da #154, anterior à PR).
6. **Link morto para `/financeiro` em `matriculas/[id]/emissao/page.tsx:23`**, sem `abreFinanceiro` (o mesmo beco que a #160 fechou em `entrada-particular`).
7. **Paginação — 26 telas (27 links) só para frente** em versões e históricos: 27 usos de `PENDENCIA` em `paginacao-dois-sentidos.test.ts` (#158). Também abertos L431 (filtro de situação em envios do portal) e L1709 (busca e filtro de data nas agendas de 2ª chamada).
8. **Âncora sem escopo** em `segunda-chamada-fila-agenda.ts` (C1 da #161). Inofensivo enquanto a fila for administrativa.
9. **Não perder o digitado — 22 exceções** em `formularios-preservados.test.ts` (17 `VERSAO_PENDENTE`, keys com versão fora do recorte), mais L1059/L2367 (diálogo na navegação interna e rascunho em `localStorage`) (#155).
10. **Identificação — 66 ids crus e 12 telas de detalhe** sem identificação, com teto em `identificacao-registro.test.ts:378` e `:421` (#160). Também L934 e a data nos impactos de correção.
11. **Fuso (#159):** L1566, L1747, L406 e L1256; `fusoIanaValido` (`src/server/operacao/fuso.ts:9`) recusa identificadores como `EST5EDT`, que a lista do `Intl` pode oferecer; o `.refine` do `PaisSchema` (`src/server/paises/schema.ts:29`) tem o ramo `fuso === ""` morto; a validade não roda no valor inicial.
12. **`Campo` único em só 2 telas** (`FichaAluno.tsx` e `MatriculaFormulario.tsx`). A maior parte das 631 ocorrências de `required` medidas no doc 43 está em áreas não migradas, sem `aria-invalid` ligado (o corpo da #145 lista ~545 só nas 8 áreas seguintes). A justificativa sem tabela de preço continua validada só no servidor.
13. **Fila de cobrança sem `take`**: `listarFilaCobranca` (`src/server/cobrancas/consultas.ts:202`) faz `findMany` sem limite. Também falta busca por aluno em `/comissoes` (#144).
14. **Contraste:** `--border` e `--brand-border` seguem reprovando (1,25–1,56:1), e a família `#fff/--brand` continua contada por token em `paresReprovados` (#156).
15. **Abas de área (#143):** 14/16 abas quebram em várias linhas a 375 px (`SubTabs.tsx:21`, `flex-wrap`); o `ariaLabel` padrão continua "Sub-navegação"; `matriculas/[id]/secoes.test.ts` ainda lê o guard por regex textual (lê comentário).
16. **CI (#151):** sem `--max-warnings` (`ci.yml:61`); `no-explicit-any` desligada em todos os testes; `testTimeout: 30_000` global (`vitest.config.ts:15`); a troca do `TypeError` por `ErroRegra` em `aditivo-cobertura.ts:84` (ainda `.find(...)!.fotografiaHash`) prometida "para uma PR com teste".
17. **Travas — follow-ups sem issue:** C7, C8 e C9 da #138 (#150); parâmetro reatribuído e alias de objeto na trava de `aria-sort` (#149); `useReducer` e texto de erro fora da lista de prefixos na trava de feedback (#153).
18. **Doc 43 e quadro de entregas:** o doc 43 não foi re-medido (a §6 descreve como abertos itens já tratados; faltam a 7.7 e a nova amostra), e `docs/planejamento/quadro-entregas.md` não recebeu nenhuma das 18 PRs (último commit em 29/09).

##### Resolvidas depois, dentro da própria faixa
- Exceções `PR_PARALELA` da #153 → migradas na #154 (`2576cdf5`).
- C1 da #156 (seleção pouco destacada no escuro) → #157.
- C1/C2 da #157 (comentários de hover e "não inverte") → #159 (`b73ae133`).
- C2 da #158 (fila que pula registros) → #161, que tirou 12 telas da página numerada.
- B8 da #149 (73 achados com o `Campo` da #145) → `c814bd46` + `3fc690b5`, antes do merge.
- Issues #139, #140 e #142 → fechadas pelas #147, #148 e #150.
