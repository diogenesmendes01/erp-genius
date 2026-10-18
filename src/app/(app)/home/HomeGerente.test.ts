import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { HomeGerente } from "./HomeGerente";

type Dados = Parameters<typeof HomeGerente>[0]["dados"];
const dados = (metaMatriculasMes: Dados["kpis"]["metaMatriculasMes"]): Dados => ({
  kpis: { leadsHoje: 1, conversao: 10, matriculasMes: 7, receitaMes: [], alertasSla: 0, checkInsVencidos: 0, metaMatriculasMes },
  ranking: [],
  equipe: [],
  funil: [],
});
const render = (d: Dados) => renderToStaticMarkup(createElement(HomeGerente, { nome: "Gil Souza", dados: d }));

/** Cartão inteiro do KPI de matrículas (do valor ao fim do cartão). */
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
});
