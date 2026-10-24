import { afterEach, expect, it, vi } from "vitest";
import { combinacoes, ESTADOS } from "../../scripts/visual/nucleo-captura.mjs";
import { semanticaPainelDetalhesPronto, semanticaPainelSemNomePronto } from "../../scripts/visual/espera-app.mjs";
const m = vi.hoisted(() => ({ auth: vi.fn(async () => {}), conteudo: vi.fn(async () => {}), hidratacao: vi.fn(async () => {}) }));
vi.mock("../../scripts/visual/espera-app.mjs", async original => ({ ...await original<object>(), autenticarApp: m.auth, esperarConteudoApp: m.conteudo, esperarHidratacaoApp: m.hidratacao }));
import { abrirApp } from "../../scripts/visual/capturar-inbox.mjs";
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("324 acrescenta doze capturas sem retirar nenhuma das164 anteriores", () => {
  const todos = Object.keys(ESTADOS);
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: ["painel-sem-nome"] })).toHaveLength(12);
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: todos.filter(e => e !== "painel-sem-nome" && e !== "painel-secretaria") })).toHaveLength(164);
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: ["painel-detalhes", "painel-sem-nome"] })).toHaveLength(24);
});
it("CLI semnome faz preflight do GETreal/ID correto e hidrata sem exigir mensagem inexistente", async () => {
  const ordem: string[] = [], click = vi.fn(async () => { ordem.push("abrir painel"); });
  const get = vi.fn(async () => { ordem.push("GET"); return { status: () => 200, json: async () => ({ cabecalho: { semNome: true }, acoes: { podeEditarNome: true } }) }; });
  const goto = vi.fn(async () => { ordem.push("goto"); });
  const pagina = { goto, locator: () => ({ isVisible: async () => false }), getByRole: () => ({ click }), waitForFunction: vi.fn(async () => {}) };
  const r = await abrirApp(pagina as never, { request: { get } } as never, "http://localhost:3110", { beatriz: "b", mariana: "m", semNome: "nome324" } as never, "painel-sem-nome", "celular");
  expect(get).toHaveBeenCalledWith("http://localhost:3110/api/inbox/atendimentos/nome324/painel");
  expect(goto).toHaveBeenCalledWith("http://localhost:3110/inbox?c=nome324", { waitUntil: "domcontentloaded" });
  expect(ordem.indexOf("GET")).toBeLessThan(ordem.indexOf("goto")); expect(click).toHaveBeenCalledOnce();
  expect(m.conteudo).not.toHaveBeenCalledWith(pagina, "conversa", "celular"); expect(m.hidratacao).toHaveBeenCalled();
  expect(r.metadados).toMatchObject({ painelSemNomeReal: { status: 200, semNome: true, podeEditarNome: true } });
});
it.each([404, 200])("preflight semnome falha fechado com HTTP%s ou estado não legítimo", async status => {
  const goto = vi.fn(), get = async () => ({ status: () => status, json: async () => ({ cabecalho: { semNome: false }, acoes: { podeEditarNome: false } }) });
  const p = { goto, getByRole: () => ({ waitFor: async () => {} }) };
  await expect(abrirApp(p as never, { request: { get } } as never, "http://localhost:3110", { beatriz: "b", mariana: "m", semNome: "nome324" } as never, "painel-sem-nome", "desktop")).rejects.toThrow(/sem nome|semnome|HTTP/i);
  expect(goto).not.toHaveBeenCalled();
});
it("prontidão detalhes324 aceita marca com × e exige controles novos reais/habilitados", () => {
  let controles = true;
  const rotulo = { textContent: "Noite" }, pill = { textContent: "Noite×", querySelector: () => rotulo };
  const header = { textContent: "Mariana Costa Adulto Inglês Noite× + tag", querySelector: (s: string) => s === "h2" ? { textContent: "Mariana Costa" } : s === ':scope > span' ? { getBoundingClientRect: () => ({ width: 132, height: 132 }) } : s === '[aria-label="Criada pela Aria"]' ? { parentElement: pill } : null,
    querySelectorAll: () => controles ? [{ textContent: "+ tag", disabled: false, getAttribute: () => null }, ...["Adulto", "Inglês", "Noite"].map(t => ({ getAttribute: () => "Remover tag " + t, textContent: "×", disabled: false }))] : [] };
  const painel = { inert: false, getAttribute: () => null, getAnimations: () => [], getBoundingClientRect: () => ({ left: 0, right: 348, top: 0, bottom: 700, width: 348, height: 700 }), querySelector: () => header,
    querySelectorAll: (s: string) => s === '[role="tab"]' ? [{ textContent: "Detalhes", getAttribute: () => "true" }] : [{ getBoundingClientRect: () => ({ width: 36, height: 36 }) }] };
  vi.stubGlobal("window", { innerWidth: 390, innerHeight: 844 }); vi.stubGlobal("document", { querySelector: () => painel });
  expect(semanticaPainelDetalhesPronto()).toBe(true); controles = false; expect(semanticaPainelDetalhesPronto()).toBe(false);
});

it("prontidão semnome exige aviso/controles reais e rejeita ocupado, vazio falso ou fora do viewport", () => {
  let semNome = true, ocupado = false, valor = "", visivel = true;
  const rect = () => ({ left: 0, right: 340, top: 0, bottom: visivel ? 700 : 900, width: 340, height: visivel ? 700 : 900 });
  const salvar = { disabled: false, textContent: "Salvar", getBoundingClientRect: rect };
  const campo = { get disabled() { return ocupado; }, get value() { return valor; }, getBoundingClientRect: rect, closest: () => ({ querySelector: () => salvar }) };
  const painel = { inert: false, getAttribute: () => null, getAnimations: () => [], getBoundingClientRect: rect, get textContent() { return semNome ? "Contato sem nome, criado pelo telefone. Você pode preencher agora." : "Painel Comercial"; }, querySelector: () => campo, querySelectorAll: () => [{}] };
  vi.stubGlobal("window", { innerWidth: 390, innerHeight: 844 }); vi.stubGlobal("document", { querySelector: () => painel });
  expect(semanticaPainelSemNomePronto()).toBe(true);
  semNome = false; expect(semanticaPainelSemNomePronto()).toBe(false); semNome = true;
  ocupado = true; expect(semanticaPainelSemNomePronto()).toBe(false); ocupado = false;
  valor = "Já salvo"; expect(semanticaPainelSemNomePronto()).toBe(false); valor = "";
  visivel = false; expect(semanticaPainelSemNomePronto()).toBe(false);
});
