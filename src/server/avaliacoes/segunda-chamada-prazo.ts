import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/** Última prorrogação aprovada vence sobre o prazo original; vencimento não consome reserva. */
export async function prazoSegundaChamadaVigente(tx: PrismaTypes.TransactionClient, disponibilizacaoId: string) {
  const [prazo] = await tx.$queryRaw<{ prazoAte: Date }[]>(Prisma.sql`
    SELECT COALESCE((SELECT p."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" p
      JOIN "DecisaoProrrogacaoSegundaChamada" d ON d."propostaId"=p.id AND d.aprovada
      WHERE p."disponibilizacaoId"=${disponibilizacaoId} ORDER BY p.versao DESC LIMIT 1),
      s."prazoAte") AS "prazoAte"
    FROM "DisponibilizacaoSegundaChamada" s WHERE s.id=${disponibilizacaoId}
  `);
  if (!prazo) throw new ErroRegra("Disponibilização de segunda chamada não encontrada.");
  return prazo.prazoAte;
}
