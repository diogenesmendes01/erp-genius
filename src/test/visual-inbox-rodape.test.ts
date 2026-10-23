import { afterEach, expect, it, vi } from "vitest";
import { combinacoes, ESTADOS } from "../../scripts/visual/nucleo-captura.mjs";
import * as esperas from "../../scripts/visual/espera-app.mjs";
import { criarDomMinimo, desligarObservadores, type Elemento } from "./dom-minimo";

afterEach(() => { desligarObservadores(); vi.unstubAllGlobals(); });
const novos = esperas as unknown as { abrirNotaConversaApp(pagina:unknown,tamanho:string):Promise<void>; semanticaRodapePronto(modo:string):boolean };
it("nota acrescenta12PNG nos três tamanhos/dois temas sem perder estados anteriores", () => {
  expect(() => combinacoes({alvos:["app","prototipo"],estados:["nota"]})).not.toThrow();
  expect(combinacoes({alvos:["app","prototipo"],estados:["nota"]})).toHaveLength(12);
  expect(ESTADOS.nota.prototipo).toBe(true);
  for(const estado of ["humano-compositor","painel-detalhes","menu-mais","filtros","nova-conversa"]) expect(combinacoes({alvos:["app","prototipo"],estados:[estado]})).toHaveLength(12);
});
it("aba nota só abre após thread real e hidratação e não aciona envio", async () => {
  expect(novos.abrirNotaConversaApp).toBeTypeOf("function");
  let liberar!:()=>void; const sse=new Promise<void>(r=>{liberar=r;}); const click=vi.fn(); const nomes:string[]=[];
  const regiao={waitFor:async()=>{},getByText:()=>({waitFor:async()=>{}}),getByRole:(r:string,o?:{name:string})=>{nomes.push(r+":"+(o?.name??""));return r==="note"?{getByText:()=>({waitFor:async()=>{}})}:{click};}};
  const pagina={locator:()=>({waitFor:()=>sse}),waitForFunction:async()=>{},getByRole:()=>regiao};
  const p=novos.abrirNotaConversaApp(pagina,"celular"); await Promise.resolve();expect(click).not.toHaveBeenCalled();liberar();await p;
  expect(nomes).toContain("tab:Nota interna");expect(click).toHaveBeenCalledOnce();
});

function montar(modo:"responder"|"nota") {
  const {documento}=criarDomMinimo();
  vi.stubGlobal("document",{querySelector:(s:string)=>documento.documentElement.querySelector(s)});
  vi.stubGlobal("window",{innerWidth:390,innerHeight:500});
  const criar=(tag:string,attrs:Record<string,string>={},texto="",pai:Elemento=documento.body)=>{
    const e=documento.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);e.textContent=texto;pai.appendChild(e);
    return Object.assign(e,{disabled:false,value:"",getBoundingClientRect:()=>({left:16,right:374,top:360,bottom:404,width:358,height:44})});
  };
  const conversa=criar("section",{"aria-label":"Conversa"});
  criar("header",{},"",conversa).getBoundingClientRect=()=>({left:0,right:390,top:0,bottom:68,width:390,height:68});
  const footer=criar("footer",{},"",conversa);footer.getBoundingClientRect=()=>({left:0,right:390,top:350,bottom:500,width:390,height:150});
  const tabs=criar("div",{role:"tablist","aria-label":"Tipo da mensagem"},"",footer);
  const responder=criar("button",{role:"tab",id:"responder","aria-selected":String(modo==="responder"),"aria-controls":"campo"},"Responder",tabs);
  const nota=criar("button",{role:"tab",id:"nota","aria-selected":String(modo==="nota"),"aria-controls":"campo"},"Nota interna",tabs);
  criar("span",{},"/ respostas rápidas",tabs);
  const painel=criar("div",{role:"tabpanel",id:"campo","aria-labelledby":modo},"",footer);
  const campo=criar("textarea",{"aria-label":modo==="nota"?"Escreva uma nota interna":"Escreva uma mensagem"},"",painel);
  criar("button",{"aria-label":"Emojis"},"",painel);
  if(modo==="nota") {criar("p",{role:"note"},"Nota interna: fica só para a equipe e não é enviada ao contato.",painel);criar("button",{},"Enviar",painel);}
  else {criar("button",{"aria-label":"Anexar"},"",painel);criar("button",{"aria-label":"Agendar mensagem"},"",painel);criar("button",{"aria-label":"Gravar mensagem de voz"},"",painel);}
  return {criar,conversa,footer,campo,nota,responder,tabs,painel};
}
it.each(["responder","nota"] as const)("prontidão%s recusa casca antiga, aba errada, campo desabilitado, alvo pequeno ou rodapé fora",modo=>{
  expect(novos.semanticaRodapePronto).toBeTypeOf("function");
  const f=montar(modo); expect(novos.semanticaRodapePronto(modo)).toBe(true);
  f.campo.disabled=true;expect(novos.semanticaRodapePronto(modo)).toBe(false);f.campo.disabled=false;
  const ativa=modo==="nota"?f.nota:f.responder;ativa.setAttribute("aria-selected","false");expect(novos.semanticaRodapePronto(modo)).toBe(false);ativa.setAttribute("aria-selected","true");
  const ret=ativa.getBoundingClientRect;ativa.getBoundingClientRect=()=>({...ret(),height:26});expect(novos.semanticaRodapePronto(modo)).toBe(false);ativa.getBoundingClientRect=ret;
  const r=f.footer.getBoundingClientRect;f.footer.getBoundingClientRect=()=>({...r(),bottom:501.5});expect(novos.semanticaRodapePronto(modo)).toBe(false);f.footer.getBoundingClientRect=r;
  f.tabs.removeChild(f.nota);expect(novos.semanticaRodapePronto(modo)).toBe(false);
});
it("nota não libera captura com anexo/agenda/voz ou promessa de menção",()=>{
  expect(novos.semanticaRodapePronto).toBeTypeOf("function");const f=montar("nota");
  for(const nome of ["Anexar","Agendar mensagem","Gravar mensagem de voz"]){const b=f.criar("button",{"aria-label":nome},"",f.painel);expect(novos.semanticaRodapePronto("nota")).toBe(false);f.painel.removeChild(b);}
  f.criar("span",{},"@ mencionar",f.footer);expect(novos.semanticaRodapePronto("nota")).toBe(false);
});
it("aviso de nota no rodapé não substitui nem invalida notas reais da thread314",()=>{
  const f=montar("nota");const m=f.criar("div",{"data-mensagem-id":"m"},"",f.conversa);f.criar("span",{},"Você",m);f.criar("span",{title:"Lida"},"",m);
  const nota=f.criar("div",{role:"note","data-nota-id":"n"},"Nota interna · só equipe",f.conversa);f.criar("div",{"data-virtual-key":"dia:2026-10-23"},"Hoje",f.conversa);
  expect(esperas.semanticaThreadHumanaPronta()).toBe(true);
  f.criar("button",{},"Comando indevido",nota);expect(esperas.semanticaThreadHumanaPronta()).toBe(false);
});
