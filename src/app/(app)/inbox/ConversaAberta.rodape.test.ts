import { type ReactNode } from 'react';
import { beforeEach,expect,it,vi } from 'vitest';
import { criarGanchos,elementos,identidadeNoReact } from '@/test/tela-sem-dom';
const m=vi.hoisted(()=>({g:null as ReturnType<typeof criarGanchos>|null,usar:vi.fn(),abrirAgendar:vi.fn()}));
vi.mock('react',async original=>{const r=await original<typeof import('react')>();return {...r,useState:((i:unknown)=>m.g!.useState(i)) as typeof r.useState,useRef:((i:unknown)=>m.g!.useRef(i)) as typeof r.useRef,useMemo:((fn:()=>unknown)=>fn()) as typeof r.useMemo,useCallback:((fn:unknown)=>fn) as typeof r.useCallback,useEffect:()=>{},useLayoutEffect:()=>{}};});
vi.mock('./AcoesAtendimento',()=>({useAcoesAtendimento:(p:unknown)=>m.usar(p)}));
vi.mock('@/components/conversa/agora-thread',()=>({useAgoraDaThread:()=>Date.UTC(2026,9,22,12)}));
vi.mock('@/server/whatsapp/acoes',()=>({enviarMidiaInbox:vi.fn(),enviarTextoInbox:vi.fn()}));
vi.mock('@/server/crm-config/acoes-respostas',()=>({respostasRapidasDoCompositor:vi.fn()}));
vi.mock('@/server/whatsapp/acoes-conversa',()=>({registrarNotaAtendimento:vi.fn(async()=>({ok:true}))}));
vi.mock('@/server/whatsapp/consultas-acoes-atendimento',()=>({origemVisivelDaTransferencia:vi.fn()}));
import { ConversaAberta,type PropsConversaAberta } from './ConversaAberta';
import { RodapeConversa } from './RodapeConversa';
import { CabecalhoConversa } from './CabecalhoConversa';
import { VirtualList } from '@/components/conversa/VirtualList';
import { registrarNotaAtendimento } from '@/server/whatsapp/acoes-conversa';
import type { ChavesPorAlvo } from '@/lib/chave-idempotencia';
const base={item:{id:'a',capacidades:[],status:'EM_ATENDIMENTO',grupo:false},usuario:{id:'u',papeis:[]},fuso:'UTC',conversa:{mensagens:[],notas:[],temMaisAntes:false,temMaisDepois:false,maisAntigas:async()=>{}},aoVoltar(){},aoAlternarPainel(){},aoMudar(){},podeEnviar:false} as unknown as PropsConversaAberta;
function tela(p=base):ReactNode{
 let t=m.g!.renderizar(ConversaAberta,p);
 // Materializa os coordenadores reais, incluindo o novo controlador de slots da Aria.
 for(let i=0;i<4;i++) { const c=elementos(t).find(n=>typeof n.props.children==='function'); if(!c)return t; t=(c.type as (p:unknown)=>ReactNode)(c.props); }
 return t;
}
beforeEach(()=>{m.g=criarGanchos();m.usar.mockReset();m.usar.mockReturnValue({assumir:null,transferir:null,menu:[],feedback:null,dialogos:null,abrirAgendar:m.abrirAgendar});vi.mocked(registrarNotaAtendimento).mockClear();});
it('um controlador real fornece agenda ao rodapé e ações ao cabeçalho sem duplicar instância',()=>{
 const t=tela(),r=elementos(t).find(n=>n.type===RodapeConversa),h=elementos(t).find(n=>n.type===CabecalhoConversa);
 expect(r).toBeDefined();expect(h).toBeDefined();expect(m.usar).toHaveBeenCalledTimes(1);
 expect(r!.props.aoAgendar).toBe(h!.props.acoes&&m.usar.mock.results[0].value.abrirAgendar);
 expect(r!.props.modo).toBe('compositor');expect(r!.props.podeEnviar).toBe(false);expect(r!.props.podeAnotar).toBe(true);
});
it('mapa de tentativas sobrevive à troca do coordenador A→B→A, callback captura contato e chave originais',async()=>{
 const a=elementos(tela()).find(n=>n.type===RodapeConversa)!;expect(a).toBeDefined();
 const tentativas=a.props.tentativasNota as ChavesPorAlvo,primeira=tentativas.para(JSON.stringify(['a','nota A'])).atual;
 const b=elementos(tela({...base,item:{...base.item!,id:'b'}})).find(n=>n.type===RodapeConversa)!;
 expect(b.props.tentativasNota).toBe(tentativas);
 const volta=elementos(tela()).find(n=>n.type===RodapeConversa)!;expect((volta.props.tentativasNota as ChavesPorAlvo).para(JSON.stringify(['a','nota A'])).atual).toBe(primeira);
 await (a.props.aoNota as (n:string,c:string)=>Promise<unknown>)('nota A',primeira);
 expect(registrarNotaAtendimento).toHaveBeenCalledWith({atendimentoId:'a',nota:'nota A',chaveIdempotencia:primeira});
});
it('re-render da mesma conversa mantém identidade do scroller/VList e agenda ausente não vira stub',()=>{
 const primeiro=tela(),id=identidadeNoReact(primeiro,VirtualList);
 m.usar.mockReturnValue({assumir:null,transferir:null,menu:[],feedback:null,dialogos:null,abrirAgendar:null});
 const segundo=tela();expect(identidadeNoReact(segundo,VirtualList)).toEqual(id);
 expect(elementos(segundo).find(n=>n.type===RodapeConversa)!.props.aoAgendar).toBeUndefined();
});
it('item null mantém fallback sem inventar controlador ou rodapé; grupo não habilita nota',()=>{
 expect(elementos(tela({...base,item:null})).some(n=>n.type===RodapeConversa)).toBe(false);expect(m.usar).not.toHaveBeenCalled();
 const r=elementos(tela({...base,item:{...base.item!,grupo:true}})).find(n=>n.type===RodapeConversa)!;expect(r).toBeDefined();expect(r.props.podeAnotar).toBe(false);
});

it.each(['ENCERRADO','EM_ATENDIMENTO'] as const)('C2 participante com leitura em %s conserva Nota no rodapé sem ganhar envio ou agenda',status=>{
 m.usar.mockReturnValue({assumir:null,transferir:null,menu:[],feedback:null,dialogos:null,abrirAgendar:null});
 const r=elementos(tela({...base,item:{...base.item!,status,responsavelId:'outro'},usuario:{...base.usuario,id:'participante'},podeEnviar:false})).find(n=>n.type===RodapeConversa)!;
 expect(r.props.podeAnotar).toBe(true);expect(r.props.podeEnviar).toBe(false);expect(r.props.aoAgendar).toBeUndefined();
});
