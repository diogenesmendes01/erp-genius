import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConteudoRevisao } from "./ConteudoRevisao";

const revisao = {
  pendencias: [], recursos: { internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] }, particulares: [],
  revisoes: [{ turmaId: "turma", codigo: "T-01", fusoOrigem: "America/Sao_Paulo", pendencias: [], previsao: {
    previsaoTermino: "2026-10-01T03:30:00.000Z",
    propostas: [{ encontroId: "encontro", inicioAnterior: "2026-10-01T02:30:00.000Z", fimAnterior: "2026-10-01T03:30:00.000Z", inicioProposto: "2026-10-02T02:30:00.000Z", fimProposto: "2026-10-02T03:30:00.000Z", alterado: true }],
    preservados: [{ id: "preservado", inicio: "2026-10-03T02:30:00.000Z", fim: "2026-10-03T03:30:00.000Z", status: "MINISTRADO" as const }],
  } }],
};

describe("ConteudoRevisao", () => {
  it("exibe instantes de aula no fuso pessoal e identifica o fuso de origem", () => {
    const html = renderToStaticMarkup(createElement(ConteudoRevisao, { r: revisao, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toContain("America/Costa_Rica; origem America/Sao_Paulo");
    expect(html).toContain("Fuso de origem: America/Sao_Paulo · horários exibidos em America/Costa_Rica");
  });

  it("recorre ao fuso de origem sem alterar a fotografia nem os horários", () => {
    const html = renderToStaticMarkup(createElement(ConteudoRevisao, { r: revisao, preferenciaFusoExibicao: null }));
    expect(html).toMatch(/30\/09\/2026.*23:30/);
    expect(html).toContain("America/Sao_Paulo; origem America/Sao_Paulo");
    expect(JSON.stringify(revisao)).toContain("2026-10-01T02:30:00.000Z");
  });

  it("não inventa uma origem para fotografia histórica sem fuso de turma", () => {
    const semOrigem = { ...revisao, revisoes: [{ ...revisao.revisoes[0], fusoOrigem: null }] };
    const html = renderToStaticMarkup(createElement(ConteudoRevisao, { r: semOrigem, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).not.toContain("horários exibidos em");
    expect(html).not.toContain("Encontro 1");
  });
});
