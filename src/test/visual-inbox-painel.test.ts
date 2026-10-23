import { afterEach, expect, it, vi } from "vitest";
import { combinacoes, ESTADOS } from "../../scripts/visual/nucleo-captura.mjs";
import { esperarConteudoApp, semanticaPainelDetalhesPronto } from "../../scripts/visual/espera-app.mjs";
afterEach(() => vi.unstubAllGlobals());
it("painel-detalhes cobre três tamanhos/dois temas sem reduzir estados313/314", () => {
  const novas = combinacoes({ alvos: ["app", "prototipo"], estados: ["painel-detalhes"] });
  expect(novas).toHaveLength(12); expect(new Set(novas.map(c => c.tamanho))).toEqual(new Set(["desktop", "tablet", "celular"]));
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: Object.keys(ESTADOS) })).toHaveLength(118);
  expect(combinacoes({ alvos: ["app", "prototipo"], estados: ["tablet-painel", "celular-painel"] })).toHaveLength(8);
});
it.each(["painel-detalhes", "tablet-painel", "celular-painel"])("%s aguarda setor e semântica318 sem exigir thread oculta", async estado => {
  let liberar!: () => void; const pronto = new Promise<void>(r => { liberar = r; }); const callbacks: unknown[] = [];
  const pagina = { getByRole: (_r: string, o: {name: string}) => { if(o.name !== "Painel Comercial") throw Error("Região oculta/inesperada:" + o.name); return { waitFor: async () => undefined }; }, waitForFunction: (f: unknown) => { callbacks.push(f); return pronto; } };
  let fim = false; const espera = esperarConteudoApp(pagina as never, estado, "celular").then(() => { fim = true; }, () => undefined);
  await Promise.resolve(); expect(fim).toBe(false); expect(callbacks).toEqual([semanticaPainelDetalhesPronto]); liberar(); await espera; expect(fim).toBe(true);
});
it("semântica318 reprova casca antiga, conteúdo incompleto, tagIA incorreta e abas não entregues", () => {
  const rect = {left:0,right:348,top:0,bottom:700,width:348,height:700};
  let header = true, nome = "Mariana Costa", ia = "Noite", tabs = [{textContent:"Detalhes",getAttribute:(n:string)=>n==="aria-selected"?"true":null}], avatar = 132, animando = false;
  const p = { inert:false, getAttribute:()=>null, getBoundingClientRect:()=>rect, getAnimations:()=>animando?[{playState:"running"}]:[],
    querySelector:(q:string)=> q==="[data-cabecalho-contato]" ? header ? {textContent:"Mariana Costa Adulto Inglês Noite",querySelector:(s:string)=>s==="h2"?{textContent:nome}:s===':scope > span'?{getBoundingClientRect:()=>({width:avatar,height:avatar})}:s==='[aria-label="Criada pela Aria"]'?{parentElement:{textContent:ia}}:null}:null:null,
    querySelectorAll:(q:string)=>q==='[role="tab"]'?tabs:q==='button[aria-label="Fechar painel do contato"]'?[{getBoundingClientRect:()=>({width:36,height:36})}]:[] };
  vi.stubGlobal("window",{innerWidth:390,innerHeight:844});vi.stubGlobal("document",{querySelector:()=>p});
  expect(semanticaPainelDetalhesPronto()).toBe(true);header=false;expect(semanticaPainelDetalhesPronto()).toBe(false);header=true;nome="Outro contato";expect(semanticaPainelDetalhesPronto()).toBe(false);nome="Mariana Costa";ia="Adulto";expect(semanticaPainelDetalhesPronto()).toBe(false);ia="Noite";tabs=[...tabs,{...tabs[0],textContent:"Oportunidades"}];expect(semanticaPainelDetalhesPronto()).toBe(false);tabs=tabs.slice(0,1);avatar=32;expect(semanticaPainelDetalhesPronto()).toBe(false);avatar=132;animando=true;expect(semanticaPainelDetalhesPronto()).toBe(false);animando=false;p.inert=true;expect(semanticaPainelDetalhesPronto()).toBe(false);
});
