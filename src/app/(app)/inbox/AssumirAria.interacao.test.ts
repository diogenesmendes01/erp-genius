import { act,createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { Papel } from "@prisma/client";
import { criarDomMinimo,desligarObservadores,type Documento,type Elemento } from "@/test/dom-minimo";
import { useAcoesAtendimento,type PropsAcoesAtendimento } from "./AcoesAtendimento";
const m=vi.hoisted(()=>({legado:vi.fn(),aria:vi.fn(),mudar:vi.fn()}));
vi.mock("@/server/whatsapp/acoes-atendimento",()=>({assumirAtendimento:m.legado,assumirConversaDaAria:m.aria,atribuirAtendimento:vi.fn(),convidarParticipante:vi.fn(),devolverParaFila:vi.fn(),revogarParticipante:vi.fn(),transferirAtendimento:vi.fn()}));
let root:Root,doc:Documento,host:Elemento;
type Props=PropsAcoesAtendimento&{aoBuscar():void;contextoAria:boolean;podeAssumirAria:boolean};
const base:Props={atendimento:{id:"A",finalidade:"COMERCIAL",responsavelId:null,status:"ABERTO_SEM_RESPONSAVEL"},usuario:{id:"u",papeis:[Papel.VENDEDOR]},setoresDoNumero:["COMERCIAL"],fixada:false,silenciada:false,fuso:"UTC",aoMudar:()=>m.mudar(),aoBuscar(){},contextoAria:true,podeAssumirAria:true};
function Tela(p:Props){const a=useAcoesAtendimento(p);return createElement("section",null,a.assumir?createElement("button",{onClick:a.assumir.aoEscolher},a.assumir.rotulo):null,a.feedback,a.dialogos);}
function eventos(el:Elemento){const k=Object.keys(el).find(k=>k.startsWith("__reactProps"))!;return(el as unknown as Record<string,{onClick():void}>)[k];}
const botao=()=>host.querySelectorAll("button").find(b=>b.textContent==="Assumir conversa");
const montar=async(p:Partial<Props>={})=>act(async()=>root.render(createElement(Tela,{...base,...p})));
const clicar=async()=>act(async()=>{expect(botao()).toBeDefined();eventos(botao()!).onClick();});
beforeEach(async()=>{vi.resetAllMocks();m.legado.mockResolvedValue({ok:true});m.aria.mockResolvedValue({ok:true});const d=criarDomMinimo();doc=d.documento;vi.stubGlobal("window",d.janela);vi.stubGlobal("document",doc);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("MutationObserver",d.MutationObserver);host=doc.createElement("div");doc.body.appendChild(host);const{createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("357 cabeçalho no contexto Aria usa só a nova action",async()=>{await montar();await clicar();expect(m.aria).toHaveBeenCalledExactlyOnceWith("A");expect(m.legado).not.toHaveBeenCalled();expect(m.mudar).toHaveBeenCalledOnce();});
it("357 contexto normal preserva action legada",async()=>{await montar({contextoAria:false});await clicar();expect(m.legado).toHaveBeenCalledExactlyOnceWith("A");expect(m.aria).not.toHaveBeenCalled();});
it("357 próprio responsável também pode assumir condução, sem alterar carteira",async()=>{await montar({atendimento:{...base.atendimento,responsavelId:"u",status:"EM_ATENDIMENTO"}});await clicar();expect(m.aria).toHaveBeenCalledOnce();expect(m.legado).not.toHaveBeenCalled();});
it("357 capacidade fresca falsa nunca cai no assumir legado",async()=>{await montar({podeAssumirAria:false});expect(botao()).toBeUndefined();expect(m.aria).not.toHaveBeenCalled();expect(m.legado).not.toHaveBeenCalled();});
it.each(["revogacao","A-B-A","desmontar"] as const)("357 ACK antigo não reconcilia após %s",async caso=>{
 let resolver!:(r:{ok:true})=>void;m.aria.mockImplementationOnce(()=>new Promise(r=>resolver=r));await montar();await clicar();expect(m.aria).toHaveBeenCalledOnce();
 if(caso==="revogacao"){await montar({podeAssumirAria:false});await montar();}else if(caso==="A-B-A"){await montar({atendimento:{...base.atendimento,id:"B"}});await montar();}else await act(async()=>root.render(null));
 await act(async()=>resolver({ok:true}));expect(m.mudar).not.toHaveBeenCalled();
});
it("357 handler retido antes da revogação não chama action depois de perder e recuperar capacidade",async()=>{await montar();const clicarAntigo=eventos(botao()!).onClick;await montar({podeAssumirAria:false});await montar();await act(async()=>clicarAntigo());expect(m.aria).not.toHaveBeenCalled();expect(m.legado).not.toHaveBeenCalled();});
it("357 grupos e encerrados não ganham CTA por capacidade isolada",async()=>{await montar({grupo:true});expect(botao()).toBeUndefined();await montar({atendimento:{...base.atendimento,status:"ENCERRADO"}});expect(botao()).toBeUndefined();});
