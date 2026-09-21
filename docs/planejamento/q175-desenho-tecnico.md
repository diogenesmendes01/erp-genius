# Q175 — correção de aula particular "não devia ser cobrada": desenho técnico

Estado em 21/09/2026: **opção A escolhida pelo usuário; fatia 1 implementada e verificada em banco real; fatia 2 (horas pré-pagas) pendente.** Decisões em [decisoes-2026-09-21.md](decisoes-2026-09-21.md). Este documento fixa o desenho para que a implementação possa ser feita em fatias verificáveis.

## O que o código permite hoje

- A correção Q23 (`src/server/diario/correcao-aula*.ts`) só expressa `conteudo` e `participacao` (`PRESENTE`/`FALTA`/`IMPEDIDO_POR_RESTRICAO`). O guard SQL da proposta (`20260915033000`) exige snapshot `versao = 1` com chaves fixas. Aprovar apenas insere `AprovacaoCorrecaoAula`; a correção publicada é lida por projeção.
- Aula particular com ocorrência ou reserva exige revisão financeira independente (`src/server/financeiro/revisao-correcao-aula.ts`), cujo único tipo é `SEM_ALTERACAO_VALORES`. Toda a validação (proposta, decisão e a aprovação acadêmica, no trigger `AprovacaoCorrecaoAula_00_financeira_257`) passa por `q23_foto_financeira_valida_257`, que recalcula `q23_fotografia_financeira_atual_257` (definição vigente em `20260918170000`). Esse trigger já é o ponto de atomicidade entre as duas aprovações.
- O valor da aula nasce em `ConferenciaOcorrenciaHoras` (minutos, valor, desfecho), vira `ItemFechamentoHoras` → `EmissaoFechamentoHoras` → `Cobranca HORA_PARTICULAR`, ou consome `ReservaHorasCompradas` via `ConsumoHorasCompradas`. Conferência, item e consumo são imutáveis (append-only).

## Escolha de desenho

**O "não cobrável" é declarado na revisão financeira, não no snapshot acadêmico.** A proposta Q23 continua sendo uma correção de conteúdo/participação (o proponente registra no conteúdo que a aula não ocorreu por motivo da escola ou foi lançada por engano); a revisão financeira ganha o tipo `AULA_NAO_COBRAVEL`, com fotografia própria. Motivos: não reabre os guards do snapshot acadêmico (`033000`, `040000`/208, projeção e comparação), preserva as duas alçadas independentes já exigidas e reaproveita o trigger de atomicidade existente. Limite assumido: o encontro permanece `MINISTRADO` na agenda; mudar o status do encontro é outra frente.

## Fatias

### Fatia 1 — aula cobrada por fechamento (sem reserva)

1. **SQL** (uma migration):
   - `q23_fotografia_nao_cobravel_175(_proposta_id)`: mesma âncora e ordem de locks da 257 (advisory `calendario-escola` → encontro → matrícula); exige proposta Q23 vigente e pendente, aula particular **sem** `ReservaHorasCompradas`, última `OcorrenciaParticular` `REALIZADA` ou `FALTA_ALUNO` com `ConferenciaOcorrenciaHoras` de `valor > 0` (desfecho `REALIZADA`/`FALTA_COBRAVEL`), e nenhuma aplicação anterior para a conferência. Serializa `tipo: "AULA_NAO_COBRAVEL"`, ocorrência, conferência, condições, item/emissão/cobrança (com versão, valores, informes, recebimentos, destinações) e o **efeito calculado**: `SEM_ITEM`, `REDUZ_COBRANCA_ABERTA` (novo valor negociado e saldo) ou `GERA_CREDITO` (valor do crédito). Recusa (NULL) cobrança com crédito/permuta aplicados, em pausa, com `AjusteCobrancaAcerto`, fatura B2B ou encerramento em curso.
   - `q23_foto_financeira_valida_257` passa a despachar por `_foto->>'tipo'`.
   - `AplicacaoRevisaoFinanceiraCorrecaoAula` (única por decisão e por aprovação; `conferenciaId`, `cobrancaId?`, valores anterior/novo, `creditoNovo`, fotografia) + `OrigemCreditoRevisaoCorrecaoAula` + `CreditoMatricula.origemRevisaoCorrecaoAulaId`.
   - Recriar `credito_matricula_origem_unica_check` com a 8ª origem, incluir a origem no trigger `q165_delta_reconhecimento_guard_249` e em `proteger_saldo_credito_cobranca`; guard "crédito = origem".
   - Trigger **DEFERRED** em `AprovacaoCorrecaoAula`: revisão `AULA_NAO_COBRAVEL` aprovada ⇒ aplicação na mesma transação, e vice-versa.
2. **TypeScript**:
   - `proporRevisaoFinanceiraCorrecaoAula` recebe `tipo` explícito (`SEM_ALTERACAO_VALORES` | `AULA_NAO_COBRAVEL`); nunca escolhe o tipo por fallback.
   - `aplicarRevisaoFinanceiraCorrecaoAulaTx` (novo arquivo em `src/server/financeiro/`), chamado dentro de `aprovarCorrecaoAula` logo após `aprovacaoCorrecaoAula.create` (`src/server/diario/correcao-aula.ts:118-127`), no mesmo `$transaction`, com `bloquearMatriculas` e `FOR UPDATE` na cobrança. Crédito segue o padrão de `aditivo-acerto-taxa-acoes.ts:93`.
   - `fechamento-horas-tx.ts:104-108`: o fechamento passa a usar o valor efetivo (conferência com aplicação vale zero).
   - Enumerações de origem de crédito: `recebimentos.ts:89,118`, `desistencia-financeiro-tx.ts`, `desistencia-reconferencia-delta-fontes.ts`.
   - UI: `matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/` (escolha do tipo, exibição do efeito calculado; o texto "não cria crédito" deixa de ser verdadeiro).
3. **Testes**: integração sobre os fixtures de `condicoes-horas.int.test.ts` (`prepararPreviaFinanceira`, `emitirCobrancaDaPrevia`, `registrarPagamento`) e `q23-consumo-horas.int.test.ts` (`proporQ23`, `prepararEAprovarRevisao`, `publicarCorrecao`): os três efeitos, autoaprovação, fotografia obsoleta por pagamento concorrente, aplicação sem aprovação e aprovação sem aplicação (trigger diferido).

### Fatia 2 — aula paga com horas pré-pagas

`EstornoConsumoHorasCompradas` (append-only, único por consumo, vinculado à aplicação); `saldo-horas.ts` soma os minutos estornados na validade da própria compra; a fotografia 175 ganha o ramo com reserva consumida e o efeito `DEVOLVE_MINUTOS`. Nenhum dinheiro se move.

### Fora do recorte

Duração errada, aumento de valor (cobrança complementar), transições de `IMPEDIDO_POR_RESTRICAO`, comissões sobre a aula zerada e mudança do status do encontro na agenda.

## Fatia 1 — entregue em 21/09/2026

Migration `20260921040000_correcao_aula_nao_cobravel`; `src/server/financeiro/revisao-correcao-aula-aplicacao-tx.ts` (aplicação atômica chamada por `aprovarCorrecaoAula`); `revisao-correcao-aula.ts` (tipo explícito, candidatas com tipos disponíveis e efeito calculado); `correcao-aula-impactos-tx.ts` (declarada a aula não cobrável, a publicação exige a revisão vinculada mesmo sem mudança de presença); `fechamento-horas*.ts` (destinação `NAO_COBRAVEL_CORRECAO`, preservada fora da nova cobrança); desistência reconhece a oitava origem de crédito sem alterar hashes anteriores; tela de revisões financeiras com escolha do tipo e descrição do efeito.

Diferenças em relação ao desenho: a fatura quitada **não é alterada** — o crédito nasce ao lado dela —, então `proteger_saldo_credito_cobranca` e `recebimentos.ts` não precisaram mudar; cobrança em aberto que fica com valor zero passa a `CANCELADA`; pagamento parcial, crédito, permuta, comprovante a conferir, pausa ou acerto de encerramento fazem a fotografia recusar (conferência financeira específica).

Verificação: três cenários de integração em `condicoes-horas.int.test.ts` (aula ainda não fechada + fechamento seguinte; cobrança em aberto reduzida/cancelada com aprovação direta sem acerto desfeita pelo trigger diferido; cobrança paga → crédito com origem, revisão tornada obsoleta pelo pagamento, crédito sem origem recusado); regressão de integração 107/107 em correção de aula, consumo Q23, condições por hora, fechamento e desistência financeira; unitários 2.134/2.134; TypeScript e ESLint sem erros.

Limites conhecidos: o encontro permanece `MINISTRADO` na agenda (opção A); comissões sobre a aula zerada não são recalculadas; a desistência recusa reconhecer crédito desta origem como crédito do acerto (tratado como externo).
