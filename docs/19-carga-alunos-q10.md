# 19 — Carga única dos alunos (Estudiantes_Q10_2026)

> **Natureza:** carga **única** (one-shot), **não** é feature do produto. Roda uma vez,
> confere, descarta. Fonte: `data/Estudiantes_Q10_2026.xlsx` (PII — fora do git).
> **Lote:** 95 alunos, **100% Costa Rica** (todos CR01/CR02, celular +506, "Curso de Português").

> ✅ **EXECUTADA.** 95/95 importados (códigos `A-000001`..`A-000095`), todos CR · Ativo · com
> telefone `+506…` normalizado · email · gênero (62 M / 33 F). 95 eventos `ALUNO_IMPORTADO`.
> Migration `aluno_genero_email` aplicada. Script descartável (`prisma/_carga-q10.ts`) e o dep
> `xlsx` foram **removidos** após rodar (nasceu, rodou, morreu). Ajustes de código da §4
> implementados (ficha mostra E-mail/Gênero; form de matrícula captura; telefone normalizado em
> matrícula **e** lead). Decisões da §5 confirmadas conforme recomendado. **Sem turma/matrícula
> ainda** (acadêmico = 2ª carga, dos PDFs).

---

## 1. Mecanismo — como rodar "uma vez só"

Eu **não tenho acesso ao banco** do projeto (o `DATABASE_URL` mora no seu `.env`, que é
gitignored e não some pro sandbox). Então "eu importo" precisa de **um** destes caminhos:

| Opção | O que é | Prós / Contras |
|---|---|---|
| **A. Arquivo de carga descartável** (recomendado) | Um `.ts` one-shot (ex.: `prisma/_carga-q10.ts`) que roda com `npx tsx` **uma vez** e a gente **apaga** logo depois | Usa o Prisma Client → resolve cuid, `Contador`, `Evento` e o `paisId` por `codigoISO` automaticamente. **Não** vira feature: é throwaway. |
| B. SQL puro (`INSERT`s) | Eu gero um `.sql`, você roda 1x | "Não é script", mas precisa de subselects p/ `paisId`, e gerar PK/`Contador`/`Evento` na mão fica frágil. |
| C. Eu conecto no banco | Você me passa a `DATABASE_URL` (se for Neon/Supabase) e eu insiro do sandbox | Literalmente "eu importo 1x". **Expõe credencial + PII** → não recomendo. |

> "Não quero um script de importação" = não construímos um **importador permanente** no
> produto. O arquivo da opção A é só o veículo da carga única — nasce, roda, morre.

---

## 2. De–para: coluna da planilha → campo do Aluno

| Planilha | Campo `Aluno` | Transformação |
|---|---|---|
| Primer_nombre + Segundo_nombre + Primer_apellido + Segundo_apellido | `nome` | Concatena os 4, ignora vazios, colapsa espaços, `trim`. Ex.: "Adrián Monge Sojo" |
| Fecha_nacimiento | `nascimento` | `new Date(...)` |
| Genero (M/F) | `genero` | `M→MASCULINO`, `F→FEMININO` |
| Numero_identificacion | `documento` | Texto cru (formatos variados "304080258", "8822-1381" → guardar como veio) |
| — | `documentoValido` | `false` (validador `cedula_cr` ainda não implementado — doc 04) |
| Email | `email` | Cru |
| Celular | `telefoneE164` | `normalizarTelefoneE164(celular, pais.ddi)` → `+506…` |
| (constante CR) | `paisId` | `SELECT Pais WHERE codigoISO='CR'` |
| — | `codigo` | `gerarCodigo("aluno")` → `A-000001…` (incrementa o `Contador`) |
| — | `status` | `ATIVO` |
| — | `criadoEm` | `now()` (data do registro no sistema; **não** é a Fecha_matricula) |

**Geração de evento (auditoria):** para cada aluno, gravar 1 `Evento`
`tipo: "ALUNO_IMPORTADO"`, `agregadoTipo: "Aluno"`, `agregadoId`, `autorId` = admin,
`payload: { origem: "Estudiantes_Q10_2026", linha: N }`. Mantém a regra "toda mutação
relevante grava Evento na mesma transação".

---

## 3. O que NÃO entra nesta carga (e por quê)

| Dado | Motivo |
|---|---|
| **Matrícula, nível (A1/A2/B1/B2), jornada/turma** | É a parte **acadêmica** — vem dos outros 2 arquivos (`ListadoMatriculas.pdf`, `ListadoCursos.pdf`) cruzados com o catálogo/turmas. **2ª carga**, depois de ler esses PDFs. → até lá, os 95 alunos ficam **"sem turma"** na ficha (esperado). |
| **Responsável (Familiares_relacionados)** | Coluna **vazia** (0/95) — são adultos (nascidos 1973–1992). Nada a importar. |
| **Telefone fixo (Telefono, 9/95)** | Modelo tem **um** campo de telefone. Usamos o **Celular** (95/95). O fixo é redundante/raro → descartado. |
| **Codigo_estudiante** | Você pediu para ignorar. |
| **CR01 vs CR02 (tipo de doc)** | Estrutura atual guarda só o **número** (`documento` flat). O tipo não é persistido por aluno — decisão "usar nossa estrutura". |
| Direccion, Lugar_nac/res, Grupo, Sede(001), Programa, Periodo | Vazias ou constantes → nada a perder. |

---

## 4. Ajustes de CÓDIGO (front + back) para os campos novos aparecerem

> A migration **não quebra nada** (campos opcionais). Estes ajustes são para
> **exibir** (`genero`, `email`) e **capturar** quando um humano cria aluno na mão,
> além de cumprir a regra de **telefone E.164 + máscara**.

### 4.1 Back-end

**`src/server/matricula/schema.ts`** — adicionar ao `MatriculaSchema`:
```ts
alunoEmail: z.union([emailSchema, z.literal("")]).optional(),
alunoGenero: z.nativeEnum(Genero).optional(),
```

**`src/server/matricula/acoes.ts`** (bloco `tx.aluno.create`, ~linha 85) — passar os novos
campos e **normalizar o telefone**:
```ts
email: dados.alunoEmail || null,
genero: dados.alunoGenero ?? null,
telefoneE164: normalizarTelefoneE164(dados.alunoTelefone, pais.ddi),
```
…e o mesmo `normalizarTelefoneE164(..., pais.ddi)` no telefone do **responsável**.

**`src/server/alunos/consultas.ts`** — `obterAluno` já retorna o `aluno` inteiro (sem
`select`), então `email`/`genero` **já vêm**. **Nenhuma mudança de query.**

### 4.2 Front-end

**`src/app/(app)/alunos/[id]/page.tsx`** — no objeto `ficha`, adicionar:
```ts
email: aluno.email,
genero: aluno.genero,
```

**`src/app/(app)/alunos/[id]/FichaAluno.tsx`** — no tipo `AlunoFicha` (linhas ~31-33) e no
render (perto de Documento/Nascimento, ~linha 168): 2 linhas novas **Email** e **Gênero**
(mapear enum → rótulo PT: Masculino/Feminino/Outro/—).

**`src/app/(app)/matriculas/nova/MatriculaFormulario.tsx`** — 2 controles novos:
- `email` (input texto) + `genero` (select),
- incluir ambos no payload do submit.

### 4.3 Telefone — E.164 + máscara

- **Mínimo (back):** aplicar `normalizarTelefoneE164` no submit (item 4.1) → garante que,
  mesmo digitando com espaço/traço, salva sempre `+506…`. Vale para matrícula **e** lead.
- **Polimento (front, opcional):** trocar o input livre `+506...` por uma **máscara** que
  usa o DDI do país selecionado e formata visualmente, guardando E.164 por baixo.

### 4.4 Fora de escopo
- **Lista de alunos** (`AlunosLista`): não mostra email/gênero → **sem mudança** (opcional no futuro).

---

## 5. Decisões em aberto (confirmar antes de executar)

1. **Evento por aluno na carga** — gravar `ALUNO_IMPORTADO` por aluno? (recomendado: sim).
2. **Telefone fixo descartado** (usamos só o Celular) — ok?
3. **CR01/CR02 não persistido** (só o número do documento) — ok com "nossa estrutura"?
4. **Nome concatenado** (perde a estrutura primer/segundo apellido) — ok?
5. **`criadoEm = agora`** (Fecha_matricula vai pro módulo de matrícula, 2ª carga) — ok?
6. **Mecanismo:** opção **A** (arquivo descartável `npx tsx`, depois apagamos)?

---

## 6. Ordem de execução sugerida

1. Você roda a migration: `npx prisma migrate dev --name aluno_genero_email`.
2. Carga única dos **95 alunos** (este doc) → confere no Prisma Studio / na tela de Alunos.
3. Ajustes de interface (seção 4) — ficha mostra Email/Gênero; form captura; telefone normaliza.
4. (Depois) Ler `ListadoMatriculas.pdf` + `ListadoCursos.pdf` → 2ª carga: matrícula/nível/turma.
