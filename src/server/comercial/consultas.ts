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
}

/** Config comercial C1 (doc 27), com os defaults de fábrica quando ainda não há registro. */
export async function carregarConfigComercial(): Promise<ConfigComercialView> {
  const c = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  return {
    autoLeadAtivo: c?.autoLeadAtivo ?? false,
    saudacaoEstado: c?.saudacaoEstado ?? "DESLIGADA",
    saudacaoTexto: c?.saudacaoTexto ?? "Olá! Recebemos sua mensagem e já retornamos. 😊",
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
}

/** Config da régua comercial lead-novo (doc 27) — banco ou fábrica (DESLIGADA). */
export async function carregarReguaComercialConfig(): Promise<ReguaComercialConfig> {
  const { CADENCIA_LEAD_NOVO, CHAVE_LEAD_NOVO, POLITICA_LEAD_NOVO_NOME } = await import("./regua-fabrica");
  const p = await prisma.politicaComercial.findUnique({
    where: { chave: CHAVE_LEAD_NOVO },
    include: { degraus: { orderBy: { offsetMinutos: "asc" } } },
  });
  if (!p) {
    return {
      id: null,
      chave: CHAVE_LEAD_NOVO,
      nome: POLITICA_LEAD_NOVO_NOME,
      estado: "DESLIGADA",
      numeroRemetenteId: null,
      janelaInicio: 9,
      janelaFim: 20,
      tetoPorContatoDia: 2,
      degraus: CADENCIA_LEAD_NOVO.map((d) => ({
        passo: d.passo,
        offsetMinutos: d.offsetMinutos,
        rotulo: d.rotulo,
        ativo: true,
        templateId: null,
      })),
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
  };
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
