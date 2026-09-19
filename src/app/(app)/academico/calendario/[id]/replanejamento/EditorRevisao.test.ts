import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/agenda/replanejamento-consulta", () => ({ preverReplanejamentoCalendario: vi.fn() }));
vi.mock("@/server/agenda/replanejamento-rascunho", () => ({ registrarRascunhoReplanejamento: vi.fn() }));

import { EditorRevisao } from "./EditorRevisao";

const inicial = {
  calendarioId: "calendario", estadoHash: "a".repeat(64), versaoRascunho: 2,
  ajustes: [{ encontroId: "encontro", data: "2026-10-01", horario: "23:30", motivo: "Ajuste de teste" }],
  pendencias: [], recursos: { internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] }, particulares: [],
  revisoes: [{ turmaId: "turma", codigo: "T-01", fusoOrigem: "America/Sao_Paulo", pendencias: [], previsao: {
    previsaoTermino: null, propostas: [{ encontroId: "encontro", inicioAnterior: "2026-10-01T02:30:00.000Z", fimAnterior: "2026-10-01T03:30:00.000Z", inicioProposto: "2026-10-01T02:30:00.000Z", fimProposto: "2026-10-01T03:30:00.000Z", alterado: false }], preservados: [],
  } }],
} as any;

describe("EditorRevisao", () => {
  it("altera somente a visualização e preserva os inputs civis no fuso da turma", () => {
    const html = renderToStaticMarkup(createElement(EditorRevisao, { inicial, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toContain('value="2026-10-01"');
    expect(html).toContain('value="23:30"');
    expect(html).toContain("Data no fuso da turma");
    expect(html).toContain("America/Costa_Rica; origem America/Sao_Paulo");
  });
});
