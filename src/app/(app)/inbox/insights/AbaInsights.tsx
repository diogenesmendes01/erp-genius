"use client";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { ESTADO_GERACAO_INSIGHT_LABEL,rotular } from "@/lib/labels";
import type { PortaRascunhoInsight } from "@/components/conversa/rascunho-insight";
import { PainelInsights } from "./PainelInsights";
import { OperacoesInsights } from "./OperacoesInsights";
import { useLeituraInsights } from "./useLeituraInsights";

type Props={atendimentoId:string;ativo:boolean;versao:number;fuso:string|null;fusoEscola:string;rascunhoPorta:PortaRascunhoInsight|null};
const portaIndisponivel={textoAtual:"",revisao:"indisponivel",podeUsar:false,usar:async()=>({ok:false as const,erro:"O rascunho de resposta não está disponível."})};
export function AbaInsights(p:Props){
  const leitura=useLeituraInsights(p),d=leitura.dado;
  if(!p.ativo)return null;
  const negado=leitura.status===401||leitura.status===403||leitura.status===404;
  const rascunho=p.rascunhoPorta?.atendimentoId===p.atendimentoId?p.rascunhoPorta:portaIndisponivel;
  return <div className="space-y-3">
    <MensagemStatus texto={d?.observada?rotular(ESTADO_GERACAO_INSIGHT_LABEL,d.observada.estado):null} progresso={!d&&leitura.carregando?"Carregando Insights…":null}/>
    <FeedbackAcao erro={negado?"Este atendimento não está disponível para Insights.":leitura.status===503?"Não foi possível atualizar os Insights. A análise anterior pode estar desatualizada.":null}/>
    {leitura.status===503&&<Botao variante="secundario" tamanho="sm" onClick={()=>leitura.recarregar()}>Tentar de novo</Botao>}
    {!negado&&d?.painel&&<PainelInsights atendimentoId={p.atendimentoId} contexto={d.contextoAtualEsperadoHash} ativo={p.ativo} autorizado
      dados={{...d.painel,podeAtualizar:d.painel.podeAtualizar&&leitura.status===200}} fuso={p.fuso} fusoEscola={p.fusoEscola}
      podeRetomar={d.emCurso?.podeRetomar===true&&leitura.status===200} aoSolicitarLeitura={leitura.recarregar}
      leitura={{solicitacao:leitura.solicitacao,status:leitura.status,observada:d.observada??d.emCurso}}
      rascunho={{...rascunho,podeUsar:rascunho.podeUsar&&leitura.status===200}}
      renderControles={controle=><OperacoesInsights dados={d} atendimentoId={p.atendimentoId} ativo={p.ativo} bloqueado={controle.bloqueado} leituraFresca={leitura.status===200} aoSolicitarLeitura={leitura.recarregar} aoRetomar={controle.retomar}/>}/>
    }
  </div>;
}
