"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {CartaoTarefaFio} from "@/components/conversa/CartaoTarefaFio";
import {FeedbackAcao} from "@/components/FeedbackAcao";
import {useAcaoCliente} from "@/lib/acao-cliente";
import {EscolhaMensagemAgendada} from "./EscolhaMensagemAgendada";
import {concluirTarefaNoInbox} from "@/server/inbox/acoes-painel";
import type {DecisaoMensagemAgendada} from "@/lib/selo-mensagem-agendada";
import type {TarefaPainel} from "@/server/inbox/painel-tarefas";
export function CartaoTarefaDoInbox({atendimentoId,t,bloqueado=false,fuso,usuarioNome,aoEditar,aoMudar}:{atendimentoId:string;t:TarefaPainel;bloqueado?:boolean;fuso:string|null;usuarioNome:string|null;aoEditar?(t:TarefaPainel):void;aoMudar():void}){
 const exec=useAcaoCliente({idempotente:false}),vivo=useRef(false),emCurso=useRef(false),alvoAtual=useRef(t);
 const [contexto,setContexto]=useState(()=>({atendimentoId,bloqueado}));
 const [escolhendo,setEscolhendo]=useState(false);
 if(contexto.atendimentoId!==atendimentoId||contexto.bloqueado!==bloqueado)setContexto({atendimentoId,bloqueado});
 const atual=useRef<typeof contexto|null>(contexto),[tentativa,setTentativa]=useState<typeof contexto|null>(null);
 useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
 useLayoutEffect(()=>{atual.current=contexto;return()=>{atual.current=null;};},[contexto]);
 useLayoutEffect(()=>{alvoAtual.current=t;},[t]);
 function alvoValido(){const novo=alvoAtual.current;return !bloqueado&&atual.current===contexto&&novo.id===t.id&&novo.versao===t.versao&&novo.status==="ABERTA"&&novo.podeAgir;}
 function pedirConcluir(){if(emCurso.current||!alvoValido())return;if(t.mensagemAgendada){setEscolhendo(true);return;}void concluir();}
 async function concluir(decisao?:DecisaoMensagemAgendada){
  if(emCurso.current||!alvoValido())return;
  emCurso.current=true;const origem=contexto;setEscolhendo(false);setTentativa(origem);
  const r=await exec.executar(()=>decisao?concluirTarefaNoInbox(atendimentoId,t.id,t.versao,decisao):concluirTarefaNoInbox(atendimentoId,t.id,t.versao),"Tarefa concluída.");
  emCurso.current=false;
  if(vivo.current&&atual.current===origem&&r?.tipo==="ok")aoMudar();
 }
 const mensagem=t.mensagemAgendada;
 return <div className="min-w-0"><CartaoTarefaFio t={bloqueado?{...t,podeAgir:false}:t} fuso={fuso} usuarioNome={usuarioNome} ocupado={exec.ocupado} aoEditar={aoEditar?()=>{if(!emCurso.current&&alvoValido())aoEditar(t);}:undefined} aoConcluir={pedirConcluir}/><FeedbackAcao erro={tentativa===contexto?exec.erro:null} sucesso={tentativa===contexto?exec.sucesso:null} className="mx-auto mb-2 w-[86%] max-w-[440px]"/>{escolhendo&&mensagem&&<EscolhaMensagemAgendada mensagem={mensagem} ocupado={exec.ocupado} aoVoltar={()=>setEscolhendo(false)} aoEscolher={decisao=>{if(alvoValido())void concluir(decisao);else setEscolhendo(false);}}/>}</div>;
}
