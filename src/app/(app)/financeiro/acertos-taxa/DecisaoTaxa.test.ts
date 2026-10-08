import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ganchos sem DOM (src/test/tela-sem-dom.ts): estado e refs vivem entre renders, como no React. O clique
// concorrente usa os botões do MESMO render (antes de o ocupado chegar à tela), como um duplo clique real.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), aplicar: vi.fn(), invalidar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-acoes", () => ({ decidirAcertoTaxaAditivo: m.decidir, aplicarAcertoTaxaAditivo: m.aplicar, invalidarAcertoTaxaAditivo: m.invalidar }));

import type { ReactNode } from "react";
import { DecisaoTaxa } from "./DecisaoTaxa";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { criarGanchos, elementos } from "@/test/tela-sem-dom";

type Props = Parameters<typeof DecisaoTaxa>[0];
let props: Props;
const tela = () => m.ganchos!.renderizar(DecisaoTaxa, props);
const buttons = (t: ReactNode) => elementos(t).filter((n) => n.type === "button").map((n) => n.props as { onClick: () => Promise<void>; children: string });
const camposDeMotivo = (t: ReactNode) => elementos(t).filter((n) => (n.type === "textarea" || n.type === CampoTexto) && typeof n.props.onChange === "function");

beforeEach(() => {
  vi.resetAllMocks(); m.ganchos = criarGanchos();
  let chave = 0; vi.stubGlobal("crypto", { randomUUID: () => `tentativa-${++chave}` });
});
afterEach(() => vi.unstubAllGlobals());

/** Monta a tela, digita o motivo (quando há campo) e devolve os botões do render seguinte. */
function mount(podeDecidir = true, podeAplicar = false, motivo = "Evidência conferida", podeInvalidar = false) {
  props = { propostaId: "p", podeDecidir, podeAplicar, podeInvalidar };
  const campo = camposDeMotivo(tela())[0];
  if (campo && motivo) (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: motivo } });
  return { botoes: () => buttons(tela()) };
}

it("não oferece operações sem permissão", () => { expect(mount(false, false).botoes()).toHaveLength(0); });
it("não envia decisão sem motivo suficiente", async () => { const c = mount(true, false, ""); await c.botoes()[0].onClick(); expect(m.decidir).not.toHaveBeenCalled(); });
it("impede clique concorrente e mantém chave depois de erro", async () => {
  const c = mount(); let resolver!: (v: unknown) => void;
  m.decidir.mockReturnValueOnce(new Promise(r => { resolver = r; }));
  const mesmoRender = c.botoes();
  const primeira = mesmoRender[0].onClick(); await mesmoRender[1].onClick(); expect(m.decidir).toHaveBeenCalledTimes(1);
  resolver({ ok: false, erro: "Revisão necessária" }); await primeira;
  m.decidir.mockResolvedValueOnce({ ok: true }); await c.botoes()[0].onClick();
  expect(m.decidir.mock.calls[0][0]).toEqual(m.decidir.mock.calls[1][0]); expect(m.refresh).toHaveBeenCalledTimes(1);
});
it("uma decisão diferente recebe outra chave", async () => {
  const c = mount(); m.decidir.mockResolvedValue({ ok: false, erro: "Falha" });
  await c.botoes()[0].onClick(); await c.botoes()[1].onClick();
  expect(m.decidir.mock.calls[0][0].chaveIdempotencia).not.toEqual(m.decidir.mock.calls[1][0].chaveIdempotencia);
  expect(m.decidir.mock.calls[1][0].aprovada).toBe(false);
});
it("aplicação incerta permite conferir a mesma tentativa", async () => {
  const c = mount(false, true); m.aplicar.mockRejectedValueOnce(new Error("Rede")); await c.botoes()[0].onClick();
  expect(anuncios(tela()).alerta).toEqual([MSG_RESULTADO_INCERTO]); expect(m.refresh).not.toHaveBeenCalled();
  m.aplicar.mockResolvedValueOnce({ ok: true }); await c.botoes()[0].onClick();
  expect(m.aplicar.mock.calls[0][0]).toEqual(m.aplicar.mock.calls[1][0]); expect(m.refresh).toHaveBeenCalledTimes(1);
});
it("invalidação usa a action, preserva chave no replay e atualiza a tela", async () => {
  const c = mount(false, false, "Comissão mudou depois da aprovação", true);
  m.invalidar.mockResolvedValueOnce({ ok: false, erro: "Revisão necessária" });
  await c.botoes()[0].onClick();
  m.invalidar.mockResolvedValueOnce({ ok: true });
  await c.botoes()[0].onClick();
  expect(m.invalidar.mock.calls[0][0]).toEqual(m.invalidar.mock.calls[1][0]);
  expect(m.invalidar.mock.calls[0][0]).toMatchObject({ propostaId: "p", motivo: "Comissão mudou depois da aprovação", evidencia: { conferencia: "Comissão mudou depois da aprovação" } });
  expect(anuncios(tela())).toEqual({ alerta: [], status: ["Acerto invalidado; prepare uma nova proposta."] });
  expect(m.refresh).toHaveBeenCalledTimes(1);
});
it("invalidação exige capacidade e bloqueia clique concorrente", async () => {
  expect(mount(false, false, "Comissão mudou depois da aprovação", false).botoes()).toHaveLength(0);
  m.ganchos = criarGanchos();
  const c = mount(false, false, "Comissão mudou depois da aprovação", true); let resolver!: (r: { ok: true }) => void;
  m.invalidar.mockReturnValueOnce(new Promise(r => { resolver = r; }));
  const mesmoRender = c.botoes();
  const primeira = mesmoRender[0].onClick(); await mesmoRender[0].onClick();
  expect(m.invalidar).toHaveBeenCalledTimes(1);
  resolver({ ok: true }); await primeira;
});

it("oferece campo de motivo quando só a invalidação está disponível", () => {
  mount(false, false, "", true);
  const campos = camposDeMotivo(tela());
  expect(campos).toHaveLength(1);
  (campos[0].props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Fotografia alterada" } });
  expect(camposDeMotivo(tela())[0].props.value).toBe("Fotografia alterada");
});

describe("feedback separado", () => {
  contratoFeedbackSeparado({
    nome: "aprovar acerto", preparar: () => { mount(); }, tela, action: m.decidir,
    acionar: () => buttons(tela())[0].onClick(),
    sucesso: "Decisão registrada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => elementos(tela()).find((n) => n.type === "fieldset")?.props.disabled === true,
  });
  contratoFeedbackSeparado({
    nome: "aplicar acerto aprovado", preparar: () => { mount(false, true); }, tela, action: m.aplicar,
    acionar: () => buttons(tela())[0].onClick(),
    sucesso: "Acerto aplicado.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => elementos(tela()).find((n) => n.type === "fieldset")?.props.disabled === true,
  });
});
