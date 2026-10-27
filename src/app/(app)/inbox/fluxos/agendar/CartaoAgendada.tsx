"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {IconClock,IconPaperclip,IconPencil,IconSend,IconX} from "@tabler/icons-react";
import {Botao} from "@/components/Botao";
import {ConfirmarAcao} from "@/components/ConfirmarAcao";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {useAcaoCliente} from "@/lib/acao-cliente";
import {useChaveIdempotencia} from "@/lib/chave-idempotencia";
import {rotular,TIPO_MENSAGEM_LABEL} from "@/lib/labels";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
import {cancelarAgendamentoDoAtendimento,enviarAgendamentoAgoraDoAtendimento} from "@/server/whatsapp/acoes-conversa";
import {quandoAgendada} from "./quando-agendada";
export interface PropsCartaoAgendada{agendada:AgendadaNoFio;atendimentoId:string;fuso:string;agora:Date;aoEditar?(origem?:HTMLElement):void;aoMudar(mensagem:string):void}
export function autoriaAgendada(a:Pick<AgendadaNoFio,"autor"|"autorNome">):string{
 if(a.autor==="voce")return "por você";
 if(a.autor==="aria")return "por Aria";
 const nome=a.autorNome?.trim();return nome?`por ${nome}`:"pela equipe";
}
export function CartaoAgendada({agendada,atendimentoId,fuso,agora,aoEditar,aoMudar}:PropsCartaoAgendada){
 const envio=useAcaoCliente({idempotente:true}),chave=useChaveIdempotencia(),vivo=useRef(false),contexto=useRef<string|null>(null);
 const [confirmando,setConfirmando]=useState(false);
 const alvo=atendimentoId+":"+agendada.id;
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
 useLayoutEffect(()=>{contexto.current=alvo;return()=>{contexto.current=null;};},[alvo]);
 const acoes=agendada.podeAlterar&&agendada.autor!=="aria";
 const ocupado=envio.ocupado||confirmando;
 async function enviarAgora(){
  if(!acoes||ocupado)return;
  const origem=alvo;
  const r=await envio.executar(()=>enviarAgendamentoAgoraDoAtendimento({atendimentoId,intencaoId:agendada.id,chaveIdempotencia:chave.atual}));
  chave.depoisDo(r);
  if(r?.tipo==="ok"&&vivo.current&&contexto.current===origem)aoMudar("Mensagem enviada.");
 }
 return <div className="my-3 flex justify-end">
  <article aria-label={"Mensagem agendada para "+quandoAgendada(agendada.agendadaPara,fuso,agora)} className="w-[min(440px,80%)] min-w-0 overflow-hidden rounded-xl border-[1.5px] border-dashed border-brand-600 bg-surface">
   <header className="flex items-center gap-1.5 bg-brand-bg px-3 py-1.5 text-xs text-brand-700">
    <IconClock size={14} aria-hidden className="shrink-0"/>
    <p className="min-w-0 flex-1 [overflow-wrap:anywhere]"><span className="font-semibold">Agendada para <time dateTime={agendada.agendadaPara}>{quandoAgendada(agendada.agendadaPara,fuso,agora)}</time></span> <span className={agendada.autor==="aria"?"text-ai-700":undefined}>{autoriaAgendada(agendada)}</span></p>
   </header>
   <div className="px-3 py-2">
    {agendada.temAnexo&&<p className="mb-1 flex items-center gap-1 text-xs text-gray-600"><IconPaperclip size={13} aria-hidden className="shrink-0"/>{agendada.tipo==="TEXTO"?"Anexo":"Anexo · "+rotular(TIPO_MENSAGEM_LABEL,agendada.tipo)}</p>}
    <p className="whitespace-pre-wrap text-[13.5px] [overflow-wrap:anywhere]">{agendada.texto}</p>
   </div>
   {acoes&&<div className="flex flex-wrap items-center justify-end gap-1 border-t border-border-soft px-2 py-1.5">
    {aoEditar&&<Botao variante="fantasma" tamanho="sm" disabled={ocupado} onClick={e=>aoEditar(e.currentTarget)}><IconPencil size={14} aria-hidden/>Editar</Botao>}
    <Botao variante="fantasma" tamanho="sm" ocupado={envio.ocupado} disabled={confirmando} onClick={()=>void enviarAgora()}><IconSend size={14} aria-hidden/>Enviar agora</Botao>
    <Botao variante="fantasma" tamanho="sm" className="text-danger" disabled={ocupado} onClick={()=>{envio.limpar();setConfirmando(true);}}><IconX size={14} aria-hidden/>Cancelar</Botao>
   </div>}
   <FeedbackAcao erro={envio.erro} className="px-3 pb-2"/>
  </article>
  {confirmando&&<ConfirmarAcao
   folha
   titulo="Cancelar esta mensagem agendada?"
   confirmacao="cancelamento"
   idempotente
   acao={() => cancelarAgendamentoDoAtendimento({atendimentoId,intencaoId:agendada.id})}
   aoConcluir={()=>{const origem=alvo;if(!vivo.current)return;setConfirmando(false);if(contexto.current===origem)aoMudar("Mensagem agendada cancelada.");}}
   aoCancelar={()=>setConfirmando(false)}
  ><p>A mensagem não será enviada ao contato. Não há desfazer; para enviar, é preciso agendar de novo.</p></ConfirmarAcao>}
 </div>;
}
