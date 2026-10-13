import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3; achado L1219): a decisão da alteração de
// quantidade de aulas anuncia o sucesso em role="status" e atualiza a tela com router.refresh — nunca
// window.location.reload —, com o erro em role="alert", a falha de rede como resultado incerto e os botões
// saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
// Aprovar passa pelo ConfirmarAcao (docs/42 L1218; fatia B, issue #169): o erro e o incerto da aprovação
// ficam DENTRO do diálogo (DecidirQuantidadeAulas.confirmacao.test.ts); aqui fica o anúncio do sucesso na
// tela depois da confirmação, e o contrato inteiro do rejeitar, que continua direto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), refresh: vi.fn(), reload: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("@/server/agenda/modalidade-quantidade", () => ({ decidirAlteracaoQuantidadeAulasModalidade: m.decidir }));

import { DecidirQuantidadeAulas } from "./DecidirQuantidadeAulas";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { botao, clicar, criarGanchos, elementos, type No } from "@/test/tela-sem-dom";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  // Rede de segurança: se a tela voltasse a recarregar a página, o teste veria a chamada.
  vi.stubGlobal("window", { location: { reload: m.reload } });
});
afterEach(() => { vi.unstubAllGlobals(); });

const RESUMO = { modalidade: "Inglês regular", quantidadeAnterior: 40, quantidadeNova: 44, turmas: 6 };
const tela = () => m.ganchos!.renderizar(DecidirQuantidadeAulas, { propostaId: "proposta-1", resumo: RESUMO });
const confirmacao = (): No | undefined => elementos(tela()).find((n: No) => n.type === ConfirmarAcao);
const MOTIVO = "Conferi o impacto nas turmas";
/** Preenche o motivo (campo controlado): os botões só habilitam com 5 caracteres ou mais. */
const preencherMotivo = () => {
  const campo = elementos(tela()).find((n) => n.type === "input");
  (campo!.props.onChange as (e: unknown) => void)({ target: { value: MOTIVO } });
};
const ocupado = () => botao(tela(), "Aprovar e aplicar").props.disabled === true && botao(tela(), "Rejeitar").props.disabled === true;

describe("DecidirQuantidadeAulas", () => {
  contratoFeedbackSeparado({
    nome: "rejeitar a proposta", tela, action: m.decidir, preparar: preencherMotivo,
    acionar: () => clicar(tela(), "Rejeitar"),
    respostaOk: { ok: true, dado: { id: "decisao-1", aprovada: false, aplicada: false } },
    sucesso: "Proposta rejeitada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado,
  });

  it("aprovar: o sucesso da confirmação sai em role=\"status\" e chama router.refresh, nunca window.location.reload", async () => {
    preencherMotivo();
    clicar(tela(), "Aprovar e aplicar");
    expect(m.decidir).not.toHaveBeenCalled();
    const c = confirmacao()!;
    m.decidir.mockResolvedValueOnce({ ok: true, dado: { id: "decisao-1", aprovada: true, aplicada: true } });
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.decidir).toHaveBeenLastCalledWith({ propostaId: "proposta-1", aprovar: true, motivo: MOTIVO });
    (c.props.aoConcluir as () => void)();
    expect(confirmacao()).toBeUndefined();
    expect(m.refresh).toHaveBeenCalledTimes(1);
    expect(m.reload).not.toHaveBeenCalled();
    expect(anuncios(tela())).toEqual({ alerta: [], status: ["Alteração aprovada e aplicada."] });
  });

  it("sem motivo suficiente, os botões ficam desabilitados", () => {
    expect(botao(tela(), "Aprovar e aplicar").props.disabled).toBe(true);
    expect(botao(tela(), "Rejeitar").props.disabled).toBe(true);
  });
});
