import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// D11: o dia X da previsão de pagamento é configurável na aba de política de comissão. Fora de 1 a 28, a tela
// recusa sem chamar o servidor; dentro, envia o dia (estado-alvo) e atualiza a página.

const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  salvar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => m.ganchos!.useRef(i)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/financeiro/acoes", () => ({ salvarDiaPrevisaoComissao: m.salvar }));

import { DiaPrevisaoComissao, MSG_DIA_INVALIDO } from "./DiaPrevisaoComissao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicarBotao, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const tela = (): ReactNode => m.ganchos!.renderizar(DiaPrevisaoComissao, { dia: 10 });
const campo = (t: ReactNode): No => elementos(t).find((n) => n.type === "input")!;
const feedback = (t: ReactNode): No => elementos(t).find((n) => n.type === FeedbackAcao)!;

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.salvar.mockResolvedValue({ ok: true, dado: { dia: 15 } });
});

describe("DiaPrevisaoComissao (D11)", () => {
  it("mostra o dia atual e a regra", () => {
    const t = tela();
    expect(campo(t).props.value).toBe("10");
    expect(campo(t).props.min).toBe(1);
    expect(campo(t).props.max).toBe(28);
    expect(texto(t)).toContain("dia do mês seguinte à competência");
  });

  it("salva o dia escolhido e atualiza a página", async () => {
    (campo(tela()).props.onChange as (e: unknown) => void)({ target: { value: "15" } });
    await clicarBotao(tela(), "Salvar dia");
    expect(m.salvar).toHaveBeenCalledWith({ dia: 15 });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(feedback(tela()).props.sucesso).toBe("Previsão de pagamento: dia 15 do mês seguinte à competência.");
  });

  it("fora de 1 a 28 (ou não inteiro), recusa sem chamar o servidor", async () => {
    for (const v of ["0", "29", "10.5", ""]) {
      (campo(tela()).props.onChange as (e: unknown) => void)({ target: { value: v } });
      await clicarBotao(tela(), "Salvar dia");
      expect(feedback(tela()).props.erro).toBe(MSG_DIA_INVALIDO);
    }
    expect(m.salvar).not.toHaveBeenCalled();
  });

  it("erro do servidor aparece na tela", async () => {
    m.salvar.mockResolvedValue({ ok: false, erro: "Você não tem a permissão específica para esta operação." });
    await clicarBotao(tela(), "Salvar dia");
    expect(feedback(tela()).props.erro).toBe("Você não tem a permissão específica para esta operação.");
    expect(m.refresh).not.toHaveBeenCalled();
  });
});
