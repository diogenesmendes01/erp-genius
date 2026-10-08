import { afterEach, beforeEach, expect, it, vi } from "vitest";
// Ganchos de src/test/tela-sem-dom.ts no lugar do React: o estado (inclusive o do useAcaoCliente) vive
// entre renders, e os campos são preenchidos pelo onChange, como na tela.
const mocks = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, propor: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async original => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => mocks.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => mocks.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-acoes", () => ({ proporAcertoTaxaAditivo: mocks.propor }));
import { AcertoTaxaFormulario } from "./AcertoTaxaFormulario";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios } from "@/test/feedback-acao";
import { criarGanchos, elementos } from "@/test/tela-sem-dom";

const props = { matriculaId: "m", propostaAditivoId: "aditivo", conclusaoId: "assinatura", revisaoHash: "hash", cobrancas: [{ id: "taxa", codigo: "C1", moeda: "BRL", valorOriginal: "100", valorNegociado: "100", valorRecebido: "100", valorLiquidadoCredito: "0", saldo: "0", vencimento: "2026-09-01", valorNovo: "80", vencimentoNovo: "2026-10-01", creditoNovo: "20", saldoAposAcerto: "0", pendencia: null }] };
const tela = () => mocks.ganchos!.renderizar(AcertoTaxaFormulario, props);
const digitar = (no: { props: Record<string, unknown> }, value: string) => (no.props.onChange as (e: unknown) => void)({ target: { value } });
function mount(selected = "taxa") {
  digitar(elementos(tela()).find(n => n.type === "select")!, selected);
  const [motivo, evidencia] = elementos(tela()).filter(n => n.type === CampoTexto);
  digitar(motivo, "Motivo conferido");
  digitar(evidencia, "Protocolo do acordo");
  const arvore = tela();
  return { botao: elementos(arvore).find(n => n.type === "button")!.props, select: elementos(arvore).find(n => n.type === "select")!.props };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ganchos = criarGanchos();
  vi.stubGlobal("crypto", { randomUUID: () => "chave-estavel-taxa" });
});
afterEach(() => vi.unstubAllGlobals());
it("exige escolha explícita de cobrança antes de enviar", async () => {
  const c = mount("");
  expect(c.select.value).toBe(""); expect(c.botao.disabled).toBe(true);
  await (c.botao.onClick as () => Promise<void>)(); expect(mocks.propor).not.toHaveBeenCalled();
});
it("preserva chave após falha e não envia duas vezes enquanto aguarda", async () => {
  const c = mount(); let resolver!: (valor: unknown) => void;
  mocks.propor.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
  const enviar = c.botao.onClick as () => Promise<void>;
  const primeira = enviar(); await enviar(); expect(mocks.propor).toHaveBeenCalledTimes(1);
  resolver({ ok: false, erro: "Fotografia mudou" }); await primeira;
  expect(anuncios(tela()).alerta).toEqual(["Fotografia mudou"]); expect(mocks.refresh).not.toHaveBeenCalled();
  mocks.propor.mockResolvedValueOnce({ ok: true, dado: { id: "proposta" } }); await enviar();
  expect(mocks.propor.mock.calls[1][0]).toEqual(mocks.propor.mock.calls[0][0]);
  expect(mocks.propor.mock.calls[0][0]).toMatchObject({ cobrancaId: "taxa", motivo: "Motivo conferido", evidencia: { texto: "Protocolo do acordo" }, chaveIdempotencia: "chave-estavel-taxa" });
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
it("permite conferir a mesma tentativa após falha de comunicação", async () => {
  const c = mount(); mocks.propor.mockRejectedValueOnce(new Error("Rede"));
  await (c.botao.onClick as () => Promise<void>)();
  expect(anuncios(tela()).alerta).toEqual([MSG_RESULTADO_INCERTO]);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
