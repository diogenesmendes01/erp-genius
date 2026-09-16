import type { Prisma } from "@prisma/client";
import type { ImpactoMudancaProgressao } from "./impactos-progressao-tx";

type OrigemCorrecao =
  | { tipo: "REGULAR"; decisaoId: string }
  | { tipo: "RECUPERACAO"; decisaoId: string }
  | { tipo: "REPOSICAO"; decisaoId: string };

/** Chamado na mesma transação da decisão aprovada. A origem e os impactos
 * vêm da conferência do servidor, nunca de uma seleção enviada pelo cliente. */
export async function registrarCasosRevisaoProgressaoTx(
  tx: Prisma.TransactionClient,
  entrada: { matriculaId: string; alocacaoFonteId: string; origem: OrigemCorrecao; impactos: ImpactoMudancaProgressao[] },
) {
  if (!entrada.impactos.length) return;
  await tx.casoRevisaoProgressao.createMany({
    data: entrada.impactos.map(impacto => ({
      matriculaId: entrada.matriculaId,
      alocacaoFonteId: entrada.alocacaoFonteId,
      solicitacaoId: impacto.id,
      decisaoCorrecaoNotaId: entrada.origem.tipo === "REGULAR" ? entrada.origem.decisaoId : null,
      decisaoCorrecaoRecuperacaoId: entrada.origem.tipo === "RECUPERACAO" ? entrada.origem.decisaoId : null,
      decisaoCorrecaoConclusaoReposicaoId: entrada.origem.tipo === "REPOSICAO" ? entrada.origem.decisaoId : null,
      snapshotImpacto: impacto,
    })),
    skipDuplicates: true,
  });
}
