import { afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ decidir: vi.fn(), aplicar: vi.fn(), invalidar: vi.fn(), refresh: vi.fn(), state: vi.fn(), ref: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: m.state, useRef: m.ref }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-acoes", () => ({ decidirAcertoTaxaAditivo: m.decidir, aplicarAcertoTaxaAditivo: m.aplicar, invalidarAcertoTaxaAditivo: m.invalidar }));
import { DecisaoTaxa } from "./DecisaoTaxa";
function buttons(node: unknown): Array<{ onClick: () => Promise<void>; children: string }> {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!node || typeof node !== "object") return [];
  const n = node as { type?: string; props: { children?: unknown } };
  return n.type === "button" ? [n.props as { onClick: () => Promise<void>; children: string }] : buttons(n.props?.children);
}
function mount(podeDecidir = true, podeAplicar = false, motivo = "Evidência conferida", podeInvalidar = false) {
  vi.clearAllMocks(); let chave = 0; vi.stubGlobal("crypto", { randomUUID: () => `tentativa-${++chave}` });
  const mensagem = vi.fn(); m.state.mockReturnValueOnce([motivo, vi.fn()]).mockReturnValueOnce([false, vi.fn()]).mockReturnValueOnce(["", mensagem]);
  m.ref.mockReturnValueOnce({ current: false }).mockReturnValueOnce({ current: null });
  const elemento = DecisaoTaxa({ propostaId: "p", podeDecidir, podeAplicar, podeInvalidar });
  return { mensagem, elemento, botoes: buttons(elemento) };
}
afterEach(() => vi.unstubAllGlobals());
it("não oferece operações sem permissão", () => { expect(mount(false, false).botoes).toHaveLength(0); });
it("não envia decisão sem motivo suficiente", async () => { const c = mount(true, false, ""); await c.botoes[0].onClick(); expect(m.decidir).not.toHaveBeenCalled(); });
it("impede clique concorrente e mantém chave depois de erro", async () => {
  const c = mount(); let resolver!: (v: unknown) => void;
  m.decidir.mockReturnValueOnce(new Promise(r => { resolver = r; }));
  const primeira = c.botoes[0].onClick(); await c.botoes[1].onClick(); expect(m.decidir).toHaveBeenCalledTimes(1);
  resolver({ ok: false, erro: "Revisão necessária" }); await primeira;
  m.decidir.mockResolvedValueOnce({ ok: true }); await c.botoes[0].onClick();
  expect(m.decidir.mock.calls[0][0]).toEqual(m.decidir.mock.calls[1][0]); expect(m.refresh).toHaveBeenCalledTimes(1);
});
it("uma decisão diferente recebe outra chave", async () => {
  const c = mount(); m.decidir.mockResolvedValue({ ok: false, erro: "Falha" });
  await c.botoes[0].onClick(); await c.botoes[1].onClick();
  expect(m.decidir.mock.calls[0][0].chaveIdempotencia).not.toEqual(m.decidir.mock.calls[1][0].chaveIdempotencia);
  expect(m.decidir.mock.calls[1][0].aprovada).toBe(false);
});
it("aplicação incerta permite conferir a mesma tentativa", async () => {
  const c = mount(false, true); m.aplicar.mockRejectedValueOnce(new Error("Rede")); await c.botoes[0].onClick();
  expect(c.mensagem).toHaveBeenCalledWith(expect.stringContaining("Não foi possível confirmar")); expect(m.refresh).not.toHaveBeenCalled();
  m.aplicar.mockResolvedValueOnce({ ok: true }); await c.botoes[0].onClick();
  expect(m.aplicar.mock.calls[0][0]).toEqual(m.aplicar.mock.calls[1][0]); expect(m.refresh).toHaveBeenCalledTimes(1);
});
it("invalidação usa a action, preserva chave no replay e atualiza a tela", async () => {
  const c = mount(false, false, "Comissão mudou depois da aprovação", true);
  m.invalidar.mockResolvedValueOnce({ ok: false, erro: "Revisão necessária" });
  await c.botoes[0].onClick();
  m.invalidar.mockResolvedValueOnce({ ok: true });
  await c.botoes[0].onClick();
  expect(m.invalidar.mock.calls[0][0]).toEqual(m.invalidar.mock.calls[1][0]);
  expect(m.invalidar.mock.calls[0][0]).toMatchObject({ propostaId: "p", motivo: "Comissão mudou depois da aprovação", evidencia: { conferencia: "Comissão mudou depois da aprovação" } });
  expect(c.mensagem).toHaveBeenCalledWith("Acerto invalidado; prepare uma nova proposta.");
  expect(m.refresh).toHaveBeenCalledTimes(1);
});
it("invalidação exige capacidade e bloqueia clique concorrente", async () => {
  expect(mount(false, false, "Comissão mudou depois da aprovação", false).botoes).toHaveLength(0);
  const c = mount(false, false, "Comissão mudou depois da aprovação", true); let resolver!: (r: { ok: true }) => void;
  m.invalidar.mockReturnValueOnce(new Promise(r => { resolver = r; }));
  const primeira = c.botoes[0].onClick(); await c.botoes[0].onClick();
  expect(m.invalidar).toHaveBeenCalledTimes(1);
  resolver({ ok: true }); await primeira;
});

it("oferece campo de motivo quando só a invalidação está disponível", () => {
  const c = mount(false, false, "", true);
  function localizar(node: unknown): Array<{ onChange: (e: { target: { value: string } }) => void }> {
    if (Array.isArray(node)) return node.flatMap(localizar);
    if (!node || typeof node !== "object") return [];
    const n = node as { type?: string; props?: { children?: unknown; onChange?: (e: { target: { value: string } }) => void } };
    return n.type === "textarea" && n.props?.onChange ? [{ onChange: n.props.onChange }] : localizar(n.props?.children);
  }
  const campos = localizar(c.elemento);
  expect(campos).toHaveLength(1);
  const alterarMotivo = m.state.mock.results[0].value[1];
  campos[0].onChange({ target: { value: "Fotografia alterada" } });
  expect(alterarMotivo).toHaveBeenCalledWith("Fotografia alterada");
});
