import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na designação do
// avaliador — erro em role="alert", sucesso em role="status", falha de rede como resultado incerto e o
// formulário saindo do ocupado (sem useTransition: o ocupado é o do executor). Sem DOM: ganchos de
// src/test/tela-sem-dom.ts.
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
vi.mock("@/server/avaliacoes/designacao", () => ({ designarAvaliador: m.designar }));

import { FormularioDesignacao } from "./Formulario";
import { CampoTexto } from "@/components/CampoTexto";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, submeter, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); vi.stubGlobal("FormData", FormDataFalso); });
afterEach(() => { vi.unstubAllGlobals(); });

const props = {
  alocacaoId: "alocacao", codigoAvaliacao: "final", versaoEsperada: 3, atualId: "prof-1",
  professores: [{ id: "prof-1", nome: "Ana" }, { id: "prof-2", nome: "Bia" }],
};
const tela = () => m.ganchos!.renderizar(FormularioDesignacao, props);
type AoMudar = (e: { target: { value: string } }) => void;

/** Escolhe o professor e o motivo (cada onChange numa leitura nova da tela). */
function escolher(professor = "prof-2", motivo = "Designação independente.") {
  (elementos(tela()).find((n) => n.type === "select")!.props.onChange as AoMudar)({ target: { value: professor } });
  (elementos(tela()).find((n) => n.type === CampoTexto)!.props.onChange as AoMudar)({ target: { value: motivo } });
}
const botao = () => elementos(tela()).find((n) => n.type === "button")!;
const fieldset = () => elementos(tela()).find((n) => n.type === "fieldset")!;

describe("FormularioDesignacao", () => {
  contratoFeedbackSeparado({
    nome: "registrar designação", preparar: () => escolher(), tela, action: m.designar,
    acionar: () => submeter(tela()),
    sucesso: "Designação registrada.", incerto: MSG_RESULTADO_INCERTO,
    ocupado: () => texto(botao().props.children) === "Registrando…" && fieldset().props.disabled === true,
  });

  it("reenvia a mesma chave depois da falha, troca a chave ao mudar a escolha e faz refresh só no sucesso", async () => {
    escolher();
    m.designar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submeter(tela());
    m.designar.mockResolvedValueOnce({ ok: false, erro: "Recusada." });
    await submeter(tela());
    const chaves = () => m.designar.mock.calls.map((c) => (c[0] as { chaveIdempotencia: string }).chaveIdempotencia);
    expect(chaves()[1]).toBe(chaves()[0]);
    expect(m.designar.mock.calls[0][0]).toMatchObject({ alocacaoId: "alocacao", codigoAvaliacao: "final", versaoEsperada: 3, professorId: "prof-2", motivo: "Designação independente." });
    expect(anuncios(tela()).alerta).toEqual(["Recusada."]);
    expect(m.refresh).not.toHaveBeenCalled();

    escolher("revogar", "Revogação conferida.");
    expect(texto(botao().props.children)).toBe("Revogar designação");
    m.designar.mockResolvedValueOnce({ ok: true });
    await submeter(tela());
    expect(chaves()[2]).not.toBe(chaves()[0]);
    expect(m.designar.mock.calls[2][0]).toMatchObject({ professorId: null, motivo: "Revogação conferida." });
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("sem professor escolhido não chama a action", async () => {
    await submeter(tela());
    expect(m.designar).not.toHaveBeenCalled();
  });
});
