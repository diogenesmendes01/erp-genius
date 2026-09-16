import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { ErroPermissao, type UsuarioSessao } from "@/server/_shared";

export function financeiroOperacional(usuario: UsuarioSessao) {
  return usuario.papeis.some((p) => ([Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA] as Papel[]).includes(p));
}

export async function escopoMatriculaComercial(usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<Prisma.MatriculaWhereInput> {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  if (!usuario.papeis.some((p) => p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL)) return { id: { in: [] } };
  return { lead: { is: await escopoComercialAtual(usuario, tx) } };
}

export async function exigirEscopoAjuste(usuario: UsuarioSessao, matriculaId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)) return;
  const matricula = await tx.matricula.findFirst({ where: { AND: [{ id: matriculaId }, await escopoMatriculaComercial(usuario, tx)] }, select: { id: true } });
  if (!matricula) throw new ErroPermissao();
}

/** Aprovar usa a equipe supervisionada; caixa e cobertura não ampliam esse alcance. */
export async function escopoMatriculaAprovacao(usuario: UsuarioSessao, tx: Prisma.TransactionClient | typeof prisma = prisma): Promise<Prisma.MatriculaWhereInput> {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  if (!usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) return { id: { in: [] } };
  const equipe = await tx.usuario.findMany({ where: { gerenteComercialId: usuario.id }, select: { id: true } });
  return { lead: { is: { vendedorDonoId: { in: equipe.map((membro) => membro.id) } } } };
}

export async function exigirEscopoAprovacao(usuario: UsuarioSessao, matriculaId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return;
  const matricula = await tx.matricula.findFirst({
    where: { AND: [{ id: matriculaId }, await escopoMatriculaAprovacao(usuario, tx)] }, select: { id: true },
  });
  if (!matricula) throw new ErroPermissao();
}
