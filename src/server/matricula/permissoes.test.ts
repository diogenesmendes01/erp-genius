import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import { podeAtivarMatricula } from "./permissoes";
import type { UsuarioSessao } from "@/server/_shared/sessao";

function usuario(...papeis: Papel[]): UsuarioSessao {
  return { id: "u", nome: "U", papeis };
}

describe("podeAtivarMatricula", () => {
  it("permite Financeiro e Secretaria Acadêmica", () => {
    expect(podeAtivarMatricula(usuario(Papel.FINANCEIRO))).toBe(true);
    expect(podeAtivarMatricula(usuario(Papel.SECRETARIA_ACADEMICA))).toBe(true);
  });

  it("permite Administrador (passa em qualquer verificação)", () => {
    expect(podeAtivarMatricula(usuario(Papel.ADMINISTRADOR))).toBe(true);
  });

  it("nega Vendedor e Gerente Comercial", () => {
    expect(podeAtivarMatricula(usuario(Papel.VENDEDOR))).toBe(false);
    expect(podeAtivarMatricula(usuario(Papel.GERENTE_COMERCIAL))).toBe(false);
  });

  it("nega usuário sem papéis", () => {
    expect(podeAtivarMatricula(usuario())).toBe(false);
  });
});
