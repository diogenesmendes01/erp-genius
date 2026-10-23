import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Preparar a troca de e-mail do portal com chave de idempotência (#166; #282, C3): o reenvio da mesma tentativa
// devolve a solicitação original na situação atual. Se outra pessoa já a decidiu, a tela não anuncia uma validação
// nova: avisa que a solicitação já foi decidida e mantém os dados para uma nova solicitação deliberada.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  preparar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
    useId: (() => g().useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/portal-aluno/actions", () => ({ decidirTrocaEmailPortalAluno: vi.fn(), prepararConvitePortalAluno: vi.fn(), prepararTrocaEmailPortalAluno: m.preparar }));

import { PainelAcessoPortalAluno } from "./painel";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { FormDataFalso, criarGanchos, elementos, formularioFalso, formularios, type No } from "@/test/tela-sem-dom";

const VALORES = { novoEmail: "novo@example.test", motivo: "Aluno perdeu o acesso", evidencia: "Documento conferido" };
const tela = (): ReactNode => m.ganchos!.renderizar(PainelAcessoPortalAluno, {
  alunoId: "aluno-1", emailCadastro: "antigo@example.test", conta: { emailVerificado: "antigo@example.test", temSenha: true, ativa: true },
  trocas: [], podeDecidir: false, preferenciaFusoExibicao: null,
});
const sucesso = (t: ReactNode) => elementos(t).filter((n: No) => n.type === FeedbackAcao).map((n: No) => n.props.sucesso).filter(Boolean);
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

/** Submete o formulário da troca (o primeiro da tela); devolve quantas vezes ele foi limpo. */
async function preparar(): Promise<number> {
  let resets = 0;
  const falso = { ...formularioFalso(VALORES), reset() { resets++; } };
  const [troca] = formularios(tela());
  await (troca.props.onSubmit as (e: unknown) => Promise<unknown>)({ preventDefault() {}, currentTarget: falso, target: falso });
  await esvaziar();
  return resets;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Painel do portal — preparar a troca de e-mail", () => {
  it("solicitação nova: anuncia a validação, limpa o formulário e recarrega", async () => {
    m.preparar.mockResolvedValueOnce({ ok: true, dado: { solicitacaoId: "t-1", solicitacaoEnvioId: "e-1", situacao: "PENDENTE_VALIDACAO" } });
    expect(await preparar()).toBe(1);
    expect(m.preparar).toHaveBeenCalledWith(expect.objectContaining({ alunoId: "aluno-1", ...VALORES, chaveIdempotencia: expect.any(String) }));
    expect(sucesso(tela())).toEqual(["Validação do novo endereço preparada. Uma pessoa diferente da Administração decide depois da validação."]);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["REJEITADA", "rejeitada"],
    ["APROVADA_APLICADA", "aprovada e aplicada"],
    ["CANCELADA", "cancelada"],
  ])("reenvio de solicitação já decidida (%s): avisa, não anuncia validação e mantém os dados", async (situacao, rotulo) => {
    m.preparar.mockResolvedValueOnce({ ok: true, dado: { solicitacaoId: "t-1", solicitacaoEnvioId: "e-1", situacao } });
    expect(await preparar()).toBe(0);
    expect(sucesso(tela())).toEqual([`Esta solicitação já foi decidida: ${rotulo}. Para uma nova troca, faça uma nova solicitação.`]);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("depois do aviso, um novo envio é outra tentativa (chave nova)", async () => {
    m.preparar.mockResolvedValueOnce({ ok: true, dado: { solicitacaoId: "t-1", solicitacaoEnvioId: "e-1", situacao: "REJEITADA" } });
    await preparar();
    m.preparar.mockResolvedValueOnce({ ok: true, dado: { solicitacaoId: "t-2", solicitacaoEnvioId: "e-2", situacao: "PENDENTE_VALIDACAO" } });
    await preparar();
    const [primeira, segunda] = m.preparar.mock.calls.map(([input]) => (input as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(segunda).not.toBe(primeira);
    expect(sucesso(tela())).toEqual(["Validação do novo endereço preparada. Uma pessoa diferente da Administração decide depois da validação."]);
  });

  it("reenvio de solicitação já validada e aguardando decisão: diz que está em andamento", async () => {
    m.preparar.mockResolvedValueOnce({ ok: true, dado: { solicitacaoId: "t-1", solicitacaoEnvioId: "e-1", situacao: "PENDENTE_DECISAO" } });
    expect(await preparar()).toBe(1);
    expect(sucesso(tela())).toEqual(["Esta solicitação já está em andamento: o novo endereço foi confirmado e aguarda a decisão da Administração."]);
  });
});
