import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { criarLojaNaoLidas, SeloNaoLidasInbox } from "./SeloNaoLidasInbox";
const resposta = (total: number) => new Response(JSON.stringify({ total }));
const tick = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
describe("selo pessoal de conversas", () => {
  it("SSR independente por usuário sem buscar; pílula99+ e zero vazio", () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    try { expect(renderToStaticMarkup(createElement(SeloNaoLidasInbox, { inicial: 120, variante: "pilula" }))).toMatch(/99\+<span class="sr-only"> conversas não lidas<\/span>/);
      expect(renderToStaticMarkup(createElement(SeloNaoLidasInbox, { inicial: 0, variante: "pilula" }))).toBe(""); expect(fetcher).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it("relevância, busca única em voo e somente uma repetição pendente", async () => {
    let liberar!: (r: Response) => void; const buscar = vi.fn().mockImplementationOnce(() => new Promise<Response>(r => { liberar = r; })).mockResolvedValue(resposta(4));
    const loja = criarLojaNaoLidas(2, buscar);
    loja.aoAviso({ tipo: "mensagem.status", atendimentoId: "a", mensagemId: "m", conversaId: "c" }); expect(buscar).not.toHaveBeenCalled();
    loja.recontar(); loja.recontar(); loja.recontar(); expect(buscar).toHaveBeenCalledTimes(1); liberar(resposta(3));
    await vi.waitFor(() => expect(loja.valor()).toBe(4)); expect(buscar).toHaveBeenCalledTimes(2);
  });
  it("erro preserva valor e drena pendente, auth limpa; respostas inválidas não entram", async () => {
    let rejeitar!: (e: Error) => void; const buscar = vi.fn().mockImplementationOnce(() => new Promise<Response>((_, r) => { rejeitar = r; })).mockResolvedValueOnce(resposta(5)).mockResolvedValueOnce(new Response("", { status: 403 })).mockResolvedValueOnce(resposta(-1));
    const loja = criarLojaNaoLidas(2, buscar); loja.recontar(); loja.recontar(); rejeitar(Error("rede")); await vi.waitFor(() => expect(loja.valor()).toBe(5));
    loja.recontar(); await vi.waitFor(() => expect(loja.valor()).toBe(0)); loja.recontar(); await tick(); expect(loja.valor()).toBe(0);
  });
  it.each([401, 403])("auth%s limpa total sem repetição automática", async (status) => {
    const buscar = vi.fn(async () => new Response("", { status })); const loja = criarLojaNaoLidas(9, buscar);
    loja.recontar(); loja.recontar(); await vi.waitFor(() => expect(loja.valor()).toBe(0)); expect(buscar).toHaveBeenCalledTimes(1);
  });
  it("dispose ignora resposta velha e remount espera voo anterior sem concorrência", async () => {
    let liberar!: (r: Response) => void; const buscar = vi.fn().mockImplementationOnce(() => new Promise<Response>(r => { liberar = r; })).mockResolvedValue(resposta(8));
    const loja = criarLojaNaoLidas(2, buscar); const mudar = vi.fn(); const sair = loja.subscribe(mudar); loja.recontar(); sair();
    const sairNovo = loja.subscribe(mudar); loja.recontar(); expect(buscar).toHaveBeenCalledTimes(1); liberar(resposta(99)); await vi.waitFor(() => expect(loja.valor()).toBe(8));
    expect(mudar).toHaveBeenCalledTimes(1); sairNovo();
  });
});

it("rótulo acessível flexiona uma conversa e preserva plural/99+/zero", () => {
  const html = (inicial: number) => renderToStaticMarkup(createElement(SeloNaoLidasInbox, { inicial, variante: "pilula" }));
  expect(html(1)).toContain('1<span class="sr-only"> conversa não lida</span>');
  expect(html(2)).toContain('2<span class="sr-only"> conversas não lidas</span>');
  expect(html(120)).toContain('99+<span class="sr-only"> conversas não lidas</span>');
  expect(html(0)).toBe("");
});

function respostaLenta(status = 200) {
  let controle!: ReadableStreamDefaultController<Uint8Array>;
  let encerrada = false;
  const corpo = new ReadableStream<Uint8Array>({ start(c) { controle = c; } });
  return {
    resposta: new Response(corpo, { status }),
    fechar(texto = '{"total":99}') { if (encerrada) return; encerrada = true; controle.enqueue(new TextEncoder().encode(texto)); controle.close(); },
    falhar() { if (encerrada) return; encerrada = true; controle.error(Error("falha de corpo")); },
  };
}
describe("um GET real até o término do corpo", () => {
  it("geração obsoleta drena corpo antes de iniciar a única repetição do remount", async () => {
    const lenta = respostaLenta();
    const buscar = vi.fn().mockResolvedValueOnce(lenta.resposta).mockImplementation(async () => resposta(8));
    const loja = criarLojaNaoLidas(2, buscar), notificar = vi.fn();
    const sair = loja.subscribe(notificar); loja.recontar(); sair();
    const sairNovo = loja.subscribe(notificar); loja.recontar(); loja.recontar();
    try {
      await tick(); expect(buscar).toHaveBeenCalledTimes(1);
      expect(lenta.resposta.bodyUsed).toBe(true); expect(loja.valor()).toBe(2); expect(notificar).not.toHaveBeenCalled();
      lenta.fechar(); await vi.waitFor(() => expect(loja.valor()).toBe(8));
      expect(buscar).toHaveBeenCalledTimes(2); expect(notificar).toHaveBeenCalledTimes(1);
    } finally { lenta.fechar(); sairNovo(); await tick(); }
  });
  it.each([401, 403])("auth%s limpa total e pendência, mas ainda consome o corpo", async status => {
    const lenta = respostaLenta(status), buscar = vi.fn(async () => lenta.resposta), loja = criarLojaNaoLidas(9, buscar);
    loja.recontar(); loja.recontar();
    try {
      await tick(); expect(loja.valor()).toBe(0); expect(lenta.resposta.bodyUsed).toBe(true);
      expect(buscar).toHaveBeenCalledTimes(1); lenta.fechar('{"erro":"sem acesso"}');
      await tick(); expect(buscar).toHaveBeenCalledTimes(1); expect(loja.valor()).toBe(0);
    } finally { lenta.fechar(); await tick(); }
  });
  it.each(["fechar", "falhar"] as const)("5xx mantém total e espera corpo%s antes da pendente", async terminar => {
    const lenta = respostaLenta(503);
    const buscar = vi.fn().mockResolvedValueOnce(lenta.resposta).mockImplementation(async () => resposta(4));
    const loja = criarLojaNaoLidas(2, buscar); loja.recontar(); loja.recontar();
    try {
      await tick(); expect(buscar).toHaveBeenCalledTimes(1); expect(loja.valor()).toBe(2); expect(lenta.resposta.bodyUsed).toBe(true);
      lenta[terminar](); await vi.waitFor(() => expect(loja.valor()).toBe(4)); expect(buscar).toHaveBeenCalledTimes(2);
    } finally { lenta.fechar(); await tick(); }
  });
  it.each(["fechar", "falhar"] as const)("JSON em leitura%s não abre segunda busca; dispose ignora valor antigo", async terminar => {
    const lenta = respostaLenta(), buscar = vi.fn().mockResolvedValueOnce(lenta.resposta).mockImplementation(async () => resposta(6));
    const loja = criarLojaNaoLidas(2, buscar), notificar = vi.fn(), sair = loja.subscribe(notificar);
    loja.recontar(); await tick(); expect(lenta.resposta.bodyUsed).toBe(true);
    sair(); const sairNovo = loja.subscribe(notificar); loja.recontar();
    try {
      await tick(); expect(buscar).toHaveBeenCalledTimes(1); expect(loja.valor()).toBe(2);
      if (terminar === "fechar") lenta.fechar("JSON inválido"); else lenta.falhar();
      await vi.waitFor(() => expect(loja.valor()).toBe(6)); expect(buscar).toHaveBeenCalledTimes(2); expect(notificar).toHaveBeenCalledTimes(1);
    } finally { lenta.fechar(); sairNovo(); await tick(); }
  });
});
