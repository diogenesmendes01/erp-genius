import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, ErroPermissao, type UsuarioSessao } from "@/server/_shared";
export async function exigirDestinoComercial(usuario: UsuarioSessao, id: string | null, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (!id) {
    if (!usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroRegra("Selecione um vendedor da sua equipe.");
    return;
  }
  const destino = await tx.usuario.findFirst({ where: { id, ativo: true, papeis: { has: Papel.VENDEDOR } }, select: { id: true, gerenteComercialId: true } });
  if (!destino) throw new ErroRegra("Selecione um vendedor ativo.");
  if (!usuario.papeis.includes(Papel.ADMINISTRADOR) && destino.id !== usuario.id &&
    !(usuario.papeis.includes(Papel.GERENTE_COMERCIAL) && destino.gerenteComercialId === usuario.id)) {
    throw new ErroPermissao("O vendedor não pertence à sua equipe.");
  }
}
