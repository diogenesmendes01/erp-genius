import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42, E3): erro e sucesso separados na decisão de
// alçada do aditivo — erro em role="alert", sucesso em role="status", falha de rede com a mensagem
// própria de decisão incerta e o botão saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, decidir: vi.fn(), refresh: vi.fn() }));
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
vi.mock("@/server/contratos/aditivo-alcadas", () => ({ decidirAlcadaAditivo: m.decidir }));

import { FormularioAlcada } from "./Formulario";
import { MSG_DECISAO_INCERTA } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("FormularioAlcada", () => {
  const tela = () => m.ganchos!.renderizar(FormularioAlcada, { matriculaId: "m", propostaId: "p", propostaHash: "h", alcada: "FINANCEIRA" as const });
  contratoFeedbackSeparado({
    nome: "registrar decisão da alçada", tela, action: m.decidir,
    acionar: () => submeter(tela(), { decisao: "aprovar", motivo: "Valores conferidos" }),
    sucesso: "Decisão de alçada registrada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => {
      const t = tela();
      const botao = elementos(t).find((n) => n.type === "button");
      const fieldset = elementos(t).find((n) => n.type === "fieldset");
      return texto(botao?.props.children) === "Registrando…" && botao?.props.disabled === true && fieldset?.props.disabled === true;
    },
  });

  it("sucesso atualiza a página; erro não", async () => {
    m.decidir.mockResolvedValueOnce({ ok: false, erro: "Alçada já decidida." });
    await submeter(tela(), { decisao: "rejeitar", motivo: "Valores divergentes" });
    expect(m.refresh).not.toHaveBeenCalled();
    m.decidir.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { decisao: "rejeitar", motivo: "Valores divergentes" });
    expect(m.refresh).toHaveBeenCalledOnce();
    expect(m.decidir).toHaveBeenLastCalledWith({ matriculaId: "m", propostaId: "p", propostaHash: "h", alcada: "FINANCEIRA", aprovada: false, motivo: "Valores divergentes" });
  });

  it("sem decisão escolhida: aviso em role=\"alert\" e nada vai ao servidor", async () => {
    const antes = anuncios(tela());
    await submeter(tela(), { motivo: "Valores conferidos" });
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Escolha uma decisão."], status: [] });
    expect(m.decidir).not.toHaveBeenCalled();
  });
});
