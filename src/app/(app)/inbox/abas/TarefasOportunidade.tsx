"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { IconCalendarTime, IconPencil, IconTrash } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { Checkbox } from "@/components/ui/checkbox";
import { garantirEstilo } from "@/app/(app)/inbox/garantir-estilo";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { rotular, TIPO_TAREFA_LABEL } from "@/lib/labels";
import { atalhosDeHorario, partesDoValorLocal } from "@/lib/atalhos-horario";
import { AVISO_REMARCACAO_MENSAGEM, textoSeloMensagemAgendada, type DecisaoMensagemAgendada } from "@/lib/selo-mensagem-agendada";
import type { TarefaPainel } from "@/server/inbox/painel-tarefas";
import { concluirTarefaNoInbox, reabrirTarefaNoInbox, reagendarTarefaNoInbox, cancelarTarefaNoInbox } from "@/server/inbox/acoes-painel";
import { EscolhaMensagemAgendada, OpcoesMensagemAgendada } from "../EscolhaMensagemAgendada";
import type { Resultado } from "@/server/_shared/resultado";
type Props={atendimentoId:string;tarefas:TarefaPainel[];fusoEscola:string;fuso:string|null;podeCriar:boolean;aoNova?():void;aoEditar?(t:TarefaPainel):void;aoMudar():void};
const VERSAO="Esta tarefa foi alterada por outra pessoa. Recarregue.";
export function TarefasOportunidade(props:Props){
 garantirEstilo();
 return <SessaoTarefas key={props.atendimentoId} {...props}/>;
}
function SessaoTarefas({atendimentoId,tarefas,fusoEscola,podeCriar,aoNova,aoEditar,aoMudar}:Props){
 const exec=useAcaoCliente({idempotente:false}),vivo=useRef(false),emCurso=useRef(false);
  const geracao=useRef(0),tarefasAtuais=useRef(tarefas);
 const tentativaAtual=useRef<{abertura:number;ok:boolean}|null>(null);
 const [envio,setEnvio]=useState<number|null>(null);
 const [cancelando,setCancelando]=useState<(TarefaPainel & {token:number;invalidada:boolean})|null>(null),[motivo,setMotivo]=useState(""),[decisaoMensagem,setDecisaoMensagem]=useState<DecisaoMensagemAgendada|null>(null),[concluindo,setConcluindo]=useState<TarefaPainel|null>(null);
 const alvoAtual=cancelando?tarefas.find(t=>t.id===cancelando.id):undefined;
 const aguardando=!!cancelando&&envio===cancelando.token;
 const alvoMudou=!!cancelando&&(!alvoAtual||alvoAtual.versao!==cancelando.versao||alvoAtual.status!=="ABERTA");
 if(cancelando&&alvoMudou&&!aguardando&&!cancelando.invalidada)setCancelando({...cancelando,invalidada:true});
 const alvoValido=!!cancelando&&!cancelando.invalidada&&!alvoMudou;
 useEffect(()=>{tarefasAtuais.current=tarefas;},[tarefas]);
 useEffect(()=>{if(cancelando?.invalidada)geracao.current++;},[cancelando]);
 function fecharCancelamento(){geracao.current++;tentativaAtual.current=null;setEnvio(null);setDecisaoMensagem(null);setCancelando(null);}
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
 async function executar(alvo:TarefaPainel,acao:()=>Promise<Resultado>){
  if(emCurso.current)return;emCurso.current=true;
  const r=await exec.executar(acao);emCurso.current=false;
  if(vivo.current&&tarefasAtuais.current.some(t=>t.id===alvo.id&&t.versao===alvo.versao&&t.status===alvo.status)&&(r?.tipo==="ok"||(r?.tipo==="erro"&&(r.mensagem===VERSAO||r.mensagem==="O fuso da escola mudou ou está indisponível. Recarregue o painel."))))aoMudar();
 }
 const amanha=atalhosDeHorario(new Date(),fusoEscola).find(a=>a.id==="amanha9");
 return <section aria-label="Tarefas da oportunidade" className="space-y-2 border-t border-border-soft pt-4">
  <header className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Tarefas · {tarefas.filter(t=>t.status==="ABERTA").length} aberta(s)</h3>{podeCriar&&aoNova&&<Botao variante="fantasma" tamanho="sm" onClick={aoNova}>+ Nova tarefa</Botao>}</header>
  {!tarefas.length?<EstadoVazio>Nenhuma tarefa para esta oportunidade.</EstadoVazio>:<ul className="space-y-2">{tarefas.map(t=><li key={t.id} className="flex min-w-0 items-start gap-2 rounded-md border border-border-soft bg-surface-muted p-2">
   {(t.podeAgir||t.status==="CONCLUIDA")&&<Checkbox title={t.status==="CONCLUIDA"?"Reabrir":"Concluir"} aria-label={(t.status==="CONCLUIDA"?"Reabrir ":"Concluir ")+t.titulo} checked={t.status==="CONCLUIDA"} disabled={exec.ocupado} className="mt-1" onCheckedChange={()=>{if(t.status==="CONCLUIDA")void executar(t,()=>reabrirTarefaNoInbox(atendimentoId,t.id,t.versao));else if(t.mensagemAgendada)setConcluindo(t);else void executar(t,()=>concluirTarefaNoInbox(atendimentoId,t.id,t.versao));}}/>}
   <div className="min-w-0 flex-1"><p className={"text-[13.5px] [overflow-wrap:anywhere]"+(t.status==="CONCLUIDA"?" line-through":"")}>{t.titulo}</p><p className={"text-xs [overflow-wrap:anywhere] "+(t.atrasada?"text-red-700":"text-gray-600")}>{t.dataCivil?t.dataCivil.split("-").reverse().join("/")+(t.hora?" "+t.hora:"")+" ("+t.fusoOrigem+")":"Sem prazo"} · {t.responsavel?.nome??"Sem responsável"} · {rotular(TIPO_TAREFA_LABEL,t.tipo)}</p>{t.mensagemAgendada&&<p className="text-xs font-medium text-brand-700">{textoSeloMensagemAgendada(t.mensagemAgendada.quando)}<span className="mt-0.5 block font-normal text-gray-600">{AVISO_REMARCACAO_MENSAGEM}</span></p>}{t.ia&&<span aria-label="Criada pela IA" title="Criada pela IA" className="text-xs text-gray-600">✦</span>}</div>
   {t.podeAgir&&<div className="flex shrink-0 flex-wrap gap-1"><Botao variante="fantasma" tamanho="sm" title="Reagendar para amanhã 09:00" aria-label="Reagendar para amanhã 09:00" disabled={exec.ocupado||!amanha} onClick={()=>{const atual=atalhosDeHorario(new Date(),fusoEscola).find(a=>a.id==="amanha9");if(atual)void executar(t,()=>reagendarTarefaNoInbox(atendimentoId,t.id,t.versao,{...partesDoValorLocal(atual.valorLocal),fusoEscolaEsperado:fusoEscola}));}}><IconCalendarTime size={16}/></Botao>{aoEditar&&<Botao variante="fantasma" tamanho="sm" title="Editar" aria-label={"Editar "+t.titulo} disabled={exec.ocupado} onClick={()=>aoEditar(t)}><IconPencil size={16}/></Botao>}<Botao variante="perigo" tamanho="sm" title="Cancelar tarefa" aria-label={"Cancelar tarefa "+t.titulo} disabled={exec.ocupado} onClick={()=>{setDecisaoMensagem(null);setCancelando({...t,token:++geracao.current,invalidada:false});setMotivo("");}}><IconTrash size={16}/></Botao></div>}
  </li>)}</ul>}
  <FeedbackAcao erro={exec.erro}/>
  {cancelando&&<ConfirmarAcao key={cancelando.id} titulo={"Cancelar a tarefa “"+cancelando.titulo+"”?"} confirmacao="cancelamento" idempotente={true} podeConfirmar={alvoValido && motivo.trim().length > 0 && motivo.trim().length <= 500 && (!alvoAtual?.mensagemAgendada || !!decisaoMensagem)} acao={async()=>{
   const tentativa={abertura:cancelando.token,ok:false};tentativaAtual.current=tentativa;setEnvio(cancelando.token);
   const mensagem=alvoAtual?.mensagemAgendada;
   const r=mensagem&&decisaoMensagem?await cancelarTarefaNoInbox(atendimentoId,cancelando.id,cancelando.versao,motivo.trim(),decisaoMensagem):await cancelarTarefaNoInbox(atendimentoId,cancelando.id,cancelando.versao,motivo.trim());
   if(tentativaAtual.current===tentativa)tentativa.ok=r.ok;
   return r;
  }} aoCancelar={fecharCancelamento} aoConcluir={()=>{if(vivo.current&&cancelando.token===geracao.current&&tentativaAtual.current?.abertura===cancelando.token&&tentativaAtual.current.ok){fecharCancelamento();aoMudar();}}} aoFalhar={f=>{if(vivo.current&&cancelando.token===geracao.current){tentativaAtual.current=null;setEnvio(null);if(f.tipo==="erro"&&f.mensagem===VERSAO)aoMudar();}}}><p>A tarefa será cancelada e continuará no histórico.</p>{alvoAtual?.mensagemAgendada&&<><p className="text-sm font-medium text-brand-700">{textoSeloMensagemAgendada(alvoAtual.mensagemAgendada.quando)}</p><OpcoesMensagemAgendada valor={decisaoMensagem} aoMudar={setDecisaoMensagem} desabilitado={aguardando}/></>}<label className="grid gap-1 text-sm">Motivo<CampoTexto required minLength={1} maxLength={500} value={motivo} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>setMotivo(e.target.value)} className="rounded-md border border-border-soft bg-surface p-2"/></label>{!alvoValido&&!aguardando&&<FeedbackAcao erro={VERSAO}/>}</ConfirmarAcao>}
  {concluindo?.mensagemAgendada&&<EscolhaMensagemAgendada mensagem={concluindo.mensagemAgendada} ocupado={exec.ocupado} aoVoltar={()=>setConcluindo(null)} aoEscolher={decisao=>{const alvo=concluindo;setConcluindo(null);void executar(alvo,()=>concluirTarefaNoInbox(atendimentoId,alvo.id,alvo.versao,decisao));}}/>}
 </section>;
}