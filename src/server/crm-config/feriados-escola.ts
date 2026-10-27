import type { Prisma } from "@prisma/client";
import { feriadosDoCalendarioEscolar, type FeriadoEscola } from "./horario-atendimento";

export async function feriadosDaEscola(db: Pick<Prisma.TransactionClient, "versaoCalendarioEscolar">, desde?: string): Promise<FeriadoEscola[]> {
  const vigente = await db.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { periodos: true } });
  return vigente ? feriadosDoCalendarioEscolar(vigente.periodos, desde) : [];
}
