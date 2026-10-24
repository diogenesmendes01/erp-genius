import { EventEmitter } from "node:events";
import { expect, it } from "vitest";
const base = "http://localhost:3111", url = base + "/api/inbox/atendimentos/a/painel/detalhes";
const corpo = { pessoa: { nome: "Ana" }, campos: [] };
const prova = { base, contextoId: "ctx", paginaId: "pag", atendimentoId: "a", atendimentoAtualId: "a", corpoEsperadoSha256: "d3c6ec04c958e8823e0c3c4cb33f7fd7bd9cc48bf9ca58b448bdc290ff5b2e14", paginaAtiva: true, semanticaFinal: true };
async function modulo() { const p = "../../scripts/visual/" + "coletor-detalhes.mjs"; const x = await import(p).catch(() => null); expect(x, "coletor START→settled ausente").not.toBeNull(); return x!; }
function pagina() {
  let fechada = false, conectado = true;
  const emissor = new EventEmitter(), browser = { isConnected: () => conectado }, contexto = { browser: () => browser };
  return Object.assign(emissor, { isClosed: () => fechada, context: () => contexto, fecharPagina() { fechada = true; emissor.emit("close"); }, fecharBrowser() { conectado = false; } });
}
function pedido(p: ReturnType<typeof pagina>, json: () => Promise<unknown> = async () => corpo, endereco = url) {
  let erro = "net::ERR_ABORTED";
  const q = { method: () => "GET", url: () => endereco, frame: () => ({ page: () => p }), failure: () => ({ errorText: erro }), response: async () => r, falhar(v = "net::ERR_ABORTED") { erro = v; p.emit("requestfailed", q); } };
  const r = { request: () => q, status: () => 200, finished: async () => null, json };
  return { q, r, iniciar() { p.emit("request", q); }, terminar() { p.emit("response", r); p.emit("requestfinished", q); } };
}
const turno = () => new Promise<void>(r => setTimeout(r, 0));
async function fechar(p: ReturnType<typeof pagina>, c: { encerrar(): Promise<unknown> }) { p.fecharPagina(); p.fecharBrowser(); return c.encerrar(); }
it("35abortado/38íntegro não libera barreira enquanto48 está em voo; erro48 não é mascarado por38", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova, { timeoutMs: 1000 });
  const a = pedido(p), b = pedido(p), d = pedido(p); a.iniciar(); a.q.falhar(); b.iniciar(); b.terminar(); d.iniciar();
  let acabou = false; const espera = c.aguardar().then((v: unknown) => { acabou = true; return v; }); await turno(); expect(acabou).toBe(false);
  d.q.falhar(); const token = await espera; expect(c.estado().pendentes).toBe(0); expect(() => c.selar(token, prova)).toThrow();
  const r = await fechar(p, c) as { aceitavel: boolean; falhas: string[] }; expect(r.aceitavel).toBe(false); expect(r.falhas.length).toBeGreaterThan(0);
});
it("START adicionado enquanto body anterior é lido também pertence à barreira dinâmica", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova, { timeoutMs: 1000 });
  let liberar!: (v: unknown) => void; const lento = new Promise(r => { liberar = r; });
  const a = pedido(p, () => lento), b = pedido(p); void lento.then(() => b.iniciar()); a.iniciar(); a.terminar();
  let acabou = false; const espera = c.aguardar().then((v: unknown) => { acabou = true; return v; }); await turno();
  liberar(corpo); await turno(); expect(acabou).toBe(false); expect(c.estado().iniciados).toBe(2);
  b.terminar(); const token = await espera; c.selar(token, prova);
  const r = await fechar(p, c) as { aceitavel: boolean; pendentes: number }; expect(r.aceitavel).toBe(true); expect(r.pendentes).toBe(0); expect(p.listenerCount("request")).toBe(0);
});
it("finished sem body/hash terminado continua pendente e timeout conservador reprova", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova, { timeoutMs: 20 });
  let liberar!: (v: unknown) => void; const corpoLento = new Promise(r => { liberar = r; }); const a = pedido(p, () => corpoLento); a.iniciar(); a.terminar();
  await expect(c.aguardar()).rejects.toThrow(/timeout/i); liberar(corpo); await turno();
  const r = await fechar(p, c) as { aceitavel: boolean }; expect(r.aceitavel).toBe(false);
});
it("novoSTART e failure durante finallyclose após selo tornam captura negativa na auditoria final", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova, { timeoutMs: 1000 }); const a = pedido(p); a.iniciar(); a.terminar();
  c.selar(await c.aguardar(), prova); const captura = { falhas: [] as string[], diagnosticos: [] as unknown[] };
  const tardio = pedido(p); tardio.iniciar(); p.fecharPagina(); await turno(); tardio.q.falhar(); p.fecharBrowser();
  await x.finalizarCapturasDetalhes325([{ coletor: c, captura }]);
  expect(captura.falhas.length).toBeGreaterThan(0); expect((captura as typeof captura & { aceiteCandidato: boolean }).aceiteCandidato).toBe(false);
});
it("failure tardio depois de barreira/finished é coletado antes do veredito, sem falso verde", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova);
  p.fecharPagina(); a.q.falhar(); p.fecharBrowser(); const r = await c.encerrar(); expect(r.aceitavel).toBe(false); expect(r.falhas.length).toBeGreaterThan(0);
});
it("token anterior a START novo não sela mesmo quando o novo body já terminou", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova); const a = pedido(p); a.iniciar(); a.terminar(); const token = await c.aguardar();
  const b = pedido(p); b.iniciar(); b.terminar(); await c.aguardar(); expect(() => c.selar(token, prova)).toThrow();
  expect((await fechar(p, c) as { aceitavel: boolean }).aceitavel).toBe(false);
});
it("SSE e queryfora não entram na barreira do endpoint finito exato", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova, { timeoutMs: 1000 });
  pedido(p, async () => corpo, base + "/api/inbox/eventos").iniciar(); pedido(p, async () => corpo, url + "?x=1").iniciar();
  await c.aguardar(); expect(c.estado().iniciados).toBe(0); expect(c.estado().pendentes).toBe(0); await fechar(p, c);
});
it("encerrar exige browser fechado e não descarta listeners enquanto transporte ainda vive", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova); p.fecharPagina();
  await expect(c.encerrar()).rejects.toThrow(/browser/i); expect(p.listenerCount("request")).toBeGreaterThan(0); p.fecharBrowser(); expect((await c.encerrar()).aceitavel).toBe(true);
});
it("35abortado e substitutos38/48 íntegros permitem selo só depois dos três settled", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova); const a = pedido(p), b = pedido(p), d = pedido(p);
  a.iniciar(); a.q.falhar(); b.iniciar(); b.terminar(); d.iniciar(); d.terminar(); c.selar(await c.aguardar(), prova);
  const r = await fechar(p, c) as { aceitavel: boolean; iniciados: number; settled: number; diagnosticos: unknown[] };
  expect(r.aceitavel).toBe(true); expect(r.iniciados).toBe(3); expect(r.settled).toBe(3); expect(r.diagnosticos).toHaveLength(1);
});
it("body48 diferente é falha agregada mesmo com body38 correto e DOM aparentemente válido", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova); const a = pedido(p), b = pedido(p), d = pedido(p, async () => ({ pessoa: { nome: "Outra" }, campos: [] }));
  a.iniciar(); a.q.falhar(); b.iniciar(); b.terminar(); d.iniciar(); d.terminar(); const token = await c.aguardar(); expect(() => c.selar(token, prova)).toThrow(/falha/);
  const r = await fechar(p, c) as { aceitavel: boolean; falhas: string[] }; expect(r.aceitavel).toBe(false); expect(r.falhas.some(f => f.startsWith("HEADERS_BODY_OU_HASH_INVALIDO:"))).toBe(true);
});
it("listeners pós-contextclose capturam evento que chega depois da auditoria parcial, antes de browserclose", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova); p.fecharPagina();
  expect((await c.auditarFechamento()).falhas).toHaveLength(0); expect(p.listenerCount("requestfailed")).toBeGreaterThan(0);
  a.q.falhar(); p.fecharBrowser(); const captura = { falhas: [] as string[], diagnosticos: [] as unknown[] };
  await x.finalizarCapturasDetalhes325([{ coletor: c, captura }]); expect(captura.falhas.length).toBeGreaterThan(0); expect((captura as typeof captura & { aceiteCandidato: boolean }).aceiteCandidato).toBe(false);
});
it("ponte doCLI preserva falha conservadora quando browserclose não foi confirmado", async () => {
  const x = await modulo(), p = pagina(), c = x.instalarColetorDetalhes325(p, prova); const a = pedido(p); a.iniciar(); a.terminar(); c.selar(await c.aguardar(), prova); p.fecharPagina();
  const captura = { falhas: [] as string[], diagnosticos: [] as unknown[] }; await x.finalizarCapturasDetalhes325([{ coletor: c, captura }]);
  expect(captura.falhas).toContain("AUDITORIA_FINAL_NAO_CONFIRMADA"); expect((captura as typeof captura & { aceiteCandidato: boolean }).aceiteCandidato).toBe(false);
  p.fecharBrowser(); await c.encerrar();
});
