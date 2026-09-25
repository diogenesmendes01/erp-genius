import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET, HEAD } from "./route";

// Mock do Prisma client antes de importar o route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";

// Trava o contrato de readiness (/api/ready): usado pelo healthcheck do Docker/Coolify
// (sem autenticação, valida conectividade com DB e Prisma). Mutações cobradas:
// - Alterar status 200 → 503 quando DB funciona → deve falhar
// - Remover a query SELECT 1 → deve falhar
// - Remover HEAD exportado → deve falhar
// - Devolver a mensagem do erro na resposta pública → deve falhar
// - Não limpar o timer do timeout → deve falhar

// Erro no formato do Prisma: a mensagem carrega host/porta do banco.
const ERRO_BANCO = new Error("Can't reach database server at `db:5432`");

describe("GET /api/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("responde 200 quando SELECT 1 funciona", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ result: 1 }]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("ready", true);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("limpa o timer do timeout quando o banco responde", async () => {
    vi.useFakeTimers();
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ result: 1 }]);

    await GET();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("responde 503 sem expor o detalhe do erro quando o banco está inacessível", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(ERRO_BANCO);

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toEqual({ ready: false });
    // O detalhe vai para o log do servidor, não para a resposta pública.
    expect(console.error).toHaveBeenCalledWith(expect.any(String), ERRO_BANCO);
  });

  it("responde 503 em timeout (banco lento)", async () => {
    vi.useFakeTimers();
    vi.mocked(prisma.$queryRaw).mockImplementationOnce(
      () => new Promise(() => {}) as never // nunca resolve
    );

    const pendente = GET();
    await vi.advanceTimersByTimeAsync(3000);
    const res = await pendente;

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ready: false });
  });

  it("responde 503 se SELECT 1 retorna resultado inesperado", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ready: false });
  });
});

describe("HEAD /api/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("é o mesmo handler do GET (wget --spider usa HEAD)", () => {
    expect(HEAD).toBe(GET);
  });

  it("responde 200 quando DB funciona", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ result: 1 }]);

    const res = await HEAD();
    expect(res.status).toBe(200);
  });

  it("responde 503 quando DB falha", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(ERRO_BANCO);

    const res = await HEAD();
    expect(res.status).toBe(503);
  });
});
