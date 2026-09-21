import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared/sessao";

const Condicoes = z.object({
  referenciaCobertura: z.string().nullable(), dataReferenciaCobertura: z.string().nullable(), diaVencimento: z.number(),
  mensalidades: z.array(z.object({ id: z.string(), coberturaInicio: z.string().nullable(), coberturaFim: z.string().nullable(), vencimento: z.string(), valorNegociado: z.string(), moeda: z.string() })),
});
export async function exigirCondicoesMensaisAceitas(tx: Prisma.TransactionClient, m: {
  id: string; contratoDocumentoId: string | null; referenciaCobertura: string | null; dataReferenciaCobertura: Date | null; diaVencimento: number;
  cobrancas: { id: string; tipo: string; coberturaInicio: Date | null; coberturaFim: Date | null; vencimento: Date; valorNegociado: Prisma.Decimal; moeda: string }[];
}) {
  const evento = await tx.evento.findFirst({ where: { agregadoTipo: "Matricula", agregadoId: m.id, tipo: "ContratoConfirmado" }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { payload: true } });
  const payload = evento?.payload as Record<string, unknown> | null | undefined;
  // Eventos antigos não continham a cópia das condições; não fabricar uma retroativamente.
  if (!payload || !("condicoesMensais" in payload)) return;
  const aceitas = Condicoes.safeParse(payload.condicoesMensais);
  const atuais = {
    referenciaCobertura: m.referenciaCobertura, dataReferenciaCobertura: m.dataReferenciaCobertura?.toISOString() ?? null, diaVencimento: m.diaVencimento,
    mensalidades: m.cobrancas.filter((c) => c.tipo === "MENSALIDADE").map((c) => ({ id: c.id, coberturaInicio: c.coberturaInicio?.toISOString() ?? null, coberturaFim: c.coberturaFim?.toISOString() ?? null, vencimento: c.vencimento.toISOString(), valorNegociado: c.valorNegociado.toString(), moeda: c.moeda })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  if (!aceitas.success || payload.documentoId !== m.contratoDocumentoId || !isDeepStrictEqual({ ...aceitas.data, mensalidades: aceitas.data.mensalidades.sort((a, b) => a.id.localeCompare(b.id)) }, atuais)) {
    throw new ErroRegra("As condições mensais diferem do aceite registrado. Solicite revisão contratual antes de ativar.");
  }
}
