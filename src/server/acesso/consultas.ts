import { prisma } from "@/lib/prisma";
import { numeroOuNull } from "@/server/_shared/decimal";
import { exigirSessaoComPapel } from "@/server/_shared";
import { Papel, type Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared/sessao";

// Consultas (leitura) de Usuários — Server Components.
export async function listarUsuarios() {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const usuarios = await prisma.usuario.findMany({
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      papeis: true,
      ativo: true,
      limiteDescontoPct: true,
      limiteDescontoTaxaPct: true,
      limiteDescontoMensalidadePct: true,
      permissoes: true,
      gerenteComercialId: true,
      ultimoAcesso: true,
    },
  });
  // limiteDescontoPct: Decimal → number (borda Server → Client)
  return usuarios.map((u) => ({ ...u, limiteDescontoPct: numeroOuNull(u.limiteDescontoPct), limiteDescontoTaxaPct: numeroOuNull(u.limiteDescontoTaxaPct), limiteDescontoMensalidadePct: numeroOuNull(u.limiteDescontoMensalidadePct) }));
}

export type UsuarioListado = Awaited<ReturnType<typeof listarUsuarios>>[number];

const COBERTURAS_POR_PAGINA = 50;

/**
 * Coberturas da carteira (aba Coberturas de /carteira): o administrador vê todas; o gerente, só as da equipe
 * (titular e substituto sob a gerência dele); os demais papéis não têm a lista. 50 por página, mais recentes primeiro.
 */
export async function listarCoberturas(
  usuario: UsuarioSessao,
  pagina: number,
): Promise<{ itens: { id: string; titular: string; substituto: string; inicio: Date; fim: Date; revogadaEm: Date | null; motivo: string }[]; possuiMais: boolean }> {
  const admin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  if (!admin && !usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) return { itens: [], possuiMais: false };
  const where: Prisma.CoberturaCarteiraWhereInput = admin ? {} : { titular: { gerenteComercialId: usuario.id }, substituto: { gerenteComercialId: usuario.id } };
  const n = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
  const linhas = await prisma.coberturaCarteira.findMany({
    where,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    skip: (n - 1) * COBERTURAS_POR_PAGINA,
    take: COBERTURAS_POR_PAGINA + 1,
    select: { id: true, inicio: true, fim: true, revogadaEm: true, motivo: true, titular: { select: { nome: true } }, substituto: { select: { nome: true } } },
  });
  return {
    itens: linhas.slice(0, COBERTURAS_POR_PAGINA).map((c) => ({ id: c.id, titular: c.titular.nome, substituto: c.substituto.nome, inicio: c.inicio, fim: c.fim, revogadaEm: c.revogadaEm, motivo: c.motivo })),
    possuiMais: linhas.length > COBERTURAS_POR_PAGINA,
  };
}
