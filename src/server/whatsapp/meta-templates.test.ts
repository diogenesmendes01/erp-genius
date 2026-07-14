import { describe, it, expect, afterEach, vi } from "vitest";
import { corpoParaMeta, statusMetaParaLocal, submeterTemplateNaMeta } from "./meta-templates";

// Conversão amigável → posicional (doc 26 §Camada 2, Marco 2) + mapa de status da Meta.

describe("corpoParaMeta", () => {
  it("converte variáveis amigáveis para posicionais na ordem de aparição", () => {
    const r = corpoParaMeta("Olá {nome}, sua mensalidade de {valor} vence em {vencimento}.");
    expect(r.texto).toBe("Olá {{1}}, sua mensalidade de {{2}} vence em {{3}}.");
    expect(r.variaveis).toEqual(["nome", "valor", "vencimento"]);
    expect(r.exemplos).toHaveLength(3);
  });

  it("variável repetida ganha posição nova (regra da Meta)", () => {
    const r = corpoParaMeta("{nome}, confirma? {nome}?");
    expect(r.texto).toBe("{{1}}, confirma? {{2}}?");
    expect(r.variaveis).toEqual(["nome", "nome"]);
  });

  it("corpo sem variáveis passa intacto e sem exemplos", () => {
    const r = corpoParaMeta("Bom dia! Seguem os dados de pagamento.");
    expect(r.texto).toBe("Bom dia! Seguem os dados de pagamento.");
    expect(r.exemplos).toEqual([]);
  });

  it("chave desconhecida não é tratada como variável", () => {
    const r = corpoParaMeta("Olá {nome}, código {pedido}.");
    expect(r.texto).toBe("Olá {{1}}, código {pedido}.");
    expect(r.variaveis).toEqual(["nome"]);
  });
});

describe("statusMetaParaLocal", () => {
  it("mapeia o ciclo da Meta para o enum local", () => {
    expect(statusMetaParaLocal("APPROVED")).toBe("APROVADO");
    expect(statusMetaParaLocal("REJECTED")).toBe("REJEITADO");
    expect(statusMetaParaLocal("PAUSED")).toBe("REJEITADO");
    expect(statusMetaParaLocal("PENDING")).toBe("EM_REVISAO");
    expect(statusMetaParaLocal("IN_APPEAL")).toBe("EM_REVISAO");
    expect(statusMetaParaLocal("qualquer-coisa")).toBeNull();
    expect(statusMetaParaLocal(null)).toBeNull();
  });
});

// Re-submissão (review PR #51 P2-4): nome+idioma são a IDENTIDADE do template na Meta —
// quem já tem metaTemplateId EDITA (POST /<id>), nunca re-cria (duplicaria e falharia).
describe("submeterTemplateNaMeta — criar × editar", () => {
  const base = { nome: "cobranca_vencida", corpo: "Olá {nome}.", idioma: "es", categoria: "utility" };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function stubFetch(json: Record<string, unknown>) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => json });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("META_WA_TOKEN", "token-teste");
    vi.stubEnv("META_WA_WABA_ID", "waba-teste");
    return fetchMock;
  }

  it("sem metaTemplateId cria na WABA (name+language no corpo)", async () => {
    const fetchMock = stubFetch({ id: "meta-novo" });
    const r = await submeterTemplateNaMeta(base);
    expect(r.metaTemplateId).toBe("meta-novo");

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toContain("/waba-teste/message_templates");
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.name).toBe("cobranca_vencida");
    expect(body.language).toBe("es");
  });

  it("com metaTemplateId edita o template existente (POST /<id>, sem name/language)", async () => {
    const fetchMock = stubFetch({ success: true });
    const r = await submeterTemplateNaMeta({ ...base, metaTemplateId: "meta-123" });
    expect(r.metaTemplateId).toBe("meta-123");

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toMatch(/\/meta-123$/);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.name).toBeUndefined();
    expect(body.language).toBeUndefined();
    expect(body.components).toBeDefined();
  });

  it("edição sem confirmação da Meta vira erro claro", async () => {
    stubFetch({});
    await expect(submeterTemplateNaMeta({ ...base, metaTemplateId: "meta-123" })).rejects.toThrow(
      "não confirmou a edição",
    );
  });
});
