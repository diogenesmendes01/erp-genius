import { expect, it, vi } from "vitest";
import { enviarEmailResend } from "./resend";
const ambiente = { RESEND_API_KEY: "segredo", EMAIL_INSTITUCIONAL_REMETENTE: "erp@example.test" };
const mensagem = { destinatario: "aluno@example.test", assunto: "Convite", texto: "Defina seu acesso.", chaveIdempotencia: "convite/123" };
const id = "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794";
it("envia a um destinatário com chave estável e retorna aceitação, sem declarar entrega", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id })));
  expect(await enviarEmailResend(mensagem, { ambiente, fetch })).toEqual({ situacao: "ACEITO", provedorId: id });
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", headers: { "Idempotency-Key": "convite/123" } });
  expect(JSON.parse(init.body)).toEqual({ from: "erp@example.test", to: ["aluno@example.test"], subject: "Convite", text: "Defina seu acesso." });
});
it.each([409, 429, 500, 503])("status %s permanece incerto e não dispara retry", async status => {
  const fetch = vi.fn().mockResolvedValue(new Response("segredo externo", { status }));
  expect(await enviarEmailResend(mensagem, { ambiente, fetch })).toEqual({ situacao: "INCERTO" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([400, 401, 403, 422])("status %s indica recusa", async status => {
  const fetch = vi.fn().mockResolvedValue(new Response("erro", { status }));
  expect(await enviarEmailResend(mensagem, { ambiente, fetch })).toEqual({ situacao: "RECUSADO" });
});
it("configuração inválida e múltiplos endereços não iniciam requisição", async () => {
  const fetch = vi.fn();
  await expect(enviarEmailResend(mensagem, { ambiente: {}, fetch })).rejects.toThrow("Envio institucional indisponível.");
  await expect(enviarEmailResend({ ...mensagem, destinatario: "a@example.test,b@example.test" }, { ambiente, fetch })).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("resposta de sucesso sem identificador válido é incerta", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "segredo" })));
  expect(await enviarEmailResend(mensagem, { ambiente, fetch })).toEqual({ situacao: "INCERTO" });
});
it("timeout mesmo quando fetch ignora cancelamento é incerto e não repete", async () => {
  vi.useFakeTimers();
  try {
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    const operacao = enviarEmailResend(mensagem, { ambiente, fetch, timeoutMs: 20 });
    await vi.advanceTimersByTimeAsync(20);
    expect(await operacao).toEqual({ situacao: "INCERTO" });
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
it("abortamento anterior não envia", async () => {
  const controle = new AbortController(); controle.abort();
  const fetch = vi.fn();
  expect(await enviarEmailResend(mensagem, { ambiente, fetch, signal: controle.signal })).toEqual({ situacao: "RECUSADO" });
  expect(fetch).not.toHaveBeenCalled();
});
