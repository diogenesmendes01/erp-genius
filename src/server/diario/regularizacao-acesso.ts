import { Papel, type Prisma } from "@prisma/client";
import { ErroPermissao } from "@/server/_shared";

export type AcessoRegularizacaoAula = {
  designacaoId: string | null;
  professorOriginalId: string;
};

// Centraliza o desvio estritamente pontual da autoria do encontro. A trava é a
// mesma usada pelas designações/revogações, portanto a consulta sempre vê a
// vigência atual antes de liberar qualquer gravação ou leitura da chamada.
export async function exigirAcessoRegularizacaoAulaTx(
  tx: Prisma.TransactionClient,
  entrada: { atorId: string; encontroId: string },
): Promise<AcessoRegularizacaoAula> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${entrada.atorId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${entrada.encontroId} FOR UPDATE`;

  const [ator, encontro] = await Promise.all([
    tx.usuario.findUnique({ where: { id: entrada.atorId }, select: { ativo: true, papeis: true } }),
    tx.encontroAgenda.findUnique({ where: { id: entrada.encontroId }, select: { professorId: true } }),
  ]);
  if (!ator?.ativo || !encontro?.professorId) throw new ErroPermissao("Sem acesso à regularização desta aula.");

  if (encontro.professorId === entrada.atorId && ator.papeis.includes(Papel.PROFESSOR)) {
    return { designacaoId: null, professorOriginalId: encontro.professorId };
  }

  if (!ator.papeis.some((papel) => papel === Papel.PROFESSOR || papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR)) {
    throw new ErroPermissao("Sem papel pedagógico para regularizar esta aula.");
  }

  const designacao = await tx.designacaoRegularizacaoAula.findFirst({
    where: { encontroId: entrada.encontroId, responsavelId: entrada.atorId, revogacao: { is: null } },
    select: { id: true },
  });
  if (!designacao) throw new ErroPermissao("Sem designação vigente para regularizar esta aula.");

  return { designacaoId: designacao.id, professorOriginalId: encontro.professorId };
}
