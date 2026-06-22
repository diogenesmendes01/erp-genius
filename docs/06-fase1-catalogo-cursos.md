# Fase 1 — Catálogo e Estrutura de Cursos

> Estrutura real da Genius (escola de idiomas online, hoje só português).
> Aterrissa o catálogo, os níveis e o conceito de turma.

## Modalidades

A modalidade define o ritmo, a duração e o **nº de aulas** de cada nível.

| Modalidade | Frequência | Duração/nível | Aulas/nível |
|---|---|---|---|
| **Regular** | 1x/semana · 2h | 3 meses | **12** |
| **Semi-intensiva** | 2x/semana · 2h | 2 meses | **16** |
| **Intensiva** | 3x/semana · 2h | 1 mês e meio | **18** |
| **Super-intensiva** | 5x/semana · 2h | **1 mês** | **20** |
| **Particular** | **critério do aluno** | — | — |

> **Pré A1** (1 mês, só Regular/Semi): **Regular 4 aulas · Semi-intensiva 8 aulas**.
> Curso completo = soma dos níveis A1→C2 (+ Pré A1 em Regular/Semi).

> **Kids/Teens = modalidades próprias** (ex.: **Kids Regular** mín. 5 · **Kids Intensivo** mín. 4). O **segmento**
> (Adulto/Kids/Teens/Empresa) responde *quem*; a **modalidade** responde *como o curso funciona* — então o
> **mínimo para abrir vive na modalidade**, sem exceção por segmento.

## Níveis / Módulos (base CEFR)

```
Pré A1  → A1 (Básico 1) → A2 (Básico 2) → B1 (Inter. 1) → B2 (Inter. 2) → C1 (Avançado 1) → C2 (Avançado)
```

### Regra do Pré A1 (porta de entrada sempre aberta)
- Existe para **encaixar alunos que chegam depois da turma começar** (4 aulas de temas gerais, ~1 mês).
- **Regular e Semi-intensiva passam pelo Pré A1** (Regular = 4 aulas; Semi = 8 aulas).
- **Intensiva, Super-intensiva e Particular NÃO passam** — começam direto no **A1**.
- Modelar como **turma de entrada rolling**, só para Regular/Semi.

## Aulas particulares (caso especial)
- Cobradas **por hora**.
- Valor **negociável**.
- Sem Pré A1, sem turma fixa — agendamento individual.
- No modelo, é um **tipo de produto separado** (preço por hora, não mensalidade de turma).

## Turma (cohort online)
- Uma turma = **modalidade × nível × data de início × cronograma**.
- O aluno é **alocado em uma turma por nível** e avança para a turma do próximo nível ao concluir.
- É online (sem sala física), mas tem leva/colegas e calendário.

## Jornada do aluno (CONFIRMADO)
- A **matrícula/contrato é da jornada inteira**: o aluno paga **taxa de matrícula** (uma vez)
  + **mensalidade** (recorrente) e **avança de nível dentro do mesmo contrato**.
- A **turma é a alocação por nível**, que muda conforme a progressão.
- **Não há rematrícula entre níveis** — a progressão é contínua no mesmo contrato.

## Rematrícula = retorno de ex-aluno
- Na prática **não existe rematrícula** de renovação.
- Único caso: **ex-aluno que cancelou o contrato, ficou fora e volta** → nova matrícula,
  mas o cadastro da pessoa já existe (reaproveita histórico).

## Pagamento (situação atual)
- **Costa Rica:** **GreenPay** (https://greenpay.me/) — link de pagamento. Uso ainda em planejamento.
- **Demais países:** **transferência global** (transferência bancária), com **conferência manual** do comprovante.
- Implicação: fora da Costa Rica, a **confirmação manual de pagamento é a regra, não a exceção**.
  O sistema precisa tratar bem o estado de "pagamento em conferência".
- A definir na Fase 2: como/se ampliar o GreenPay (ou outro gateway) para mais países.

## Acréscimos ao modelo de dados

> ⚠️ **Esboço do brainstorm — não é o schema final.** No modelo implementado:
> `Modalidade` tem `segmento`; **não há `ModalidadeNivel`** (a regra do Pré A1 vive em
> `Turma.rolling` + `Modalidade`); `AlocacaoTurma` é por **`alunoId`** (não `matriculaId`);
> **não há `ProdutoParticular`** (Particular é uma `Modalidade`, e o preço/hora é um
> `PrecoReferencia` com `tipoCobranca = HORA_PARTICULAR`). Referência fiel: [`11-modelo-de-dados.md`](11-modelo-de-dados.md).

```
Idioma          (id, nome)                                  # Português (hoje); outros no futuro
Modalidade      (id, nome, frequencia, horasAula, duracaoPorNivel, aulasPorNivel, minimoAbrir)
Nivel           (id, idiomaId, codigo, ordem)               # PréA1, A1, A2, B1, B2, C1, C2
ModalidadeNivel (modalidadeId, nivelId, passaPreA1)         # regra de quem faz Pré A1

Turma           (id, modalidadeId, nivelId, dataInicio, cronograma, status)
AlocacaoTurma   (id, matriculaId, turmaId, nivel, status)   # aluno na turma de cada nível

# Particular é produto à parte:
ProdutoParticular (id, precoHoraReferencia, moeda, negociavel=true)
```

## Habilitação por país (refinamento)
O **catálogo é global** (todos os produtos existem). Cada **país habilita um subconjunto**:
**idiomas habilitados** + **modalidades habilitadas** + status. O preço de referência é por
**país × idioma × modalidade** (taxa de matrícula + mensalidade). Configurado em Configuração → Países/Catálogo.

## Em aberto
- ✅ Contrato cobre a **jornada inteira** (confirmado).
- **Matriz de preços** (única coisa que falta pra fechar a Fase 1): mensalidade por
  **modalidade × país**, **taxa de matrícula** por país, preço/hora do **Particular**.
- Fase 2: estratégia de gateway (ampliar GreenPay ou adotar outro) para reduzir a
  dependência de transferência manual fora da Costa Rica.
