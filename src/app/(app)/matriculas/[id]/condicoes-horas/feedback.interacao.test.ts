import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2: erro e sucesso separados na preparação e na decisão das
// condições por hora — erro em role="alert", sucesso em role="status", falha de rede como resultado
// incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
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
vi.mock("@/server/matricula/condicoes-horas", () => ({ consultarCondicoesHoras: vi.fn(), prepararCondicoesHoras: m.preparar, decidirCondicoesHoras: m.decidir }));

import { CondicoesHoras } from "./CondicoesHoras";
import { CampoMoeda } from "@/components/CampoMoeda";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.resetAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const dados = {
  matriculaId: "m", codigo: "M-1", moeda: "BRL", fuso: "America/Sao_Paulo", impedimento: null, podePreparar: true, documentoId: "d",
  versoes: [{ id: "v", versao: 1, status: "PENDENTE", preparador: { nome: "Secretaria" }, criadaEm: "2026-01-01T02:30:00Z", documentoId: "d", motivo: "Transcrição", motivoDecisao: null, decisor: null, decididaEm: null, podeDecidir: true,
    regras: { moeda: "BRL", valorHora: "100.00", antecedenciaCancelamentoMinutos: 60, vigenteDesde: "2026-01-01T02:30:00-03:00", clausulaPreco: "Preço", clausulaCancelamento: "Cancelamento" } }],
} as unknown as Parameters<typeof CondicoesHoras>[0]["dados"];
const tela = () => m.ganchos!.renderizar(CondicoesHoras, { dados, preferenciaFusoExibicao: null });

const valoresPreparo = { antecedencia: "60", data: "2026-02-01", hora: "08:00", preco: "Cláusula 3", cancelamento: "Cláusula 4", motivo: "Transcrição conferida" };
const digitarPreco = (valor: string) => (elementos(tela()).find((n) => n.type === CampoMoeda)!.props.onChange as (v: string) => void)(valor);
const fieldsets = () => elementos(tela()).filter((n) => n.type === "fieldset");

describe("CondicoesHoras", () => {
  contratoFeedbackSeparado({
    nome: "preparar condições por hora", preparar: () => digitarPreco("100,00"), tela, action: m.preparar,
    acionar: () => submeter(tela(), valoresPreparo, 0),
    sucesso: "Versão preparada para revisão independente.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => fieldsets()[0].props.disabled === true && elementos(tela()).some((n) => n.type === "button" && texto(n.props.children) === "Registrando…"),
  });

  contratoFeedbackSeparado({
    nome: "decidir transcrição", tela, action: m.decidir,
    acionar: () => submeter(tela(), { decisao: "aprovar", motivo: "Conferido no contrato" }, 1),
    sucesso: "Decisão registrada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => fieldsets()[1].props.disabled === true,
  });

  it("preço inválido vira erro em role=\"alert\" sem chamar a action", async () => {
    digitarPreco("abc");
    await submeter(tela(), valoresPreparo, 0);
    expect(m.preparar).not.toHaveBeenCalled();
    expect(anuncios(tela())).toEqual({ alerta: ["Informe o preço por hora, com no máximo duas casas decimais."], status: [] });
  });

  it("data/hora de vigência inválida vira erro em role=\"alert\" sem chamar a action", async () => {
    digitarPreco("100,00");
    await submeter(tela(), { ...valoresPreparo, data: "" }, 0);
    expect(m.preparar).not.toHaveBeenCalled();
    const { alerta, status } = anuncios(tela());
    expect(alerta).toHaveLength(1); expect(status).toEqual([]);
  });

  it("envia o preço com duas casas e atualiza a tela só no sucesso", async () => {
    digitarPreco("100,5");
    m.preparar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), valoresPreparo, 0);
    expect(m.preparar.mock.calls[0][0]).toMatchObject({ matriculaId: "m", documentoId: "d", motivo: "Transcrição conferida", regras: { valorHora: "100.50", antecedenciaCancelamentoMinutos: 60 } });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
