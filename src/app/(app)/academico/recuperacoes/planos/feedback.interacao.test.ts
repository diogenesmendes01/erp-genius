import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na autorização de
// preparação especial — erro em role="alert", sucesso em role="status", falha de rede como resultado
// incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  autorizar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/recuperacao-autorizacao-preparacao-local", () => ({ autorizarPreparacaoEspecialLocal: m.autorizar }));

import { AutorizarPreparacao } from "./AutorizarPreparacao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** "Autorizando…" no botão e o fieldset travado: os dois sinais do ocupado. */
const ocupadoEm = (t: ReactNode) => {
  const botao = elementos(t).find((n) => n.type === "button");
  const fieldset = elementos(t).find((n) => n.type === "fieldset");
  return texto(botao?.props.children) === "Autorizando…" && fieldset?.props.disabled === true;
};

describe("AutorizarPreparacao", () => {
  const tela = () => m.ganchos!.renderizar(AutorizarPreparacao, { alocacaoId: "alocacao-1", fusoInstitucional: "America/Sao_Paulo" });
  const valores = { motivo: "Aluno com atestado médico", prazoLocal: "2026-10-20T18:00:00", fuso: "America/Sao_Paulo" };
  contratoFeedbackSeparado({
    nome: "autorizar preparação especial", tela, action: m.autorizar,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "autorizacao-1" } },
    sucesso: "Preparação especial autorizada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela()),
  });

  it("reenvio depois de falha de rede usa a mesma chave; o sucesso atualiza a tela com router.refresh", async () => {
    m.autorizar.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "autorizacao-1" } });
    await submeter(tela(), valores);
    expect(m.refresh).not.toHaveBeenCalled();
    await submeter(tela(), valores);
    const [primeira, segunda] = m.autorizar.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(primeira).toBeTruthy();
    expect(segunda).toBe(primeira);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
