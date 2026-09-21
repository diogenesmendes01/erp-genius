import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ despacho: vi.fn() }));
vi.mock("./identidade", () => ({ despacharSolicitacaoPortalAlunoInterna: m.despacho }));
import { despacharAcessoPortalResend } from "./envio-resend";
const ambiente = { EMAIL_PORTAL_ENVIO_ENABLED: "true", RESEND_API_KEY: "segredo", EMAIL_INSTITUCIONAL_REMETENTE: "erp@example.test", PORTAL_ALUNO_URL_PUBLICA: "https://escola.example.test" };
beforeEach(() => {
  vi.resetAllMocks();
  m.despacho.mockImplementation(async (_id, callback) => callback({ finalidade: "CONVITE", destinatario: "aluno@example.test", token: "segredo-do-link", caminho: "https://indevido.example/" }));
});
it("usa origem configurada e devolve recibo ao fluxo durável sem expor o link", async () => {
  const id = "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794";
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id })));
  expect(await despacharAcessoPortalResend("pedido-1", { ambiente, fetch })).toEqual({ provedor: "RESEND", provedorId: id });
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.text).toContain("https://escola.example.test/portal-aluno/ativar#token=segredo-do-link");
  expect(body.text).not.toContain("indevido.example");
  expect(body.to).toEqual(["aluno@example.test"]);
  expect(fetch.mock.calls[0][1].headers["Idempotency-Key"]).toMatch(/^portal-acesso\/[a-f0-9]{64}$/);
});
it.each([
  { EMAIL_PORTAL_ENVIO_ENABLED: "false" }, { RESEND_API_KEY: "" },
  { PORTAL_ALUNO_URL_PUBLICA: "http://escola.example.test" }, { PORTAL_ALUNO_URL_PUBLICA: "https://escola.example.test/?host=outro" },
])("configuração insuficiente não cria token ou claim %j", async extra => {
  await expect(despacharAcessoPortalResend("pedido", { ambiente: { ...ambiente, ...extra } })).rejects.toThrow("Envio institucional indisponível.");
  expect(m.despacho).not.toHaveBeenCalled();
});
it("recusa do provedor não é retornada como entrega confirmada ao fluxo", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("erro", { status: 403 }));
  await expect(despacharAcessoPortalResend("pedido", { ambiente, fetch })).rejects.toThrow("Aceitação do envio não confirmada.");
});
