import { Papel, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { whereNumeroServeSetor } from "@/server/whatsapp/numero-setor";
import { setoresVisiveisNoInbox, type Setor } from "@/server/whatsapp/setor";

export interface OpcoesFiltroInbox { setores: Setor[]; numeros: { id: string; rotulo: string }[] }

/**
 * Opções do PainelFiltros: os setores que o usuário enxerga no inbox e os números que servem algum deles
 * (administrador: todos). Só rótulo e id; nenhum telefone. O filtro só restringe: o escopo do atendimento
 * continua valendo na consulta da lista.
 */
export async function opcoesFiltroInbox(u: Pick<UsuarioSessao, "papeis">): Promise<OpcoesFiltroInbox> {
  const setores = setoresVisiveisNoInbox(u.papeis);
  if (!setores.length) return { setores, numeros: [] };
  const where: Prisma.NumeroWhatsAppWhereInput = u.papeis.includes(Papel.ADMINISTRADOR) ? {} : { OR: setores.map(whereNumeroServeSetor) };
  const numeros = await prisma.numeroWhatsApp.findMany({ where, select: { id: true, rotulo: true }, orderBy: [{ rotulo: "asc" }, { id: "asc" }], take: 200 });
  return { setores, numeros };
}
