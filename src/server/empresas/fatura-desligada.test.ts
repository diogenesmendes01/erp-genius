import { beforeEach, describe, expect, it, vi } from "vitest";

// D9 (decisão do dono, 19/10/2026): a escola não usa a cobrança de empresas (fatura B2B, docs/42 L2282). Com a
// chave COBRANCA_B2B_ATIVA desligada, fechar, pagar e cancelar fatura recusam com mensagem clara, depois da
// sessão e da alçada e antes de qualquer leitura ou escrita. Nada é apagado: religar a chave devolve o fluxo.

const m = vi.hoisted(() => ({
  ativa: false,
  sessao: vi.fn(), papel: vi.fn(), evento: vi.fn(), revalidar: vi.fn(), transacao: vi.fn(),
  empresa: { findUnique: vi.fn() },
}));
vi.mock("@/lib/funcionalidades", async (original) => ({
  ...(await original<typeof import("@/lib/funcionalidades")>()),
  get COBRANCA_B2B_ATIVA() { return m.ativa; },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transacao, empresa: m.empresa } }));
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

import { cancelarFaturaB2B, fecharFaturaB2B, pagarFaturaB2B } from "./acoes";
import { MSG_COBRANCA_B2B_DESLIGADA } from "@/lib/funcionalidades";

beforeEach(() => {
  vi.clearAllMocks();
  m.ativa = false;
  m.sessao.mockResolvedValue({ id: "fin-1", nome: "Financeiro", papeis: ["FINANCEIRO"] });
  m.empresa.findUnique.mockResolvedValue(null);
  m.transacao.mockRejectedValue(new Error("não deveria abrir transação"));
});

const acoes = {
  fechar: () => fecharFaturaB2B({ empresaId: "emp-1", competencia: "2026-09" }),
  pagar: () => pagarFaturaB2B("fat-1"),
  cancelar: () => cancelarFaturaB2B("fat-1"),
};

describe("fatura B2B com a cobrança de empresas desligada (D9)", () => {
  it("a mensagem diz o que está desligado e que as faturas antigas continuam para consulta", () => {
    expect(MSG_COBRANCA_B2B_DESLIGADA).toContain("cobrança de empresas");
    expect(MSG_COBRANCA_B2B_DESLIGADA).toContain("desligada");
  });

  for (const [nome, chamar] of Object.entries(acoes)) {
    it(`${nome} recusa com a mensagem clara, sem ler nem gravar nada`, async () => {
      expect(await chamar()).toEqual({ ok: false, erro: MSG_COBRANCA_B2B_DESLIGADA });
      expect(m.sessao).toHaveBeenCalledTimes(1); // sessão e alçada continuam antes da recusa
      expect(m.transacao).not.toHaveBeenCalled();
      expect(m.empresa.findUnique).not.toHaveBeenCalled();
      expect(m.evento).not.toHaveBeenCalled();
      expect(m.revalidar).not.toHaveBeenCalled();
    });
  }

  it("religada, a ação volta a seguir o fluxo (aqui, até a busca da empresa)", async () => {
    m.ativa = true;
    expect(await acoes.fechar()).toEqual({ ok: false, erro: "Empresa não encontrada." });
    expect(m.empresa.findUnique).toHaveBeenCalledTimes(1);
  });
});
