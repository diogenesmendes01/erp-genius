import { Prisma } from "@prisma/client";
import { situacaoMatriculaNaAula } from "@/server/matricula/historico-situacao";

export async function carregarHistoricosContratuais(tx: Pick<Prisma.TransactionClient, "matricula">, ids: string[]) {
  const contratos = await tx.matricula.findMany({ where: { id: { in: ids } }, select: {
    id: true, status: true, ativadaEm: true,
    encerramento: { select: { statusAnterior: true, limiteVinculo: true } },
    itensPropostaPausa: { where: { proposta: { status: "APLICADA" } }, select: { proposta: { select: { aplicadaEm: true, snapshot: true } } } },
    itensPropostaRetomadaContratual: { where: { proposta: { status: "APLICADA" } }, select: { proposta: { select: { aplicadaEm: true, snapshot: true } } } },
  } });
  return new Map(contratos.map((m) => [m.id, {
    status: m.status, ativadaEm: m.ativadaEm, encerramento: m.encerramento,
    pausas: m.itensPropostaPausa.map((i) => i.proposta), retomadas: m.itensPropostaRetomadaContratual.map((i) => i.proposta),
  }]));
}

export async function carregarSituacoesNaAula(tx: Prisma.TransactionClient, ids: string[], ocorridaEm: Date) {
  const historicos = await carregarHistoricosContratuais(tx, ids);
  return new Map([...historicos].map(([id, h]) => [id, situacaoMatriculaNaAula(h, ocorridaEm)]));
}
