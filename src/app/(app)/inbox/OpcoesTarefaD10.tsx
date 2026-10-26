"use client";

import {useId} from "react";
import {RecorrenciaTarefa} from "@prisma/client";
import {RECORRENCIA_TAREFA_LABEL,rotular} from "@/lib/labels";
import {Botao} from "@/components/Botao";
import {EstadoVazio} from "@/components/EstadoVazio";
import type {CamposAdicionaisTarefaD10} from "@/server/crm/tarefa-d10-schema";

type Prioridade=NonNullable<CamposAdicionaisTarefaD10["prioridade"]>;
type Lembrete=Exclude<CamposAdicionaisTarefaD10["lembreteAntecedenciaMin"],undefined>;
export type PropsOpcoesTarefaD10={
 mostrarLembrete?:boolean;
 recorrencia?:RecorrenciaTarefa;
 abertas:boolean;
 aoAlternar:()=>void;
 prioridade:Prioridade;
 prioridades:readonly {valor:Prioridade;rotulo:string}[];
 lembrete:Lembrete;
 lembretes:readonly {valor:Lembrete;rotulo:string}[];
 /** Apenas candidatos já autorizados pela porta readonly; esta UI não concede acesso. */
 colegas:readonly {id:string;nome:string}[];
 notificados:readonly string[];
 podeNotificar:boolean;
 ocupado?:boolean;
 aoMudar:(patch:CamposAdicionaisTarefaD10)=>void;
};

export function CampoLembreteTarefaD10(p:Pick<PropsOpcoesTarefaD10,"lembrete"|"lembretes"|"ocupado"|"aoMudar">){return (
  <label className="block text-sm">Lembrete
   <select aria-label="Lembrete" value={p.lembrete??""} disabled={p.ocupado} className="rounded-md border border-border-soft bg-surface p-2" onChange={e=>{
    const opcao=p.lembretes.find(o=>String(o.valor??"")===e.target.value);
    if(opcao&&!p.ocupado)p.aoMudar({lembreteAntecedenciaMin:opcao.valor});
   }}>{p.lembretes.map(o=><option key={String(o.valor)} value={o.valor??""}>{o.rotulo}</option>)}</select>
  </label>
);}

/** Opções controladas do modal; autorização e persistência continuam no servidor. */
export function OpcoesTarefaD10(p:PropsOpcoesTarefaD10){
 const id=useId();
 const disponiveis=new Set(p.colegas.map(c=>c.id));
 const indisponiveis=p.notificados.some(v=>!disponiveis.has(v));
 return <div className="space-y-3">
  {p.mostrarLembrete!==false&&<CampoLembreteTarefaD10 {...p}/>}
  <Botao variante="fantasma" tamanho="sm" aria-expanded={p.abertas} aria-controls={id} disabled={p.ocupado} onClick={p.aoAlternar}>Mais opções</Botao>
  <div id={id} hidden={!p.abertas} className="space-y-3">
   <label className="block text-sm">Repetir<select aria-label="Repetir" value={p.recorrencia??"NAO_REPETE"} disabled={p.ocupado} className="rounded-md border border-border-soft bg-surface p-2" onChange={e=>{const r=Object.values(RecorrenciaTarefa).find(v=>v===e.target.value);if(r&&!p.ocupado)p.aoMudar({recorrencia:r});}}>{Object.values(RecorrenciaTarefa).map(v=><option key={v} value={v}>{rotular(RECORRENCIA_TAREFA_LABEL,v)}</option>)}</select></label>
   <fieldset disabled={p.ocupado}><legend>Prioridade</legend><div className="flex flex-wrap gap-3">
    {p.prioridades.map(o=><label key={o.valor} className="inline-flex items-center gap-2 text-sm"><input type="radio" name={id+"-prioridade"} value={o.valor} checked={p.prioridade===o.valor} onChange={()=>{if(!p.ocupado)p.aoMudar({prioridade:o.valor});}}/>{o.rotulo}</label>)}
   </div></fieldset>
   <fieldset disabled={p.ocupado||!p.podeNotificar}><legend>Notificar também</legend>
    {p.colegas.length===0?<EstadoVazio>Nenhum colega autorizado para esta tarefa.</EstadoVazio>:<div className="space-y-2">{p.colegas.map(c=><label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" value={c.id} checked={p.notificados.includes(c.id)} disabled={p.ocupado||!p.podeNotificar} onChange={e=>{
     if(p.ocupado||!p.podeNotificar)return;
     const selecionados=new Set(p.notificados);
     if(e.target.checked)selecionados.add(c.id);else selecionados.delete(c.id);
     p.aoMudar({notificarUsuarioIds:[...selecionados].sort()});
    }}/>{c.nome}</label>)}</div>}
   </fieldset>
   {indisponiveis&&<div className="space-y-2"><p className="text-sm text-gray-600">Há seleções indisponíveis. Elas serão preservadas até você alterá-las.</p><Botao variante="neutro" tamanho="sm" disabled={p.ocupado||!p.podeNotificar} onClick={()=>{if(!p.ocupado&&p.podeNotificar)p.aoMudar({notificarUsuarioIds:p.notificados.filter(v=>disponiveis.has(v))});}}>Limpar seleções indisponíveis</Botao></div>}
  </div>
 </div>;
}