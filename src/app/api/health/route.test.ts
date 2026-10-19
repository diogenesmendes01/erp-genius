import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "./route";

// Trava o contrato de liveness (/api/health): Next de pé, sem autenticação e sem dependências
// externas. O healthcheck do Coolify usa /api/ready (readiness com banco), não este endpoint. Mutações cobradas (review #123 B4):
// - Alterar status 200 → 503 → deve falhar
// - Remover HEAD exportado → deve falhar
// SHA do build (#165): o commit entra pelo build-arg GIT_SHA do Dockerfile e vira variável de ambiente.

describe("GET /api/health", () => {
  it("responde 200 com { ok: true, timestamp }", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("timestamp");
    expect(typeof body.timestamp).toBe("string");
    // Validar formato ISO 8601 (yyyy-mm-ddThh:mm:ss.sssZ)
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("HEAD /api/health", () => {
  it("está exportado (wget --spider usa HEAD)", () => {
    // Trava: HEAD deve existir e ser o mesmo handler do GET (ou funcionar equivalente).
    expect(HEAD).toBeDefined();
    expect(typeof HEAD).toBe("function");
  });

  it("responde 200 equivalente ao GET", async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
  });
});

describe("SHA do build em /api/health (#165)", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("devolve o SHA do commit que veio no build", async () => {
    vi.stubEnv("GIT_SHA", "914dece1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7");
    const body = await (await GET()).json();
    expect(body).toHaveProperty("sha", "914dece1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7");
    expect(body).toHaveProperty("ok", true);
  });

  it("sem o valor, devolve \"desconhecido\"", async () => {
    vi.stubEnv("GIT_SHA", "");
    expect((await (await GET()).json()).sha).toBe("desconhecido");
    vi.stubEnv("GIT_SHA", "   ");
    expect((await (await GET()).json()).sha).toBe("desconhecido");
  });

  it("valor que não tem forma de SHA não é repetido na resposta", async () => {
    vi.stubEnv("GIT_SHA", "postgresql://user:senha@db/erp");
    expect((await (await GET()).json()).sha).toBe("desconhecido");
  });

  it("aceita o SHA curto e normaliza para minúsculas", async () => {
    vi.stubEnv("GIT_SHA", " 914DECE1 ");
    expect((await (await GET()).json()).sha).toBe("914dece1");
  });

  it("continua sem autenticação: a liveness não pede CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "segredo");
    vi.stubEnv("GIT_SHA", "914dece1");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
