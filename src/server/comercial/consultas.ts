import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { exigirSessaoComPapel } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { TIPOS_MUDAM_ETAPA } from "./schema";
import { whereFiltrosLead, type FiltrosLead } from "./filtros";

/** Vendedores ativos (para atribuir como dono do lead). */
export async function listarVendedores() {
  const usuario = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  return prisma.usuario.findMany({
    where: {
      papeis: { has: Papel.VENDEDOR }, ativo: true,
      ...(usuario.papeis.includes(Papel.ADMINISTRADOR) ? {} : usuario.papeis.includes(Papel.GERENTE_COMERCIAL) ? { gerenteComercialId: usuario.id } : { id: usuario.id }),
    },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

/** Compatibilidade para consumidores antigos; equipe e cobertura são relidas no servidor. */
export async function escopoLeads(usuario: UsuarioSessao): Promise<Prisma.OportunidadeWhereInput> {
  return escopoComercialAtual(usuario);
}

export type { FiltrosLead };

const podeListarLeads = (usuario: UsuarioSessao) =>
  !!usuario?.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.GERENTE_COMERCIAL || p === Papel.VENDEDOR);

/** Escopo comercial do usuário E os filtros (interseção — um filtro nunca amplia a carteira). */
async function whereListaLeads(usuario: UsuarioSessao, filtros: FiltrosLead): Promise<Prisma.OportunidadeWhereInput> {
  return { AND: [await escopoComercialAtual(usuario), whereFiltrosLead(filtros)] };
}

export async function listarLeads(usuario: UsuarioSessao, filtros: FiltrosLead = {}, pagina?: { skip: number; take: number }) {
  if (!podeListarLeads(usuario)) return [];
  const leads = await prisma.oportunidade.findMany({
    where: await whereListaLeads(usuario, filtros),
    // id como desempate: sem ele, leads criados no mesmo instante podiam trocar de página entre consultas.
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    ...(pagina ?? {}),
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
          where: {
            agregadoTipo: "Lead",
            tipo: { in: TIPOS_MUDAM_ETAPA },
            agregadoId: { in: ids },
          },
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
  if (!usuario?.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.GERENTE_COMERCIAL || p === Papel.VENDEDOR)) return null;
  const lead = await prisma.oportunidade.findFirst({
    where: { AND: [{ id }, await escopoComercialAtual(usuario)] },
    include: {
      pais: { select: { id: true, nome: true } },
      vendedor: { select: { id: true, nome: true } },
      matricula: {
        select: {
          id: true,
          codigo: true,
          status: true,
          secretariaAssumiuEm: true,
          // C4 (fechamento): estado do contrato + taxa (link de pagamento) para a ficha.
          contratoOk: true,
          contratoEnviadoEm: true,
          cobrancas: {
            where: { tipo: "MATRICULA" },
            select: { id: true, status: true, linkPagamento: true, linkEnviadoEm: true },
          },
        },
      },
      documentos: { where: { arquivado: false }, orderBy: { criadoEm: "desc" } },
    },
  });
  if (!lead) return null;

  const timeline = await prisma.evento.findMany({
    where: { agregadoTipo: "Lead", agregadoId: id },
    orderBy: { criadoEm: "desc" },
    include: { autor: { select: { nome: true } } },
  });

  const cadastroAdministrativo = usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA);
  return {
    lead: {
      ...lead,
      documentos: cadastroAdministrativo ? lead.documentos : lead.documentos.filter((d) => d.categoria !== "OUTRO" && (!lead.matricula?.secretariaAssumiuEm || d.categoria === "PROPOSTA")),
    },
    timeline,
  };
}

export type LeadListado = Awaited<ReturnType<typeof listarLeads>>[number];
