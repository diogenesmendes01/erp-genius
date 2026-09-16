import { z } from "zod";

const Texto = z.string().trim().min(1).max(300);
const Celula = z.string().trim().max(2000).optional();

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
  if (!linha.aluno?.id) adicionar("aluno.id", "ALUNO_ORIGEM_AUSENTE", "A linha não identifica o aluno na origem.");
  if (!linha.aluno?.nome) adicionar("aluno.nome", "NOME_ALUNO_AUSENTE", "A origem não informou o nome do aluno.");
  if (!linha.aluno?.pais) adicionar("aluno.pais", "PAIS_AUSENTE", "A origem não informou o país do aluno.");
  if (!linha.aluno?.fuso) adicionar("aluno.fuso", "FUSO_AUSENTE", "A origem não informou o fuso do aluno.");
  if (!linha.aluno?.email) adicionar("aluno.email", "EMAIL_AUSENTE", "A origem não informou o e-mail do aluno.");
  if (linha.aluno?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linha.aluno.email)) adicionar("aluno.email", "EMAIL_INVALIDO", "O e-mail foi preservado como texto de origem e precisa de correção antes de qualquer cadastro.");
  if (!linha.aluno?.documento) adicionar("aluno.documento", "DOCUMENTO_AUSENTE", "A origem não informou o documento do aluno.");
  if (linha.tipoEntrada === "VINCULO_MATRICULA" && !linha.matricula?.id) adicionar("matricula.id", "MATRICULA_ORIGEM_AUSENTE", "O vínculo não identifica a matrícula na origem.");
  if (linha.tipoEntrada === "VINCULO_MATRICULA" && !linha.turma?.id) adicionar("turma.id", "TURMA_AUSENTE", "A matrícula de origem não está vinculada a uma turma identificável.");
  if (linha.turma && !linha.turma.codigo && !linha.turma.nome) adicionar("turma", "TURMA_SEM_IDENTIFICACAO", "A turma tem ID de origem, mas não possui código ou nome para conferência.");
  if (linha.matricula && !linha.matricula.situacao) adicionar("matricula.situacao", "SITUACAO_NAO_INFORMADA", "A situação da matrícula não foi informada; nenhuma situação será criada.");
  if (linha.matricula?.situacao) adicionar("matricula.situacao", "SITUACAO_NAO_CONFIRMADA", "A situação foi preservada como texto de origem e exige conferência antes de qualquer aplicação.");
  if (linha.tipoEntrada === "VINCULO_MATRICULA" && !linha.consentimentoOrigem) adicionar("consentimento", "CONSENTIMENTO_NAO_INFORMADO", "Não há evidência de consentimento no vínculo; nenhum consentimento será criado.");
  if (linha.tipoEntrada === "HISTORICO_PRESENCA" && !linha.presencaOrigem) adicionar("presenca", "PRESENCA_NAO_INFORMADA", "Não há presença comprovada na linha; nenhuma presença será criada.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !linha.financeiro?.id) adicionar("financeiro.id", "FINANCEIRO_ORIGEM_AUSENTE", "O histórico financeiro não identifica o registro de origem.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !linha.financeiro?.valor) adicionar("financeiro.valor", "VALOR_FINANCEIRO_AUSENTE", "O registro financeiro não informou valor; nenhuma cobrança ou recebimento será criado.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && linha.financeiro?.valor && !/^\d+(\.\d{1,2})?$/.test(linha.financeiro.valor)) adicionar("financeiro.valor", "VALOR_FINANCEIRO_INVALIDO", "O valor foi preservado como texto de origem e precisa de correção antes de qualquer lançamento.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !linha.financeiro?.moeda) adicionar("financeiro.moeda", "MOEDA_FINANCEIRA_AUSENTE", "O registro financeiro não informou moeda; nenhum lançamento será criado.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && linha.financeiro?.moeda && !/^[A-Z]{3}$/.test(linha.financeiro.moeda)) adicionar("financeiro.moeda", "MOEDA_FINANCEIRA_INVALIDA", "A moeda foi preservada como texto de origem e precisa de correção antes de qualquer lançamento.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && !linha.financeiro?.situacao) adicionar("financeiro.situacao", "SITUACAO_FINANCEIRA_NAO_INFORMADA", "A situação financeira não foi informada; pagamento não será presumido.");
  if (linha.tipoEntrada === "FINANCEIRO_HISTORICO" && linha.financeiro?.situacao) adicionar("financeiro.situacao", "SITUACAO_FINANCEIRA_NAO_CONFIRMADA", "A situação financeira foi preservada como texto e não vale como pagamento confirmado.");
  return pendencias;
}

export function estadoDaLinha(pendencias: PendenciaPreparacao[]): "PRONTA_PARA_REVISAO" | "COM_PENDENCIAS" {
  return pendencias.length ? "COM_PENDENCIAS" : "PRONTA_PARA_REVISAO";
}

export function identidadeDaFonte(linha: LinhaPreparacaoEntrada, tipo: "ALUNO" | "TURMA" | "MATRICULA" | "FINANCEIRO") {
  if (tipo === "ALUNO" && linha.aluno?.id) return { id: linha.aluno.id, dados: linha.aluno };
  if (tipo === "TURMA" && linha.turma?.id) return { id: linha.turma.id, dados: linha.turma };
  if (tipo === "MATRICULA" && linha.matricula?.id) return { id: linha.matricula.id, dados: linha.matricula };
  if (tipo === "FINANCEIRO" && linha.financeiro?.id) return { id: linha.financeiro.id, dados: linha.financeiro };
  return null;
}
