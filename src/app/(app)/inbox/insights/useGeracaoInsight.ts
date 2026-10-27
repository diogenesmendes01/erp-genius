"use client";
import { useEffect,useRef,useState } from "react";
import { useAcaoCliente,type DesfechoAcao } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { atualizarInsightNoInbox } from "@/server/inbox/acoes-insights";
import type { RetomarInsightSchema } from "@/server/aria/insights/entradas";
import type { z } from "zod";
export type RetomadaInsight=z.input<typeof RetomarInsightSchema>;

export interface ReciboGeracaoInsight {
  geracaoId:string;
  statusPersistencia?:"CONFIRMADA"|"NAO_CONFIRMADA";
  resultadoIncerto?:boolean;
  mensagem?:string;
  versaoConhecidaAntesFinalizacao?:number;
}
export interface PortaGeracaoInsight {
  atendimentoId:string;contexto:string;ativo:boolean;
  autorizado:boolean;podeAtualizar:boolean;
  podeRetomar?:boolean;
  retomarGeracao?:(entrada:RetomadaInsight)=>Promise<Resultado<ReciboGeracaoInsight>>;
  gerar?:(entrada:{atendimentoId:string;chaveTentativa:string})=>Promise<Resultado<ReciboGeracaoInsight>>;
  aoSolicitarLeitura:(geracaoId?:string)=>number|void;
  leitura?:{solicitacao:number;status:number|null;observada:{geracaoId:string;estado:string;versao:number;iniciada:boolean}|null};
  novaChave?:()=>string;
}
type Feedback=Exclude<DesfechoAcao<unknown>,{tipo:"ok"}>|null;
type Pendente={geracaoId:string|null;solicitacao:number;versaoMinima:number};
const mensagemPersistencia="Não foi possível confirmar a gravação da análise. Verifique o estado atualizado antes de continuar.";
export function useGeracaoInsight({atendimentoId,contexto,ativo,autorizado,podeAtualizar,podeRetomar=false,gerar=entrada=>atualizarInsightNoInbox({tipo:"NOVO",...entrada}),retomarGeracao=entrada=>atualizarInsightNoInbox({tipo:"RETOMAR",...entrada}),aoSolicitarLeitura,leitura,novaChave=()=>crypto.randomUUID()}:PortaGeracaoInsight){
  const identidade=ativo&&autorizado?JSON.stringify([atendimentoId,contexto]):null;
  const [ciclo,setCiclo]=useState<{identidade:string|null;token:object;feedback:Feedback;pendente:Pendente|null}>(()=>({identidade,token:{},feedback:null,pendente:null}));
  if(ciclo.identidade!==identidade)setCiclo({identidade,token:{},feedback:null,pendente:null});
  const vigente=useRef<object|null>(null),execucao=useAcaoCliente({idempotente:false});
  useEffect(()=>{vigente.current=ciclo.token;return()=>{if(vigente.current===ciclo.token)vigente.current=null;};},[ciclo.token]);
  const p=ciclo.pendente,o=leitura?.observada;
  if(p&&leitura?.status===200&&leitura.solicitacao>=p.solicitacao&&o&&o.versao>=p.versaoMinima
    &&(p.geracaoId===o.geracaoId||p.geracaoId===null&&(o.estado==="PROCESSANDO"||o.estado==="INCERTO"))){
    const terminal=["PRONTA","FALHOU","RECUSADA","DESCARTADA"].includes(o.estado);
    setCiclo({...ciclo,pendente:null,feedback:terminal&&ciclo.feedback?.tipo==="incerto"?null:ciclo.feedback});
  }
  async function executar(acao:()=>Promise<Resultado<ReciboGeracaoInsight>>,permitido:boolean,retomada=false){
    const token=ciclo.token;
    if(!identidade||!permitido||execucao.ocupado||ciclo.pendente||!retomada&&ciclo.feedback?.tipo==="incerto"||vigente.current!==token)return;
    const d=await execucao.executar(acao);
    if(!d||vigente.current!==token)return;
    const recibo=d.tipo==="ok"?d.dado:undefined;
    const naoConfirmada=recibo?.statusPersistencia==="NAO_CONFIRMADA";
    const feedback:Feedback=recibo?.mensagem?{tipo:"erro",mensagem:recibo.mensagem}:naoConfirmada?{tipo:"incerto",mensagem:mensagemPersistencia}:d.tipo==="ok"?null:d;
    const numero=d.tipo==="ok"||d.tipo==="incerto"?aoSolicitarLeitura(recibo?.geracaoId):undefined;
    const pendente=typeof numero==="number"?{geracaoId:recibo?.geracaoId??null,solicitacao:numero,versaoMinima:recibo?.versaoConhecidaAntesFinalizacao??0}:null;
    setCiclo(anterior=>anterior.token===token?{...anterior,feedback,pendente}:anterior);
  }
  const atualizar=()=>executar(()=>gerar({atendimentoId,chaveTentativa:novaChave()}),podeAtualizar);
  const retomar=(entrada:RetomadaInsight)=>executar(()=>retomarGeracao(entrada),podeRetomar&&entrada.atendimentoId===atendimentoId&&entrada.contextoAtualEsperadoHash===contexto,true);
  return {atualizar,retomar,ocupado:execucao.ocupado,erro:ciclo.feedback?.mensagem??null,incerto:ciclo.feedback?.tipo==="incerto",aguardandoLeitura:ciclo.pendente!==null};
}
