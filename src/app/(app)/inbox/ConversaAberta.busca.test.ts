import { type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { criarGanchos, elementos, identidadeNoReact } from "@/test/tela-sem-dom";
const g=vi.hoisted(()=>({atual:null as ReturnType<typeof criarGanchos>|null}));
vi.mock("react",async original=>{const real=await original<typeof import('react')>();return {...real,useState:((i:unknown)=>g.atual!.useState(i)) as typeof real.useState,useRef:((i:unknown)=>g.atual!.useRef(i)) as typeof real.useRef,useMemo:((fn:()=>unknown)=>fn()) as typeof real.useMemo,useCallback:((fn:unknown)=>fn) as typeof real.useCallback,useEffect:()=>{},useLayoutEffect:()=>{}};});
vi.mock('@/components/conversa/agora-thread',()=>({useAgoraDaThread:()=>Date.UTC(2026,9,22,12)}));
vi.mock('./AcoesAtendimento',()=>({useAcoesAtendimento:()=>({feedback:null,dialogos:null})}));
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
function tela(p=props){const t=g.atual!.renderizar(ConversaAberta,p);const c=elementos(t).find(n=>typeof n.props.children==='function');return c?(c.type as (p:unknown)=>ReactNode)(c.props):t;}
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
  // A carga pode remover/recriar o controle; o input é o dono do foco desde a ativação.
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
  // Como maisAntigas real, o produtor observa a falha e resolve após publicar o erro.
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
