import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// B9 (#201 C6): o SSE do Inbox precisa do prazo do JWT com que a conexão abriu, para fechar o stream quando a
// sessão expira. O `exp` do token (segundos) chega à sessão como `expiraEm` (milissegundos).

const m = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: m.usuario } } }));

import { ErroAutenticacao, exigirSessaoComPrazo, prazoDoToken } from "./sessao";

beforeEach(() => {
  vi.resetAllMocks();
  m.usuario.mockResolvedValue({ nome: "Ana", papeis: [Papel.VENDEDOR], ativo: true, permissoes: [] });
});

describe("prazoDoToken", () => {
  it("converte o exp do JWT (segundos) em milissegundos; ausente ou inválido vira null", () => {
    expect(prazoDoToken(1_700_000_000)).toBe(1_700_000_000_000);
    expect(prazoDoToken(undefined)).toBeNull();
    expect(prazoDoToken("1700000000")).toBeNull();
    expect(prazoDoToken(Number.NaN)).toBeNull();
  });
});

describe("exigirSessaoComPrazo", () => {
  it("devolve o usuário fresco e o prazo da sessão", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" }, expiraEm: 1_700_000_000_000 });
    expect(await exigirSessaoComPrazo()).toEqual({
      usuario: { id: "u1", nome: "Ana", papeis: [Papel.VENDEDOR], permissoes: [] },
      expiraEm: 1_700_000_000_000,
    });
  });

  it("sem prazo na sessão: expiraEm null", async () => {
    m.auth.mockResolvedValue({ user: { id: "u1" } });
    expect((await exigirSessaoComPrazo()).expiraEm).toBeNull();
  });

  it("sem sessão ou usuário desativado: ErroAutenticacao", async () => {
    m.auth.mockResolvedValue(null);
    await expect(exigirSessaoComPrazo()).rejects.toBeInstanceOf(ErroAutenticacao);
    m.auth.mockResolvedValue({ user: { id: "u1" }, expiraEm: 1 });
    m.usuario.mockResolvedValue({ nome: "Ana", papeis: [Papel.VENDEDOR], ativo: false, permissoes: [] });
    await expect(exigirSessaoComPrazo()).rejects.toBeInstanceOf(ErroAutenticacao);
  });
});
