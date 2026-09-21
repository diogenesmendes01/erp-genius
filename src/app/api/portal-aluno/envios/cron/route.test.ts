import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ processar: vi.fn() }));
vi.mock("@/server/portal-aluno/processar-envios", () => ({ processarEnviosPortalAluno: m.processar }));
import { POST } from "./route";

beforeEach(() => {
  m.processar.mockReset();
  vi.stubEnv("CRON_SECRET", "segredo-teste");
  vi.stubEnv("EMAIL_PORTAL_ENVIO_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
const req = (query = "", segredo = "segredo-teste") => new Request(`https://escola.example.test/api/portal-aluno/envios/cron${query}`, {
  method: "POST", headers: { "x-cron-secret": segredo },
});

it("exige configuração e autenticação antes do processamento", async () => {
  expect((await POST(req("", "errado"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "");
  expect((await POST(req())).status).toBe(503);
  expect(m.processar).not.toHaveBeenCalled();
});
it("permanece desligado sem habilitação explícita", async () => {
  vi.stubEnv("EMAIL_PORTAL_ENVIO_ENABLED", "false");
  expect(await (await POST(req())).json()).toEqual({ executou: false, motivo: "envio_desligado" });
  expect(m.processar).not.toHaveBeenCalled();
});
it("valida cursor antes de acessar a fila", async () => {
  expect((await POST(req("?cursor="))).status).toBe(400);
  expect((await POST(req(`?cursor=${"a".repeat(101)}`))).status).toBe(400);
  expect(m.processar).not.toHaveBeenCalled();
});
it("encaminha cursor e devolve resultado do lote", async () => {
  const resultado = { habilitado: true, processados: 20, aceitosPeloProvedor: 18, incertos: 1, pendencias: 1, proximoCursor: "id-20" };
  m.processar.mockResolvedValue(resultado);
  expect(await (await POST(req("?cursor=id-00"))).json()).toEqual(resultado);
  expect(m.processar).toHaveBeenCalledWith({ cursor: "id-00" });
});
it("falha operacional não expõe a mensagem interna", async () => {
  m.processar.mockRejectedValue(new Error("token e destinatário privados"));
  const resposta = await POST(req());
  expect(resposta.status).toBe(503);
  expect(await resposta.text()).not.toContain("privados");
});
