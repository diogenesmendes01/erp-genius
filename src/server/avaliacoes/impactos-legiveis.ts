import type { Prisma } from "@prisma/client";
import type { ImpactoMudancaProgressao } from "./impactos-progressao-tx";

// Impactos de uma correção de nota em texto legível (docs/42 L1399 e L1492; docs/43 §6 item 7): a tela dizia
// "Solicitação <id>", e o decisor atestava ter conferido o que não viu. Aqui cada mudança acadêmica impactada
// sai com a turma de destino pelo código. Só leitura; o recorte que entra no hash (`impactos`) não muda.

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
