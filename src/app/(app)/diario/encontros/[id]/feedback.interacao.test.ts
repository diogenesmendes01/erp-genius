import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados no informe da
// particular — erro em role="alert", sucesso em role="status", falha de rede como resultado incerto
// (com chave: reenviar é seguro) e o formulário saindo do ocupado. Sem DOM: src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(), registrar: vi.fn(), consultar: vi.fn(),
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
vi.mock("@/server/matricula/ocorrencia-particular", () => ({ registrarOcorrenciaParticular: m.registrar, consultarOcorrenciasParticular: m.consultar }));

import { OcorrenciaParticular } from "./OcorrenciaParticular";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, botao, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

let sequencia = 0;
beforeEach(() => {
  vi.clearAllMocks(); m.ganchos = criarGanchos(); sequencia = 0;
  vi.stubGlobal("FormData", FormDataFalso);
  vi.stubGlobal("crypto", { randomUUID: () => `chave-${++sequencia}` });
});
afterEach(() => { vi.unstubAllGlobals(); });

type Props = Parameters<typeof OcorrenciaParticular>[0];
const aula = {
  encontroId: "encontro", inicio: "2026-09-16T12:00:00.000Z", fim: "2026-09-16T13:00:00.000Z", fuso: "America/Sao_Paulo",
  conferidaFinanceiramente: false, podeInformarAula: true, podeInformarCancelamento: false, origemCancelamento: null, versaoAtual: 0, historico: [],
} as unknown as Props["dados"];
const tela = (dados: Props["dados"] = aula) => m.ganchos!.renderizar(OcorrenciaParticular, { dados, fusoExibicao: "America/Sao_Paulo" });
/** O botão de envio (o rótulo muda para "Registrando…" durante a action). */
const botaoEnvio = () => elementos(tela()).find((n) => n.type === "button" && n.props.type === "submit");

describe("OcorrenciaParticular", () => {
  const acionar = () => submeter(tela(), { tipo: "REALIZADA", evidencia: "Aula dada com o aluno presente." });
  contratoFeedbackSeparado({
    nome: "registrar ocorrência", tela: () => tela(), action: m.registrar, acionar,
    sucesso: "Informe registrado. A conferência financeira permanece separada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => texto(botaoEnvio()?.props.children) === "Registrando…" && botaoEnvio()?.props.disabled === true,
  });

  it("depois de resultado incerto, reenviar a mesma entrada reaproveita a chave; entrada nova ganha chave nova", async () => {
    m.registrar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await acionar();
    m.registrar.mockResolvedValueOnce({ ok: true });
    await acionar();
    expect(m.registrar.mock.calls.map(([e]) => e.chaveIdempotencia)).toEqual(["chave-1", "chave-1"]);
    expect(m.refresh).toHaveBeenCalledTimes(1);
    m.registrar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { tipo: "FALTA_ALUNO", evidencia: "Aluno não compareceu." });
    expect(m.registrar).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: "FALTA_ALUNO", chaveIdempotencia: "chave-2" }));
  });

  it("horário de comunicação inexistente no fuso: erro de preenchimento em alerta, sem chamar o servidor", async () => {
    const cancelamento = { ...aula, fuso: "America/New_York", podeInformarAula: false, podeInformarCancelamento: true, origemCancelamento: "ALUNO" } as unknown as Props["dados"];
    const antes = anuncios(tela(cancelamento));
    await submeter(tela(cancelamento), { tipo: "CANCELAMENTO_ALUNO", data: "2026-03-08", hora: "02:30", evidencia: "Aluno avisou por telefone." });
    expect(m.registrar).not.toHaveBeenCalled();
    expect(novosAnuncios(antes, anuncios(tela(cancelamento)))).toEqual({
      alerta: ["Horário 2026-03-08 02:30 em America/New_York inexistente; requer revisão da grade."], status: [],
    });
    expect(botao(tela(cancelamento), "Registrar ocorrência").props.disabled).toBe(false);
  });
});
