import { Papel, type Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { carregarUsuarioFresco, ErroPermissao, type UsuarioSessao } from "@/server/_shared/sessao";

/** Quem o relatório enxerga: tudo (administrador) ou os donos de oportunidade listados. */
export type EscopoRelatorio = { tipo: "TUDO" } | { tipo: "USUARIOS"; ids: string[] };

type Cliente = PrismaClient | Prisma.TransactionClient;

/**
 * Escopo por papel, com papéis lidos FRESCOS do banco (a sessão pode estar defasada):
 * ADMINISTRADOR vê tudo; GERENTE_COMERCIAL, ele e a equipe (`gerenteComercialId`); VENDEDOR, só ele.
 * Qualquer outro papel (ou usuário inativo/inexistente) lança `ErroPermissao`.
 *
 * Diferença deliberada para `escopoComercialAtual` (_shared/escopo-comercial.ts), plano DF5-11: aqui o vendedor
 * é SÓ ele. As coberturas de carteira (`CoberturaCarteira`, substituição temporária) dão acesso operacional às
 * oportunidades do titular, mas não entram nos relatórios nem nas metas na v1: o desempenho continua de quem
 * é o dono. O gerente também não herda coberturas — vê ele e quem tem `gerenteComercialId` apontando para ele.
 */
export async function escopoRelatorio(u: UsuarioSessao, tx?: Cliente): Promise<EscopoRelatorio> {
  const fresco = await carregarUsuarioFresco(u.id);
  if (!fresco) throw new ErroPermissao();
  if (fresco.papeis.includes(Papel.ADMINISTRADOR)) return { tipo: "TUDO" };
  if (fresco.papeis.includes(Papel.GERENTE_COMERCIAL)) {
    const equipe = await (tx ?? prisma).usuario.findMany({ where: { gerenteComercialId: fresco.id }, select: { id: true } });
    return { tipo: "USUARIOS", ids: [...new Set([fresco.id, ...equipe.map((x) => x.id)])] };
  }
  if (fresco.papeis.includes(Papel.VENDEDOR)) return { tipo: "USUARIOS", ids: [fresco.id] };
  throw new ErroPermissao();
}

export function filtroOportunidade(e: EscopoRelatorio): Prisma.OportunidadeWhereInput {
  return e.tipo === "TUDO" ? {} : { vendedorDonoId: { in: e.ids } };
}
