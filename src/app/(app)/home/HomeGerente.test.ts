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
    expect(html).toContain('href="/inbox?responsavel=v1"');
    expect(html).toContain('href="/funil?donoId=v1"');
    expect(html).toContain("4 → 1 (25%)");
  });
});
