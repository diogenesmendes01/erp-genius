import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ salvarNumeroWhatsApp: vi.fn(), conectarNumeroQr: vi.fn(), consultarSessaoNumero: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-numero", () => ({ salvarSetoresNumero: vi.fn() }));

import { SetoresNumeroEditor } from "./NumerosPainel";

const responsaveis = [
  { id: "u1", nome: "Ana Secretaria", papeis: [Papel.SECRETARIA_ACADEMICA] },
  { id: "u2", nome: "Beto Vendedor", papeis: [Papel.VENDEDOR] },
];
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

  it("a triagem só oferece quem tem papel de um dos setores marcados", () => {
    const secFin = html(["SECRETARIA", "FINANCEIRO"]);
    expect(secFin).toContain("Ana Secretaria");
    expect(secFin).not.toContain("Beto Vendedor");
    const comFin = html(["COMERCIAL", "FINANCEIRO"]);
    expect(comFin).toContain("Beto Vendedor");
    expect(comFin).not.toContain("Ana Secretaria");
  });
});
