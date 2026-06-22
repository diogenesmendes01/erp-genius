# 22 — Carga única: acadêmica + financeira (Q10)

> **Natureza:** carga **única** (one-shot). Fontes (PII, fora do git):
> `Estudiantes__Informacion_academica.xlsx` (190) e `Planilha de cobrança .xlsx - COBRANÇA.csv` (103).
> Scripts descartáveis removidos após rodar.

> ✅ **EXECUTADA.** Alunos: **190** (103 enriquecidos/criados + 87 faltantes). Financeiro:
> **56 Matrículas + 56 Cobranças**. (Docentes e horários adiados.)

## 1. Acadêmica (`Estudiantes__Informacion_academica.xlsx`, 190)
Base-mestra. Match por **documento**.
| Ação | Detalhe |
|---|---|
| **Enriquecer existentes** | `genero` (Sexo) e `nascimento` preenchidos onde faltavam; `status` ajustado pelo `Estado`. |
| **Status (mapa)** | Activo→ATIVO · Inactivo→PAUSADO · Cancelado→ENCERRADO · **em branco→inativo (PAUSADO)** para novos. |
| **Criar faltantes (87)** | País pelo DDI do celular (+506 CR / +507 PA / +503 SV; fallback CR). Sem nível na fonte → só cadastro. |
| **Resultado** | 190 alunos · todos com gênero+nascimento · ATIVO 114 / PAUSADO 75 / ENCERRADO 1 · CR 151 / PA 36 / SV 3. |

## 2. Financeira (`Planilha de cobrança`, 103) — match por **nome**
Cria **Matrícula (ATIVA)** + **Cobrança (mensalidade do mês 2026-06)** por aluno.
| Campo | Origem / regra |
|---|---|
| Produto | "Particular" no grupo → Particular; senão **Regular**. |
| País / Moeda | Pais (CR/PA/SV) · Moeda (Colones→CRC, Dólar→USD). |
| `diaVencimento` | Dia de Vencimento (default 10). |
| Cobrança `status` | "em atraso"→ATRASADO · "Em dia"→PAGO · vazio→PENDENTE. |
| Match nome | Tokens da cobrança (nome curto) ⊆ tokens do aluno (nome completo); único vence, ambíguo pula, nome <2 tokens pula. |
| **Resultado** | **56 matrículas/cobranças** (ATRASADO 4, PAGO 52). |

## 3. Em aberto
- **~43 linhas de cobrança sem aluno na base** — a maioria **não está no arquivo acadêmico (190)** (alunos só da cobrança); poucas são variação de grafia (ex.: "Ana Luiza" × "Ana Luisa"). Decisão pendente: criar cadastro mínimo (só nome+país, sem documento) ou deixar de fora.
- **Comissão** não gerada (sem vendedor na fonte).
- **Professores** (`Docentes.xlsx`, 11) e **dia/horário** das turmas: adiados.
