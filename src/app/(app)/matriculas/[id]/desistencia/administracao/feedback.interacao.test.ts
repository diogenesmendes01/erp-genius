import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (achado L776): a decisão administrativa da desistência
// mostrava sucesso e erro no mesmo MensagemStatus. Agora: erro em role="alert", sucesso em role="status",
// falha de rede com o texto fixo da decisão incerta (MSG_DECISAO_INCERTA) e o botão saindo do ocupado.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/matricula/desistencia-administrativa", () => ({ decidirDesistenciaAdministrativa: m.decidir }));

import { DecisaoFormulario } from "./DecisaoFormulario";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("DecisaoFormulario (administração da desistência)", () => {
  const tela = () => m.ganchos!.renderizar(DecisaoFormulario, { pedidoId: "pedido-1", estadoHash: "hash-1", podeAprovar: true });
  const valores = { decisao: "aprovar", motivo: "Pedido conferido com o cliente." };
  contratoFeedbackSeparado({
    nome: "registrar decisão administrativa", tela, action: m.decidir,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "decisao-1", aprovada: true, estadoHash: "hash-2" } },
    sucesso: "Decisão registrada. A efetivação ainda depende das conferências e dos tratamentos aplicáveis.", incerto: MSG_DECISAO_INCERTA,
    // O rótulo do botão é o sinal do ocupado (o fieldset também trava depois do sucesso).
    ocupado: () => texto(elementos(tela()).find((n) => n.type === "button")?.props.children) === "Registrando…",
  });

  it("envia a decisão escolhida; sucesso trava o formulário e atualiza a tela", async () => {
    m.decidir.mockResolvedValueOnce({ ok: true, dado: { id: "decisao-1", aprovada: false, estadoHash: "hash-2" } });
    await submeter(tela(), { decisao: "rejeitar", motivo: "Sem evidência do pedido." });
    expect(m.decidir).toHaveBeenCalledWith({ pedidoId: "pedido-1", estadoHash: "hash-1", aprovada: false, motivo: "Sem evidência do pedido." });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(elementos(tela()).find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
  });
});
