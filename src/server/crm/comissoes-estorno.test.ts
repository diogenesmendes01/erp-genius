import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["FINANCEIRO"] as string[] } },
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  registrarEvento: vi.fn(),
}));
vi.mock("@/lib/prisma", () => {
  const tx = { comissao: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } };
  return { prisma: { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } };
});
vi.mock("@/server/_shared/sessao", async (original) => ({
  ...(await original<typeof import("@/server/_shared/sessao")>()),
  exigirSessao: async () => mocks.usuario.valor,
}));
vi.mock("@/server/_shared/evento", () => ({ registrarEvento: mocks.registrarEvento }));

import { estornarComissao } from "./comissoes-estorno";

const como = (papel: Papel) => { mocks.usuario.valor = { id: "u1", nome: "U", papeis: [papel] }; };

describe("estornarComissao (regras)", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset().mockResolvedValue({ status: "APROVADA" });
    mocks.updateMany.mockReset().mockResolvedValue({ count: 1 });
    mocks.registrarEvento.mockReset();
  });

  it.each([Papel.FINANCEIRO, Papel.ADMINISTRADOR])("%s pode estornar", async (papel) => {
    como(papel);
    expect(await estornarComissao({ id: "c1", motivo: "ERRO_LANCAMENTO" })).toEqual({ ok: true, dado: undefined });
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "c1", status: { in: ["PENDENTE", "APROVADA"] } }, data: { status: "ESTORNADA" } });
    expect(mocks.registrarEvento).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tipo: "ComissaoEstornada", agregadoId: "c1", payload: { de: "APROVADA", motivo: "ERRO_LANCAMENTO" },
    }));
  });

  it.each([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL])("%s não pode estornar e nada é lido nem gravado", async (papel) => {
    como(papel);
    const r = await estornarComissao({ id: "c1", motivo: "ERRO_LANCAMENTO" });
    expect(r).toEqual({ ok: false, erro: "Você não tem acesso a esta função do CRM." });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("comissão PAGA é recusada sem gravar", async () => {
    como(Papel.FINANCEIRO);
    mocks.findUnique.mockResolvedValue({ status: "PAGA" });
    const r = await estornarComissao({ id: "c1", motivo: "CANCELAMENTO_MATRICULA" });
    expect(r).toEqual({ ok: false, erro: "Comissão já paga: o desconto no próximo fechamento ainda não existe." });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.registrarEvento).not.toHaveBeenCalled();
  });

  it("comissão já ESTORNADA é recusada", async () => {
    como(Papel.FINANCEIRO);
    mocks.findUnique.mockResolvedValue({ status: "ESTORNADA" });
    expect(await estornarComissao({ id: "c1", motivo: "ERRO_LANCAMENTO" })).toEqual({ ok: false, erro: "Comissão já estornada." });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("motivo OUTRO exige texto (vazio ou só espaços é recusado)", async () => {
    como(Papel.FINANCEIRO);
    expect(await estornarComissao({ id: "c1", motivo: "OUTRO" })).toEqual({ ok: false, erro: "Descreva o motivo." });
    expect(await estornarComissao({ id: "c1", motivo: "OUTRO", detalhe: "   " })).toEqual({ ok: false, erro: "Descreva o motivo." });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("motivo OUTRO com texto estorna e guarda o detalhe sem espaços nas pontas", async () => {
    como(Papel.FINANCEIRO);
    expect((await estornarComissao({ id: "c1", motivo: "OUTRO", detalhe: "  aluno trocou de vendedor  " })).ok).toBe(true);
    expect(mocks.registrarEvento).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      payload: { de: "APROVADA", motivo: "OUTRO", detalhe: "aluno trocou de vendedor" },
    }));
  });
});
