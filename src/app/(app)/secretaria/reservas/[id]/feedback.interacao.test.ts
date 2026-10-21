import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): preparar e decidir a resolução da reserva —
// erro em role="alert" (agora pelo FeedbackAcao, com foco), sucesso em role="status", falha de rede
// como resultado incerto (com chave na preparação; mensagem própria na decisão) e os controles saindo
// do ocupado. Sem DOM: src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(),
  prepararParticular: vi.fn(), decidirParticular: vi.fn(), prepararReserva: vi.fn(), decidirReserva: vi.fn(),
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
vi.mock("@/server/matricula/reserva-particular-resolucao", () => ({ prepararResolucaoParticular: m.prepararParticular, decidirResolucaoParticular: m.decidirParticular }));
vi.mock("@/server/matricula/reserva-resolucao", () => ({ prepararResolucaoReserva: m.prepararReserva, decidirResolucaoReserva: m.decidirReserva }));

import { DecidirResolucao, PrepararResolucao } from "./Formularios";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, botao, criarGanchos, elementos, submeter } from "@/test/tela-sem-dom";

let sequencia = 0;
beforeEach(() => {
  vi.clearAllMocks(); m.ganchos = criarGanchos(); sequencia = 0;
  vi.stubGlobal("FormData", FormDataFalso);
  vi.stubGlobal("crypto", { randomUUID: () => `chave-${++sequencia}` });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("PrepararResolucao", () => {
  const tela = () => m.ganchos!.renderizar(PrepararResolucao, { reservaId: "reserva", versao: 3, fuso: "America/Sao_Paulo" });
  const valores = { data: "2026-10-20", horario: "18:00", motivo: "Aluno pediu mais prazo.", tratamento: "Contrato e documentos seguem pendentes." };
  const acionar = () => submeter(tela(), valores);
  contratoFeedbackSeparado({
    nome: "enviar proposta de resolução", tela, action: m.prepararReserva, acionar,
    sucesso: "Proposta enviada para revisão.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => botao(tela(), "Enviar proposta para revisão").props.disabled === true,
  });

  it("reenvio depois de resultado incerto reaproveita a chave; a página só atualiza no sucesso", async () => {
    m.prepararReserva.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await acionar();
    expect(m.refresh).not.toHaveBeenCalled();
    m.prepararReserva.mockResolvedValueOnce({ ok: true });
    await acionar();
    expect(m.prepararReserva.mock.calls.map(([e]) => e.chaveIdempotencia)).toEqual(["chave-1", "chave-1"]);
    expect(m.prepararReserva).toHaveBeenLastCalledWith({
      reservaId: "reserva", versaoAnterior: 3, tipo: "PRORROGAR", novoPrazo: "2026-10-20T21:00:00.000Z",
      motivo: "Aluno pediu mais prazo.", tratamentoContratacao: "Contrato e documentos seguem pendentes.", chaveIdempotencia: "chave-1",
    });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("prazo inválido no fuso: erro de preenchimento em alerta, sem chamar o servidor", async () => {
    const antes = anuncios(tela());
    await submeter(tela(), { ...valores, horario: "25:00" });
    expect(m.prepararReserva).not.toHaveBeenCalled();
    const novos = novosAnuncios(antes, anuncios(tela()));
    expect(novos.alerta).toHaveLength(1);
    expect(novos.status).toEqual([]);
  });
});

describe("DecidirResolucao", () => {
  const tela = () => m.ganchos!.renderizar(DecidirResolucao, { propostaId: "proposta", podeAprovar: true });
  const digitarMotivo = () => {
    const campo = elementos(tela()).find((n) => n.type === CampoTexto);
    (campo!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "Prazo conferido com a família." } });
  };
  const clicarEm = (rotulo: string) => (botao(tela(), rotulo).props.onClick as () => unknown)();

  contratoFeedbackSeparado({
    nome: "aprovar e aplicar a resolução", preparar: digitarMotivo, tela, action: m.decidirReserva,
    acionar: () => clicarEm("Aprovar e aplicar"),
    sucesso: "Proposta aprovada e aplicada.",
    // A decisão conserva a própria mensagem de incerteza (reenviar a mesma decisão).
    incerto: MSG_DECISAO_INCERTA,
    ocupado: () => botao(tela(), "Aprovar e aplicar").props.disabled === true && botao(tela(), "Rejeitar proposta").props.disabled === true,
  });

  it("rejeitar envia aprovar=false com o motivo digitado e anuncia a rejeição", async () => {
    digitarMotivo();
    const antes = anuncios(tela());
    m.decidirReserva.mockResolvedValueOnce({ ok: true });
    await clicarEm("Rejeitar proposta");
    expect(m.decidirReserva).toHaveBeenCalledWith({ propostaId: "proposta", aprovar: false, motivo: "Prazo conferido com a família." });
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [], status: ["Proposta rejeitada."] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
