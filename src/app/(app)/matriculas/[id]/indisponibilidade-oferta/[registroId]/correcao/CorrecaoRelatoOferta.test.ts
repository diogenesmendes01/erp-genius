import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/matricula/indisponibilidade-oferta-correcao", () => ({
  decidirCorrecaoRelatoIndisponibilidadeOferta: vi.fn(),
  proporCorrecaoRelatoIndisponibilidadeOferta: vi.fn(),
}));

import { DecidirCorrecaoRelato, ProporCorrecaoRelato } from "./CorrecaoRelatoOferta";

describe("correção do período do relato (Q157)", () => {
  it("relato encerrado: propõe início e fim, partindo do período vigente", () => {
    const html = renderToStaticMarkup(createElement(ProporCorrecaoRelato, { registroId: "r", inicio: "2026-10-01", fim: "2026-10-10" }));
    expect(html).toMatch(/<input(?=[^>]*name="inicio")(?=[^>]*type="date")(?=[^>]*value="2026-10-01")[^>]*>/);
    expect(html).toMatch(/<input(?=[^>]*name="fim")(?=[^>]*type="date")(?=[^>]*value="2026-10-10")[^>]*>/);
    expect(html).toContain("Propor correção");
  });

  it("relato aberto: só o início; o último dia segue pelo término aprovado", () => {
    const html = renderToStaticMarkup(createElement(ProporCorrecaoRelato, { registroId: "r", inicio: "2026-10-01", fim: null }));
    expect(html).not.toMatch(/name="fim"/);
    expect(html).toContain("o último dia é registrado pelo término da indisponibilidade");
  });

  it("decisão independente oferece aprovar e rejeitar, com motivo e evidência obrigatórios", () => {
    const html = renderToStaticMarkup(createElement(DecidirCorrecaoRelato, { propostaId: "p" }));
    expect(html).toContain("Aprovar correção");
    expect(html).toContain("Rejeitar correção");
    expect(html.match(/aria-required="true"/g)).toHaveLength(2);
    expect(html).toContain("não altera cobranças por si só");
  });
});
