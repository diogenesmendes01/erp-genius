# 21 — Carga única dos rosters (EstudiantesCurso Q10)

> **Natureza:** carga **única** (one-shot). Fonte: `data/EstudiantesCurso.pdf` (PII, fora do git).
> Vincula **aluno ↔ turma** (`AlocacaoTurma`) — o elo que faltava após as cargas 19 (alunos) e 20 (turmas).

> ✅ **EXECUTADA.** **106 alocações**, **12 alunos novos** (A-000096..A-000107), **26 contatos
> atualizados**. Script descartável (`prisma/_carga-rosters-q10.ts`) **removido** após rodar.

## 1. O que o arquivo traz
Por curso (= turma): cabeçalho (Curso, Asignatura, Docente, datas, jornada) + **lista de alunos**
(documento, celular, e-mail). Bate 1:1 com as 27 turmas da carga 20.

## 2. Regras aplicadas (decisões do usuário)
| Tema | Decisão |
|---|---|
| **Match aluno** | Por **documento normalizado** (sem prefixo C.C./PP, só alfanumérico). 71 já existiam → vinculados. |
| **Alunos novos** | **Criados** (12) — país pelo **DDI do celular** (+506 CR / +507 PA / +503 SV). Sem gênero/nascimento (não há na fonte); nome no formato da fonte (apelido primeiro). |
| **Existentes** | **Atualizado** e-mail/telefone quando diferia (26). Demais campos (nome/gênero/nascimento) preservados do xlsx. |
| **Telefone** | `+` + dígitos do celular (já trazem o código do país). |
| **Alemanha (+49)** | **Pulada** (Avila Vitor). |
| **Linhas de teste** | **Puladas** (e-mail contém "teste" → 3 linhas). |
| **Professores** | Mantidos (atualização futura). |
| **Alocação `ativa`** | `false` se turma **CONCLUIDA**; `true` caso contrário (20 ativas). |
| **Turma resolvida** | Por `cursoOriginal` + `asignatura` (gravados no evento `TurmaImportada`). 0 não encontradas. |
| **Escopo** | Só **alocação** (quem está em qual turma). **Sem** Matrícula financeira (cobrança/comissão). |

**Evento:** `AlunoVinculadoTurma` por alocação; `ALUNO_IMPORTADO` (origem EstudiantesCurso) por aluno novo;
`AlunoEditado` (motivo "Carga EstudiantesCurso") quando atualizou contato.

## 3. Observações
- **Progressão de nível:** vários alunos aparecem em mais de uma turma (ex.: A1→A2; B1→B2→C1) → múltiplas alocações (a CONCLUIDA fica inativa, a vigente ativa).
- **Multi-país real:** os rosters confirmam alunos de CR/PA/SV (e 1 da Alemanha, descartado). Os 95 do xlsx (CR) eram um subconjunto.
- **24 turmas com alunos; 3 vazias** (Manaus A1, São Paulo A2, A1 Salvador — tinham N° Mat 0 na fonte).
- **Lixo pré-existente do xlsx (carga 19) — REMOVIDO** (decisão do usuário, delete físico): `A-000091 Vitor Avila` (Alemanha, telefone malformado) + 3 alunos de teste (`A-000024/050/051`) e seus eventos. **Total final: 103 alunos.**
