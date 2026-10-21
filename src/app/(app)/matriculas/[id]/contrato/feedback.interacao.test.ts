import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42, E3): erro e sucesso separados na confirmação do
// aceite do original — erro em role="alert", sucesso em role="status", falha de rede como resultado
// incerto e o botão saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, aceite: vi.fn(), refresh: vi.fn() }));
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
vi.mock("@/server/contratos/aceite", () => ({ confirmarAceiteOriginal: m.aceite }));

import { ConferirAceite } from "./ConferirAceite";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("ConferirAceite", () => {
  const tela = () => m.ganchos!.renderizar(ConferirAceite, { matriculaId: "m", conclusaoId: "c", revisaoHash: "h" });
  const valores = { conferido: "on", motivo: "Original e assinaturas conferidos" };
  contratoFeedbackSeparado({
    nome: "confirmar aceite do original assinado", tela, action: m.aceite,
    acionar: () => submeter(tela(), valores),
    sucesso: "Aceite registrado. A ativação continua sujeita aos demais requisitos da matrícula.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => elementos(tela()).some((n) => n.type === "button" && texto(n.props.children) === "Registrando…" && n.props.disabled === true),
  });

  it("a repetição depois da falha usa a mesma chave; o sucesso atualiza a página", async () => {
    m.aceite.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submeter(tela(), valores);
    expect(m.refresh).not.toHaveBeenCalled();
    m.aceite.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), valores);
    expect(m.aceite.mock.calls[1][0].chaveIdempotencia).toBe(m.aceite.mock.calls[0][0].chaveIdempotencia);
    expect(m.refresh).toHaveBeenCalledOnce();
  });

  it("sem a confirmação da conferência: aviso em role=\"alert\" e nada vai ao servidor", async () => {
    const antes = anuncios(tela());
    await submeter(tela(), { motivo: valores.motivo });
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Confira os documentos e as condições antes de confirmar."], status: [] });
    expect(m.aceite).not.toHaveBeenCalled();
  });
});
