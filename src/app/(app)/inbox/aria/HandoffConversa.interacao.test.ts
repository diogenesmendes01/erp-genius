import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { RodapeConversa } from "../RodapeConversa";
import { useHandoffConversa, type LeituraPainelHandoff } from "./useHandoffConversa";
import type { HandoffDoAtendimento } from "@/server/aria/handoff-inbox";
const assumir = vi.hoisted(() => vi.fn());
vi.mock("@/server/whatsapp/acoes-atendimento", () => ({ assumirAtendimento: assumir }));
const h: HandoffDoAtendimento = { acaoId: "h1", pedidoEm: "2026-10-25T11:56:00Z", motivo: "VALOR", motivoTexto: "Valor alto", destino: "FILA_SETOR", responsavelNome: null, resumo: { quer: "Quer vaga", proximoPasso: "Ligar" }, feito: [], podeAssumir: true, ehResponsavel: false };
type TelaProps = {
    id?: string;
    handoff?: HandoffDoAtendimento | null;
    envio?: boolean;
    responsavel?: string | null;
    leitura?: LeituraPainelHandoff;
    nota?: boolean;
};
const mudar = vi.fn();
function Tela({ id = "A", handoff = h, envio = true, responsavel = null, leitura = { solicitada: 0, finalizada: 0, resultado: "ok" }, nota = false }: TelaProps) {
    const c = useHandoffConversa({ item: { id, contatoNome: "Grupo", grupo: false, status: "EM_ATENDIMENTO", responsavelId: responsavel }, usuarioId: "u", handoff, podeEnviar: envio, leitura, fuso: "UTC", agora: new Date("2026-10-25T12:00:00Z"), aoMudar: mudar });
    return createElement("section", null, c.faixa, c.modal, createElement(RodapeConversa, { modo: "compositor", atendimentoId: id, abaInicial: nota ? "nota" : "responder", podeEnviar: envio, capacidades: [], aoEnviarTexto: async () => ({ ok: true as const }), aoEnviarMidia: async () => ({ ok: true as const }), aoNota: async () => ({ ok: true as const }), controleResposta: c.controleResposta, aoCampoResponder: c.aoCampoResponder }), createElement("textarea", { "data-outra-conversa": "" }));
}
let root: Root, host: Elemento, doc: Documento;
const keys: {
    type: string;
    fn: (e: unknown) => void;
}[] = [];
function eventos(el: Elemento) { const k = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as unknown as Record<string, {
    onClick(): void;
    onChange(e: unknown): void;
}>)[k]; }
const dialogo = () => doc.body.querySelector('[role="dialog"]')!;
const botao = (nome: string, onde: Elemento = doc.body) => onde.querySelectorAll("button").find(b => b.textContent === nome)!;
const clicar = async (nome: string, onde?: Elemento) => act(async () => { const b = botao(nome, onde); expect(b).toBeDefined(); eventos(b).onClick(); });
const montar = async (p: TelaProps = {}) => act(async () => root.render(createElement(Tela, { key: p.id ?? "A", ...p })));
beforeEach(async () => {
    vi.resetAllMocks();
    assumir.mockResolvedValue({ ok: true as const });
    keys.length = 0;
    const dom = criarDomMinimo();
    doc = dom.documento;
    Object.assign(doc, { createElementNS: (_ns: string, tag: string) => doc.createElement(tag), addEventListener: (type: string, fn: (e: unknown) => void) => keys.push({ type, fn }), removeEventListener: (type: string, fn: (e: unknown) => void) => { const i = keys.findIndex(x => x.type === type && x.fn === fn); if (i >= 0)
            keys.splice(i, 1); } });
    Object.assign(dom.janela, { innerWidth: 390, innerHeight: 844, addEventListener() { }, removeEventListener() { } });
    vi.stubGlobal("window", dom.janela);
    vi.stubGlobal("document", doc);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("MutationObserver", dom.MutationObserver);
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
    host = doc.createElement("div");
    doc.body.appendChild(host);
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("Modal real isola o fundo, foca Cancelar e retorna ao gatilho no Escape", async () => {
    await montar();
    const trigger = botao("Ver resumo e assumir");
    trigger.focus();
    await clicar("Ver resumo e assumir");
    expect(dialogo()).not.toBeNull();
    expect(host.inert).toBe(true);
    expect(doc.activeElement === botao("Cancelar", dialogo())).toBe(true);
    await act(async () => { for (const k of [...keys])
        if (k.type === "keydown")
            k.fn({ key: "Escape", stopPropagation() { }, preventDefault() { } }); });
    expect(dialogo()).toBeNull();
    expect(host.inert).toBe(false);
    expect(doc.activeElement === trigger).toBe(true);
});
it("ACK atual pede refresh, GET antigo/503 não focam; leitura200 nova escolhe Responder da mesma conversa", async () => {
    let resolver!: (r: {
        ok: true;
    }) => void;
    assumir.mockImplementationOnce(() => new Promise(r => resolver = r));
    await montar({ nota: true });
    await clicar("Ver resumo e assumir");
    await clicar("Assumir e responder", dialogo());
    await act(async () => resolver({ ok: true as const }));
    expect(mudar).toHaveBeenCalledOnce();
    expect(dialogo()).not.toBeNull();
    await montar({ nota: true, responsavel: "u", leitura: { solicitada: 1, finalizada: 0, resultado: "ok" } });
    expect(dialogo()).not.toBeNull();
    await montar({ nota: true, responsavel: "u", leitura: { solicitada: 1, finalizada: 1, resultado: "falha" } });
    expect(dialogo()).not.toBeNull();
    expect(doc.activeElement === host.querySelector("[data-outra-conversa]")).toBe(false);
    await clicar("Tentar de novo", dialogo());
    expect(mudar).toHaveBeenCalledTimes(2);
    await montar({ nota: true, responsavel: "u", handoff: null, leitura: { solicitada: 2, finalizada: 2, resultado: "ok" } });
    expect(dialogo()).toBeNull();
    const campo = host.querySelector("[data-compositor-campo]");
    expect(campo).not.toBeNull();
    expect(doc.activeElement === campo).toBe(true);
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Responder");
});
it.each(["troca", "A-B-A", "novo-modal", "404"] as const)("ACK anterior não reconcilia nem toma foco após %s", async (caso) => {
    let resolver!: (r: {
        ok: true;
    }) => void;
    assumir.mockImplementationOnce(() => new Promise(r => resolver = r));
    await montar();
    await clicar("Ver resumo e assumir");
    await clicar("Assumir e responder", dialogo());
    if (caso === "troca" || caso === "A-B-A") {
        await montar({ id: "B" });
        if (caso === "A-B-A")
            await montar();
    }
    else if (caso === "404")
        await montar({ envio: false, handoff: { ...h, podeAssumir: false, ehResponsavel: false }, leitura: { solicitada: 1, finalizada: 1, resultado: "sem-acesso" } });
    else {
        await montar({ handoff: { ...h, acaoId: "h2" } });
        await clicar("Ver resumo e assumir");
    }
    const fora = host.querySelector("[data-outra-conversa]")!;
    if (!host.inert)
        fora.focus();
    await act(async () => resolver({ ok: true as const }));
    expect(mudar).not.toHaveBeenCalled();
    expect(doc.activeElement === host.querySelector("[data-compositor-campo]")).toBe(false);
});
it("falha e transporte permitem retry, sem refresh nem foco antes do sucesso", async () => {
    assumir.mockResolvedValueOnce({ ok: false, erro: "Outro atendente já assumiu." }).mockRejectedValueOnce(Error("rede"));
    await montar();
    await clicar("Ver resumo e assumir");
    await clicar("Assumir e responder", dialogo());
    expect(dialogo().textContent).toContain("Outro atendente já assumiu.");
    expect(mudar).not.toHaveBeenCalled();
    await clicar("Assumir e responder", dialogo());
    expect(dialogo().textContent).toContain("Reenvie sem alterar os dados");
    expect(mudar).not.toHaveBeenCalled();
    await clicar("Assumir e responder", dialogo());
    expect(mudar).toHaveBeenCalledOnce();
});
it("perda de envio confirmada após ACK invalida intenção mesmo se capacidade voltar", async () => {
    await montar();
    await clicar("Ver resumo e assumir");
    await clicar("Assumir e responder", dialogo());
    expect(mudar).toHaveBeenCalledOnce();
    await montar({ envio: false, responsavel: "u", leitura: { solicitada: 1, finalizada: 1, resultado: "ok" } });
    await montar({ envio: true, responsavel: "u", handoff: null, leitura: { solicitada: 2, finalizada: 2, resultado: "ok" } });
    expect(doc.activeElement === host.querySelector("[data-compositor-campo]")).toBe(false);
});
it("responsável responde sem ação de negócio e sem escolher campo de outra conversa", async () => {
    await montar({ nota: true, responsavel: "u", handoff: { ...h, podeAssumir: false, ehResponsavel: true } });
    await clicar("Ver resumo");
    await clicar("Responder", dialogo());
    expect(assumir).not.toHaveBeenCalled();
    expect(mudar).not.toHaveBeenCalled();
    expect(dialogo()).toBeNull();
    expect(doc.activeElement === host.querySelector("[data-compositor-campo]")).toBe(true);
});
it("dois cliques antes do render fazem uma única tentativa de assumir", async () => {
    let resolver!: (r: {
        ok: true;
    }) => void;
    assumir.mockImplementationOnce(() => new Promise(r => resolver = r));
    await montar();
    await clicar("Ver resumo e assumir");
    const b = botao("Assumir e responder", dialogo());
    await act(async () => { eventos(b).onClick(); eventos(b).onClick(); });
    expect(assumir).toHaveBeenCalledOnce();
    await act(async () => resolver({ ok: true as const }));
});
it("revogar e devolver capacidade antes do ACK não revive a tentativa anterior", async () => {
    let resolver!: (r: {
        ok: true;
    }) => void;
    assumir.mockImplementationOnce(() => new Promise(r => resolver = r));
    await montar();
    await clicar("Ver resumo e assumir");
    await clicar("Assumir e responder", dialogo());
    await montar({ handoff: { ...h, podeAssumir: false, ehResponsavel: false } });
    await montar();
    await act(async () => resolver({ ok: true as const }));
    expect(mudar).not.toHaveBeenCalled();
});
it("assumir e responder preserva os dois rascunhos ao alternar a aba sem remontar o compositor", async () => {
    await montar();
    const campo = host.querySelector("[data-compositor-campo]")!;
    await act(async () => eventos(campo).onChange({ target: { value: "resposta guardada" } }));
    await clicar("Nota interna");
    await act(async () => eventos(host.querySelector("[data-compositor-campo]")!).onChange({ target: { value: "nota guardada" } }));
    await clicar("Ver resumo e assumir");
    await clicar("Assumir e responder", dialogo());
    await montar({ responsavel: "u", handoff: null, leitura: { solicitada: 1, finalizada: 1, resultado: "ok" } });
    expect((host.querySelector("[data-compositor-campo]") as unknown as HTMLTextAreaElement).value).toBe("resposta guardada");
    await clicar("Nota interna");
    expect((host.querySelector("[data-compositor-campo]") as unknown as HTMLTextAreaElement).value).toBe("nota guardada");
});
it("abertura invalidada não oferece segundo assumir; fechar e reabrir cria geração que aceita só ACK novo",async()=>{
 let antigo!:(r:{ok:true})=>void,novo!:(r:{ok:true})=>void;
 assumir.mockImplementationOnce(()=>new Promise(r=>antigo=r)).mockImplementationOnce(()=>new Promise(r=>novo=r));
 await montar();await clicar("Ver resumo e assumir");await clicar("Assumir e responder",dialogo());
 await montar({handoff:{...h,podeAssumir:false,ehResponsavel:false}});await montar();
 expect(botao("Assumir e responder",dialogo())).toBeUndefined();expect(botao("Responder",dialogo())).toBeUndefined();
 expect(dialogo().textContent).toContain("Feche e abra o resumo novamente");
 await clicar("Fechar",dialogo());await clicar("Ver resumo e assumir");await clicar("Assumir e responder",dialogo());expect(assumir).toHaveBeenCalledTimes(2);
 await act(async()=>antigo({ok:true}));expect(mudar).not.toHaveBeenCalled();expect(dialogo()).not.toBeNull();
 await act(async()=>novo({ok:true}));expect(mudar).toHaveBeenCalledOnce();
 await montar({responsavel:"u",handoff:null,leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(true);
});
it.each(["sucesso","cancelar-reabrir"] as const)("snapshot pósACK sem handoff permanece após503, sem nova ação; %s",async(fim)=>{
 await montar({nota:true});await clicar("Ver resumo e assumir");await clicar("Assumir e responder",dialogo());
 await montar({nota:true,responsavel:null,handoff:null,leitura:{solicitada:1,finalizada:1,resultado:"ok"}});expect(dialogo()).not.toBeNull();
 await montar({nota:true,responsavel:null,handoff:null,leitura:{solicitada:2,finalizada:2,resultado:"falha"}});
 expect(dialogo()).not.toBeNull();expect(dialogo().textContent).toContain("Quer vaga");expect(botao("Tentar de novo",dialogo())).toBeDefined();expect(botao("Assumir e responder",dialogo())).toBeUndefined();expect(botao("Responder",dialogo())).toBeUndefined();
 expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(false);expect(assumir).toHaveBeenCalledOnce();
 if(fim==="sucesso"){
  await clicar("Tentar de novo",dialogo());expect(mudar).toHaveBeenCalledTimes(2);
  await montar({nota:true,responsavel:"u",handoff:null,leitura:{solicitada:3,finalizada:2,resultado:"falha"}});expect(dialogo()).not.toBeNull();
  await montar({nota:true,responsavel:"u",handoff:null,leitura:{solicitada:3,finalizada:3,resultado:"ok"}});expect(dialogo()).toBeNull();expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(true);expect(assumir).toHaveBeenCalledOnce();
 }else{
  await clicar("Cancelar",dialogo());expect(dialogo()).toBeNull();
  await montar({nota:true,responsavel:"u",handoff:null,leitura:{solicitada:3,finalizada:3,resultado:"ok"}});expect(doc.activeElement===host.querySelector("[data-compositor-campo]")).toBe(false);
  await montar({nota:true,handoff:{...h,acaoId:"h2"},leitura:{solicitada:4,finalizada:4,resultado:"ok"}});await clicar("Ver resumo e assumir");expect(botao("Tentar de novo",dialogo())).toBeUndefined();await clicar("Assumir e responder",dialogo());expect(assumir).toHaveBeenCalledTimes(2);expect(mudar).toHaveBeenCalledTimes(2);
 }
});
