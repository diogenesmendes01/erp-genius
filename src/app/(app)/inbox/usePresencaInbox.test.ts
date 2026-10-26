import{act,createElement,useLayoutEffect}from"react";
import type{Root}from"react-dom/client";
import{beforeEach,afterEach,expect,it,vi}from"vitest";
import{criarDomMinimo,desligarObservadores}from"@/test/dom-minimo";
const m=vi.hoisted(()=>({montar:vi.fn(),interagir:vi.fn(),sair:vi.fn()}));vi.mock("@/lib/presenca-inbox-cliente",()=>({montarPresencaInbox:m.montar,interagirPresencaInbox:m.interagir}));
import{usePresencaInbox}from"./usePresencaInbox";
let root:Root,handler:ReturnType<typeof usePresencaInbox>;
function Probe({id}:{id:string}){const atual=usePresencaInbox(id);useLayoutEffect(()=>{handler=atual;});return null;}
beforeEach(async()=>{vi.resetAllMocks();m.montar.mockReturnValue(m.sair);const dom=criarDomMinimo();Object.assign(dom.documento,{visibilityState:"visible"});vi.stubGlobal("document",dom.documento);vi.stubGlobal("window",dom.janela);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);const host=dom.documento.createElement("div");dom.documento.body.appendChild(host);const{createRoot}=await import("react-dom/client");root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("só mountInbox registra; trocarusuário limpa anterior e unmount remove",async()=>{await act(async()=>root.render(createElement(Probe,{id:"u"})));expect(m.montar).toHaveBeenCalledExactlyOnceWith("u");await act(async()=>root.render(createElement(Probe,{id:"v"})));expect(m.sair).toHaveBeenCalledOnce();expect(m.montar).toHaveBeenLastCalledWith("v");await act(async()=>root.render(null));expect(m.sair).toHaveBeenCalledTimes(2);});
it("somente evento real naárvoreInbox visível sinaliza atividade semconteúdo",async()=>{await act(async()=>root.render(createElement(Probe,{id:"u"})));handler({isTrusted:false});expect(m.interagir).not.toHaveBeenCalled();handler({isTrusted:true});expect(m.interagir).toHaveBeenCalledOnce();Object.assign(document,{visibilityState:"hidden"});handler({isTrusted:true});expect(m.interagir).toHaveBeenCalledOnce();});
