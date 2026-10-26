import {act,createElement} from "react";
import type{Root} from "react-dom/client";
import{afterEach,beforeEach,expect,it,vi}from"vitest";
import{criarDomMinimo,desligarObservadores,type Documento,type Elemento}from"@/test/dom-minimo";
import{RodapeConversa,type PropsRodapeConversa}from"./RodapeConversa";
const texto=vi.fn(async()=>({ok:true as const})),nota=vi.fn(async()=>({ok:true as const}));
let root:Root,doc:Documento,host:Elemento;
function eventos(e:Elemento){const k=Object.keys(e).find(k=>k.startsWith("__reactProps"))!;return(e as unknown as Record<string,{onClick():void;onChange(e:unknown):void}>)[k];}
const b=(n:string)=>host.querySelectorAll("button").find(e=>e.textContent===n)!;
const clicar=async(n:string)=>act(async()=>{expect(Boolean(b(n))).toBe(true);eventos(b(n)).onClick();});
const montar=async(p:Partial<PropsRodapeConversa>={})=>act(async()=>root.render(createElement(RodapeConversa,{atendimentoId:"A",modo:"travado",podeEnviar:true,capacidades:[],aoEnviarTexto:texto,aoEnviarMidia:async()=>({ok:true as const}),aoNota:nota,travado:{texto:"Aria está respondendo esta conversa.",aoNota:()=>{},aoAssumir:()=>{}},...p})));
beforeEach(async()=>{vi.clearAllMocks();const d=criarDomMinimo();doc=d.documento;Object.assign(doc,{createElementNS:(_n:string,t:string)=>doc.createElement(t)});vi.stubGlobal("window",d.janela);vi.stubGlobal("document",doc);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);const storage=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)});host=doc.createElement("div");doc.body.appendChild(host);const{createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("358 Nota interna da barra escolhe única aba, mantém Responder bloqueado e envia só nota",async()=>{
 await montar();expect(host.querySelector("textarea")).toBeNull();await clicar("Nota interna");expect(Boolean(host.querySelector("textarea"))).toBe(true);expect(b("Responder").hasAttribute("disabled")).toBe(true);
 await act(async()=>eventos(host.querySelector("textarea")!).onChange({target:{value:"nota358"}}));await clicar("Enviar");expect(nota).toHaveBeenCalledOnce();expect(texto).not.toHaveBeenCalled();
});
it("358 bloquear e desbloquear mesma conversa conserva File e rascunho sem remontar Compositor",async()=>{
 await montar({modo:"compositor"});await act(async()=>eventos(host.querySelector("textarea")!).onChange({target:{value:"resposta guardada"}}));
 await act(async()=>eventos(host.querySelector("input")!).onChange({target:{files:[new File(["conteúdo"],"arquivo358.txt")],value:"arquivo358.txt"}}));expect(host.textContent).toContain("arquivo358.txt");
 await montar();expect(host.querySelector("textarea")).toBeNull();await montar({modo:"compositor"});expect((host.querySelector("textarea") as unknown as HTMLTextAreaElement).value).toBe("resposta guardada");expect(host.textContent).toContain("arquivo358.txt");expect(texto).not.toHaveBeenCalled();
});
