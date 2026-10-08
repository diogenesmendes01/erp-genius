import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ganchos sem DOM (src/test/tela-sem-dom.ts): o estado vive entre renders, como no React — o motivo é
// digitado no campo e a tela é renderizada de novo antes do clique.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), concluir: vi.fn(), vincular: vi.fn(), obsoletar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/contratos/aditivo-taxa-impactos", () => ({ decidirImpactosTaxaAditivo: m.decidir, completarImpactosTaxaAditivo: m.concluir, vincularImpactoTaxaAditivo: m.vincular, obsoletarImpactosTaxaAditivo: m.obsoletar }));

import { ImpactosTaxaOperacao } from "./ImpactosTaxaOperacao";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { botao, clicar, criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

type Props = Parameters<typeof ImpactosTaxaOperacao>[0];
let props: Props;
const tela = () => m.ganchos!.renderizar(ImpactosTaxaOperacao, props);
const botoes = () => elementos(tela()).filter((n) => n.type === "button").map((n) => ({ props: { disabled: n.props.disabled as boolean | undefined, children: texto(n.props.children).trim() } }));

beforeEach(() => {
  vi.resetAllMocks(); m.ganchos = criarGanchos();
  let n = 0; vi.stubGlobal("crypto", { randomUUID: () => `chave-impactos-${++n}` });
});
afterEach(() => { vi.unstubAllGlobals(); });

function montar(status: string, motivo = "") {
  props = { conjunto: { id: "conjunto", status, podeVincular: status === "PENDENTE", podeDecidir: status === "PENDENTE", podeConcluir: status === "APROVADO", podeObsoletar: status === "APROVADO", pendencias: { afetadasSemVinculo: 0, afetadasSemAplicacao: 0 }, impactos: [{ cobrancaId: "c1", cobranca: { id: "c1", codigo: "T-1", moeda: "CRC", valorNegociado: "100.00", vencimento: "2026-09-01", status: "PENDENTE" }, decisao: "AFETADA", justificativa: "Taxa atingida pelo aditivo.", propostaAcertoId: null, acertoStatus: null, aplicado: false }, { cobrancaId: "c2", cobranca: { id: "c2", codigo: "T-2", moeda: "CRC", valorNegociado: "50.00", vencimento: "2026-09-01", status: "PENDENTE" }, decisao: "PRESERVADA", justificativa: "Cobrança fora do escopo.", propostaAcertoId: null, acertoStatus: null, aplicado: false }] }, acertos: [{ id: "acerto", cobrancaId: "c1", codigo: "T-1", moeda: "CRC", valorNovo: "80.00", vencimentoNovo: "2026-09-05", status: "APLICADA" }], reprepararHref: "/repreparar" };
  if (motivo) {
    const campo = elementos(tela()).find((n) => n.type === CampoTexto)!;
    (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: motivo } });
  }
  return tela();
}

it("explica que o conjunto deve ser preparado antes de oferecer operações", () => {
  props = { conjunto: null, acertos: [], reprepararHref: "/repreparar" };
  expect(JSON.stringify(tela())).toContain("ainda não foi preparado");
});
it("não libera aprovação sem motivo e oferece vínculo somente para a taxa afetada", () => {
  const elemento = montar("PENDENTE");
  const b = botoes();
  expect(b.map(x => x.props.children)).toContain("Vincular acerto");
  expect(b.filter(x => x.props.children === "Vincular acerto")).toHaveLength(1);
  expect(b.find(x => x.props.children === "Aprovar conjunto")?.props.disabled).toBe(true);
  expect(JSON.stringify(elemento)).toContain("Cobrança fora do escopo");
});
it("oferece conclusão somente depois da aprovação", () => {
  montar("APROVADO");
  const b = botoes();
  expect(b.map(x => x.props.children)).toContain("Concluir impactos aplicados");
  expect(b.map(x => x.props.children)).not.toContain("Aprovar conjunto");
});
it("envia aprovação com payload e repete a mesma chave após falha", async () => {
  montar("PENDENTE", "Conferência independente registrada.");
  m.decidir.mockResolvedValueOnce({ ok: false, erro: "Revisão necessária" }); await clicar(tela(), "Aprovar conjunto");
  m.decidir.mockResolvedValueOnce({ ok: true }); await clicar(tela(), "Aprovar conjunto");
  expect(m.decidir.mock.calls[0][0]).toMatchObject({ conjuntoId: "conjunto", aprovada: true, motivo: "Conferência independente registrada." });
  expect(m.decidir.mock.calls[0][0]).toEqual(m.decidir.mock.calls[1][0]);
  expect(m.refresh).toHaveBeenCalledTimes(1);
});

describe("feedback separado", () => {
  contratoFeedbackSeparado({
    nome: "aprovar conjunto de impactos", preparar: () => { montar("PENDENTE", "Conferência independente registrada."); }, tela,
    acionar: () => clicar(tela(), "Aprovar conjunto"), action: m.decidir,
    sucesso: "Decisão do conjunto registrada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botao(tela(), "Aprovar conjunto").props.disabled === true,
  });
  contratoFeedbackSeparado({
    nome: "concluir impactos aplicados", preparar: () => { montar("APROVADO"); }, tela,
    acionar: () => clicar(tela(), "Concluir impactos aplicados"), action: m.concluir,
    sucesso: "Conjunto completo registrado.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botao(tela(), "Concluir impactos aplicados").props.disabled === true,
  });
});
