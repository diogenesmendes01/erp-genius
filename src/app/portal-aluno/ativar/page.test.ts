import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// docs/42 /portal-aluno/ativar #1 (docs/43 §6 item 8): o HTML que sai do servidor não tem o fragmento da URL,
// então não pode mostrar o formulário (antes ele aparecia habilitado, sem token). O resto da tela é conferido
// em page.interacao.test.ts.
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));
const definir = vi.hoisted(() => vi.fn());
vi.mock("../requisicoes", async (original) => ({ ...(await original<typeof import("../requisicoes")>()), definirSenhaPortalAluno: definir }));

import AtivarPortalAlunoPage from "./page";

describe("ativar — render do servidor", () => {
  it("antes de ler o link: só o aviso de conferência, sem formulário nem campo de senha", () => {
    const html = renderToStaticMarkup(createElement(AtivarPortalAlunoPage));
    expect(html).toContain("Definir senha");
    expect(html).toContain("Conferindo o link de acesso…");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(definir).not.toHaveBeenCalled();
  });
});
