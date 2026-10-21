import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na decisão e na
// execução da equivalência — cada formulário com o próprio feedback (erro em role="alert", sucesso em
// role="status"), falha de rede como resultado incerto e o formulário saindo do ocupado. Sem DOM:
// ganchos de src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  decidir: vi.fn(), executar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/avaliacoes/equivalencia-decisao", () => ({ decidirEquivalenciaTransferencia: m.decidir }));
vi.mock("@/server/avaliacoes/equivalencia-execucao", () => ({ executarEquivalenciaTransferencia: m.executar }));

import type { ReactNode } from "react";
import { AcoesEquivalencia } from "./AcoesEquivalencia";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const props: Parameters<typeof AcoesEquivalencia>[0] = { propostaId: "proposta", estadoHash: "a".repeat(64), podeDecidir: true, decisaoId: "decisao", podeExecutar: true };
const tela = (p: Partial<typeof props> = {}) => m.ganchos!.renderizar(AcoesEquivalencia, { ...props, ...p });
const botoes = (t: ReactNode) => elementos(t).filter((n) => n.type === "button");
/** O botão do formulário (0 = decisão, 1 = execução) mostra o rótulo de progresso e está travado. */
const ocupadoEm = (indice: number, rotulo: string) => {
  const b = botoes(tela())[indice];
  return texto(b.props.children) === rotulo && b.props.disabled === true;
};
const decidir = (decisao = "APROVAR") => submeter(tela(), { decisao, motivo: "Mapeamento conferido." }, 0);
const executar = () => submeter(tela(), { motivoExecucao: "Horário confirmado." }, 1);

describe("AcoesEquivalencia: decisão", () => {
  contratoFeedbackSeparado({
    nome: "registrar decisão", tela: () => tela(), action: m.decidir, acionar: () => decidir(),
    respostaOk: { ok: true, dado: { aprovada: true } },
    sucesso: "Decisão registrada. A execução continua como uma etapa separada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => ocupadoEm(0, "Registrando…"),
  });

  it("rejeição registrada sai em role=\"status\" e faz refresh", async () => {
    m.decidir.mockResolvedValueOnce({ ok: true, dado: { aprovada: false } });
    await decidir("REJEITAR");
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta", estadoHash: "a".repeat(64), aprovar: false, motivo: "Mapeamento conferido." });
    expect(anuncios(tela())).toEqual({ alerta: [], status: ["Proposta rejeitada e preservada no histórico."] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("sem conferência preservada, recusa localmente em role=\"alert\" sem chamar a action", async () => {
    await submeter(tela({ estadoHash: null }), { decisao: "APROVAR", motivo: "x" }, 0);
    expect(m.decidir).not.toHaveBeenCalled();
    expect(anuncios(tela({ estadoHash: null })).alerta).toEqual(["A conferência preservada desta proposta não está disponível para decisão."]);
  });

  it("o resultado continua visível depois do refresh, quando o formulário de decisão some", async () => {
    m.decidir.mockResolvedValueOnce({ ok: true, dado: { aprovada: true } });
    await decidir();
    expect(anuncios(tela({ podeDecidir: false })).status).toEqual(["Decisão registrada. A execução continua como uma etapa separada."]);
  });
});

describe("AcoesEquivalencia: execução", () => {
  contratoFeedbackSeparado({
    nome: "efetivar transferência", tela: () => tela(), action: m.executar, acionar: executar,
    sucesso: "Transferência efetivada. A matrícula agora está vinculada à turma de destino.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => ocupadoEm(1, "Efetivando…"),
  });

  it("uma ação em curso trava os dois formulários; cada resultado sai junto do próprio formulário", async () => {
    let concluir!: (v: unknown) => void;
    m.executar.mockReturnValueOnce(new Promise((res) => { concluir = res; }));
    const execucao = executar();
    const [botaoDecidir, botaoExecutar] = botoes(tela());
    expect(botaoDecidir.props.disabled).toBe(true);
    expect(texto(botaoDecidir.props.children)).toBe("Registrar decisão");
    expect(texto(botaoExecutar.props.children)).toBe("Efetivando…");
    concluir({ ok: false, erro: "Sem vaga na turma de destino." });
    await execucao;
    expect(botoes(tela()).every((b) => b.props.disabled === false)).toBe(true);
    // Dois FeedbackAcao: o primeiro (decisão) sem nada; o segundo (execução) com o erro.
    const feedbacks = elementos(tela()).filter((n) => n.type === FeedbackAcao);
    expect(feedbacks.map((f) => f.props.erro)).toEqual([null, "Sem vaga na turma de destino."]);
    expect(m.refresh).not.toHaveBeenCalled();
  });
});
