import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { combinacoes, ESTADOS } from "../../scripts/visual/nucleo-captura.mjs";
import * as espera from "../../scripts/visual/espera-app.mjs";
const m = vi.hoisted(() => ({ auth: vi.fn(async () => {}), conteudo: vi.fn(async () => {}), hidratacao: vi.fn(async () => {}) }));
vi.mock("../../scripts/visual/espera-app.mjs", async original => ({ ...await original<object>(), autenticarApp: m.auth, esperarConteudoApp: m.conteudo, esperarHidratacaoApp: m.hidratacao }));
import { abrirApp } from "../../scripts/visual/capturar-inbox.mjs";
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
const api = espera as unknown as { confirmarPainelSecretaria(c: unknown, b: string, id: string): Promise<unknown> };
it("335 acrescenta só seis APP sem retirar as176 combinações anteriores ou inventar protótipo Secretaria", () => {
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: ["painel-secretaria"] })).toHaveLength(6);
  expect(ESTADOS["painel-secretaria"].prototipo).toBe(false);
  expect(ESTADOS["painel-secretaria"].motivoSemReferencia).toMatch(/matrícula|Secretaria/);
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: Object.keys(ESTADOS).filter(e => !["painel-detalhes-pessoa", "painel-detalhes-b2b", "painel-detalhes-convidado"].includes(e) && e !== "painel-secretaria" && !e.startsWith("entrada-")) })).toHaveLength(176);
});
it("CLI335 confirma o GET autorizado e abre o painel sem exigir mensagem inexistente", async () => {
  vi.stubEnv("INBOX_VISUAL_SECRETARIA", "secretaria335");
  const ordem: string[] = [], click = vi.fn(async () => { ordem.push("abrir"); });
  const get = vi.fn(async () => { ordem.push("GET"); return { status: () => 200, json: async () => ({ setor: "SECRETARIA", matriculaId: "m335", matriculaCodigo: "MAT-335" }) }; });
  const goto = vi.fn(async () => { ordem.push("goto"); });
  const p = Object.assign(new EventEmitter(), { goto, locator: () => ({ isVisible: async () => false }), getByRole: () => ({ click }), waitForFunction: vi.fn(async () => {}) });
  const r = await abrirApp(p as never, { request: { get } } as never, "http://localhost:3110", { mariana: "m", beatriz: "b" } as never, "painel-secretaria", "celular");
  expect(get).toHaveBeenCalledWith("http://localhost:3110/api/inbox/atendimentos/secretaria335/painel");
  expect(goto).toHaveBeenCalledWith("http://localhost:3110/inbox?c=secretaria335", { waitUntil: "domcontentloaded" });
  expect(ordem.indexOf("GET")).toBeLessThan(ordem.indexOf("goto")); expect(click).toHaveBeenCalledOnce();
  expect(m.conteudo).not.toHaveBeenCalledWith(p, "conversa", "celular"); expect(m.hidratacao).toHaveBeenCalled();
  expect(r.metadados).toMatchObject({ painelSecretariaReal: { status: 200, matriculaId: "m335", codigo: "MAT-335" } });
});
it.each([
  { status: 404, setor: "SECRETARIA", matriculaId: "m", matriculaCodigo: "MAT" },
  { status: 200, setor: "COMERCIAL", matriculaId: "m", matriculaCodigo: "MAT" },
  { status: 200, setor: "SECRETARIA", matriculaId: null, matriculaCodigo: "MAT" },
  { status: 200, setor: "SECRETARIA", matriculaId: "m", matriculaCodigo: " " },
])("preflight335 nega contexto sem matrícula autorizada: %j", async dado => {
  expect(api.confirmarPainelSecretaria).toBeTypeOf("function");
  await expect(api.confirmarPainelSecretaria({ request: { get: async () => ({ status: () => dado.status, json: async () => dado }) } }, "http://localhost:3110", "a")).rejects.toThrow(/Secretaria|matrícula|HTTP/);
});
it("preflight335 codifica ID sem criar parâmetro e preserva código público", async () => {
  expect(api.confirmarPainelSecretaria).toBeTypeOf("function");
  const get = vi.fn(async () => ({ status: () => 200, json: async () => ({ setor: "SECRETARIA", matriculaId: "m335", matriculaCodigo: "MAT-335" }) }));
  await expect(api.confirmarPainelSecretaria({ request: { get } }, "http://localhost:3110", "a?x&b")).resolves.toEqual({ status: 200, matriculaId: "m335", codigo: "MAT-335" });
  expect(get).toHaveBeenCalledWith("http://localhost:3110/api/inbox/atendimentos/a%3Fx%26b/painel");
});
it("335 só libera foto depois do corpo GETmensagens iniciado pela página concluir", async () => {
  vi.stubEnv("INBOX_VISUAL_SECRETARIA", "secretaria335");
  let concluir!: () => void;
  const corpo = new Promise<void>(r => { concluir = r; });
  const p = Object.assign(new EventEmitter(), {
    goto: async () => { p.emit("request", { method: () => "GET", url: () => "http://localhost:3110/api/inbox/atendimentos/secretaria335/mensagens", response: async () => ({ finished: () => corpo }) }); },
    locator: () => ({ isVisible: async () => true }), waitForFunction: vi.fn(async () => {}),
  });
  const contexto = { request: { get: async () => ({ status: () => 200, json: async () => ({ setor: "SECRETARIA", matriculaId: "m335", matriculaCodigo: "MAT-335" }) }) } };
  let liberada = false;
  const captura = abrirApp(p as never, contexto as never, "http://localhost:3110", { mariana: "m", beatriz: "b" } as never, "painel-secretaria", "desktop").then(() => { liberada = true; });
  await new Promise(r => setTimeout(r, 10));
  try { expect(liberada).toBe(false); } finally { concluir(); await captura; }
  expect(liberada).toBe(true); expect(p.listenerCount("request")).toBe(0);
});