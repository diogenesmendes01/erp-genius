import { expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ decidir: vi.fn(), concluir: vi.fn(), vincular: vi.fn(), state: vi.fn(), ref: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: m.state, useRef: m.ref }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/contratos/aditivo-taxa-impactos", () => ({ decidirImpactosTaxaAditivo: m.decidir, completarImpactosTaxaAditivo: m.concluir, vincularImpactoTaxaAditivo: m.vincular }));
import { ImpactosTaxaOperacao } from "./ImpactosTaxaOperacao";

function botoes(node: unknown): Array<{ props: { disabled?: boolean; children?: string } }> {
  if (Array.isArray(node)) return node.flatMap(botoes);
  if (!node || typeof node !== "object") return [];
  const n = node as { type?: string; props?: { children?: unknown; disabled?: boolean } };
  return n.type === "button" ? [{ props: n.props! as { disabled?: boolean; children?: string } }] : botoes(n.props?.children);
}
function montar(status: string, motivo = "") {
  vi.clearAllMocks();
  m.state.mockReturnValueOnce([motivo, vi.fn()]).mockReturnValueOnce([{}, vi.fn()]).mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([false, vi.fn()]);
  m.ref.mockReturnValue({ current: null });
  return ImpactosTaxaOperacao({ conjunto: { id: "conjunto", status, podeVincular: status === "PENDENTE", podeDecidir: status === "PENDENTE", podeConcluir: status === "APROVADO", pendencias: { afetadasSemVinculo: 0, afetadasSemAplicacao: 0 }, impactos: [{ cobrancaId: "c1", cobranca: { id: "c1", codigo: "T-1", moeda: "CRC", valorNegociado: "100.00", vencimento: "2026-09-01", status: "PENDENTE" }, decisao: "AFETADA", justificativa: "Taxa atingida pelo aditivo.", propostaAcertoId: null, acertoStatus: null, aplicado: false }, { cobrancaId: "c2", cobranca: { id: "c2", codigo: "T-2", moeda: "CRC", valorNegociado: "50.00", vencimento: "2026-09-01", status: "PENDENTE" }, decisao: "PRESERVADA", justificativa: "Cobrança fora do escopo.", propostaAcertoId: null, acertoStatus: null, aplicado: false }] }, acertos: [{ id: "acerto", cobrancaId: "c1", codigo: "T-1", moeda: "CRC", valorNovo: "80.00", vencimentoNovo: "2026-09-05", status: "APLICADA" }] });
}
it("explica que o conjunto deve ser preparado antes de oferecer operações", () => {
  vi.clearAllMocks();
  m.state.mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([{}, vi.fn()]).mockReturnValueOnce(["", vi.fn()]).mockReturnValueOnce([false, vi.fn()]);
  m.ref.mockReturnValue({ current: null });
  const elemento = ImpactosTaxaOperacao({ conjunto: null, acertos: [] });
  expect(JSON.stringify(elemento)).toContain("ainda não foi preparado");
});
it("não libera aprovação sem motivo e oferece vínculo somente para a taxa afetada", () => {
  const elemento = montar("PENDENTE");
  const b = botoes(elemento);
  expect(b.map(x => x.props.children)).toContain("Vincular acerto");
  expect(b.find(x => x.props.children === "Aprovar conjunto")?.props.disabled).toBe(true);
  expect(JSON.stringify(elemento)).toContain("Cobrança fora do escopo");
});
it("oferece conclusão somente depois da aprovação", () => {
  const elemento = montar("APROVADO");
  const b = botoes(elemento);
  expect(b.map(x => x.props.children)).toContain("Concluir impactos aplicados");
  expect(b.map(x => x.props.children)).not.toContain("Aprovar conjunto");
});
