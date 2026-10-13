import { beforeEach, describe, expect, it, vi } from "vitest";

// definirSituacaoEmpresa (docs/42 L2281; fatia B do ConfirmarAcao, issue #169): grava só a situação, com o
// estado-alvo explícito — repetir é no-op, nada do cadastro é reenviado —, na alçada do Financeiro e com evento.

const m = vi.hoisted(() => ({
  sessao: vi.fn(), papel: vi.fn(), evento: vi.fn(), revalidar: vi.fn(),
  tx: { empresa: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.tx) } }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidar }));
vi.mock("@/lib/codigo", () => ({ gerarCodigo: vi.fn() }));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: vi.fn() }));
vi.mock("@/server/financeiro/baixa", () => ({ baixarCobrancaTx: vi.fn() }));
vi.mock("@/server/_shared", () => {
  class ErroRegra extends Error {}
  return {
    ErroRegra,
    exigirSessao: m.sessao,
    exigirPapel: m.papel,
    numero: (v: unknown) => Number(v),
    numeroOuNull: (v: unknown) => (v === null ? null : Number(v)),
    registrarEvento: m.evento,
    executarAcao: async (fn: () => Promise<unknown>) => {
      try { return { ok: true, dado: await fn() }; } catch (e) { if (e instanceof ErroRegra) return { ok: false, erro: e.message }; throw e; }
    },
  };
});

import { definirSituacaoEmpresa } from "./acoes";

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue({ id: "fin-1", nome: "Financeiro", papeis: ["FINANCEIRO"] });
  m.tx.empresa.findUnique.mockResolvedValue({ nome: "Acme", ativo: true });
  m.tx.empresa.update.mockResolvedValue({});
});

describe("definirSituacaoEmpresa", () => {
  it("inativa só a situação, na alçada do Financeiro, e registra o evento com o antes", async () => {
    expect(await definirSituacaoEmpresa("emp-1", false)).toEqual({ ok: true, dado: undefined });
    expect(m.papel).toHaveBeenCalledWith(expect.objectContaining({ id: "fin-1" }), "FINANCEIRO");
    expect(m.tx.empresa.update).toHaveBeenCalledWith({ where: { id: "emp-1" }, data: { ativo: false } });
    expect(m.evento).toHaveBeenCalledWith(m.tx, {
      tipo: "EmpresaEditada", agregadoTipo: "Empresa", agregadoId: "emp-1", autorId: "fin-1",
      payload: { nome: "Acme", ativo: false, antes: { ativo: true } },
    });
    expect(m.revalidar).toHaveBeenCalledWith("/empresas");
  });

  it("repetir a mesma situação não grava nada (o estado-alvo é explícito, não inverte)", async () => {
    m.tx.empresa.findUnique.mockResolvedValue({ nome: "Acme", ativo: false });
    expect(await definirSituacaoEmpresa("emp-1", false)).toEqual({ ok: true, dado: undefined });
    expect(m.tx.empresa.update).not.toHaveBeenCalled();
    expect(m.evento).not.toHaveBeenCalled();
  });

  it("reativa com o mesmo caminho", async () => {
    m.tx.empresa.findUnique.mockResolvedValue({ nome: "Acme", ativo: false });
    await definirSituacaoEmpresa("emp-1", true);
    expect(m.tx.empresa.update).toHaveBeenCalledWith({ where: { id: "emp-1" }, data: { ativo: true } });
  });

  it("empresa inexistente e entrada inválida viram erro de negócio, sem gravar", async () => {
    m.tx.empresa.findUnique.mockResolvedValue(null);
    expect(await definirSituacaoEmpresa("emp-x", false)).toEqual({ ok: false, erro: "Empresa não encontrada." });
    expect(await definirSituacaoEmpresa("", false)).toEqual({ ok: false, erro: "Empresa não informada." });
    expect(await definirSituacaoEmpresa("emp-1", "nao" as unknown as boolean)).toEqual({ ok: false, erro: "Situação da empresa inválida." });
    expect(m.tx.empresa.update).not.toHaveBeenCalled();
  });

  it("sem a alçada, nada é lido nem gravado", async () => {
    m.papel.mockImplementationOnce(() => { throw new Error("sem permissão"); });
    await expect(definirSituacaoEmpresa("emp-1", false)).rejects.toThrow("sem permissão");
    expect(m.tx.empresa.findUnique).not.toHaveBeenCalled();
  });
});
