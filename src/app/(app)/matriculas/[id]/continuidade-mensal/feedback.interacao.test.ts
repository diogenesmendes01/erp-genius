import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2: erro e sucesso separados na preparação e na decisão das
// condições de continuidade mensal — erro em role="alert", sucesso em role="status", falha de rede como
// resultado incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  preparar: vi.fn(), decidir: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/matricula/condicoes-continuidade-mensal", () => ({ consultarCondicoesContinuidadeMensal: vi.fn(), prepararCondicoesContinuidadeMensal: m.preparar, decidirCondicoesContinuidadeMensal: m.decidir }));

import { CondicoesContinuidadeMensal } from "./CondicoesContinuidadeMensal";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.resetAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const dados = {
  matriculaId: "m", codigo: "M-1", moeda: "BRL", impedimento: null, podePreparar: true, documentoId: "d",
  versoes: [{ id: "v1", versao: 1, status: "PENDENTE", preparador: { nome: "Financeiro" }, criadaEm: "2026-01-01T00:00:00Z", regras: null, naoConferida: false, motivo: "Transcrição", decisor: null, motivoDecisao: null, decididaEm: null, podeDecidir: true }],
} as unknown as Parameters<typeof CondicoesContinuidadeMensal>[0]["dados"];
const tela = () => m.ganchos!.renderizar(CondicoesContinuidadeMensal, { dados });

/** Escolhe o valor de um <select> controlado pelo id (o onChange recebe o evento nativo). */
const escolher = (id: string, valor: string) =>
  (elementos(tela()).find((n) => n.type === "select" && n.props.id === id)!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
function escolherRegras() {
  escolher("referencia-cobertura", "MES_CIVIL");
  escolher("ajuste-vencimento", "MANTER_DATA");
  escolher("referencia-vencimento", "MES_COBERTURA");
}
const valoresPreparo = { clausula: "Cláusula 5", valorOriginal: "1000.00", valorNegociado: "900.00", vigenteDesde: "2026-02-01", diaVencimento: "10", antecedenciaDias: "5", motivo: "Transcrição conferida" };
const fieldsetDaDecisao = () => elementos(tela()).filter((n) => n.type === "fieldset").at(-1)!;

describe("CondicoesContinuidadeMensal", () => {
  contratoFeedbackSeparado({
    nome: "preparar continuidade mensal", preparar: escolherRegras, tela, action: m.preparar,
    acionar: () => submeter(tela(), valoresPreparo, 0),
    sucesso: "Versão preparada para revisão independente.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => elementos(tela()).some((n) => n.type === "button" && texto(n.props.children) === "Registrando…"),
  });

  contratoFeedbackSeparado({
    nome: "decidir transcrição", tela, action: m.decidir,
    acionar: () => submeter(tela(), { decisao: "rejeitar", motivo: "Cláusula divergente" }, 1),
    sucesso: "Decisão registrada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => fieldsetDaDecisao().props.disabled === true,
  });

  it("sem as referências escolhidas, o erro sai em role=\"alert\" sem chamar a action", async () => {
    await submeter(tela(), valoresPreparo, 0);
    expect(m.preparar).not.toHaveBeenCalled();
    expect(anuncios(tela()).alerta).toContain("Selecione as referências de cobertura, vencimento e o ajuste de vencimento previstos no contrato.");
    expect(anuncios(tela()).status).toEqual([]);
  });

  it("envia as regras escolhidas e atualiza a tela só no sucesso", async () => {
    escolherRegras();
    m.preparar.mockResolvedValueOnce({ ok: false, erro: "Recusado" });
    await submeter(tela(), valoresPreparo, 0);
    expect(m.refresh).not.toHaveBeenCalled();
    m.preparar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), valoresPreparo, 0);
    expect(m.preparar.mock.calls[1][0]).toMatchObject({ matriculaId: "m", documentoId: "d", regras: { regraCobertura: { referencia: "MES_CIVIL" }, referenciaVencimento: "MES_COBERTURA", ajusteVencimento: { regra: "MANTER_DATA" }, diaVencimento: 10 } });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
