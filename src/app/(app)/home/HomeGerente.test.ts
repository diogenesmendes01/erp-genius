import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { HomeGerente } from "./HomeGerente";

type Dados = Parameters<typeof HomeGerente>[0]["dados"];
const dados = (metaMatriculasMes: Dados["kpis"]["metaMatriculasMes"], extra: Partial<Dados> = {}): Dados => ({
  kpis: { leadsHoje: 1, conversao: 10, matriculasMes: 7, receitaMes: [], alertasSla: 0, checkInsVencidos: 0, aprovacoesPendentes: 2, metaMatriculasMes },
  indicadores: [],
  funil: [],
  ...extra,
});
const render = (d: Dados) => renderToStaticMarkup(createElement(HomeGerente, { nome: "Gil Souza", dados: d }));

function cartaoMatriculas(html: string): string {
  const i = html.indexOf("Matrículas ativadas no mês");
  expect(i).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf('<div class="rounded-lg', i), html.indexOf("</div></div>", i) + 12);
}

describe("HomeGerente · KPI de matrículas", () => {
  it("sem_meta_mostra_so_as_matriculas_ativadas", () => {
    const c = cartaoMatriculas(render(dados(null)));
    expect(c).toContain(">7<");
    expect(c).toContain("font-mono");
    expect(c).toContain("tabular-nums");
    expect(c).not.toContain("data-kpi-detalhe");
    expect(c).not.toContain("Meta");
  });

  it("com_meta_separa_meta_e_realizado_do_funil_num_subtexto_rotulado", () => {
    const c = cartaoMatriculas(render(dados({ meta: 10, realizado: 3 })));
    expect(c).toContain(">7<");
    expect(c).toContain("Meta do funil: 3 de 10 leads em Matriculado");
    expect(c).not.toContain("feitas");
  });

  it("mostra_gargalos_sla_e_aprovacoes_sem_placeholder_p10", () => {
    const html = render(dados(null, {
      kpis: { leadsHoje: 1, conversao: 10, matriculasMes: 7, receitaMes: [], alertasSla: 3, checkInsVencidos: 0, aprovacoesPendentes: 4, metaMatriculasMes: null },
      funil: [{ etapa: "NOVO", total: 5, paradas: 2 }],
      indicadores: [{ id: "v1", nome: "Vera", atendimentosSlaEstourado: 1, retornosPendentes: 2, experimentaisRealizadasMes: 4, matriculadosMes: 1, taxaConversao: 25, oportunidadesParadas: 3 }],
    }));
    expect(html).not.toContain("refinar (P10)");
    expect(html).not.toContain("Critério");
    expect(html).toContain('href="/financeiro/aprovacoes"');
    expect(html).toContain(">4<");
    expect(html).toContain('href="/inbox?prazo=estourado&amp;setor=COMERCIAL"');
    expect(html).toContain('href="/funil?modo=lista"');
    expect(html).toContain("2 paradas");
    const classeSecao = '<section class="min-w-0 rounded-lg border border-gray-200 bg-surface p-4">';
    expect(html.lastIndexOf(classeSecao, html.indexOf("Gargalos do funil"))).toBeGreaterThan(-1);
    expect(html.lastIndexOf(classeSecao, html.indexOf("Indicadores da equipe"))).toBeGreaterThan(-1);
    expect(html.split(classeSecao).length - 1).toBe(2);
    expect(html).toContain('href="/inbox?responsavel=v1"');
    expect(html).toContain('href="/funil?donoId=v1"');
    expect(html).toContain("4 → 1 (25%)");
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("bg-brand-solid");
    expect(html).toContain("bg-surface-muted");
    expect(html).toContain("hover:bg-surface-muted");
    expect(html).toContain("rounded-[6px]");
    expect(html).toContain("bg-brand-bg");
    expect(html).toContain(">Vera<");
    expect(html).toContain("Requer atenção");
    expect(html).toContain("border-border-soft");
    expect(html).toContain('style="width:100%"');
    expect(html).not.toContain("border-gray-300");
    expect(html).not.toContain("bg-green-100");
    expect(html).not.toContain("bg-red-100");
    expect(html).not.toContain("bg-amber-100");
    expect(html).not.toContain("bg-yellow-100");
  });

  it("aprovacao_em_dia_e_estados_vazios_sem_borda_pesada", () => {
    const html = render(dados(null, {
      kpis: { leadsHoje: 0, conversao: 0, matriculasMes: 7, receitaMes: [], alertasSla: 0, checkInsVencidos: 2, aprovacoesPendentes: 0, metaMatriculasMes: null },
    }));
    expect(html).toContain("Em dia");
    expect(html).not.toContain("Requer atenção");
    expect(html).toContain("Nenhuma oportunidade no escopo.");
    expect(html).toContain("Sem vendedores ativos.");
    const classeSecao = '<section class="min-w-0 rounded-lg border border-gray-200 bg-surface p-4">';
    expect(html.lastIndexOf(classeSecao, html.indexOf("Gargalos do funil"))).toBeGreaterThan(-1);
    expect(html.lastIndexOf(classeSecao, html.indexOf("Indicadores da equipe"))).toBeGreaterThan(-1);
    expect(html).toContain("Check-in vencido");
    expect(html).toContain('href="/financeiro/aprovacoes"');
    expect(html).not.toContain("border-gray-300");
    expect(html).not.toContain("bg-red-100");
    expect(html).not.toContain("bg-amber-100");
    expect(html).not.toContain("bg-green-100");
  });
});
