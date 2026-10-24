import { afterEach, expect, it, vi } from "vitest";
import { combinacoes, ESTADOS } from "../../scripts/visual/nucleo-captura.mjs";
const nomes = ["entrada-funil", "entrada-tarefas", "entrada-contatos", "entrada-agente"];
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function modulo() { const p = "../../scripts/visual/" + "entradas-inbox.mjs"; const m = await import(p).catch(() => null); expect(m, "harness336 ausente").not.toBeNull(); return m!; }
it("336 captura quatro entradas reais só no app e preserva todas as182 combinações anteriores", () => {
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: nomes })).toHaveLength(8);
  for (const n of nomes) { expect(ESTADOS[n].prototipo).toBe(false); expect(ESTADOS[n].motivoSemReferencia).toMatch(/referência funcional/i); }
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: Object.keys(ESTADOS).filter(e => !nomes.includes(e)) })).toHaveLength(182);
});
it("configuração336 exige rota da superfície e codifica o alvo sem inventar parâmetros", async () => {
  const m = await modulo();
  const env = { INBOX_VISUAL_ATENDIMENTO: "a?x&b", INBOX_VISUAL_FUNIL: "/funil?o=op336" };
  expect(m.configurarEntrada("entrada-funil", env)).toEqual({ estado: "entrada-funil", rota: "/funil?o=op336", abrir: "/inbox?c=a%3Fx%26b", agendar: "/inbox?c=a%3Fx%26b&agendar=1" });
  expect(m.configurarEntrada("entrada-agente", { INBOX_VISUAL_ATENDIMENTO: "a", INBOX_VISUAL_AGENTE: "/aria?aba=historico" }).agendar).toBeNull();
  for (const rota of ["https://example.com/funil?o=x", "//example.com/funil", "/tarefas?t=x", "/funil", "/funil?o=x#foo"]) expect(() => m.configurarEntrada("entrada-funil", { ...env, INBOX_VISUAL_FUNIL: rota })).toThrow();
  expect(() => m.configurarEntrada("entrada-funil", {})).toThrow();
});
it("prontidão336 recusa link errado, agendamento ausente e link oculto do histórico", async () => {
  const m = await modulo();
  const rect = { left: 8, right: 160, top: 8, bottom: 52, width: 152, height: 44 };
  const a = { textContent: "Abrir conversa", getAttribute: () => "/inbox?c=a", getBoundingClientRect: () => rect, closest: () => null };
  const s = { ...a, textContent: "Agendar mensagem", getAttribute: () => "/inbox?c=a&agendar=1" };
  let links = [a, s];
  vi.stubGlobal("window", { innerWidth: 320, innerHeight: 500 });
  vi.stubGlobal("document", { querySelectorAll: () => links, documentElement: { scrollWidth: 320 } });
  const alvo = { abrir: "/inbox?c=a", agendar: "/inbox?c=a&agendar=1" };
  expect(m.semanticaEntradaPronta(alvo)).toBe(true);
  links = [a]; expect(m.semanticaEntradaPronta(alvo)).toBe(false);
  links = [{ ...a, getAttribute: () => "/inbox?c=b" }, s]; expect(m.semanticaEntradaPronta(alvo)).toBe(false);
  links = [{ ...a, getBoundingClientRect: () => ({ ...rect, width: 0, height: 0 }) }];
  expect(m.semanticaEntradaPronta({ ...alvo, agendar: null })).toBe(false);
});
