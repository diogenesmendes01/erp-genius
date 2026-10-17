import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baixarDoMotor, chamarMotor, ErroMotor } from "./cliente";
import { executarAcaoMotor } from "./acoes";
import { lerConfigMotor } from "./config";
import { MAX_BYTES_MIDIA } from "../midia";

const CHAVE = "k".repeat(32);
const SEGREDO = "s".repeat(32);
const json = (status: number, corpo: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json", ...headers } });

let f: ReturnType<typeof vi.fn>;
beforeEach(() => {
  f = vi.fn();
  vi.stubGlobal("fetch", f);
  vi.stubEnv("MOTOR_URL", "http://motor:4317");
  vi.stubEnv("MOTOR_API_KEY", CHAVE);
  vi.stubEnv("MOTOR_WEBHOOK_SECRET", SEGREDO);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("chamarMotor", () => {
  it("manda Bearer e usa MOTOR_URL", async () => {
    f.mockResolvedValue(json(200, { ok: true }));
    await chamarMotor("/v1/health", { metodo: "GET" });
    expect(f).toHaveBeenCalledWith(
      "http://motor:4317/v1/health",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${CHAVE}` }) }),
    );
  });
  it("409 NAO_ENVIADO vira ErroMotor com motivo", async () => {
    f.mockResolvedValue(json(409, { code: "NAO_ENVIADO", motivo: "numero_desconectado" }));
    await expect(chamarMotor("/x", { metodo: "POST" })).rejects.toMatchObject({ codigo: "NAO_ENVIADO", status: 409, motivo: "numero_desconectado" });
  });
  it("409 NAO_ENVIADO limite_ritmo vira LIMITE_RITMO", async () => {
    f.mockResolvedValue(json(409, { code: "NAO_ENVIADO", motivo: "limite_ritmo" }));
    await expect(chamarMotor("/x", { metodo: "POST" })).rejects.toMatchObject({ codigo: "LIMITE_RITMO", status: 409, motivo: "limite_ritmo" });
  });
  it("502 RESULTADO_INCERTO guarda providerMessageId", async () => {
    f.mockResolvedValue(json(502, { code: "RESULTADO_INCERTO", providerMessageId: "3EB0AA" }));
    await expect(chamarMotor("/x", { metodo: "POST" })).rejects.toMatchObject({ codigo: "RESULTADO_INCERTO", providerMessageId: "3EB0AA" });
  });
  it("409 EM_ANDAMENTO", async () => {
    f.mockResolvedValue(json(409, { code: "EM_ANDAMENTO" }));
    await expect(chamarMotor("/x", { metodo: "POST" })).rejects.toMatchObject({ codigo: "EM_ANDAMENTO", status: 409 });
  });
  it("401 → NAO_AUTORIZADO", async () => {
    f.mockResolvedValue(json(401, { code: "NAO_AUTORIZADO" }));
    await expect(chamarMotor("/x", { metodo: "GET" })).rejects.toMatchObject({ codigo: "NAO_AUTORIZADO" });
  });
  it("404 NUMERO_INEXISTENTE", async () => {
    f.mockResolvedValue(json(404, { code: "NUMERO_INEXISTENTE" }));
    await expect(chamarMotor("/x", { metodo: "GET" })).rejects.toMatchObject({ codigo: "NUMERO_INEXISTENTE" });
  });
  it("404 sem code NUMERO_INEXISTENTE → HTTP", async () => {
    f.mockResolvedValue(json(404, { code: "MIDIA_AUSENTE" }));
    await expect(chamarMotor("/x", { metodo: "GET" })).rejects.toMatchObject({ codigo: "HTTP", status: 404 });
  });
  it("timeout lendo o corpo de um 200 → TIMEOUT", async () => {
    const res = new Response("{}", { status: 200 });
    vi.spyOn(res, "text").mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    f.mockResolvedValue(res);
    const erro = await chamarMotor("/x", { metodo: "GET" }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMotor);
    expect(erro).toMatchObject({ codigo: "TIMEOUT" });
  });
  it("200 com JSON inválido → HTTP com o status", async () => {
    f.mockResolvedValue(new Response("{nao-json", { status: 200 }));
    const erro = await chamarMotor("/x", { metodo: "GET" }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroMotor);
    expect(erro).toMatchObject({ codigo: "HTTP", status: 200 });
  });
  it("403 ACAO_NAO_DISPONIVEL", async () => {
    f.mockResolvedValue(json(403, { code: "ACAO_NAO_DISPONIVEL" }));
    await expect(chamarMotor("/x", { metodo: "POST" })).rejects.toMatchObject({ codigo: "ACAO_NAO_DISPONIVEL" });
  });
  it("500 sem código conhecido → HTTP", async () => {
    f.mockResolvedValue(json(500, { error: "boom" }));
    await expect(chamarMotor("/x", { metodo: "GET" })).rejects.toMatchObject({ codigo: "HTTP", status: 500 });
  });
  it("ECONNREFUSED → INDISPONIVEL", async () => {
    f.mockRejectedValue(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }));
    await expect(chamarMotor("/x", { metodo: "GET" })).rejects.toMatchObject({ codigo: "INDISPONIVEL" });
  });
  it("AbortSignal.timeout → TIMEOUT", async () => {
    f.mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    await expect(chamarMotor("/x", { metodo: "GET" })).rejects.toMatchObject({ codigo: "TIMEOUT" });
  });
  it("envia JSON com content-type", async () => {
    f.mockResolvedValue(json(200, {}));
    await chamarMotor("/x", { metodo: "POST", json: { a: 1 } });
    const init = f.mock.calls[0][1];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers["content-type"]).toBe("application/json");
  });
});

describe("config", () => {
  it("sem MOTOR_API_KEY → SEM_CONFIG", async () => {
    vi.stubEnv("MOTOR_API_KEY", "");
    await expect(chamarMotor("/x", { metodo: "GET" })).rejects.toMatchObject({ codigo: "SEM_CONFIG", status: 0 });
    expect(f).not.toHaveBeenCalled();
  });
  it("chave de 31 caracteres → SEM_CONFIG", () => {
    expect(() => lerConfigMotor({ MOTOR_URL: "http://m", MOTOR_API_KEY: "k".repeat(31), MOTOR_WEBHOOK_SECRET: SEGREDO })).toThrow(ErroMotor);
  });
  it("segredo de 31 caracteres → SEM_CONFIG", () => {
    expect(() => lerConfigMotor({ MOTOR_URL: "http://m", MOTOR_API_KEY: CHAVE, MOTOR_WEBHOOK_SECRET: "s".repeat(31) })).toThrow(ErroMotor);
  });
  it("config válida", () => {
    expect(lerConfigMotor({ MOTOR_URL: "http://m/", MOTOR_API_KEY: CHAVE, MOTOR_WEBHOOK_SECRET: SEGREDO })).toEqual({ url: "http://m", apiKey: CHAVE, segredoWebhook: SEGREDO });
  });
});

describe("baixarDoMotor", () => {
  it("recusa content-length acima de MAX_BYTES_MIDIA sem ler o corpo", async () => {
    const res = new Response("x", { status: 200, headers: { "content-length": String(MAX_BYTES_MIDIA + 1), "content-type": "image/png" } });
    const lerCorpo = vi.spyOn(res, "arrayBuffer");
    f.mockResolvedValue(res);
    await expect(baixarDoMotor("/v1/numeros/n1/midia/m1")).rejects.toMatchObject({ codigo: "HTTP", status: 413 });
    expect(lerCorpo).not.toHaveBeenCalled();
  });
  it("404 de mídia ausente → HTTP, não NUMERO_INEXISTENTE", async () => {
    f.mockResolvedValue(json(404, { code: "NAO_ENCONTRADO" }));
    await expect(baixarDoMotor("/m")).rejects.toMatchObject({ codigo: "HTTP", status: 404 });
  });
  it("devolve bytes, mime e tamanho", async () => {
    f.mockResolvedValue(new Response(Buffer.from("abc"), { status: 200, headers: { "content-type": "image/png; charset=x" } }));
    await expect(baixarDoMotor("/m")).resolves.toMatchObject({ mime: "image/png", tamanho: 3 });
  });
});

describe("executarAcaoMotor", () => {
  it("POST /acoes, devolve resultado e manda X-Origem: HUMANO", async () => {
    f.mockResolvedValue(json(200, { resultado: { id: "x" } }));
    const r = await executarAcaoMotor<{ id: string }>("num_1", "message.react", { emoji: "👍" }, { origem: "HUMANO" });
    expect(r).toEqual({ id: "x" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("http://motor:4317/v1/numeros/num_1/acoes");
    expect(JSON.parse(init.body)).toEqual({ acao: "message.react", payload: { emoji: "👍" } });
    expect(init.headers["X-Origem"]).toBe("HUMANO");
  });
  it("sem origem HUMANO não manda X-Origem", async () => {
    f.mockResolvedValue(json(200, { resultado: null }));
    await executarAcaoMotor("num_1", "message.read", {});
    expect(f.mock.calls[0][1].headers["X-Origem"]).toBeUndefined();
  });
  it("409 limite_ritmo vira LIMITE_RITMO", async () => {
    f.mockResolvedValue(json(409, { code: "NAO_ENVIADO", motivo: "limite_ritmo" }));
    await expect(executarAcaoMotor("num_1", "message.edit", {}, { origem: "HUMANO" })).rejects.toMatchObject({ codigo: "LIMITE_RITMO" });
  });
  it("usa timeout de mídia nas ações que geram mensagem", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    f.mockImplementation(async () => json(200, { resultado: 1 }));
    await executarAcaoMotor("n", "message.delete", {});
    await executarAcaoMotor("n", "presence", {});
    expect(spy.mock.calls.map((c) => c[0])).toEqual([60_000, 15_000]);
    spy.mockRestore();
  });
});
