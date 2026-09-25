import { describe, expect, it } from "vitest";
import { GET, HEAD } from "./route";

// Trava o contrato de liveness (/api/health): Next de pé, sem autenticação e sem dependências
// externas. O healthcheck do Coolify usa /api/ready (readiness com banco), não este endpoint. Mutações cobradas (review #123 B4):
// - Alterar status 200 → 503 → deve falhar
// - Remover HEAD exportado → deve falhar

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
