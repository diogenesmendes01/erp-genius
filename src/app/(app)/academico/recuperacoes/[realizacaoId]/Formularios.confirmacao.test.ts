import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Conferir a nota de recuperação (docs/42 L1479; #175): "Oficializar esta versão" não tem volta pela tela (depois
// só muda por correção aprovada). Escolher oficializar só abre o ConfirmarAcao, que repete a versão e a nota e
// exige marcar "Conferi a nota e a evidência"; só a confirmação chama a action. Rejeitar continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/recuperacao-nota", () => ({ decidirNotaRecuperacao: m.decidir, salvarNotaRecuperacao: vi.fn() }));

import { ConferirNota } from "./Formularios";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { FormDataFalso, criarGanchos, elementos, submeter, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const MOTIVO = "Nota e evidência conferidas";
const tela = (podeAprovar = true): ReactNode => m.ganchos!.renderizar(ConferirNota, { notaId: "nota-1", entradaHash: "hash-1", podeAprovar, versao: 3, nota: "7.5" });
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
  m.decidir.mockResolvedValue({ ok: true, dado: { id: "decisao-1" } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("ConferirNota — oficializar", () => {
  it("oficializar não decide; a confirmação repete versão e nota e exige a conferência; só confirmar decide, uma vez", async () => {
    submeter(tela(), { decisao: "aprovar", motivo: MOTIVO });
    await esvaziar();
    expect(m.decidir).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Oficializar a versão 3 da nota?");
    expect(c.props.confirmacao).toBe("oficialização da nota");
    expect(c.props.conferencia).toBe("Conferi a nota e a evidência antes de oficializar.");
    expect(c.props.idempotente).toBe(true);
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("A nota 7.5 (versão 3) vira a nota oficial");
    expect(consequencia).toContain("só muda por fluxo de correção aprovado");
    expect(consequencia).toContain(`Motivo registrado: ${MOTIVO}`);
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.decidir).toHaveBeenCalledTimes(1);
    expect(m.decidir).toHaveBeenCalledWith({ notaId: "nota-1", entradaHash: "hash-1", aprovada: true, motivo: MOTIVO });
    (c.props.aoConcluir as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não decide", async () => {
    submeter(tela(), { decisao: "aprovar", motivo: MOTIVO });
    await esvaziar();
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.decidir).not.toHaveBeenCalled();
  });

  it("erro aparece dentro do diálogo, que continua aberto", async () => {
    submeter(tela(), { decisao: "aprovar", motivo: MOTIVO });
    await esvaziar();
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "Existe versão mais recente da nota." });
    const [c] = confirmacoes(tela());
    // A conferência é exigida pelo próprio diálogo; aqui o apoio clica direto, então ela não entra no caminho.
    expect((await confirmarNoDialogo({ ...c, props: { ...c.props, conferencia: undefined } }, usar)).erro).toBe("Existe versão mais recente da nota.");
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("rejeitar continua direto, sem confirmação", async () => {
    m.decidir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    submeter(tela(), { decisao: "rejeitar", motivo: MOTIVO });
    await esvaziar();
    expect(m.decidir).toHaveBeenCalledWith({ notaId: "nota-1", entradaHash: "hash-1", aprovada: false, motivo: MOTIVO });
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(texto(elementos(tela()).find((n: No) => n.type === "p" && n.props.role === "alert")?.props.children)).toBe(MSG_DECISAO_INCERTA);
  });

  it("sem alçada de aprovação, a opção de oficializar não aparece", () => {
    const opcoes = elementos(tela(false)).filter((n: No) => n.type === "option").map((o: No) => o.props.value);
    expect(opcoes).toEqual(["", "rejeitar"]);
  });
});
