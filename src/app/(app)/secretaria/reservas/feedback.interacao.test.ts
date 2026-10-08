import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): a conferência de vencimento da reserva punha
// erro e "Resultado não confirmado…" no mesmo MensagemStatus do resultado. Agora: erro e incerteza em
// role="alert", resultado da conferência em role="status", e o botão saindo do ocupado.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(), conferir: vi.fn(), conferirParticular: vi.fn(),
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
vi.mock("@/server/matricula/reserva-painel", () => ({ conferirReservaSecretaria: m.conferir, conferirReservaParticularSecretaria: m.conferirParticular }));

import { ConferirReserva } from "./ConferirReserva";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { botao, clicar, criarGanchos, temBotao } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

const ocupadoEm = (tela: () => ReactNode) => () => temBotao(tela(), "Conferindo…") && botao(tela(), "Conferindo…").props.disabled === true;

describe("ConferirReserva", () => {
  const tela = () => m.ganchos!.renderizar(ConferirReserva, { reservaId: "reserva" });
  contratoFeedbackSeparado({
    nome: "conferir vencimento da reserva", tela, action: m.conferir,
    respostaOk: { ok: true, dado: { reservaId: "reserva", status: "ATIVA", resultado: "PRAZO_VIGENTE" } },
    acionar: () => clicar(tela(), "Conferir vencimento"),
    sucesso: "O prazo da reserva ainda está vigente.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE, ocupado: ocupadoEm(tela),
  });

  it("resposta sem resultado: a incerteza sai em alerta e a página não é atualizada", async () => {
    m.conferir.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Conferir vencimento");
    expect(anuncios(tela())).toEqual({ alerta: ["Resultado não confirmado. Atualize a página para ver o estado atual da reserva."], status: [] });
    expect(m.refresh).not.toHaveBeenCalled();
  });
});

describe("ConferirReserva (particular)", () => {
  const tela = () => m.ganchos!.renderizar(ConferirReserva, { reservaId: "reserva", particular: true });
  contratoFeedbackSeparado({
    nome: "conferir vencimento da reserva particular", tela, action: m.conferirParticular,
    respostaOk: { ok: true, dado: { reservaId: "reserva", status: "EXPIRADA", resultado: "HORARIOS_LIBERADOS" } },
    acionar: () => clicar(tela(), "Conferir vencimento"),
    sucesso: "Reserva expirada; horários liberados. A preparação permanece pendente de nova reserva.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE, ocupado: ocupadoEm(tela),
  });

  it("chama só a conferência particular", async () => {
    m.conferirParticular.mockResolvedValueOnce({ ok: true, dado: { resultado: "SEM_TRANSICAO" } });
    await clicar(tela(), "Conferir vencimento");
    expect(m.conferirParticular).toHaveBeenCalledWith({ reservaId: "reserva" });
    expect(m.conferir).not.toHaveBeenCalled();
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
