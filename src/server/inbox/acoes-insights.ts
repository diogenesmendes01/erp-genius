"use server";
import { executarAcao } from "@/server/_shared/resultado";
import { exigirSessao,exigirPapel } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { executarAtualizacaoInsight } from "@/server/aria/insights/controlador";
import { reconciliarInsightInconclusivo,descartarInsightIncerto } from "@/server/aria/insights/operacoes";
import type { AtualizarInsightInput,ReconciliarInsightInput,DescartarInsightInput } from "@/server/aria/insights/entradas";

async function usuarioInbox(){const u=await exigirSessao();exigirPapel(u,...PAPEIS_INBOX);return u;}
export async function atualizarInsightNoInbox(entrada:AtualizarInsightInput){
  return executarAcao(async()=>{const u=await usuarioInbox();return executarAtualizacaoInsight(u.id,entrada);});
}
export async function reconciliarInsightNoInbox(entrada:ReconciliarInsightInput){
  return executarAcao(async()=>{const u=await usuarioInbox();return reconciliarInsightInconclusivo(u.id,entrada);});
}
export async function descartarInsightNoInbox(entrada:DescartarInsightInput){
  return executarAcao(async()=>{const u=await usuarioInbox();return descartarInsightIncerto(u.id,entrada);});
}
