import{EventEmitter}from'node:events';
import {afterEach,expect,it,vi}from'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn<(contexto:unknown,base:string,email:string,senha:string)=>Promise<void>>(async()=>{}),conteudo:vi.fn(async()=>{}),hidratacao:vi.fn(async()=>{})}));
vi.mock('../../scripts/visual/espera-app.mjs',async original=>({...await original<object>(),autenticarApp:mocks.auth,esperarConteudoApp:mocks.conteudo,esperarHidratacaoApp:mocks.hidratacao}));
import{abrirApp}from'../../scripts/visual/capturar-inbox.mjs';
import{semanticaEstado319Pronto}from'../../scripts/visual/estados-inbox.mjs';
afterEach(()=>vi.clearAllMocks());
function fixture(){const click=vi.fn(async()=>{}),waitForFunction=vi.fn(async()=>{}),goto=vi.fn(async()=>{});const eventos=new EventEmitter();const p={on:eventos.on.bind(eventos),off:eventos.off.bind(eventos),goto,waitForFunction,locator:()=>({isVisible:async()=>false}),getByRole:()=>({click})};const get=vi.fn(async()=>({status:()=>200,json:async()=>({setor:'COMERCIAL',oportunidade:null})}));return{p,get,c:{request:{get}},click,goto,waitForFunction};}
it.each(['painel-erro','thread-erro','painel-vazio'])('CLI%s usa prontidão específica antes de liberar foto',async estado=>{
 const f=fixture();const resultado=await abrirApp(f.p as never,f.c as never,'http://localhost:3111',{beatriz:'b',mariana:'m'},estado,'celular');expect(mocks.conteudo).not.toHaveBeenCalled();expect(mocks.hidratacao).toHaveBeenCalledOnce();expect(f.waitForFunction).toHaveBeenLastCalledWith(semanticaEstado319Pronto,estado);expect(f.goto).toHaveBeenCalledWith('http://localhost:3111/inbox?c=b',{waitUntil:'domcontentloaded'});
 if(estado==='thread-erro'){expect(f.click).not.toHaveBeenCalled();expect(f.get).not.toHaveBeenCalled();}else expect(f.click).toHaveBeenCalledOnce();
 if(estado==='painel-vazio'){expect(mocks.auth.mock.calls[0][2]).toBe('joao@genius.com');expect(resultado.metadados).toEqual({ausenciaLegitima:{status:200,setor:'COMERCIAL',oportunidade:null}});}else expect(f.get).not.toHaveBeenCalled();
});
it('CLIsemseleção conserva espera de lista/hidratação e acrescenta validação de breakpoint',async()=>{const f=fixture();await abrirApp(f.p as never,f.c as never,'http://localhost:3111',{beatriz:'b',mariana:'m'},'sem-selecao','tablet');expect(mocks.conteudo).toHaveBeenCalledOnce();expect(mocks.hidratacao).toHaveBeenCalledOnce();expect(f.waitForFunction).toHaveBeenLastCalledWith(semanticaEstado319Pronto,'sem-selecao');expect(f.goto).toHaveBeenCalledWith('http://localhost:3111/inbox',{waitUntil:'domcontentloaded'});});

it.each(['painel-erro','painel-vazio'])('abrirApp %s não libera veredito enquanto body substituto real está pendente',async estado=>{
 const f=fixture(),eventos=new EventEmitter();let soltar!:()=>void;const body=new Promise<void>(r=>{soltar=r;});const finished=vi.fn(()=>body);Object.assign(f.p,{on:eventos.on.bind(eventos),off:eventos.off.bind(eventos)});f.goto.mockImplementation(async()=>{eventos.emit('request',{method:()=> 'GET',url:()=> 'http://localhost:3111/api/inbox/atendimentos/b/mensagens',response:async()=>({finished})});});
 const resultado=await abrirApp(f.p as never,f.c as never,'http://localhost:3111',{beatriz:'b',mariana:'m'},estado,'celular');let terminou=false;const fim=Promise.resolve(resultado.finalizar?.()).then(()=>{terminou=true;});try{await new Promise<void>(r=>setImmediate(r));expect(terminou).toBe(false);expect(finished).toHaveBeenCalledOnce();}finally{soltar();await fim;}expect(eventos.listenerCount('request')).toBe(0);
});
