import { type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { criarGanchos, elementos, identidadeNoReact } from "@/test/tela-sem-dom";
const g=vi.hoisted(()=>({atual:null as ReturnType<typeof criarGanchos>|null}));
vi.mock("react",async original=>{const real=await original<typeof import('react')>();return {...real,useId:()=>g.atual!.useId(),useState:((i:unknown)=>g.atual!.useState(i)) as typeof real.useState,useRef:((i:unknown)=>g.atual!.useRef(i)) as typeof real.useRef,useMemo:((fn:()=>unknown)=>fn()) as typeof real.useMemo,useCallback:((fn:unknown)=>fn) as typeof real.useCallback,useEffect:()=>{},useLayoutEffect:()=>{}};});
vi.mock('@/components/conversa/agora-thread',()=>({useAgoraDaThread:()=>Date.UTC(2026,9,22,12)}));
vi.mock('./AcoesAtendimento',()=>({useAcoesAtendimento:()=>({feedback:null,dialogos:null,menu:[]})}));
vi.mock('@/server/whatsapp/acoes',()=>({enviarMidiaInbox:vi.fn(),enviarTextoInbox:vi.fn()}));
vi.mock('@/server/crm-config/acoes-respostas',()=>({respostasRapidasDoCompositor:vi.fn()}));
vi.mock('@/server/whatsapp/acoes-conversa',()=>({registrarNotaAtendimento:vi.fn()}));
vi.mock('@/server/whatsapp/consultas-acoes-atendimento',()=>({origemVisivelDaTransferencia:vi.fn()}));
import { ConversaAberta, type PropsConversaAberta } from './ConversaAberta';
import { VirtualList } from '@/components/conversa/VirtualList';
import { BuscaConversa } from './BuscaConversa';
import { CabecalhoConversa } from './CabecalhoConversa';
import { BalaoMensagem } from '@/components/conversa/BalaoMensagem';
import { criarDomMinimo } from '@/test/dom-minimo';
const ms=Array.from({length:150},(_,i)=>({id:'id['+i+']',corpo:i===149?'Matrícula no fim':'outra',direcao:'ENTRADA',tipo:'TEXTO',status:'RECEBIDA',criadoEm:'2026-10-22T12:00:00Z'}));
const props={item:{id:'a',capacidades:[],status:'EM_ATENDIMENTO'},usuario:{id:'u',papeis:[]},fuso:'UTC',conversa:{mensagens:ms,notas:[{id:'nota',nota:'Matrícula não buscável',criadoEm:'2026-10-22T12:00:00Z'}],temMaisAntes:true,temMaisDepois:true,maisAntigas:vi.fn()},aoVoltar(){},aoAlternarPainel(){},aoMudar(){},podeEnviar:false} as unknown as PropsConversaAberta;
function tela(p=props){
 let t=g.atual!.renderizar(ConversaAberta,p);
 for(let i=0;i<4;i++) { const c=elementos(t).find(n=>typeof n.props.children==='function'||typeof n.props.renderizar==='function'); if(!c)return t; t=(c.type as (p:unknown)=>ReactNode)(c.props); }
 return t;
}
beforeEach(()=>{g.atual=criarGanchos();});
it('ligação real header→barra→destaque/pin usa ID da mensagem decorada, não índice de mensagens',()=>{let t=tela();const identidade=identidadeNoReact(t,VirtualList);const header=elementos(t).find(e=>e.type===CabecalhoConversa)!;(header.props.aoBuscar as ()=>void)();t=tela();let barra=elementos(t).find(e=>e.type===BuscaConversa)!;expect(barra).toBeDefined();(barra.props.aoMudar as (s:string)=>void)('matricula');t=tela();barra=elementos(t).find(e=>e.type===BuscaConversa)!;expect(barra.props.total).toBe(1);expect(barra.props.temMaisDepois).toBe(true);const list=elementos(t).find(e=>e.type===VirtualList)!;expect(list.props.pinKeys).toEqual(['id[149]']);expect(identidadeNoReact(t,VirtualList)).toEqual(identidade);const items=list.props.items as {id:string;tipo:string}[];expect(items.length).toBeGreaterThan(150);const render=list.props.renderItem as (i:unknown)=>ReactNode;const balao=elementos(render(items.find(i=>i.id==='id[149]'))).find(e=>e.type===BalaoMensagem)!;expect(balao.props.destacada).toBe(true);const nota=elementos(render(items.find(i=>i.tipo==='nota'))).find(e=>e.type===BalaoMensagem)!;expect(nota.props.destacada).not.toBe(true);});

function paginacaoReal(carregar: () => Promise<void>, carregandoAntigas=false) {
 const dom=criarDomMinimo();
 const campo=dom.documento.createElement('input'),botao=dom.documento.createElement('button'),fora=dom.documento.createElement('button');
 for(const el of [campo,botao,fora])dom.documento.body.appendChild(el);
 const p={...props,conversa:{...props.conversa,carregandoAntigas,maisAntigas:carregar}};
 let t=tela(p);(elementos(t).find(e=>e.type===CabecalhoConversa)!.props.aoBuscar as ()=>void)();
 t=tela(p);const barra=elementos(t).find(e=>e.type===BuscaConversa)!;
 (barra.props.campoRef as {current:unknown}).current=campo;
 return {dom,campo,botao,fora,ativar:barra.props.aoCarregarAntigas as ()=>void,fechar:barra.props.aoFechar as ()=>void,campoRef:barra.props.campoRef as {current:unknown}};
}
it('cada ativação entrega foco ao campo antes da carga, inclusive a última que remove o botão',async()=>{
 for(const ultima of [false,true]) {
  g.atual=criarGanchos();let resolver!:()=>void;
  const pendente=new Promise<void>(r=>{resolver=r;});
  const t=paginacaoReal(()=>{expect(t.dom.documento.activeElement===t.campo).toBe(true);return pendente;});
  t.botao.focus();t.ativar();expect(t.dom.documento.activeElement===t.campo).toBe(true);
  t.dom.documento.body.removeChild(t.botao);
  if(!ultima)t.dom.documento.body.appendChild(t.dom.documento.createElement('button'));
  resolver();await pendente;expect(t.dom.documento.activeElement===t.campo).toBe(true);
 }
});
it('não inicia carga nem muda foco quando a paginação já está ocupada',()=>{
 let chamadas=0;const t=paginacaoReal(async()=>{chamadas++;},true);
 t.botao.focus();t.ativar();expect(chamadas).toBe(0);expect(t.dom.documento.activeElement===t.botao).toBe(true);
});
it('conclusão ou erro tratado não toma foco externo movido durante a espera',async()=>{
 for(const falha of [false,true]) {
  g.atual=criarGanchos();let resolver!:()=>void,rejeitar!:(e:Error)=>void,erro:string|null=null;
  const resposta=new Promise<void>((resolve,reject)=>{resolver=resolve;rejeitar=reject;});
  const tarefa=resposta.catch(e=>{erro=(e as Error).message;});
  const t=paginacaoReal(()=>tarefa);
  t.botao.focus();t.ativar();expect(t.dom.documento.activeElement===t.campo).toBe(true);
  t.fora.focus();if(falha)rejeitar(new Error('falha controlada'));else resolver();
  await tarefa;expect(erro).toBe(falha?'falha controlada':null);
  expect(t.dom.documento.activeElement===t.fora).toBe(true);
 }
});
it.each(['fechar','trocar','reabrir'])('resolver carga antiga após %s não toma foco externo nem foca outra busca',async(modo)=>{
 let resolver!:()=>void;const pendente=new Promise<void>(r=>{resolver=r;});
 const t=paginacaoReal(()=>pendente);t.botao.focus();t.ativar();
 t.fechar();t.dom.documento.body.removeChild(t.campo);t.campoRef.current=null;
 if(modo!=='fechar')tela({...props,item:{...props.item!,id:'b'}});
 if(modo==='reabrir') {
  let arvore=tela(props);
  (elementos(arvore).find(e=>e.type===CabecalhoConversa)!.props.aoBuscar as ()=>void)();
  arvore=tela(props);const nova=t.dom.documento.createElement('input');t.dom.documento.body.appendChild(nova);
  (elementos(arvore).find(e=>e.type===BuscaConversa)!.props.campoRef as {current:unknown}).current=nova;
 }
 t.fora.focus();resolver();await pendente;expect(t.dom.documento.activeElement===t.fora).toBe(true);
});


it.each(["retry","anteriores"])("319:%s entrega foco à região real antes de carregar e não restaura após await",async(modo)=>{
 const {texto}=await import("@/test/tela-sem-dom");const dom=criarDomMinimo();
 const regiao=dom.documento.createElement("section"),scroll=dom.documento.createElement("div"),botao=dom.documento.createElement("button"),fora=dom.documento.createElement("button");regiao.setAttribute("aria-label","Conversa");regiao.setAttribute("tabindex","-1");regiao.appendChild(scroll);scroll.appendChild(botao);dom.documento.body.appendChild(regiao);dom.documento.body.appendChild(fora);
 let resolver!:()=>void;const pendente=new Promise<void>(r=>{resolver=r;});let chamadas=0;
 const carregar=()=>{chamadas++;expect(dom.documento.activeElement===regiao).toBe(true);return pendente;};
 const p={...props,conversa:{...props.conversa,erro:modo==="retry"?"falha interna":"",carregando:false,carregandoAntigas:false,carregandoNovas:false,recarregar:carregar,maisAntigas:carregar}};
 const arvore=tela(p),caixa=elementos(arvore).find(e=>e.type==="div"&&String(e.props.className).includes("overflow-y-auto"))!;
 (caixa as unknown as {ref:{current:unknown}}).ref.current=scroll;
 const controle=elementos(arvore).find(e=>typeof e.props.onClick==="function"&&texto(e.props.children)===(modo==="retry"?"Tentar de novo":"Mensagens anteriores"))!;
 expect(controle).toBeDefined();botao.focus();(controle.props.onClick as ()=>void)();expect(chamadas).toBe(1);expect(dom.documento.activeElement===regiao).toBe(true);
 scroll.removeChild(botao);fora.focus();resolver();await pendente;expect(dom.documento.activeElement===fora).toBe(true);
});
it("319:paginação/reload com busca mantém identidade virtual e mensagem pinada",()=>{
 let t=tela();const cabecalho=elementos(t).find(e=>e.type===CabecalhoConversa);expect(cabecalho).toBeDefined();(cabecalho!.props.aoBuscar as ()=>void)();t=tela();(elementos(t).find(e=>e.type===BuscaConversa)!.props.aoMudar as (s:string)=>void)("matricula");t=tela();const identidade=identidadeNoReact(t,VirtualList);
 for(const espera of [{carregando:true},{carregandoAntigas:true},{erro:"ErroFonte500"}]){t=tela({...props,conversa:{...props.conversa,...espera}});expect(identidadeNoReact(t,VirtualList)).toEqual(identidade);expect(elementos(t).find(e=>e.type===VirtualList)!.props.pinKeys).toEqual(["id[149]"]);expect(elementos(t).find(e=>e.type===BuscaConversa)!.props.termo).toBe("matricula");}
});

it.each(["carregando","carregandoAntigas","carregandoNovas"])("319:%s não dispara retry nem anteriores repetidos",async(estado)=>{
 const {texto}=await import("@/test/tela-sem-dom");let chamadas=0;const carregar=async()=>{chamadas++;};
 const t=tela({...props,conversa:{...props.conversa,erro:"Falha anterior",[estado]:true,recarregar:carregar,maisAntigas:carregar}});
 for(const rotulo of ["Mensagens anteriores","Tentar de novo"]){const b=elementos(t).find(e=>typeof e.props.onClick==="function"&&texto(e.props.children)===rotulo)!;expect(b.props.ocupado).toBe(true);(b.props.onClick as ()=>void)();}
 expect(chamadas).toBe(0);
});
