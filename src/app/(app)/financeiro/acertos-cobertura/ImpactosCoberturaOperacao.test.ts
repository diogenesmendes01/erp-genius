import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ganchos sem DOM (src/test/tela-sem-dom.ts): o estado vive entre renders, como no React — o motivo é
// digitado no campo e a tela é renderizada de novo antes do clique.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), aplicar: vi.fn(), obsoletar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/contratos/aditivo-cobertura", () => ({ decidirImpactosCoberturaAditivo: m.decidir, aplicarImpactosCoberturaAditivo: m.aplicar, obsoletarImpactosCoberturaAditivo: m.obsoletar }));

import { ImpactosCoberturaOperacao } from "./ImpactosCoberturaOperacao";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { botao, clicar, criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

type Props = Parameters<typeof ImpactosCoberturaOperacao>[0];

beforeEach(() => {
  vi.resetAllMocks(); m.ganchos = criarGanchos();
  let n = 0; vi.stubGlobal("crypto", { randomUUID: () => `chave-cobertura-${++n}` });
});
afterEach(() => { vi.unstubAllGlobals(); });

function conjunto(status: string, permissoes?: Partial<Pick<NonNullable<Props["conjunto"]>, "podeDecidir" | "podeAplicar" | "podeObsoletar">>): NonNullable<Props["conjunto"]> {
  return { id: "conjunto", status, politica: { escolha: "PRESERVAR_REFERENCIA" }, motivo: "Conferência motivada pelo aditivo assinado.", evidencia: "Referência documental conferida.", decisao: null, podeDecidir: status === "PENDENTE", podeAplicar: status === "APROVADO", podeObsoletar: status === "PENDENTE", ...permissoes, pendencias: { afetadasSemAplicacao: 1 }, impactos: [{ cobrancaId: "m1", classificacao: "AFETADA", justificativa: "Limites corrigidos pelo aditivo.", aplicado: false, coberturaInicioAnterior: "2026-10-01", coberturaFimAnterior: "2026-10-31", coberturaInicioNova: "2026-11-01", coberturaFimNova: "2026-11-30", cobranca: { codigo: "M-1", moeda: "CRC", coberturaInicio: "2026-10-01", coberturaFim: "2026-10-31", vencimento: "2026-10-01", status: "PENDENTE" } }] };
}

let props: Props;
const tela = () => m.ganchos!.renderizar(ImpactosCoberturaOperacao, props);
const rotulosDosBotoes = () => elementos(tela()).filter((n) => n.type === "button").map((n) => texto(n.props.children).trim());

/** Monta a tela e, se houver motivo, digita-o no campo (a tela é renderizada de novo a cada leitura). */
function montar(status: string, motivo = "") {
  props = { conjunto: conjunto(status), reprepararHref: "/repreparar" };
  if (motivo) {
    const campo = elementos(tela()).find((n) => n.type === CampoTexto)!;
    (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: motivo } });
  }
}

it("não oferece mutações quando a consulta não autoriza operação", () => {
  props = { conjunto: { ...conjunto("PENDENTE", { podeDecidir: false, podeAplicar: false, podeObsoletar: false }), impactos: [] }, reprepararHref: "/repreparar" };
  expect(rotulosDosBotoes()).toEqual([]);
});

it("envia aprovação com motivo e repete a mesma chave após falha", async () => {
  montar("PENDENTE", "Conferência independente registrada.");
  m.decidir.mockResolvedValueOnce({ ok: false, erro: "Revise" }); await clicar(tela(), "Aprovar conjunto");
  m.decidir.mockResolvedValueOnce({ ok: true }); await clicar(tela(), "Aprovar conjunto");
  expect(m.decidir.mock.calls[0][0]).toMatchObject({ conjuntoId: "conjunto", aprovada: true, motivo: "Conferência independente registrada." });
  expect(m.decidir.mock.calls[0][0]).toEqual(m.decidir.mock.calls[1][0]);
  expect(m.refresh).toHaveBeenCalledTimes(1);
});

it("oferece aplicação somente quando a consulta libera o decisor", () => {
  montar("APROVADO");
  expect(rotulosDosBotoes()).toContain("Aplicar coberturas aprovadas");
  expect(rotulosDosBotoes()).not.toContain("Aprovar conjunto");
});

describe("feedback separado", () => {
  contratoFeedbackSeparado({
    nome: "aprovar conjunto de cobertura", preparar: () => montar("PENDENTE", "Conferência independente registrada."), tela,
    acionar: () => clicar(tela(), "Aprovar conjunto"), action: m.decidir,
    sucesso: "Decisão independente registrada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botao(tela(), "Aprovar conjunto").props.disabled === true,
  });
  contratoFeedbackSeparado({
    nome: "aplicar coberturas aprovadas", preparar: () => montar("APROVADO"), tela,
    acionar: () => clicar(tela(), "Aplicar coberturas aprovadas"), action: m.aplicar,
    sucesso: "Coberturas aplicadas e conjunto completo.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botao(tela(), "Aplicar coberturas aprovadas").props.disabled === true,
  });
});
