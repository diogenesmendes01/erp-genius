import type { EstadoGeracaoInsightInbox } from "@prisma/client";
import type { EnvelopeInsight } from "./envelope";
import { usoParaRegistroInsight } from "./precos";
import { normalizarInsight,type AnaliseInsight } from "./saida";

export interface PlanoFinalizacaoInsight {
  proximoEstado:EstadoGeracaoInsightInbox|null;
  analise:AnaliseInsight|null;
  registroUso:ReturnType<typeof usoParaRegistroInsight>;
  erroCodigo:string|null;
}
/** ACL negativa é dado de publicação; nunca desfaz o registro de custo conhecido. */
export function planejarFinalizacaoInsight(estado:EstadoGeracaoInsightInbox,envelope:EnvelopeInsight,precos:unknown,autorizado:boolean,bindingConfere:boolean):PlanoFinalizacaoInsight {
  const registroUso=usoParaRegistroInsight(precos,envelope);
  if(estado!=="PROCESSANDO")return {proximoEstado:null,analise:null,registroUso,erroCodigo:null};
  if(envelope.tipo==="nao-enviada")return {proximoEstado:"FALHOU",analise:null,registroUso:null,erroCodigo:envelope.codigo};
  // Desconhecimento mantém o claim mesmo se não houver mais autorização para publicar.
  if(envelope.tipo==="incerto"||!registroUso)return {proximoEstado:"INCERTO",analise:null,registroUso,erroCodigo:envelope.tipo==="incerto"?envelope.codigo:"CUSTO_NAO_CALCULAVEL"};
  if(!autorizado||!bindingConfere)return {proximoEstado:"RECUSADA",analise:null,registroUso,erroCodigo:autorizado?"CONTEXTO_ALTERADO":"SEM_ACESSO_ATUAL"};
  if(envelope.recusa)return {proximoEstado:"RECUSADA",analise:null,registroUso,erroCodigo:"RECUSA_PROVEDOR"};
  const analise=normalizarInsight(envelope.texto);
  return analise?{proximoEstado:"PRONTA",analise,registroUso,erroCodigo:null}
    :{proximoEstado:"FALHOU",analise:null,registroUso,erroCodigo:"SAIDA_INVALIDA"};
}
