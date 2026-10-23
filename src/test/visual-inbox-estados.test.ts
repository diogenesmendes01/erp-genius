import {afterEach,expect,it,vi} from 'vitest';
import {combinacoes,ESTADOS} from '../../scripts/visual/nucleo-captura.mjs';
import * as estados from '../../scripts/visual/estados-inbox.mjs';
import {criarDomMinimo,desligarObservadores,type Elemento} from './dom-minimo';
afterEach(()=>{desligarObservadores();vi.unstubAllGlobals();});
const api=estados as unknown as {instalarErroEstado(c:unknown,b:string,id:string,e:string):Promise<{respostaEsperada(r:unknown):boolean;diagnosticos:unknown[]}>;semanticaEstado319Pronto(e:string):boolean;confirmarPainelVazio(c:unknown,b:string,id:string):Promise<unknown>;abrirCarregandoApp(p:unknown,c:unknown,b:string):Promise<()=>Promise<void>>;};
it('recorte319 possui36APP+6refs sem substituir nota317 ou estados anteriores',()=>{
 const nomes=['carregando','painel-erro','thread-erro','sem-selecao','painel-vazio','lista-vazia'];
 expect(()=>combinacoes({alvos:['app','prototipo'],estados:nomes})).not.toThrow();
 const tarefas=combinacoes({alvos:['app','prototipo'],estados:nomes});expect(tarefas.filter(t=>t.alvo==='app')).toHaveLength(36);expect(tarefas.filter(t=>t.alvo==='prototipo')).toHaveLength(6);
 for(const nome of nomes.filter(n=>n!=='lista-vazia')){expect(ESTADOS[nome].prototipo).toBe(false);expect((ESTADOS[nome] as {motivoSemReferencia?:string}).motivoSemReferencia).toBeTruthy();}
 expect(combinacoes({alvos:['app','prototipo'],estados:['nota','humano-compositor']})).toHaveLength(24);
});
it('500 só classifica RequestGET efetivamente injetado no endpoint/origem exatos',async()=>{
 expect(api.instalarErroEstado).toBeTypeOf('function');let pred!:(u:URL)=>boolean,handler!:(r:unknown)=>Promise<void>;
 const c={route:async(p:typeof pred,h:typeof handler)=>{pred=p;handler=h;}};const controle=await api.instalarErroEstado(c,'http://localhost:3111','beatriz','painel-erro');
 expect(pred(new URL('http://localhost:3111/api/inbox/atendimentos/beatriz/painel'))).toBe(true);
 for(const u of ['http://evil/api/inbox/atendimentos/beatriz/painel','http://localhost:3111/api/inbox/atendimentos/outra/painel','http://localhost:3111/api/inbox/atendimentos/beatriz/mensagens','http://localhost:3111/api/inbox/atendimentos/beatriz/painel?x=1'])expect(pred(new URL(u))).toBe(false);
 const pedido={method:()=> 'GET'},fulfill=vi.fn(),fallback=vi.fn();await handler({request:()=>pedido,fulfill,fallback});expect(fulfill).toHaveBeenCalledWith(expect.objectContaining({status:500}));
 expect(controle.respostaEsperada({status:()=>500,request:()=>pedido})).toBe(true);
 expect(controle.respostaEsperada({status:()=>404,request:()=>pedido})).toBe(false);
 expect(controle.respostaEsperada({status:()=>500,request:()=>({method:()=> 'GET'})})).toBe(false);
 await handler({request:()=>({method:()=> 'POST'}),fulfill,fallback});expect(fallback).toHaveBeenCalledOnce();expect(fulfill).toHaveBeenCalledOnce();
});
it('estado normal não registra interceptor nem aceita500; thread usa somente mensagens',async()=>{
 expect(api.instalarErroEstado).toBeTypeOf('function');const route=vi.fn();const neutro=await api.instalarErroEstado({route},'http://localhost:3111','id','lista-vazia');expect(route).not.toHaveBeenCalled();expect(neutro.respostaEsperada({status:()=>500,request:()=>({})})).toBe(false);
 await api.instalarErroEstado({route},'http://localhost:3111','id','thread-erro');const pred=route.mock.calls[0][0];expect(pred(new URL('http://localhost:3111/api/inbox/atendimentos/id/mensagens'))).toBe(true);expect(pred(new URL('http://localhost:3111/api/inbox/atendimentos/id/painel'))).toBe(false);
});
function dom(estado:string){const {documento}=criarDomMinimo();vi.stubGlobal('document',{querySelector:(s:string)=>documento.documentElement.querySelector(s.replace('#painel-contato','[id="painel-contato"]')),querySelectorAll:(s:string)=>documento.documentElement.querySelectorAll(s)});vi.stubGlobal('window',{innerWidth:390,innerHeight:844});const criar=(tag:string,attrs:Record<string,string>={},texto='',pai:Elemento=documento.body)=>{const e=documento.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);e.textContent=texto;pai.appendChild(e);return Object.assign(e,{disabled:false,getBoundingClientRect:()=>({left:0,right:390,top:60,bottom:700,width:390,height:640})});};const regiao=criar('section',{'aria-label':'Conversa'});const painel=criar('aside',{id:'painel-contato','aria-label':'Painel do contato'});if(estado==='carregando'){const root=criar('div',{'aria-busy':'true'});criar('p',{role:'status'},'Carregando conversas',root);criar('div',{'data-esqueleto':'titulo'},'',root);return{criar,root,regiao,painel};}if(estado==='painel-vazio'){criar('p',{},'Sem oportunidade visível para você.',painel);return{criar,root:painel,regiao,painel};}const root=estado==='painel-erro'?painel:regiao,alerta=criar('div',{role:'alert'},'',root);criar('p',{},estado==='painel-erro'?'Não foi possível carregar os detalhes.':'Não foi possível carregar as mensagens.',alerta);const retry=criar('button',{},'Tentar de novo',alerta);return{criar,root,alerta,retry,regiao,painel};}
it.each(['painel-erro','thread-erro'])('prontidão%s exige alerta público/retry visível e rejeita dado técnico ou botão inativo',estado=>{
 expect(api.semanticaEstado319Pronto).toBeTypeOf('function');const f=dom(estado);expect(api.semanticaEstado319Pronto(estado)).toBe(true);f.retry!.disabled=true;expect(api.semanticaEstado319Pronto(estado)).toBe(false);f.retry!.disabled=false;f.criar('p',{},'ErroFonte500/api/inbox',f.alerta);expect(api.semanticaEstado319Pronto(estado)).toBe(false);
});
it('vazio legítimo não aceita alerta nem confunde skeleton com conteúdo pronto',()=>{expect(api.semanticaEstado319Pronto).toBeTypeOf('function');const f=dom('painel-vazio');expect(api.semanticaEstado319Pronto('painel-vazio')).toBe(true);f.criar('p',{role:'alert'},'Falha',f.painel);expect(api.semanticaEstado319Pronto('painel-vazio')).toBe(false);});
it('fallback da página exige um único título/anúncio e superfície no viewport',()=>{expect(api.semanticaEstado319Pronto).toBeTypeOf('function');const f=dom('carregando');expect(api.semanticaEstado319Pronto('carregando')).toBe(true);f.criar('div',{'data-esqueleto':'titulo'},'',f.root);expect(api.semanticaEstado319Pronto('carregando')).toBe(false);});

it('ausência legítima exige status200 objeto autorizado e nunca converte erro/null em vazio',async()=>{
 expect(api.confirmarPainelVazio).toBeTypeOf('function');const get=vi.fn();const c={request:{get}};
 for(const status of [401,403,404,500]){get.mockResolvedValueOnce({status:()=>status});await expect(api.confirmarPainelVazio(c,'http://localhost:3111','b')).rejects.toThrow('GET real200');}
 for(const dado of [null,{setor:'COMERCIAL',oportunidade:{}},{setor:'SECRETARIA',oportunidade:null}]){get.mockResolvedValueOnce({status:()=>200,json:async()=>dado});await expect(api.confirmarPainelVazio(c,'http://localhost:3111','b')).rejects.toThrow('ausência legítima');}
 get.mockResolvedValueOnce({status:()=>200,json:async()=>({setor:'COMERCIAL',oportunidade:null})});await expect(api.confirmarPainelVazio(c,'http://localhost:3111','b')).resolves.toEqual({status:200,setor:'COMERCIAL',oportunidade:null});expect(get).toHaveBeenLastCalledWith('http://localhost:3111/api/inbox/atendimentos/b/painel');
});
it('fallback real espera router/estado antesfoto e só aguarda hidratação após desligar latência',async()=>{
 expect(api.abrirCarregandoApp).toBeTypeOf('function');const eventos:string[]=[];let hidratar!:()=>void;const hidratada=new Promise<void>(r=>{hidratar=r;});
 const send=vi.fn(async(nome:string,dado?:{latency?:number})=>{eventos.push(nome+':'+(dado?.latency??''));}),detach=vi.fn(async()=>{});
 const evaluate=vi.fn().mockResolvedValueOnce(123).mockResolvedValueOnce(undefined).mockResolvedValueOnce(123);
 const pagina={goto:vi.fn(async()=>{}),getByLabel:()=>({waitFor:vi.fn(async()=>{})}),waitForFunction:vi.fn(async()=>{}),evaluate,locator:vi.fn(()=>({waitFor:()=>{eventos.push('hidratação');return hidratada;}}))};
 const concluir=await api.abrirCarregandoApp(pagina,{newCDPSession:async()=>({send,detach})},'http://localhost:3111');expect(pagina.locator).not.toHaveBeenCalled();expect(pagina.waitForFunction).toHaveBeenLastCalledWith(api.semanticaEstado319Pronto,'carregando');
 const fim=concluir();await Promise.resolve();await Promise.resolve();expect(eventos.indexOf('Network.emulateNetworkConditions:0')).toBeLessThan(eventos.indexOf('hidratação'));hidratar();await fim;expect(detach).toHaveBeenCalledOnce();
});

it('sem seleção mobile exige lista e conversa oculta, desktop exige área central sem painel',()=>{
 expect(api.semanticaEstado319Pronto).toBeTypeOf('function');const f=dom('thread-erro');f.painel.parentElement!.removeChild(f.painel);f.alerta!.parentElement!.removeChild(f.alerta!);f.criar('p',{},'Escolha uma conversa',f.regiao);f.criar('p',{},'As mensagens aparecem aqui.',f.regiao);f.criar('section',{'aria-label':'Conversas'});
 const rect=f.regiao.getBoundingClientRect;f.regiao.getBoundingClientRect=()=>({...rect(),width:0,height:0});expect(api.semanticaEstado319Pronto('sem-selecao')).toBe(true);
 vi.stubGlobal('window',{innerWidth:1440,innerHeight:900});expect(api.semanticaEstado319Pronto('sem-selecao')).toBe(false);f.regiao.getBoundingClientRect=rect;expect(api.semanticaEstado319Pronto('sem-selecao')).toBe(true);f.criar('aside',{id:'painel-contato'});expect(api.semanticaEstado319Pronto('sem-selecao')).toBe(false);
});
