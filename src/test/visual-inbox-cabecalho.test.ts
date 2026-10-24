import { afterEach, expect, it, vi } from "vitest";
import { combinacoes, ESTADOS } from "../../scripts/visual/nucleo-captura.mjs";
import { abrirMenuConversaApp, esperarConteudoApp, semanticaMenuConversaPronto } from "../../scripts/visual/espera-app.mjs";
afterEach(()=>vi.unstubAllGlobals());
it("menu-mais acrescenta12PNG preservando estados313314318",()=>{
 expect(combinacoes({alvos:["app","prototipo"],estados:["menu-mais"]})).toHaveLength(12);
 expect(combinacoes({alvos:["app","prototipo"],estados:Object.keys(ESTADOS).filter(e => !["painel-detalhes-pessoa", "painel-detalhes-b2b", "painel-detalhes-convidado"].includes(e) && e !== "painel-secretaria" && !e.startsWith("entrada-"))})).toHaveLength(176);
 for(const e of ["humano-compositor","lista-vazia","painel-detalhes","filtros","seletor-numero","nova-conversa"]) expect(combinacoes({alvos:["app","prototipo"],estados:[e]})).toHaveLength(12);
});
it("aguarda thread e hidratação antes de abrir o menu real",async()=>{
 let liberar!:()=>void;const sse=new Promise<void>(r=>{liberar=r;});const click=vi.fn();
 const pagina={locator:()=>({waitFor:()=>sse}),getByRole:(role:string)=>role==="button"?{click}: {waitFor:async()=>{},getByText:()=>({waitFor:async()=>{}})}};
 const p=abrirMenuConversaApp(pagina as never,"celular");await Promise.resolve();expect(click).not.toHaveBeenCalled();liberar();await p;expect(click).toHaveBeenCalledOnce();
});
it("prontidão do menu exige conteúdo real e medição antes da foto",async()=>{
 let liberar!:()=>void;const pronto=new Promise<void>(r=>{liberar=r;});const callbacks:unknown[]=[];const nomes:string[]=[];
 const pagina={getByRole:(r:string,o:{name:string})=>{nomes.push(r+":"+o.name);return {waitFor:async()=>{},getByText:()=>({waitFor:async()=>{}})};},waitForFunction:(f:unknown)=>{callbacks.push(f);return pronto;}};
 let fim=false;const p=esperarConteudoApp(pagina as never,"menu-mais","celular").then(()=>{fim=true;});await Promise.resolve();expect(fim).toBe(false);expect(nomes).toContain("menu:Mais ações da conversa");expect(callbacks).toEqual([semanticaMenuConversaPronto]);liberar();await p;expect(fim).toBe(true);
});
it("reprova casca vazia/header errado/posiçãofora/busca desabilitada ou bloqueio sem motivo",()=>{
 let altura=68,top=75,habilitada=true,motivo=true,quantidade=12;const r=()=>({left:0,right:390,top,bottom:500,width:390,height:500-top});
 const menu={getBoundingClientRect:r,querySelectorAll:()=>Array.from({length:quantidade},(_,i)=>({textContent:i===6?"Buscar na conversa":i===11?"Bloquear contato "+(motivo?"Disponível quando o motor próprio da escola entrar em uso.":""):"Comando",disabled:i===6?!habilitada:i===11,getAttribute:()=>null}))};
 const header={getBoundingClientRect:()=>({height:altura})};
 vi.stubGlobal("window",{innerWidth:390,innerHeight:500});vi.stubGlobal("document",{querySelector:(q:string)=>q.includes("header")?header:menu});
 expect(semanticaMenuConversaPronto()).toBe(true);altura=207;expect(semanticaMenuConversaPronto()).toBe(false);altura=68;top=-3;expect(semanticaMenuConversaPronto()).toBe(false);top=75;habilitada=false;expect(semanticaMenuConversaPronto()).toBe(false);habilitada=true;motivo=false;expect(semanticaMenuConversaPronto()).toBe(false);motivo=true;quantidade=0;expect(semanticaMenuConversaPronto()).toBe(false);
});
