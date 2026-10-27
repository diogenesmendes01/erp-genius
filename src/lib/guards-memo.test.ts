import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(async () => ({ nome: "Ana", papeis: ["SECRETARIA_ACADEMICA"], ativo: true, permissoes: [] as string[] })),
}));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: <A extends unknown[], R>(f: (...a: A) => R) => {
    const memo = new Map<string, R>();
    return (...a: A) => {
      const chave = JSON.stringify(a);
      if (!memo.has(chave)) memo.set(chave, f(...a));
      return memo.get(chave)!;
    };
  },
}));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: mocks.findUnique } } }));

import { papeisDaSessao } from "./guards";
import { carregarUsuarioFresco } from "@/server/_shared/sessao";

describe("memo único de usuário por requisição", () => {
  beforeEach(() => mocks.findUnique.mockClear());

  it("papeisDaSessao e os guards de sessão fazem UMA leitura do usuário na requisição", async () => {
    expect(await papeisDaSessao()).toEqual([Papel.SECRETARIA_ACADEMICA]);
    const usuario = await carregarUsuarioFresco("u1");
    expect(usuario?.papeis).toEqual([Papel.SECRETARIA_ACADEMICA]);
    await papeisDaSessao();
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  });

  it("o objeto compartilhado pelo memo é congelado — alterar falha em vez de vazar entre consultas", async () => {
    const usuario = await carregarUsuarioFresco("u1");
    expect(Object.isFrozen(usuario)).toBe(true);
    expect(Object.isFrozen(usuario!.papeis)).toBe(true);
    expect(() => (usuario!.papeis as Papel[]).push(Papel.ADMINISTRADOR)).toThrow(TypeError);
  });
});
