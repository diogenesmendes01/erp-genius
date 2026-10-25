"use server";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {ErroRegra,executarAcao,exigirSessao,type Resultado} from "@/server/_shared";
import {VincularContatoSchema,type VincularContatoInput} from "@/server/whatsapp/schema";
import {vincularLeadSelecionadoTx} from "@/server/whatsapp/vincular-lead-selecionado";
/** Cartão Cliente voltou: selected é a identidade da operação; não chama o roteamento legado. */
export async function vincularLeadRetornoNoInbox(input:VincularContatoInput):Promise<Resultado>{
 return executarAcao(async()=>{
  const autor=await exigirSessao(),{contatoId,atendimentoId,alvo}=VincularContatoSchema.parse(input);
  if(alvo.tipo!=="lead")throw new ErroRegra("Este vínculo exige uma oportunidade.");
  await prisma.$transaction(tx=>vincularLeadSelecionadoTx(tx,autor,{contatoId,atendimentoId,leadId:alvo.id}));
  revalidatePath("/inbox");
 });
}