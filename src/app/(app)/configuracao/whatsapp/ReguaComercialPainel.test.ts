import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/comercial/acoes", () => ({ salvarReguaComercial: vi.fn() }));
import { ReguasComerciaisPainel } from "./ReguaComercialPainel";

describe("ReguasComerciaisPainel", () => {
  const props = { reguas: [], numeros: [], templates: [], ensaio: [{ id: "e1", lead: "Ana", passo: "D+1", texto: "Olá", quando: "2026-01-01T02:30:00.000Z" }] };
  it("formata o ensaio no fuso pessoal", () => {
    const html = renderToStaticMarkup(createElement(ReguasComerciaisPainel, { ...props, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toContain("31/12/2025, 20:30 (America/Costa_Rica; origem UTC)");
  });
  it("usa UTC como fallback", () => {
    const html = renderToStaticMarkup(createElement(ReguasComerciaisPainel, props));
    expect(html).toContain("01/01/2026, 02:30 (UTC; origem UTC)");
  });
});
