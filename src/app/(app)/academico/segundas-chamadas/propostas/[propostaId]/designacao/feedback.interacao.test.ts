import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na designação de
// professor da segunda chamada — erro em role="alert", sucesso em role="status", falha de rede como
// resultado incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts
// (useInicioDoPeriodo usa só useState/useRef/useCallback, simulados aqui).
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  designar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/segunda-chamada-designacao-local", () => ({ designarProfessorSegundaChamadaLocal: m.designar }));

import { Formulario } from "./Formulario";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** "Designando…" no botão e o fieldset travado: os dois sinais do ocupado. */
const ocupadoEm = (t: ReactNode) => {
  const botao = elementos(t).find((n) => n.type === "button");
  const fieldset = elementos(t).find((n) => n.type === "fieldset");
  return texto(botao?.props.children) === "Designando…" && fieldset?.props.disabled === true;
};

describe("Formulario de designação de professor (segunda chamada)", () => {
  const tela = () => m.ganchos!.renderizar(Formulario, { propostaId: "proposta-1", professores: [{ id: "prof-1", nome: "Ana" }], fusoInstitucional: "America/Sao_Paulo" });
  const valores = { professorId: "prof-1", inicio: "2026-10-01T08:00:00.000", fim: "", fuso: "America/Sao_Paulo", motivo: "Professora titular da turma" };
  contratoFeedbackSeparado({
    nome: "designar professor", tela, action: m.designar,
    acionar: () => submeter(tela(), valores),
    respostaOk: { ok: true, dado: { id: "designacao-1" } },
    sucesso: "Professor designado.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela()),
  });

  it("reenvio depois de falha de rede usa a mesma chave; o sucesso chama router.refresh", async () => {
    m.designar.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ ok: true, dado: { id: "designacao-1" } });
    await submeter(tela(), valores);
    await submeter(tela(), valores);
    const [primeira, segunda] = m.designar.mock.calls.map((c) => c[0] as { chaveIdempotencia: string; fimLocal?: string });
    expect(primeira.fimLocal).toBeUndefined();
    expect(primeira.chaveIdempotencia).toBeTruthy();
    expect(segunda.chaveIdempotencia).toBe(primeira.chaveIdempotencia);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
