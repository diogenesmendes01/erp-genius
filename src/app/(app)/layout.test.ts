import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), naoLidas: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/whatsapp/consultas", () => ({ contarNaoLidas: mocks.naoLidas }));
vi.mock("@/components/Sidebar", () => ({ Sidebar: () => createElement("aside", null, "Sidebar") }));
vi.mock("@/components/BarraMobile", () => ({ BarraMobile: () => createElement("header", null, "BarraMobile") }));

import AppLayout from "./layout";

describe("AppLayout", () => {
  it("expõe um skip link para #conteudo e marca o main com esse id", async () => {
    mocks.sessao.mockResolvedValue({ papeis: ["ADMINISTRADOR"], nome: "Ana" });
    mocks.naoLidas.mockResolvedValue(0);
    const html = renderToStaticMarkup(await AppLayout({ children: createElement("p", null, "conteúdo") }));
    expect(html).toContain('href="#conteudo"');
    expect(html).toContain("Pular para o conteúdo");
    expect(html).toMatch(/<main id="conteudo"/);
  });
});
