import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  pedido: vi.fn(), efetivar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/matricula/desistencia-preparacao", () => ({ registrarPedidoDesistenciaPreparacao: m.pedido }));
vi.mock("@/server/matricula/desistencia-efetivacao", () => ({ efetivarPedidoDesistenciaPreparacao: m.efetivar }));

import { PedidoFormulario } from "./PedidoFormulario";
import { EfetivacaoFormulario } from "./EfetivacaoFormulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const rotuloDoBotao = (t: ReactNode) => texto(elementos(t).find((n) => n.type === "button")?.props.children);

describe("PedidoFormulario", () => {
  const tela = () => m.ganchos!.renderizar(PedidoFormulario, { matriculaId: "matricula-1", estadoHash: "hash-1" });
  const valores = { motivo: "Cliente mudou de cidade", evidenciaPedido: "E-mail do cliente em 01/10/2026 às 10h" };
  contratoFeedbackSeparado({
    nome: "registrar pedido de desistência", tela, action: m.pedido,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "pedido-1", versao: 1 } },
    sucesso: "Pedido registrado para tratamento pela equipe.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => rotuloDoBotao(tela()) === "Registrando…",
  });

  it("reenvio depois de falha de rede usa a mesma chave de idempotência; sucesso trava o formulário e atualiza a tela", async () => {
    m.pedido.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "pedido-1", versao: 1 } });
    await submeter(tela(), valores);
    await submeter(tela(), valores);
    const [primeira, segunda] = m.pedido.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(primeira).toBeTruthy();
    expect(segunda).toBe(primeira);
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(elementos(tela()).find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
  });
});

describe("EfetivacaoFormulario", () => {
  const tela = () => m.ganchos!.renderizar(EfetivacaoFormulario, { pedidoId: "pedido-1", estadoHash: "hash-1" });
  const valores = { motivo: "Conferi a solicitação por e-mail e o extrato.", conferencia: "confirmada" };
  contratoFeedbackSeparado({
    nome: "efetivar desistência", tela, action: m.efetivar,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "pedido-1", matriculaId: "matricula-1", status: "CANCELADA" } },
    sucesso: "Desistência efetivada. As reservas disponíveis desta contratação foram liberadas.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => rotuloDoBotao(tela()) === "Efetivando…",
  });

  it("sem a conferência marcada, não chama a action", async () => {
    await submeter(tela(), { motivo: valores.motivo });
    expect(m.efetivar).not.toHaveBeenCalled();
  });
});
