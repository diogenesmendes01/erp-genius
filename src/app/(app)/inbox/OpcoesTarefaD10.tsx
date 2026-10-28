"use client";

import {useId} from "react";
import {RecorrenciaTarefa} from "@prisma/client";
import {RECORRENCIA_TAREFA_LABEL,rotular} from "@/lib/labels";
import {Botao} from "@/components/Botao";
import {EstadoVazio} from "@/components/EstadoVazio";
import {Combobox} from "@/components/ui/combobox";
import {Checkbox} from "@/components/ui/checkbox";
import {RadioGroup,RadioGroupItem} from "@/components/ui/radio-group";
import {garantirEstilo} from "@/app/(app)/inbox/garantir-estilo";
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
 colegas:readonly {id:string;nome:string}[];
 notificados:readonly string[];
 podeNotificar:boolean;
 ocupado?:boolean;
 aoMudar:(patch:CamposAdicionaisTarefaD10)=>void;
};

export function CampoLembreteTarefaD10(p:Pick<PropsOpcoesTarefaD10,"lembrete"|"lembretes"|"ocupado"|"aoMudar">){
 garantirEstilo();
 return (
  <label className="block text-sm">Lembrete
   <Combobox aria-label="Lembrete" value={p.lembrete==null?"":String(p.lembrete)} disabled={p.ocupado} vazio={p.lembretes.find(o=>o.valor==null)?.rotulo??"Sem lembrete"} onValueChange={valor=>{
    if(p.ocupado)return;
    const opcao=p.lembretes.find(o=>String(o.valor??"")===valor);
    if(opcao)p.aoMudar({lembreteAntecedenciaMin:opcao.valor});
   }} opcoes={p.lembretes.filter(o=>o.valor!=null).map(o=>({valor:String(o.valor),rotulo:o.rotulo}))}/>
  </label>
);}

export function OpcoesTarefaD10(p:PropsOpcoesTarefaD10){
 garantirEstilo();
 const id=useId();
 const disponiveis=new Set(p.colegas.map(c=>c.id));
 const indisponiveis=p.notificados.some(v=>!disponiveis.has(v));
 return <div className="space-y-3">
  {p.mostrarLembrete!==false&&<CampoLembreteTarefaD10 {...p}/>}
  <Botao variante="fantasma" tamanho="sm" aria-expanded={p.abertas} aria-controls={id} disabled={p.ocupado} onClick={p.aoAlternar}>Mais opções</Botao>
  <div id={id} hidden={!p.abertas} className="space-y-3">
   <label className="block text-sm">Repetir<Combobox aria-label="Repetir" value={p.recorrencia??"NAO_REPETE"} disabled={p.ocupado} onValueChange={valor=>{const r=Object.values(RecorrenciaTarefa).find(v=>v===valor);if(r&&!p.ocupado)p.aoMudar({recorrencia:r});}} opcoes={Object.values(RecorrenciaTarefa).map(v=>({valor:v,rotulo:rotular(RECORRENCIA_TAREFA_LABEL,v)}))}/></label>
   <fieldset disabled={p.ocupado}><legend>Prioridade</legend><RadioGroup name={id+"-prioridade"} value={p.prioridade} disabled={p.ocupado} onValueChange={valor=>{if(!p.ocupado)p.aoMudar({prioridade:valor as Prioridade});}} className="flex flex-wrap gap-3">
    {p.prioridades.map(o=><label key={o.valor} className="inline-flex items-center gap-2 text-sm"><RadioGroupItem value={o.valor} disabled={p.ocupado}/>{o.rotulo}</label>)}
   </RadioGroup></fieldset>
   <fieldset disabled={p.ocupado||!p.podeNotificar}><legend>Notificar também</legend>
    {p.colegas.length===0?<EstadoVazio>Nenhum colega autorizado para esta tarefa.</EstadoVazio>:<div className="space-y-2">{p.colegas.map(c=><label key={c.id} className="flex items-center gap-2 text-sm"><Checkbox aria-label={c.id} checked={p.notificados.includes(c.id)} disabled={p.ocupado||!p.podeNotificar} onCheckedChange={marcado=>{
     if(p.ocupado||!p.podeNotificar)return;
     const selecionados=new Set(p.notificados);
     if(marcado===true)selecionados.add(c.id);else selecionados.delete(c.id);
     p.aoMudar({notificarUsuarioIds:[...selecionados].sort()});
    }}/>{c.nome}</label>)}</div>}
   </fieldset>
   {indisponiveis&&<div className="space-y-2"><p className="text-sm text-gray-600">Há seleções indisponíveis. Elas serão preservadas até você alterá-las.</p><Botao variante="neutro" tamanho="sm" disabled={p.ocupado||!p.podeNotificar} onClick={()=>{if(!p.ocupado&&p.podeNotificar)p.aoMudar({notificarUsuarioIds:p.notificados.filter(v=>disponiveis.has(v))});}}>Limpar seleções indisponíveis</Botao></div>}
  </div>
 </div>;
}