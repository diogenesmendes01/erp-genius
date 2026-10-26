"use client";
import {useEffect,useRef,useState} from "react";
import {preverNotificadosTarefaNoInbox} from "@/server/inbox/acoes-painel";
export type OpcoesPreviaNotificados={habilitado:boolean;atendimentoId:string;modo:{tipo:"nova"}|{tipo:"editar";tarefa:{id:string;versao:number}};responsavelId:string|null;contextoEsperado:string;iniciais:{id:string;nome:string}[];porta?:typeof preverNotificadosTarefaNoInbox};
type Estado={assinatura:string;candidatos:{id:string;nome:string}[];erro:string|null};
export function usePreviaNotificadosTarefa(p:OpcoesPreviaNotificados){
 const [revisao,setRevisao]=useState(0),[estado,setEstado]=useState<Estado|null>(null);
 const seq=useRef(0);
 const tid=p.modo.tipo==="editar"?p.modo.tarefa.id:null,versao=p.modo.tipo==="editar"?p.modo.tarefa.versao:null;
 const assinatura=JSON.stringify([p.habilitado,p.atendimentoId,tid,versao,p.responsavelId,p.contextoEsperado,revisao]);
 const [identidade,setIdentidade]=useState({assinatura,geracao:0});
 if(identidade.assinatura!==assinatura)setIdentidade({assinatura,geracao:identidade.geracao+1});
 const token=assinatura+":"+identidade.geracao;
 const [semente,setSemente]=useState<{assinatura:string;candidatos:{id:string;nome:string}[];vigente:boolean}|null>(null);
 if(!semente&&p.habilitado)setSemente({assinatura,candidatos:p.iniciais,vigente:true});
 if(semente?.vigente&&(!p.habilitado||semente.assinatura!==assinatura))setSemente({...semente,vigente:false});
 const inicial=p.habilitado&&semente?.vigente&&semente.assinatura===assinatura;
 const porta=p.porta??preverNotificadosTarefaNoInbox;
 useEffect(()=>{
  const atual=++seq.current;let viva=true;
  if(!p.habilitado||inicial)return;
  async function carregar(){
   try{
    const pedido=tid&&versao?{modo:"editar" as const,tarefaId:tid,versao,responsavelPretendidoId:p.responsavelId,contextoEsperado:p.contextoEsperado}:{modo:"nova" as const,responsavelPretendidoId:p.responsavelId,contextoEsperado:p.contextoEsperado};
    const r=await porta(p.atendimentoId,pedido);if(!viva||seq.current!==atual)return;
    setEstado({assinatura:token,candidatos:r.ok&&r.dado?r.dado.candidatos:[],erro:r.ok&&r.dado?null:"Não foi possível atualizar os colegas disponíveis."});
   }catch{if(viva&&seq.current===atual)setEstado({assinatura:token,candidatos:[],erro:"Não foi possível atualizar os colegas disponíveis."});}
  }
  void carregar();return()=>{viva=false;};
 },[token,p.habilitado,p.atendimentoId,tid,versao,p.responsavelId,p.contextoEsperado,porta,inicial]);
 const atual=p.habilitado&&estado?.assinatura===token;
 return {candidatos:inicial?semente.candidatos:atual?estado.candidatos:[],carregando:p.habilitado&&!inicial&&!atual,erro:atual?estado.erro:null,atualizar:()=>setRevisao(v=>v+1)};
}