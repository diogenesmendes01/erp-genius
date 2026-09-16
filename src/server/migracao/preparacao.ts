import { z } from "zod";

const Texto = z.string().trim().min(1).max(300);
// Planilhas reais fornecem células numéricas e nulas. Elas são preservadas na
// fotografia; apenas a regra que precisa de texto usa a representação textual.
const Celula = z.union([z.string().max(2000), z.number().finite(), z.null()]).optional();
export function textoDaCelula(valor: string | number | null | undefined) {
  if (typeof valor === "string") return valor.trim() || undefined;
  if (typeof valor === "number") return String(valor);
  return undefined;
}

export const LinhaPreparacaoSchema = z.object({
  linhaOrigem: Texto.max(120),
  tipoEntrada: z.enum(["CADASTRO", "VINCULO_MATRICULA", "FINANCEIRO_HISTORICO", "HISTORICO_PRESENCA"]),
  aluno: z.object({ id: Celula, nome: Celula, email: Celula, documento: Celula, pais: Celula, fuso: Celula }).strict().optional(),
  turma: z.object({ id: Celula, codigo: Celula, nome: Celula }).strict().optional(),
  matricula: z.object({ id: Celula, situacao: Celula, inicio: Celula, fim: Celula }).strict().optional(),
  financeiro: z.object({ id: Celula, tipo: Celula, valor: Celula, moeda: Celula, situacao: Celula }).strict().optional(),
  consentimentoOrigem: Celula,
  presencaOrigem: Celula,
  dadosAdicionais: z.record(z.string().max(100), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])).default({}),
}).strict();

export const EntradaPrepararLoteMigracao = z.object({
  origem: Texto.max(120),
  chaveLote: Texto.max(120),
  linhas: z.array(LinhaPreparacaoSchema).min(1).max(500),
}).strict().superRefine((entrada, ctx) => {
  const vistas = new Set<string>();
  entrada.linhas.forEach((linha, indice) => {
    if (vistas.has(linha.linhaOrigem)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linhas", indice, "linhaOrigem"], message: "Uma linha de origem só pode aparecer uma vez no lote." });
    vistas.add(linha.linhaOrigem);
  });
});

export type LinhaPreparacaoEntrada = z.output<typeof LinhaPreparacaoSchema>;
export type PendenciaPreparacao = { campo: string; codigo: string; detalhe: string };

/**
 * Valida somente o que a fonte declarou. Pendência não cria estado no ERP: ela
 * torna visível o dado que ainda precisa de conferência humana.
 */
export function pendenciasDaLinha(linha: LinhaPreparacaoEntrada): PendenciaPreparacao[] {
  const pendencias: PendenciaPreparacao[] = [];
  const adicionar = (campo: string, codigo: string, detalhe: string) => pendencias.push({ campo, codigo, detalhe });
  const aluno = linha.aluno, turma = linha.turma, matricula = linha.matricula, financeiro = linha.financeiro;
  const alunoId = textoDaCelula(aluno?.id), nome = textoDaCelula(aluno?.nome), pais = textoDaCelula(aluno?.pais), fuso = textoDaCelula(aluno?.fuso), email = textoDaCelula(aluno?.email), documento = textoDaCelula(aluno?.documento), turmaId = textoDaCelula(turma?.id), matriculaId = textoDaCelula(matricula?.id), situacaoMatricula = textoDaCelula(matricula?.situacao), valor = textoDaCelula(financeiro?.valor), moeda = textoDaCelula(financeiro?.moeda), situacaoFinanceira = textoDaCelula(financeiro?.situacao), financeiroId = textoDaCelula(financeiro?.id);
  if (!alunoId) adicionar("aluno.id", "ALUNO_ORIGEM_AUSENTE", "A linha não identifica o aluno na origem.");
  if (!nome) adicionar("aluno.nome", "NOME_ALUNO_AUSENTE", "A origem não informou o nome do aluno.");
  if (!pais) adicionar("aluno.pais", "PAIS_AUSENTE", "A origem não informou o país do aluno.");
  if (!fuso) adicionar("aluno.fuso", "FUSO_AUSENTE", "A origem não informou o fuso do aluno.");
  if (!email) adicionar("aluno.email", "EMAIL_AUSENTE", "A origem não informou o e-mail do aluno.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) adicionar("aluno.email", "EMAIL_INVALIDO", "O e-mail foi preservado como texto de origem e precisa de correção antes de qualquer cadastro.");
  if (!documento) adicionar("aluno.documento", "DOCUMENTO_AUSENTE", "A origem não informou o documento do aluno.");
  if (linha.tipoEntrada === "VINCULO_MATRICULA" && !matriculaId) adicionar("matricula.id", "MATRICULA_ORIGEM_AUSENTE", "O vínculo não identifica a matrícula na origem.");
  if (linha.tipoEntrada === "VINCULO_MATRICULA" && !turmaId) adicionar("turma.id", "TURMA_AUSENTE", "A matrícula de origem não está vinculada a uma turma identificável.");
  if (turma && !textoDaCelula(turma.codigo) && !textoDaCelula(turma.nome)) adicionar("turma", "TURMA_SEM_IDENTIFICACAO", "A turma tem ID de origem, mas não possui código ou nome para conferência.");
  if (matricula && !situacaoMatricula) adicionar("matricula.situacao", "SITUACAO_NAO_INFORMADA", "A situação da matrícula não foi informada; nenhuma situação será criada.");
  if (situacaoMatricula) adicionar("matricula.situacao", "SITUACAO_NAO_CONFIRMADA", "A situação foi preservada como texto de origem e exige conferência antes de qualquer aplicação.");
  if (linha.tipoEntrada === "VINCULO_MATRICULA" && !linha.consentimentoOrigem) adicionar("consentimento", "CONSENTIMENTO_NAO_INFORMADO", "Não há evidência de consentimento no vínculo; nenhum consentimento será criado.");
  if (linha.tipoEntrada === "HISTORICO_PRESENCA" && !linha.presencaOrigem) adicionar("presenca", "PRESENCA_NAO_INFORMADA", "Não há presença comprovada na linha; nenhuma presença será criada.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !financeiroId) adicionar("financeiro.id", "FINANCEIRO_ORIGEM_AUSENTE", "O histórico financeiro não identifica o registro de origem.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !valor) adicionar("financeiro.valor", "VALOR_FINANCEIRO_AUSENTE", "O registro financeiro não informou valor; nenhuma cobrança ou recebimento será criado.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && valor && !/^\d+(\.\d{1,2})?$/.test(valor)) adicionar("financeiro.valor", "VALOR_FINANCEIRO_INVALIDO", "O valor foi preservado como texto de origem e precisa de correção antes de qualquer lançamento.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !moeda) adicionar("financeiro.moeda", "MOEDA_FINANCEIRA_AUSENTE", "O registro financeiro não informou moeda; nenhum lançamento será criado.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && moeda && !/^[A-Z]{3}$/.test(moeda)) adicionar("financeiro.moeda", "MOEDA_FINANCEIRA_INVALIDA", "A moeda foi preservada como texto de origem e precisa de correção antes de qualquer lançamento.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !situacaoFinanceira) adicionar("financeiro.situacao", "SITUACAO_FINANCEIRA_NAO_INFORMADA", "A situação financeira não foi informada; pagamento não será presumido.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && situacaoFinanceira) adicionar("financeiro.situacao", "SITUACAO_FINANCEIRA_NAO_CONFIRMADA", "A situação financeira foi preservada como texto e não vale como pagamento confirmado.");
  return pendencias;
}

export function estadoDaLinha(pendencias: PendenciaPreparacao[]): "PRONTA_PARA_REVISAO" | "COM_PENDENCIAS" {
  return pendencias.length ? "COM_PENDENCIAS" : "PRONTA_PARA_REVISAO";
}

export function identidadeDaFonte(linha: LinhaPreparacaoEntrada, tipo: "ALUNO" | "TURMA" | "MATRICULA" | "FINANCEIRO") {
  if (tipo === "ALUNO" && textoDaCelula(linha.aluno?.id)) return { id: textoDaCelula(linha.aluno?.id)!, dados: linha.aluno };
  if (tipo === "TURMA" && textoDaCelula(linha.turma?.id)) return { id: textoDaCelula(linha.turma?.id)!, dados: linha.turma };
  if (tipo === "MATRICULA" && textoDaCelula(linha.matricula?.id)) return { id: textoDaCelula(linha.matricula?.id)!, dados: linha.matricula };
  if (tipo === "FINANCEIRO" && textoDaCelula(linha.financeiro?.id)) return { id: textoDaCelula(linha.financeiro?.id)!, dados: linha.financeiro };
  return null;
}
