import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L2395): clicar no fundo escuro (ou Escape) com a turma preenchida não descarta o
// formulário em silêncio — pede confirmação. Intocado, fecha como antes. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("./TurmaFormulario", () => ({
  TurmaFormulario: () => "formulario-turma",
  destinoPrepararGrade: (turmaId: string) => `/academico/grades/nova?turmaId=${encodeURIComponent(turmaId)}`,
}));
vi.mock("./ImportarTurmasModal", () => ({ ImportarTurmasModal: () => "importar-turmas" }));

import type { ReactNode } from "react";
import { TurmasPainel } from "./TurmasPainel";
import { TurmaFormulario } from "./TurmaFormulario";
import { clicar, criarGanchos, elementos, temBotao, texto, type No } from "@/test/tela-sem-dom";

beforeEach(() => { m.ganchos = criarGanchos(); });

const tela = () => m.ganchos!.renderizar(TurmasPainel, { turmas: [], modalidades: [], niveis: [], professores: [] });
/** O casco do diálogo é o elemento que recebe o TurmaFormulario como filho (o 1º com `aoFechar`). */
const dialogo = (t: ReactNode): No | undefined => elementos(t).find((n) => typeof n.props.aoFechar === "function");
const formulario = (t: ReactNode): No => elementos(t).find((n) => n.type === TurmaFormulario)!;
const fecharPeloFundo = () => (dialogo(tela())!.props.aoFechar as () => void)();
const confirmacao = (t: ReactNode) => elementos(t).find((n) => n.props.role === "alert" && texto(n.props.children).includes("Descartar a turma não salva?"));

describe("TurmasPainel — o fundo não descarta uma turma preenchida", () => {
  it("formulário intocado: o fundo/Escape fecha como antes", () => {
    clicar(tela(), "Nova turma");
    expect(dialogo(tela())).toBeDefined();
    fecharPeloFundo();
    expect(dialogo(tela())).toBeUndefined();
  });

  it("formulário alterado: pede confirmação; continuar editando mantém tudo aberto", () => {
    clicar(tela(), "Nova turma");
    (formulario(tela()).props.aoMudarAlterado as (v: boolean) => void)(true);
    fecharPeloFundo();
    expect(dialogo(tela())).toBeDefined();
    expect(confirmacao(tela())).toBeDefined();
    clicar(tela(), "Continuar editando");
    expect(confirmacao(tela())).toBeUndefined();
    expect(dialogo(tela())).toBeDefined();
  });

  it("formulário alterado: descartar fecha; ao reabrir, começa sem pendência de descarte", () => {
    clicar(tela(), "Nova turma");
    (formulario(tela()).props.aoMudarAlterado as (v: boolean) => void)(true);
    fecharPeloFundo();
    clicar(tela(), "Descartar alterações");
    expect(dialogo(tela())).toBeUndefined();
    clicar(tela(), "Nova turma");
    fecharPeloFundo();
    expect(dialogo(tela())).toBeUndefined();
    expect(temBotao(tela(), "Descartar alterações")).toBe(false);
  });
});
