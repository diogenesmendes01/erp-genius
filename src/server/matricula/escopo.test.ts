import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import { podeConverterLead } from "./escopo";

const vendedor: UsuarioSessao = { id: "v1", nome: "V1", papeis: [Papel.VENDEDOR] };
const outroVendedor: UsuarioSessao = { id: "v2", nome: "V2", papeis: [Papel.VENDEDOR] };
const gerente: UsuarioSessao = { id: "g1", nome: "G", papeis: [Papel.GERENTE_COMERCIAL] };
const admin: UsuarioSessao = { id: "a1", nome: "A", papeis: [Papel.ADMINISTRADOR] };

describe("podeConverterLead", () => {
  it("vendedor converte lead do próprio escopo (dono/designado)", () => {
    expect(podeConverterLead(vendedor, "v1")).toBe(true);
  });

  it("vendedor NÃO converte lead de outro vendedor", () => {
    expect(podeConverterLead(vendedor, "v2")).toBe(false);
    expect(podeConverterLead(outroVendedor, "v1")).toBe(false);
  });

  it("vendedor NÃO converte lead sem dono", () => {
    expect(podeConverterLead(vendedor, null)).toBe(false);
  });

  it("Gerente Comercial converte qualquer lead (visibilidade global)", () => {
    expect(podeConverterLead(gerente, "v1")).toBe(true);
    expect(podeConverterLead(gerente, "v2")).toBe(true);
    expect(podeConverterLead(gerente, null)).toBe(true);
  });

  it("Administrador converte qualquer lead", () => {
    expect(podeConverterLead(admin, "v1")).toBe(true);
    expect(podeConverterLead(admin, null)).toBe(true);
  });
});
