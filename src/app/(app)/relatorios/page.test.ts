import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

const mocks = vi.hoisted(() => ({
  papel: "ADMINISTRADOR",
  exporta: false,
  semAnteriores: false,
  falhaPipeline: false,
  chamadas: [] as { aba: string; inicio: number }[],
}));

vi.mock("@/server/_shared", () => ({
  exigirSessaoPagina: async () => ({ id: "u1", nome: "U", papeis: [mocks.papel], permissoes: [] }),
}));
vi.mock("@/server/_shared/capacidades", () => ({
  exigirCapacidade: async () => {
    if (!mocks.exporta) throw new Error("sem permissão");
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: async () => [{ id: "v1", nome: "Bia" }] } } }));
vi.mock("@/server/relatorios/escopo", () => ({ escopoRelatorio: async () => ({ tipo: "TUDO" }) }));

const ehAnterior = (f: { periodo: { inicio: Date } }, base: { inicio: Date }) => f.periodo.inicio.getTime() < base.inicio.getTime();
let inicioAtual: Date | null = null;
const marca = (aba: string, f: { periodo: { inicio: Date } }) => {
  inicioAtual ??= f.periodo.inicio;
  mocks.chamadas.push({ aba, inicio: f.periodo.inicio.getTime() });
  return ehAnterior(f, { inicio: inicioAtual }) ? "anterior" : "atual";
};

vi.mock("@/server/relatorios/atendimento", () => ({
  fusoDaEscola: async () => "America/Sao_Paulo",
  metricasAtendimento: async (f: { periodo: { inicio: Date } }) => {
    marca("atendimento", f);
    return { conversas: 4, primeiraRespostaMediaMin: 12, prazoEstourado: 0, foraDoHorarioPct: null, volume: [{ dia: "2026-10-01", aria: 2, equipe: 3 }], calor: Array.from({ length: 7 }, () => new Array(15).fill(0)) };
  },
}));
vi.mock("@/server/relatorios/pipeline", () => ({
  metricasPipeline: async (f: { periodo: { inicio: Date } }) => {
    if (mocks.falhaPipeline) throw new Error("boom");
    const lado = marca("pipeline", f);
    const zero = lado === "anterior" && mocks.semAnteriores;
    return {
      valorPipeline: zero ? [] : [{ moeda: "CRC", valor: lado === "anterior" ? 1000 : 1500 }],
      semValor: 3, abertas: zero ? 0 : 10, criadas: zero ? 0 : 5, ganhas: zero ? 0 : 2, conversao: zero ? null : 0.4, ticketMedio: [], cicloMedioDias: null,
    };
  },
}));
vi.mock("@/server/relatorios/funil", () => ({ metricasFunil: async () => ({ etapas: [], perdas: [] }) }));
vi.mock("@/server/relatorios/equipe", () => ({ desempenhoEquipe: async () => [] }));
vi.mock("@/server/relatorios/aria", () => ({ metricasAriaEquipe: async () => ({ aria: { atendimentos: 0, conversao: null, primeiraRespostaMediaMin: null, perdidosSemResposta: 0 }, equipe: { atendimentos: 0, conversao: null, primeiraRespostaMediaMin: null, perdidosSemResposta: 0 }, taxaHandoff: null, sugestoesAprovadas: null, etapasAvancadasAria: 0 }) }));
vi.mock("@/server/relatorios/atividades", () => ({ metricasAtividades: async () => ({ tarefasCriadas: 0, tarefasConcluidasPct: null, mensagensAgendadas: 0, porDia: [], porOrigem: [] }) }));
vi.mock("@/server/relatorios/detalhe", async (original) => ({
  ...(await original<typeof import("@/server/relatorios/detalhe")>()),
  detalharMetrica: async () => ({ total: 1, itens: [{ id: "o1", nome: "Ana Souza", etapa: "NOVO", responsavel: "Bia", valor: null, moeda: null, diasDesdeCriacao: 2, href: "/funil?o=o1" }] }),
}));

import Page from "./page";

async function render(o: { papel: string; aba?: string; semDadosAnteriores?: boolean; sp?: Record<string, string> }) {
  mocks.papel = o.papel;
  mocks.semAnteriores = !!o.semDadosAnteriores;
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ ...(o.aba ? { aba: o.aba } : {}), ...o.sp }) }));
}

/** Variação de cada KPI pelo rótulo, lida do `<span data-variacao>` do cartão. */
function variacoes(html: string): Record<string, string> {
  const r: Record<string, string> = {};
  for (const m of html.matchAll(/<p class="text-xs text-gray-600">([^<]+)<\/p><p class="text-lg font-medium">.*?<span data-variacao="">([^<]*)<\/span>/g)) r[m[1]] = m[2];
  return r;
}

/** Query do link "Exportar CSV". */
function linkExportar(html: string): URLSearchParams {
  const m = html.match(/href="\/api\/relatorios\/exportar\?([^"]*)"/);
  expect(m, "link de exportação").not.toBeNull();
  return new URLSearchParams(m![1].replaceAll("&amp;", "&"));
}

describe("/relatorios (página)", () => {
  beforeEach(() => {
    mocks.exporta = false;
    mocks.falhaPipeline = false;
    mocks.chamadas.length = 0;
    inicioAtual = null;
  });

  it("guard", () => expect(papeisDoGuardArquivo("src/app/(app)/relatorios/page.tsx")).toEqual(["ADMINISTRADOR", "GERENTE_COMERCIAL", "VENDEDOR"]));

  it("vendedor_sem_abas_equipe_e_aria_nem_filtro_responsavel", async () => {
    const html = await render({ papel: "VENDEDOR" });
    expect(html).not.toContain(">Equipe<");
    expect(html).not.toContain(">Aria<");
    expect(html).not.toContain('name="responsavel"');
    expect(html).not.toContain('name="autor"');
  });

  it("administrador_ve_as_abas_equipe_e_aria", async () => {
    const html = await render({ papel: "ADMINISTRADOR" });
    expect(html).toContain(">Equipe<");
    expect(html).toContain(">Aria<");
    expect(html).toContain('name="responsavel"');
  });

  it("vendedor_com_aba_aria_na_url_cai_na_visao", async () => expect(await render({ papel: "VENDEDOR", aba: "aria" })).toContain('aria-current="page">Visão geral'));

  it("kpi_mostra_variacao_e_traco", async () => {
    const semBase = await render({ papel: "ADMINISTRADOR", semDadosAnteriores: true });
    const v = variacoes(semBase);
    // Período anterior zerado/vazio: a variação desses KPIs é o traço, nunca Infinity/NaN.
    for (const rotulo of ["Valor em pipeline", "Oportunidades abertas", "Criadas no período", "Ganhas", "Conversão"]) expect(v[rotulo], rotulo).toBe("—");
    expect(semBase).not.toMatch(/Infinity|NaN/);
    mocks.chamadas.length = 0;
    inicioAtual = null;
    const comBase = await render({ papel: "ADMINISTRADOR" });
    expect(variacoes(comBase)["Valor em pipeline"]).toBe("+50%");
    expect(comBase).not.toMatch(/Infinity|NaN/);
  });

  it("cada_metrica_e_chamada_com_o_periodo_e_com_o_anterior", async () => {
    await render({ papel: "ADMINISTRADOR" });
    const inicios = new Set(mocks.chamadas.filter((c) => c.aba === "pipeline").map((c) => c.inicio));
    expect(inicios.size).toBe(2);
  });

  it("o_que_mudou_sem_icone_de_ia", async () => {
    const html = await render({ papel: "ADMINISTRADOR" });
    expect(html).toContain("O que mudou");
    expect(html).not.toContain('data-icone="sparkles"');
  });

  it("exportar_so_com_capacidade", async () => {
    expect(await render({ papel: "VENDEDOR" })).not.toContain("Exportar CSV");
    mocks.exporta = true;
    const html = await render({ papel: "VENDEDOR" });
    expect(html).toContain("Exportar CSV");
    expect(html).toContain("/api/relatorios/exportar?aba=pipeline");
  });

  it("dado_parcial_mostra_N_sem_valor", async () => expect(await render({ papel: "ADMINISTRADOR" })).toContain("3 sem valor"));

  it("erro_de_consulta_mostra_aviso_sem_vazar_mensagem", async () => {
    mocks.falhaPipeline = true;
    const html = await render({ papel: "ADMINISTRADOR" });
    expect(html).toContain("Não foi possível carregar este relatório");
    expect(html).not.toContain("boom");
  });

  it("periodo_invalido_volta_a_30_dias_com_aviso", async () => {
    const html = await render({ papel: "ADMINISTRADOR", sp: { periodo: "PERSONALIZADO", de: "2026-13-40", ate: "2026-10-01" } });
    expect(html).toContain("Período inválido");
  });

  it("periodo_invalido_exporta_o_periodo_efetivo_30d_sem_de_ate", async () => {
    mocks.exporta = true;
    for (const sp of [{ periodo: "PERSONALIZADO", de: "2026-13-40", ate: "2026-10-01" }, { periodo: "PERSONALIZADO", ate: "2026-10-01" }, { periodo: "PERSONALIZADO" }] as Record<string, string>[]) {
      const html = await render({ papel: "ADMINISTRADOR", sp });
      expect(html).toContain("Período inválido");
      const q = linkExportar(html);
      expect(q.get("periodo"), JSON.stringify(sp)).toBe("30D");
      expect(q.has("de")).toBe(false);
      expect(q.has("ate")).toBe(false);
      expect(html).not.toContain("undefined");
    }
  });

  it("periodo_personalizado_valido_exporta_de_e_ate", async () => {
    mocks.exporta = true;
    const q = linkExportar(await render({ papel: "ADMINISTRADOR", sp: { periodo: "PERSONALIZADO", de: "2026-09-01", ate: "2026-09-30", origem: "WHATSAPP" } }));
    expect(q.get("periodo")).toBe("PERSONALIZADO");
    expect(q.get("de")).toBe("2026-09-01");
    expect(q.get("ate")).toBe("2026-09-30");
    expect(q.get("origem")).toBe("WHATSAPP");
  });

  it("painel_de_detalhe_em_folha_inteira_no_celular", async () => {
    const html = await render({ papel: "ADMINISTRADOR", sp: { detalhe: "abertas" } });
    expect(html).toContain("data-painel-detalhe");
    expect(html).toContain('role="dialog"');
    expect(html).toContain("w-full");
    expect(html).toContain("Ana Souza");
    expect(html).toContain("sem valor");
  });

  it("chave_de_detalhe_invalida_nao_abre_painel", async () => expect(await render({ papel: "ADMINISTRADOR", sp: { detalhe: "etapa:INVENTADA" } })).not.toContain("data-painel-detalhe"));

  it("filtro_de_funil_oculto_sem_funis_da_fase_2", async () => expect(await render({ papel: "ADMINISTRADOR" })).not.toContain('name="funil"'));

  it("tabelas_com_rolagem", async () => expect(await render({ papel: "ADMINISTRADOR", aba: "conversas" })).toContain("overflow-x-auto"));
});
