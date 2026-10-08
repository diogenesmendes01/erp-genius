import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): registrar e revogar autorização de comunicação
// mostravam sucesso e erro no mesmo MensagemStatus. Agora cada fluxo tem o seu feedback junto do próprio
// botão: erro em role="alert", sucesso em role="status", falha de rede como resultado incerto.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  registrar: vi.fn(), revogar: vi.fn(), refresh: vi.fn(),
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
vi.mock("@/server/comunicacoes-agenda/autorizacoes", () => ({
  registrarAutorizacaoComunicacaoAcademica: m.registrar,
  revogarAutorizacaoComunicacaoAcademica: m.revogar,
}));

import { AutorizacoesFormulario } from "./AutorizacoesFormulario";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";
import type { ReactNode } from "react";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const historico = [
  { id: "aut-1", responsavelId: "resp-1", evidencia: "Termo assinado em 01/09/2026", vigenteEm: "2026-09-01T12:00:00.000Z", revogadaEm: null, motivoRevogacao: null, responsavel: { nome: "Maria" }, autorizadaPor: { nome: "Secretaria" }, revogadaPor: null },
  { id: "aut-2", responsavelId: "resp-2", evidencia: "E-mail do responsável", vigenteEm: "2026-09-02T12:00:00.000Z", revogadaEm: null, motivoRevogacao: null, responsavel: { nome: "José" }, autorizadaPor: { nome: "Secretaria" }, revogadaPor: null },
];
const tela = () => m.ganchos!.renderizar(AutorizacoesFormulario, { matriculaId: "matricula-1", responsaveis: [{ id: "resp-1", nome: "Maria" }], historico });
const botoes = (t: ReactNode) => elementos(t).filter((n) => n.type === "button");
/** Os cartões do histórico (<article>), como nós da árvore para percorrer à parte. */
const artigos = (t: ReactNode) => elementos(t).filter((n) => n.type === "article") as unknown as ReactNode[];

describe("AutorizacoesFormulario — registrar", () => {
  contratoFeedbackSeparado({
    nome: "registrar autorização", tela, action: m.registrar,
    acionar: () => submeter(tela(), { responsavelId: "resp-1", evidencia: "Termo assinado pelo responsável" }, 0),
    respostaOk: { ok: true, dado: { id: "aut-3" } },
    sucesso: "Autorização registrada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => { const b = botoes(tela())[0]; return texto(b?.props.children) === "Registrando…" && b?.props.disabled === true; },
  });
});

describe("AutorizacoesFormulario — revogar", () => {
  contratoFeedbackSeparado({
    nome: "revogar autorização", tela, action: m.revogar,
    acionar: () => submeter(tela(), { motivo: "Responsável pediu a revogação" }, 1),
    sucesso: "Revogação registrada no histórico.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    // O botão "Revogar autorização" não troca de rótulo: o sinal é ele (e o do registro) travados.
    ocupado: () => botoes(tela()).every((b) => b.props.disabled === true),
  });

  it("o resultado aparece no cartão da autorização revogada, não nos outros; sucesso atualiza a tela", async () => {
    m.revogar.mockResolvedValueOnce({ ok: false, erro: "Motivo insuficiente." });
    await submeter(tela(), { motivo: "Pedido do responsável" }, 2);
    expect(m.revogar).toHaveBeenCalledWith({ id: "aut-2", motivoRevogacao: "Pedido do responsável" });
    const [primeiro, segundo] = artigos(tela());
    expect(elementos(primeiro).some((n) => n.type === FeedbackAcao)).toBe(false);
    expect(anuncios(segundo).alerta).toEqual(["Motivo insuficiente."]);

    m.revogar.mockResolvedValueOnce({ ok: true });
    await submeter(tela(), { motivo: "Pedido do responsável por escrito" }, 2);
    expect(anuncios(artigos(tela())[1])).toEqual({ alerta: [], status: ["Revogação registrada no histórico."] });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("registrar depois de uma revogação limpa o resultado da revogação", async () => {
    m.revogar.mockResolvedValueOnce({ ok: false, erro: "Motivo insuficiente." });
    await submeter(tela(), { motivo: "Pedido do responsável" }, 1);
    m.registrar.mockResolvedValueOnce({ ok: true, dado: { id: "aut-3" } });
    await submeter(tela(), { responsavelId: "resp-1", evidencia: "Termo assinado pelo responsável" }, 0);
    expect(anuncios(tela())).toEqual({ alerta: [], status: ["Autorização registrada."] });
  });
});
