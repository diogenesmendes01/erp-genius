import { expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ decidir: vi.fn(), aplicar: vi.fn(), obsoletar: vi.fn(), state: vi.fn(), ref: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: m.state, useRef: m.ref }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/contratos/aditivo-cobertura", () => ({ decidirImpactosCoberturaAditivo: m.decidir, aplicarImpactosCoberturaAditivo: m.aplicar, obsoletarImpactosCoberturaAditivo: m.obsoletar }));
import { ImpactosCoberturaOperacao } from "./ImpactosCoberturaOperacao";

function botoes(node: unknown): Array<{ props: { children?: string; disabled?: boolean; onClick?: () => Promise<void> } }> { if (Array.isArray(node)) return node.flatMap(botoes); if (!node || typeof node !== "object") return []; const n = node as { type?: string; props?: { children?: unknown; disabled?: boolean; onClick?: () => Promise<void> } }; return n.type === "button" ? [{ props: n.props! as { children?: string; disabled?: boolean; onClick?: () => Promise<void> } }] : botoes(n.props?.children); }
function montar(status: string, motivo = "") {
  vi.clearAllMocks(); vi.stubGlobal("crypto", { randomUUID: () => "chave-cobertura" });
  m.state.mockReturnValueOnce([motivo, vi.fn()]).mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([false, vi.fn()]); m.ref.mockReturnValue({ current: null });
  return ImpactosCoberturaOperacao({ conjunto: { id: "conjunto", status, politica: { escolha: "PRESERVAR_REFERENCIA" }, motivo: "Conferência motivada pelo aditivo assinado.", evidencia: "Referência documental conferida.", decisao: null, podeDecidir: status === "PENDENTE", podeAplicar: status === "APROVADO", podeObsoletar: status === "PENDENTE", pendencias: { afetadasSemAplicacao: 1 }, impactos: [{ cobrancaId: "m1", classificacao: "AFETADA", justificativa: "Limites corrigidos pelo aditivo.", aplicado: false, coberturaInicioAnterior: "2026-10-01", coberturaFimAnterior: "2026-10-31", coberturaInicioNova: "2026-11-01", coberturaFimNova: "2026-11-30", cobranca: { codigo: "M-1", moeda: "CRC", coberturaInicio: "2026-10-01", coberturaFim: "2026-10-31", vencimento: "2026-10-01", status: "PENDENTE" } }] }, reprepararHref: "/repreparar" });
}
it("não oferece mutações quando a consulta não autoriza operação", () => {
  m.state.mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([false, vi.fn()]); m.ref.mockReturnValue({ current: null });
  const elemento = ImpactosCoberturaOperacao({ conjunto: { id: "conjunto", status: "PENDENTE", politica: { escolha: "PRESERVAR_REFERENCIA" }, motivo: "Motivo conferido.", evidencia: "Evidência conferida.", decisao: null, podeDecidir: false, podeAplicar: false, podeObsoletar: false, pendencias: { afetadasSemAplicacao: 1 }, impactos: [] }, reprepararHref: "/repreparar" });
  expect(botoes(elemento)).toEqual([]);
});
it("envia aprovação com motivo e repete a mesma chave após falha", async () => {
  const aprovar = botoes(montar("PENDENTE", "Conferência independente registrada.")).find(b => b.props.children === "Aprovar conjunto")!.props.onClick!;
  m.decidir.mockResolvedValueOnce({ ok: false, erro: "Revise" }); await aprovar(); m.decidir.mockResolvedValueOnce({ ok: true }); await aprovar();
  expect(m.decidir.mock.calls[0][0]).toMatchObject({ conjuntoId: "conjunto", aprovada: true, motivo: "Conferência independente registrada." }); expect(m.decidir.mock.calls[0][0]).toEqual(m.decidir.mock.calls[1][0]);
});
it("oferece aplicação somente quando a consulta libera o decisor", () => {
  const b = botoes(montar("APROVADO")); expect(b.map(x => x.props.children)).toContain("Aplicar coberturas aprovadas"); expect(b.map(x => x.props.children)).not.toContain("Aprovar conjunto");
});
