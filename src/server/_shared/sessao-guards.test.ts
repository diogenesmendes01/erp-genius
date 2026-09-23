import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({ auth: vi.fn(), usuario: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: m.usuario } } }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));

import { exigirSessao, exigirSessaoPagina, ErroAutenticacao, ErroPermissao } from "./sessao";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exigirSessao", () => {
  it("lança ErroAutenticacao sem sessão", async () => {
    m.auth.mockResolvedValue(null);
    await expect(exigirSessao()).rejects.toThrow(ErroAutenticacao);
  });

  it("lança ErroAutenticacao quando o usuário foi desativado", async () => {
    m.auth.mockResolvedValue({ user: { id: "sessao-desativado" } });
    m.usuario.mockResolvedValue({ nome: "X", papeis: [Papel.VENDEDOR], ativo: false, permissoes: [] });
    await expect(exigirSessao()).rejects.toThrow(ErroAutenticacao);
  });

  it("lança ErroPermissao para usuário só-portal (ALUNO)", async () => {
    m.auth.mockResolvedValue({ user: { id: "sessao-so-aluno" } });
    m.usuario.mockResolvedValue({ nome: "Aluno", papeis: [Papel.ALUNO], ativo: true, permissoes: [] });
    await expect(exigirSessao()).rejects.toThrow(ErroPermissao);
  });

  it("devolve o usuário com papéis e permissões frescos do banco, não do token", async () => {
    m.auth.mockResolvedValue({ user: { id: "sessao-ok" } });
    m.usuario.mockResolvedValue({ nome: "Vendedora", papeis: [Papel.VENDEDOR], ativo: true, permissoes: ["dados.exportar_leads"] });
    const usuario = await exigirSessao();
    expect(usuario).toEqual({ id: "sessao-ok", nome: "Vendedora", papeis: [Papel.VENDEDOR], permissoes: ["dados.exportar_leads"] });
    // O mock devolve `permissoes` independente do que foi pedido — sem checar o select,
    // um `select` que perdesse `permissoes: true` na fonte ainda passaria aqui.
    expect(m.usuario).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ permissoes: true }) }));
  });
});

describe("exigirSessaoPagina", () => {
  it("redireciona para /login sem sessão", async () => {
    m.auth.mockResolvedValue(null);
    await expect(exigirSessaoPagina()).rejects.toThrow("REDIRECT:/login");
  });

  it("redireciona para /acesso-negado quando falta o papel exigido", async () => {
    m.auth.mockResolvedValue({ user: { id: "pagina-sem-papel" } });
    m.usuario.mockResolvedValue({ nome: "Prof", papeis: [Papel.PROFESSOR], ativo: true, permissoes: [] });
    await expect(exigirSessaoPagina(Papel.FINANCEIRO)).rejects.toThrow("REDIRECT:/acesso-negado");
  });

  it("Administrador passa em qualquer papel exigido", async () => {
    m.auth.mockResolvedValue({ user: { id: "pagina-admin" } });
    m.usuario.mockResolvedValue({ nome: "Admin", papeis: [Papel.ADMINISTRADOR], ativo: true, permissoes: [] });
    const usuario = await exigirSessaoPagina(Papel.FINANCEIRO);
    expect(usuario.id).toBe("pagina-admin");
  });
});
