import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Faltou" no check-in da experimental (docs/42 L2693; fatia B, issue #169): grava no-show e dispara a
// recuperação de no-show, sem correção pela tela. O botão só abre o ConfirmarAcao com o nome do lead e a
// data da aula; só a confirmação chama a action. "Compareceu" continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  checkin: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
    useId: (() => g().useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/comercial/acoes", () => ({ checkinExperimental: m.checkin }));

import { HomeProfessor } from "./HomeProfessor";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const experimentais = [
  { id: "lead-ana", nome: "Ana Prado", data: "2026-10-13T15:00:00.000Z" },
  { id: "lead-bia", nome: "Bia Lopes", data: "2026-10-13T17:00:00.000Z" },
];
const tela = (): ReactNode => m.ganchos!.renderizar(HomeProfessor, { nome: "Professor Um", turmas: [], experimentais, proximaExperimental: null, preferenciaFusoExibicao: null });
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
/** Os botões "Faltou"/"Compareceu" da linha `i` (na ordem da lista). */
const daLinha = (t: ReactNode, rotulo: string, i: number): No =>
  elementos(t).filter((n: No) => n.type === "button" && texto(n.props.children).trim() === rotulo)[i];

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.checkin.mockResolvedValue({ ok: true });
});

describe("HomeProfessor — \"Faltou\" passa pela confirmação", () => {
  it("clicar não registra; a confirmação nomeia o lead, a aula e a recuperação; só confirmar registra, uma vez", async () => {
    (daLinha(tela(), "Faltou", 1).props.onClick as () => void)();
    expect(m.checkin).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Marcar Bia Lopes como faltou?");
    expect(c.props.confirmacao).toBe("falta");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("13/10/2026, 17:00");
    expect(consequencia).toContain("recuperação de no-show");
    expect(consequencia).toContain("Não há desfazer pela tela");
    expect(m.checkin).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.checkin).toHaveBeenCalledTimes(1);
    expect(m.checkin).toHaveBeenCalledWith("lead-bia", false);
    (c.props.aoConcluir as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("enquanto a confirmação está aberta, os botões das linhas ficam travados", () => {
    (daLinha(tela(), "Faltou", 0).props.onClick as () => void)();
    const t = tela();
    expect(daLinha(t, "Faltou", 1).props.disabled).toBe(true);
    expect(daLinha(t, "Compareceu", 0).props.disabled).toBe(true);
  });

  it("voltar não registra a falta", () => {
    (daLinha(tela(), "Faltou", 0).props.onClick as () => void)();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.checkin).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    (daLinha(tela(), "Faltou", 0).props.onClick as () => void)();
    m.checkin.mockResolvedValueOnce({ ok: false, erro: "Não há experimental agendada para check-in neste lead." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "Não há experimental agendada para check-in neste lead.", confirmarDisponivel: true });
    m.checkin.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO); // check-in idempotente por natureza (#166, 5º lote)
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("\"Compareceu\" continua direto, sem confirmação", async () => {
    await (daLinha(tela(), "Compareceu", 0).props.onClick as () => Promise<void>)();
    expect(m.checkin).toHaveBeenCalledWith("lead-ana", true);
    expect(confirmacoes(tela())).toHaveLength(0);
  });
});
