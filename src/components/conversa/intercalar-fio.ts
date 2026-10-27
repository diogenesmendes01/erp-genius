import type {TarefaPainel} from "@/server/inbox/painel-tarefas";
import type {ItemThread,ItemTarefaThread} from "./itens-thread";
export type ItemFio=ItemThread|ItemTarefaThread;
export function instanteDoItemFio(i:ItemFio):string{return i.tipo==="tarefa"?i.t.criadoEm:i.tipo==="nota"?i.n.criadoEm:i.m.criadoEm;}
const epoch=(i:ItemFio)=>{const n=Date.parse(instanteDoItemFio(i));return Number.isFinite(n)?n:Infinity;};
const ordem=(i:ItemFio)=>i.tipo==="mensagem"?0:i.tipo==="nota"?1:2;
export function intercalarFio(base:readonly ItemThread[],tarefas:readonly TarefaPainel[],o:{temMaisAntes:boolean;temMaisDepois?:boolean}):ItemFio[]{
 const datas=base.filter((i):i is Extract<ItemThread,{tipo:"mensagem"}>=>i.tipo==="mensagem").map(epoch).filter(Number.isFinite);
 const inicio=o.temMaisAntes&&datas.length?Math.min(...datas):null;
 const fim=o.temMaisDepois&&datas.length?Math.max(...datas):null;
 const cartoes:ItemTarefaThread[]=tarefas.map((t):ItemTarefaThread=>({tipo:"tarefa",id:"tarefa:"+t.id,t})).filter(i=>{const em=epoch(i);return (inicio===null||em>=inicio)&&(fim===null||em<=fim)&&((inicio===null&&fim===null)||Number.isFinite(em));});
 return [...base,...cartoes].sort((a,b)=>{const x=epoch(a),y=epoch(b);return x===y?ordem(a)-ordem(b)||a.id.localeCompare(b.id):x<y?-1:1;});
}
