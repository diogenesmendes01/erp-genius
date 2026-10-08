import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Emitir cobrança de fechamento (docs/42 L906): o botão só abre o ConfirmarAcao, que exige marcar
// "Confirmo a emissão de {valor} para este período"; só a confirmação emite.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  emitir: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/matricula/fechamento-horas-emissao", () => ({ emitirFechamentoHoras: m.emitir }));

import { EmitirFechamento } from "./EmitirFechamento";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { formatarMoeda } from "@/lib/dinheiro";
import { clicar, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const props = { alunoId: "aluno-1", matriculaId: "mat-1", decisaoId: "dec-1", valor: "1250.00", moeda: "USD" };
const tela = (): ReactNode => m.ganchos!.renderizar(EmitirFechamento, props);
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
const total = formatarMoeda("1250.00", "USD");

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.emitir.mockResolvedValue({ ok: true, dado: { id: "cob-1" } });
});

describe("EmitirFechamento — passa pela confirmação", () => {
  it("clicar não emite; a confirmação pede a conferência do valor; só confirmar emite", async () => {
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    clicar(tela(), "Emitir cobrança aprovada");
    expect(m.emitir).not.toHaveBeenCalled();
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c.props.titulo).toBe(`Emitir a cobrança de ${total}?`);
    expect(c.props.conferencia).toBe(`Confirmo a emissão de ${total} para este período.`);
    expect(texto(c.props.children)).toContain("Uma cobrança real de");
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.emitir).toHaveBeenCalledWith({ alunoId: "aluno-1", matriculaId: "mat-1", decisaoId: "dec-1" });
  });

  it("concluir fecha a confirmação e anuncia a emissão (sem afirmar pagamento)", () => {
    clicar(tela(), "Emitir cobrança aprovada");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoConcluir as () => void)();
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao)[0].props.sucesso).toBe("Cobrança emitida. Consulte o registro abaixo; isso não confirma pagamento.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não emite", () => {
    clicar(tela(), "Emitir cobrança aprovada");
    (doTipo(tela(), ConfirmarAcao)[0].props.aoCancelar as () => void)();
    expect(doTipo(tela(), ConfirmarAcao)).toHaveLength(0);
    expect(m.emitir).not.toHaveBeenCalled();
  });
});
