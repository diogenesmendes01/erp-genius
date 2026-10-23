import { act, createElement, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import { useRevisoesRascunhos } from "./rascunhos-conversa";
import type { PropsCompositor } from "./Compositor";

const ui = vi.hoisted(() => ({ campo: {} as Record<string, unknown>, botoes: [] as Record<string, unknown>[] }));
vi.mock("@/components/CampoTexto", async () => { const { forwardRef } = await import("react"); return { CampoTexto: forwardRef((_p) => { ui.campo = _p as Record<string, unknown>; return null; }) }; });
vi.mock("@/components/Botao", () => ({ Botao: (p: Record<string, unknown>) => { ui.botoes.push(p); return null; } }));
vi.mock("@tabler/icons-react", () => Object.fromEntries(["IconCalendarEvent", "IconMicrophone", "IconMoodSmile", "IconPaperclip", "IconPlayerStop", "IconSend", "IconTrash"].map(k => [k, () => null])));
vi.mock("@/components/Menu", () => ({ CLASSE_ITEM_MENU: "", CLASSE_PAINEL_MENU: "" }));
let root: Root;
let host: Elemento;
let Compositor: typeof import("./Compositor").Compositor;
const storage = new Map<string, string>();
beforeEach(async () => {
  const dom = criarDomMinimo();
  vi.stubGlobal("document", dom.documento); vi.stubGlobal("window", dom.janela);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  storage.clear();
  host = dom.documento.createElement("div"); dom.documento.body.appendChild(host);
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
  ({ Compositor } = await import("./Compositor"));
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
function props(p: Partial<PropsCompositor> = {}): PropsCompositor {
  return { atendimentoId: "A", modo: "responder", podeEnviar: true, capacidades: [], aoEnviarTexto: async () => ({ ok: true }), aoEnviarMidia: async () => ({ ok: true }), aoNota: async () => ({ ok: true }), ...p };
}
function Tela(p: PropsCompositor) { const revisoesRascunhos = useRevisoesRascunhos(); return createElement(Compositor, { ...p, revisoesRascunhos, key: p.atendimentoId }); }
async function montar(p: PropsCompositor) { ui.botoes = []; await act(async () => root.render(createElement(StrictMode, null, createElement(Tela, p)))); }
async function digitar(texto: string) { await act(async () => (ui.campo.onChange as (e: unknown) => void)({ target: { value: texto } })); }
function eventos(el: Elemento) { const k = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, Record<string, (e?: unknown) => void>>)[k]; }
async function enviar() { const b = Array.from(host.querySelectorAll("button")).find(b => b.textContent === "Enviar")!; await act(async () => eventos(b).onClick()); }
async function anexar(nome: string) { const input = host.querySelector("input")!; await act(async () => eventos(input).onChange({ target: { files: [new File(["conteúdo"], nome)], value: nome } })); }

it.each(["responder", "nota"] as const)("C3 montagem real %s: sucesso de A após trocar para B remove só o rascunho confirmado", async modo => {
  let concluir!: (r: { ok: true }) => void;
  const pendente = new Promise<{ ok: true }>(r => { concluir = r; });
  const p = props({ modo, aoEnviarTexto: () => pendente, aoNota: () => pendente });
  await montar(p); await digitar("  enviado A  "); await enviar();
  await montar(props({ atendimentoId: "B", modo })); await digitar("nova intenção B");
  await act(async () => concluir({ ok: true }));
  expect(storage.has("conversa-rascunho:A:" + modo)).toBe(false);
  expect(storage.get("conversa-rascunho:B:" + modo)).toBe("nova intenção B");
  expect(ui.campo.value).toBe("nova intenção B");
});

it.each(["responder", "nota"] as const)("C3 %s: erro e resultado incerto conservam armazenamento de A em B", async modo => {
  for (const resultado of ["erro", "incerto"] as const) {
    let concluir!: (r: { ok: false; erro: string }) => void; let rejeitar!: (e: Error) => void;
    const pendente = new Promise<{ ok: false; erro: string }>((r, j) => { concluir = r; rejeitar = j; });
    await montar(props({ modo, aoEnviarTexto: () => pendente, aoNota: () => pendente }));
    await digitar("rascunho " + resultado); await enviar();
    await montar(props({ atendimentoId: "B", modo }));
    await act(async () => { if (resultado === "erro") concluir({ ok: false, erro: "negado" }); else rejeitar(new Error("Failed to fetch")); });
    expect(storage.get("conversa-rascunho:A:" + modo)).toBe("rascunho " + resultado);
    await act(async () => root.render(null));
  }
});
it.each([["responder", "texto"], ["responder", "arquivo"], ["nota", "texto"]] as const)("C3 A→B→A em %s: novo owner preserva intenção de %s mesmo com texto final igual", async (modo, intencao) => {
  let concluir!: (r: { ok: true }) => void;
  const pendente = new Promise<{ ok: true }>(r => { concluir = r; });
  const p = props({ modo, aoEnviarTexto: () => pendente, aoNota: () => pendente });
  await montar(p); await digitar("mesmo texto"); await enviar();
  await montar(props({ atendimentoId: "B", modo })); await montar(props({ modo }));
  if (intencao === "texto") { await digitar("edição nova"); await digitar("mesmo texto"); }
  else await anexar("novo.txt");
  await act(async () => concluir({ ok: true }));
  expect(storage.get("conversa-rascunho:A:" + modo)).toBe("mesmo texto");
  expect(ui.campo.value).toBe("mesmo texto");
  if (intencao === "arquivo") expect(host.textContent).toContain("novo.txt");
});
it("C3 desmontagem integral revoga mapa antigo sem apagar nova sessão de mesmo texto", async () => {
  let concluir!: (r: { ok: true }) => void;
  await montar(props({ aoEnviarTexto: () => new Promise(r => { concluir = r; }) }));
  await digitar("mesmo texto"); await enviar();
  await act(async () => root.render(null));
  await montar(props()); await digitar("nova revisão"); await digitar("mesmo texto");
  await act(async () => concluir({ ok: true }));
  expect(storage.get("conversa-rascunho:A:responder")).toBe("mesmo texto"); expect(ui.campo.value).toBe("mesmo texto");
});
it("C3 modos têm armazenamento separado mesmo no mesmo contato", async () => {
  let concluir!: (r: { ok: true }) => void;
  await montar(props({ aoEnviarTexto: () => new Promise(r => { concluir = r; }) }));
  await digitar("resposta enviada"); await enviar(); await montar(props({ modo: "nota" })); await digitar("nota não enviada");
  await act(async () => concluir({ ok: true }));
  expect(storage.has("conversa-rascunho:A:responder")).toBe(false); expect(storage.get("conversa-rascunho:A:nota")).toBe("nota não enviada");
  expect(ui.campo.value).toBe("nota não enviada");
});
it("C3 comparação do texto bruto protege armazenamento alterado fora da tentativa", async () => {
  let concluir!: (r: { ok: true }) => void;
  await montar(props({ aoEnviarTexto: () => new Promise(r => { concluir = r; }) }));
  await digitar("enviado"); await enviar(); storage.set("conversa-rascunho:A:responder", "outra edição persistida");
  await act(async () => concluir({ ok: true }));
  expect(storage.get("conversa-rascunho:A:responder")).toBe("outra edição persistida");
});

it("C3 mídia já despachada: sucesso em B limpa só legenda enviada e preserva arquivo novo de B", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ url: "/arquivo-local" }) })));
  let concluir!: (r: { ok: true }) => void;
  await montar(props({ aoEnviarMidia: () => new Promise(r => { concluir = r; }) }));
  await digitar("legenda A"); await anexar("a.txt"); await enviar();
  await montar(props({ atendimentoId: "B" })); await digitar("legenda B"); await anexar("b.txt");
  await act(async () => concluir({ ok: true }));
  expect(storage.has("conversa-rascunho:A:responder")).toBe(false);
  expect(storage.get("conversa-rascunho:B:responder")).toBe("legenda B"); expect(host.textContent).toContain("b.txt");
});

it.each(["responder", "nota"] as const)("C3 retorno sem editar %s: A→B→A não transforma remontagem em intenção nova", async modo => {
 let concluir!: (r:{ok:true})=>void;
 const pendente=new Promise<{ok:true}>(r=>{concluir=r;});
 await montar(props({modo,aoEnviarTexto:()=>pendente,aoNota:()=>pendente}));
 await digitar("  texto confirmado  ");await enviar();
 await montar(props({atendimentoId:"B",modo}));
 await montar(props({modo}));
 expect(ui.campo.value).toBe("  texto confirmado  ");
 await act(async()=>concluir({ok:true}));
 expect(storage.has("conversa-rascunho:A:"+modo)).toBe(false);
 expect(ui.campo.value).toBe("");
 await montar(props({atendimentoId:"B",modo}));await montar(props({modo}));
 expect(ui.campo.value).toBe("");
});

it.each(["responder", "nota"] as const)("C3 retorno sem editar %s: erro/incerto não limpa armazenamento nem campo de A", async modo => {
 for (const resultado of ["erro", "incerto"] as const) {
  let concluir!: (r:{ok:false;erro:string})=>void;let rejeitar!:(e:Error)=>void;
  const pendente=new Promise<{ok:false;erro:string}>((r,j)=>{concluir=r;rejeitar=j;});
  await montar(props({modo,aoEnviarTexto:()=>pendente,aoNota:()=>pendente}));await digitar("incerta "+resultado);await enviar();
  await montar(props({atendimentoId:"B",modo}));await montar(props({modo}));
  await act(async()=>{if(resultado==="erro")concluir({ok:false,erro:"Negado"});else rejeitar(new Error("Failed to fetch"));});
  expect(storage.get("conversa-rascunho:A:"+modo)).toBe("incerta "+resultado);expect(ui.campo.value).toBe("incerta "+resultado);
  await act(async()=>root.render(null));
 }
});
it("C3 retorno protege armazenamento externo e o campo carregado dessa edição", async()=>{
 let concluir!:(r:{ok:true})=>void;
 await montar(props({aoEnviarTexto:()=>new Promise(r=>{concluir=r;})}));await digitar("enviado");await enviar();
 await montar(props({atendimentoId:"B"}));storage.set("conversa-rascunho:A:responder","externo posterior");await montar(props());
 await act(async()=>concluir({ok:true}));
 expect(storage.get("conversa-rascunho:A:responder")).toBe("externo posterior");expect(ui.campo.value).toBe("externo posterior");
});
it("C3 armazenamento indisponível não impede reconciliação visual da intenção confirmada",async()=>{
 let concluir!:(r:{ok:true})=>void;
 await montar(props({aoEnviarTexto:()=>new Promise(r=>{concluir=r;})}));await digitar("texto enviado");await enviar();
 vi.stubGlobal("localStorage",{getItem(){throw Error("sem acesso");},removeItem(){throw Error("sem acesso");}});
 await act(async()=>concluir({ok:true}));expect(ui.campo.value).toBe("");
});
