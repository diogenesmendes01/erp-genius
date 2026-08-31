import { Papel, Prisma, EtapaLead, Segmento, Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { TIPOS_MUDAM_ETAPA } from "./schema";

/** Vendedores ativos (para atribuir como dono do lead). */
export async function listarVendedores() {
  return prisma.usuario.findMany({
    where: { papeis: { has: Papel.VENDEDOR }, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

export interface ConfigComercialView {
  autoLeadAtivo: boolean;
  saudacaoEstado: "DESLIGADA" | "SHADOW" | "ATIVA";
  saudacaoTexto: string;
  /** C3 (doc 27): copiloto IA só-leitura — nasce desligado. */
  copilotoAtivo: boolean;
  copilotoQuietudeMinutos: number;
  /** C4 (doc 27): matrícula automática — nasce desligada. */
  matriculaAutomaticaAtiva: boolean;
  /** C5 (doc 27): gestão (alerta SLA + relatório diário) — nasce desligada. */
  gestaoEstado: "DESLIGADA" | "SHADOW" | "ATIVA";
  gestaoTelefoneE164: string | null;
  gestaoNumeroId: string | null;
  gestaoSlaMinutos: number;
  gestaoRelatorioHora: number;
}

/** Config comercial C1 (doc 27), com os defaults de fábrica quando ainda não há registro. */
export async function carregarConfigComercial(): Promise<ConfigComercialView> {
  const c = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  return {
    autoLeadAtivo: c?.autoLeadAtivo ?? false,
    saudacaoEstado: c?.saudacaoEstado ?? "DESLIGADA",
    saudacaoTexto: c?.saudacaoTexto ?? "Olá! Recebemos sua mensagem e já retornamos. 😊",
    copilotoAtivo: c?.copilotoAtivo ?? false,
    copilotoQuietudeMinutos: c?.copilotoQuietudeMinutos ?? 10,
    matriculaAutomaticaAtiva: c?.matriculaAutomaticaAtiva ?? false,
    gestaoEstado: c?.gestaoEstado ?? "DESLIGADA",
    gestaoTelefoneE164: c?.gestaoTelefoneE164 ?? null,
    gestaoNumeroId: c?.gestaoNumeroId ?? null,
    gestaoSlaMinutos: c?.gestaoSlaMinutos ?? 30,
    gestaoRelatorioHora: c?.gestaoRelatorioHora ?? 19,
  };
}

export interface DegrauComercialConfig {
  passo: string;
  offsetMinutos: number;
  rotulo: string;
  ativo: boolean;
  templateId: string | null;
}

export interface ReguaComercialConfig {
  id: string | null;
  chave: string;
  nome: string;
  estado: "DESLIGADA" | "SHADOW" | "ATIVA";
  numeroRemetenteId: string | null;
  janelaInicio: number;
  janelaFim: number;
  tetoPorContatoDia: number;
  degraus: DegrauComercialConfig[];
  /** B1 (doc 32): cohort do piloto — allowlist explícita de leads. */
  modoPiloto: boolean;
  pilotoLeads: { id: string; codigo: string | null; nome: string }[];
}

/** Config de TODAS as réguas comerciais (doc 27 C1/C2) — banco ou fábrica (DESLIGADA). */
export async function carregarReguasComerciaisConfig(): Promise<ReguaComercialConfig[]> {
  const { CADENCIAS_COMERCIAIS } = await import("./regua-fabrica");
  const registros = await prisma.politicaComercial.findMany({
    include: { degraus: { orderBy: { offsetMinutos: "asc" } } },
  });
  const porChave = new Map(registros.map((p) => [p.chave, p]));

  // Resolve nome/código dos leads das allowlists (B1) numa consulta só.
  const todosIds = [...new Set(registros.flatMap((p) => p.pilotoLeadIds))];
  const leadsAllow = todosIds.length
    ? await prisma.lead.findMany({ where: { id: { in: todosIds } }, select: { id: true, codigo: true, nome: true } })
    : [];
  const leadsPorId = new Map(leadsAllow.map((l) => [l.id, { id: l.id, codigo: l.codigo, nome: l.nome }]));

  return CADENCIAS_COMERCIAIS.map((cadencia) => {
    const p = porChave.get(cadencia.chave);
    if (!p) {
      return {
        id: null,
        chave: cadencia.chave,
        nome: cadencia.nome,
        estado: "DESLIGADA" as const,
        numeroRemetenteId: null,
        janelaInicio: 9,
        janelaFim: 20,
        tetoPorContatoDia: 2,
        degraus: cadencia.degraus.map((d) => ({
          passo: d.passo,
          offsetMinutos: d.offsetMinutos,
          rotulo: d.rotulo,
          ativo: true,
          templateId: null,
        })),
        modoPiloto: true,
        pilotoLeads: [],
      };
    }
    return {
      id: p.id,
      chave: p.chave,
      nome: p.nome,
      estado: p.estado,
      numeroRemetenteId: p.numeroRemetenteId,
      janelaInicio: p.janelaInicio,
      janelaFim: p.janelaFim,
      tetoPorContatoDia: p.tetoPorContatoDia,
      degraus: p.degraus.map((d) => ({
        passo: d.passo,
        offsetMinutos: d.offsetMinutos,
        rotulo: d.rotulo,
        ativo: d.ativo,
        templateId: d.templateId,
      })),
      modoPiloto: p.modoPiloto,
      pilotoLeads: leadsPorId
        ? p.pilotoLeadIds.map((id) => leadsPorId.get(id) ?? { id, codigo: null, nome: "(lead removido)" })
        : [],
    };
  });
}

export interface SaudacaoSimulada {
  id: string;
  contato: string;
  texto: string;
  quando: string;
}

export interface NumeroResumo {
  id: string;
  rotulo: string;
  finalidade: string;
}
export interface TemplateResumo {
  id: string;
  nome: string;
}

/** Projeção MÍNIMA p/ os selects da config comercial — sem expor providerRef/sessão/dono. */
export async function listarNumerosVendasResumo(): Promise<NumeroResumo[]> {
  const numeros = await prisma.numeroWhatsApp.findMany({
    where: { finalidade: "VENDAS" },
    orderBy: { criadoEm: "asc" },
    select: { id: true, rotulo: true, finalidade: true },
  });
  return numeros;
}

export async function listarTemplatesResumo(): Promise<TemplateResumo[]> {
  return prisma.templateWhatsApp.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
}

export interface EnsaioComercial {
  id: string;
  lead: string;
  passo: string;
  texto: string;
  quando: string;
}

/** Ensaio observável da cadência comercial (doc 27 §regra de ouro): as últimas simuladas. */
export async function carregarEnsaioComercial(limite = 10): Promise<EnsaioComercial[]> {
  const intencoes = await prisma.intencaoMensagem.findMany({
    where: { leadId: { not: null }, status: "SIMULADA" },
    orderBy: { criadaEm: "desc" },
    take: limite,
    include: { lead: { select: { nome: true, codigo: true } } },
  });
  return intencoes.map((i) => ({
    id: i.id,
    lead: i.lead?.nome ?? i.lead?.codigo ?? "lead",
    passo: i.passoComercial ?? "—",
    texto: i.corpoRenderizado,
    quando: (i.despachadaEm ?? i.criadaEm).toISOString(),
  }));
}

/**
 * Ensaio observável (doc 27 §regra de ouro — review PR #53): as últimas saudações que o
 * shadow SIMULOU (o que TERIA sido enviado), para o gerente validar o piloto antes de ativar.
 */
export async function carregarSaudacoesSimuladas(limite = 10): Promise<SaudacaoSimulada[]> {
  const intencoes = await prisma.intencaoMensagem.findMany({
    where: { reativa: true, status: "SIMULADA" },
    orderBy: { criadaEm: "desc" },
    take: limite,
    include: { contato: { select: { nomeExibicao: true, telefoneE164: true } } },
  });
  return intencoes.map((i) => ({
    id: i.id,
    contato: i.contato.nomeExibicao ?? i.contato.telefoneE164,
    texto: i.corpoRenderizado,
    quando: (i.despachadaEm ?? i.criadaEm).toISOString(),
  }));
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
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      pais: { select: { id: true, nome: true } },
      vendedor: { select: { id: true, nome: true } },
      matricula: {
        select: {
          id: true,
          codigo: true,
          status: true,
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
