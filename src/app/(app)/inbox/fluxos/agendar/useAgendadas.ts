"use client";
import {useCallback,useEffect,useState} from "react";
import type {AgendadaNoFio} from "@/server/inbox/agendadas-leitura";
import type {AvisoInbox} from "@/server/inbox/barramento";
import {agendadasDoAtendimento} from "@/server/whatsapp/consultas-acoes-atendimento";
const VAZIA:AgendadaNoFio[]=[];
export function ordenarAgendadas(lista:readonly AgendadaNoFio[]):AgendadaNoFio[]{
 return [...lista].sort((a,b)=>Date.parse(a.agendadaPara)-Date.parse(b.agendadaPara)||(a.id<b.id?-1:a.id>b.id?1:0));
}
export function avisoRecarregaAgendadas(a:AvisoInbox,selecionado:string|null):boolean{
 return a.tipo==="resync"||(!!selecionado&&a.atendimentoId===selecionado);
}
export function useAgendadas(atendimentoId:string|null):{agendadas:AgendadaNoFio[];recarregar():void}{
 const [versao,setVersao]=useState(0);
 const [leitura,setLeitura]=useState<{id:string;lista:AgendadaNoFio[]}|null>(null);
 useEffect(()=>{
  if(!atendimentoId)return;
  let ativo=true;
  void agendadasDoAtendimento(atendimentoId).then(lista=>{if(ativo)setLeitura({id:atendimentoId,lista:ordenarAgendadas(lista)});},()=>undefined);
  return()=>{ativo=false;};
 },[atendimentoId,versao]);
 const recarregar=useCallback(()=>setVersao(v=>v+1),[]);
 return {agendadas:atendimentoId&&leitura?.id===atendimentoId?leitura.lista:VAZIA,recarregar};
}
