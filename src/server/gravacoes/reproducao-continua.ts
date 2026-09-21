import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao } from "@/server/_shared";
import { exigirSessaoPortalAluno, revalidarSessaoPortalAlunoTx } from "@/server/portal-aluno/sessao";
import { autorizarReproducaoGravacaoTx } from "./autorizacao";
import { obterDriveOrganizacaoId } from "./credenciais";

/** Captura a identidade no contexto HTTP; cada leitura consulta novamente os
 * direitos no banco, sem depender de cookies no contexto posterior do stream. */
export async function prepararReproducaoContinua(reposicaoId: string) {
  const sessao = await exigirSessaoPortalAluno();
  const conferir = () => prisma.$transaction(async tx => {
    const agora = new Date();
    await revalidarSessaoPortalAlunoTx(tx, sessao, agora);
    const fonte = await autorizarReproducaoGravacaoTx(tx, sessao, reposicaoId, agora);
    return { ...fonte, driveId: fonte.driveId ?? obterDriveOrganizacaoId() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const fonte = await conferir();
  return {
    fonte,
    revalidar: async () => {
      const atual = await conferir();
      if (atual.fileId !== fonte.fileId || atual.driveId !== fonte.driveId ||
          atual.revisionId !== fonte.revisionId || atual.md5Checksum !== fonte.md5Checksum || atual.size !== fonte.size || atual.mimeType !== fonte.mimeType ||
          atual.matriculaId !== fonte.matriculaId || atual.reposicaoId !== fonte.reposicaoId) {
        throw new ErroPermissao("Reprodução indisponível.");
      }
    },
  };
}
