import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { normalizarFonteRevisaoDrive, type FonteRevisaoPersistida } from "./fonte-revisao";

type Alvo = { publicacaoAulaId: string; materialReposicaoId?: never } | { materialReposicaoId: string; publicacaoAulaId?: never };

/** Resolve exclusivamente a última fonte persistida; linhas legadas não caem na cabeça do Drive. */
export async function resolverFonteRevisaoGravacaoTx(tx: Prisma.TransactionClient, alvo: Alvo) {
  const fonte = await tx.fonteRevisaoGravacao.findFirst({
    where: "publicacaoAulaId" in alvo ? { publicacaoAulaId: alvo.publicacaoAulaId } : { materialReposicaoId: alvo.materialReposicaoId },
    orderBy: { versao: "desc" },
    select: { arquivoOficialId: true, driveOrganizacaoId: true, driveRevisionId: true, driveRevisionMd5: true, driveRevisionSize: true, mimeType: true },
  });
  if (!fonte) throw new ErroRegra("A revisão da gravação exige regularização antes da reprodução.");
  return normalizarFonteRevisaoDrive(fonte satisfies FonteRevisaoPersistida);
}
