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
import {cancelarAgendamentoDoAtendimento,enviarAgendamentoAgoraDoAtendimento,manterAgendadaAposResposta} from "@/server/whatsapp/acoes-conversa";
import {quandoAgendada} from "./quando-agendada";
export interface PropsCartaoAgendada{agendada:AgendadaNoFio;atendimentoId:string;nomeContato?:string|null;fuso:string;agora:Date;aoEditar?(origem?:HTMLElement):void;aoMudar(mensagem:string):void}
export function autoriaAgendada(a:Pick<AgendadaNoFio,"autor"|"autorNome">):string{
 if(a.autor==="voce")return "por você";
 if(a.autor==="aria")return "por Aria";
 const nome=a.autorNome?.trim();return nome?`por ${nome}`:"pela equipe";
}
export function perguntaAposResposta(a:Pick<AgendadaNoFio,"autor">,nomeContato?:string|null):string{
 const nome=nomeContato?.trim()||"O contato";
 return a.autor==="voce"?`${nome} respondeu depois que você agendou. Ainda quer enviar?`:`${nome} respondeu depois do agendamento. Ainda quer enviar?`;
}
export function CartaoAgendada({agendada,atendimentoId,nomeContato,fuso,agora,aoEditar,aoMudar}:PropsCartaoAgendada){
 const envio=useAcaoCliente({idempotente:true}),chave=useChaveIdempotencia(),vivo=useRef(false),contexto=useRef<string|null>(null);
 const manutencao=useAcaoCliente({idempotente:true}),chaveManter=useChaveIdempotencia();
 const [confirmando,setConfirmando]=useState(false);
 const alvo=atendimentoId+":"+agendada.id;
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
 useLayoutEffect(()=>{contexto.current=alvo;return()=>{contexto.current=null;};},[alvo]);
 const acoes=agendada.podeAlterar&&agendada.autor!=="aria";
 const pergunta=agendada.perguntaPendente&&agendada.autor!=="aria";
 const ocupado=envio.ocupado||manutencao.ocupado||confirmando;
 async function enviarAgora(){
  if(!acoes||ocupado)return;
  const origem=alvo;
  const r=await envio.executar(()=>enviarAgendamentoAgoraDoAtendimento({atendimentoId,intencaoId:agendada.id,chaveIdempotencia:chave.atual}));
  chave.depoisDo(r);
  if(r?.tipo==="ok"&&vivo.current&&contexto.current===origem)aoMudar("Mensagem enviada.");
 }
 async function manter(){
  if(!acoes||ocupado)return;
  const origem=alvo;
  const r=await manutencao.executar(()=>manterAgendadaAposResposta({atendimentoId,intencaoId:agendada.id,chaveIdempotencia:chaveManter.atual}));
  chaveManter.depoisDo(r);
  if(r?.tipo==="ok"&&vivo.current&&contexto.current===origem)aoMudar("Mensagem mantida agendada.");
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
   {pergunta&&acoes&&<div className="border-t border-amber-200 bg-amber-50 px-3 py-2">
    <p className="text-[13px] text-amber-800 [overflow-wrap:anywhere]">{perguntaAposResposta(agendada,nomeContato)}</p>
    <div className="mt-1.5 flex flex-wrap items-center justify-end gap-1">
     <Botao variante="fantasma" tamanho="sm" className="text-danger" disabled={ocupado} onClick={()=>{envio.limpar();manutencao.limpar();setConfirmando(true);}}><IconX size={14} aria-hidden/>Cancelar envio</Botao>
     <Botao variante="secundario" tamanho="sm" ocupado={manutencao.ocupado} disabled={envio.ocupado||confirmando} onClick={()=>void manter()}><IconClock size={14} aria-hidden/>Manter agendada</Botao>
    </div>
   </div>}
   {pergunta&&!acoes&&<p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 [overflow-wrap:anywhere]">{(nomeContato?.trim()||"O contato")+" respondeu depois do agendamento. A mensagem aguarda confirmação para ser enviada."}</p>}
   {acoes&&!pergunta&&<div className="flex flex-wrap items-center justify-end gap-1 border-t border-border-soft px-2 py-1.5">
    {aoEditar&&<Botao variante="fantasma" tamanho="sm" disabled={ocupado} onClick={e=>aoEditar(e.currentTarget)}><IconPencil size={14} aria-hidden/>Editar</Botao>}
    <Botao variante="fantasma" tamanho="sm" ocupado={envio.ocupado} disabled={confirmando} onClick={()=>void enviarAgora()}><IconSend size={14} aria-hidden/>Enviar agora</Botao>
    <Botao variante="fantasma" tamanho="sm" className="text-danger" disabled={ocupado} onClick={()=>{envio.limpar();setConfirmando(true);}}><IconX size={14} aria-hidden/>Cancelar</Botao>
   </div>}
   <FeedbackAcao erro={envio.erro??manutencao.erro} className="px-3 pb-2"/>
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
