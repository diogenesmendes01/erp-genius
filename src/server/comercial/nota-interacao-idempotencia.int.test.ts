import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166 (3º lote): a nota interna do lead (painel da oportunidade) e o registro de interação (edição da
// oportunidade) são o próprio Evento. Com chave, o reenvio da mesma tentativa não grava outro.

// Sessão: só `exigirSessao` é trocada (mesmo motivo de criar-lead-idempotencia.int.test.ts).
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

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { registrarInteracao, registrarNotaInterna } from "./acoes";

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let ana: string;
let bia: string;

beforeAll(async () => {
  await truncarBanco();
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  ana = (await prisma.oportunidade.create({ data: { nome: "Ana", vendedorDonoId: vendedor.id } })).id;
  bia = (await prisma.oportunidade.create({ data: { nome: "Bia", vendedorDonoId: vendedor.id } })).id;
});

beforeEach(() => { sessao.usuarioId = vendedor.id; });

const contar = (tipo: string) => prisma.evento.count({ where: { tipo, agregadoTipo: "Lead" } });

describe("registrarNotaInterna com chave (#166)", () => {
  it("a mesma chave (inclusive em envio simultâneo) grava uma nota só e devolve o mesmo resultado", async () => {
    const antes = await contar("NotaInterna");
    const [a, b] = await Promise.all([
      registrarNotaInterna(ana, { nota: "Prefere à tarde", chaveIdempotencia: "chave-nota-lead-01" }),
      registrarNotaInterna(ana, { nota: "Prefere à tarde", chaveIdempotencia: "chave-nota-lead-01" }),
    ]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(await registrarNotaInterna(ana, { nota: "Prefere à tarde", chaveIdempotencia: "chave-nota-lead-01" })).toEqual(a);
    expect(await contar("NotaInterna")).toBe(antes + 1);
  });

  it("recusa a mesma chave com outro texto ou outro lead; sem chave grava como antes", async () => {
    expect((await registrarNotaInterna(ana, { nota: "Texto A", chaveIdempotencia: "chave-nota-lead-02" })).ok).toBe(true);
    const antes = await contar("NotaInterna");
    const outroTexto = await registrarNotaInterna(ana, { nota: "Texto B", chaveIdempotencia: "chave-nota-lead-02" });
    const outroLead = await registrarNotaInterna(bia, { nota: "Texto A", chaveIdempotencia: "chave-nota-lead-02" });
    expect([outroTexto.ok, outroLead.ok]).toEqual([false, false]);
    if (!outroTexto.ok) expect(outroTexto.erro).toMatch(/já foi usada/);
    expect(await contar("NotaInterna")).toBe(antes);
    expect((await registrarNotaInterna(ana, { nota: "Sem chave" })).ok).toBe(true);
    expect((await registrarNotaInterna(ana, { nota: "Sem chave" })).ok).toBe(true);
    expect(await contar("NotaInterna")).toBe(antes + 2);
  });
});

describe("registrarInteracao com chave (#166)", () => {
  it("a mesma chave (inclusive em envio simultâneo) grava uma interação só e devolve o mesmo resultado", async () => {
    const antes = await contar("InteracaoRegistrada");
    const entrada = { canal: "LIGACAO", nota: "Ligou pedindo horário", chaveIdempotencia: "chave-interacao-01" };
    const [a, b] = await Promise.all([registrarInteracao(ana, entrada), registrarInteracao(ana, entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(await registrarInteracao(ana, entrada)).toEqual(a);
    expect(await contar("InteracaoRegistrada")).toBe(antes + 1);
  });

  it("recusa a mesma chave com outro canal, outra nota ou outro lead, sem gravar", async () => {
    const entrada = { canal: "LIGACAO", nota: "Combinou visita", chaveIdempotencia: "chave-interacao-02" };
    expect((await registrarInteracao(ana, entrada)).ok).toBe(true);
    const antes = await contar("InteracaoRegistrada");
    const r = await Promise.all([
      registrarInteracao(ana, { ...entrada, canal: "PRESENCIAL" }),
      registrarInteracao(ana, { ...entrada, nota: "Outra coisa" }),
      registrarInteracao(bia, entrada),
    ]);
    expect(r.map((x) => x.ok)).toEqual([false, false, false]);
    expect(await contar("InteracaoRegistrada")).toBe(antes);
  });
});
