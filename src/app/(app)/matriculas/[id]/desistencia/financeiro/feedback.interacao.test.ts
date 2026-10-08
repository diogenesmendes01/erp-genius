import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na proposta e na
// decisão do cancelamento financeiro da desistência (Formularios.tsx) — erro em role="alert", sucesso em
// role="status", falha de rede como resultado incerto e o botão saindo do ocupado.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  propor: vi.fn(), decidir: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/matricula/desistencia-financeira", () => ({
  proporCancelamentoFinanceiroDesistenciaPreparacao: m.propor,
  decidirCancelamentoFinanceiroDesistenciaPreparacao: m.decidir,
}));

import { PropostaFormulario, DecisaoFormulario } from "./Formularios";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** O rótulo de progresso do botão (o fieldset também trava depois do sucesso, por isso não serve aqui). */
const registrando = (t: ReactNode) => texto(elementos(t).find((n) => n.type === "button")?.props.children) === "Registrando…";

describe("PropostaFormulario", () => {
  const tela = () => m.ganchos!.renderizar(PropostaFormulario, { pedidoId: "pedido-1", estadoHash: "hash-1" });
  const valores = { motivo: "Cliente desistiu antes do início.", evidencia: "Nenhuma aula dada e nenhum pagamento recebido." };
  contratoFeedbackSeparado({
    nome: "submeter proposta financeira", tela, action: m.propor,
    acionar: () => submeter(tela(), valores),
    sucesso: "Proposta registrada. Outra pessoa autorizada deve decidir.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => registrando(tela()),
  });

  it("reenvio depois de falha de rede usa a mesma chave de idempotência", async () => {
    m.propor.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true });
    await submeter(tela(), valores);
    await submeter(tela(), valores);
    const [primeira, segunda] = m.propor.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(primeira).toBeTruthy();
    expect(segunda).toBe(primeira);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("DecisaoFormulario (cancelamento financeiro)", () => {
  const tela = () => m.ganchos!.renderizar(DecisaoFormulario, { propostaId: "proposta-1", propostaHash: "hash-p", podeAprovar: true });
  contratoFeedbackSeparado({
    nome: "registrar decisão independente", tela, action: m.decidir,
    acionar: () => submeter(tela(), { decisao: "aprovar", motivo: "Condições conferidas no contrato." }),
    sucesso: "Decisão registrada. A Secretaria efetiva a desistência após nova conferência.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => registrando(tela()),
  });
});
