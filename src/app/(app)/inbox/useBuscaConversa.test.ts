import { act, createElement, useLayoutEffect, useRef } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import { useBuscaConversa } from "./useBuscaConversa";
import { BuscaConversaFixture as Tela } from "@/test/busca-conversa.fixture";
const m=(id:string,corpo="matrícula")=>({id,corpo,criadoEm:'2026-10-22T12:00:00Z',apagada:false});
let root:Root,container:Elemento,api:ReturnType<typeof useBuscaConversa>;
beforeEach(async()=>{const dom=criarDomMinimo();vi.stubGlobal('document',dom.documento);vi.stubGlobal('window',dom.janela);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});container=dom.documento.createElement('div');dom.documento.body.appendChild(container);const {createRoot}=await import('react-dom/client');root=createRoot(container as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
const render=async(id='a',ms=[m('1'),m('2')])=>{await act(async()=>root.render(createElement(Tela,{id,ms,aoAtualizar:a=>{api=a;}})));for(const el of container.querySelectorAll('button'))Object.assign(el,{getClientRects:()=>[{}]});};
it("abrir/mudar/navegar/fechar usam estado real; achado preservado porID no SSE/paginação",async()=>{await render();await act(async()=>api.abrir());await act(async()=>api.aoMudar('Matrícula'));expect(api.atual).toBe('1');expect(api.posicao).toBe(1);await act(async()=>api.navegar(1));expect(api.atual).toBe('2');await render('a',[m('0'),m('1'),m('2'),m('3')]);expect(api.atual).toBe('2');expect(api.posicao).toBe(3);await act(async()=>api.navegar(-1));expect(api.atual).toBe('1');await render('a',[m('2')]);expect(api.atual).toBe('2');await act(async()=>api.fechar());expect(api.aberta).toBe(false);expect(api.atual).toBeNull();});
it("troca de atendimento não conserva termo/pin nem remonta scroller",async()=>{await render();const scroll=container.querySelector('div');await act(async()=>{api.abrir();api.aoMudar('matri');});expect(api.atual).toBe('1');await render('outro',[m('novo')]);expect(api.aberta).toBe(false);expect(api.termo).toBe('');expect(api.atual).toBeNull();expect(container.querySelector('div')===scroll).toBe(true);});

it("foco real vai ao campo e volta ao gatilho visível; repetir atalho não perde retorno",async()=>{await render();const search=container.querySelector('[aria-label="Buscar na conversa"]')!;Object.assign(search,{getClientRects:()=>[{}]});search.focus();await act(async()=>api.abrir());const field=container.querySelector('input')!;expect((document.activeElement as unknown)===field).toBe(true);Object.assign(field,{getClientRects:()=>[{}]});await act(async()=>api.abrir(true));await act(async()=>api.fechar());expect((document.activeElement as unknown)===search).toBe(true);});

it("voltar ao contato anterior não ressuscita a busca que foi abandonada",async()=>{await render('a');await act(async()=>{api.abrir();api.aoMudar('matri');});await render('b');await render('a');expect(api.aberta).toBe(false);expect(api.termo).toBe('');expect(api.atual).toBeNull();});

it("mobile retorna ao Mais ações visível quando Buscar está oculto",async()=>{await render();const search=container.querySelector('[aria-label="Buscar na conversa"]')!,more=container.querySelector('[aria-label="Mais ações da conversa"]')!;Object.assign(search,{getClientRects:()=>[]});more.focus();await act(async()=>api.abrir());await act(async()=>api.fechar());expect((document.activeElement as unknown)===more).toBe(true);});
it("atalho preserva foco anterior válido dentro da coluna",async()=>{await render();const anterior=container.querySelector('[aria-label="Mais ações da conversa"]')!;anterior.focus();await act(async()=>api.abrir(true));await act(async()=>api.fechar());expect((document.activeElement as unknown)===anterior).toBe(true);});

it("o primeiro achado também mantém seu ID quando uma página anterior acrescenta match antes dele",async()=>{await render('a',[m('149')]);await act(async()=>{api.abrir();api.aoMudar('matricula');});expect(api.atual).toBe('149');await render('a',[m('000'),m('149')]);expect(api.atual).toBe('149');expect(api.posicao).toBe(2);});

it("remoção reconcilia e reaparição não ressuscita cursor antigo; zero e1caractere limpam achado",async()=>{await render('a',[m('000'),m('149')]);await act(async()=>{api.abrir();api.aoMudar('matri');});await act(async()=>api.navegar(1));expect(api.atual).toBe('149');await render('a',[m('000')]);expect(api.atual).toBe('000');await render('a',[m('000'),m('149')]);expect(api.atual).toBe('000');await render('a',[]);expect(api.atual).toBeNull();await render('a',[m('149')]);expect(api.atual).toBe('149');await act(async()=>api.aoMudar('m'));expect(api.atual).toBeNull();expect(api.achados).toEqual([]);});

describe("C2: a busca respeita a rolagem manual", () => {
  type Mensagens = ReturnType<typeof m>[];
  const offsets: Record<string, number> = {};
  function TelaRolagem({ mensagens, revisao, id = "a" }: { mensagens: Mensagens; revisao?: unknown; id?: string }) {
    const rolagem = useRef<HTMLDivElement>(null);
    const busca = useBuscaConversa(id, mensagens, rolagem, revisao);
    useLayoutEffect(() => { api = busca; });
    return createElement("section", { "aria-label": "Conversa" },
      createElement("button", { "aria-label": "Buscar na conversa" }),
      busca.aberta ? createElement("input", { ref: busca.campoRef }) : null,
      createElement("div", { ref: rolagem, "data-rolagem": "" },
        ...mensagens.map(msg => createElement("p", { key: msg.id, "data-mensagem-id": msg.id }, msg.corpo))));
  }
  const renderRolagem = async (mensagens: Mensagens, revisao?: unknown, id = "a") => {
    await act(async () => root.render(createElement(TelaRolagem, { mensagens, revisao, id })));
    for (const botao of container.querySelectorAll("button")) Object.assign(botao, { getClientRects: () => [{}] });
  };
  async function preparar() {
    offsets["1"] = 500; offsets["2"] = 900; offsets["3"] = 1200;
    const mensagens = [m("1"), m("2")];
    await renderRolagem(mensagens);
    const area = container.querySelector("[data-rolagem]")! as Elemento & { scrollTop: number };
    Object.assign(area, { scrollTop: 0, clientTop: 0, clientHeight: 200, getBoundingClientRect: () => ({ top: 0 }) });
    for (const row of area.querySelectorAll("[data-mensagem-id]")) {
      const id = row.getAttribute("data-mensagem-id")!;
      Object.assign(row, { getBoundingClientRect: () => ({ top: offsets[id] - area.scrollTop, height: 40 }) });
    }
    await act(async () => { api.abrir(); api.aoMudar("matri"); });
    expect(api.atual).toBe("1");
    expect(area.scrollTop).toBe(420);
    return { area, mensagens };
  }
  it.each(["SSE", "revisão visual"])("%s não recoloca o achado no centro após rolagem manual", async tipo => {
    const { area, mensagens } = await preparar();
    area.scrollTop = 700;
    await renderRolagem(tipo === "SSE" ? [...mensagens, m("3")] : mensagens, tipo === "revisão visual" ? {} : undefined);
    expect(api.atual).toBe("1");
    expect(area.scrollTop).toBe(700);
  });
  it("frame pendente não desfaz uma rolagem feita depois da seleção", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { frames.push(f); return frames.length; });
    const { area } = await preparar();
    expect(frames).toHaveLength(1);
    area.scrollTop = 700;
    await act(async () => frames[0](0));
    expect(area.scrollTop).toBe(700);
  });
  it("mudar explicitamente de achado volta a centralizar depois da rolagem manual", async () => {
    const { area } = await preparar();
    area.scrollTop = 700;
    await act(async () => api.navegar(1));
    expect(api.atual).toBe("2");
    expect(area.scrollTop).toBe(820);
  });
  it("RAF da conversa anterior não toma scroll nem foco após A→B na mesma área", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { frames.push(f); return frames.length; });
    const { area, mensagens } = await preparar();
    const frameAntigo = frames[0];
    // A mesma área e uma janela ainda transitória não autorizam o callback antigo.
    await renderRolagem(mensagens, undefined, "b");
    const externo = document.createElement("button"); document.body.appendChild(externo); externo.focus();
    area.scrollTop = 700;
    await act(async () => frameAntigo(0));
    expect(api.aberta).toBe(false);
    expect(area.scrollTop).toBe(700);
    expect(document.activeElement).toBe(externo);
  });
  it("paginação/medição recompõe o centro enquanto o usuário não abandonou a posição", async () => {
    const { area, mensagens } = await preparar();
    offsets["1"] = 800;
    await renderRolagem([m("0"), ...mensagens], {});
    expect(api.atual).toBe("1");
    expect(area.scrollTop).toBe(720);
  });
});
