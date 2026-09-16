import { prisma } from "@/lib/prisma";
import { Papel } from "@prisma/client";
import { exigirSessaoComPapel } from "@/server/_shared";
import { MODOS_FABRICA, POLITICA_COBRANCA_NOME } from "@/server/cobrancas/fabrica";
import { REGUA } from "@/server/cobrancas/regua";
export * from "./consultas-inbox";
export { escopoNumeros } from "./escopo";
export interface NumeroConfig {
  id: string;
  telefoneE164: string;
  rotulo: string;
  driver: string;
  finalidade: string;
  providerRef: string | null;
  sessao: string;
  donoId: string | null;
  donoNome: string | null;
  ativo: boolean;
}

export async function listarNumerosConfig(): Promise<NumeroConfig[]> {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const numeros = await prisma.numeroWhatsApp.findMany({
    orderBy: { criadoEm: "asc" },
    include: { dono: { select: { nome: true } } },
  });
  return numeros.map((n) => ({
    id: n.id,
    telefoneE164: n.telefoneE164,
    rotulo: n.rotulo,
    driver: n.driver,
    finalidade: n.finalidade,
    providerRef: n.providerRef,
    sessao: n.sessao,
    donoId: n.donoId,
    donoNome: n.dono?.nome ?? null,
    ativo: n.ativo,
  }));
}

export interface TemplateConfig {
  id: string;
  nome: string;
  corpo: string;
  idioma: string;
  categoria: string;
  statusMeta: string;
  metaTemplateId: string | null;
  atualizadoEm: string;
}

export async function listarTemplatesConfig(): Promise<TemplateConfig[]> {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const templates = await prisma.templateWhatsApp.findMany({ orderBy: { nome: "asc" } });
  return templates.map((t) => ({
    id: t.id,
    nome: t.nome,
    corpo: t.corpo,
    idioma: t.idioma,
    categoria: t.categoria,
    statusMeta: t.statusMeta,
    metaTemplateId: t.metaTemplateId,
    atualizadoEm: t.atualizadoEm.toISOString(),
  }));
}

export interface DegrauConfig {
  passo: string;
  offsetDias: number;
  tipo: string;
  rotulo: string;
  modo: string;
  ativo: boolean;
  templateId: string | null;
}

export interface PoliticaConfig {
  /** null = ainda não existe registro (valores de fábrica; o salvar cria). */
  id: string | null;
  nome: string;
  estado: string;
  janelaInicio: number;
  janelaFim: number;
  diasSemana: number[];
  tetoPorContatoDia: number;
  silencioPosInboundHoras: number;
  killSwitch: boolean;
  numeroRemetenteId: string | null;
  degraus: DegrauConfig[];
}

export async function carregarPoliticaConfig(): Promise<PoliticaConfig> {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const p = await prisma.politicaRegua.findFirst({
    where: { escopo: "COBRANCA" },
    include: { degraus: { orderBy: { offsetDias: "asc" } } },
    orderBy: { criadoEm: "asc" },
  });
  if (!p) {
    // Fábrica (doc 26 §defaults): a tela mostra e o salvar materializa o registro.
    return {
      id: null,
      nome: POLITICA_COBRANCA_NOME,
      estado: "DESLIGADA",
      janelaInicio: 9,
      janelaFim: 20,
      diasSemana: [1, 2, 3, 4, 5],
      tetoPorContatoDia: 2,
      silencioPosInboundHoras: 72,
      killSwitch: false,
      numeroRemetenteId: null,
      degraus: REGUA.map((d) => ({
        passo: d.passo,
        offsetDias: d.offsetDias,
        tipo: d.tipo,
        rotulo: d.rotulo,
        modo: MODOS_FABRICA[d.passo],
        ativo: true,
        templateId: null,
      })),
    };
  }
  return {
    id: p.id,
    nome: p.nome,
    estado: p.estado,
    janelaInicio: p.janelaInicio,
    janelaFim: p.janelaFim,
    diasSemana: p.diasSemana,
    tetoPorContatoDia: p.tetoPorContatoDia,
    silencioPosInboundHoras: p.silencioPosInboundHoras,
    killSwitch: p.killSwitch,
    numeroRemetenteId: p.numeroRemetenteId,
    degraus: p.degraus.map((d) => ({
      passo: d.passo,
      offsetDias: d.offsetDias,
      tipo: d.tipo,
      rotulo: d.rotulo,
      modo: d.modo,
      ativo: d.ativo,
      templateId: d.templateId,
    })),
  };
}
