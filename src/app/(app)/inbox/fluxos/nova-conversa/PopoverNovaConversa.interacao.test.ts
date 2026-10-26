import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { PopoverColuna } from "../../PopoverColuna";
import { PopoverNovaConversa } from "./PopoverNovaConversa";
import type { OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
const m = vi.hoisted(() => ({ abrir: vi.fn() }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ abrirAtendimentoInstitucional: m.abrir }));
let root: Root, doc: Documento, host: Elemento;
const selecionar = vi.fn(), fechar = vi.fn();
const numeros = [{ id: "n", nome: "Linha autorizada", comercial: true }];
const destino = { chave: "COMERCIAL:l", nome: "Comercial · João", finalidade: "COMERCIAL", leadId: "l" } as OpcoesAtendimento["destinos"][number];
const itens = [{ id: "a", contatoNome: "Ana", contatoTelefone: "", ultimaMensagemEm: "2026-10-25T12:00:00Z" }] as ItemListaInbox[];
function props(el: Elemento) { const key = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, { onClick(): void; onChange(e: unknown): void; onSubmit(e: unknown): void }>)[key]; }
async function montar(opcoes: OpcoesAtendimento = { destinos: [destino], numeros, comercial: true }) {
 await act(async () => root.render(createElement(PopoverColuna, { titulo: "Nova conversa", aberto: true, aoFechar: fechar } as Parameters<typeof PopoverColuna>[0], createElement(PopoverNovaConversa, { opcoes, itens, aoSelecionar: selecionar, aoFechar: fechar }))));
}
async function buscar(value: string) { await act(async () => props(doc.body.querySelector('input')!).onChange({ target: { value } })); }
async function clicar(texto: string) { const el = doc.body.querySelectorAll("button").find(b => b.textContent.includes(texto))!; expect(el).toBeDefined(); await act(async () => props(el).onClick()); }
beforeEach(async () => {
 m.abrir.mockReset(); selecionar.mockReset(); fechar.mockReset(); const dom = criarDomMinimo(); doc = dom.documento;
 Object.assign(doc, { addEventListener() {}, removeEventListener() {}, createElementNS(_ns: string, tag: string) { return doc.createElement(tag); } });
 vi.stubGlobal("window", dom.janela); vi.stubGlobal("document", doc); vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
 const criar = doc.createElement.bind(doc); doc.createElement = ((tag: string) => { const el = criar(tag); if (tag === "select") Object.defineProperty(el, "options", { get: () => el.querySelectorAll("option") }); return el; }) as typeof doc.createElement;
 host = doc.createElement("div"); doc.body.appendChild(host); const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("conversa existente navega por seleção sem action e sem diálogo aninhado", async () => {
 await montar(); expect(doc.body.querySelectorAll('[role="dialog"]')).toHaveLength(1); await clicar("Ana");
 expect(selecionar).toHaveBeenCalledExactlyOnceWith("a"); expect(m.abrir).not.toHaveBeenCalled();
});
it("destino com um canal chama abertura real e só seleciona depois ACK", async () => {
 let concluir!: (r: unknown) => void; m.abrir.mockReturnValue(new Promise(r => { concluir = r; })); await montar(); await buscar("Joao");
 const el = doc.body.querySelectorAll("button").find(b => b.textContent.includes("Comercial · João"))!;
 let pendente!: Promise<void>; await act(async () => { pendente = Promise.resolve(props(el).onClick()); });
 expect(m.abrir).toHaveBeenCalledExactlyOnceWith({ destinoChave: "COMERCIAL:l", numeroId: "n", chaveIdempotencia: expect.any(String) }); expect(selecionar).not.toHaveBeenCalled();
 await act(async () => { concluir({ ok: true, dado: { id: "novo" } }); await pendente; }); expect(selecionar).toHaveBeenCalledExactlyOnceWith("novo");
});
it("dois canais exigem escolha explícita, destino indisponível não executa", async () => {
 await montar({ destinos: [destino], numeros: [...numeros, { id: "n2", nome: "Segunda linha", comercial: true }], comercial: true }); await clicar("Comercial · João");
 expect(m.abrir).not.toHaveBeenCalled(); expect(doc.body.textContent).toContain("Segunda linha");
 await montar({ destinos: [{ ...destino, disponivel: false, impedimento: "Sem autorização" }], numeros, comercial: true });
 const b = doc.body.querySelectorAll("button").find(b => b.textContent.includes("Comercial · João")); expect(b?.hasAttribute("disabled")).toBe(true); expect(m.abrir).not.toHaveBeenCalled();
});
it("erro mantém popover e chave para retry, sem selecionar falso sucesso", async () => {
 m.abrir.mockResolvedValueOnce({ ok: false, erro: "Falha fictícia" }).mockResolvedValueOnce({ ok: true, dado: { id: "novo" } });
 await montar(); await clicar("Comercial · João"); expect(selecionar).not.toHaveBeenCalled(); expect(doc.body.textContent).toContain("Falha fictícia"); await clicar("Comercial · João");
 expect(m.abrir.mock.calls[0][0].chaveIdempotencia).toBe(m.abrir.mock.calls[1][0].chaveIdempotencia); expect(selecionar).toHaveBeenCalledExactlyOnceWith("novo");
});
it("número desconhecido orienta cadastro sem oferecer iniciar D9", async () => {
 await montar(); await buscar("+5511999990000"); expect(doc.body.textContent).toContain("Cadastre"); expect(doc.body.textContent).not.toContain("Conversar com +"); expect(m.abrir).not.toHaveBeenCalled();
});
it("sem carteira não culpa linha; sem canal com destino informa administração", async () => {
 await montar({ destinos: [], numeros: [], comercial: true }); expect(doc.body.textContent).toContain("Nenhum lead na sua carteira"); expect(doc.body.textContent).not.toContain("disponibilizar um canal");
 await montar({ destinos: [destino], numeros: [], comercial: true }); expect(doc.body.textContent).toContain("disponibilizar um canal");
});


it("ACK de abertura antiga após revogação e restauração das opções não seleciona", async () => {
 let concluir!: (r: unknown) => void; m.abrir.mockReturnValue(new Promise(r => { concluir = r; })); await montar();
 const el = doc.body.querySelectorAll("button").find(b => b.textContent.includes("Comercial · João"))!;
 let pendente!: Promise<void>; await act(async () => { pendente = Promise.resolve(props(el).onClick()); });
 await montar({ destinos: [], numeros: [], comercial: true }); await montar();
 await act(async () => { concluir({ ok: true, dado: { id: "antigo" } }); await pendente; });
 expect(selecionar).not.toHaveBeenCalled(); expect(fechar).not.toHaveBeenCalled();
});
it("desmontagem com action pendente impede seleção e fechamento tardios", async () => {
 let concluir!: (r: unknown) => void; m.abrir.mockReturnValue(new Promise(r => { concluir = r; })); await montar();
 const el = doc.body.querySelectorAll("button").find(b => b.textContent.includes("Comercial · João"))!;
 let pendente!: Promise<void>; await act(async () => { pendente = Promise.resolve(props(el).onClick()); });
 await act(async () => root.render(null)); await act(async () => { concluir({ ok: true, dado: { id: "antigo" } }); await pendente; });
 expect(selecionar).not.toHaveBeenCalled(); expect(fechar).not.toHaveBeenCalled();
});
it("clique retido durante busy não duplica a abertura nem troca destino", async () => {
 let concluir!: (r: unknown) => void; m.abrir.mockReturnValue(new Promise(r => { concluir = r; })); await montar();
 const el = doc.body.querySelectorAll("button").find(b => b.textContent.includes("Comercial · João"))!;
 const click = props(el).onClick; let pendente!: Promise<void>; await act(async () => { pendente = Promise.resolve(click()); }); await act(async () => { click(); });
 expect(m.abrir).toHaveBeenCalledTimes(1); await act(async () => { concluir({ ok: true, dado: { id: "novo" } }); await pendente; }); expect(selecionar).toHaveBeenCalledTimes(1);
});
it("canal escolhido confirma o mesmo destino e usa somente linha elegível", async () => {
 m.abrir.mockResolvedValue({ ok: true, dado: { id: "novo" } }); await montar({ destinos: [destino], numeros: [...numeros, { id: "n2", nome: "Segunda linha", comercial: true }, { id: "institucional", nome: "Canal de cobrança", comercial: false }], comercial: true }); await clicar("Comercial · João");
 expect(doc.body.textContent).not.toContain("Canal de cobrança"); await act(async () => props(doc.body.querySelector("select")!).onChange({ target: { value: "n2" } }));
 await act(async () => props(doc.body.querySelector("form")!).onSubmit({ preventDefault() {} }));
 expect(m.abrir).toHaveBeenCalledExactlyOnceWith({ destinoChave: "COMERCIAL:l", numeroId: "n2", chaveIdempotencia: expect.any(String) }); expect(selecionar).toHaveBeenCalledExactlyOnceWith("novo");
});
it("handler retido de destino revogado não chama servidor", async () => {
 await montar(); const click = props(doc.body.querySelectorAll("button").find(b => b.textContent.includes("Comercial · João"))!).onClick;
 await montar({ destinos: [], numeros: [], comercial: true }); await act(async () => click()); expect(m.abrir).not.toHaveBeenCalled();
});
it("falha de transporte conserva chave e não fecha antes da repetição confirmada", async () => {
 m.abrir.mockRejectedValueOnce(new Error("Rede fictícia")).mockResolvedValueOnce({ ok: true, dado: { id: "novo" } }); await montar(); await clicar("Comercial · João"); expect(selecionar).not.toHaveBeenCalled(); expect(fechar).not.toHaveBeenCalled(); await clicar("Comercial · João"); expect(m.abrir.mock.calls[0][0].chaveIdempotencia).toBe(m.abrir.mock.calls[1][0].chaveIdempotencia); expect(selecionar).toHaveBeenCalledExactlyOnceWith("novo");
});
it("destino comercial sem linha não utiliza canal institucional", async () => {
 await montar({ destinos: [destino], numeros: [{ id: "s", nome: "Secretaria", comercial: false }], comercial: true }); await clicar("Comercial · João"); expect(m.abrir).not.toHaveBeenCalled(); expect(doc.body.textContent).toContain("Peça à administração para atribuir uma linha");
});
it("callback retido de conversa não navega enquanto abertura está ocupada", async () => {
 let concluir!: (r: unknown) => void; m.abrir.mockReturnValue(new Promise(r => { concluir = r; })); await montar();
 const antigo = props(doc.body.querySelectorAll("button").find(b => b.textContent.includes("Ana"))!).onClick;
 const abrirDestino = props(doc.body.querySelectorAll("button").find(b => b.textContent.includes("Comercial · João"))!).onClick;
 let pendente!: Promise<void>; await act(async () => { pendente = Promise.resolve(abrirDestino()); }); await act(async () => antigo()); expect(selecionar).not.toHaveBeenCalled();
 await act(async () => { concluir({ ok: true, dado: { id: "novo" } }); await pendente; }); expect(selecionar).toHaveBeenCalledExactlyOnceWith("novo");
});
it("tentativa por destino/canal preserva retry sem prender outro alvo", async () => {
 m.abrir.mockResolvedValue({ ok: false, erro: "Recusa fictícia" });
 const outro = { ...destino, chave: "COMERCIAL:m", nome: "Comercial · Maria", leadId: "m" };
 await montar({ destinos: [destino, outro], numeros, comercial: true });
 await clicar("Comercial · João"); await clicar("Comercial · Maria"); await clicar("Comercial · João");
 const [a, b, repetido] = m.abrir.mock.calls.map(c => c[0]); expect(a.chaveIdempotencia).not.toBe(b.chaveIdempotencia); expect(repetido.chaveIdempotencia).toBe(a.chaveIdempotencia);
});
