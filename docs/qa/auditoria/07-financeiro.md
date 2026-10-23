# Auditoria 07: Financeiro

> Base: branch `qa/auditoria-e-onboarding` (= `main` em `3ec8de3a` + kit de QA), lida em 21/10/2026.
> Método: somente leitura do código e dos documentos. Nenhum teste foi executado nesta auditoria;
> "Conforme" significa que o código lido implementa a regra, não que ela foi homologada.
> Precedência usada: SPEC-ERP-001 (§6, §7) > doc 37 (§4–§6, §8) > doc 41 / quadro de entregas >
> docs 24, 25, 10 e 09 (especificação original, parcialmente obsoleta). Regra: especificação não comprova implementação.
> Caminhos de código são relativos à raiz do repositório. "não encontrado" = procurado e ausente.

Legenda de status: **Conforme** · **Parcial** · **Divergente** (o código difere da fonte indicada) ·
**Não implementado** · **Desligado** (existe, mas está desativado por código ou configuração) ·
**Bug provável** (a leitura indica falha; confirmar em UAT).

## Resumo

Contagem da tabela de achados (43 itens):

| Status | Qtde |
|---|---|
| Conforme | 19 |
| Parcial | 8 |
| Divergente | 6 |
| Não implementado | 5 |
| Desligado | 3 |
| Bug provável | 2 |

Os 5 achados mais importantes para o UAT:

1. **O gateway simulado não funciona em UAT, mesmo com `PAGAMENTO_SIMULADO=1`** (achados 1–3).
   `pagamentoSimuladoHabilitado()` devolve `false` fixo (`src/server/financeiro/gateway.ts:42-45`), o
   webhook responde 404 (`src/app/api/pagamentos/webhook/simulado/route.ts:13-15`), a baixa sem autor é
   recusada (`src/server/financeiro/baixa.ts:26`) e nenhuma tela gera o link `/pagar/<token>`
   (`gerarLinkPagamentoGateway`, em `src/server/matricula/acoes.ts:843`, não tem chamador). O quadro de entregas
   registra que a "conciliação do gateway simulado" não está liberada (`docs/planejamento/quadro-entregas.md:366`).
   **No UAT, "pagar" = Secretaria informa e Financeiro confere, ou Financeiro registra o recebimento.**
   No `/pagar`, o QA consegue testar só as mensagens de link inválido e de link expirado.
2. **O Gerente Comercial provavelmente vê erro ao abrir `/financeiro`** (achado 25). A aba padrão dele é
   Comissões (`src/app/(app)/financeiro/abas.ts:46`), e essa página chama `carregarConfigFinanceiro()`, que
   exige o papel FINANCEIRO (`src/server/financeiro/consultas.ts:318-319`). O teste da página usa mock dessa
   função (`src/app/(app)/financeiro/(painel)/page.test.ts:31`), por isso o erro não aparece nos testes.
3. **As alçadas de desconto ficam vazias no banco de UAT, então todo desconto vai para aprovação** (achados 13–14).
   Os seeds gravam só o campo legado `limiteDescontoPct` (`prisma/seed-qa.ts:45-92`, `prisma/seed.ts:14-51`),
   mas o código lê `limiteDescontoTaxaPct` e `limiteDescontoMensalidadePct` (`src/server/financeiro/politica.ts:5-16`).
   A cópia de um campo para o outro só aconteceu na migração (`prisma/migrations/20260907010000_politica_acesso_recebimentos/migration.sql:274-276`).
   O Financeiro também não tem autonomia (não há exceção por papel) e não aprova desconto. Isso contradiz o kit
   `docs/qa/02-usuarios-e-papeis.md` §2.
4. **Não existe estorno de recebimento nem desconto de comissão já paga** (achados 8 e 23). Um recebimento
   confirmado não pode ser corrigido pela interface. O estorno de comissão é manual e vale só para comissões
   Pendentes ou Aprovadas (`src/server/crm/comissoes-estorno.ts:32-34`). O estorno automático por cancelamento
   em até 30 dias (doc 10 §3) não foi encontrado.
5. **A emissão da continuidade mensal e a régua automática estão desligadas, e o status ATRASADO não é gravado
   por nenhuma rotina** (achados 10, 32 e 34). A emissão depende de `CONTINUIDADE_MENSAL_EMISSAO_ENABLED=true` e
   de um agendador externo (`src/app/api/financeiro/continuidade/cron/route.ts:5-9`, `docker-compose.prod.yml:88-90`).
   A política da régua nasce DESLIGADA (`src/server/cobrancas/politica.ts:42`). O atraso é calculado na leitura,
   mas a página `/pagar` usa o status gravado (`src/app/pagar/[token]/quadro.ts:68`).

## Ciclo da cobrança e do pagamento como está no código

| # | Passo | Tela / rota | Papel (guard real) | Efeito | Arquivo:linha |
|---|---|---|---|---|---|
| 0 | Pré-requisito: política de comissão da oferta (país × produto) | `/financeiro/politicas` | ADM, ou FIN/GC com a permissão `comissao.configurar` | Sem uma política vigente única, criar ou ativar matrícula falha com "Configure a política de comissão desta oferta antes de matricular." | `src/server/financeiro/acoes.ts:183-186`; `src/server/financeiro/politica.ts:18-24` |
| 1a | Emissão na criação da matrícula (fluxo antigo) | `/matriculas/nova` | VEN, GC, SEC (página); ação `criarMatricula` | Cria a taxa (MATRICULA), a 1ª mensalidade (com cobertura) e, na Costa Rica, o certificado; cria a comissão PENDENTE; preço acima da alçada abre uma Aprovação e usa o preço de referência até a decisão | `src/server/matricula/acoes.ts:304-391` |
| 1b | Emissão na ativação pela preparação comercial (fluxo da SPEC) | Secretaria / ativação | SEC/FIN/ADM (fluxo da área 04) | `emitirEntradaTx`; a comissão nasce APROVADA, com memória do cálculo | `src/server/matricula/ativacao-preparacao-tx.ts:91-94`; `src/server/matricula/emissao-entrada-tx.ts:15,66` |
| 1c | Emissão da continuidade mensal | `/financeiro/continuidade` (só leitura) + `POST /api/financeiro/continuidade/cron` | Rota máquina a máquina (`x-cron-secret`) | Gera a próxima mensalidade com memória; **desligada por padrão** | `src/app/api/financeiro/continuidade/cron/route.ts:5-9`; `src/server/matricula/continuidade-emissao-cron.ts:6-20` |
| 1d | Emissão do fechamento de horas (particular por hora) | `/matriculas/[id]/fechamentos-horas` | FIN | Prepara, decide e emite a cobrança das horas | `src/app/(app)/matriculas/[id]/fechamentos-horas/page.tsx:36`; `src/server/matricula/fechamento-horas-emissao-tx.ts:9,25` |
| 2 | Fila de trabalho (régua) | `/financeiro/cobrancas` | ADM, FIN (operam); GC não vê a aba | Cartões A vencer · Em atraso · Bloquear · Promessas · Recebido hoje; degrau devido por cobrança, calculado na leitura | `src/app/(app)/financeiro/(painel)/cobrancas/page.tsx:17-49`; `src/server/cobrancas/consultas.ts:252`; `src/server/cobrancas/regua.ts:22-29` |
| 3 | Envio manual da cobrança | Detalhe da fila: "Abrir WhatsApp" e depois "Confirmar envio" | FIN/SEC/ADM no servidor (SEC não abre `/financeiro`) | Preparar não grava nada e não usa o telefone de outra pessoa; confirmar grava `CobrancaEnviadaWhatsApp {passo, ciclo}` | `src/server/financeiro/cobranca-manual.ts:26-53`; `src/server/financeiro/acoes.ts:212-249` |
| 4 | "Link de pagamento" | Funil › painel da oportunidade (taxa) | VEN (só na taxa) e os demais `PAPEIS_FECHAMENTO` | `registrarLinkPagamento` guarda o texto colado e `linkEnviadoEm`; **não** gera `gatewayRef` nem `/pagar` | `src/app/(app)/funil/PainelOportunidade.tsx:212-220`; `src/server/matricula/acoes.ts:801-835` |
| 4b | Link pelo gateway | não encontrado na interface | — | `gerarLinkPagamentoGateway` grava `gatewayRef` e o link `/pagar/<token>`, mas nenhuma tela chama a função | `src/server/matricula/acoes.ts:843-893` |
| 5 | Pagamento pelo cliente | `/pagar/[token]` (pública) | Qualquer pessoa com o link | Mostra o quadro da cobrança; o botão nunca aparece porque a flag é `false` | `src/app/pagar/[token]/page.tsx:27-55`; `src/server/financeiro/gateway.ts:42-45` |
| 5b | Webhook simulado | `POST /api/pagamentos/webhook/simulado` | Público (token) | Responde 404 "Pagamento simulado desabilitado."; com a flag ligada, a baixa ainda seria recusada | `src/app/api/pagamentos/webhook/simulado/route.ts:13-15`; `src/server/financeiro/baixa.ts:26,36` |
| 6 | Informe de pagamento | Ficha financeira do aluno › "Informar pagamento" | SEC (sem FIN e sem `pagamento.caixa`) | Cria `PagamentoInformado` A_CONFERIR; não mexe em saldo nem status; suspende lembretes por `prazoConferenciaHoras` (padrão 48 h) | `src/app/(app)/alunos/[id]/financeiro/page.tsx:130-131`; `src/server/financeiro/acoes.ts:85-106` |
| 7 | Conferência do informe | `/financeiro/informes` ("A conferir") e ficha | FIN/ADM, **outra pessoa** | Confirmar cria o Recebimento e baixa a cobrança; Rejeitar exige motivo e não movimenta saldo | `src/server/financeiro/acoes.ts:130-170`; `src/server/financeiro/regras.ts:35-39`; `src/app/(app)/financeiro/InformesPagamento.tsx:57-60` |
| 8 | Recebimento direto (caixa) | Ficha › "Registrar recebimento" | FIN, ADM ou quem tem `pagamento.caixa` | Recebimento + destinação para a cobrança; valor acima do saldo exige marcar o excedente, que vira crédito | `src/server/financeiro/acoes.ts:75-83`; `src/server/financeiro/recebimentos.ts:103-129` |
| 8b | Recebimento com várias destinações | `/financeiro/recebimentos` | FIN/ADM | Um fato de caixa repartido entre cobranças do mesmo contrato e/ou crédito sem destino; a soma tem de ser exata | `src/server/financeiro/acoes.ts:115-127`; `src/server/financeiro/recebimentos.ts:30-100` |
| 9 | Status após o recebimento | — | — | Saldo zero → PAGO com `pagoEm`; parcial → PENDENTE ou ATRASADO pelo dia civil da escola | `src/server/financeiro/recebimentos.ts:89-97`; `src/server/financeiro/regras.ts:16-18` |
| 10 | Recálculo do acesso às aulas | Automático, após o commit | — | Reavalia a restrição D+30 da matrícula | `src/server/financeiro/acoes.ts:59-66`; `src/server/cobrancas/acesso-aulas.ts:49-53` |
| 11 | Promessa de pagamento | Detalhe da fila | FIN/SEC/ADM | Evento `PromessaPagamento`; a cobrança fica dormente até a data; o vencimento não muda | `src/server/cobrancas/acoes.ts:43-79` |
| 12 | Desconto / renegociação | Ficha (FIN) ou resumo comercial (VEN/GC) | VEN, GC, FIN, ADM | Aplica direto dentro da alçada ou abre uma Aprovação | `src/server/ajustes/acoes.ts:93-153` |
| 13 | Estorno de recebimento | não encontrado | — | Não há ação; os guards SQL impedem editar o fato original (Q87) | `docs/planejamento/q87-destinacoes-recebimento.md` (guards) |

## Máquinas de estado

**Cobrança** (`StatusCobranca`, `prisma/schema.prisma:1964-1969`)

| De | Para | Gatilho | Arquivo:linha |
|---|---|---|---|
| (nova) | PENDENTE, ou ATRASADO se o vencimento já passou na emissão | Emissão | `src/server/matricula/acoes.ts:304`; `src/server/matricula/emissao-entrada-tx.ts:66` |
| PENDENTE/ATRASADO | PAGO | Recebimento, crédito ou permuta zera o saldo | `src/server/financeiro/recebimentos.ts:94-96`; `src/server/ajustes/acoes.ts:63` |
| PENDENTE/ATRASADO | PENDENTE/ATRASADO | Recebimento parcial, desconto ou reprogramação; `versao` +1 e `cicloRegua` +1 quando o vencimento muda | `src/server/financeiro/recebimentos.ts:96`; `src/server/retomada/acoes.ts:108-112` |
| PENDENTE/ATRASADO | CANCELADA | Perdão aprovado; pausa (`canceladaPorPausaId`); desistência (`canceladaPorDesistenciaId`) | `src/server/ajustes/acoes.ts:63`; `prisma/schema.prisma` (modelo `Cobranca`) |
| CANCELADA (por pausa) | PENDENTE/ATRASADO | Retomada aprovada com "manter vencimentos" | `src/server/retomada/acoes.ts:102-112` |
| PENDENTE → ATRASADO só pela data | não gravado | Nenhuma rotina grava a mudança; o atraso é calculado na leitura | `src/server/ajustes/consultas.ts:77`; doc 10 §4 (Fase 1+) |
| PAGO | qualquer outro | não encontrado (não há estorno) | — |

**Informe de pagamento** (`StatusPagamentoInformado`, `prisma/schema.prisma:282-286`): A_CONFERIR → CONFIRMADO ou REJEITADO (`src/server/financeiro/acoes.ts:158-161`). A repetição idêntica pelo mesmo conferente é aceita sem nova baixa (`:140`).

**Recebimento** (`prisma/schema.prisma:314-341`): fato imutável, sem estado. As destinações são COBRANCA ou CREDITO_SEM_DESTINO (`:343-366`); CREDITO_SEM_DESTINO cria um `CreditoMatricula` (`src/server/financeiro/recebimentos.ts:83-86`).

**Aprovação de desconto/valor** (`TipoAprovacao` DESCONTO · BOLSA · ALTERACAO_VALOR · PERDAO_DIVIDA · COMISSAO_EXCEPCIONAL; `StatusAprovacao`, `prisma/schema.prisma:2122-2163`): PENDENTE → APROVADA (aplica na mesma transação) ou REJEITADA (`src/server/ajustes/acoes.ts:180-183`). Não há cancelamento pelo solicitante nem expiração. `COMISSAO_EXCEPCIONAL` não é criado em nenhum ponto do código (não encontrado).

**Solicitação de acesso às aulas** (`prisma/schema.prisma:149-160`): PENDENTE → APROVADA ou REJEITADA (`src/server/cobrancas/acoes.ts:121-158`).

**Comissão** (`StatusComissao`, `prisma/schema.prisma:2086-2091`)

| De | Para | Gatilho | Arquivo:linha |
|---|---|---|---|
| (nova) | PENDENTE | Criação da matrícula (fluxo antigo) | `src/server/matricula/acoes.ts:362-373` |
| (nova) | APROVADA | Ativação pela preparação (fluxo da SPEC) | `src/server/matricula/ativacao-preparacao-tx.ts:92-94` |
| PENDENTE | APROVADA | Ativação da matrícula (fluxo antigo) | `src/server/matricula/acoes.ts:572-577` |
| APROVADA | PAGA | "Fechar mês" (manual, sem corte de data) ou cron mensal (só o mês anterior) | `src/server/financeiro/acoes.ts:252-304`; `src/server/financeiro/cron-financeiro.ts:19-62` |
| PENDENTE/APROVADA | ESTORNADA | Estorno manual com motivo | `src/server/crm/comissoes-estorno.ts:22-45` |
| PAGA | ESTORNADA | Recusado: "Comissão já paga: o desconto no próximo fechamento ainda não existe." | `src/server/crm/comissoes-estorno.ts:32` |

**Retomada (doc 39, por aluno)** (`PropostaRetomada`, `prisma/schema.prisma:128-147`): PENDENTE → APROVADA (aplica a retomada e o calendário) ou REJEITADA (`src/server/retomada/acoes.ts:81-134`). Só pode haver uma pendente por aluno (`:43-55`).

**Retomada por matrícula** (`PropostaRetomadaMatriculas`, `prisma/schema.prisma:1768-1800`): PENDENTE → APROVADA → APLICADA, ou REJEITADA. Uma APROVADA ainda pode virar REJEITADA (`src/server/matricula/retomada-proposta.ts:53`).

**Permuta** (registros imutáveis, `prisma/schema.prisma:5332-5435` e `:8331`): Acordo preparado (FIN) → Confirmação de serviço por período (GP) → Proposta de compensação (FIN) → Decisão aprovada ou rejeitada (outra pessoa, com `financeiro.aprovar_acertos` ou ADM) → Aplicação criada por trigger, que reduz o saldo (`prisma/migrations/20260917148000_aplicacao_compensacao_permuta/migration.sql:25-40`).

## Gateway simulado: como o QA paga/recusa uma cobrança em UAT

**Resposta curta: pelo gateway, o QA não paga nem recusa.** O caminho simulado está bloqueado em quatro pontos:

1. Nenhuma tela gera o link. `gerarLinkPagamentoGateway` (`src/server/matricula/acoes.ts:843`) não tem chamador
   na interface. O vendedor só registra um link digitado (`src/app/(app)/funil/PainelOportunidade.tsx:220`), e esse
   link não grava `gatewayRef`, que é a chave de busca da página `/pagar` (`src/server/financeiro/gateway.ts:58-59`).
2. A página não mostra o botão. `pagamentoSimuladoHabilitado()` devolve `false` sem ler o ambiente
   (`src/server/financeiro/gateway.ts:42-45`), embora `SETUP.md:112,163` e `.env.example:84` digam que
   `PAGAMENTO_SIMULADO=1` liga o botão. Com cobrança pendente ou vencida, a página mostra "Pagamento online
   indisponível no momento. Para pagar, fale com a Secretaria da escola, que indica outro canal."
   (`src/app/pagar/[token]/PagarCliente.tsx:23-29`).
3. O webhook responde 404 com `{"erro":"Pagamento simulado desabilitado."}` (`src/app/api/pagamentos/webhook/simulado/route.ts:13-15`).
4. Mesmo com os pontos acima liberados, `baixarCobrancaTx` recusaria a baixa sem autor: "Conciliação automática
   pendente de adaptação ao recebimento contratual..." (`src/server/financeiro/baixa.ts:26`). O teste de integração
   confirma esse comportamento (`src/server/financeiro/gateway.int.test.ts:38-45`). Não existe o conceito de
   "pagamento recusado pelo gateway".

**O que o QA testa no `/pagar` pela interface, sem passo do dev:**

| Caso | Como chegar | O que aparece (`src/app/pagar/[token]/quadro.ts`) |
|---|---|---|
| Link fora do formato | `/pagar/abc` | "Link de pagamento inválido" + orientação (`:28-33`) |
| Token bem formado sem cobrança | `/pagar/` + 24 a 64 caracteres hexadecimais inventados (0-9, a-f) | "Link de pagamento expirado" (`:35-40`, `:65`) |
| Página não indexável | Inspecionar o `<head>` | `robots: noindex, nofollow` (`src/app/pagar/[token]/page.tsx:18`) |

**Com passo do dev** (gravar um `gatewayRef` hexadecimal numa cobrança de teste do banco de UAT):
pendente mostra valor, vencimento e "Pagamento em aberto", sem botão; ATRASADO gravado mostra "Cobrança vencida";
PAGO mostra "Pagamento confirmado" sem valor; CANCELADA mostra "Cobrança cancelada" sem valor (`quadro.ts:42-77`).
Atenção: uma cobrança vencida que continua PENDENTE no banco aparece como "Pagamento em aberto" (achado 4).

**Como simular os desfechos de pagamento em UAT, pela interface:**

- **Pagamento aprovado:** SEC informa na ficha financeira, e outro usuário FIN confirma em Financeiro › A conferir.
  Outra opção: FIN registra direto na ficha ("Registrar recebimento") ou em `/financeiro/recebimentos`.
- **Pagamento recusado:** SEC informa, e FIN rejeita com motivo. O saldo não muda, e a evidência fica guardada.
- **Ter gateway simulado no UAT:** exige decisão do PO e desenvolvimento (fazer a flag ler o ambiente, adaptar a
  baixa ao ledger com autor de sistema e chave idempotente, criar o botão que gera o link). Não é só configuração.

## Alçadas e aprovações por papel

ADM = Administrador · GC = Gerente Comercial · VEN = Vendedor · FIN = Financeiro · SEC = Secretaria Acadêmica · GP = Gerente Pedagógico. "Outra pessoa" = o servidor compara os IDs de quem pediu e de quem decide (`src/server/financeiro/regras.ts:35-39` ou verificação equivalente no próprio módulo).

| Ação | Quem pede | Quem aprova | Limite | Arquivo:linha | Status vs doc 37 |
|---|---|---|---|---|---|
| Desconto em taxa/mensalidade (ficha ou resumo comercial) | VEN (carteira), GC (escopo comercial), FIN, ADM | GC com a matrícula na equipe (`vendedorDonoId` entre os liderados) ou ADM; sempre outra pessoa | Desconto acumulado sobre `valorOriginal`, comparado com `limiteDescontoTaxaPct` / `limiteDescontoMensalidadePct` de quem pede; campo vazio = 0%; o aprovador também precisa ter alçada | `src/server/ajustes/acoes.ts:93-153,155-189`; `src/server/financeiro/politica.ts:13-16`; `src/server/financeiro/regras.ts:24-33`; `src/server/financeiro/acesso.ts:23-36` | Conforme D06 / AC16–AC18 |
| Desconto pedido por GC ou ADM | GC, ADM | Somente ADM, outra pessoa (`exigeDirecao`) | — | `src/server/ajustes/acoes.ts:138,169` | Conforme D03 / AC19 |
| Desconto acima da alçada do GC | qualquer | ADM ("Desconto acima da sua alçada. Encaminhe à direção.") | Alçada do GC | `src/server/ajustes/acoes.ts:178` | Conforme |
| GC teve a alçada alterada depois do pedido | — | Somente ADM ("Alçada alterada após o pedido...") | `alcadaAlteradaEm` | `src/server/ajustes/acoes.ts:171` | Conforme AC20 |
| Bolsa | VEN/GC/FIN/ADM | Somente ADM, outra pessoa | Sempre vai para aprovação | `src/server/ajustes/acoes.ts:125,169` | Conforme ("aprovar desconto não autoriza bolsa") |
| Perdão de dívida | Somente ADM pede | Outro ADM; aprovado → cobrança CANCELADA | Sempre vai para aprovação | `src/server/ajustes/acoes.ts:117,125,169,63` | Conforme |
| Alteração de valor para cima | VEN/GC/FIN/ADM | Aplica direto (desconto acumulado = 0) | — | `src/server/financeiro/regras.ts:24-33` | Conforme |
| Preço da matrícula fora da alçada (fluxo antigo) | VEN/GC/SEC | GC (equipe) ou ADM, na aba Aprovações; a ativação espera a decisão | Igual ao desconto | `src/server/matricula/acoes.ts:376-391,481`; `src/server/matricula/ativacao-preparacao-tx.ts:40` | Conforme |
| Alterar a alçada de um usuário | ADM em Configuração › Usuários | — | O ADM não aumenta a própria alçada | `src/server/acesso/acoes.ts:85-101` | Parcial (sem vigência; doc 37 §6.3 pede vigência) |
| Conferir informe de pagamento | SEC informa | FIN/ADM, outra pessoa | — | `src/server/financeiro/acoes.ts:130-141` | Conforme D01 / AC10–AC13 |
| Recebimento direto (caixa) | FIN, ADM, `pagamento.caixa` | Sem segunda pessoa | Um informe A_CONFERIR do próprio autor bloqueia o caixa dele nessa cobrança | `src/server/financeiro/acoes.ts:75-83`; `src/server/financeiro/recebimentos.ts:48,58` | Conforme (doc 37 §6.1, capacidade de caixa) |
| Publicar política de comissão | FIN ou GC com `comissao.configurar`; ADM | Sem aprovação (publicação versionada) | — | `src/server/financeiro/acoes.ts:183-210` | Conforme (`comissao.configurar`) |
| Fechar o mês de comissões (pagar) | FIN, ADM | — | Todas as APROVADAS | `src/server/financeiro/acoes.ts:252-260` | Conforme (`comissao.pagar`) |
| Estornar comissão | FIN, ADM (`comissoes.estornar`) | — | Só PENDENTE/APROVADA | `src/server/crm/permissoes.ts:42`; `src/server/crm/comissoes-estorno.ts:22-35` | Parcial |
| Câmbio (manual e automático) | FIN, ADM | — | — | `src/server/financeiro/acoes.ts:41,369-373,402-406` | Conforme (`cambio.manter`; sem delegação explícita) |
| Restrição/liberação manual do acesso às aulas | FIN, SEC, ADM | ADM, outra pessoa | — | `src/server/cobrancas/acoes.ts:84-111,121-129` | Conforme SPEC §6 |
| Retomada (doc 39, por aluno) | SEC, FIN, ADM | FIN ou ADM, outra pessoa | Só aluno "legado" (ver achado 26) | `src/server/retomada/acoes.ts:15-16,79` | Conforme doc 39 |
| Retomada/pausa por matrícula | SEC, FIN, ADM | FIN ou ADM, outra pessoa; aplicação em passo separado | — | `src/server/matricula/pausa-estado.ts:8`; `src/server/matricula/pausa-integridade.ts:5`; `src/server/matricula/retomada-proposta.ts:41-49` | Conforme SPEC §6 |
| Permuta: acordo / serviço / compensação | FIN prepara o acordo e a proposta; GP confirma o serviço | FIN com `financeiro.aprovar_acertos` ou ADM; o banco exige outra pessoa | Proposta ≤ quantidade comprovada × valor por unidade | `src/server/financeiro/permuta-servico.ts:24-29,31,36,42-44,77`; `prisma/migrations/20260917144000_permuta_servico/migration.sql:52,58` | Conforme REQ-11 |
| Uso de crédito (Q68) | FIN | FIN com `financeiro.aprovar_acertos` ou ADM, outra pessoa | Concordância do aluno | `src/server/financeiro/uso-credito-proposta.ts:22`; `src/server/financeiro/uso-credito-decisao.ts:11-21` | Conforme FIN-04 |
| Devolução de crédito (Q69) | FIN, ADM | Aprovar: `financeiro.aprovar_acertos`; executar: `financeiro.executar_devolucoes` | Saldo do crédito | `src/server/financeiro/devolucao-credito.ts:19-25,42-47,59` | Conforme SPEC §6 (Devolução) |
| Acertos de aditivo (adiantamento, vencimento, taxa, cobertura) | FIN (cobertura e taxa: FIN/ADM) | FIN com `financeiro.aprovar_acertos` ou ADM, outra pessoa; **quem decide também aplica** | — | `src/server/contratos/adiantamento-aditivo.ts:38,97,122`; `src/server/contratos/vencimento-aditivo.ts:36,93,115`; `src/server/contratos/aditivo-acerto-taxa-acoes.ts:17,63,90`; `src/server/contratos/aditivo-cobertura.ts:15,99` | Conforme REQ-18 |
| Desistência: cancelamento financeiro e acerto Q165 | FIN (acerto: FIN/ADM) | `financeiro.aprovar_acertos` ou ADM, outra pessoa | Regra estruturada do contrato (opção C) | `src/server/matricula/desistencia-financeira.ts:28,34,61-67`; `src/server/matricula/desistencia-acerto-decisao.ts:23,35` | Parcial (Q165 parcial) |
| Condições de continuidade mensal | SEC prepara | ADM, outra pessoa | — | `src/server/matricula/condicoes-continuidade-mensal.ts:59,76,85` | Conforme Q161/Q162 |
| Conciliação financeira da migração / entrada histórica | FIN, ADM | FIN/ADM, outra pessoa | — | `src/server/migracao/conciliacao-financeira.ts:28,50`; `src/server/migracao/entrada-financeira-historica.ts:23,52,56` | Conforme REQ-13 |
| Aprovar comissão | — | Automática na ativação; não há aprovação humana | — | `src/server/matricula/acoes.ts:572-577` | Divergente do doc 10 §2 ("GC aprova comissão"); o doc 37 não exige essa aprovação |

O ADM concede as capacidades adicionais em Configuração › Usuários (`src/lib/capacidades.ts:1-15`): `pagamento.caixa`, `comissao.configurar`, `financeiro.aprovar_acertos`, `financeiro.executar_devolucoes` e `dados.exportar_*`. O ADM passa em todas (`src/server/_shared/capacidades.ts:11-17`).

## Mapa de telas

| Rota | Arquivo | Papéis (guard real) | O que faz |
|---|---|---|---|
| `/financeiro` | `src/app/(app)/financeiro/(painel)/page.tsx` | ADM, FIN, GC (`src/app/(app)/financeiro/papeis.ts:6`; `contexto.ts:23`) | Redireciona para a aba padrão: Cobranças (ADM/FIN) ou Comissões (GC) |
| layout do painel | `src/app/(app)/financeiro/(painel)/layout.tsx` | os mesmos | Atalhos (acertos, desistências, recebimentos, migração, continuidade) só para ADM/FIN; barra de abas com contadores |
| `/financeiro/cobrancas` | `(painel)/cobrancas/page.tsx` | ADM, FIN | Fila da régua com cartões, busca, país, turma e cursor; detalhe com WhatsApp manual, promessa, pagamento e painel de acesso às aulas |
| `/financeiro/informes` | `(painel)/informes/page.tsx` | ADM, FIN | Fila "A conferir": Confirmar recebimento / Rejeitar (com motivo) |
| `/financeiro/retomadas` | `(painel)/retomadas/page.tsx` | ADM, FIN | Propostas de retomada (doc 39) pendentes: aprovar ou rejeitar com motivo |
| `/financeiro/comissoes` | `(painel)/comissoes/page.tsx` | ADM, FIN; GC vê a aba, **mas a página chama uma consulta exclusiva de FIN** (achado 25) | Lista paginada, filtro, total a pagar, "Fechar mês", liga/desliga o fechamento automático |
| `/financeiro/descontos` | `(painel)/descontos/page.tsx` | ADM, FIN (tudo), GC (equipe) | Relatório de desconto concedido e de comissões por moeda, vendedor e status |
| `/financeiro/geral` | `(painel)/geral/page.tsx` | ADM, FIN | KPIs (recebido no mês, em atraso, a receber, comissões a pagar, novas matrículas) e consolidação "≈" por câmbio |
| `/financeiro/politicas` | `(painel)/politicas/page.tsx` | ADM ou `comissao.configurar` (`src/server/financeiro/consultas.ts:299-303`) | Publicar política percentual/fixa por país × produto; dia da previsão de pagamento |
| `/financeiro/aprovacoes` | `(painel)/aprovacoes/page.tsx` | ADM, GC (`contexto.ts:31`) | Aprovar/rejeitar pedidos de desconto, bolsa, perdão e preço de matrícula |
| `/financeiro/cambio` | `(painel)/cambio/page.tsx` | ADM, FIN | Cotações por moeda (pivô USD): manual ou "buscar automaticamente" |
| `/financeiro/recebimentos` | `src/app/(app)/financeiro/recebimentos/page.tsx:14` | FIN (ADM passa) | Recebimento com várias destinações e crédito |
| `/financeiro/permuta` | `src/app/(app)/financeiro/permuta/page.tsx:12` | FIN, GP (ADM passa) | FIN: acordo, proposta e decisão; GP: confirmação de serviço |
| `/financeiro/continuidade` | `src/app/(app)/financeiro/continuidade/page.tsx:11` | FIN, ADM | Fila somente leitura do estado da continuidade mensal por matrícula |
| `/financeiro/desistencias` | `src/app/(app)/financeiro/desistencias/page.tsx:11` | FIN, ADM | Fila do cancelamento financeiro das desistências |
| `/financeiro/migracao` e `/[linhaId]` | `src/app/(app)/financeiro/migracao/page.tsx:12`; `[linhaId]/page.tsx:17` | ADM, FIN | Conciliação financeira da migração; entrada financeira histórica |
| `/financeiro/acertos-taxa` (+ `/[matriculaId]/[propostaId]`) | `acertos-taxa/page.tsx:8`; `[matriculaId]/[propostaId]/page.tsx:15` | FIN (ADM passa) | Impactos e acerto da taxa por aditivo |
| `/financeiro/acertos-cobertura` (+ detalhe) | `acertos-cobertura/page.tsx:9`; detalhe `:11` | FIN, ADM | Correção de cobertura por aditivo (Q168/Q169) |
| `/financeiro/acertos-adiantamento/[m]/[p]` | `acertos-adiantamento/[matriculaId]/[propostaId]/page.tsx:24` | FIN (ADM passa) | Adiantamento por aditivo |
| `/financeiro/acertos-vencimento/[m]/[p]` | `acertos-vencimento/[matriculaId]/[propostaId]/page.tsx:20` | FIN (ADM passa) | Mudança de vencimento por aditivo |
| `/comissoes` | `src/app/(app)/comissoes/page.tsx:12` | ADM, FIN, GC, VEN (VEN: só as próprias; GC: a equipe) | Painel por período e vendedor, previsão de pagamento, "Fechar mês" (só com o papel FIN, `:37`) e estorno (`:38`) |
| `/alunos/[id]/financeiro` | `src/app/(app)/alunos/[id]/financeiro/page.tsx:21-36` | FIN, SEC (ficha completa); VEN, GC (resumo comercial, com escopo) | Cobranças, régua (só leitura), histórico, informar/registrar pagamento, renegociar, retomada, acesso às aulas, informes |
| `/alunos/[id]/creditos/[creditoId]` | `src/app/(app)/alunos/[id]/creditos/[creditoId]/page.tsx:17` | FIN, ADM | Propor/decidir uso de crédito; propor/decidir/executar devolução |
| `/matriculas/[id]/compensacoes/[cobrancaId]` (+ `/periodo-integral`) | `.../compensacoes/[cobrancaId]/page.tsx:12`; `periodo-integral/page.tsx:13` | FIN, ADM | Compensação de cobertura; período integral sem oferta (Q158/Q159) |
| `/matriculas/[id]/continuidade-mensal` | `.../continuidade-mensal/page.tsx:10` | SEC, FIN (ADM passa) | Condições (SEC prepara, ADM decide) e prévia da continuidade |
| `/matriculas/[id]/ocorrencias-financeiras` (+ `/revisoes-correcao-aula`) | `.../ocorrencias-financeiras/page.tsx:10`; `revisoes-correcao-aula/page.tsx:9` | FIN (ADM passa) | Conferência de horas particulares; revisão financeira de correção de aula (Q23) |
| `/matriculas/[id]/fechamentos-horas` | `.../fechamentos-horas/page.tsx:36` | FIN (ADM passa) | Preparar, decidir e emitir o fechamento mensal de horas |
| `/configuracao/whatsapp` › Política | `src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx`; ação `src/server/whatsapp/acoes.ts:940-942` | ADM | Régua como dado: degraus, modos, janela e estado (nasce DESLIGADA) |
| `/pagar/[token]` | `src/app/pagar/[token]/page.tsx` | Pública | Quadro da cobrança; botão de pagar desligado |
| `POST /api/pagamentos/webhook/simulado` | `src/app/api/pagamentos/webhook/simulado/route.ts` | Pública (token) | Hoje responde sempre 404 |
| `POST /api/financeiro/continuidade/cron` | `src/app/api/financeiro/continuidade/cron/route.ts` | `x-cron-secret` | Emissão mensal; desligada sem `CONTINUIDADE_MENSAL_EMISSAO_ENABLED=true` |
| `POST /api/whatsapp/cron` | `src/app/api/whatsapp/cron/route.ts:49,53` | `x-cron-secret` (tick de 5 min no compose) | Entre outras rotinas: controle de acesso D+30 e fechamento automático de comissões |

## Tabela de achados

| # | Tema | Fonte normativa | O que a fonte diz | O que o código faz (arquivo:linha) | Status | O que o QA deve esperar na interface |
|---|---|---|---|---|---|---|
| 1 | Gateway simulado | doc 15 D36; `SETUP.md:112,163`; quadro `:366` | Botão de pagar com `PAGAMENTO_SIMULADO=1`; o quadro diz que a conciliação do gateway simulado "não está liberada" | `pagamentoSimuladoHabilitado()` devolve `false` fixo (`src/server/financeiro/gateway.ts:42-45`); webhook 404 (`src/app/api/pagamentos/webhook/simulado/route.ts:13-15`) | Desligado | `/pagar` de cobrança aberta mostra "Pagamento online indisponível..." sem botão, com qualquer valor da variável |
| 2 | Conciliação automática | doc 37 §6.1 (recebimento com identidade e idempotência); Q87 | Toda baixa passa pelo ledger, com autor e chave | `baixarCobrancaTx` recusa sem autor e qualquer `via` diferente de `fatura_b2b` (`src/server/financeiro/baixa.ts:26,36`); teste `src/server/financeiro/gateway.int.test.ts:38-45` | Não implementado | Não existe pagamento por link que baixe a cobrança |
| 3 | Gerar link do gateway | doc 27 C4 (âncora "link sem pagamento") | O gateway gera o link da cobrança | `gerarLinkPagamentoGateway` (`src/server/matricula/acoes.ts:843-893`) sem chamador; a UI só tem o registro manual (`src/app/(app)/funil/PainelOportunidade.tsx:220`) | Não implementado | No funil, o vendedor cola um texto/link; nenhum botão "Gerar link" |
| 4 | Quadro "vencida" no `/pagar` | docs 42/43 (`/pagar` com 6 casos) | Cobrança vencida mostra "Cobrança vencida" | O quadro usa `status === "ATRASADO"` gravado (`src/app/pagar/[token]/quadro.ts:68`); nada grava ATRASADO só pela passagem da data (achado 10) | Bug provável | Com passo do dev, uma cobrança vencida ainda PENDENTE no banco aparece como "Pagamento em aberto" |
| 5 | Informe e conferência | doc 37 D01, §6.1, AC10–AC14; SPEC §6 (informe) | SEC informa sem baixar; FIN de outra pessoa confirma ou rejeita; versão; sem duplicidade; lembretes suspensos 48 h | `src/server/financeiro/acoes.ts:85-106,130-170`; independência `src/server/financeiro/regras.ts:35-39`; prazo `src/server/financeiro/acoes.ts:93-95` | Conforme | Informe "A conferir" sem mudar o saldo; confirmar baixa uma vez; rejeitar exige motivo; o autor do informe não confirma o próprio |
| 6 | Caixa direto do Financeiro | doc 37 §6.1 (capacidade de caixa do doc 36) | A capacidade de caixa autoriza recebimento próprio | FIN/ADM/`pagamento.caixa` recebem direto (`src/server/financeiro/acoes.ts:75-83`); um informe próprio pendente bloqueia (`src/server/financeiro/recebimentos.ts:58`) | Conforme | O botão diz "Registrar recebimento" para FIN e "Informar pagamento" para SEC (`src/app/(app)/alunos/[id]/financeiro/FichaFinanceira.tsx:188-189`) |
| 7 | Recebimento com destinações | SPEC FIN-04, INV-06; Q87 | Um recebimento original, várias destinações, crédito explícito, mesmo titular e moeda | `src/server/financeiro/recebimentos.ts:30-100` (soma exata `:38`, titular/moeda `:63`, excedente `:93`, crédito `:84`) | Conforme | Total diferente do valor → "As destinações devem consumir exatamente o recebimento..." |
| 8 | Estorno ou correção de recebimento | doc 37 §6.1 item 4 | Pagamento confirmado é corrigido por ajuste/estorno autorizado | não encontrado; os guards SQL impedem editar o fato (Q87) | Não implementado | Não há botão de estornar recebimento [PO] |
| 9 | Quitação da taxa e ativação | SPEC §6 (matrícula mensal); INV-05 | A ativação tem requisitos próprios; comprovante a conferir não satisfaz | `ResultadoBaixa.matriculaAtivada` sempre `false` (`src/server/financeiro/baixa.ts:42`); o recebimento não ativa matrícula | Conforme | Pagar a taxa não ativa a matrícula sozinho; a ativação é feita pela Secretaria (área 04) |
| 10 | Atraso gravado | doc 10 §4 (cron 01:00, Fase 1+) | Rotina diária Pendente → Vencida | Não há rotina; o atraso é calculado na leitura (`src/server/ajustes/consultas.ts:77`; `src/server/financeiro/regras.ts:16-18`) | Parcial | A ficha e a fila mostram atraso corretamente; o status gravado pode continuar "Pendente" |
| 11 | Alçadas taxa × mensalidade | doc 37 D06, §6.3, AC16–AC18; SPEC §4 | Limites separados, desconto acumulado sobre a referência, ausência = sem autonomia | `src/server/financeiro/politica.ts:13-16`; `src/server/financeiro/regras.ts:24-33`; `src/server/ajustes/acoes.ts:131` | Conforme | 5% + 7% sobre a mesma cobrança contam como 12% acumulado |
| 12 | Vigência da alçada | doc 37 §6.3 | Limite associado à função/concessão, com vigência | Limite por usuário, sem vigência; só `alcadaAlteradaEm` (`src/server/acesso/acoes.ts:90-118`; `src/server/ajustes/acoes.ts:171`) | Parcial | Não há data de início/fim da alçada na tela de usuário |
| 13 | Alçadas no banco de UAT | doc 37 D06 + kit `docs/qa/02-usuarios-e-papeis.md` §2 | VEN 10%, GC 20% etc. | Os seeds gravam só `limiteDescontoPct` (`prisma/seed-qa.ts:45-92`; `prisma/seed.ts:14-51`); o código lê os campos novos; a cópia só ocorreu na migração (`migration.sql:274-276`) | Divergente (ambiente) | Num banco novo, todo desconto vai para aprovação até o ADM preencher "limite taxa" e "limite mensalidade" de cada usuário [DEV/ADM] |
| 14 | Autonomia do Financeiro | kit 02 §2 ("Financeiro sem limite") | — | Não há exceção para FIN em `ajustarCobranca` (`src/server/ajustes/acoes.ts:124-131`); FIN não aprova (`:157`) | Divergente (kit) | O desconto do FIN com limite vazio vai para Aprovações (GC/ADM); FIN não vê a aba Aprovações [PO] |
| 15 | Aprovação independente e roteamento | doc 37 D03, AC19, AC20; INV-07 | Outra pessoa; GC solicitante ou ausente → direção; alçada do aprovador | `src/server/ajustes/acoes.ts:163,169,171,177-178`; escopo `src/server/financeiro/acesso.ts:23-36` | Conforme | Na aba Aprovações, o GC não vê o próprio pedido, os pedidos fora da equipe nem os que exigem direção (`src/server/ajustes/consultas.ts:130-153`); o ADM vê todos os pedidos de outras pessoas. Pela chamada direta, aprovar o próprio pedido dá "A conferência exige outra pessoa, mesmo quando você acumula papéis." |
| 16 | Revalidação na aprovação | doc 37 §6.3, AC14 | A aprovação vale para a versão; mudança invalida | Versão, valor e referência conferidos (`src/server/ajustes/acoes.ts:44-48`) | Conforme | "A cobrança mudou desde a solicitação. Envie um novo pedido." |
| 17 | Bolsa e perdão | doc 37 §4 (`financeiro.aprovar_excecao`) | Capacidades por tipo; aprovar desconto não autoriza perdão | Bolsa/perdão sempre vão para aprovação; só ADM aprova; só ADM pede perdão (`src/server/ajustes/acoes.ts:117,125,169`) | Conforme | FIN/VEN não veem a opção Perdão (`src/app/(app)/alunos/[id]/financeiro/page.tsx:133`) |
| 18 | Política de comissão | doc 37 D07, §6.4, AC21, AC22, AC24 | Percentual ou fixo, base, moeda, vigência, versão; sem regra → bloqueia; o VEN não informa percentual | `src/server/financeiro/acoes.ts:183-210`; `src/server/financeiro/regras.ts:60-77`; `src/server/financeiro/politica.ts:18-32`; `src/server/matricula/schema.ts:93` | Conforme | Nova versão só com vigência futura e posterior à anterior; comissões antigas mantêm a memória do cálculo |
| 19 | Quem configura a política | doc 37 §4 (`comissao.configurar`) | Direção/ADM; GC/FIN só por delegação | ADM ou `comissao.configurar` (`src/server/financeiro/consultas.ts:299-303`; `src/server/financeiro/acoes.ts:185-186`) | Conforme | FIN sem a permissão não vê a aba "Política de comissão" |
| 20 | Aprovação da comissão | doc 10 §2–§3 (parcialmente obsoleto) | GC aprova comissão; Pendente → Aprovada na ativação | Aprovada automaticamente na ativação (`src/server/matricula/acoes.ts:572-577`; `src/server/matricula/ativacao-preparacao-tx.ts:92-94`) | Divergente (doc 10) | Não existe botão "Aprovar comissão" [PO] |
| 21 | Fechamento/pagamento de comissões | doc 10 §3; doc 37 `comissao.pagar`; D11 | Fechamento no dia 30, pagamento no dia 05; previsão configurável | Manual paga todas as APROVADAS sem corte (`src/server/financeiro/acoes.ts:252-304`); automático desligado, só o mês anterior (`src/server/financeiro/cron-financeiro.ts:19-62`); dia da previsão configurável (`src/server/financeiro/acoes.ts:335-362`) | Parcial | "Fechar mês" paga inclusive as aprovadas no mês corrente; repetir dá "Nenhuma comissão aprovada para pagar." |
| 22 | Botão "Fechar mês" em `/comissoes` | doc 37 (`comissao.pagar` FIN/ADM) | FIN/ADM | `/comissoes` mostra o botão só para quem tem o papel FIN (`src/app/(app)/comissoes/page.tsx:37`); o servidor aceita ADM; em `/financeiro/comissoes` o ADM vê o botão | Divergente (menor) | ADM puro não vê "Fechar mês" em `/comissoes` |
| 23 | Estorno de comissão | doc 10 §3; doc 37 §6.4 (ajuste de comissão paga vinculado) | Cancelamento < 30 dias estorna; comissão paga é ajustada por lançamento vinculado | Estorno manual de PENDENTE/APROVADA com motivo (`src/server/crm/comissoes-estorno.ts:22-45`); PAGA recusada (`:32`); automático e clawback não encontrados | Parcial | "Comissão já paga: o desconto no próximo fechamento ainda não existe." |
| 24 | Recálculo da comissão no ajuste de taxa | doc 37 AC23 | O fixo não muda; a paga não é sobrescrita | Recalcula só PERCENTUAL e PENDENTE/APROVADA (`src/server/ajustes/acoes.ts:73-81`) | Conforme | Desconto aprovado na taxa muda a comissão percentual; a fixa continua igual |
| 25 | GC no painel financeiro | doc 37 §4 (`financeiro.ler_gestao`; GC com relatório comercial) | O GC lê o relatório da equipe | A aba padrão do GC é Comissões (`src/app/(app)/financeiro/abas.ts:31,46`); a página chama `carregarConfigFinanceiro()`, exclusiva de FIN (`src/server/financeiro/consultas.ts:318-319`; `src/app/(app)/financeiro/(painel)/comissoes/page.tsx:32`) | Bug provável | GC clica em Financeiro e deve cair em "Não foi possível carregar o financeiro"; Descontos e Aprovações funcionam |
| 26 | Retomada doc 39 | doc 39; SPEC §6 | Proposta com manter/reprogramar; outra pessoa FIN/ADM aprova; revalida; D+30 recalculado | `src/server/retomada/acoes.ts:30-141`; mas só para aluno com uma matrícula e sem vínculos por matrícula (`src/server/matricula/limite-legado.ts:5-19`) | Parcial | Aluno com turma/preparação → mensagem "Use o fluxo contratual" e a retomada vai para Movimentações por matrícula |
| 27 | Retomada por matrícula | SPEC §6 (pausa/retomada por contrato) | Seleção por contrato; aprovação independente; cobertura e vencimentos | `src/server/matricula/retomada-proposta.ts:11-70`; aplicação `src/server/matricula/aplicar-movimentacao.ts:11-13` | Conforme | Em `/alunos/[id]/movimentacoes`: propor → outra pessoa FIN/ADM decide → aplicar |
| 28 | Permuta | SPEC REQ-11 / P02 | Acordo, evidência pedagógica, proposta e aprovação independente; não cria recebimento | `src/server/financeiro/permuta-servico.ts:24-96`; outra pessoa garantida no banco (`prisma/migrations/20260917144000_permuta_servico/migration.sql:58`) | Conforme | O mesmo FIN que propôs recebe erro ao decidir (mensagem do banco, possivelmente genérica); o saldo cai sem recebimento |
| 29 | Uso e devolução de crédito | SPEC FIN-04, §6 (Devolução); Q68/Q69 | Concordância, proposta, aprovação independente; aprovar ≠ executar | `src/server/financeiro/uso-credito-proposta.ts:20-44`; `uso-credito-decisao.ts:9-38`; `devolucao-credito.ts:19-108` | Conforme | A tela do crédito pede concordância e decisão de outra pessoa com `financeiro.aprovar_acertos` |
| 30 | Acertos de aditivo | SPEC REQ-18 / DCT03; Q168–Q170 | Aprovação administrativa independente, sem reescrever pagamentos | `src/server/contratos/adiantamento-aditivo.ts`, `vencimento-aditivo.ts`, `aditivo-acerto-taxa-acoes.ts`, `aditivo-cobertura.ts` (linhas na tabela de alçadas) | Conforme | Decidir e aplicar exigem a mesma pessoa aprovadora, diferente de quem preparou |
| 31 | Desistência (financeiro) | Q121, Q165 (`docs/planejamento/acerto-desistencia-q165.md`) | Proposta FIN + aprovação independente; só regra estruturada; "Implementação parcial" | `src/server/matricula/desistencia-financeira.ts:32-70`; `desistencia-acerto-contratual.ts:53-55`; `desistencia-acerto-decisao.ts:21-35` | Parcial | Sem regra contratual suficiente, o acerto fica pendente (não há cálculo manual) |
| 32 | Continuidade mensal | Q161/Q162; incrementos 606–608 | Emitir na antecedência configurada, conferindo oferta | Executor e fila prontos; emissão só com `CONTINUIDADE_MENSAL_EMISSAO_ENABLED=true` e um POST externo (`src/app/api/financeiro/continuidade/cron/route.ts:8`; `docker-compose.prod.yml:88-90`) | Desligado | `/financeiro/continuidade` só mostra estados; nada é emitido sem passo do dev |
| 33 | Régua V1 | doc 24 V1; incrementos 602–603 | Cérebro puro D-7…D+15, ação humana, promessa, suspensão por informe | `src/server/cobrancas/regua.ts:22-29`; `src/server/financeiro/cobranca-manual.ts:26-53`; `src/server/financeiro/acoes.ts:212-249`; `src/server/cobrancas/acoes.ts:43-79` | Conforme | Abrir o WhatsApp não registra nada; só "Confirmar envio" avança o degrau |
| 34 | Régua automática (V2) | doc 24 V2; doc 26 | Cron + API, régua configurável pelo ADM | Política como dado, nasce DESLIGADA (`src/server/cobrancas/politica.ts:38-54`); configuração ADM (`src/server/whatsapp/acoes.ts:940-942`) | Desligado | Sem envio automático; WhatsApp simulado (ver auditoria 06) |
| 35 | Restrição de acesso às aulas | SPEC §6 (restrição D+30 automática e manual aprovada) | D+30 automático por matrícula; manual com aprovação; pagamento remove só a automática | `src/server/cobrancas/acesso-aulas-regras.ts:73,87-97`; `src/server/cobrancas/acesso-aulas.ts:9-70`; `src/server/cobrancas/acoes.ts:84-158`. O doc 24 (D+15 com aprovação) foi superado | Conforme | D+15 é só mensagem; a restrição automática aparece com 30 dias de atraso após o tick do cron |
| 36 | Quem restringe o acesso | kit 02 §2 (GC "bloqueia acesso") | — | Só FIN/SEC/ADM solicitam e só ADM decide (`src/server/cobrancas/acoes.ts:86,123`) | Divergente (kit) | GC não tem ação de restrição |
| 37 | Câmbio e multimoeda | doc 04 §Câmbio; SPEC FIN-04/FIN-06; doc 37 `cambio.manter` | Cotação só para consolidação; sem conversão implícita | `TaxaCambio` append-only (`prisma/schema.prisma:2201-2216`); `src/server/financeiro/acoes.ts:369-454` (fonte automática `open.er-api.com`, `:56`); destinação exige a mesma moeda (`src/server/financeiro/recebimentos.ts:63,108`) | Conforme | Consolidado com "≈"; "buscar automaticamente" sem internet → "Não foi possível buscar as cotações agora..." |
| 38 | Relatórios financeiros | doc 37 `financeiro.ler_gestao` / `ler_comercial` | FIN/ADM gestão; GC equipe; VEN a própria comissão | KPIs FIN/ADM (`src/server/financeiro/consultas.ts:91-127`); descontos/comissões (`:159-216`); `/comissoes` com escopo (`src/server/financeiro/consultas.ts:26-29`) | Conforme | Valores sempre por moeda; o "Recebido no mês" vem de Recebimento |
| 39 | Exportação financeira | doc 37 D09 / §6.7 | Exportação com permissão específica | `src/app/api/exportacoes/[tipo]/route.ts` cobre alunos/leads/contatos; exportação de cobranças, recebimentos ou comissões não encontrada | Não implementado | Não há botão de exportar no Financeiro [PO] |
| 40 | Motor de risco | doc 25 | "NÃO implementado — design pronto" | não encontrado | Não implementado | Não há tier/score na fila nem na ficha (esperado) |
| 41 | Secretaria no painel financeiro | doc 09 §Cobranças (obsoleto); doc 37 §3 | doc 09: SEC vê cobranças; doc 37: SEC só no atendimento individual | `/financeiro` só para ADM/FIN/GC (`src/app/(app)/financeiro/papeis.ts:6`); informes globais exigem FIN (`src/server/financeiro/consultas.ts:221-223`) | Divergente (doc 09, decisão R7) | SEC → "Acesso negado" em `/financeiro`; opera pela ficha do aluno |
| 42 | Migração financeira | SPEC REQ-13 / M01 | Prévia, conciliação, ensaio rastreável, aprovação independente | `src/server/migracao/conciliacao-financeira.ts:28-60`; `entrada-financeira-historica.ts:21-73` | Parcial | Fila em `/financeiro/migracao`; cada linha exige outra pessoa para aprovar |
| 43 | Cobertura de testes | doc 14 | Testes por fluxo | Webhook sem teste próprio; os testes do `/pagar` usam mock da flag = `true` (`src/app/pagar/[token]/page.test.ts:36`); o teste do painel usa mock de `carregarConfigFinanceiro` (`(painel)/page.test.ts:31`) | Parcial | Ver seção de testes abaixo |

### Testes existentes por módulo (contagem de arquivos)

| Módulo | Unitários | Integração (banco real) | Observação |
|---|---|---|---|
| `src/server/financeiro` | 15 | 10 | Inclui `gateway.int.test.ts` (recusa da conciliação), `politica.int.test.ts` (alçadas, aprovação, política), `confirmacao-manual.int.test.ts`, `recebimentos-destinados.int.test.ts`, `permuta-*.int.test.ts` |
| `src/server/cobrancas` | 8 | 4 | `regua.test.ts`, `acesso-aulas.int.test.ts`, `conferencia.int.test.ts`, `financeiro-idempotencia.int.test.ts` |
| `src/server/ajustes` | 3 | 1 | `aprovacao.test.ts`, `regras-ajuste.test.ts`, `ficha.int.test.ts` |
| `src/server/retomada` | 1 | 1 | `fluxo.int.test.ts` |
| `src/server/migracao` | 9 | 13 | Parte financeira: `conciliacao-financeira.int.test.ts`, `entrada-financeira-historica*.test.ts`, `consultas-financeiras.int.test.ts` |
| `src/server/crm` (comissões) | 2 | 2 | `comissoes-estorno*.test.ts`, `comissoes-painel*.test.ts` |
| `src/server/matricula` (continuidade, desistência, crédito) | — | — | 45 arquivos de teste com esses nomes |
| `src/app/(app)/financeiro` | 38 | 0 | SSR/interação das abas, fila, informes, políticas, permuta, acertos, migração |
| `src/app/(app)/comissoes` | 1 | 0 | `page.test.ts` |
| `src/app/(app)/alunos/[id]/financeiro` e `creditos` | 4 | 0 | — |
| `src/app/pagar` | 4 | 0 | Mock de `pagamentoSimuladoHabilitado` |
| `src/app/api/pagamentos/webhook/simulado` | 0 | 0 | não encontrado |
| `src/app/api/financeiro/continuidade/cron` | 1 | 0 | Segredo e gate da variável |

## Cenários de teste para o QA

**Usuários** (kit `docs/qa/02-usuarios-e-papeis.md`): ADM = admin@genius.com · GC = gerente@genius.com · VEN-A = joao@genius.com · VEN-B = vendedor2@genius.com · FIN = financeiro@genius.com · SEC = secretaria@genius.com · GP = gp@genius.com.
**FIN-2** = um segundo usuário só com o papel Financeiro e a permissão "Aprovar acertos e compensações financeiras" (`financeiro.aprovar_acertos`). O seed não cria esse usuário: o ADM cria em Configuração › Usuários.
Marcas: **[PO]** = o resultado depende de decisão do PO (registrar o observado, sem abrir bug) · **[DEV]** = precisa de passo do dev (banco, variável de ambiente ou disparo de cron) · **(neg)** = caso negativo.

**Preparação**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-01 | ADM | Configuração › Usuários: preencher "limite de desconto da taxa" e "da mensalidade" de VEN-A (10/10) e GC (20/20); criar o FIN-2 | Salva. Sem isso, todo desconto vai para aprovação (achado 13) [DEV/ADM] |
| FIN7-02 | ADM | Tentar aumentar a própria alçada | Recusa: "Outro administrador deve conceder aumento das suas permissões ou alçadas." |
| FIN7-03 | ADM | Financeiro › Política de comissão: publicar PERCENTUAL 10%, país/produto de teste, vigência agora; clicar de novo em publicar | Versão 1 listada; o segundo clique não cria versão 2 |
| FIN7-04 | ADM (neg) | Publicar uma nova versão com vigência no passado | "Publique a política com vigência atual ou futura." |
| FIN7-05 | VEN-A (neg) | Criar matrícula numa oferta sem política de comissão | "Configure a política de comissão desta oferta antes de matricular." |
| FIN7-06 | ADM | Configuração › Operação: conferir "prazo de conferência" (horas) | Valor padrão 48 h; é o tempo de suspensão dos lembretes após um informe |

**Acesso por papel**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-07 | FIN | Abrir Financeiro e conferir as abas | Cobranças, A conferir, Retomadas, Comissões, Descontos, Visão geral, Câmbio. Sem Política (sem a permissão) e sem Aprovações |
| FIN7-08 | GC | Clicar em Financeiro | Código: deve aparecer "Não foi possível carregar o financeiro" (achado 25). Se acontecer, abrir bug. Depois abrir `/financeiro/descontos` e `/financeiro/aprovacoes`: as duas carregam |
| FIN7-09 | SEC (neg) | Digitar `/financeiro` e `/financeiro/informes` | "Acesso negado" sem dados. Na ficha financeira do aluno aparece "Informar pagamento" [PO: R7] |
| FIN7-10 | VEN-A | Abrir `/alunos/<id>/financeiro` de um aluno próprio e depois de um aluno do VEN-B | Próprio: "Acompanhamento comercial" com preços e a própria comissão. Alheio: 404 |
| FIN7-11 | GP / PROF (neg) | Digitar `/financeiro`; GP abre `/financeiro/permuta` | `/financeiro`: acesso negado. Permuta (GP): só a confirmação de serviço, sem valores de cobrança |

**Fila de cobrança e régua**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-12 | FIN | Financeiro › Cobranças: clicar em cada cartão e buscar um aluno pelo nome | Os cartões filtram; a URL guarda o filtro; F5 mantém o recorte |
| FIN7-13 | FIN | Abrir uma cobrança com degrau devido › "Abrir WhatsApp"; fechar sem confirmar; reabrir | Abre `wa.me` com o telefone do pagador do contrato; nada fica registrado no histórico |
| FIN7-14 | FIN | Na mesma cobrança, "Confirmar envio" | O histórico mostra o passo (ex.: D+3); a fila avança para o próximo degrau |
| FIN7-15 | FIN (neg) | Cobrança de matrícula sem pagador/telefone › "Abrir WhatsApp" | "Sem destinatário: confira o pagador e o telefone desta matrícula." Não usa outro telefone |
| FIN7-16 | FIN | Registrar promessa para daqui a 3 dias; depois tentar uma data de ontem | A cobrança vai para "Promessas" e sai da ação do dia. Ontem: "A data prometida não pode ser no passado." |

**Informe, conferência e recebimento**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-17 | SEC | Ficha financeira › mensalidade › "Informar pagamento" parcial (ex.: 40 de 100), com comprovante | Informe "A conferir"; saldo da cobrança continua 100; matrícula inalterada |
| FIN7-18 | FIN (neg) | Fila › a mesma cobrança › "Abrir WhatsApp" | "Lembretes estão suspensos enquanto o pagamento está em conferência." |
| FIN7-19 | FIN | Financeiro › A conferir › "Confirmar recebimento" | Informe Confirmado; cobrança com recebido 40 e saldo 60; status continua Pendente/Atrasado; o contador da aba diminui |
| FIN7-20 | SEC → FIN (neg) | SEC informa outro pagamento; FIN clica em Rejeitar sem motivo; depois com motivo | Sem motivo, o botão fica desabilitado. Com motivo: Rejeitado, saldo inalterado, informe visível no histórico |
| FIN7-21 | ADM + SEC (neg) | SEC informa; ADM adiciona o papel FIN à SEC; a SEC tenta confirmar o próprio informe | "A conferência exige outra pessoa, mesmo quando você acumula papéis." [ADM prepara] |
| FIN7-22 | FIN (neg) | Ficha › "Registrar recebimento" acima do saldo, sem autorizar o excedente | "Autorize o registro do excedente como crédito." |
| FIN7-23 | FIN | Repetir o recebimento autorizando o excedente | Cobrança Paga; crédito criado; link para `/alunos/<id>/creditos/<creditoId>` |
| FIN7-24 | FIN | `/financeiro/recebimentos`: um valor repartido entre duas mensalidades do mesmo contrato, com evidência em cada destino | Um recebimento, duas cobranças com saldo reduzido. Total diferente do valor → "As destinações devem consumir exatamente o recebimento; o saldo deve virar crédito explícito." |
| FIN7-25 | FIN (neg) | `/financeiro/recebimentos`: destino maior que o saldo da cobrança | "A destinação excede o saldo devido; registre somente o saldo como cobrança e o restante como crédito." |
| FIN7-26 | FIN (neg) | Cobrança Paga: tentar renegociar e procurar uma ação de estornar o recebimento | Renegociar: "Cobrança paga ou cancelada não aceita ajuste." Estorno: não existe [PO] |
| FIN7-27 | SEC (neg) | Duplo clique rápido em "Informar pagamento" | Um só informe (idempotência) |

**Página pública `/pagar`**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-28 | Anônimo | Abrir `/pagar/abc` | "Link de pagamento inválido", com orientação para falar com a Secretaria |
| FIN7-29 | Anônimo | Abrir `/pagar/` + 48 caracteres hexadecimais inventados | "Link de pagamento expirado" |
| FIN7-30 | Anônimo [DEV] | O dev grava `gatewayRef` numa cobrança PENDENTE; abrir `/pagar/<token>` | Descrição (primeiro nome), valor, vencimento, "Pagamento em aberto" e "Pagamento online indisponível..."; **sem botão** |
| FIN7-31 | Anônimo [DEV] | O dev muda essa cobrança para PAGO e depois para CANCELADA | "Pagamento confirmado" / "Cobrança cancelada", sem valor nem botão |
| FIN7-32 | [DEV] (neg) | `POST /api/pagamentos/webhook/simulado` com `{"token":"<token>"}` | 404 `{"erro":"Pagamento simulado desabilitado."}`; cobrança inalterada [PO: liberar o gateway no UAT?] |
| FIN7-33 | VEN-A | Funil › oportunidade › taxa › colar um link e registrar | "Link de pagamento registrado."; aparece "Link atual: ..."; nenhum `/pagar` é gerado |

**Descontos e aprovações**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-34 | VEN-A | Resumo comercial › mensalidade › 5% de desconto | "Preço ajustado dentro da alçada." |
| FIN7-35 | VEN-A | Na mesma mensalidade, novo valor = 12% abaixo da referência | "Pedido encaminhado para aprovação independente." (12% acumulado > 10%); valor inalterado |
| FIN7-36 | GC | Financeiro › Aprovações › aprovar o pedido do FIN7-35 | Valor aplicado; histórico de negociação com autor e aprovação |
| FIN7-37 | GC (neg) | VEN-B (fora da equipe do GC) pede desconto acima do limite; GC abre Aprovações; depois o GC pede um desconto | O pedido do VEN-B e o do próprio GC não aparecem para o GC; os dois aparecem para o ADM, que decide |
| FIN7-38 | GC (neg) | VEN-A pede 30%; GC (20%) tenta aprovar | "Desconto acima da sua alçada. Encaminhe à direção."; o ADM aprova |
| FIN7-39 | VEN-A (taxa 5 / mensalidade 50) | 10% na taxa e 30% na mensalidade | Taxa → aprovação; mensalidade → aplicado direto (componentes separados) |
| FIN7-40 | GC (neg) | Pedido pendente; FIN registra um recebimento parcial nessa cobrança; GC aprova | "A cobrança mudou desde a solicitação. Envie um novo pedido." |
| FIN7-41 | FIN | Ficha › renegociar qualquer desconto (limite vazio) | "Ajuste acima do limite — enviado para aprovação."; FIN não tem a aba Aprovações [PO: kit diz "sem limite"] |
| FIN7-42 | ADM [DEV] | ADM pede perdão; um segundo ADM aprova | Cobrança Cancelada; FIN/VEN não veem a opção Perdão. Precisa de dois ADM |
| FIN7-43 | FIN | Desconto com vigência "Próximos meses" em uma mensalidade | O pedido/ajuste cobre todas as mensalidades abertas com vencimento igual ou posterior |
| FIN7-44 | GC / FIN | Financeiro › Descontos | Totais por moeda e por vendedor; GC vê só a própria equipe |

**Comissões**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-45 | VEN-A / VEN-B | Abrir `/comissoes` | Cada um vê só as próprias, com tipo (percentual/fixo), status e previsão de pagamento |
| FIN7-46 | FIN | Após uma ativação (área 04): conferir a comissão; aprovar um desconto na taxa | Comissão Aprovada = 10% da taxa; após o desconto, recalculada (percentual). Com política VALOR_FIXO, o valor não muda |
| FIN7-47 | FIN | `/comissoes` › "Fechar mês"; clicar de novo | Aprovadas → Pagas. Segundo clique: "Nenhuma comissão aprovada para pagar." |
| FIN7-48 | FIN (neg) | Estornar comissão Aprovada com motivo "Outro" sem detalhe; depois com detalhe; tentar estornar uma Paga | "Descreva o motivo." → Estornada → "Comissão já paga: o desconto no próximo fechamento ainda não existe." |
| FIN7-49 | ADM | `/comissoes` com usuário só ADM | O botão "Fechar mês" não aparece (achado 22); em `/financeiro/comissoes`, aparece |

**Acesso às aulas e retomada**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-50 | FIN [DEV] | Cobrança com 30 ou mais dias de atraso; o dev dispara `POST /api/whatsapp/cron`; FIN registra o pagamento | Após o tick: acesso restrito (automático). Após o pagamento: liberado |
| FIN7-51 | FIN → ADM (neg) | FIN solicita restrição manual com motivo; FIN tenta decidir; ADM decide; FIN registra pagamento | FIN não decide; ADM aprova; o pagamento não remove a restrição manual |
| FIN7-52 | SEC → FIN | Aluno pausado "legado" (uma matrícula, sem turma) [DEV]: SEC propõe retomada "reprogramar" com datas futuras; FIN de outra pessoa aprova com motivo | Antes: aluno Pausado, sem botão de aprovar para a SEC. Depois: Ativo; só as datas propostas aplicadas; pagamentos preservados |
| FIN7-53 | SEC (neg) | Retomada "reprogramar" com data de ontem; aluno com turma ou duas matrículas | Data passada recusada. Aluno com vínculos: "Use o fluxo contratual..." → Movimentações por matrícula |

**Permuta, crédito, continuidade e câmbio**

| ID | Papel | Passos | Resultado esperado |
|---|---|---|---|
| FIN7-54 | FIN → GP → FIN → FIN-2 | `/financeiro/permuta`: FIN prepara o acordo; GP confirma o serviço do período; FIN propõe a compensação; o mesmo FIN tenta decidir; FIN-2 aprova | O FIN autor não consegue decidir; FIN-2 aprova; o saldo da mensalidade cai sem criar recebimento |
| FIN7-55 | FIN → FIN-2 | Crédito do FIN7-23 › propor uso numa mensalidade, com concordância; FIN-2 decide | Proposta pendente; após a aprovação, o saldo da mensalidade é reduzido pelo crédito |
| FIN7-56 | FIN [DEV] | Abrir `/financeiro/continuidade` | Lista de estados (aguardar prazo, pronta, confirmação de oferta, regra a conferir), sem botão de emitir. A emissão só acontece com a variável ligada e o POST do dev |
| FIN7-57 | FIN | Financeiro › Câmbio: salvar CRC manual; Visão geral › consolidar em USD; "buscar automaticamente" | O consolidado aparece com "≈" e o aviso de referência; a busca automática sem internet mostra uma mensagem amigável; as cobranças não mudam de moeda |
| FIN7-58 | GC (neg) | Procurar a aba Câmbio e o botão de exportar no Financeiro | Câmbio não aparece para o GC; exportação financeira não existe [PO] |
