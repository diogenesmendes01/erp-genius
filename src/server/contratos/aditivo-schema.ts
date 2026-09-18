import { z } from "zod";
import { OrigemCampoSchema } from "./campos";
import { ValorAlteracaoAditivoSchema, representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "./aditivo-valores";

const id = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const motivo = z.string().trim().min(5).max(4000);
const DataCivilSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(valor => {
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}, "Informe uma data civil existente.");
export const CicloCoberturaFuturoAditivoSchema = z.discriminatedUnion("escolha", [
  z.object({ escolha: z.literal("PRESERVAR_REFERENCIA") }).strict(),
  z.object({ escolha: z.literal("MUDAR_REFERENCIA"), referencia: z.enum(["MES_CIVIL", "CICLO_MATRICULA"]), dataReferencia: DataCivilSchema }).strict(),
]);
export const PrepararAditivoContratualSchema = z.object({
  matriculaId: id,
  conclusaoOriginalId: id,
  conclusaoHashEsperado: hash,
  modeloId: id,
  modeloHashEsperado: hash,
  vigenciaInicio: z.string().datetime({ offset: true }),
  alteracoes: z.array(z.object({
    origem: OrigemCampoSchema.refine(o => !o.startsWith("ADITIVO_"), "Referências do aditivo são derivadas pelo servidor."),
    novo: z.string().trim().min(1).max(4000),
    // Ausente é o snapshot legado: não há default nem tentativa de inferir texto.
    valorEstruturado: ValorAlteracaoAditivoSchema.optional(),
  }).strict()).min(1).max(100),
  motivo,
  cicloCoberturaFutura: CicloCoberturaFuturoAditivoSchema.optional(),
  chaveIdempotencia: z.string().trim().min(8).max(200),
}).strict().superRefine((d, ctx) => {
  const cobertura = new Set(d.alteracoes.filter(a => a.origem === "COBERTURA_INICIO" || a.origem === "COBERTURA_FIM").map(a => a.origem));
  if (cobertura.size === 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alteracoes"], message: "A correção de cobertura exige início e fim juntos." });
  if (cobertura.size === 2 && !d.cicloCoberturaFutura) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cicloCoberturaFutura"], message: "Escolha no aditivo como ficam as referências dos ciclos futuros." });
  if (cobertura.size === 0 && d.cicloCoberturaFutura) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cicloCoberturaFutura"], message: "O ciclo futuro só integra aditivo que corrige a cobertura." });
  if (new Set(d.alteracoes.map(a => a.origem)).size !== d.alteracoes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Condição repetida na proposta." });
  for (const [indice, alteracao] of d.alteracoes.entries()) {
    if (alteracao.valorEstruturado === undefined) continue;
    try {
      validarValorAlteracaoAditivo(alteracao.origem, alteracao.valorEstruturado);
      if (alteracao.novo !== representarValorAlteracaoAditivo(alteracao.valorEstruturado)) throw new Error("O novo valor precisa corresponder à representação canônica do valor estruturado.");
    } catch (erro) { ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alteracoes", indice, "valorEstruturado"], message: erro instanceof Error ? erro.message : "Valor estruturado inválido." }); }
  }
});
export const DecidirAditivoContratualSchema = z.object({
  propostaId: id, propostaHashEsperado: hash, aprovada: z.boolean(), motivo,
}).strict();
