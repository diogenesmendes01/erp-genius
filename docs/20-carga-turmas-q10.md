# 20 — Carga única das turmas (ListadoCursos Q10)

> **Natureza:** carga **única** (one-shot), **não** é feature do produto. Fonte:
> `data/ListadoCursos.pdf` (fora do git). **Lote:** 27 turmas + 8 professores.

> ✅ **EXECUTADA.** 27 turmas (`T-000001`..`T-000027`) + 8 professores criados. Script
> descartável (`prisma/_carga-turmas-q10.ts`) **removido** após rodar (nasceu, rodou, morreu).
> **Alunos ainda NÃO vinculados** às turmas (vem do `ListadoMatriculas.pdf` — próxima carga).

## 1. De–para: coluna do PDF → campo `Turma`
| PDF | Campo | Transformação |
|---|---|---|
| Asignatura (ex.: "B2 Semi Intensivo") | `nivelId` + `modalidadeId` | **Separados.** Nível = A1…C2; modalidade mapeada pro **nosso nome** ("Semi Intensivo"→Semi-intensiva, "Intensivo"→Intensiva). **Sem modalidade → Regular** (pode ser erro de informação). |
| Curso (ex.: "10 S - Salvador") | `nome` (+ código origem) | "Curso" = **código de origem + nome**. Guardamos o **nome** (a escola batiza como quiser — usaram cidades/capitais do Brasil; não é sede). |
| Docente | `professorId` | 8 professores **criados** como `Usuario` (papel PROFESSOR, e-mail `nome.sobrenome@genius.com`, senha padrão). 1 turma sem docente → `null`. |
| Início / Finalización | `dataInicio` / `dataFim` | `dataFim` é **campo novo**. Datas gravadas ao **meio-dia** (evita off-by-one de fuso). |
| Cupo Máx | `capacidade` | Default **16** (mesmo em branco). |
| Estado "Abierto" | `status` | **Recalculado por data** (ver §2), não literal. |
| (constante) | `online` | `true` (campo novo; não há sede física — presencial é futuro). |
| — | `diasHorario` | `null` (será preenchido depois — info de dia/horário pendente). |
| — | `codigo` | `T-000001…` (Contador). |
| Nº Mat | — | Só contagem; **não** vincula alunos aqui (vem do ListadoMatriculas). |
| IH Total | — | Vazio na fonte. |

**Evento:** 1 `TurmaImportada` por turma (`agregadoTipo: "Turma"`), com payload de proveniência
(curso original, código origem, jornada, período, docente, status calculado).

## 2. Regra de status (decisão do usuário)
A partir de `hoje`: antes do início → **PLANEJADA**; **ABERTA** por **2 semanas** após o início
(**A1 = 1 mês**, por causa da entrada contínua do Pré A1 → `rolling=true`); depois **EM_ANDAMENTO**
até `dataFim`; passado o fim → **CONCLUIDA**. Resultado da carga: **19 CONCLUIDA · 8 EM_ANDAMENTO**.

## 3. Mudanças de schema (migration `turma_nome_online_datafim`)
`Turma`: + `nome?` · + `online (default true)` · + `dataFim?` · `diasHorario` agora **opcional** ·
`capacidade` default **12 → 16**.

## 4. Decisões registradas
- Nível e modalidade **separados** (não um campo só).
- Sem modalidade → **Regular** (assume erro de informação).
- **Não há "sede"** — em vez disso `online` × presencial.
- Sem dia/horário por ora (a buscar).
- **Alunos não vinculados** ainda (ListadoMatriculas = próxima carga).
- Mismatch geográfico **não existe**: nomes de turma são livres (a escola usou cidades do Brasil).
