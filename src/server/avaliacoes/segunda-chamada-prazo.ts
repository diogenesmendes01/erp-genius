import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { fusoIanaValido } from "@/server/operacao/fuso";

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

/**
 * Fuso em que a conferência da remarcação mostra o PRAZO VIGENTE (lote 3 do fuso pessoal nas telas). O prazo é
 * publicado para a agenda da reserva: vale o fuso da agenda (o do encontro); sem encontro, ou com o fuso gravado
 * inválido, o fuso da escola. Antes caía em "UTC" sem encontro. Nunca o fuso do servidor; UTC só se a escola também
 * não tiver fuso válido — e a tela escreve o fuso usado.
 */
export function fusoDoPrazoSegundaChamada(fusoAgenda: string | null | undefined, fusoEscola: string | null | undefined): { fuso: string; origem: "AGENDA" | "ESCOLA" } {
  if (fusoAgenda && fusoIanaValido(fusoAgenda)) return { fuso: fusoAgenda, origem: "AGENDA" };
  return { fuso: fusoEscola && fusoIanaValido(fusoEscola) ? fusoEscola : "UTC", origem: "ESCOLA" };
}
