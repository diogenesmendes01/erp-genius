import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { executarAcaoCliente } from "./acao-cliente";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "./mensagens";
import { FeedbackAcao } from "@/components/FeedbackAcao";

describe("executarAcaoCliente", () => {
  it("sucesso devolve o dado da action", async () => {
    await expect(executarAcaoCliente(async () => ({ ok: true, dado: { id: "p1" } }), { idempotente: true }))
      .resolves.toEqual({ tipo: "ok", dado: { id: "p1" } });
  });

  it("erro de negócio passa a mensagem do servidor adiante, sem reescrever", async () => {
    await expect(executarAcaoCliente(async () => ({ ok: false, erro: "Cobrança já quitada." }), { idempotente: true }))
      .resolves.toEqual({ tipo: "erro", mensagem: "Cobrança já quitada." });
  });

  it("falha de transporte com chave idempotente: resultado incerto, instrução de reenviar a mesma entrada", async () => {
    const desfecho = await executarAcaoCliente(() => Promise.reject(new TypeError("Failed to fetch")), { idempotente: true });
    expect(desfecho).toEqual({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO });
  });

  it("falha de transporte sem chave: manda conferir antes de repetir — nunca \"reenvie\"", async () => {
    const desfecho = await executarAcaoCliente(() => Promise.reject(new Error("rede")), { idempotente: false });
    expect(desfecho).toEqual({ tipo: "incerto", mensagem: MSG_RESULTADO_INCERTO_SEM_CHAVE });
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).not.toMatch(/reenvi/i);
    expect(MSG_RESULTADO_INCERTO_SEM_CHAVE).toMatch(/antes de repetir/);
  });

  it("exceção síncrona ao montar a chamada também vira resultado incerto (o botão não fica travado)", async () => {
    const desfecho = await executarAcaoCliente(() => { throw new Error("serialização"); }, { idempotente: false });
    expect(desfecho.tipo).toBe("incerto");
  });
});

describe("FeedbackAcao", () => {
  it("sem erro nem sucesso: só a região polite vazia, nada visível", () => {
    expect(renderToStaticMarkup(createElement(FeedbackAcao, { erro: null }))).toBe('<p role="status" class="sr-only"></p>');
  });

  it("erro: alerta focável (recebe o foco e é trazido à vista ao aparecer)", () => {
    const html = renderToStaticMarkup(createElement(FeedbackAcao, { erro: "Cobrança já quitada.", className: "mb-3" }));
    expect(html).toContain('<p tabindex="-1" role="alert" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">Cobrança já quitada.</p>');
  });

  it("sucesso: anunciado pela região polite sempre montada, com a cópia visível fora da leitura", () => {
    const html = renderToStaticMarkup(createElement(FeedbackAcao, { erro: null, sucesso: "Fatura cancelada." }));
    expect(html).toBe('<p role="status" class="sr-only">Fatura cancelada.</p><p aria-hidden="true" class="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Fatura cancelada.</p>');
  });
});
