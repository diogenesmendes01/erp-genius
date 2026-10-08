import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na proposta e na
// decisão de correção de nota — erro em role="alert", sucesso em role="status", falha de rede como
// resultado incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
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
vi.mock("@/server/avaliacoes/correcao", () => ({ proporCorrecaoNota: m.propor, decidirCorrecaoNota: m.decidir }));

import type { ReactNode } from "react";
import { ProporCorrecao, DecidirCorrecao } from "./Formularios";
import { MSG_DECISAO_INCERTA, MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, formularios, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

/** "Registrando…" no botão e o fieldset travado: os dois sinais do ocupado destes formulários. */
const ocupadoEm = (t: ReactNode) => {
  const botao = elementos(t).find((n) => n.type === "button");
  const fieldset = elementos(t).find((n) => n.type === "fieldset");
  return texto(botao?.props.children) === "Registrando…" && fieldset?.props.disabled === true;
};

describe("ProporCorrecao", () => {
  const props = { lancamentoId: "lancamento", origemHash: "a".repeat(64), versaoEsperada: 2, notas: [{ habilidade: "FALA" as const, nota: "7.00", comentarioAluno: "Anterior" }] };
  const tela = () => m.ganchos!.renderizar(ProporCorrecao, props);
  const enviar = () => submeter(tela(), { "nota-FALA": "8,0", "comentario-FALA": "Melhoria", motivo: "Nota corrigida." });

  contratoFeedbackSeparado({
    nome: "registrar proposta de correção", tela, action: m.propor, acionar: enviar,
    sucesso: "Proposta registrada. As notas permanecem vigentes até aprovação independente.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela()),
  });

  it("reenvia a mesma chave depois da falha; alterar o formulário limpa a mensagem e troca a chave", async () => {
    m.propor.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await enviar();
    m.propor.mockResolvedValueOnce({ ok: false, erro: "Recusada." });
    await enviar();
    const chaves = () => m.propor.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(chaves()[1]).toBe(chaves()[0]);
    expect(m.propor.mock.calls[0][0]).toMatchObject({ lancamentoId: "lancamento", versaoEsperada: 2, motivo: "Nota corrigida.", notas: [{ habilidade: "FALA", nota: "8.0", comentarioAluno: "Melhoria" }] });
    expect(anuncios(tela()).alerta).toEqual(["Recusada."]);

    (formularios(tela())[0].props.onChange as () => void)();
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
    m.propor.mockResolvedValueOnce({ ok: true });
    await enviar();
    expect(chaves()[2]).not.toBe(chaves()[0]);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  // docs/43 §6 item 3: sem a versão na key, o formulário não remonta depois de registrar — a chave de
  // idempotência é trocada à mão no sucesso (a próxima proposta é outra tentativa) e a versão nova vem por prop.
  it("depois de registrar, a próxima proposta usa chave nova e a versão nova, sem remontar", async () => {
    m.propor.mockResolvedValue({ ok: true });
    await enviar();
    await submeter(m.ganchos!.renderizar(ProporCorrecao, { ...props, versaoEsperada: 3 }), { "nota-FALA": "8,5", "comentario-FALA": "Melhoria", motivo: "Outra correção." });
    const [a, b] = m.propor.mock.calls.map((c) => c[0] as { chaveIdempotencia: string; versaoEsperada: number });
    expect(b.chaveIdempotencia).not.toBe(a.chaveIdempotencia);
    expect([a.versaoEsperada, b.versaoEsperada]).toEqual([2, 3]);
  });
});

describe("DecidirCorrecao", () => {
  const tela = () => m.ganchos!.renderizar(DecidirCorrecao, { propostaId: "proposta", propostaHash: "b".repeat(64), impactosHash: "c".repeat(64), podeAprovar: true });
  const decidir = (decisao: string) => submeter(tela(), { decisao, motivo: "Conferida." });

  contratoFeedbackSeparado({
    nome: "aprovar correção", tela, action: m.decidir, acionar: () => decidir("aprovar"),
    respostaOk: { ok: true, dado: { aplicada: true } },
    sucesso: "Correção aprovada e aplicada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => ocupadoEm(tela()),
  });

  it("rejeição registrada sai em role=\"status\" e faz refresh", async () => {
    m.decidir.mockResolvedValueOnce({ ok: true, dado: { aplicada: false } });
    await decidir("rejeitar");
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta", propostaHash: "b".repeat(64), impactosHash: "c".repeat(64), aprovada: false, motivo: "Conferida." });
    expect(anuncios(tela())).toEqual({ alerta: [], status: ["Proposta rejeitada."] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
