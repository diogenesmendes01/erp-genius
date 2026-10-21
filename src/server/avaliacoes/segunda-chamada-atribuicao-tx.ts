import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { instanteUtcSql } from "./segunda-chamada-utc";

type Entrada = {
  propostaId: string;
  professorId: string;
  inicio: Date;
  fim: Date;
};

/** A fonte SQL confere cada faixa de [início, fim), inclusive trocas de vínculo ou designação. */
export async function professorSegundaChamadaCobreIntervaloTx(
  tx: PrismaTypes.TransactionClient,
  entrada: Entrada,
) {
  if (
    !Number.isFinite(entrada.inicio.getTime())
    || !Number.isFinite(entrada.fim.getTime())
    || entrada.fim <= entrada.inicio
  ) {
    throw new ErroRegra("Informe intervalo válido para conferir a atribuição docente.");
  }
  const [linha] = await tx.$queryRaw<{ cobre: boolean | null }[]>(Prisma.sql`
    SELECT professor_segunda_chamada_cobre_intervalo(
      ${entrada.propostaId},
      ${entrada.professorId},
      ${instanteUtcSql(entrada.inicio)},
      ${instanteUtcSql(entrada.fim)}
    ) AS cobre
  `);
  return linha?.cobre === true;
}
