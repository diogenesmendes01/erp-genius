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
`Rascunho → Aguardando → Ativa → Encerrada`. **Ativa** quando **Contrato OK + Pagamento OK**.
(`Cancelada` = encerramento precoce — dispara estorno de comissão, ver §3.)

### Cobrança
`Pendente → Paga` · `Pendente → Vencida → Paga` · `Cancelada`.
(No schema: Vencida = `ATRASADO`.)

### Comissão
`Pendente → Aprovada → Paga` · `Estornada`.

### Turma
`Planejada → Aberta → (Em andamento) → Encerrada`.

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
- **Geração:** quando a **Matrícula vira Ativa** → comissão criada.
- **Valor:** `taxa de matrícula × percentual do vendedor`.
- **Estorno:** matrícula **cancelada antes de 30 dias** → comissão **Estornada**.
- **Pagamento:** mensal — **fechamento dia 30 · pagamento dia 05**.

## 4. Jobs automáticos (cron diário)
- **00:05** — gerar mensalidades futuras *(rede de segurança; o cronograma já é gerado na ativação)*.
- **01:00** — atualizar **inadimplência** (Pendente → Vencida quando vencimento passou).
- **02:00** — atualizar **métricas**.
- **03:00** — atualizar **fila comercial** (prioridades da Home).

## 5. Notificações (lista fechada — nada além disso)
**Lead novo · Experimental realizada · Desconto aprovado · Cobrança vencida · Comissão aprovada.**

## 6. Exclusão — PRINCÍPIO: ninguém apaga nada (nunca)
Soft-delete via status (alinhado à filosofia de evento/auditoria):
- Lead → **Perdido** · Aluno → **Encerrado** · Cobrança → **Cancelada** · Usuário → **Inativo**.
- Nenhum `DELETE` físico no banco. A história é preservada.

## 7. Identificadores legíveis
Código humano por entidade, gerado por uma tabela `Contador` transacional:
`Lead L-000001 · Aluno A-000001 · Matrícula M-000001 · Cobrança C-000001 · Turma T-000001`.
(PK continua sendo `cuid`; o código é o identificador de operação.)

## 8. Busca global
Pesquisar por **nome · telefone · email · documento · código** → abre o registro direto.

## 9. Auditoria — Evento OBRIGATÓRIO para:
Troca de etapa · troca de turma · pausa · reativação · encerramento · pagamento ·
desconto · bolsa · perdão · comissão.
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
