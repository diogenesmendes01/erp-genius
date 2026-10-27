import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, pagar: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
  };
});
vi.mock("./requisicao", async (original) => ({ ...(await original<typeof import("./requisicao")>()), pagarCobrancaSimulada: m.pagar }));

import { PagarCliente } from "./PagarCliente";
import { Botao } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { criarGanchos, elementos, texto } from "@/test/tela-sem-dom";

const TOKEN = "0123456789abcdef0123456789abcdef";
const tela = (simuladoHabilitado = true) => m.ganchos!.renderizar(PagarCliente, { token: TOKEN, simuladoHabilitado });
const botaoDePagar = () => elementos(tela()).find((n) => n.type === Botao);
const clicarPagar = () => (botaoDePagar()!.props.onClick as () => unknown)();

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fetch real não pode ser chamado no teste"); }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("PagarCliente", () => {
  contratoFeedbackSeparado({
    nome: "pagar no ambiente de teste",
    tela: () => tela(),
    acionar: clicarPagar,
    action: m.pagar,
    sucesso: "Pagamento confirmado. Obrigado!",
    incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE,
    ocupado: () => botaoDePagar()?.props.disabled === true,
  });

  it("pagamento aceito: a página é renderizada de novo (o quadro vai a \"paga\"); recusa e falha de rede não", async () => {
    m.pagar.mockResolvedValueOnce({ ok: false, erro: "Não conseguimos concluir o pagamento." });
    await clicarPagar();
    m.pagar.mockRejectedValueOnce(new Error("rede"));
    await clicarPagar();
    expect(m.refresh).not.toHaveBeenCalled();
    m.pagar.mockResolvedValueOnce({ ok: true });
    await clicarPagar();
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("paga a cobrança do token da página", async () => {
    m.pagar.mockResolvedValueOnce({ ok: true });
    await clicarPagar();
    expect(m.pagar).toHaveBeenCalledWith(TOKEN);
  });

  it("depois da recusa, o botão vira \"Tentar de novo\"; depois do sucesso, o botão sai", async () => {
    expect(texto(botaoDePagar()!.props.children)).toBe("Pagar (ambiente de teste)");
    m.pagar.mockResolvedValueOnce({ ok: false, erro: "Não conseguimos concluir o pagamento." });
    await clicarPagar();
    expect(texto(botaoDePagar()!.props.children)).toBe("Tentar de novo");
    m.pagar.mockResolvedValueOnce({ ok: true });
    await clicarPagar();
    expect(botaoDePagar()).toBeUndefined();
    expect(anuncios(tela())).toEqual({ alerta: [], status: ["Pagamento confirmado. Obrigado!"] });
  });

  it("sem o ambiente de teste: só a orientação de pagar por outro canal, sem botão", () => {
    const raiz = tela(false);
    expect(elementos(raiz).some((n) => n.type === Botao)).toBe(false);
    expect(texto(raiz)).toContain("Pagamento online indisponível no momento");
  });
});
