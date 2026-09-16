import { z } from "zod";
import { ErroRegra } from "@/server/_shared/sessao";
import { OrigemCampo, ROTULOS_ORIGEM } from "./campos";
import { ConteudoModeloSchema } from "./modelo-schema";
import { preencherModelo } from "./preencher-modelo";

const texto = z.string().trim().min(1).max(4000);
const referencia = z.object({
  documentoId: z.string().trim().min(1).max(100),
  pdfHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

/** Projeção documental de fatos recarregados no servidor. Não é entrada de
 * formulário nem comprova aprovação, assinatura ou autorização para aplicar. */
export const BaseTextoAditivoSchema = z.object({
  contratoOriginal: referencia,
  aditivosAnteriores: z.array(referencia).max(1000),
  vigenciaInicio: z.string().datetime({ offset: true }),
  alteracoes: z.array(z.object({
    campo: z.string().trim().min(1).max(100),
    rotulo: texto,
    anterior: texto,
    novo: texto,
  }).strict()).min(1).max(100),
}).strict().superRefine((base, ctx) => {
  const erro = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  const ids = [base.contratoOriginal.documentoId, ...base.aditivosAnteriores.map(a => a.documentoId)];
  if (new Set(ids).size !== ids.length) erro("Referência documental repetida na cadeia do aditivo.");
  if (new Set(base.alteracoes.map(a => a.campo)).size !== base.alteracoes.length) erro("Condição repetida no aditivo.");
  if (base.alteracoes.some(a => a.anterior === a.novo)) erro("Cada alteração deve identificar uma mudança efetiva.");
});

const obrigatorias: OrigemCampo[] = ["ADITIVO_CONTRATO_ORIGINAL", "ADITIVO_ANTERIORES", "ADITIVO_ALTERACOES", "ADITIVO_VIGENCIA"];

export function preencherTextoAditivo(conteudo: unknown, basePreservada: unknown,
  fontesInstitucionais: Partial<Record<OrigemCampo, string | null | undefined>>) {
  const modelo = ConteudoModeloSchema.parse(conteudo);
  if (modelo.finalidade !== "ADITIVO") throw new ErroRegra("Use um modelo institucional de aditivo.");
  const base = BaseTextoAditivoSchema.parse(basePreservada);
  // Declarar um campo sem incluí-lo no corpo não formaliza a informação.
  for (const origem of obrigatorias) {
    const chaves = modelo.campos.filter(c => c.origem === origem).map(c => c.chave);
    if (!chaves.some(chave => modelo.secoes.some(s => s.texto.includes(`{{${chave}}}`)))) {
      throw new ErroRegra(`O corpo do modelo de aditivo deve apresentar: ${ROTULOS_ORIGEM[origem]}. Publique uma versão completa.`);
    }
  }
  const descreverReferencia = (r: z.infer<typeof referencia>) => `${r.documentoId} — SHA-256 ${r.pdfHash}`;
  return preencherModelo(modelo, {
    ...fontesInstitucionais,
    // A fonte genérica não pode substituir os fatos específicos preservados.
    ADITIVO_CONTRATO_ORIGINAL: descreverReferencia(base.contratoOriginal),
    ADITIVO_ANTERIORES: base.aditivosAnteriores.length
      ? base.aditivosAnteriores.map(descreverReferencia).join("\n") : "Nenhum aditivo anterior vinculado.",
    ADITIVO_VIGENCIA: new Date(base.vigenciaInicio).toISOString(),
    ADITIVO_ALTERACOES: base.alteracoes.map(a => `${a.rotulo}\nCondição anterior: ${a.anterior}\nNova condição: ${a.novo}`).join("\n\n"),
  });
}
