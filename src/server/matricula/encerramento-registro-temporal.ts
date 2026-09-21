import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";

/** Registro interno: integrar com o estado/vínculos e o financeiro na transação final. */
export async function registrarLimitesEncerramentoTx(tx: Prisma.TransactionClient, acerto: Awaited<ReturnType<typeof carregarAcertoAprovadoParaEfetivacaoTx>>, agora: Date) {
  const registros = [];
  for (const c of acerto.previa.contratos) {
    const matriculaId = c.calculo.matriculaId;
    const m = await tx.matricula.findUniqueOrThrow({ where: { id: matriculaId }, select: { status: true } });
    const regra = c.origem.condicoes?.regras.diaEncerramento;
    if (!regra || !["ATIVA", "PAUSADA"].includes(m.status)) throw new ErroRegra("Condições ou situação insuficientes para registrar encerramento.");
    const incluiDia = regra === "INCLUIR";
    const [calculado] = await tx.$queryRaw<{ limite: Date }[]>`SELECT ((${c.calculo.dataEfetiva}::date + ${incluiDia ? 1 : 0}::integer)::timestamp AT TIME ZONE ${acerto.fusoInstitucional}) AT TIME ZONE 'UTC' AS limite`;
    registros.push(await tx.registroEncerramentoMatricula.create({ data: { matriculaId, decisaoId: acerto.decisaoId, statusAnterior: m.status,
      dataEfetiva: new Date(`${c.calculo.dataEfetiva}T00:00:00Z`), fusoInstitucional: acerto.fusoInstitucional,
      incluiDia, limiteVinculo: calculado.limite, aplicadoEm: agora,
    } }));
  }
  return registros;
}
