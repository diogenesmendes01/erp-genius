import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L1835): trocar a data/hora depois de preencher a chamada não apaga presenças nem
// observações. A lista nova é mesclada com a preenchida; se alguém com dados preenchidos sair da lista, a troca
// espera a confirmação (dizendo quem) antes de descartar. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, listar: vi.fn(), salvar: vi.fn() }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
    useTransition: (() => [false, (f: () => unknown) => { void f(); }]) as unknown as typeof real.useTransition,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/diario/chamada", () => ({ listarAlunosParaChamada: m.listar }));
vi.mock("@/server/diario/acoes", () => ({ salvarAulaDiario: m.salvar }));

import type { ReactNode } from "react";
import { DiarioAulas, mesclarChamada } from "./DiarioAulas";
import { CampoTexto } from "@/components/CampoTexto";
import { clicar, criarGanchos, elementos, temBotao, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

const tela = () => m.ganchos!.renderizar(DiarioAulas, { aulas: [], turmas: [{ id: "t1", label: "Turma 1" }] as never });
const tick = () => new Promise((r) => setTimeout(r, 0));
type Mudanca = (e: { target: { value: string } }) => void;
const selects = (t: ReactNode) => elementos(t).filter((n) => n.type === "select");
const observacoes = (t: ReactNode) => elementos(t).filter((n) => n.type === CampoTexto).slice(1); // o 1º é o conteúdo da aula
const data = (t: ReactNode) => elementos(t).find((n) => n.type === "input" && n.props.type === "datetime-local")!;
const alunos = (...nomes: string[]) => ({ ok: true, dado: { exigeConferencia: false, alunos: nomes.map((n) => ({ alunoId: n.toLowerCase(), nomeAluno: n })) } });
const chamada = (t: ReactNode) => selects(t).slice(1).map((s, i) => `${s.props.value}|${observacoes(t)[i]?.props.value ?? ""}`);

async function prepararChamada() {
  clicar(tela(), "Registrar aula");
  m.listar.mockResolvedValueOnce(alunos("Ana", "Bia"));
  (selects(tela())[0].props.onChange as Mudanca)({ target: { value: "t1" } });
  await tick();
  (selects(tela())[1].props.onChange as Mudanca)({ target: { value: "sim" } }); // Ana presente
  (observacoes(tela())[1].props.onChange as Mudanca)({ target: { value: "Participou bem." } }); // Bia
  expect(chamada(tela())).toEqual(["sim|", "|Participou bem."]);
}

describe("DiarioAulas — trocar a data não apaga a chamada", () => {
  it("quem continua na lista mantém presença e observação; quem entra começa vazio", async () => {
    await prepararChamada();
    m.listar.mockResolvedValueOnce(alunos("Ana", "Bia", "Cid"));
    (data(tela()).props.onChange as Mudanca)({ target: { value: "2026-10-01T10:00" } });
    await tick();
    expect(chamada(tela())).toEqual(["sim|", "|Participou bem.", "|"]);
  });

  it("se alguém com dados preenchidos sair, avisa quem e espera: manter a data anterior não perde nada", async () => {
    await prepararChamada();
    const anterior = data(tela()).props.value;
    m.listar.mockResolvedValueOnce(alunos("Ana", "Cid"));
    (data(tela()).props.onChange as Mudanca)({ target: { value: "2026-10-01T10:00" } });
    await tick();
    const aviso = elementos(tela()).find((n) => n.props.role === "alert" && texto(n.props.children).includes("Na nova data"))!;
    expect(texto(aviso.props.children)).toContain("Bia não está na chamada");
    expect(chamada(tela())).toEqual(["sim|", "|Participou bem."]); // nada aplicado ainda
    clicar(tela(), "Manter a data anterior");
    expect(data(tela()).props.value).toBe(anterior);
    expect(chamada(tela())).toEqual(["sim|", "|Participou bem."]);
    expect(temBotao(tela(), "Descartar e usar a nova data")).toBe(false);
  });

  it("confirmar a nova data descarta só quem saiu", async () => {
    await prepararChamada();
    m.listar.mockResolvedValueOnce(alunos("Ana", "Cid"));
    (data(tela()).props.onChange as Mudanca)({ target: { value: "2026-10-01T10:00" } });
    await tick();
    clicar(tela(), "Descartar e usar a nova data");
    expect(chamada(tela())).toEqual(["sim|", "|"]);
    expect(data(tela()).props.value).toBe("2026-10-01T10:00");
  });

  it("mesclarChamada: mantém por aluno, lista descartados só com algo preenchido", () => {
    const r = (alunoId: string, nomeAluno: string, presente: boolean | null, observacao: string) => ({ alunoId, nomeAluno, presente, observacao, podeEditar: true });
    const m2 = mesclarChamada([r("a", "Ana", true, ""), r("b", "Bia", null, " "), r("c", "Cid", false, "")], [{ alunoId: "a", nomeAluno: "Ana" }, { alunoId: "d", nomeAluno: "Davi" }]);
    expect(m2.registros.map((x) => [x.alunoId, x.presente, x.observacao])).toEqual([["a", true, ""], ["d", null, ""]]);
    expect(m2.descartados).toEqual(["Cid"]);
  });
});
