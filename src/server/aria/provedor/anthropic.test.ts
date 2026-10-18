import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarProvedorAnthropic, type ClienteMensagens } from "./anthropic";
import { escolherProvedor } from "./index";
import type { PedidoIA } from "./tipos";

const M = { conversa: "claude-sonnet-5-5", classificacao: "claude-haiku-5-5" };
const p: PedidoIA = { tarefa: "conversa", sistema: "SIS", mensagens: [{ papel: "usuario", texto: "oi" }], maxTokens: 1024 };
const original = process.env.ANTHROPIC_API_KEY;

const ok = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: "ola" }, { type: "text", text: " mundo" }],
  usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 1000, cache_creation_input_tokens: 300 },
};
let create: ReturnType<typeof vi.fn>;
let provedor: ReturnType<typeof criarProvedorAnthropic>;
const cliente = (c: unknown): ClienteMensagens => ({ beta: { messages: { create: c as never } } });

beforeEach(() => {
  create = vi.fn().mockResolvedValue(ok);
  provedor = criarProvedorAnthropic(cliente(create), M);
});
afterEach(() => {
  if (original === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = original;
});

describe("provedor Anthropic", () => {
  it("conversa_sonnet_saida_estruturada_reserva_e_cache", async () => {
    await provedor.gerar({ ...p, esquemaSaida: { type: "object" } });
    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-sonnet-5-5");
    expect(req.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(req.fallbacks).toBe("default");
    expect(req.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: { type: "object" } } });
    expect(req.system).toEqual([{ type: "text", text: "SIS", cache_control: { type: "ephemeral" } }]);
    expect(req).not.toHaveProperty("tool_choice");
    expect(req).not.toHaveProperty("thinking");
  });
  it("uso_mapeado", async () => {
    expect(await provedor.gerar(p)).toMatchObject({
      texto: "ola mundo", tokensEntrada: 1200, tokensSaida: 80, tokensCache: 1000, tokensEscritaCache: 300, provedor: "anthropic", recusa: false,
    });
  });
  it("escrita_de_cache_ausente_ou_nula_vira_zero", async () => {
    const semCampo = criarProvedorAnthropic(
      cliente(vi.fn().mockResolvedValue({ ...ok, usage: { input_tokens: 10, output_tokens: 1 } })),
      M,
    );
    expect((await semCampo.gerar(p)).tokensEscritaCache).toBe(0);
    const nulo = criarProvedorAnthropic(
      cliente(vi.fn().mockResolvedValue({ ...ok, usage: { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: null } })),
      M,
    );
    expect((await nulo.gerar(p)).tokensEscritaCache).toBe(0);
  });
  it("modelo_nao_permitido_falha_antes_da_chamada", async () => {
    const r = criarProvedorAnthropic(cliente(create), { conversa: "claude-opus-velho", classificacao: "claude-haiku-5-5" });
    await expect(r.gerar(p)).rejects.toMatchObject({ name: "ErroProvedorIA", codigo: "MODELO_NAO_PERMITIDO" });
    expect(create).not.toHaveBeenCalled();
    await r.gerar({ ...p, tarefa: "classificacao" });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("classificacao_haiku_sem_reserva", async () => {
    await provedor.gerar({ ...p, tarefa: "classificacao" });
    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-haiku-5-5");
    expect(req).not.toHaveProperty("fallbacks");
    expect(req.betas).toBeUndefined();
  });
  it("recusa_nao_le_conteudo", async () => {
    const r = criarProvedorAnthropic(
      cliente(vi.fn().mockResolvedValue({ stop_reason: "refusal", content: [{ type: "text", text: "x" }], usage: { input_tokens: 5, output_tokens: 0 } })),
      M,
    );
    expect(await r.gerar(p)).toMatchObject({ recusa: true, texto: "" });
  });
  it("pdf_vai_antes_do_texto", async () => {
    await provedor.gerar({ ...p, tarefa: "extracao", pdfBase64: "QUJD" });
    const content = create.mock.calls[0][0].messages.at(-1).content;
    expect(content[0]).toEqual({ type: "document", source: { type: "base64", media_type: "application/pdf", data: "QUJD" } });
    expect(content[1]).toEqual({ type: "text", text: "oi" });
  });
  it("com_chave_escolhe_anthropic", () => {
    process.env.ANTHROPIC_API_KEY = "chave-de-teste-nao-real";
    expect(escolherProvedor(M).nome).toBe("anthropic");
  });
  it("erros_tipados_viram_ErroProvedorIA", async () => {
    const com = (e: unknown) => criarProvedorAnthropic(cliente(vi.fn().mockRejectedValue(e)), M);
    await expect(com(new Anthropic.RateLimitError(429, {}, "x", new Headers())).gerar(p)).rejects.toMatchObject({ codigo: "429" });
    await expect(com(new Anthropic.AuthenticationError(401, {}, "x", new Headers())).gerar(p)).rejects.toMatchObject({ codigo: "401" });
    await expect(com(new Anthropic.APIConnectionTimeoutError()).gerar(p)).rejects.toMatchObject({ codigo: "TIMEOUT" });
    await expect(com(new Anthropic.InternalServerError(500, {}, "x", new Headers())).gerar(p)).rejects.toMatchObject({ codigo: "500" });
  });
});
