import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared/sessao";

/** Matrícula bloqueada pelo chamador; não infere condições de snapshots incompletos. */
export async function exigirEntradaMensalRegistrada(tx: Prisma.TransactionClient, matriculaId: string) {
  const p = await tx.preparacaoComercialMatricula.findUnique({ where: { matriculaId }, select: { regime: true, referencias: true, reservaParticularId: true } });
  if (!p) {
    const c = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { exigirPrimeiraMensalidade: true } });
    return c?.exigirPrimeiraMensalidade ?? false;
  }
  if (p.reservaParticularId) throw new ErroRegra("A ativação da particular precisa consumir os horários reservados. O fluxo mensal legado não atende esta contratação.");
  if (p.regime !== "MENSALIDADE") throw new ErroRegra("Particulares por hora exigem ativação própria da oferta. Não use uma mensalidade para substituir o adiantamento contratado.");
  const dados = z.object({ politicaEntrada: z.object({ taxaPreviaAssinatura: z.boolean(), exigirPrimeiraMensalidade: z.boolean() }) }).safeParse(p.referencias);
  if (!dados.success) throw new ErroRegra("Confira as regras de entrada registradas nesta preparação antes da ativação. A configuração atual não substitui condições ausentes.");
  return dados.data.politicaEntrada.exigirPrimeiraMensalidade;
}
