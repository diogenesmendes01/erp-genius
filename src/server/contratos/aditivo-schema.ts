import { z } from "zod";
import { OrigemCampoSchema } from "./campos";
import { ValorAlteracaoAditivoSchema, representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "./aditivo-valores";

const id = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const motivo = z.string().trim().min(5).max(4000);
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
  chaveIdempotencia: z.string().trim().min(8).max(200),
}).strict().superRefine((d, ctx) => {
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
