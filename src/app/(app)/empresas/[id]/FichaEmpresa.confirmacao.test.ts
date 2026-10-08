import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Pagar e cancelar fatura B2B (docs/42 L2281): os dois botões da linha só abrem o ConfirmarAcao, que
// repete fatura, competência, cobranças e total; só a confirmação chama a action.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  pagar: vi.fn(), cancelar: vi.fn(), salvar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/empresas/acoes", () => ({ pagarFaturaB2B: m.pagar, cancelarFaturaB2B: m.cancelar, salvarEmpresa: m.salvar }));

import { FichaEmpresa } from "./FichaEmpresa";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const props = {
  empresa: {
    id: "emp-1", codigo: "EMP-1", nome: "Acme", paisId: null, documento: null, contatoNome: null, contatoEmail: null,
    contatoTelefone: null, diaVencimento: 10, observacoes: null, ativo: true,
  },
  colaboradores: [],
  faturas: [{ id: "fat-1", codigo: "FAT-0031", competencia: "2026-09", moeda: "BRL", valorTotal: 8400, status: "FECHADA", vencimento: "2026-10-10T00:00:00.000Z", pagoEm: null, cobrancas: 14 }],
  produtos: [], competencias: [], podePagar: true,
};
const tela = (): ReactNode => m.ganchos!.renderizar(FichaEmpresa, props);
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
const sucessoDasFaturas = (t: ReactNode) => doTipo(t, FeedbackAcao)[0].props.sucesso;

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.pagar.mockResolvedValue({ ok: true, dado: { baixadas: 14 } });
  m.cancelar.mockResolvedValue({ ok: true });
});

describe("FichaEmpresa — pagar fatura passa pela confirmação", () => {
  it("clicar não paga; a confirmação diz quantas cobranças e quanto; só confirmar paga", async () => {
    clicar(tela(), "Registrar pagamento");
    expect(m.pagar).not.toHaveBeenCalled();
    const confirmacoes = doTipo(tela(), ConfirmarAcao);
    expect(confirmacoes).toHaveLength(1);
    const [c] = confirmacoes;
    expect(c.props.titulo).toBe("Registrar o pagamento da fatura FAT-0031?");
    expect(c.props.confirmacao).toBe("pagamento da fatura");
    const resumo = (c.props.children as No[])[0];
    const consequencia = (texto((resumo.type as (p: unknown) => ReactNode)(resumo.props)) + texto((c.props.children as No[])[1])).replace(/\s+/g, " ");
    expect(consequencia).toContain("FAT-0031");
    expect(consequencia).toContain("14 cobranças");
    expect(consequencia).toContain("R$");
    expect(consequencia).toContain("As 14 cobranças da fatura são baixadas em lote");
    expect(consequencia).toContain("Não há desfazer pela tela.");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.pagar).toHaveBeenCalledWith("fat-1");
    expect(m.cancelar).not.toHaveBeenCalled();
    (c.props.aoConcluir as (d: unknown) => void)({ baixadas: 14 });
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(sucessoDasFaturas(t)).toBe("Fatura paga — 14 cobranças baixadas em lote.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("FichaEmpresa — cancelar fatura passa pela confirmação", () => {
  it("o botão diz o que cancela; clicar não cancela; só confirmar cancela", async () => {
    clicar(tela(), "Cancelar fatura");
    expect(m.cancelar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Cancelar a fatura FAT-0031?");
    expect(c.props.confirmacao).toBe("cancelamento da fatura");
    expect(texto((c.props.children as No[])[1]).replace(/\s+/g, " ")).toContain("as 14 cobranças voltam a ficar soltas");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.cancelar).toHaveBeenCalledWith("fat-1");
    expect(m.pagar).not.toHaveBeenCalled();
  });

  it("voltar não cancela", () => {
    clicar(tela(), "Cancelar fatura");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.cancelar).not.toHaveBeenCalled();
  });
});
