"use server";
import {prisma} from "@/lib/prisma";
import {ErroRegra,exigirSessao} from "@/server/_shared/sessao";
import {executarAcao,type Resultado} from "@/server/_shared/resultado";
import {DefinirPrevisaoInboxSchema,definirPrevisaoNoInboxTx,leadOcupadoParaPrevisao,type DefinirPrevisaoInboxInput} from "./previsao-oportunidade";

export async function definirPrevisaoNoInbox(atendimentoId:string,entrada:DefinirPrevisaoInboxInput):Promise<Resultado>{
 return executarAcao(async()=>{
  const u=await exigirSessao();
  if(typeof atendimentoId!=="string"||!atendimentoId)throw new ErroRegra("Atendimento não disponível.");
  const d=DefinirPrevisaoInboxSchema.parse(entrada);
  try{await prisma.$transaction(tx=>definirPrevisaoNoInboxTx(tx,u.id,atendimentoId,d));}
  catch(erro){
   if(leadOcupadoParaPrevisao(erro))throw new ErroRegra("A oportunidade está sendo atualizada. Atualize o painel e tente salvar novamente.");
   throw erro;
  }
 });
}