import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import { temPapel, exigirPapel, ErroPermissao, type UsuarioSessao } from "./sessao";

const vendedor: UsuarioSessao = { id: "u1", nome: "V", papeis: [Papel.VENDEDOR] };
const admin: UsuarioSessao = { id: "u2", nome: "A", papeis: [Papel.ADMINISTRADOR] };

describe("temPapel", () => {
  it("Administrador passa em qualquer verificação", () => {
    expect(temPapel(admin, Papel.FINANCEIRO)).toBe(true);
    expect(temPapel(admin, Papel.PROFESSOR)).toBe(true);
  });
  it("retorna true só quando tem um dos papéis alvo", () => {
    expect(temPapel(vendedor, Papel.VENDEDOR)).toBe(true);
    expect(temPapel(vendedor, Papel.FINANCEIRO)).toBe(false);
    expect(temPapel(vendedor, Papel.FINANCEIRO, Papel.VENDEDOR)).toBe(true);
  });
});

describe("exigirPapel", () => {
  it("não lança quando autorizado", () => {
    expect(() => exigirPapel(vendedor, Papel.VENDEDOR)).not.toThrow();
    expect(() => exigirPapel(admin, Papel.FINANCEIRO)).not.toThrow();
  });
  it("lança ErroPermissao quando não autorizado", () => {
    expect(() => exigirPapel(vendedor, Papel.FINANCEIRO)).toThrow(ErroPermissao);
  });
});
