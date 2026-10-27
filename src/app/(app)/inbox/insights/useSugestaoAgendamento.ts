"use client";
import { useId } from "react";
import type { InsightPainel } from "@/server/aria/insights/dto";
import { useLeituraInsights } from "./useLeituraInsights";
import { useRascunhoInsight } from "./useRascunhoInsight";
const vazio:InsightPainel={podeAtualizar:false,podeDescartarIncerta:false,estado:"vazio",geracaoEmCursoId:null,ultima:null,novasMensagens:0,contextoAlterado:false};
export function useSugestaoAgendamento({atendimentoId,texto,revisao,ocupado,aoTexto,versao=0,ativo=false}:{atendimentoId:string;texto:string;revisao:number;ocupado:boolean;aoTexto(t:string):void;versao?:number;ativo?:boolean}){
  const abertura=useId(),leitura=useLeituraInsights({atendimentoId,ativo,versao});
  const dados=leitura.dado?.painel??vazio;
  const disponivel=ativo&&leitura.status===200&&!!dados.ultima?.analise.textoSugerido&&!ocupado;
  const rascunho=useRascunhoInsight({atendimentoId,contexto:leitura.dado?.contextoAtualEsperadoHash??"",ativo,autorizado:ativo&&leitura.status===200,
    dados,rascunho:{textoAtual:texto,revisao:`${abertura}:${revisao}`,podeUsar:disponivel,async usar(pedido){aoTexto(pedido.texto);return {ok:true};}}});
  return {...rascunho,disponivel,carregando:leitura.carregando,
    aviso:leitura.status===503||leitura.status===403||leitura.status===404?"Sugestão indisponível. Você pode escrever e agendar manualmente.":leitura.status===200&&!dados.ultima?.analise.textoSugerido?"Gere uma análise em Insights para obter uma sugestão.":null};
}
