import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({g:null as null|import("@/test/tela-sem-dom").Ganchos,atividade:vi.fn(),montar:vi.fn()}));
vi.mock("@/lib/presenca-inbox-cliente",()=>({interagirPresencaInbox:m.atividade,montarPresencaInbox:m.montar}));
// Somente efeitos/I/O de montagem são suspensos; binding do Inbox e hook de atividade são reais.
vi.mock("react",async original=>{const real=await original<typeof import("react")>();return{...real,useState:((i:unknown)=>m.g!.useState(i)) as typeof real.useState,useRef:((i:unknown)=>m.g!.useRef(i)) as typeof real.useRef,useCallback:((fn:unknown)=>fn) as typeof real.useCallback,useMemo:((fn:()=>unknown)=>fn()) as typeof real.useMemo,useEffect:()=>{},useLayoutEffect:()=>{},useSyncExternalStore:()=>null};});
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),replace:vi.fn()}),useSearchParams:()=>null,usePathname:()=>"/inbox"}));
vi.mock("./useEventosInbox",()=>({useEventosInbox:()=>({conectado:true})}));
import { criarGanchos,elementos } from "@/test/tela-sem-dom";
import { InboxNovo,type PropsInboxNovo } from "./InboxNovo";
type Evento={isTrusted:boolean;type:string;nativeEvent:{isTrusted:boolean}};
type Binding={onScrollCapture?:(e:Evento)=>void;onWheelCapture?:(e:Evento)=>void;onPointerDownCapture?:(e:Evento)=>void;onKeyDownCapture?:(e:Evento)=>void;onTouchStartCapture?:(e:Evento)=>void};
let root:Binding;
const evento=(type:string,isTrusted=true):Evento=>({type,isTrusted,nativeEvent:{isTrusted}});
beforeEach(()=>{
 vi.clearAllMocks();m.g=criarGanchos();vi.stubGlobal("document",{visibilityState:"visible",querySelectorAll:()=>[]});vi.stubGlobal("window",{innerWidth:1440});vi.stubGlobal("fetch",vi.fn(()=>{throw Error("I/O inesperado no binding de atividade.");}));
 const props={inicial:{itens:[],proximo:null},filtros:{},selecionado:null,usuario:{id:"ator-presenca-452",papeis:["VENDEDOR"]},fuso:null} as PropsInboxNovo;
 const tree=m.g.renderizar(InboxNovo as (p:PropsInboxNovo)=>ReactNode,props);const elemento=elementos(tree).find(n=>n.type==="div"&&Object.hasOwn(n.props,"data-vista"));expect(elemento).toBeDefined();root=elemento!.props as Binding;
});
afterEach(()=>{m.g=null;vi.restoreAllMocks();vi.unstubAllGlobals();});
it("scroll programático continua sem atividade mesmo quando o evento do browser é trusted",()=>{
 root.onScrollCapture?.(evento("scroll",true));root.onScrollCapture?.(evento("scroll",true));expect(m.atividade).not.toHaveBeenCalled();
});
it.each(["wheel","pointerdown","keydown"] as const)("entrada humana %s trusted usa hook normal e renova atividade",tipo=>{
 const binding=tipo==="wheel"?root.onWheelCapture:tipo==="pointerdown"?root.onPointerDownCapture:root.onKeyDownCapture;expect(binding).toBeTypeOf("function");binding!(evento(tipo));expect(m.atividade).toHaveBeenCalledExactlyOnceWith();
});
it("eventos sintéticos e aba oculta não renovam por nenhum binding humano",()=>{
 for(const binding of[root.onWheelCapture,root.onPointerDownCapture,root.onKeyDownCapture,root.onTouchStartCapture])binding?.(evento("entrada",false));expect(m.atividade).not.toHaveBeenCalled();Object.assign(document,{visibilityState:"hidden"});for(const binding of[root.onWheelCapture,root.onPointerDownCapture,root.onKeyDownCapture,root.onTouchStartCapture])binding?.(evento("entrada",true));expect(m.atividade).not.toHaveBeenCalled();
});
it("bindings não criam novo transporte ou polling além do sinal de interação existente",()=>{
 const intervalo=vi.spyOn(globalThis,"setInterval");for(const binding of[root.onScrollCapture,root.onWheelCapture,root.onPointerDownCapture,root.onKeyDownCapture])binding?.(evento("entrada",true));expect(intervalo).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});