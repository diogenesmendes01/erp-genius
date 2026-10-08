import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados na designação do
// avaliador — erro em role="alert", sucesso em role="status", falha de rede como resultado incerto e o
// formulário saindo do ocupado (sem useTransition: o ocupado é o do executor). Sem DOM: ganchos de
// src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  designar: vi.fn(), refresh: vi.fn(), replace: vi.fn(),
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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn(), replace: m.replace }) }));
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
/** O botão de envio (o "Buscar" da busca de professor é type="button" e vem antes). */
const botao = () => elementos(tela()).find((n) => n.type === "button" && n.props.type !== "button")!;
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

// docs/43 §6 item 3 (docs/42 L1327): a busca de professor mora no formulário. Antes era um <form method="get">
// que recarregava a página, e a key do formulário tinha a busca: o motivo digitado sumia a cada busca.
describe("FormularioDesignacao — buscar não apaga o motivo", () => {
  const comBusca = { ...props, professores: [{ id: "prof-1", nome: "Ana" }, { id: "prof-2", nome: "Bia" }, { id: "prof-3", nome: "Bruno" }], busca: "", refinarBusca: false };
  const telaBusca = (p = comBusca) => m.ganchos!.renderizar(FormularioDesignacao, p);
  const busca = (t = telaBusca()) => elementos(t).find((n) => n.type === "input" && n.props.type === "search")!;
  const opcoes = (t = telaBusca()) => elementos(elementos(t).find((n) => n.type === "select") as unknown as ReactNode).filter((n) => n.type === "option").map((n) => texto(n.props.children));
  const digitarBusca = (v: string) => (busca().props.onChange as AoMudar)({ target: { value: v } });

  it("com a lista completa, filtra em memória enquanto digita — sem ir ao servidor", () => {
    digitarBusca("br");
    expect(opcoes()).toEqual(["Selecione uma opção", "Revogar a designação atual", "Bruno"]);
    expect(m.replace).not.toHaveBeenCalled();
  });

  it("Buscar consulta o servidor sem remontar: motivo e professor escolhidos continuam, mesmo fora da lista nova", () => {
    (elementos(telaBusca()).find((n) => n.type === "select")!.props.onChange as AoMudar)({ target: { value: "prof-2" } });
    (elementos(telaBusca()).find((n) => n.type === CampoTexto)!.props.onChange as AoMudar)({ target: { value: "Motivo digitado antes da busca." } });
    digitarBusca("Car");
    (elementos(telaBusca()).find((n) => n.type === "button" && texto(n.props.children) === "Buscar")!.props.onClick as () => void)();
    expect(m.replace).toHaveBeenCalledWith("?busca=Car", { scroll: false });
    // A página volta com a lista da busca nova; o mesmo componente (mesmos ganchos) recebe as props novas.
    const depois = telaBusca({ ...comBusca, professores: [{ id: "prof-4", nome: "Carla" }], busca: "Car" });
    expect(elementos(depois).find((n) => n.type === CampoTexto)!.props.value).toBe("Motivo digitado antes da busca.");
    expect(elementos(depois).find((n) => n.type === "select")!.props.value).toBe("prof-2");
    expect(opcoes(depois)).toEqual(["Selecione uma opção", "Revogar a designação atual", "Bia", "Carla"]);
    expect(busca(depois).props.value).toBe("Car");
  });

  // R1 da #155, C1: sem remontar, professor e motivo ficariam preenchidos depois de registrar.
  it("registrada a designação, professor e motivo voltam ao vazio (a busca digitada fica)", async () => {
    digitarBusca("Bi");
    (elementos(telaBusca()).find((n) => n.type === "select")!.props.onChange as AoMudar)({ target: { value: "prof-2" } });
    (elementos(telaBusca()).find((n) => n.type === CampoTexto)!.props.onChange as AoMudar)({ target: { value: "Designação conferida." } });
    m.designar.mockResolvedValueOnce({ ok: true });
    await submeter(telaBusca());
    expect(m.designar).toHaveBeenCalledWith(expect.objectContaining({ professorId: "prof-2", motivo: "Designação conferida." }));
    const depois = telaBusca();
    expect(elementos(depois).find((n) => n.type === "select")!.props.value).toBe("");
    expect(elementos(depois).find((n) => n.type === CampoTexto)!.props.value).toBe("");
    expect(busca(depois).props.value).toBe("Bi");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("Enter na busca busca no servidor e não envia a designação", () => {
    digitarBusca("Bi");
    const evento = { key: "Enter", preventDefault: vi.fn() };
    (busca().props.onKeyDown as (e: typeof evento) => void)(evento);
    expect(evento.preventDefault).toHaveBeenCalled();
    expect(m.replace).toHaveBeenCalledWith("?busca=Bi", { scroll: false });
    expect(m.designar).not.toHaveBeenCalled();
  });

  it("lista cortada em 50 (refinarBusca): avisa e não filtra em memória", () => {
    const t = telaBusca({ ...comBusca, refinarBusca: true });
    expect(anuncios(t).status).toContain("Exibindo os primeiros 50 professores. Refine a busca para localizar o nome desejado.");
    digitarBusca("br");
    expect(opcoes(telaBusca({ ...comBusca, refinarBusca: true }))).toEqual(["Selecione uma opção", "Revogar a designação atual", "Bia", "Bruno"]);
  });
});
