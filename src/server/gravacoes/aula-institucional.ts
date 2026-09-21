import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarCorrecaoAulaTx } from "@/server/diario/correcao-aula-tx";
import { obterDriveOrganizacaoId } from "./credenciais";
import { resolverFonteRevisaoGravacaoTx } from "./fonte-revisao-tx";

/** Uso exclusivo no servidor. Reutiliza o escopo do histórico do diário;
 * não amplia a atribuição Q24 nem concede acesso a alunos/responsáveis.
 */
export async function autorizarVideoAulaInstitucional(encontroId: string) {
  const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  return prisma.$transaction(tx => autorizarVideoAulaInstitucionalTx(tx, u.id, encontroId));
}

async function autorizarVideoAulaInstitucionalTx(tx: Prisma.TransactionClient, usuarioId: string, encontroId: string) {
  const contexto = await carregarCorrecaoAulaTx(tx, usuarioId, encontroId, { somenteLeitura: true });
  const fonte = contexto.snapshot.gravacao;
  if (fonte?.tipo !== "OFICIAL") throw new ErroPermissao();
  const p = await tx.publicacaoGravacaoAula.findFirst({ where: { id: fonte.publicacaoId, encontroId },
    select: { id: true, driveOrganizacaoId: true } });
  if (!p || p.driveOrganizacaoId !== obterDriveOrganizacaoId()) throw new ErroPermissao();
  return resolverFonteRevisaoGravacaoTx(tx, { publicacaoAulaId: p.id });
}

/**
 * Captura a identidade HTTP uma vez e a relê no banco a cada pull do stream.
 * A rota chama `revalidar` antes de cada leitura; nenhum callback relê auth ou
 * cookies. Uma troca da publicação encerra o stream, em vez de trocar o arquivo.
 */
export async function prepararVideoAulaInstitucionalContinuo(encontroId: string) {
  const capturada = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
  const conferir = () => prisma.$transaction(async tx => {
    const atual = await tx.usuario.findUnique({ where: { id: capturada.id }, select: { ativo: true, papeis: true } });
    if (!atual?.ativo || !atual.papeis.some((papel) => papel === Papel.PROFESSOR || papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR)) {
      throw new ErroPermissao();
    }
    return autorizarVideoAulaInstitucionalTx(tx, capturada.id, encontroId);
  });
  const fonte = await conferir();
  return {
    fonte,
    async revalidar(): Promise<void> {
      const atual = await conferir();
      if (atual.fileId !== fonte.fileId || atual.driveId !== fonte.driveId || atual.revisionId !== fonte.revisionId || atual.md5Checksum !== fonte.md5Checksum || atual.size !== fonte.size || atual.mimeType !== fonte.mimeType) throw new ErroPermissao("Vídeo institucional indisponível.");
    },
  };
}
