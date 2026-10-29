import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraEtapas } from "./BarraEtapas";
import { ETAPAS_BARRA, opcoesEtapa, segmentosEtapa } from "./etapas-painel";

const html = (etapa: "PROPOSTA" | "NOVO" | "NO_SHOW", podeMover = true, ocupado = false) =>
  renderToStaticMarkup(createElement(BarraEtapas, { etapa, podeMover, ocupado, aoEscolher: () => {} }));

const botoes = (markup: string) => [...markup.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
const etapas = (markup: string) => botoes(markup).filter((b) => /aria-label="Etapa /.test(b));
const desabilitado = (tag: string) => /(?:\s)disabled(?:=|\s|>)/.test(tag);

describe("BarraEtapas", () => {
  it("mostra os 8 segmentos comerciais e as 10 opções do funil", () => {
    expect(ETAPAS_BARRA).toHaveLength(8);
    expect(segmentosEtapa("PROPOSTA").filter((s) => s.estado === "atual").map((s) => s.etapa)).toEqual(["PROPOSTA"]);
    expect(opcoesEtapa("NOVO")).toHaveLength(10);
    const h = html("PROPOSTA");
    expect(h).toContain('role="group"');
    expect(h).toContain('aria-label="Etapas da oportunidade"');
    expect(h).toContain('aria-current="step"');
    expect(h).toContain('name="etapaOportunidade"');
    expect(h).toContain('value="PROPOSTA"');
    expect(h.match(/<option /g)).toHaveLength(10);
    expect(etapas(h)).toHaveLength(8);
    expect(etapas(h).every((b) => !desabilitado(b))).toBe(true);
  });

  it("desabilita a barra quando não pode mover ou está ocupada", () => {
    for (const h of [html("NOVO", false, false), html("NOVO", true, true)]) {
      expect(etapas(h).every((b) => desabilitado(b))).toBe(true);
      expect(h).toMatch(/<select\b[^>]*disabled/);
    }
  });

  it("NO_SHOW pinta o segmento atual com o sólido de perigo", () => {
    const h = html("NO_SHOW");
    expect(h).toContain("bg-[var(--danger-solid)]");
    expect(segmentosEtapa("NO_SHOW")[4]).toEqual({ etapa: "EXPERIMENTAL_REALIZADA", estado: "atual", tom: "perigo" });
  });
});
