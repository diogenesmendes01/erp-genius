import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na autorização de
// pré-reserva especial e na reserva com autorização — erro em role="alert", sucesso em role="status",
// falha de rede como resultado incerto e o formulário saindo do ocupado. Sem DOM: ganchos de
// src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  autorizar: vi.fn(), reservar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/recuperacao-autorizacao-reserva-local", () => ({ autorizarReservaEspecialLocal: m.autorizar }));
vi.mock("@/server/avaliacoes/recuperacao-reserva", () => ({ reservarTentativaRecuperacao: m.reservar }));

import { AutorizarReservaEspecial, ReservarComAutorizacao } from "./Formulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** Rótulo de progresso no botão e o fieldset travado: os dois sinais do ocupado. */
const ocupadoEm = (t: ReactNode, rotulo: string) => {
  const botao = elementos(t).find((n) => n.type === "button");
  const fieldset = elementos(t).find((n) => n.type === "fieldset");
  return texto(botao?.props.children) === rotulo && fieldset?.props.disabled === true;
};

describe("AutorizarReservaEspecial", () => {
  const tela = () => m.ganchos!.renderizar(AutorizarReservaEspecial, { propostaId: "proposta-1", habilidades: ["FALA", "LEITURA"], fusoInstitucional: "America/Sao_Paulo" });
  const valores = { motivo: "Aluno com atestado médico", prazoLocal: "2026-10-20T18:00:00", fuso: "America/Sao_Paulo" };
  /** Escolhe a habilidade no select controlado (estado do componente) antes de enviar. */
  const escolherHabilidade = () => {
    const select = elementos(tela()).find((n) => n.type === "select");
    (select!.props.onChange as (e: unknown) => void)({ target: { value: "FALA" } });
  };
  contratoFeedbackSeparado({
    nome: "autorizar pré-reserva especial", tela, action: m.autorizar, preparar: escolherHabilidade,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "autorizacao-1" } },
    sucesso: "Pré-reserva especial autorizada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela(), "Autorizando…"),
  });

  it("envia a habilidade escolhida; reenvio depois de falha de rede usa a mesma chave; o sucesso chama router.refresh", async () => {
    escolherHabilidade();
    m.autorizar.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "autorizacao-1" } });
    await submeter(tela(), valores);
    await submeter(tela(), valores);
    const chamadas = m.autorizar.mock.calls.map((c) => c[0] as { habilidade: string; chaveIdempotencia: string });
    expect(chamadas[0].habilidade).toBe("FALA");
    expect(chamadas[0].chaveIdempotencia).toBeTruthy();
    expect(chamadas[1].chaveIdempotencia).toBe(chamadas[0].chaveIdempotencia);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("ReservarComAutorizacao", () => {
  const tela = () => m.ganchos!.renderizar(ReservarComAutorizacao, { propostaId: "proposta-1", propostaHash: "hash-1", autorizacaoId: "autorizacao-1", habilidade: "FALA" });
  const valores = { motivoReserva: "Reserva conforme autorização especial" };
  contratoFeedbackSeparado({
    nome: "reservar tentativa autorizada", tela, action: m.reservar,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "reserva-1" } },
    sucesso: "Tentativa reservada com a autorização especial.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela(), "Reservando…"),
  });

  it("reenvio depois de falha de rede usa a mesma chave; o sucesso chama router.refresh", async () => {
    m.reservar.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "reserva-1" } });
    await submeter(tela(), valores);
    await submeter(tela(), valores);
    const [primeira, segunda] = m.reservar.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(primeira).toBeTruthy();
    expect(segunda).toBe(primeira);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
