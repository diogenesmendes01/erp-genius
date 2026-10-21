import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (4º lote): criar empresa recebe chave de idempotência. O reenvio da mesma tentativa devolve a empresa já
// criada (um registro, um código, um Evento); a mesma chave com outro cadastro é recusada. Na edição, o mesmo
// cadastro não grava outro EmpresaEditada.

// Sessão: só `exigirSessao`/`exigirSessaoComPapel` são trocadas (mesmo motivo de
// comercial/criar-lead-idempotencia.int.test.ts); os papéis continuam lidos do banco.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { salvarEmpresa } from "./acoes";

let paisId: string;

beforeEach(async () => {
  await truncarBanco();
  paisId = (await seedCatalogoMinimo()).pais.id;
  sessao.usuarioId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro")).id;
});

const contar = (tipo: string) => prisma.evento.count({ where: { tipo, agregadoTipo: "Empresa" } });

describe("salvarEmpresa (criação) com chave (#166)", () => {
  it("a mesma chave, inclusive simultânea, cria uma empresa e devolve o mesmo id", async () => {
    const entrada = { nome: "Acme Corp", paisId, chaveIdempotencia: "chave-empresa-01" };
    const [a, b] = await Promise.all([salvarEmpresa(entrada), salvarEmpresa(entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await salvarEmpresa(entrada)).toEqual(a);
    expect(await prisma.empresa.count()).toBe(1);
    expect(await contar("EmpresaCriada")).toBe(1);
  });

  it("recusa a mesma chave com outro cadastro; sem chave cria como antes", async () => {
    expect((await salvarEmpresa({ nome: "Acme Corp", paisId, chaveIdempotencia: "chave-empresa-02" })).ok).toBe(true);
    const outra = await salvarEmpresa({ nome: "Beta Ltda", paisId, chaveIdempotencia: "chave-empresa-02" });
    expect(outra.ok).toBe(false);
    if (!outra.ok) expect(outra.erro).toMatch(/já foi usada/);
    expect(await prisma.empresa.count()).toBe(1);
    expect((await salvarEmpresa({ nome: "Sem chave", paisId })).ok).toBe(true);
    expect((await salvarEmpresa({ nome: "Sem chave", paisId })).ok).toBe(true);
    expect(await prisma.empresa.count()).toBe(3);
  });

  it("edição com o mesmo cadastro não grava outro EmpresaEditada", async () => {
    const r = await salvarEmpresa({ nome: "Acme Corp", paisId });
    if (!r.ok) throw new Error(r.erro);
    const id = r.dado!.id;
    expect((await salvarEmpresa({ id, nome: "Acme Corporation", paisId })).ok).toBe(true);
    expect((await salvarEmpresa({ id, nome: "Acme Corporation", paisId })).ok).toBe(true);
    expect(await contar("EmpresaEditada")).toBe(1);
  });
});
