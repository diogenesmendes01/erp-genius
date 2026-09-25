import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("GET /api/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responde 200 quando SELECT 1 funciona", async () => {
    // Mock: query retorna sucesso
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ result: 1 }]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("ready", true);
    expect(body).toHaveProperty("timestamp");
    expect(typeof body.timestamp).toBe("string");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Deve ter chamado o Prisma
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("responde 503 quando o banco está inacessível", async () => {
    // Mock: query lança erro (banco inacessível)
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error("Connection refused")
    );

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toHaveProperty("ready", false);
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("Connection refused");
  });

  it("responde 503 em timeout (banco lento)", async () => {
    // Mock: query nunca resolve (simula timeout)
    vi.mocked(prisma.$queryRaw).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toHaveProperty("ready", false);
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("Timeout");
  });

  it("responde 503 se SELECT 1 retorna resultado inesperado", async () => {
    // Mock: query retorna algo diferente de [{ result: 1 }]
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toHaveProperty("ready", false);
    expect(body).toHaveProperty("error", "Unexpected DB response");
  });
});

describe("HEAD /api/ready", () => {
  it("está exportado (wget --spider usa HEAD)", () => {
    // Trava: HEAD deve existir e ser o mesmo handler do GET (ou funcionar equivalente).
    expect(HEAD).toBeDefined();
    expect(typeof HEAD).toBe("function");
  });

  it("responde 200 equivalente ao GET quando DB funciona", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ result: 1 }]);

    const res = await HEAD();
    expect(res.status).toBe(200);
  });

  it("responde 503 equivalente ao GET quando DB falha", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(
      new Error("Connection refused")
    );

    const res = await HEAD();
    expect(res.status).toBe(503);
  });
});
