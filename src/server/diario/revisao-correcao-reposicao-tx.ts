import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { carregarImpactosCorrecaoReposicaoTx } from "@/server/avaliacoes/impactos-reposicao-tx";

/** Chamador mantém calendário/reposição bloqueados e autorização conferida.
 * O token vincula a proposta às dependências e à fonte efetiva conferidas. */
export async function revisarImpactosCorrecaoReposicaoTx(tx: Prisma.TransactionClient, correcao: {
  id: string; conclusaoId: string; entradaHash: string; conclusao: { reposicaoId: string };
}) {
  const contexto = await carregarImpactosCorrecaoReposicaoTx(tx, { reposicaoId: correcao.conclusao.reposicaoId });
  const fonteAtual = await tx.correcaoConclusaoReposicaoIndividual.findFirst({
    where: { conclusaoId: correcao.conclusaoId, decisao: { aprovada: true } }, orderBy: { versao: "desc" },
    select: { id: true, entradaHash: true, decisao: { select: { id: true } } },
  });
  const impactosHash = createHash("sha256").update(JSON.stringify({
    correcaoId: correcao.id, propostaHash: correcao.entradaHash, conclusaoId: correcao.conclusaoId,
    fonteAtual, ...contexto,
  })).digest("hex");
  const destinos = await tx.turma.findMany({ where: { id: { in: contexto.impactos.map(i => i.turmaDestinoId) } }, select: { id: true, codigo: true, nome: true } });
  return { impactosHash, contexto, impactos: contexto.impactos.map(i => {
    const destino = destinos.find(d => d.id === i.turmaDestinoId);
    return { id: i.id, status: i.status, destino: destino?.codigo || destino?.nome || "Turma sem identificação" };
  }) };
}
