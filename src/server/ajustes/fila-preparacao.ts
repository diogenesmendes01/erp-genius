import { Prisma, TipoCobranca } from "@prisma/client";
import { z } from "zod";
import { exigeAprovacaoComponente } from "@/server/financeiro/politica";
import { ConferenciaAlcadaSchema } from "@/server/matricula/alcada-preparacao";

const Memoria = z.object({
  exigeDirecao: z.boolean().optional(),
  alcada: ConferenciaAlcadaSchema.optional(),
}).passthrough();

export type LimitesFila = {
  limiteDescontoTaxaPct: Prisma.Decimal | null;
  limiteDescontoMensalidadePct: Prisma.Decimal | null;
};

export function lerConferenciaPreparacao(referencias: unknown): {
  exigeDirecao: boolean;
  componentes: z.infer<typeof ConferenciaAlcadaSchema>["componentes"];
} | null {
  const memoria = Memoria.safeParse(referencias);
  const direta = ConferenciaAlcadaSchema.safeParse(referencias);
  const alcada = memoria.success && memoria.data.alcada ? memoria.data.alcada : direta.success ? direta.data : null;
  if (!alcada) return null;
  return { exigeDirecao: memoria.success ? (memoria.data.exigeDirecao ?? true) : true, componentes: alcada.componentes };
}

export function avaliarPreparacaoNaFila(input: {
  admin: boolean;
  referencias: unknown;
  criadaEm: Date;
  alcadaAlteradaEm: Date | null;
  limites: LimitesFila | null;
}): { visivel: boolean; podeAprovarDireto: boolean } {
  const conferencia = lerConferenciaPreparacao(input.referencias);
  if (!conferencia || conferencia.componentes.every((c) => c.resultado === "DENTRO_ALCADA")) {
    return { visivel: false, podeAprovarDireto: false };
  }
  if (input.admin) return { visivel: true, podeAprovarDireto: true };
  if (conferencia.exigeDirecao) return { visivel: false, podeAprovarDireto: false };
  const limites = input.limites ?? { limiteDescontoTaxaPct: null, limiteDescontoMensalidadePct: null };
  const acima = conferencia.componentes.some((c) => {
    if (c.resultado !== "EXIGE_APROVACAO" || c.referencia == null) return false;
    return exigeAprovacaoComponente(limites, c.tipo as TipoCobranca, c.referencia, c.proposto);
  });
  if (acima) return { visivel: false, podeAprovarDireto: false };
  const referenciaInsuficiente = conferencia.componentes.some((c) => c.resultado === "REFERENCIA_INSUFICIENTE" || c.referencia == null);
  const alcadaMudou = !!input.alcadaAlteradaEm && input.alcadaAlteradaEm > input.criadaEm;
  return { visivel: true, podeAprovarDireto: !referenciaInsuficiente && !alcadaMudou };
}
