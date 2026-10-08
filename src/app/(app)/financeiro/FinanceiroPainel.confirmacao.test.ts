import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fechar o mês de comissões (docs/42 L2016): "Fechar mês e marcar pagas" só abre o ConfirmarAcao, que
// repete quantas comissões aprovadas e o total por moeda; só a confirmação chama fecharMesComissoes.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  fechar: vi.fn(), salvarConfig: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/financeiro/acoes", () => ({
  fecharMesComissoes: m.fechar, salvarConfigFinanceiro: m.salvarConfig, salvarTaxasCambio: vi.fn(), atualizarCotacoesAutomatico: vi.fn(),
}));
vi.mock("@/server/ajustes/acoes", () => ({ decidirAprovacao: vi.fn() }));

import { Comissoes, ComissoesAba } from "./FinanceiroPainel";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const props = {
  comissoes: [], podePagar: true, fechamentoAutomatico: false,
  aPagar: [{ moeda: "BRL", valor: 5000, quantidade: 3 }, { moeda: "USD", valor: 120, quantidade: 1 }],
};
const tela = (): ReactNode => m.ganchos!.renderizar(ComissoesAba, props);
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.fechar.mockResolvedValue({ ok: true, dado: { pagas: 4 } });
  m.salvarConfig.mockResolvedValue({ ok: true });
});

describe("ComissoesAba \u2014 fechar o mês passa pela confirmação", () => {
  it("o botão da lista chama onFechar", () => {
    const [lista] = doTipo(tela(), Comissoes);
    expect(lista.props.podePagar).toBe(true);
    expect(typeof lista.props.onFechar).toBe("function");
  });

  it("clicar não fecha o mês; a confirmação repete quantidade e total; só confirmar fecha", async () => {
    const [lista] = doTipo(tela(), Comissoes);
    (lista.props.onFechar as () => void)();
    expect(m.fechar).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe("Fechar o mês e marcar as comissões aprovadas como pagas?");
    expect(c.props.confirmacao).toBe("fechamento do mês");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("4 comissões aprovadas passam a pagas, total R$");
    expect(consequencia).toContain("US$");
    expect(consequencia).toContain("Não há desfazer pela tela.");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.fechar).toHaveBeenCalledTimes(1);
  });

  it("concluir fecha a confirmação, anuncia quantas foram pagas e atualiza", () => {
    (doTipo(tela(), Comissoes)[0].props.onFechar as () => void)();
    (doTipo(tela(), ConfirmarAcao)[0].props.aoConcluir as (d: unknown) => void)({ pagas: 4 });
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao)[0].props.sucesso).toBe("Mês fechado: 4 comissões marcadas como pagas.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não fecha nada", () => {
    (doTipo(tela(), Comissoes)[0].props.onFechar as () => void)();
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.fechar).not.toHaveBeenCalled();
  });

  it("o fechamento automático (toggle) continua direto: não é a ação irreversível", async () => {
    await (doTipo(tela(), Comissoes)[0].props.onToggleAutomatico as (l: boolean) => Promise<void>)(true);
    expect(m.salvarConfig).toHaveBeenCalledWith({ fechamentoComissaoAutomatico: true });
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
  });
});
