import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L1081): o bloco "Guardar esta revisão" fica sempre montado — com ajustes não
// conferidos o botão fica desabilitado e diz por quê, em vez de sumir — e nem ele nem o editor têm key de
// estado/versão: uma nova conferência ou um refresh não apaga o motivo nem os ajustes digitados.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, prever: vi.fn() }));
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/agenda/replanejamento-consulta", () => ({ preverReplanejamentoCalendario: m.prever }));
vi.mock("@/server/agenda/replanejamento-rascunho", () => ({ registrarRascunhoReplanejamento: vi.fn() }));

import type { ReactNode } from "react";
import { EditorRevisao } from "./EditorRevisao";
import { SalvarRevisao } from "./SalvarRevisao";
import { clicar, criarGanchos, elementos, identidadeNoReact, type No } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

type Inicial = Parameters<typeof EditorRevisao>[0]["inicial"];
const revisao = (estadoHash: string, versaoRascunho: number, ajustes: { encontroId: string; data: string; horario: string; motivo: string }[]) => ({
  calendarioId: "calendario", estadoHash, versaoRascunho, ajustes,
  pendencias: [], recursos: { internos: [], externos: [], indisponibilidades: [], semDocenteApto: [] }, particulares: [],
  revisoes: [{ turmaId: "turma", codigo: "T-01", fusoOrigem: "America/Sao_Paulo", pendencias: [], previsao: {
    previsaoTermino: null, preservados: [],
    propostas: [{ encontroId: "encontro", inicioAnterior: "2026-10-01T02:30:00.000Z", fimAnterior: "2026-10-01T03:30:00.000Z", inicioProposto: "2026-10-01T02:30:00.000Z", fimProposto: "2026-10-01T03:30:00.000Z", alterado: false }],
  } }],
}) as unknown as Inicial;
const inicial = revisao("a".repeat(64), 2, [{ encontroId: "encontro", data: "2026-10-01", horario: "23:30", motivo: "Ajuste de teste" }]);
const tela = (r: Inicial = inicial) => m.ganchos!.renderizar(EditorRevisao, { inicial: r, preferenciaFusoExibicao: null });
const salvar = (t: ReactNode): No => elementos(t).find((n) => n.type === SalvarRevisao)!;
const mudarData = (t: ReactNode, valor: string) => (elementos(t).find((n) => n.type === "input" && n.props.type === "date")!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });

describe("EditorRevisao — guardar fica montado e nada remonta", () => {
  it("sem alteração, guardar está liberado; com ajuste não conferido, continua na tela, desatualizado, e com a mesma identidade", () => {
    const antes = identidadeNoReact(tela(), SalvarRevisao);
    expect(antes).not.toBeNull();
    expect(antes!.key).toBeNull();
    expect(salvar(tela()).props.desatualizado).toBe(false);
    mudarData(tela(), "2026-10-02");
    expect(salvar(tela()).props.desatualizado).toBe(true);
    expect(identidadeNoReact(tela(), SalvarRevisao)).toEqual(antes);
  });

  it("conferir de novo libera o guardar sem remontar; a revisão conferida é a que vai para o registro", async () => {
    const antes = identidadeNoReact(tela(), SalvarRevisao);
    mudarData(tela(), "2026-10-02");
    const conferida = revisao("b".repeat(64), 2, [{ encontroId: "encontro", data: "2026-10-02", horario: "23:30", motivo: "Ajuste de teste" }]);
    m.prever.mockResolvedValueOnce({ ok: true, dado: conferida });
    await (elementos(tela()).find((n) => n.type === "form")!.props.onSubmit as (e: { preventDefault(): void }) => Promise<void> | void)({ preventDefault() {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(salvar(tela()).props.desatualizado).toBe(false);
    expect(salvar(tela()).props.estadoHash).toBe("b".repeat(64));
    expect(identidadeNoReact(tela(), SalvarRevisao)).toEqual(antes);
  });

  it("refresh com outro estado no servidor: a prévia nova aparece e os ajustes digitados ficam (para conferir de novo)", () => {
    mudarData(tela(), "2026-10-02");
    const depois = tela(revisao("c".repeat(64), 3, [{ encontroId: "encontro", data: "2026-10-01", horario: "23:30", motivo: "Ajuste de teste" }]));
    expect(elementos(depois).find((n) => n.type === "input" && n.props.type === "date")!.props.value).toBe("2026-10-02");
    expect(salvar(depois).props.estadoHash).toBe("c".repeat(64));
    expect(salvar(depois).props.desatualizado).toBe(true);
  });

  it("remover um ajuste também deixa o guardar desatualizado (sem sumir)", () => {
    clicar(tela(), "Remover ajuste 1");
    expect(salvar(tela()).props.desatualizado).toBe(true);
  });
});
