import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2: erro e sucesso separados no preparo dos impactos de
// cobertura — erro em role="alert", sucesso em role="status", falha de rede como resultado incerto e o
// botão saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  preparar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/contratos/aditivo-cobertura", () => ({ prepararImpactosCoberturaAditivo: m.preparar }));

import { ImpactosCoberturaFormulario } from "./ImpactosCoberturaFormulario";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { clicar, criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.resetAllMocks(); m.ganchos = criarGanchos(); });
afterEach(() => { vi.unstubAllGlobals(); });

const props = {
  matriculaId: "m", propostaId: "p", conclusaoId: "c", revisaoHash: "hash", politica: { escolha: "PRESERVAR_REFERENCIA" as const },
  cobrancas: [{ id: "c1", codigo: "M-1", moeda: "CRC", vencimento: "2026-10-01", coberturaInicio: "2026-10-01", coberturaFim: "2026-10-31" }],
};
const tela = () => m.ganchos!.renderizar(ImpactosCoberturaFormulario, props);
type AoMudar = (e: { target: { value: string } }) => void;

/** Preenche limites, justificativa, motivo e evidência (cada onChange numa leitura nova da tela). */
function preencher() {
  const datas = () => elementos(tela()).filter((n) => n.type === "input" && n.props.type === "date");
  (datas()[0].props.onChange as AoMudar)({ target: { value: "2026-11-01" } });
  (datas()[1].props.onChange as AoMudar)({ target: { value: "2026-11-30" } });
  const textos = () => elementos(tela()).filter((n) => n.type === CampoTexto);
  (textos()[0].props.onChange as AoMudar)({ target: { value: "Limites corrigidos pelo aditivo." } });
  (textos()[1].props.onChange as AoMudar)({ target: { value: "Conferência do aditivo assinado." } });
  (textos()[2].props.onChange as AoMudar)({ target: { value: "Referência documental conferida." } });
}
const botaoPreparar = () => elementos(tela()).find((n) => n.type === "button")!;

describe("ImpactosCoberturaFormulario", () => {
  contratoFeedbackSeparado({
    nome: "preparar impactos de cobertura", preparar: preencher, tela, action: m.preparar,
    acionar: () => clicar(tela(), "Preparar impactos de cobertura"),
    sucesso: "Conjunto de cobertura preparado para aprovação independente.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => texto(botaoPreparar().props.children) === "Preparando…" && botaoPreparar().props.disabled === true,
  });

  it("reenvia a mesma chave depois de erro e faz refresh só no sucesso", async () => {
    preencher();
    m.preparar.mockResolvedValueOnce({ ok: false, erro: "Revise" });
    await clicar(tela(), "Preparar impactos de cobertura");
    expect(m.refresh).not.toHaveBeenCalled();
    m.preparar.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Preparar impactos de cobertura");
    expect(m.preparar.mock.calls[0][0]).toEqual(m.preparar.mock.calls[1][0]);
    expect(m.preparar.mock.calls[0][0]).toMatchObject({ matriculaId: "m", motivo: "Conferência do aditivo assinado.", linhas: [{ cobrancaId: "c1", classificacao: "AFETADA", coberturaInicioNova: "2026-11-01", coberturaFimNova: "2026-11-30" }] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
