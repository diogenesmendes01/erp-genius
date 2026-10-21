import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("AnthropicHTTPClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchMock = vi.fn();
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function criarCliente() {
    const mod = await import("./anthropic");
    return new mod.AnthropicHTTPClient({
      apiKey: "test-key",
      timeout: 30_000,
      maxRetries: 2,
    });
  }

  it("envia_headers_corretos_sem_beta", async () => {
    const client = await criarCliente();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
    });

    await client.beta.messages.create({ model: "claude-haiku-5-5", max_tokens: 100, messages: [] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      })
    );
  });

  it("envia_header_anthropic_beta_e_query_param_quando_betas_presente", async () => {
    const client = await criarCliente();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
    });

    await client.beta.messages.create({
      model: "claude-sonnet-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      max_tokens: 100,
      messages: [],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages?beta=true",
      expect.objectContaining({
        headers: expect.objectContaining({
          "anthropic-beta": "server-side-fallback-2026-07-01",
        }),
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("betas");
    expect(body).not.toHaveProperty("fallbacks");
  });

  it("retry_em_429_com_backoff", async () => {
    const client = await criarCliente();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map(),
        json: async () => ({ error: { message: "rate limit" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retry_em_500_com_backoff", async () => {
    const client = await criarCliente();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Map(),
        json: async () => ({ error: { message: "server error" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retry_em_408_request_timeout", async () => {
    const client = await criarCliente();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 408,
        headers: new Map(),
        json: async () => ({ error: { message: "request timeout" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retry_em_409_conflict", async () => {
    const client = await criarCliente();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        headers: new Map(),
        json: async () => ({ error: { message: "conflict" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honra_retry_after_ms_header", async () => {
    const client = await criarCliente();
    const headers = new Map();
    headers.set("retry-after-ms", "100");
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: async () => ({ error: { message: "rate limit" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honra_retry_after_header", async () => {
    const client = await criarCliente();
    const headers = new Map();
    headers.set("retry-after", "1");
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
        json: async () => ({ error: { message: "rate limit" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("honra_x_should_retry_header", async () => {
    const client = await criarCliente();
    const headers = new Map();
    headers.set("x-should-retry", "true");
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers,
        json: async () => ({ error: { message: "bad request" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("timeout_gera_retry", async () => {
    const client = await criarCliente();
    
    const timeoutError = new Error("AbortError");
    timeoutError.name = "AbortError";
    
    fetchMock
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(timeoutError);

    await expect(client.beta.messages.create({ model: "test", messages: [] })).rejects.toMatchObject({
      isTimeout: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("network_error_vira_CONEXAO_com_retry", async () => {
    const client = await criarCliente();
    fetchMock
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ stop_reason: "end_turn", content: [], usage: {} }),
      });

    await client.beta.messages.create({ model: "test", messages: [] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("atinge_max_retries_e_falha", async () => {
    const client = await criarCliente();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map(),
      json: async () => ({ error: { message: "rate limit" } }),
    });

    await expect(client.beta.messages.create({ model: "test", messages: [] })).rejects.toMatchObject({
      status: 429,
      isAPIError: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
