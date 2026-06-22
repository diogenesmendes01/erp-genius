import { Papel, Prisma, EtapaLead, Segmento, Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";

/** Vendedores ativos (para atribuir como dono do lead). */
export async function listarVendedores() {
  return prisma.usuario.findMany({
    where: { papeis: { has: Papel.VENDEDOR }, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

// Visibilidade row-level (doc 07): Vendedor vê só os próprios; Gerente Comercial/Admin veem tudo.
export function escopoLeads(usuario: UsuarioSessao): Prisma.LeadWhereInput {
  const amplo =
    usuario.papeis.includes(Papel.ADMINISTRADOR) ||
    usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  return amplo ? {} : { vendedorDonoId: usuario.id };
}

export interface FiltrosLead {
  b2b?: boolean;
  segmento?: Segmento;
  temperatura?: Temperatura;
  etapa?: EtapaLead;
  vendedorId?: string;
}

export async function listarLeads(usuario: UsuarioSessao, filtros: FiltrosLead = {}) {
  const leads = await prisma.lead.findMany({
    where: {
      ...escopoLeads(usuario),
      ...(filtros.b2b !== undefined ? { b2b: filtros.b2b } : {}),
      ...(filtros.segmento ? { segmento: filtros.segmento } : {}),
      ...(filtros.temperatura ? { temperatura: filtros.temperatura } : {}),
      ...(filtros.etapa ? { etapa: filtros.etapa } : {}),
      ...(filtros.vendedorId ? { vendedorDonoId: filtros.vendedorId } : {}),
    },
    orderBy: { criadoEm: "desc" },
    include: {
      pais: { select: { nome: true } },
      vendedor: { select: { id: true, nome: true } },
    },
  });

  // Projeções de eventos: última ação (qualquer evento) e desde quando está na etapa atual.
  const ids = leads.map((l) => l.id);
  const [ultimas, mudancasEtapa] = ids.length
    ? await Promise.all([
        prisma.evento.groupBy({
          by: ["agregadoId"],
          where: { agregadoTipo: "Lead", agregadoId: { in: ids } },
          _max: { criadoEm: true },
        }),
        prisma.evento.groupBy({
          by: ["agregadoId"],
          where: { agregadoTipo: "Lead", tipo: "EtapaAlterada", agregadoId: { in: ids } },
          _max: { criadoEm: true },
        }),
      ])
    : [[], []];
  const mapUltima = new Map(ultimas.map((u) => [u.agregadoId, u._max.criadoEm]));
  const mapEtapa = new Map(mudancasEtapa.map((u) => [u.agregadoId, u._max.criadoEm]));

  return leads.map((l) => ({
    ...l,
    ultimaAcaoEm: (mapUltima.get(l.id) ?? l.criadoEm) as Date,
    etapaDesde: (mapEtapa.get(l.id) ?? l.criadoEm) as Date,
  }));
}

export async function obterLead(id: string, usuario: UsuarioSessao) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      pais: { select: { id: true, nome: true } },
      vendedor: { select: { id: true, nome: true } },
      matricula: { select: { id: true, codigo: true, status: true } },
      documentos: { where: { arquivado: false }, orderBy: { criadoEm: "desc" } },
    },
  });
  if (!lead) return null;
  // respeita visibilidade do vendedor
  const amplo =
    usuario.papeis.includes(Papel.ADMINISTRADOR) ||
    usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  if (!amplo && lead.vendedorDonoId !== usuario.id) return null;

  const timeline = await prisma.evento.findMany({
    where: { agregadoTipo: "Lead", agregadoId: id },
    orderBy: { criadoEm: "desc" },
    include: { autor: { select: { nome: true } } },
  });

  return { lead, timeline };
}

export type LeadListado = Awaited<ReturnType<typeof listarLeads>>[number];
