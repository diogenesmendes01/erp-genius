"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { CampoDataHoraLocal } from "@/components/CampoDataHoraLocal";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChavesPorAlvo } from "@/lib/chave-idempotencia";
import { fusoDoCampoLocal, instanteDoCampoLocal, valorCampoLocal } from "@/server/operacao/fuso-entrada";
import { aprovarSugestaoEditadaNoInbox } from "@/server/aria/acoes";
import type { SugestaoAriaThread } from "@/server/aria/sugestoes-thread";

export function EditorSugestaoAria({s,atendimentoId,fuso,bloqueado,aoCancelar,aoDecidir}:{s:SugestaoAriaThread;atendimentoId:string;fuso:string|null;bloqueado:boolean;aoCancelar():void;aoDecidir():void}){
 const acao=useAcaoCliente({idempotente:true}),chaves=useChavesPorAlvo();
 const [texto,setTexto]=useState(s.texto??""),[titulo,setTitulo]=useState(s.detalhe.tipo==="tarefa"?s.detalhe.titulo:"");
 const original=s.detalhe.tipo==="agendar"?s.detalhe.agendadaPara:s.detalhe.tipo==="tarefa"?s.detalhe.venceEm:null;
 const zona=fusoDoCampoLocal(fuso,"UTC"),inicial=valorCampoLocal(original,zona);
 const [quando,setQuando]=useState(inicial),[incerto,setIncerto]=useState(false),[erroLocal,setErroLocal]=useState<string|null>(null);
 const ciclo=useRef({ativa:false}),primeiroCampo=useRef<HTMLInputElement|HTMLTextAreaElement|null>(null),abriuAutorizado=useRef(!bloqueado);
 const ligarPrimeiroCampo=useCallback((no:HTMLInputElement|HTMLTextAreaElement|null)=>{primeiroCampo.current=no;},[]);
 useLayoutEffect(()=>{if(abriuAutorizado.current)primeiroCampo.current?.focus({preventScroll:true});},[]);
 useLayoutEffect(()=>{const atual={ativa:!bloqueado};ciclo.current=atual;return()=>{atual.ativa=false;};},[bloqueado]);
 const tarefa=s.acao==="CRIAR_TAREFA",nota=s.acao==="NOTA_INTERNA",documento=s.detalhe.tipo==="enviar"&&s.detalhe.documento;
 const travado=bloqueado||acao.ocupado||incerto;
 const rotuloAprovar=s.acao==="RESPONDER"||s.acao==="ENVIAR_DOCUMENTO"?"Aprovar e enviar editado":s.acao==="AGENDAR_MENSAGEM"?"Agendar editado":"Aprovar editado";
 async function aprovar(){
  const atual=ciclo.current;if(!atual.ativa||bloqueado||acao.ocupado)return;
  setErroLocal(null);
  const edicao:Record<string,unknown>=tarefa?{titulo}:{texto};
  if(original){const r=quando===inicial?{ok:true as const,instante:new Date(original)}:instanteDoCampoLocal(quando,zona);if(!r.ok){setErroLocal(r.erro);return;}edicao[tarefa?"venceEmISO":"agendadaPara"]=r.instante.toISOString();}
  const chave=chaves.para(JSON.stringify(edicao));
  const d=await acao.executar(async()=>{try{const r=await aprovarSugestaoEditadaNoInbox({atendimentoId,id:s.id,edicao,chaveIdempotencia:chave.atual});return atual.ativa?r:{ok:true as const};}catch(e){if(!atual.ativa)return {ok:true as const};setIncerto(true);throw e;}});
  if(atual.ativa&&d?.tipo==="ok"){chave.depoisDo(d);aoDecidir();}
 }
 return <div role="group" aria-label="Editar sugestão" className="flex min-w-0 flex-col gap-3">
  {tarefa?<Campo rotulo="Título da tarefa" obrigatorio>{campo=><input {...campo} ref={ligarPrimeiroCampo} value={titulo} maxLength={200} disabled={travado} onChange={e=>{if(!travado)setTitulo(e.target.value);}} className="w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-800"/>}</Campo>:<Campo rotulo={nota?"Nota interna":"Texto da sugestão"} obrigatorio={!documento}>{campo=><CampoTexto {...campo} ref={ligarPrimeiroCampo} value={texto} maxLength={nota?2000:documento?1024:4096} disabled={travado} onChange={e=>{if(!travado)setTexto(e.target.value);}} className="w-full rounded-lg border border-ai-200 bg-surface px-3 py-2 text-sm text-gray-800"/>}</Campo>}
  {original&&<Campo rotulo={tarefa?"Vencimento":"Data e horário"} obrigatorio>{campo=><CampoDataHoraLocal {...campo} fuso={zona} value={quando} disabled={travado} onChange={e=>{if(!travado)setQuando(e.target.value);}} className="w-full rounded-lg border border-ai-200 bg-surface px-3 py-2 text-sm text-gray-800"/>}</Campo>}
  {!tarefa&&!nota&&<p className="text-xs text-gray-600">Esta edição será enviada em seu nome e pausará a Aria nesta conversa.</p>}
  <div className="flex flex-wrap gap-2"><Botao ocupado={acao.ocupado} disabled={bloqueado} onClick={()=>void aprovar()}>{rotuloAprovar}</Botao><Botao variante="neutro" disabled={travado} onClick={()=>{if(!travado&&ciclo.current.ativa)aoCancelar();}}>Cancelar edição</Botao></div>
  <FeedbackAcao erro={erroLocal??acao.erro}/>
 </div>;
}
