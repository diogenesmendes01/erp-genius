import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166, 7º lote: as abas de câmbio e de configuração do /financeiro passaram a `idempotente: true`. O reenvio de quem
// gravou por último as mesmas cotações (manual ou pela fonte pública) ou já deixou a configuração no estado pedido
// devolve ok sem gravar outra linha nem outro Evento. A trava serializa o clique duplo. Se outra pessoa gravou
// depois, o reenvio grava como antes. A aprovação de desconto repetida está em `politica.int.test.ts`.

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
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { atualizarCotacoesAutomatico, salvarConfigFinanceiro, salvarTaxasCambio } from "./acoes";

let finId: string, fin2Id: string;
const entrar = (id: string) => { sessao.usuarioId = id; };
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo } });

beforeEach(async () => {
  await truncarBanco();
  finId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro")).id;
  fin2Id = (await criarUsuario([Papel.FINANCEIRO], "Financeiro 2")).id;
  entrar(finId);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("cotações manuais repetidas (#166)", () => {
  const entradas = [{ moeda: "CRC", unidadesPorUsd: 512.5 }, { moeda: "BRL", unidadesPorUsd: 5.1 }];

  it("o clique duplo e o reenvio gravam uma vez; outra cotação grava", async () => {
    const [a, b] = await Promise.all([salvarTaxasCambio({ entradas }), salvarTaxasCambio({ entradas })]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await salvarTaxasCambio({ entradas })).ok).toBe(true);
    expect(await prisma.taxaCambio.count()).toBe(2);
    expect(await eventos("TaxasCambioDefinidas")).toBe(1);
    expect((await salvarTaxasCambio({ entradas: [{ moeda: "CRC", unidadesPorUsd: 513 }] })).ok).toBe(true);
    expect(await eventos("TaxasCambioDefinidas")).toBe(2);
  });

  it("se outra pessoa gravou depois, o reenvio grava como antes", async () => {
    expect((await salvarTaxasCambio({ entradas })).ok).toBe(true);
    entrar(fin2Id);
    expect((await salvarTaxasCambio({ entradas: [{ moeda: "CRC", unidadesPorUsd: 500 }] })).ok).toBe(true);
    entrar(finId);
    expect((await salvarTaxasCambio({ entradas })).ok).toBe(true);
    expect(await eventos("TaxasCambioDefinidas")).toBe(3);
  });
});

describe("cotações da fonte pública repetidas (#166)", () => {
  it("a mesma resposta da fonte, em clique duplo e no reenvio, grava uma vez", async () => {
    // Sem país cadastrado, a fonte é consultada só para o BRL (a moeda da matriz).
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: "success", rates: { BRL: 5.1234 } }))));
    const [a, b] = await Promise.all([atualizarCotacoesAutomatico(), atualizarCotacoesAutomatico()]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await atualizarCotacoesAutomatico()).ok).toBe(true);
    expect(await eventos("TaxasCambioDefinidas")).toBe(1);
  });
});

describe("configuração do fechamento automático repetida (#166)", () => {
  it("o mesmo estado não grava outro Evento; mudar grava", async () => {
    const [a, b] = await Promise.all([salvarConfigFinanceiro({ fechamentoComissaoAutomatico: true }), salvarConfigFinanceiro({ fechamentoComissaoAutomatico: true })]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await salvarConfigFinanceiro({ fechamentoComissaoAutomatico: true })).ok).toBe(true);
    expect(await eventos("ConfigFinanceiroAlterada")).toBe(1);
    expect((await salvarConfigFinanceiro({ fechamentoComissaoAutomatico: false })).ok).toBe(true);
    expect(await eventos("ConfigFinanceiroAlterada")).toBe(2);
  });
});
