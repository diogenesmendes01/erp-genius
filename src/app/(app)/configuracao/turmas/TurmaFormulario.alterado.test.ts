import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L2395): o formulário de turma avisa o diálogo quando há algo preenchido e não
// salvo (para o fundo/Escape pedirem confirmação). Efeitos rodam a cada render aqui (o aviso é por efeito).
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
    useEffect: ((f: () => void) => { f(); }) as unknown as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/turmas/acoes", () => ({ criarTurma: vi.fn(), editarTurma: vi.fn() }));

import { TurmaFormulario, type TurmaParaEditar } from "./TurmaFormulario";
import { criarGanchos, elementos } from "@/test/tela-sem-dom";

beforeEach(() => { m.ganchos = criarGanchos(); });

const turma: TurmaParaEditar = {
  id: "turma-1", nome: "Turma A", modalidadeId: "", nivelId: "", professorId: "", diasSemana: [1], horarioInicio: "19:00",
  horarioFim: "20:00", dataInicio: "", dataFim: "", capacidade: 12, rolling: false,
};

describe("TurmaFormulario — avisa se há alteração não salva", () => {
  it("aberto como veio: não alterado; ao digitar: alterado; voltando ao original: não alterado", () => {
    const aoMudarAlterado = vi.fn();
    const tela = () => m.ganchos!.renderizar(TurmaFormulario, { turma, modalidades: [], niveis: [], professores: [], onClose: vi.fn(), aoMudarAlterado });
    tela();
    expect(aoMudarAlterado).toHaveBeenLastCalledWith(false);
    const nome = () => elementos(tela()).find((n) => n.type === "input" && n.props.id === "turma-nome")!;
    (nome().props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Turma B" } });
    tela();
    expect(aoMudarAlterado).toHaveBeenLastCalledWith(true);
    (nome().props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Turma A" } });
    tela();
    expect(aoMudarAlterado).toHaveBeenLastCalledWith(false);
  });
});
