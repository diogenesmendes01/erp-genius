import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), pathname: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("./secoes", () => ({
  SECOES_ACADEMICO: [
    { href: "/academico", label: "Mudanças acadêmicas", exato: true, papeis: ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO"] },
    { href: "/academico/regras", label: "Regras de avaliação", papeis: ["GERENTE_PEDAGOGICO"] },
  ],
}));

import Layout from "./layout";

async function renderizar(papeis: Papel[]) {
  mocks.sessao.mockResolvedValue({ id: "u1", papeis });
  mocks.pathname.mockReturnValue("/academico");
  return renderToStaticMarkup(await Layout({ children: createElement("main", null, "conteúdo") }));
}

describe("layout de /academico — barra de uma aba só", () => {
  beforeEach(() => { mocks.sessao.mockReset(); mocks.pathname.mockReset(); });

  it("papel que abre uma seção só: só a página, sem barra", async () => {
    expect(await renderizar([Papel.SECRETARIA_ACADEMICA])).toBe("<main>conteúdo</main>");
  });

  it("papel que abre duas: a barra aparece", async () => {
    const html = await renderizar([Papel.GERENTE_PEDAGOGICO]);
    expect(html).toContain('aria-label="Seções do acadêmico"');
    expect([...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map((m) => m[1])).toEqual(["/academico", "/academico/regras"]);
  });
});
