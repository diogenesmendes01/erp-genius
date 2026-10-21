import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), naoLidas: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/whatsapp/consultas", () => ({ contarNaoLidas: mocks.naoLidas }));
vi.mock("@/components/Sidebar", () => ({ Sidebar: () => createElement("aside", null, "Sidebar") }));
vi.mock("@/components/BarraMobile", () => ({ BarraMobile: () => createElement("header", null, "BarraMobile") }));
vi.mock("@/components/Trilha", () => ({ Trilha: () => createElement("nav", null, "Trilha") }));

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

  it("monta a barra mobile junto da Sidebar, numa coluna no celular e em linha a partir de md", async () => {
    mocks.sessao.mockResolvedValue({ papeis: ["ADMINISTRADOR"], nome: "Ana" });
    mocks.naoLidas.mockResolvedValue(0);
    const html = renderToStaticMarkup(await AppLayout({ children: createElement("p", null, "conteúdo") }));
    // Sem a barra, a Sidebar escondida abaixo de md deixaria o celular sem menu, tema, fuso e sair.
    expect(html).toContain("<header>BarraMobile</header>");
    expect(html).toContain("<aside>Sidebar</aside>");
    expect(html).toMatch(/^<div class="[^"]*flex-col[^"]*md:flex-row/);
  });

  it("a trilha de navegação fica no topo do conteúdo (antes da página), uma vez só no shell", async () => {
    mocks.sessao.mockResolvedValue({ papeis: ["ADMINISTRADOR"], nome: "Ana" });
    mocks.naoLidas.mockResolvedValue(0);
    const html = renderToStaticMarkup(await AppLayout({ children: createElement("p", null, "conteúdo") }));
    expect(html).toContain("><nav>Trilha</nav><p>conteúdo</p></main>");
    expect(html.match(/<nav>Trilha<\/nav>/g)).toHaveLength(1);
  });
});
