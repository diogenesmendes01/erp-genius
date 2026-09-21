import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ reservas: vi.fn(), outras: vi.fn() }));
vi.mock("@/server/matricula/reserva-particular-cron", () => ({ rodarVencimentoParticulares: m.reservas }));
vi.mock("@/server/agenda/inicio-turmas", () => ({ iniciarTurmasDaAgenda: m.outras }));
vi.mock("@/server/cobrancas/acesso-aulas", () => ({ rodarControleAcessoAulas: m.outras }));
vi.mock("@/server/whatsapp/cron", () => ({ rodarCronRegua: m.outras }));
vi.mock("@/server/whatsapp/cron-comercial", () => ({ rodarLeadNovoSemResposta: m.outras, rodarNoShow: m.outras, rodarPreExperimental: m.outras }));
vi.mock("@/server/whatsapp/despachante", () => ({ despacharFila: m.outras }));
vi.mock("@/server/contratos/vencimento-acesso", () => ({ rodarReconciliacaoAcessoVencimento: m.outras }));
import { POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); m.reservas.mockResolvedValue({ avaliadas: 0 }); m.outras.mockResolvedValue({}); });
afterEach(() => vi.unstubAllEnvs());
it("não executa rotinas sem configuração do segredo", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await POST(new Request("https://example.test/cron", { method: "POST" }))).status).toBe(503);
  expect(m.reservas).not.toHaveBeenCalled(); expect(m.outras).not.toHaveBeenCalled();
});
it("recusa segredo incorreto antes de qualquer processamento", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  expect((await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "incorreto" } }))).status).toBe(401);
  expect(m.reservas).not.toHaveBeenCalled(); expect(m.outras).not.toHaveBeenCalled();
});
it("chamada autenticada inclui a conferência de reservas", async () => {
  vi.stubEnv("CRON_SECRET", "segredo-fixture");
  const resposta = await POST(new Request("https://example.test/cron", { method: "POST", headers: { "x-cron-secret": "segredo-fixture" } }));
  expect(resposta.status).toBe(200);
  expect(await resposta.json()).toMatchObject({ reservasParticulares: { avaliadas: 0 } });
  expect(m.reservas).toHaveBeenCalledTimes(1);
});
