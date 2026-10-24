import { act, createElement, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import { useRevisoesRascunhos } from "./rascunhos-conversa";
import type { PropsCompositor } from "./Compositor";
import type { CandidatoMencao, TokenMencao } from "@/lib/mencoes-nota";

vi.mock("@tabler/icons-react", () => Object.fromEntries(["IconCalendarEvent", "IconMicrophone", "IconMoodSmile", "IconPaperclip", "IconPlayerStop", "IconSend", "IconTrash"].map(k => [k, () => null])));
let root: Root, host: Elemento;
let Compositor: typeof import("./Compositor").Compositor;
const storage = new Map<string, string>();
const pessoas: CandidatoMencao[] = [{ id: "p1", nome: "João Silva", descricao: "Vendedor" }, { id: "p2", nome: "João Silva", descricao: "Professor" }];
const notas: { texto: string; chave?: string; tokens?: readonly TokenMencao[] }[] = [];
const buscar = vi.fn<NonNullable<PropsCompositor["buscarMencoes"]>>(async () => pessoas);
function props(p: Partial<PropsCompositor> = {}): PropsCompositor {
  return { atendimentoId: "A", modo: "nota", podeEnviar: false, capacidades: [], aoEnviarTexto: async () => ({ ok: true }), aoEnviarMidia: async () => ({ ok: true }), aoNota: async (texto, chave, tokens) => { notas.push({ texto, chave, tokens }); return { ok: true }; }, buscarMencoes: buscar, ...p };
}
function Tela(p: PropsCompositor) { const revisoesRascunhos = useRevisoesRascunhos(); return createElement(Compositor, { ...p, revisoesRascunhos, key: p.atendimentoId }); }
function eventos(el: Elemento) { const k = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, Record<string, (e?: unknown) => void>>)[k]; }
const entrada = () => host.querySelector("textarea")!;
async function montar(p = props()) { await act(async () => root.render(createElement(StrictMode, null, createElement(Tela, p)))); }
async function digitar(v: string, cursor = v.length, aguardar = true) {
  await act(async () => eventos(entrada()).onChange({ target: { value: v, selectionStart: cursor } }));
  if (aguardar) await act(async () => { await vi.advanceTimersByTimeAsync(200); });
}
async function tecla(key: string, compondo = false) { await act(async () => eventos(entrada()).onKeyDown({ key, shiftKey: false, nativeEvent: { isComposing: compondo }, preventDefault() {} })); }
async function enviar() { const botao = [...host.querySelectorAll("button")].find(b => b.textContent === "Enviar")!; await act(async () => eventos(botao).onClick()); }
async function escolherSegundo() { await digitar("@Jo"); await tecla("ArrowDown"); await tecla("Enter"); }
beforeEach(async () => {
  vi.useFakeTimers();
  const dom = criarDomMinimo(); vi.stubGlobal("document", dom.documento); vi.stubGlobal("window", dom.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  storage.clear(); notas.length = 0; buscar.mockReset(); buscar.mockResolvedValue(pessoas);
  host = dom.documento.createElement("div"); dom.documento.body.appendChild(host);
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement); ({ Compositor } = await import("./Compositor"));
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("consulta só após 200 ms sem digitar e usa somente a busca mais recente", async () => {
  await montar(); await digitar("@Jo", 3, false);
  expect(buscar).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(199); });
  await digitar("@Joa", 4, false);
  await act(async () => { await vi.advanceTimersByTimeAsync(199); });
  expect(buscar).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(buscar).toHaveBeenCalledTimes(1);
  expect(buscar.mock.calls[0][0]).toBe("Joa");
});
it("fechar a lista cancela a consulta pendente antes do GET", async () => {
  await montar(); await digitar("@Jo", 3, false); await tecla("Escape");
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(buscar).not.toHaveBeenCalled(); expect(notas).toHaveLength(0);
});
it("trocar de conversa aborta o GET em voo e descarta sua resposta antiga", async () => {
  let concluir!: (v: CandidatoMencao[]) => void;
  buscar.mockImplementationOnce(() => new Promise(r => { concluir = r; }));
  await montar(); await digitar("@Jo");
  const sinal = (buscar.mock.calls[0] as unknown as [string, AbortSignal | undefined])[1];
  expect(sinal).toBeDefined(); expect(sinal?.aborted).toBe(false);
  await montar(props({ atendimentoId: "B" }));
  expect(sinal?.aborted).toBe(true);
  await act(async () => concluir(pessoas));
  expect(host.querySelector('[role="listbox"]')).toBeNull();
  expect(eventos(entrada()).value).toBe(""); expect(notas).toHaveLength(0);
});

it("autocomplete separa homônimos por papel, não expõe IDs, e Enter seleciona sem enviar", async () => {
  await montar(); await digitar("@Jo");
  expect(host.querySelector('[role="listbox"]')).not.toBeNull(); expect(host.querySelectorAll('[role="option"]')).toHaveLength(2);
  expect(host.textContent).toContain("Professor"); expect(host.textContent).not.toContain("p2");
  await tecla("ArrowDown"); await tecla("Enter"); expect(notas).toHaveLength(0);
  expect(eventos(entrada()).value).toBe("@João Silva ");
  await enviar(); expect(notas).toMatchObject([{ texto: "@João Silva", tokens: [{ usuarioId: "p2", inicio: 0, fim: 11 }] }]);
});
it("busca vazia usa o estado vazio e falha é anunciada como alerta, sem enviar nota", async () => {
  buscar.mockResolvedValueOnce([]);
  await montar(); entrada().focus(); await digitar("@ninguém");
  expect(host.querySelector('[data-estado-vazio]')).not.toBeNull();
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Nenhuma pessoa corresponde à busca.");
  buscar.mockRejectedValueOnce(new Error("Falha controlada da busca"));
  await digitar("@erro");
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Não foi possível buscar pessoas.");
  expect(host.querySelector('[role="status"]')?.textContent ?? "").not.toContain("Não foi possível");
  expect(host.ownerDocument?.activeElement).toBe(entrada());
  expect(notas).toHaveLength(0);
});
it("busca pendente anuncia carregamento sem antecipar estado vazio ou erro", async () => {
  let concluir!: (v: CandidatoMencao[]) => void;
  buscar.mockImplementationOnce(() => new Promise(r => { concluir = r; }));
  await montar(); await digitar("@Jo");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Buscando pessoas…");
  expect(host.querySelector('[data-estado-vazio]')).toBeNull();
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => concluir(pessoas));
  expect(host.querySelectorAll('[role="option"]')).toHaveLength(2);
  expect(notas).toHaveLength(0);
});
it("IME não seleciona/envia, Escape/Tab fecham sem enviar e modo responder não busca", async () => {
  await montar(); await digitar("@Jo"); await tecla("Enter", true); expect(notas).toHaveLength(0); expect(host.querySelector('[role="listbox"]')).not.toBeNull();
  await tecla("Escape"); expect(host.querySelector('[role="listbox"]')).toBeNull();
  await digitar("@Joa"); await tecla("Tab"); expect(host.querySelector('[role="listbox"]')).toBeNull(); expect(notas).toHaveLength(0);
  buscar.mockClear(); await montar(props({ modo: "responder", podeEnviar: true })); await digitar("@Jo"); expect(buscar).not.toHaveBeenCalled();
});
it("edição antes/dentro invalida seleção explícita e não reassocia homônimo", async () => {
  await montar(); await escolherSegundo(); await digitar("Oi @João Silva "); await enviar(); expect(notas[0].tokens).toBeUndefined();
});
it("trim/CRLF/emoji convertem coordenadas do token escolhido, preservando texto fora do cursor", async () => {
  await montar(); await digitar(" \r\n😀 @Jo depois", 9); await tecla("ArrowDown"); await tecla("Enter"); await enviar();
  expect(notas[0]).toMatchObject({ texto: "😀 @João Silva depois", tokens: [{ usuarioId: "p2", inicio: 3, fim: 14 }] });
});
it("resposta velha de candidatos não aparece na conversa nova", async () => {
  let concluir!: (v: CandidatoMencao[]) => void; buscar.mockImplementationOnce(() => new Promise(r => { concluir = r; }));
  await montar(); await digitar("@Jo"); await montar(props({ atendimentoId: "B" })); await act(async () => concluir(pessoas));
  expect(host.querySelector('[role="listbox"]')).toBeNull(); expect(eventos(entrada()).value).toBe("");
});
it("rascunho remontado sem metadados conserva texto, não recupera token de homônimo", async () => {
  await montar(); await escolherSegundo(); await montar(props({ atendimentoId: "B" })); await montar(); await enviar();
  expect(notas[0].texto).toBe("@João Silva"); expect(notas[0].tokens).toBeUndefined();
});
it("ACK tardio A→B→A não apaga escolha nova e comando pendente fica congelado", async () => {
  let concluir!: (r: { ok: true }) => void;
  const aoNota: PropsCompositor["aoNota"] = (texto, chave, tokens) => { notas.push({ texto, chave, tokens }); return new Promise(r => { concluir = r; }); };
  await montar(props({ aoNota })); await escolherSegundo(); await enviar();
  await montar(props({ atendimentoId: "B" })); await montar(); await escolherSegundo();
  await act(async () => concluir({ ok: true }));
  expect(eventos(entrada()).value).toBe("@João Silva "); expect(storage.get("conversa-rascunho:A:nota")).toBe("@João Silva ");
  expect(notas[0].tokens).toEqual([{ usuarioId: "p2", inicio: 0, fim: 11 }]);
});

type CampoComSelecao = Elemento & Pick<HTMLTextAreaElement, "value" | "selectionStart" | "selectionEnd" | "setSelectionRange">;
/** Limite DOM local ao teste: o textarea limita indices ao value atual e move o cursor ao trocar value.
 * ReactDOM continua real; o RED de Chromium confirmou esta mesma ordem antes do commit.
 */
function campoComSelecao() {
  const campo = entrada() as CampoComSelecao;
  let valor = String(campo.value ?? ""), inicio = valor.length, fim = valor.length;
  Object.defineProperties(campo, {
    value: { configurable: true, get: () => valor, set: (v: string) => {
      if (valor !== v) { valor = v; inicio = fim = valor.length; }
    } },
    selectionStart: { configurable: true, get: () => inicio, set: (v: number) => { inicio = v; } },
    selectionEnd: { configurable: true, get: () => fim, set: (v: number) => { fim = v; } },
  });
  campo.setSelectionRange = (i, f) => { inicio = Math.min(i ?? 0, valor.length); fim = Math.min(f ?? 0, valor.length); };
  return campo;
}
it.each([
  ["😀 @Jo depois", "😀 @João Silva depois"],
  ["😀 @Jodepois", "😀 @João Silva depois"],
  ["😀 @Jo  depois", "😀 @João Silva  depois"],
])("caret apos commit preserva sufixo/UTF16 em %s", async (texto, esperado) => {
  await montar(); const campo = campoComSelecao(); campo.focus();
  await digitar(texto, 6); await tecla("Enter");
  expect(campo.value).toBe(esperado);
  expect([campo.selectionStart, campo.selectionEnd]).toEqual([15, 15]);
  expect(campo.ownerDocument?.activeElement).toBe(campo);
  expect(notas).toHaveLength(0);
});
it("edicao mais nova antes do commit cancela selecao pendente sem roubar foco", async () => {
  await montar(); const campo = campoComSelecao(); await digitar("@Jo");
  const opcao = host.querySelector('[role="option"]')!;
  const externo = host.ownerDocument!.createElement("button"); host.ownerDocument!.body.appendChild(externo);
  await act(async () => {
    eventos(opcao).onClick();
    eventos(campo).onChange({ target: { value: "intencao mais nova", selectionStart: 18 } });
    externo.focus();
  });
  expect(campo.value).toBe("intencao mais nova");
  expect(campo.ownerDocument?.activeElement).toBe(externo);
  expect([campo.selectionStart, campo.selectionEnd]).toEqual([18, 18]);
});
it("troca A para B sem key descarta cursor antigo e conserva foco externo", async () => {
  await act(async () => root.render(createElement(Compositor, props())));
  campoComSelecao(); await digitar("@Jo");
  const opcao = host.querySelector('[role="option"]')!;
  const externo = host.ownerDocument!.createElement("button"); host.ownerDocument!.body.appendChild(externo);
  await act(async () => {
    eventos(opcao).onClick();
    root.render(createElement(Compositor, props({ atendimentoId: "B" })));
    externo.focus();
  });
  expect(eventos(entrada()).value).toBe("");
  expect(host.ownerDocument?.activeElement).toBe(externo);
});

it("selecao do mesmo texto ainda reposiciona depois do espaco existente no commit", async () => {
  await montar(); const campo = campoComSelecao();
  await digitar("@João Silva ", 11); campo.setSelectionRange(11, 11);
  await tecla("Enter");
  expect(campo.value).toBe("@João Silva ");
  expect([campo.selectionStart, campo.selectionEnd]).toEqual([12, 12]);
  expect(campo.ownerDocument?.activeElement).toBe(campo);
  expect(notas).toHaveLength(0);
});
