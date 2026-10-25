import {IconMessageCircle,IconPhone,IconMail,IconCalendarEvent,IconListCheck,IconPencil,IconCheck} from "@tabler/icons-react";
import {Botao} from "@/components/Botao";
import {rotular,TIPO_TAREFA_LABEL,STATUS_TAREFA_LABEL} from "@/lib/labels";
import {formatarInstanteExibicao} from "@/server/operacao/fuso-exibicao";
import type {TarefaPainel} from "@/server/inbox/painel-tarefas";
export function textoCriadorTarefa(t:Pick<TarefaPainel,"ia"|"criadorNome">,usuarioNome:string|null):string{
 if(t.ia)return "Aria criou uma tarefa";
 const nome=t.criadorNome?.trim();if(!nome)return "Uma tarefa foi criada";
 return nome===usuarioNome?.trim()?"Você criou uma tarefa":nome+" criou uma tarefa";
}
const ICONES={WHATSAPP:IconMessageCircle,LIGACAO:IconPhone,EMAIL:IconMail,REUNIAO:IconCalendarEvent,OUTRO:IconListCheck};
export function CartaoTarefaFio({t,fuso,usuarioNome,aoEditar,aoConcluir,ocupado=false}:{t:TarefaPainel;fuso:string|null;usuarioNome:string|null;aoEditar?():void;aoConcluir():void;ocupado?:boolean}){
 const Icone=ICONES[t.tipo];
 const prazo=t.dataCivil?t.dataCivil.split("-").reverse().join("/")+(t.hora?" · "+t.hora:"")+" ("+t.fusoOrigem+")":"Sem prazo";
 return <article aria-label={"Tarefa: "+t.titulo} className="mx-auto my-3 w-[86%] max-w-[440px] rounded-xl border border-border-soft bg-surface p-3">
  <div className="flex items-start gap-2.5"><span aria-hidden className={"grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg "+(t.ia?"bg-ai-50 text-ai-700":"bg-brand-bg text-brand-700")}><Icone size={18}/></span><div className="min-w-0 flex-1"><p className="text-xs text-gray-600">{textoCriadorTarefa(t,usuarioNome)} · <time dateTime={t.criadoEm} className="font-mono">{formatarInstanteExibicao(t.criadoEm,fuso,"UTC","hora").texto}</time></p><p className={"mt-1 text-[13.5px] font-medium [overflow-wrap:anywhere]"+(t.status==="CONCLUIDA"?" line-through":"")}>{t.titulo}</p><p className={"mt-1 text-xs [overflow-wrap:anywhere] "+(t.atrasada?"text-red-700":"text-gray-600")}>{prazo} · {t.responsavel?.nome??"Sem responsável"} · {rotular(TIPO_TAREFA_LABEL,t.tipo)}</p></div></div>
  {t.status==="ABERTA"&&t.podeAgir?<div className="mt-2 flex items-center justify-end gap-2">{aoEditar&&<Botao variante="fantasma" tamanho="sm" aria-label="Editar" title="Editar tarefa" disabled={ocupado} onClick={aoEditar}><IconPencil size={16}/></Botao>}<Botao variante="secundario" tamanho="sm" ocupado={ocupado} onClick={aoConcluir}><IconCheck size={16}/>Concluir</Botao></div>:t.status!=="ABERTA"&&<p className={"mt-2 text-right text-xs "+(t.status==="CONCLUIDA"?"text-brand-700":"text-gray-500")}>{rotular(STATUS_TAREFA_LABEL,t.status)}</p>}
 </article>;
}
