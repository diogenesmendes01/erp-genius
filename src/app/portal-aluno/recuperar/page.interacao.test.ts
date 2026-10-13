import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 8 (docs/42 /portal-aluno/recuperar #1, #3 e #4): a confirmação só aparece com o pedido aceito
// — antes o `finally` a mostrava até com a rede fora —, em role="status"; recusa e falha de rede vão para
// role="alert" com o formulário ainda na tela; e a confirmação é a mesma para qualquer e-mail. Sem DOM e sem
// rede: ganchos de src/test/tela-sem-dom.ts e a chamada à rota (../requisicoes) trocada por um mock.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, pedir: vi.fn() }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
  };
});
vi.mock("next/link", async () => {
  const { createElement } = await vi.importActual<typeof import("react")>("react");
  return { default: ({ href, children }: { href: string; children?: import("react").ReactNode }) => createElement("a", { href }, children) };
});
vi.mock("../requisicoes", async (original) => ({ ...(await original<typeof import("../requisicoes")>()), pedirRecuperacaoPortalAluno: m.pedir }));

import RecuperarPortalAlunoPage from "./page";
import { Botao } from "@/components/Botao";
import { MSG_RECUPERACAO_INCERTA } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { FormDataFalso, criarGanchos, elementos, formularios, submeter } from "@/test/tela-sem-dom";

const CONFIRMACAO = "Pedido registrado. Se houver uma conta ativa para este endereço, a escola vai preparar a recuperação e mandar as instruções para ele. Não recebeu? Confira a caixa de spam ou procure a Secretaria para o procedimento assistido.";
const tela = () => m.ganchos!.renderizar(RecuperarPortalAlunoPage, {});
const pedir = (email = "aluna@escola.test") => submeter(tela(), { email });

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("FormData", FormDataFalso);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("recuperar — envio do pedido", () => {
  contratoFeedbackSeparado({
    nome: "solicitar a recuperação",
    tela,
    acionar: () => pedir(),
    action: m.pedir,
    sucesso: CONFIRMACAO,
    incerto: MSG_RECUPERACAO_INCERTA,
    ocupado: () => elementos(tela()).find((n) => n.type === Botao)?.props.disabled === true,
  });

  it("manda o e-mail digitado, sem espaços nas pontas", async () => {
    m.pedir.mockResolvedValueOnce({ ok: true });
    await pedir("  aluna@escola.test ");
    expect(m.pedir).toHaveBeenCalledWith("aluna@escola.test");
  });

  it("antes do envio, nada diz que o pedido foi feito", () => {
    expect(anuncios(tela())).toEqual({ alerta: [], status: [] });
    expect(formularios(tela())).toHaveLength(1);
  });

  it("falha de rede: NÃO confirma o pedido; alerta de resultado incerto e o formulário continua", async () => {
    m.pedir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await pedir();
    expect(anuncios(tela())).toEqual({ alerta: [MSG_RECUPERACAO_INCERTA], status: [] });
    expect(formularios(tela())).toHaveLength(1);
  });

  it("recusa do servidor: alerta e o formulário continua para repetir", async () => {
    m.pedir.mockResolvedValueOnce({ ok: false, erro: "Não foi possível registrar o pedido agora." });
    await pedir();
    expect(anuncios(tela()).status).toEqual([]);
    expect(formularios(tela())).toHaveLength(1);
  });

  it("aceito: a confirmação substitui o formulário e é a mesma para qualquer e-mail (não revela se há conta)", async () => {
    m.pedir.mockResolvedValueOnce({ ok: true });
    await pedir("tem-conta@escola.test");
    const comConta = anuncios(tela());
    expect(formularios(tela())).toHaveLength(0);
    m.ganchos = criarGanchos();
    m.pedir.mockResolvedValueOnce({ ok: true });
    await pedir("sem-conta@escola.test");
    expect(anuncios(tela())).toEqual(comConta);
    expect(comConta).toEqual({ alerta: [], status: [CONFIRMACAO] });
  });

  it("a confirmação sai numa região que já existia antes do envio (anunciada pelo leitor de tela)", async () => {
    const antes = renderToStaticMarkup(tela() as ReactElement);
    expect(antes).toMatch(/<p role="status" class="sr-only"><\/p>/);
    m.pedir.mockResolvedValueOnce({ ok: true });
    await pedir();
    expect(renderToStaticMarkup(tela() as ReactElement)).toContain(`<p role="status" class="sr-only">${CONFIRMACAO}</p>`);
  });
});
