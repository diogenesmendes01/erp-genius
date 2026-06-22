# Regras de Sistema — cross-cutting (antes do código)

> Regras que atravessam todos os módulos. Travadas antes de codar.

## 1. Máquinas de estado

### Lead (quem dispara cada transição)
```
Novo (sistema cria) → Em Atendimento (vendedor) → Qualificado (vendedor) →
Experimental Agendada (vendedor) → Experimental Realizada (professor, check-in) →
Proposta (vendedor) → Aguardando Matrícula (vendedor) → Matriculado (matrícula ativada)
```
Saídas paralelas: **Perdido** (vendedor, com motivo) · **No-show** (professor, check-in).

### Aluno
`Ativo ⇄ Pausado` · `Ativo → Encerrado`.

### Matrícula
`Rascunho → Aguardando → Ativa → Encerrada`. **Ativa** quando **Contrato OK + Taxa paga +
1ª mensalidade paga** (`contratoOk && pagamentoTaxaOk && primeiraMensalidadeOk` — decisão P7,
doc 15); Admin/Gerente pode ativar com pendência (`ativadaComPendencia`).
(`Cancelada` = encerramento precoce — dispara estorno de comissão, ver §3.)

### Cobrança
`Pendente → Paga` · `Pendente → Vencida → Paga` · `Cancelada`.
(No schema: Vencida = `ATRASADO`.)

### Comissão
`Pendente → Aprovada → Paga` · `Estornada`.

### Turma
`Planejada → Aberta → Em andamento → Concluída` (enum `StatusTurma`: `PLANEJADA · ABERTA ·
EM_ANDAMENTO · CONCLUIDA`).

## 2. Permissões (matriz autoritativa)

| Papel | Pode | Não pode |
|---|---|---|
| **Vendedor** | Criar/editar lead · agendar experimental · criar matrícula · **solicitar** desconto | Encerrar aluno · alterar cobrança · **aprovar** desconto |
| **Secretaria Acadêmica** | Criar aluno · trocar turma · pausar · reativar · encerrar · registrar pagamento | Renegociar/aprovar |
| **Professor** | Ver turmas · ver alunos · **check-in** experimental | Nada além disso |
| **Financeiro** | Registrar pagamento · criar ajuste · cobrar aluno · ver aluno | Movimentação acadêmica |
| **Gerente Comercial** | Tudo do vendedor + **aprovar desconto** · **redistribuir leads** · **aprovar comissão** | Config de sistema |
| **Gerente Pedagógico** | Decide turma/progressão · movimentações acadêmicas | Financeiro |
| **Administrador** | **Tudo** | — |

## 3. Comissão
- **Geração:** criada **Pendente** na criação da matrícula; vira **Aprovada** quando a matrícula
  é **Ativada**; vira **Paga** no fechamento mensal.
- **Valor:** `taxa de matrícula × percentual do vendedor` (recalcula só se a taxa mudar — doc 09).
- **Estorno:** matrícula **cancelada antes de 30 dias** → comissão **Estornada** *(regra; gatilho
  automático de cancelamento é Fase 1+ — ver doc 12 "reservados")*.
- **Pagamento:** mensal — **fechamento dia 30 · pagamento dia 05** *(cron é Fase 1+; hoje o
  fechamento é manual em Financeiro → "Fechar mês e marcar pagas")*.

## 3.1 Matrícula sem preço de referência ativo (issue #22)
- **Decisão:** **permitida**, mas como **exceção auditável** — nunca segue silenciosa.
- Quando **não há `PrecoReferencia` ativo** para a combinação **país × produto × tipo**
  (taxa de matrícula e/ou 1ª mensalidade), a criação da matrícula **exige justificativa**.
  Sem justificativa → **bloqueio no backend** com mensagem clara (`ErroRegra`).
- Com justificativa: a matrícula é marcada (`precoReferenciaAusente = true`,
  `justificativaSemPreco`) e grava o Evento **`MatriculaSemPrecoReferencia`** (autor +
  tipos ausentes + justificativa + valores manuais).
- **UI** diferencia três estados por linha de cobrança: **Sugerido** (= referência ativa),
  **Manual** (= diverge da referência) e **Sem tabela** (= ausência da matriz de preços).
- Racional: o catálogo é global e a **matriz de preços pode estar incompleta** por país/produto
  (doc 06 §Em aberto); bloquear de vez travaria operações legítimas, então preservamos a
  operação **com rastro de auditoria** (alinhado a §9).

## 4. Jobs automáticos (cron diário) — **Fase 1+**
> Na Fase 0 **não há cron**: inadimplência, métricas e fila da Home são calculadas
> **on-the-fly** na leitura (ver `home/consultas.ts`, `financeiro/consultas.ts`); o cronograma
> de mensalidades é gerado **na criação da matrícula** (V0). Os jobs abaixo entram na Fase 1+.
- **00:05** — gerar mensalidades futuras *(rede de segurança)*.
- **01:00** — atualizar **inadimplência** (Pendente → Vencida quando vencimento passou).
- **02:00** — atualizar **métricas**.
- **03:00** — atualizar **fila comercial** (prioridades da Home).

## 5. Notificações (lista fechada — nada além disso)
**Lead novo · Experimental realizada · Desconto aprovado · Cobrança vencida · Comissão aprovada.**

## 6. Exclusão — PRINCÍPIO: ninguém apaga nada (nunca)
Soft-delete via status (alinhado à filosofia de evento/auditoria):
- Lead → **Perdido** · Aluno → **Encerrado** · Cobrança → **Cancelada** · Usuário → **Inativo** ·
  Documento → **Arquivado** · Preço → **inativo** (supersede) · Produto-no-país → `oferecido=false`.
- Nenhum `DELETE` físico de **entidade de negócio / histórico**. A história é preservada.
- **Exceção permitida:** substituição de **conjuntos de configuração sem histórico** (ex.: os
  tipos de documento de um país são recriados ao editar o país). Não são registros de negócio
  nem auditáveis — só a lista vigente importa.

## 7. Identificadores legíveis
Código humano por entidade, gerado por uma tabela `Contador` transacional:
`Lead L-000001 · Aluno A-000001 · Matrícula M-000001 · Cobrança C-000001 · Turma T-000001`.
(PK continua sendo `cuid`; o código é o identificador de operação.)

## 8. Busca global
Pesquisar por **nome · telefone · email · documento · código** → abre o registro direto.

## 9. Auditoria — Evento OBRIGATÓRIO para:
Troca de etapa · troca de turma · pausa · reativação · encerramento · pagamento ·
desconto · bolsa · perdão · comissão · **matrícula sem preço de referência ativo** (§3.1).
> Cada um grava um `Evento` (autor · agregado · antes→depois · versão).

## 10. Métricas (fórmulas)
- **Conversão** = matriculados ÷ leads criados.
- **SLA** = lead respondido em até **X minutos** (1º contato).
- **Receita prevista** = cobranças pendentes + pagas (do período).
- **Inadimplência** = valor vencido ÷ valor faturado.

## Dono do lead (regra congelada)
- Todo lead tem **um dono**.
- **Até 90 dias** sem interação → continua com o **vendedor original**.
- **Após 90 dias** → pode **voltar para a fila**, por decisão do **gerente**.
