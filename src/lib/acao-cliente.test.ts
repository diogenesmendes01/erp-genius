import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { criarExecutor, executarAcaoCliente } from "./acao-cliente";
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

// O hook só liga useState/useRef ao criarExecutor; o comportamento é testado aqui, sem renderizador
// (o projeto não tem jsdom/RTL e AGENTS.md não permite instalar dependência).
function executorDeTeste(idempotente = true) {
  const estado = { ocupado: false, erro: null as string | null, sucesso: null as string | null, historicoOcupado: [] as boolean[] };
  const executar = criarExecutor({
    setOcupado: (v) => { estado.ocupado = v; estado.historicoOcupado.push(v); },
    setErro: (v) => { estado.erro = v; },
    setSucesso: (v) => { estado.sucesso = v; },
  }, { idempotente });
  return { estado, executar };
}

function adiada<T>() {
  let resolver!: (v: T) => void, rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => { resolver = res; rejeitar = rej; });
  return { promessa, resolver, rejeitar };
}

describe("criarExecutor (comportamento do useAcaoCliente)", () => {
  it("duplo clique: a segunda chamada durante a primeira é ignorada (null) e a action roda uma vez só", async () => {
    const { estado, executar } = executorDeTeste();
    const pendente = adiada<{ ok: true }>();
    let chamadas = 0;
    const acao = () => { chamadas++; return pendente.promessa; };
    const primeira = executar(acao);
    expect(estado.ocupado).toBe(true);
    await expect(executar(acao)).resolves.toBeNull();
    pendente.resolver({ ok: true });
    await expect(primeira).resolves.toEqual({ tipo: "ok", dado: undefined });
    expect(chamadas).toBe(1);
  });

  it("depois de concluir, libera a trava: um novo clique volta a executar", async () => {
    const { executar } = executorDeTeste();
    await executar(async () => ({ ok: true }));
    await expect(executar(async () => ({ ok: true }))).resolves.toEqual({ tipo: "ok", dado: undefined });
  });

  it.each([
    ["sucesso", async () => ({ ok: true as const }), { erro: null, sucesso: "Salvo." }],
    ["erro de negócio", async () => ({ ok: false as const, erro: "Cobrança já quitada." }), { erro: "Cobrança já quitada.", sucesso: null }],
    ["falha de transporte", () => Promise.reject(new Error("rede")), { erro: MSG_RESULTADO_INCERTO, sucesso: null }],
  ])("%s: ocupado volta a false e erro/sucesso refletem o desfecho", async (_nome, acao, esperado) => {
    const { estado, executar } = executorDeTeste();
    await executar(acao, "Salvo.");
    expect(estado.historicoOcupado).toEqual([true, false]);
    expect({ erro: estado.erro, sucesso: estado.sucesso }).toEqual(esperado);
  });

  it("nova execução limpa o erro/sucesso da anterior antes de começar", async () => {
    const { estado, executar } = executorDeTeste();
    await executar(async () => ({ ok: false as const, erro: "Motivo curto." }));
    const pendente = adiada<{ ok: true }>();
    const segunda = executar(() => pendente.promessa);
    expect(estado.erro).toBeNull();
    pendente.resolver({ ok: true });
    await segunda;
  });

  it("mensagem de sucesso derivada do dado", async () => {
    const { estado, executar } = executorDeTeste();
    await executar(async () => ({ ok: true as const, dado: { aprovacao: true } }), (d) => d?.aprovacao ? "Enviado para aprovação." : "Aplicado.");
    expect(estado.sucesso).toBe("Enviado para aprovação.");
  });

  it("se a mensagem de sucesso lançar, o ocupado e a trava são liberados mesmo assim", async () => {
    const { estado, executar } = executorDeTeste();
    await expect(executar(async () => ({ ok: true as const }), () => { throw new Error("bug no rótulo"); })).rejects.toThrow("bug no rótulo");
    expect(estado.ocupado).toBe(false);
    await expect(executar(async () => ({ ok: true as const }))).resolves.not.toBeNull(); // trava liberada
  });

  it("sem chave de idempotência, a falha de transporte usa a mensagem que manda conferir antes de repetir", async () => {
    const { estado, executar } = executorDeTeste(false);
    await executar(() => Promise.reject(new Error("rede")));
    expect(estado.erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
  });
});

describe("FeedbackAcao", () => {
  it("tela que anuncia sucesso: a região polite existe vazia antes do texto, nada visível", () => {
    expect(renderToStaticMarkup(createElement(FeedbackAcao, { erro: null, sucesso: null }))).toBe('<p role="status" class="sr-only"></p>');
  });

  it("tela que só mostra erro (sem prop sucesso): nenhuma região polite vazia a mais", () => {
    expect(renderToStaticMarkup(createElement(FeedbackAcao, { erro: null }))).toBe("");
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
