import type { KeyboardEvent } from 'react';
import { beforeEach,expect,it,vi } from 'vitest';
import { criarGanchos,elementos,identidadeNoReact } from '@/test/tela-sem-dom';
import { criarDomMinimo } from '@/test/dom-minimo';
const m=vi.hoisted(()=>({g:null as ReturnType<typeof criarGanchos>|null}));
vi.mock('react',async orig=>{const r=await orig<typeof import('react')>();return {...r,useImperativeHandle:()=>{},useState:((i:unknown)=>m.g!.useState(i)) as typeof r.useState,useId:()=>m.g!.useId()};});
import { RodapeConversa,type PropsRodapeConversa } from './RodapeConversa';
import { Compositor } from '@/components/conversa/Compositor';
const base:PropsRodapeConversa={modo:'compositor',atendimentoId:'a',podeEnviar:true,capacidades:[],aoEnviarTexto:async()=>({ok:true}),aoEnviarMidia:async()=>({ok:true}),aoNota:async()=>({ok:true})};
const tela=(p=base)=>m.g!.renderizar(RodapeConversa,p);
const tabs=(t:ReturnType<typeof tela>)=>elementos(t).filter(n=>n.props.role==='tab');
beforeEach(()=>{m.g=criarGanchos();});
it('setas/Home/End alternam e focam aba com aria-selected, mantendo o mesmo compositor',()=>{
 const d=criarDomMinimo(),grupo=d.documento.createElement('div'),a=d.documento.createElement('button'),b=d.documento.createElement('button');a.setAttribute('role','tab');b.setAttribute('role','tab');grupo.appendChild(a);grupo.appendChild(b);d.documento.body.appendChild(grupo);
 const inicio=tela(),identidade=identidadeNoReact(inicio,Compositor);
 const teclar=(key:string)=>{const e={key,currentTarget:d.documento.activeElement,defaultPrevented:false,nativeEvent:{isComposing:false},preventDefault:vi.fn()};const atual=tabs(tela()).find(n=>n.props['aria-selected'])!;(atual.props.onKeyDown as (e:KeyboardEvent<HTMLButtonElement>)=>void)(e as unknown as KeyboardEvent<HTMLButtonElement>);expect(e.preventDefault).toHaveBeenCalledOnce();};
 a.focus();teclar('ArrowRight');expect(d.documento.activeElement===b).toBe(true);expect(tabs(tela())[1].props['aria-selected']).toBe(true);expect(elementos(tela()).find(n=>n.type===Compositor)!.props.modo).toBe('nota');expect(identidadeNoReact(tela(),Compositor)).toEqual(identidade);
 teclar('Home');expect(d.documento.activeElement===a).toBe(true);teclar('End');expect(d.documento.activeElement===b).toBe(true);teclar('ArrowLeft');expect(d.documento.activeElement===a).toBe(true);
});
it('contato novo começa na aba inicial e nota indisponível não é selecionável',()=>{
 (tabs(tela())[1].props.onClick as ()=>void)();expect(elementos(tela()).find(n=>n.type===Compositor)!.props.modo).toBe('nota');
 tela({...base,atendimentoId:'b'});expect(elementos(tela({...base,atendimentoId:'b'})).find(n=>n.type===Compositor)!.props.modo).toBe('responder');
 const t=tela({...base,atendimentoId:'c',abaInicial:'nota',podeAnotar:false});expect(tabs(t)[1].props.disabled).toBe(true);expect(elementos(t).find(n=>n.type===Compositor)!.props.modo).toBe('responder');
});
