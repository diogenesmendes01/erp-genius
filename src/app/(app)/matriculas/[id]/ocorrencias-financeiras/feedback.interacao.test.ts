import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2: erro e sucesso separados na prévia e no registro da
// conferência de horas — erro em role="alert", sucesso em role="status", falha de rede com a orientação
// própria de cada etapa e o botão saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  prever: vi.fn(), conferir: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/matricula/ocorrencia-financeira-previa", () => ({ preverConferenciaOcorrenciaHoras: m.prever }));
vi.mock("@/server/matricula/ocorrencia-financeira-conferir", () => ({ conferirOcorrenciaHoras: m.conferir }));

import { ConferenciaHoras } from "./ConferenciaHoras";
import { adiada, anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, botao, clicar, criarGanchos, elementos, submeter, temBotao } from "@/test/tela-sem-dom";

beforeEach(() => { vi.resetAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

type Props = Parameters<typeof ConferenciaHoras>[0];
const props = {
  encontro: { inicio: "2026-03-02T12:00:00Z", fim: "2026-03-02T13:00:00Z", fusoOrigem: "America/Sao_Paulo", conferencia: null,
    ocorrencia: { id: "o1", versao: 1, tipo: "REALIZADA", autor: { nome: "Professora" }, evidencia: "Aula dada", comunicadoEm: null } },
  condicoes: [{ id: "c1", versao: 1, regras: { vigenteDesde: "2026-01-01T00:00:00Z", valorHora: "100.00", moeda: "BRL" } }],
  matricula: { alunoId: "a", id: "m" },
} as unknown as Props;
const previa = { classificacao: { desfecho: "REALIZADA", limiteCancelamento: null }, minutos: 60, moeda: "BRL", valorApurado: "100.00", valorContratualInformativo: "100.00", reservaAntecipada: null, aditivo: null, pendencias: [], estadoPrevia: "estado-1",
  regras: { valorHora: "100.00", moeda: "BRL", clausulaPreco: "Cláusula 3", clausulaCancelamento: "Cláusula 4" } };
const tela = () => m.ganchos!.renderizar(ConferenciaHoras, props);

const escolherCondicoes = () =>
  (elementos(tela()).find((n) => n.type === "select")!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "c1" } });
async function carregarPrevia() {
  escolherCondicoes();
  m.prever.mockResolvedValueOnce({ ok: true, dado: previa });
  await clicar(tela(), "Conferir prévia");
}

describe("ConferenciaHoras — registrar conferência", () => {
  contratoFeedbackSeparado({
    nome: "registrar conferência", preparar: carregarPrevia, tela, action: m.conferir,
    acionar: () => submeter(tela(), { motivo: "Conferido com a professora" }),
    sucesso: "Conferência registrada.", incerto: "Atualize o histórico para conferir o resultado antes de repetir.",
    // O "Conferir prévia" fica na tela em todos os desfechos (a prévia some depois do registro) e trava com o ocupado.
    ocupado: () => botao(tela(), "Conferir prévia").props.disabled === true,
  });

  it("reenvia a mesma chave depois do resultado incerto e atualiza a tela só no sucesso", async () => {
    await carregarPrevia();
    m.conferir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submeter(tela(), { motivo: "Conferido com a professora" });
    expect(m.refresh).not.toHaveBeenCalled();
    m.conferir.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { motivo: "Conferido com a professora" });
    expect(m.conferir.mock.calls[1][0]).toEqual(m.conferir.mock.calls[0][0]);
    expect(m.conferir.mock.calls[0][0]).toMatchObject({ alunoId: "a", matriculaId: "m", ocorrenciaId: "o1", condicoesId: "c1", estadoPrevia: "estado-1", motivo: "Conferido com a professora" });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(temBotao(tela(), "Registrar conferência")).toBe(false);
  });
});

describe("ConferenciaHoras — prévia", () => {
  async function anunciadoApos(desfecho: () => void) {
    escolherCondicoes();
    const antes = anuncios(tela());
    desfecho();
    await clicar(tela(), "Conferir prévia");
    return novosAnuncios(antes, anuncios(tela()));
  }

  it("erro do servidor sai em role=\"alert\" e a prévia não aparece", async () => {
    expect(await anunciadoApos(() => m.prever.mockResolvedValueOnce({ ok: false, erro: "Condições fora da vigência." }))).toEqual({ alerta: ["Condições fora da vigência."], status: [] });
    expect(temBotao(tela(), "Registrar conferência")).toBe(false);
  });

  it("falha de rede mantém a orientação da prévia em role=\"alert\"", async () => {
    expect(await anunciadoApos(() => m.prever.mockRejectedValueOnce(new TypeError("Failed to fetch")))).toEqual({ alerta: ["Não foi possível carregar a prévia."], status: [] });
  });

  it("sucesso mostra a prévia, sem alerta", async () => {
    expect(await anunciadoApos(() => m.prever.mockResolvedValueOnce({ ok: true, dado: previa }))).toEqual({ alerta: [], status: [] });
    expect(temBotao(tela(), "Registrar conferência")).toBe(true);
  });

  it("ocupado enquanto carrega; sai do ocupado depois", async () => {
    escolherCondicoes();
    const pendente = adiada<unknown>();
    m.prever.mockReturnValueOnce(pendente.promessa);
    const execucao = clicar(tela(), "Conferir prévia");
    expect(botao(tela(), "Conferir prévia").props.disabled).toBe(true);
    pendente.rejeitar(new TypeError("Failed to fetch"));
    await execucao;
    expect(botao(tela(), "Conferir prévia").props.disabled).toBe(false);
  });
});
