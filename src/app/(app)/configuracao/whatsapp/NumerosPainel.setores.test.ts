import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ salvarNumeroWhatsApp: vi.fn(), conectarNumeroQr: vi.fn(), consultarSessaoNumero: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-numero", () => ({ salvarSetoresNumero: vi.fn() }));

import { SetoresNumeroEditor } from "./NumerosPainel";

const responsaveis = [{ id: "u1", nome: "Ana Secretaria" }];
const html = (setores: ("COMERCIAL" | "FINANCEIRO" | "SECRETARIA" | "PEDAGOGICO")[]) =>
  renderToStaticMarkup(
    createElement(SetoresNumeroEditor, { numero: { id: "n1", setores, triagemResponsavelId: null }, responsaveis }),
  );

describe("NumerosPainel — setores do número", () => {
  it("mostra os quatro setores e o campo de triagem só com mais de um setor", () => {
    const um = html(["COMERCIAL"]);
    for (const r of ["Comercial", "Financeiro", "Secretaria", "Pedagógico"]) expect(um).toContain(r);
    expect(um).toContain("Setores atendidos");
    expect(um).not.toContain("Responsável pela triagem");

    const dois = html(["SECRETARIA", "FINANCEIRO"]);
    expect(dois).toContain("Setores atendidos");
    expect(dois).toContain("Responsável pela triagem");
    expect(dois).toContain("Ana Secretaria");
  });
});
