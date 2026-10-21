import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (2º lote): "Registrar nota" na ficha do contato chama `registrarNotaDaFicha` com chave de
// idempotência. A nota é o próprio Evento `NotaInterna`: o reenvio com a mesma chave não grava outra.

// Sessão: só `exigirSessao` é trocada (mesmo motivo de comercial/criar-lead-idempotencia.int.test.ts).
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return {
    ...o,
    exigirSessao: async () => {
      const u = await o.carregarUsuarioFresco(sessao.usuarioId);
      if (!u) throw new o.ErroAutenticacao();
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { registrarNotaDaFicha } from "./contatos-acoes";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let ana: string;
let bia: string;

const notas = () => prisma.evento.count({ where: { tipo: "NotaInterna", agregadoTipo: "Pessoa" } });

beforeAll(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  ana = (await prisma.pessoa.create({ data: { nome: "Ana" } })).id;
  bia = (await prisma.pessoa.create({ data: { nome: "Bia" } })).id;
  await prisma.oportunidade.createMany({
    data: [
      { nome: "Ana", vendedorDonoId: vendedor.id, pessoaId: ana },
      { nome: "Bia", vendedorDonoId: vendedor.id, pessoaId: bia },
    ],
  });
});

beforeEach(() => {
  sessao.usuarioId = vendedor.id;
});

describe("registrarNotaDaFicha com chave de idempotência (#166)", () => {
  it("a mesma chave duas vezes grava uma nota (um Evento) e devolve o mesmo resultado", async () => {
    const antes = await prisma.evento.count();
    const primeira = await registrarNotaDaFicha(ana, "Prefere contato à tarde.", "chave-nota-0001");
    expect(primeira.ok, primeira.ok ? undefined : primeira.erro).toBe(true);
    expect(await prisma.evento.count()).toBe(antes + 1);
    const segunda = await registrarNotaDaFicha(ana, "Prefere contato à tarde.", "chave-nota-0001");
    expect(segunda).toEqual(primeira);
    expect(await prisma.evento.count()).toBe(antes + 1);
  });

  it("dois envios simultâneos com a mesma chave gravam uma só nota", async () => {
    const antes = await notas();
    const [a, b] = await Promise.all([
      registrarNotaDaFicha(ana, "Pediu proposta.", "chave-nota-0002"),
      registrarNotaDaFicha(ana, "Pediu proposta.", "chave-nota-0002"),
    ]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(await notas()).toBe(antes + 1);
  });

  it("recusa a mesma chave com outro texto ou outra pessoa, sem gravar nada", async () => {
    expect((await registrarNotaDaFicha(ana, "Texto A", "chave-nota-0003")).ok).toBe(true);
    const antes = await prisma.evento.count();
    const outroTexto = await registrarNotaDaFicha(ana, "Texto B", "chave-nota-0003");
    const outraPessoa = await registrarNotaDaFicha(bia, "Texto A", "chave-nota-0003");
    expect([outroTexto.ok, outraPessoa.ok]).toEqual([false, false]);
    if (!outroTexto.ok) expect(outroTexto.erro).toMatch(/já foi usada/);
    expect(await prisma.evento.count()).toBe(antes);
  });

  it("a chave é de cada autor; sem chave continua gravando como antes", async () => {
    const antes = await notas();
    expect((await registrarNotaDaFicha(ana, "Mesma nota", "chave-nota-0004")).ok).toBe(true);
    sessao.usuarioId = gerente.id;
    expect((await registrarNotaDaFicha(ana, "Mesma nota", "chave-nota-0004")).ok).toBe(true);
    expect((await registrarNotaDaFicha(ana, "Sem chave")).ok).toBe(true);
    expect((await registrarNotaDaFicha(ana, "Sem chave")).ok).toBe(true);
    expect(await notas()).toBe(antes + 4);
  });
});
