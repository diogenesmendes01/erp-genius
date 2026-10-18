import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DesempenhoUsuario } from "@/server/relatorios/equipe";
import type { EtapaFunil } from "@/server/relatorios/funil";
import { AbaEquipe } from "./AbaEquipe";
import { AbaFunil } from "./AbaFunil";

const etapa: EtapaFunil = { etapa: "PROPOSTA", chegaram: 3, agora: 2, conversaoProxima: 0.5, tempoMedioDias: 1 };
const pessoa: DesempenhoUsuario = {
  usuarioId: "v1", nome: "Bia", oportunidades: 1, ganhas: 1, conversao: 1, valorGanho: [], primeiraRespostaMediaMin: null,
  tarefasConcluidas: 0, comissao: [], meta: { pct: 0.5 },
};

describe("rótulos das abas de Relatórios", () => {
  it("funil_link_da_etapa_diz_que_abre_o_retrato_atual", () => {
    const html = renderToStaticMarkup(createElement(AbaFunil, { dados: { etapas: [etapa], perdas: [] }, anterior: { etapas: [], perdas: [] }, params: {} }));
    // O painel da etapa lista as oportunidades que estão nela agora (coluna "Agora"), não as que chegaram no período.
    expect(html).toMatch(/<a(?=[^>]*\shref="\/relatorios\?detalhe=etapa%3APROPOSTA")(?=[^>]*\stitle="Ver oportunidades agora nesta etapa")[^>]*>Proposta<\/a>/);
    expect(html).toContain('aria-label="Proposta: ver oportunidades agora nesta etapa"');
  });

  it("equipe_meta_explica_que_soma_os_meses_do_periodo_e_leva_as_metas", () => {
    const html = renderToStaticMarkup(createElement(AbaEquipe, { linhas: [pessoa], anterior: [], params: {} }));
    expect(html).toContain("Meta dos meses do período");
    expect(html).not.toContain(">Meta do mês<");
    expect(html).toMatch(/valor previsto/i);
    expect(html).toMatch(/<a[^>]*href="\/configuracao\/crm\/metas"[^>]*>Definir metas<\/a>/);
  });
});
