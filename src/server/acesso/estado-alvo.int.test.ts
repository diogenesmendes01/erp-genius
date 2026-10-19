import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { definirUsuarioAtivo } from "./acoes";

// B4 (#175 C2): ativar/desativar usuário recebe o estado-alvo. Com a tela velha, o segundo administrador que
// confirma o mesmo estado não desfaz o primeiro e não grava evento.

beforeEach(async () => { await truncarBanco(); });

describe("definirUsuarioAtivo — estado-alvo explícito", () => {
  it("dois administradores ativam com a tela velha: o segundo não desativa nem grava evento", async () => {
    const [a, b] = [await criarUsuario([Papel.ADMINISTRADOR], "A"), await criarUsuario([Papel.ADMINISTRADOR], "B")];
    const alvo = await criarUsuario([Papel.PROFESSOR], "Alvo");
    await prisma.usuario.update({ where: { id: alvo.id }, data: { ativo: false } });

    authMock.mockResolvedValue({ user: { id: a.id } });
    expect((await definirUsuarioAtivo(alvo.id, true)).ok).toBe(true);
    authMock.mockResolvedValue({ user: { id: b.id } });
    expect((await definirUsuarioAtivo(alvo.id, true)).ok).toBe(true);

    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: alvo.id } })).ativo).toBe(true);
    expect((await eventosDo("Usuario", alvo.id)).map((e) => [e.tipo, e.autorId])).toEqual([["UsuarioAtivado", a.id]]);
  });

  it("dois administradores desativam: o segundo não reativa nem grava evento", async () => {
    const [a, b] = [await criarUsuario([Papel.ADMINISTRADOR], "A"), await criarUsuario([Papel.ADMINISTRADOR], "B")];
    const alvo = await criarUsuario([Papel.PROFESSOR], "Alvo");
    authMock.mockResolvedValue({ user: { id: a.id } });
    expect((await definirUsuarioAtivo(alvo.id, false)).ok).toBe(true);
    authMock.mockResolvedValue({ user: { id: b.id } });
    expect((await definirUsuarioAtivo(alvo.id, false)).ok).toBe(true);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: alvo.id } })).ativo).toBe(false);
    const evs = await eventosDo("Usuario", alvo.id);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ tipo: "UsuarioDesativado", autorId: a.id, payload: { de: true, para: false } });
  });

  it("ninguém desativa a si mesmo; ativar a si mesmo (já ativo) é no-op", async () => {
    const adm = await criarUsuario([Papel.ADMINISTRADOR]);
    authMock.mockResolvedValue({ user: { id: adm.id } });
    expect(await definirUsuarioAtivo(adm.id, false)).toMatchObject({ ok: false, erro: "Você não pode desativar a si mesmo." });
    expect((await definirUsuarioAtivo(adm.id, true)).ok).toBe(true);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: adm.id } })).ativo).toBe(true);
    expect(await eventosDo("Usuario", adm.id)).toHaveLength(0);
  });

  it("estado-alvo não booleano é recusado sem gravar", async () => {
    const adm = await criarUsuario([Papel.ADMINISTRADOR]);
    const alvo = await criarUsuario([Papel.PROFESSOR]);
    authMock.mockResolvedValue({ user: { id: adm.id } });
    expect((await definirUsuarioAtivo(alvo.id, "false" as unknown as boolean)).ok).toBe(false);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: alvo.id } })).ativo).toBe(true);
    expect(await eventosDo("Usuario", alvo.id)).toHaveLength(0);
  });
});
