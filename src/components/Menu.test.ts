import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CLASSE_ITEM_MENU, CLASSE_PAINEL_MENU, Menu } from "./Menu";

describe("Menu", () => {
  it("fechado: gatilho com aria-haspopup e aria-expanded=false, sem painel", () => {
    const h = renderToStaticMarkup(createElement(Menu, { rotulo: "Mais ações", gatilho: "...", itens: [{ rotulo: "Editar", aoEscolher: () => {} }] }));
    expect(h).toContain('aria-haspopup="menu"');
    expect(h).toContain('aria-expanded="false"');
    expect(h).toContain('aria-label="Mais ações"');
    expect(h).not.toContain('role="menu"');
  });
  it("classes exatas do painel e do item", () => {
    expect(CLASSE_PAINEL_MENU).toBe("min-w-[220px] rounded-[9px] border border-gray-200 bg-surface-raised py-2 shadow-popover");
    expect(CLASSE_ITEM_MENU).toContain("px-5 py-3");
    expect(CLASSE_ITEM_MENU).toContain("hover:bg-highlight");
  });
});

// #315: o comportamento novo só entra por props explícitas.
it("compacto aberto oferece dica, separador e folha sem top inline", () => {
  const h = renderToStaticMarkup(createElement(Menu, { rotulo: "Mais", gatilho: "…", densidade: "compacta", abertoInicial: true, folhaNoCelular: true,
    itens: [{ rotulo: "Fixar", dica: "só você", divisorDepois: true, aoEscolher() {} }, { rotulo: "Bloquear", dica: "Motivo extenso que precisa caber", desabilitado: true, perigo: true, aoEscolher() {} }] }));
  for (const c of ["w-[290px]", "rounded-dialog", "min-h-[38px]", "text-[13.5px]", 'role="separator"', "só você", "max-h-[85dvh]", "overflow-y-auto", "max-h-[calc(100dvh-16px)]", "Motivo extenso"]) expect(h).toContain(c);
  expect(h).not.toMatch(/style="[^"]*(?:^|;)top:/);
  expect(h).toMatch(/role="menuitem"[^>]*disabled=""/);
});
