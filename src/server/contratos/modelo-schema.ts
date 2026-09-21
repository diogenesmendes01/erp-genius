import { z } from "zod";
import { OrigemCampoSchema } from "./campos";

// Texto institucional, sem HTML ou execução de expressões. A geração resolverá
// os campos declarados; não infere cláusulas ou participantes pelo texto.
const Campo = z.string().regex(/^[a-z][a-z0-9_]{0,59}$/);
export const RegraAssinaturaSchema = z.object({
  papel: z.enum(["ALUNO", "REPRESENTANTE_LEGAL", "RESPONSAVEL_FINANCEIRO", "REPRESENTANTE_EMPRESA", "REPRESENTANTE_ESCOLA"]),
  condicao: z.enum(["SEMPRE", "ALUNO_MENOR", "ALUNO_MAIOR", "PAGADOR_DISTINTO", "PAGADOR_EMPRESA"]),
}).strict();
export const ConteudoModeloSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  finalidade: z.enum(["CONTRATO", "ADITIVO"]),
  regimes: z.array(z.enum(["MENSALIDADE", "HORA_PARTICULAR"])).min(1).max(2),
  aplicacao: z.string().trim().min(5).max(4000),
  campos: z.array(z.object({ chave: Campo, descricao: z.string().trim().min(1).max(500), origem: OrigemCampoSchema.optional() }).strict()).max(100),
  secoes: z.array(z.object({ titulo: z.string().trim().min(1).max(200), texto: z.string().trim().min(1).max(20000) }).strict()).min(1).max(100),
  assinaturas: z.array(RegraAssinaturaSchema).min(1).max(20),
}).strict().superRefine((d, ctx) => {
  const erro = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  const campos = new Set(d.campos.map((c) => c.chave));
  if (campos.size !== d.campos.length) erro("Campos não podem ter chaves repetidas.");
  if (new Set(d.regimes).size !== d.regimes.length) erro("Regimes repetidos.");
  if (d.finalidade === "CONTRATO" && d.campos.some(c => c.origem?.startsWith("ADITIVO_"))) erro("Campos de aditivo exigem modelo com finalidade ADITIVO.");
  if (new Set(d.assinaturas.map((a) => `${a.papel}:${a.condicao}`)).size !== d.assinaturas.length) erro("Regra de assinatura repetida.");
  if (!d.assinaturas.some((a) => a.papel !== "REPRESENTANTE_ESCOLA")) erro("Identifique participantes obrigatórios do lado do cliente.");
  for (const s of [{ titulo: d.titulo, texto: "" }, ...d.secoes]) {
    const texto = `${s.titulo}\n${s.texto}`;
    for (const m of texto.matchAll(/\{\{([^{}]+)\}\}/g)) {
      if (!campos.has(m[1])) erro(`Campo não declarado: ${m[1]}.`);
    }
    if (/[{}]/.test(texto.replace(/\{\{[a-z][a-z0-9_]{0,59}\}\}/g, ""))) erro("Use campos no formato {{chave_declarada}}, sem expressões.");
  }
});

export const PrepararModeloSchema = z.object({
  codigo: z.string().trim().regex(/^[A-Z][A-Z0-9_-]{1,59}$/),
  versaoEsperada: z.number().int().nonnegative(),
  conteudo: ConteudoModeloSchema,
  motivo: z.string().trim().min(5).max(2000),
  chaveIdempotencia: z.string().min(8).max(100),
}).strict();

export const DecidirModeloSchema = z.object({
  modeloId: z.string().min(1), conteudoHash: z.string().regex(/^[a-f0-9]{64}$/),
  aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000),
}).strict();
