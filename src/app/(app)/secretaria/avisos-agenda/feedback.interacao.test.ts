import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(), reconferir: vi.fn(),
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
vi.mock("@/server/comunicacoes-agenda/reconferencia", () => ({ reconferirPendenciaAvisoAgenda: m.reconferir }));

import { ReconferirPendencia } from "./ReconferirPendencia";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const tela = () => m.ganchos!.renderizar(ReconferirPendencia, { pendenciaId: "pendencia" });
const botaoEnvio = () => elementos(tela()).find((n) => n.type === "button");
const digitar = (valor: string) => {
  const campo = elementos(tela()).find((n) => n.type === CampoTexto);
  (campo!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: valor } });
};

describe("ReconferirPendencia", () => {
  const explicacao = "Pendência encerrada pela reconferência.";
  contratoFeedbackSeparado({
    nome: "reconferir pendência", tela, action: m.reconferir,
    respostaOk: { ok: true, dado: { resolvida: true, explicacao } },
    acionar: () => submeter(tela()),
    sucesso: explicacao, incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => texto(botaoEnvio()?.props.children) === "Reconferindo…" && botaoEnvio()?.props.disabled === true,
  });

  it("envia o motivo digitado e só atualiza a página quando a pendência foi resolvida", async () => {
    digitar("Matrícula reativada pela secretaria.");
    m.reconferir.mockResolvedValueOnce({ ok: true, dado: { resolvida: false, explicacao: "A matrícula não está ativa para reconferir o aviso." } });
    const antes = anuncios(tela());
    await submeter(tela());
    expect(m.reconferir).toHaveBeenCalledWith({ pendenciaId: "pendencia", motivo: "Matrícula reativada pela secretaria." });
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: [], status: ["A matrícula não está ativa para reconferir o aviso."] });
    expect(m.refresh).not.toHaveBeenCalled();
    m.reconferir.mockResolvedValueOnce({ ok: true, dado: { resolvida: true, explicacao } });
    await submeter(tela());
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("resposta sem dado sai como erro, não como explicação", async () => {
    m.reconferir.mockResolvedValueOnce({ ok: true });
    await submeter(tela());
    expect(anuncios(tela())).toEqual({ alerta: ["Não foi possível reconferir a pendência."], status: [] });
  });
});
