import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/comercial/acoes", () => ({ salvarConfigComercial: vi.fn() }));
import { ComercialPainel } from "./ComercialPainel";

describe("ComercialPainel", () => {
  const config = { autoLeadAtivo: false, saudacaoEstado: "SHADOW", saudacaoTexto: "Olá" } as never;
  const simuladas = [{ id: "s1", contato: "Ana", texto: "Olá", quando: "2026-01-01T02:30:00.000Z" }] as never;
  it("formata o instante administrativo no fuso pessoal e preserva o textarea", () => {
    const html = renderToStaticMarkup(createElement(ComercialPainel, { config, simuladas, preferenciaFusoExibicao: "America/Costa_Rica" }));
    expect(html).toContain("31/12/2025, 20:30 (America/Costa_Rica; origem UTC)");
    expect(html).toContain("textarea");
    expect(html).toContain("Olá");
  });
  it("usa UTC sem preferência", () => {
    const html = renderToStaticMarkup(createElement(ComercialPainel, { config, simuladas }));
    expect(html).toContain("01/01/2026, 02:30 (UTC; origem UTC)");
  });
});
