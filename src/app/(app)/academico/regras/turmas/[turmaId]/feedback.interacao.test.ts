import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na proposta e na
// decisão de migração da regra da turma — erro em role="alert", sucesso em role="status", falha de rede
// como resultado incerto e o formulário saindo do ocupado. Sem DOM: ganchos de src/test/tela-sem-dom.ts.
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
vi.mock("@/server/avaliacoes/migracao-regra", () => ({ proporMigracaoRegra: m.propor, decidirMigracaoRegra: m.decidir }));

import type { ReactNode } from "react";
import { ProporMigracao, DecidirMigracao } from "./Formularios";
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

describe("ProporMigracao", () => {
  const tela = () => m.ganchos!.renderizar(ProporMigracao, { turmaId: "turma", destinoId: "destino", estadoHash: "a".repeat(64), versaoEsperada: 1 });
  const enviar = () => submeter(tela(), { motivo: "Migrar para a versão 2." });

  contratoFeedbackSeparado({
    nome: "registrar proposta de migração", tela, action: m.propor, acionar: enviar,
    sucesso: "Proposta registrada. Outra pessoa autorizada poderá conferir e decidir.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => ocupadoEm(tela()),
  });

  it("reenvia a mesma chave depois da falha; alterar o formulário limpa a mensagem e troca a chave", async () => {
    m.propor.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await enviar();
    expect(anuncios(tela()).alerta).toEqual([MSG_RESULTADO_INCERTO]);
    m.propor.mockResolvedValueOnce({ ok: false, erro: "Recusada." });
    await enviar();
    const chaves = () => m.propor.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(chaves()[1]).toBe(chaves()[0]);
    expect(m.propor.mock.calls[0][0]).toMatchObject({ turmaId: "turma", destinoId: "destino", versaoEsperada: 1, motivo: "Migrar para a versão 2." });

    (formularios(tela())[0].props.onChange as () => void)();
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
    m.propor.mockResolvedValueOnce({ ok: true });
    await enviar();
    expect(chaves()[2]).not.toBe(chaves()[0]);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("DecidirMigracao", () => {
  const tela = () => m.ganchos!.renderizar(DecidirMigracao, { propostaId: "proposta", estadoHash: "b".repeat(64), podeAprovar: true });
  const decidir = (decisao: string) => submeter(tela(), { decisao, motivo: "Conferida." });

  contratoFeedbackSeparado({
    nome: "aprovar migração", tela, action: m.decidir, acionar: () => decidir("aprovar"),
    respostaOk: { ok: true, dado: { aplicada: true } },
    sucesso: "Mudança aprovada e aplicada.", incerto: MSG_DECISAO_INCERTA,
    ocupado: () => ocupadoEm(tela()),
  });

  it("rejeição registrada sai em role=\"status\" e faz refresh", async () => {
    m.decidir.mockResolvedValueOnce({ ok: true, dado: { aplicada: false } });
    await decidir("rejeitar");
    expect(m.decidir).toHaveBeenCalledWith({ propostaId: "proposta", estadoHash: "b".repeat(64), aprovada: false, motivo: "Conferida." });
    expect(anuncios(tela())).toEqual({ alerta: [], status: ["Proposta rejeitada."] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
