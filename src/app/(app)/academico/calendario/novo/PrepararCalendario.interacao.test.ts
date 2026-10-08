import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L1059): preparar o calendário protege o que foi digitado com o aviso de saída —
// ligado só com alteração não salva, desligado depois de salvar. O gancho é observado pelo valor de `sujo`
// a cada render (o comportamento do beforeunload em si está em src/lib/aviso-ao-sair.test.ts).
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  aviso: vi.fn(), preparar: vi.fn(), push: vi.fn(),
}));
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, refresh: vi.fn() }) }));
vi.mock("@/server/agenda/calendario", () => ({ prepararCalendarioEscolar: m.preparar }));
vi.mock("@/lib/aviso-ao-sair", () => ({ useAvisoAoSair: m.aviso }));

import { PrepararCalendario } from "./PrepararCalendario";
import { CampoTexto } from "@/components/CampoTexto";
import { clicar, criarGanchos, elementos, formularios } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

type Periodo = Parameters<typeof PrepararCalendario>[0]["periodosIniciais"][number];
const periodos = (): Periodo[] => [{ id: "p1", nome: "Carnaval", tipo: "FERIADO", inicio: "2027-02-08", fim: "2027-02-09" }];
const tela = (iniciais = periodos()) => m.ganchos!.renderizar(PrepararCalendario, { periodosIniciais: iniciais, versaoAnterior: 3, fusoConferido: "America/Sao_Paulo" });
const sujo = () => m.aviso.mock.calls.at(-1)?.[0];

describe("PrepararCalendario — aviso ao sair", () => {
  it("intocado não avisa, nem quando o refresh traz outro array com o mesmo conteúdo", () => {
    tela();
    expect(sujo()).toBe(false);
    tela(periodos());
    expect(sujo()).toBe(false);
  });

  it("motivo digitado ou período alterado, incluído ou removido: avisa", () => {
    (elementos(tela()).find((n) => n.type === CampoTexto)!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Inclui recesso." } });
    tela();
    expect(sujo()).toBe(true);
    m.ganchos!.reiniciar();
    clicar(tela(), "Adicionar período");
    tela();
    expect(sujo()).toBe(true);
    m.ganchos!.reiniciar();
    clicar(tela(), "Remover da proposta");
    tela();
    expect(sujo()).toBe(true);
  });

  it("depois de salvar, desliga o aviso antes de navegar", async () => {
    clicar(tela(), "Adicionar período");
    tela();
    expect(sujo()).toBe(true);
    m.preparar.mockResolvedValueOnce({ ok: true, dado: { id: "calendario-4" } });
    (formularios(tela())[0].props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault() {} });
    await new Promise((r) => setTimeout(r, 0));
    tela();
    expect(sujo()).toBe(false);
    expect(m.push).toHaveBeenCalledWith("/academico/calendario/calendario-4");
  });

  it("falha ao salvar mantém o aviso (o digitado não foi salvo)", async () => {
    clicar(tela(), "Adicionar período");
    m.preparar.mockResolvedValueOnce({ ok: false, erro: "Conflito de versão." });
    (formularios(tela())[0].props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault() {} });
    await new Promise((r) => setTimeout(r, 0));
    tela();
    expect(sujo()).toBe(true);
  });
});
