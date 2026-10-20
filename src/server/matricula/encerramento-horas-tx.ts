import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { calcularSaldoHorasEncerramento } from "./encerramento-horas";

/** O chamador autentica e delimita o aluno e a transação. Somente apura origens persistidas. */
export async function carregarHorasEncerramentoTx(tx: Prisma.TransactionClient, alunoId: string, matriculaId: string) {
  const m = await tx.matricula.findFirst({ where: { id: matriculaId, alunoId }, select: { moeda: true } });
  if (!m) throw new ErroRegra("Matrícula não encontrada para este aluno.");
  const compras = await tx.compraHorasAntecipadas.findMany({ where: { matriculaId }, orderBy: { id: "asc" }, include: {
    liquidacaoAcerto: true,
    reservas: { orderBy: { id: "asc" }, include: { consumo: { include: { estorno: { select: { id: true } }, conferenciaOcorrencia: { select: { id: true, desfecho: true } } } }, decisoesLiberacao: { where: { aprovada: true }, include: { proposta: true, credito: true } } } },
  } });
  const pendencias: string[] = [];
  const origens = compras.map(c => {
    const consumos: { id: string; minutos: number; motivo: "AULA_REALIZADA" | "FALTA_COBRAVEL" | "CANCELAMENTO_TARDIO_COBRAVEL"; evidencia: string }[] = [];
    const liquidacoesAnteriores: { id: string; minutos: number; valor: string; referenciaAcerto: string }[] = [];
    if (c.liquidacaoAcerto) liquidacoesAnteriores.push({ id: c.liquidacaoAcerto.id, minutos: c.liquidacaoAcerto.minutos, valor: c.liquidacaoAcerto.valor.toFixed(2), referenciaAcerto: c.liquidacaoAcerto.decisaoId });
    let minutosReservados = 0;
    for (const r of c.reservas) {
      if (r.consumo) {
        // Q175: minutos estornados voltaram ao saldo e entram no que resta a liquidar.
        if (r.consumo.estorno) continue;
        const conferencia = r.consumo.conferenciaOcorrencia;
        if (conferencia) {
          if (r.consumo.estadoDiario !== null || !["FALTA_COBRAVEL", "CANCELAMENTO_TARDIO"].includes(conferencia.desfecho)) throw new ErroRegra("Consumo por ocorrência diverge de sua conferência financeira.");
          consumos.push({ id: r.consumo.id, minutos: r.minutos, motivo: conferencia.desfecho === "FALTA_COBRAVEL" ? "FALTA_COBRAVEL" : "CANCELAMENTO_TARDIO_COBRAVEL", evidencia: r.consumo.motivo });
        } else {
          if (!r.consumo.estadoDiario) throw new ErroRegra("Consumo de realização sem estado do diário exige conferência.");
          consumos.push({ id: r.consumo.id, minutos: r.minutos, motivo: "AULA_REALIZADA", evidencia: r.consumo.motivo });
        }
        continue;
      }
      const decisao = r.decisoesLiberacao[0];
      if (decisao?.proposta.destino === "REMARCACAO") continue;
      if (decisao?.proposta.destino === "CREDITO" && decisao.credito) {
        liquidacoesAnteriores.push({ id: decisao.credito.id, minutos: r.minutos, valor: decisao.credito.valorInicial.toFixed(2), referenciaAcerto: decisao.id });
      } else minutosReservados += r.minutos;
    }
    if (minutosReservados) pendencias.push(`Resolva as reservas da compra ${c.id} antes de apurar seu encerramento.`);
    return { compraId: c.id, matriculaId, moeda: c.moeda, contratoVersaoId: c.documentoId,
      recebimentoReferencia: c.cobrancaId, evidenciaCondicoes: c.evidenciaCondicoes,
      minutosComprados: c.minutosComprados, minutosReservados, valorOriginal: c.valorOriginal.toFixed(2), descontoOriginal: c.descontoOriginal.toFixed(2), valorPagoAlocado: c.valorPagoAlocado.toFixed(2), consumos, liquidacoesAnteriores };
  });
  return { pendencias, cobrancasCompras: compras.map(c => c.cobrancaId), origens,
    calculo: pendencias.length ? null : calcularSaldoHorasEncerramento({ matriculaId, moeda: m.moeda, compras: origens }) };
}
