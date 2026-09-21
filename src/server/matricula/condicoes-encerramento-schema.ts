import { z } from "zod";
const valor = z.string().regex(/^\d+(?:\.\d{1,2})?$/);
const centavos = (v: string) => { const [inteiro, fracao = ""] = v.split("."); return Number(inteiro) * 100 + Number((fracao + "00").slice(0, 2)); };
const clausula = { clausulaId: z.string().trim().min(1), condicoesAplicacao: z.string().trim().min(1) };
const tiposCobranca = z.enum(["MULTA_ENCERRAMENTO", "MATRICULA", "MENSALIDADE", "HORA_PARTICULAR", "MATERIAL", "CERTIFICADO"]);
const alcanceAcertoDesistencia = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("TODAS_COBRANCAS_MATRICULA") }).strict(),
  z.object({ tipo: z.literal("TIPOS_COBRANCA"), tipos: z.array(tiposCobranca).min(1) }).strict(),
  z.object({ tipo: z.literal("COBRANCAS_IDENTIFICADAS"), cobrancaIds: z.array(z.string().trim().min(1)).min(1) }).strict(),
]);
const condicoesAplicacaoPorCobranca = z.object({
  momento: z.literal("ANTES_ATIVACAO"),
  unidade: z.literal("POR_COBRANCA"),
  alcance: alcanceAcertoDesistencia,
}).strict();
const condicoesAplicacaoTotal = z.object({
  momento: z.literal("ANTES_ATIVACAO"),
  unidade: z.literal("TOTAL_CONTRATACAO"),
  cobrancaIds: z.array(z.string().trim().min(1)).min(1),
  rateio: z.array(z.object({ cobrancaId: z.string().trim().min(1), percentual: valor }).strict()).min(1),
}).strict().superRefine((v, ctx) => {
  const ids = new Set(v.cobrancaIds);
  const rateados = new Set(v.rateio.map(x => x.cobrancaId));
  if (ids.size !== v.cobrancaIds.length || rateados.size !== v.rateio.length || [...ids].some(id => !rateados.has(id))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O rateio deve identificar cada cobrança uma única vez." });
  if (v.rateio.some(x => !ids.has(x.cobrancaId)) || v.rateio.reduce((s, x) => s + centavos(x.percentual), 0) !== 10000) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O rateio contratual deve totalizar 100%." });
});
const condicoesAplicacaoAcertoDesistencia = z.union([condicoesAplicacaoPorCobranca, condicoesAplicacaoTotal]);
export const RegraAcertoDesistenciaPreparacaoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("VALOR_FIXO"), clausulaId: clausula.clausulaId, condicoesAplicacao: condicoesAplicacaoAcertoDesistencia, valor }).strict(),
  z.object({ tipo: z.literal("PERCENTUAL_VALOR_NEGOCIADO"), clausulaId: clausula.clausulaId, condicoesAplicacao: condicoesAplicacaoAcertoDesistencia, percentual: valor }).strict(),
]);
export const RegrasEncerramentoSchema = z.object({
  diaEncerramento: z.enum(["INCLUIR", "EXCLUIR"]),
  metodoDesconto: z.enum(["ANTES_DO_PROPORCIONAL", "DEPOIS_DO_PROPORCIONAL"]),
  condicoesDescontos: z.string().trim().min(1),
  multa: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("SEM_PREVISAO"), motivo: z.string().trim().min(1) }).strict(),
    z.object({ tipo: z.literal("VALOR_FIXO"), ...clausula, valor }).strict(),
    z.object({ tipo: z.literal("PERCENTUAL"), ...clausula, percentual: valor, descricaoBase: z.string().trim().min(1) }).strict(),
  ]),
  // Ausente nas versões históricas: Q165 deve tratá-las como pendência, nunca
  // inferir uma retenção, devolução ou proporcionalidade.
  acertoDesistenciaPreparacao: RegraAcertoDesistenciaPreparacaoSchema.optional(),
}).strict();
