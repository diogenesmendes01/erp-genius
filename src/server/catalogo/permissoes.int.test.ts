import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { criarIdioma, criarNivel, criarPreco } from "./acoes";
import { listarIdiomas, listarPrecos } from "./consultas";

beforeEach(async () => { await truncarBanco(); });

describe("configuração por domínio — política 36", () => {
  it("GP mantém currículo sem receber nem alterar a configuração financeira", async () => {
    const gp = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    authMock.mockResolvedValue({ user: { id: gp.id } });
    const idioma = await criarIdioma({ nome: "Idioma de teste" });
    expect(idioma.ok).toBe(true);
    const salvo = await prisma.idioma.findFirstOrThrow();
    expect((await criarNivel({ idiomaId: salvo.id, codigo: "A1", ordem: 1 })).ok).toBe(true);
    expect((await listarIdiomas())[0].niveis[0].codigo).toBe("A1");
    await expect(listarPrecos()).rejects.toThrow(/permissão/);
    expect((await criarPreco({ paisId: "outro", produtoId: "outro", tipoCobranca: "MATRICULA", valor: 10 })).ok).toBe(false);
    expect(await prisma.precoReferencia.count()).toBe(0);
  });

  it("professor não ganha manutenção curricular nem consulta de configuração por ser docente", async () => {
    const professor = await criarUsuario([Papel.PROFESSOR]);
    authMock.mockResolvedValue({ user: { id: professor.id } });
    expect((await criarIdioma({ nome: "Indevido" })).ok).toBe(false);
    await expect(listarIdiomas()).rejects.toThrow(/permissão/);
    expect(await prisma.idioma.count()).toBe(0);
  });

  it("revogar GP no banco invalida o cookie anterior na próxima manutenção", async () => {
    const gp = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    authMock.mockResolvedValue({ user: { id: gp.id, papeis: [Papel.GERENTE_PEDAGOGICO] } });
    await prisma.usuario.update({ where: { id: gp.id }, data: { papeis: [Papel.PROFESSOR] } });
    expect((await criarIdioma({ nome: "Indevido após revogação" })).ok).toBe(false);
    await expect(listarIdiomas()).rejects.toThrow(/permissão/);
  });
});
