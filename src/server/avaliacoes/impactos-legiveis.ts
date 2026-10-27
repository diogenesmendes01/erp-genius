import type { Prisma } from "@prisma/client";
import type { ImpactoMudancaProgressao } from "./impactos-progressao-tx";

export type ImpactoLegivel = { id: string; status: ImpactoMudancaProgressao["status"]; turmaDestino: string };

export async function impactosLegiveisTx(tx: Prisma.TransactionClient, impactos: readonly ImpactoMudancaProgressao[]): Promise<ImpactoLegivel[]> {
  const ids = [...new Set(impactos.map((i) => i.turmaDestinoId))];
  const turmas = ids.length ? await tx.turma.findMany({ where: { id: { in: ids } }, select: { id: true, codigo: true, nome: true } }) : [];
  const rotulo = (id: string) => {
    const t = turmas.find((x) => x.id === id);
    return t?.codigo ?? t?.nome ?? "sem código";
  };
  return impactos.map((i) => ({ id: i.id, status: i.status, turmaDestino: rotulo(i.turmaDestinoId) }));
}
