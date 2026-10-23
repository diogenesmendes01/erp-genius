import { afterEach, expect, it, vi } from "vitest";
import { ESTADOS, combinacoes } from "../../scripts/visual/nucleo-captura.mjs";
import { abrirPopoverColunaApp, esperarConteudoApp, semanticaPopoverColunaPronta } from "../../scripts/visual/espera-app.mjs";
afterEach(()=>vi.unstubAllGlobals());
it("três popovers acrescentam36PNG sem reduzir autoria314 e lista-vazia312",()=>{
 for(const estado of ["filtros","seletor-numero","nova-conversa"]){const c=combinacoes({alvos:["app","prototipo"],estados:[estado]});expect(c).toHaveLength(12);expect(new Set(c.map(p=>p.tamanho))).toEqual(new Set(["desktop","tablet","celular"]));}
 expect(combinacoes({alvos:["app","prototipo"],estados:Object.keys(ESTADOS)})).toHaveLength(106);
 expect(combinacoes({alvos:["app","prototipo"],estados:["humano-compositor"]})).toHaveLength(12);
 expect(combinacoes({alvos:["app","prototipo"],estados:["lista-vazia"]})).toHaveLength(12);
});
it.each([['filtros','Filtros'],['nova-conversa','Nova conversa'],['seletor-numero','Todos os números']])("%s espera lista e hidratação antes do clique real",async(estado,alvo)=>{
 let listaPronta!:()=>void,hidratada!:()=>void;const lista=new Promise<void>(r=>{listaPronta=r;}),sse=new Promise<void>(r=>{hidratada=r;});const cliques:string[]=[];
 const botao=(name:string|RegExp)=>({click:async()=>{cliques.push(typeof name==='string'?name:alvo);}});
 const regiao={getByText:()=>({waitFor:()=>lista}),getByRole:(_r:string,o:{name:string|RegExp})=>botao(o.name)};
 const pagina={locator:()=>({waitFor:()=>sse}),getByRole:(role:string,o:{name:string|RegExp})=>role==='region'?regiao:botao(o.name)};
 const p=abrirPopoverColunaApp(pagina as never,estado,'celular');await Promise.resolve();expect(cliques).toEqual([]);listaPronta();await Promise.resolve();expect(cliques).toEqual([]);hidratada();await p;expect(cliques).toEqual([alvo]);
});
it.each([['filtros','Filtrar conversas','Mostrar conversas'],['nova-conversa','Nova conversa','Finalidade e destinatário'],['seletor-numero','Ver conversas de','Todos os números']])("prontidão%s não confunde contêiner visível com conteúdo e geometria finais",async(estado,titulo,controle)=>{
 let conteudoPronto!:()=>void,geometriaPronta!:()=>void;const conteudo=new Promise<void>(r=>{conteudoPronto=r;}),geometria=new Promise<void>(r=>{geometriaPronta=r;});const nomes:string[]=[];
 const localizar=(name:string):unknown=>({waitFor:()=>name===controle?conteudo:Promise.resolve(),getByRole:(_r:string,o:{name:string})=>localizar(o.name),getByLabel:(n:string|RegExp)=>localizar(typeof n === "string" ? n : controle)});
 const pagina={getByRole:(_r:string,o:{name:string})=>{nomes.push(o.name);return localizar(o.name);},waitForFunction:()=>geometria};let fim=false;const p=esperarConteudoApp(pagina as never,estado,'celular').then(()=>{fim=true;});await Promise.resolve();expect(fim).toBe(false);conteudoPronto();await Promise.resolve();expect(fim).toBe(false);geometriaPronta();await p;expect(nomes[0]).toBe(titulo);
});
it("não libera folha fora do viewport, em transição ou com ação final fora da área visível",()=>{
 let rect={left:0,right:390,top:75,bottom:500,width:390,height:425},rodape={left:0,right:390,top:450,bottom:500,width:390,height:50};let animando=false;
 const dialogo={inert:false,getAttribute:(n:string)=>n==='aria-label'?'Filtrar conversas':null,getBoundingClientRect:()=>rect,getAnimations:()=>animando?[{playState:'running'}]:[],querySelector:()=>({getBoundingClientRect:()=>rodape})};
 vi.stubGlobal('window',{innerWidth:390,innerHeight:500});vi.stubGlobal('document',{querySelectorAll:()=>[dialogo]});
 expect(semanticaPopoverColunaPronta('Filtrar conversas')).toBe(true);rect={...rect,bottom:700};expect(semanticaPopoverColunaPronta('Filtrar conversas')).toBe(false);rect={...rect,bottom:500};animando=true;expect(semanticaPopoverColunaPronta('Filtrar conversas')).toBe(false);animando=false;rodape={...rodape,bottom:520};expect(semanticaPopoverColunaPronta('Filtrar conversas')).toBe(false);expect(semanticaPopoverColunaPronta('Nova conversa')).toBe(false);
});
