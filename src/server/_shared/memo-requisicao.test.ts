import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const coberturas = vi.fn(async () => [] as { titularId: string }[]);
  const equipe = vi.fn(async () => [{ id: "v2" }]);
  return { prisma: { coberturaCarteira: { findMany: coberturas }, usuario: { findMany: equipe } }, coberturas, equipe };
});

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
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { escopoComercialAtual } from "./escopo-comercial";

const gerente = { id: "g1", nome: "Gi", papeis: [Papel.GERENTE_COMERCIAL] };

describe("escopoComercialAtual com memo por requisição", () => {
  beforeEach(() => { mocks.equipe.mockClear(); mocks.coberturas.mockClear(); });

  it("fora de transação: várias chamadas na mesma requisição leem a equipe uma vez só", async () => {
    const a = await escopoComercialAtual(gerente);
    const b = await escopoComercialAtual({ ...gerente });
    expect(a).toEqual({ vendedorDonoId: { in: ["v2"] } });
    expect(b).toEqual(a);
    expect(mocks.equipe).toHaveBeenCalledTimes(1);
  });

  it("dentro de transação: sempre lê na própria transação, nunca do memo", async () => {
    const tx = { coberturaCarteira: { findMany: vi.fn(async () => []) }, usuario: { findMany: vi.fn(async () => [{ id: "v9" }]) } };
    const r1 = await escopoComercialAtual({ ...gerente, id: "g-tx" }, tx as never);
    const r2 = await escopoComercialAtual({ ...gerente, id: "g-tx" }, tx as never);
    expect(r1).toEqual({ vendedorDonoId: { in: ["v9"] } });
    expect(r2).toEqual(r1);
    expect(tx.usuario.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.equipe).not.toHaveBeenCalled();
  });

  it("papéis diferentes não compartilham o memo (a chave inclui os papéis)", async () => {
    const vendedor = { id: "g2", nome: "", papeis: [Papel.VENDEDOR] };
    await escopoComercialAtual({ ...vendedor, papeis: [Papel.GERENTE_COMERCIAL] });
    await escopoComercialAtual(vendedor);
    expect(mocks.equipe).toHaveBeenCalledTimes(1);
    expect(mocks.coberturas).toHaveBeenCalledTimes(1);
  });
});
