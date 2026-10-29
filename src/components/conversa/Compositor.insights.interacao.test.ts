import { act,createElement } from "react";
import type { Root } from "react-dom/client";
import { beforeEach,afterEach,expect,it,vi } from "vitest";
import { criarDomMinimo,desligarObservadores,type Elemento } from "@/test/dom-minimo";
import type { PropsCompositor } from "./Compositor";
import type { PortaRascunhoInsight } from "./rascunho-insight";
vi.mock("@tabler/icons-react",()=>Object.fromEntries(["IconCalendarEvent","IconMicrophone","IconMoodSmile","IconPaperclip","IconPlayerStop","IconSend","IconTrash","IconBolt","IconCamera","IconFileCheck","IconBook","IconFileText","IconListCheck","IconMapPin","IconPhoto","IconUser"].map(k=>[k,()=>null])));
let root:Root,host:Elemento,Compositor:typeof import("./Compositor").Compositor,porta:PortaRascunhoInsight|null;
const storage=new Map<string,string>(),enviar=vi.fn(),publicar=(p:PortaRascunhoInsight|null)=>{porta=p;};
const props=(p:Partial<PropsCompositor>={}):PropsCompositor=>({atendimentoId:"A",modo:"responder",podeEnviar:true,capacidades:[],aoEnviarTexto:enviar,aoEnviarMidia:enviar,aoNota:enviar,aoPortaRascunhoInsight:publicar,...p});
const evento=(e:Elemento)=>(e as unknown as Record<string,Record<string,(e?:unknown)=>void>>)[Object.keys(e).find(k=>k.startsWith("__reactProps"))!];
const campo=()=>host.querySelector("textarea")! as Elemento & {value:string};
async function montar(p:Partial<PropsCompositor>={}){await act(async()=>root.render(createElement(Compositor,props(p))));}
async function digitar(texto:string){await act(async()=>evento(campo()).onChange({target:{value:texto,selectionStart:texto.length}}));}
async function usar(p:PortaRascunhoInsight,texto="Texto exato377"){let r:unknown;await act(async()=>{r=await p.usar({texto,geracaoId:"g377",revisaoEsperada:p.revisao});});return r;}
beforeEach(async()=>{vi.resetAllMocks();porta=null;storage.clear();const d=criarDomMinimo();vi.stubGlobal("window",d.janela);vi.stubGlobal("document",d.documento);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});host=d.documento.createElement("div");d.documento.body.appendChild(host);const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);({Compositor}=await import("./Compositor"));});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("porta escreve no mesmo campo físico sem foco/envio/remount",async()=>{await montar();expect(porta).not.toBeNull();const antes=campo(),foco=document.activeElement;expect(await usar(porta!)).toEqual({ok:true});expect(campo()).toBe(antes);expect(campo().value).toBe("Texto exato377");expect(document.activeElement).toBe(foco);expect(enviar).not.toHaveBeenCalled();});
it("digitação humana muda revisão e recusa a porta antiga sem sobrescrever",async()=>{await montar();const antiga=porta!;await digitar("Texto humano");expect(porta!.revisao).not.toBe(antiga.revisao);expect(await usar(antiga)).toMatchObject({ok:false});expect(campo().value).toBe("Texto humano");});
it("porta não existe em Nota, sem permissão ou bloqueioexterno",async()=>{await montar({modo:"nota"});expect(porta).toBeNull();await montar({podeEnviar:false});expect(porta).toBeNull();await montar({bloqueioExterno:true});expect(porta).toBeNull();});
it("A→B→A invalida callback antigo, preserva os rascunhos por modo",async()=>{await montar();await digitar("Rascunho A");const antiga=porta!;await montar({atendimentoId:"B"});await digitar("Rascunho B");await montar();expect(campo().value).toBe("Rascunho A");expect(await usar(antiga)).toMatchObject({ok:false});expect(campo().value).toBe("Rascunho A");});
it("inserção preserva arquivo anexado e Nota persistida",async()=>{storage.set("conversa-rascunho:A:nota","Nota preservada");await montar();const input=host.querySelector('input[type="file"]')!;await act(async()=>evento(input).onChange({target:{files:[new File(["arquivo"],"ficticio377.txt",{type:"text/plain"})],value:""}}));expect(host.textContent).toContain("ficticio377.txt");expect(await usar(porta!)).toEqual({ok:true});expect(host.textContent).toContain("ficticio377.txt");expect(storage.get("conversa-rascunho:A:nota")).toBe("Nota preservada");});
it("unmount revoga porta antiga",async()=>{await montar();const antiga=porta!;await act(async()=>root.unmount());expect(await usar(antiga)).toMatchObject({ok:false});const {createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
