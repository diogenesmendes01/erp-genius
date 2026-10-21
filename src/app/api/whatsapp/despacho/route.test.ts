import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ despachar: vi.fn() }));
vi.mock("@/server/whatsapp/despachante", () => ({ despacharFila: m.despachar }));
import { POST } from "./route";
const req = (h?: Record<string, string>) => new Request("https://example.test/despacho", { method: "POST", headers: h });
beforeEach(() => { vi.resetAllMocks(); m.despachar.mockResolvedValue({ avaliadas: 0 }); });
afterEach(() => vi.unstubAllEnvs());

it("503 sem segredo configurado", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await POST(req())).status).toBe(503);
  expect(m.despachar).not.toHaveBeenCalled();
});
it("401 sem segredo ou com segredo incorreto", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  expect((await POST(req())).status).toBe(401);
  expect((await POST(req({ "x-cron-secret": "incorreto" }))).status).toBe(401);
  expect(m.despachar).not.toHaveBeenCalled();
});
it("200 chama despacharFila uma vez", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  const r = await POST(req({ "x-cron-secret": "segredo-fixture" }));
  expect(r.status).toBe(200);
  expect(m.despachar).toHaveBeenCalledTimes(1);
  expect(m.despachar.mock.calls[0][0]).toBeInstanceOf(Date);
});
