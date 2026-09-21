import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ processar: vi.fn(), entregar: vi.fn() }));
vi.mock("@/server/comunicacoes-agenda/avisos", () => ({ processarAvisosAlteracaoAgenda: m.processar, entregarAvisoAlteracaoAgenda: m.entregar }));
import { POST } from "./route";

describe("cron de avisos de agenda", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CRON_SECRET", "segredo"); });
  afterEach(() => vi.unstubAllEnvs());
  it("exige segredo e não executa com o gate desligado", async () => {
    expect((await POST(new Request("http://x"))).status).toBe(401);
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "false");
    const resposta = await POST(new Request("http://x", { headers: { "x-cron-secret": "segredo" } }));
    expect(await resposta.json()).toMatchObject({ executou: false });
    expect(m.processar).not.toHaveBeenCalled();
  });
  it("aciona o worker apenas com gate explícito", async () => {
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true"); m.processar.mockResolvedValue(2);
    const resposta = await POST(new Request("http://x", { headers: { "x-cron-secret": "segredo" } }));
    expect(await resposta.json()).toMatchObject({ executou: true, processados: 2 });
  });
});
