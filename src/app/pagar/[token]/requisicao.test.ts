import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERRO_PAGAMENTO, pagarCobrancaSimulada } from "./requisicao";

// docs/42 /pagar #5 (docs/43 §6 item 8): a recusa do webhook simulado vira uma mensagem estável (o texto cru do
// servidor não chega ao cliente final); falha de transporte lança. `fetch` é um mock: nenhuma baixa real.
const fetchFalso = vi.fn();
const resposta = (status: number, corpo?: unknown) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => { if (corpo === undefined) throw new SyntaxError("Unexpected end of JSON input"); return corpo; },
});

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("pagarCobrancaSimulada", () => {
  it("manda só o token, por POST, ao webhook simulado", async () => {
    fetchFalso.mockResolvedValueOnce(resposta(200, { ok: true }));
    expect(await pagarCobrancaSimulada("abc123")).toEqual({ ok: true });
    const [url, init] = fetchFalso.mock.calls[0];
    expect(url).toBe("/api/pagamentos/webhook/simulado");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: "abc123" });
  });

  it("recusa (simulado desligado, token inválido, cobrança já quitada) vira a mensagem estável, sem o texto do servidor", async () => {
    for (const [status, corpo] of [[404, { erro: "Pagamento simulado desabilitado." }], [400, { erro: "Cobrança já quitada." }], [200, { ok: false }]] as const) {
      fetchFalso.mockResolvedValueOnce(resposta(status, corpo));
      expect(await pagarCobrancaSimulada("abc123"), String(status)).toEqual({ ok: false, erro: ERRO_PAGAMENTO });
    }
  });

  it("falha de rede, ou 200 com corpo ilegível, lança (a baixa pode ter acontecido)", async () => {
    fetchFalso.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(pagarCobrancaSimulada("abc123")).rejects.toThrow("Failed to fetch");
    fetchFalso.mockResolvedValueOnce(resposta(200));
    await expect(pagarCobrancaSimulada("abc123")).rejects.toThrow(SyntaxError);
  });
});
