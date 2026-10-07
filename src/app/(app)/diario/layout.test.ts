import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), pathname: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));

import Layout from "./layout";

async function renderizar(papeis: Papel[], caminho: string) {
  mocks.sessao.mockResolvedValue({ id: "u1", papeis });
  mocks.pathname.mockReturnValue(caminho);
  return renderToStaticMarkup(await Layout({ children: createElement("main", null, "conteúdo") }));
}
const ativas = (html: string) => [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
const hrefs = (html: string) => [...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);

describe("layout de /diario", () => {
  beforeEach(() => { mocks.sessao.mockReset(); mocks.pathname.mockReset(); });

  it("barra de seções com as abas do papel; a raiz acende só em /diario", async () => {
    const html = await renderizar([Papel.PROFESSOR], "/diario");
    expect(html).toContain('aria-label="Seções do diário"');
    expect(hrefs(html)).toEqual([
      "/diario", "/diario/encontros", "/diario/pendencias", "/diario/regularizacoes", "/diario/reposicoes", "/diario/excecoes-gravacao",
    ]);
    expect(html).not.toContain('href="/diario/regularizacoes-gravacao"'); // só Gerência pedagógica e Administrador
    const marcadas = ativas(html);
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toContain('href="/diario"');
    expect(html).toContain("<main>conteúdo</main>");
    expect(mocks.sessao).toHaveBeenCalledWith();
  });

  it("sub-tela de um encontro acende Encontros, não Aulas", async () => {
    const marcadas = ativas(await renderizar([Papel.PROFESSOR], "/diario/encontros/e1/correcao"));
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toContain('href="/diario/encontros"');
  });

  it("regularizacoes e regularizacoes-gravacao: prefixo de texto não é prefixo de rota", async () => {
    const gravacao = ativas(await renderizar([Papel.GERENTE_PEDAGOGICO], "/diario/regularizacoes-gravacao"));
    expect(gravacao).toHaveLength(1);
    expect(gravacao[0]).toContain('href="/diario/regularizacoes-gravacao"');
    const aula = ativas(await renderizar([Papel.GERENTE_PEDAGOGICO], "/diario/regularizacoes"));
    expect(aula).toHaveLength(1);
    expect(aula[0]).toContain('href="/diario/regularizacoes"');
  });

  it("Secretaria (abre só Encontros) e papéis fora da área: só a página, sem barra de uma aba", async () => {
    expect(await renderizar([Papel.SECRETARIA_ACADEMICA], "/diario/encontros")).toBe("<main>conteúdo</main>");
    expect(await renderizar([Papel.VENDEDOR], "/diario")).toBe("<main>conteúdo</main>");
  });
});
