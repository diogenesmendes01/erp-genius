import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "./sessao";
import { congelar, memoPorRequisicao } from "./memo-requisicao";

export async function escopoComercialAtual(
  usuario: UsuarioSessao,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Prisma.OportunidadeWhereInput> {
  if (!usuario?.id) return { id: "__sem_acesso__" };
  if (tx === prisma) return escopoMemo(usuario.id, JSON.stringify([...usuario.papeis].sort()));
  return calcularEscopo(usuario, tx);
}

const escopoMemo = memoPorRequisicao((id: string, papeisJson: string) =>
  calcularEscopo({ id, nome: "", papeis: JSON.parse(papeisJson) as Papel[] }, prisma).then(congelar));

async function calcularEscopo(
  usuario: UsuarioSessao,
  tx: Prisma.TransactionClient | typeof prisma,
): Promise<Prisma.OportunidadeWhereInput> {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  const vendedor = usuario.papeis.includes(Papel.VENDEDOR);
  const gerente = usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  if (!vendedor && !gerente) return { id: "__sem_acesso__" };
  const titulares = new Set<string>();
  if (vendedor) {
    titulares.add(usuario.id);
    const agora = new Date();
    const coberturas = await tx.coberturaCarteira.findMany({
      where: { substitutoId: usuario.id, inicio: { lte: agora }, fim: { gt: agora }, revogadaEm: null },
      select: { titularId: true },
    });
    for (const cobertura of coberturas) titulares.add(cobertura.titularId);
  }
  if (gerente) {
    const equipe = await tx.usuario.findMany({
      where: { gerenteComercialId: usuario.id },
      select: { id: true },
    });
    for (const membro of equipe) titulares.add(membro.id);
  }
  return titulares.size ? { vendedorDonoId: { in: [...titulares] } } : { id: "__sem_acesso__" };
}
