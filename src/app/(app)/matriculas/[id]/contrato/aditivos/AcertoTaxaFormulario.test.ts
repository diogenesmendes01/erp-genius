import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ propor: vi.fn(), refresh: vi.fn(), state: vi.fn(), ref: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: mocks.state, useRef: mocks.ref }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-acoes", () => ({ proporAcertoTaxaAditivo: mocks.propor }));
import { AcertoTaxaFormulario } from "./AcertoTaxaFormulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
function find(node: unknown, type: string): { props: Record<string, unknown> } | undefined {
  if (Array.isArray(node)) return node.map(n => find(n, type)).find(Boolean);
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; props: Record<string, unknown> };
  return n.type === type ? n : find(n.props?.children, type);
}
function mount(selected = "taxa") {
  vi.clearAllMocks();
  vi.stubGlobal("crypto", { randomUUID: () => "chave-estavel-taxa" });
  const mensagem = vi.fn();
  mocks.state.mockReturnValueOnce([selected, vi.fn()]).mockReturnValueOnce(["Motivo conferido", vi.fn()])
    .mockReturnValueOnce(["Protocolo do acordo", vi.fn()]).mockReturnValueOnce(["", mensagem]).mockReturnValueOnce([false, vi.fn()]);
  mocks.ref.mockReturnValueOnce({ current: false }).mockReturnValueOnce({ current: null });
  const tree = AcertoTaxaFormulario({ matriculaId: "m", propostaAditivoId: "aditivo", conclusaoId: "assinatura", revisaoHash: "hash", cobrancas: [{ id: "taxa", codigo: "C1", moeda: "BRL", valorOriginal: "100", valorNegociado: "100", valorRecebido: "100", valorLiquidadoCredito: "0", saldo: "0", vencimento: "2026-09-01", valorNovo: "80", vencimentoNovo: "2026-10-01", creditoNovo: "20", saldoAposAcerto: "0", pendencia: null }] });
  return { mensagem, botao: find(tree, "button")!.props, select: find(tree, "select")!.props };
}
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
  expect(c.mensagem).toHaveBeenCalledWith("Fotografia mudou"); expect(mocks.refresh).not.toHaveBeenCalled();
  mocks.propor.mockResolvedValueOnce({ ok: true, dado: { id: "proposta" } }); await enviar();
  expect(mocks.propor.mock.calls[1][0]).toEqual(mocks.propor.mock.calls[0][0]);
  expect(mocks.propor.mock.calls[0][0]).toMatchObject({ cobrancaId: "taxa", motivo: "Motivo conferido", evidencia: { texto: "Protocolo do acordo" }, chaveIdempotencia: "chave-estavel-taxa" });
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
it("permite conferir a mesma tentativa após falha de comunicação", async () => {
  const c = mount(); mocks.propor.mockRejectedValueOnce(new Error("Rede"));
  await (c.botao.onClick as () => Promise<void>)();
  expect(c.mensagem).toHaveBeenCalledWith(MSG_RESULTADO_INCERTO);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
