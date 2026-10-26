"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import type { lerInsightAutorizado } from "@/server/aria/insights/leitura";
export type DadosInsights=NonNullable<Awaited<ReturnType<typeof lerInsightAutorizado>>>;

/** GET isolado: sequência explícita identifica leitura pedida depois do ACK, não o SSE anterior. */
export function useLeituraInsights({atendimentoId,ativo,versao}:{atendimentoId:string|null;ativo:boolean;versao:number}) {
  const identidade=ativo&&atendimentoId?atendimentoId:null;
  const [ciclo,setCiclo]=useState(()=>({identidade,token:{},numero:0,geracaoId:null as string|null}));
  if(ciclo.identidade!==identidade)setCiclo({identidade,token:{},numero:0,geracaoId:null});
  const vigente=useRef<object|null>(null),sequencia=useRef(0);
  const [resultado,setResultado]=useState<{token:object;numero:number;versao:number;dado:DadosInsights|null;status:number|null}|null>(null);
  const recarregar=useCallback((geracaoId?:string)=>{
    const numero=++sequencia.current;
    if(identidade&&vigente.current===ciclo.token)setCiclo(anterior=>anterior.token===ciclo.token?{...anterior,numero,geracaoId:geracaoId??anterior.geracaoId}:anterior);
    return numero;
  },[identidade,ciclo.token]);
  useEffect(()=>{
    vigente.current=ciclo.token;
    if(!identidade||!atendimentoId)return ()=>{if(vigente.current===ciclo.token)vigente.current=null;};
    const controle=new AbortController();let ativoPedido=true;
    const numero=ciclo.numero,token=ciclo.token;
    function concluir(dado:DadosInsights|null,status:number){
      if(!ativoPedido||vigente.current!==token)return;
      setResultado(anterior=>({token,numero,versao,status,dado:status===403||status===404||status===401?null:dado??(anterior?.token===token?anterior.dado:null)}));
    }
    const query=ciclo.geracaoId?`?geracaoId=${encodeURIComponent(ciclo.geracaoId)}`:"";
    void fetch(`/api/inbox/atendimentos/${encodeURIComponent(atendimentoId)}/insights${query}`,{cache:"no-store",credentials:"same-origin",signal:controle.signal})
      .then(async r=>{if(!r.ok){concluir(null,r.status);return;}const dado=await r.json() as DadosInsights;
        if(!dado||typeof dado!=="object"||!dado.painel||typeof dado.contextoAtualEsperadoHash!=="string")throw new Error("Resposta inválida.");concluir(dado,200);})
      .catch(()=>concluir(null,503));
    return ()=>{ativoPedido=false;controle.abort();if(vigente.current===token)vigente.current=null;};
  },[identidade,atendimentoId,ciclo.token,ciclo.numero,ciclo.geracaoId,versao]);
  const atual=identidade!==null&&resultado?.token===ciclo.token?resultado:null;
  const fresco=atual?.numero===ciclo.numero&&atual?.versao===versao;
  return {dado:atual?.dado??null,status:fresco?atual?.status??null:null,carregando:identidade!==null&&!fresco,
    solicitacao:ciclo.numero,recarregar};
}
