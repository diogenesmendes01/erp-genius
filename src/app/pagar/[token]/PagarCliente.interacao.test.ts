import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 8 (docs/42 /pagar #5 e #6): o pagamento no ambiente de teste anuncia erro e sucesso em regiões
// separadas, troca o rótulo para "Tentar de novo" depois da recusa e some com o botão depois do sucesso. Sem DOM
// e sem rede: ganchos de src/test/tela-sem-dom.ts; a chamada ao webhook (./requisicao) é um mock.
const m = vi.hoisted(() => ({ ganchos: null as null | import("@/test/tela-sem-dom").Ganchos, pagar: vi.fn() }));
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
  // Rede de segurança: nenhuma chamada real ao webhook.
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
