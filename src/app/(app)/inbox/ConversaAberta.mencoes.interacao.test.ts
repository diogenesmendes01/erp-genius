import { Papel } from "@prisma/client";
import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import type { PropsCompositor } from "@/components/conversa/Compositor";
import type { PropsConversaAberta } from "./ConversaAberta";

const m = vi.hoisted(() => ({ executar: vi.fn(), identidades: [] as string[], transferir: null as import("./MenuConversa").AcaoConversa | null, buscas: [] as NonNullable<PropsCompositor["buscarMencoes"]>[] }));
vi.mock("./RodapeConversa", () => ({ RodapeConversa: (p: PropsCompositor) => {
  const buscar = p.buscarMencoes!;
  m.buscas.push(buscar);
  useEffect(() => { void buscar("Jo"); }, [buscar]);
  return null;
} }));
vi.mock("./CabecalhoConversa", () => ({ CabecalhoConversa: (p:Parameters<typeof import("./CabecalhoConversa").CabecalhoConversa>[0]) => { m.transferir = p.acoes.transferir; return p.acoes.transferir ? createElement("button",{ref:p.acoes.transferir.gatilhoRef,onClick:p.acoes.transferir.aoEscolher},"Abrir transferência") : null; } }));
vi.mock("./fluxos/transferir/acoes-transferir",()=>({executarTransferenciaInbox:m.executar,carregarPessoasTransferir:async()=>[{id:"b",nome:"Beatriz"}],carregarResumoTransferir:async()=>false}));
vi.mock("./AcoesAtendimento", () => ({ useAcoesAtendimento: () => ({ feedback: null, dialogos: null, abrirAgendar: null, menu: [] }) }));
vi.mock("./AcoesMensagem", () => ({ AcoesMensagem: () => null }));
vi.mock("@/components/conversa/VirtualList", () => ({ VirtualList: () => null }));
vi.mock("@/components/conversa/agora-thread", () => ({ useAgoraDaThread: () => Date.UTC(2026, 9, 24, 12) }));
vi.mock("@/server/whatsapp/acoes", () => ({ enviarMidiaInbox: vi.fn(), enviarTextoInbox: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ registrarNotaAtendimento: vi.fn(), enviarPropostaNoAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento", () => ({ origemVisivelDaTransferencia: vi.fn(), propostasDoAtendimento: vi.fn(async () => ({ oportunidadeId: null, propostas: [] })) }));
vi.mock("@/server/crm-config/acoes-respostas", () => ({ respostasRapidasDoCompositor: async () => [] }));

vi.mock("./fluxos/transferir/ControladorTransferir",async original=>{
 const real=await original<typeof import("./fluxos/transferir/ControladorTransferir")>();
 return {ControladorTransferir:(p:Parameters<typeof real.ControladorTransferir>[0])=>{m.identidades.push(p.identidade);return createElement(real.ControladorTransferir,p);}};
});
let root: Root, host: Elemento;
let ConversaAberta: typeof import("./ConversaAberta").ConversaAberta;
const fetchMock = vi.fn<typeof fetch>(async () => ({ ok: true, json: async () => [] }) as unknown as Response);
const props = (id = "a"): PropsConversaAberta => ({ item: { id, capacidades: [], status: "EM_ATENDIMENTO", grupo: false }, usuario: { id: "u", papeis: [] }, fuso: "UTC", conversa: { mensagens: [], notas: [], temMaisAntes: false, temMaisDepois: false }, aoVoltar() {}, aoAlternarPainel() {}, aoMudar() {}, podeEnviar: false } as unknown as PropsConversaAberta);
const renderizar = async (p = props()) => { await act(async () => root.render(createElement(ConversaAberta, p))); };

beforeEach(async () => {
  const dom = criarDomMinimo();
  vi.stubGlobal("document", dom.documento); vi.stubGlobal("window", dom.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock);
  m.executar.mockReset();m.executar.mockResolvedValue({ok:true});
  Object.assign(dom.janela,{innerWidth:1280,innerHeight:800,addEventListener(){},removeEventListener(){}});
  const criar=dom.documento.createElement.bind(dom.documento);dom.documento.createElement=((tag:string)=>{const el=criar(tag);if(tag==="select")Object.defineProperty(el,"options",{get:()=>el.querySelectorAll("option")});Object.assign(el,{getBoundingClientRect:()=>({top:40,bottom:76,left:300,right:336,width:340,height:300})});return el;}) as typeof dom.documento.createElement;
  m.buscas.length = 0; m.identidades.length = 0; m.transferir = null; fetchMock.mockClear();
  host = dom.documento.createElement("div"); dom.documento.body.appendChild(host);
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
  ({ ConversaAberta } = await import("./ConversaAberta"));
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });

it("re-render do pai sem trocar atendimento não repete GET do consumidor", async () => {
  await renderizar(); expect(fetchMock).toHaveBeenCalledTimes(1);
  await renderizar(props("a")); expect(fetchMock).toHaveBeenCalledTimes(1);
  await renderizar(props("b")); expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("/b/mencoes?");
});
it("callback captura somente o atendimento e repassa o AbortSignal ao fetch", async () => {
  await renderizar(props("a/?"));
  const controlador = new AbortController();
  await m.buscas.at(-1)!("A & B", controlador.signal);
  expect(fetchMock).toHaveBeenLastCalledWith("/api/inbox/atendimentos/a%2F%3F/mencoes?q=A+%26+B", expect.objectContaining({ credentials: "same-origin", cache: "no-store", signal: controlador.signal }));
});

it("447 C2 identidade conserva status abertos mas distingue encerramento",async()=>{
 const p=props();p.item={...p.item!,status:"AGUARDANDO_CLIENTE"};await renderizar(p);const aberta=m.identidades.at(-1);
 await renderizar({...p,item:{...p.item!,status:"EM_ATENDIMENTO"}});expect(m.identidades.at(-1)).toBe(aberta);
 await renderizar({...p,item:{...p.item!,status:"ENCERRADO"}});expect(m.identidades.at(-1)).not.toBe(aberta);
});

function handlers447(el:Elemento){const k=Object.keys(el).find(k=>k.startsWith("__reactProps"))!;return(el as unknown as Record<string,{onClick():void;onChange(e:unknown):void;onSubmit(e:unknown):void}>)[k];}
const clicar447=async(texto:string)=>act(async()=>handlers447(Array.from(document.body.querySelectorAll("button")).find(b=>b.textContent===texto) as unknown as Elemento).onClick());
const mudar447=async(selector:string,value:string)=>act(async()=>handlers447(document.body.querySelector(selector) as unknown as Elemento).onChange({target:{value}}));
const submit447=async()=>act(async()=>handlers447(document.body.querySelector("form") as unknown as Elemento).onSubmit({preventDefault(){}}));
function props447(){const p=props();return{...p,usuario:{id:"u",papeis:["GERENTE_COMERCIAL" as const]},item:{...p.item!,finalidade:"COMERCIAL" as const,status:"AGUARDANDO_CLIENTE" as const,responsavelId:"u",numeroId:"n",contatoId:"c",setoresDoNumero:["COMERCIAL" as const,"SECRETARIA" as const]}};}
it("447 C2 inbound preserva formulário real, contexto e chave de retry; C1 só anuncia ACK atual",async()=>{
 const p={...props447(),aoTransferirConcluido:vi.fn(),aoMudar:vi.fn()};m.executar.mockResolvedValueOnce({ok:false,erro:"Tente novamente"}).mockResolvedValueOnce({ok:true});await renderizar(p);await clicar447("Abrir transferência");await clicar447("Equipes e filas");await mudar447("select","SECRETARIA");await mudar447("textarea","Contexto preservado");await submit447();expect(p.aoTransferirConcluido).not.toHaveBeenCalled();const primeira=m.executar.mock.calls[0][0];
 await renderizar({...p,item:{...p.item,status:"EM_ATENDIMENTO"}});expect((document.body.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Contexto preservado");await submit447();expect(m.executar.mock.calls[1][0]).toEqual(primeira);expect(p.aoTransferirConcluido).toHaveBeenCalledExactlyOnceWith("Atendimento transferido para Secretaria.");expect(p.aoMudar).toHaveBeenCalledOnce();
});
for(const mudanca of ["owner","closed","cap"] as const)it(`447 C2 ${mudanca} continua invalidando formulário real`,async()=>{
 const p=props447();await renderizar(p);await clicar447("Abrir transferência");await clicar447("Equipes e filas");await mudar447("select","SECRETARIA");await mudar447("textarea","Não reutilizar");
 await renderizar(mudanca==="owner"?{...p,item:{...p.item,responsavelId:"outro"}}:mudanca==="closed"?{...p,item:{...p.item,status:"ENCERRADO"}}:{...p,usuario:{id:"u",papeis:[]}});expect(document.body.textContent).toContain("Feche e abra novamente");expect(document.body.querySelector("textarea")).toBeNull();expect(m.executar).not.toHaveBeenCalled();
});

it("consumidor abre Transferir com destinos opcionais ausentes sem falhar no formulário", async () => {
  const p = props();
  p.usuario = { id: "u", papeis: [Papel.ADMINISTRADOR] };
  p.item = { ...p.item!, numeroId: "n", contatoId: "c", finalidade: "COMERCIAL", setoresDoNumero: ["COMERCIAL", "SECRETARIA"], responsavelId: "u", numeroDonoId: null, linhaComercial: false, estadoAria: null };
  expect(p.destinos).toBeUndefined();
  await renderizar(p);
  expect(m.transferir).not.toBeNull();
  await act(async () => m.transferir!.aoEscolher());
  const dialogo = document.body.querySelector('[role="dialog"]');
  expect(dialogo).not.toBeNull();
  expect(dialogo!.querySelector("form")).not.toBeNull();
});
