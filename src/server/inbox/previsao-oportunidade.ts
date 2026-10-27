import {z} from "zod";
import {Papel,type Prisma} from "@prisma/client";
import {apenasPortal,ErroPermissao,ErroRegra,exigirPapel} from "@/server/_shared/sessao";
import {registrarEvento} from "@/server/_shared/evento";
import {escopoComercialAtual} from "@/server/_shared/escopo-comercial";
import {escopoAtendimentos} from "@/server/whatsapp/escopo";
import {DataCivilSchema} from "@/server/matricula/cobertura";
import {PrevisaoOportunidadeSchema,prepararMudancaPrevisao} from "@/server/comercial/previsao-schema";
import {avisarAtendimentoAtualizado} from "./barramento";

export const DefinirPrevisaoInboxSchema=z.object({
 oportunidadeIdEsperada:z.string().min(1),
 esperado:z.object({probabilidadePct:z.number().int().min(0).max(100).nullable(),previsaoFechamento:DataCivilSchema.nullable()}).strict(),
 alteracoes:PrevisaoOportunidadeSchema,
}).strict();
export type DefinirPrevisaoInboxInput=z.input<typeof DefinirPrevisaoInboxSchema>;
export async function definirPrevisaoNoInboxTx(tx:Prisma.TransactionClient,autorId:string,atendimentoId:string,entrada:unknown){
 const d=DefinirPrevisaoInboxSchema.parse(entrada);
 const atendimentoTravado=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${atendimentoId} FOR NO KEY UPDATE`;
 if(atendimentoTravado.length!==1)throw new ErroPermissao("Atendimento não disponível.");
 const autorFresco=async()=>{
  const u=await tx.usuario.findUnique({where:{id:autorId},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
  if(!u?.ativo||apenasPortal(u))throw new ErroPermissao("Sua sessão não permite editar esta oportunidade.");
  exigirPapel(u,Papel.VENDEDOR,Papel.GERENTE_COMERCIAL);return u;
 };
 const contexto=async()=>{
  const u=await autorFresco();
  const a=await tx.atendimentoWhatsApp.findFirst({where:{AND:[{id:atendimentoId},await escopoAtendimentos(u,{db:tx})]},select:{id:true,conversaId:true,leadId:true,finalidade:true}});
  if(!a||a.finalidade!=="COMERCIAL")throw new ErroPermissao("Oportunidade não disponível neste atendimento.");
  if(a.leadId!==d.oportunidadeIdEsperada)throw new ErroRegra("A oportunidade mudou. Atualize o painel antes de editar.");
  return {u,a};
 };
 await contexto();
 const leadTravado=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Lead" WHERE id=${d.oportunidadeIdEsperada} FOR UPDATE NOWAIT`;
 if(leadTravado.length!==1)throw new ErroRegra("A oportunidade mudou. Atualize o painel antes de editar.");
 const autorTravado=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Usuario" WHERE id=${autorId} FOR KEY SHARE`;
 if(autorTravado.length!==1)throw new ErroPermissao("Sua sessão não está mais ativa.");
 const {u,a}=await contexto();
 const op=await tx.oportunidade.findFirst({where:{AND:[{id:d.oportunidadeIdEsperada},await escopoComercialAtual(u,tx)]},select:{id:true,probabilidadePct:true,previsaoFechamento:true}});
 if(!op)throw new ErroPermissao("Você não tem acesso à edição desta oportunidade.");
 const mudanca=prepararMudancaPrevisao(op,d.alteracoes);
 if(!mudanca.alterado)return;
 if((mudanca.dados.probabilidadePct!==undefined&&op.probabilidadePct!==d.esperado.probabilidadePct)||(mudanca.dados.previsaoFechamento!==undefined&&op.previsaoFechamento!==d.esperado.previsaoFechamento))throw new ErroRegra("A previsão mudou. Atualize o painel antes de salvar novamente.");
 await tx.oportunidade.update({where:{id:op.id},data:mudanca.dados});
 await registrarEvento(tx,{tipo:"LeadEditado",agregadoTipo:"Lead",agregadoId:op.id,autorId:u.id,payload:{previsoes:mudanca.mudancas}});
 await avisarAtendimentoAtualizado(tx,{id:a.id,conversaId:a.conversaId});
}
export function leadOcupadoParaPrevisao(erro:unknown):boolean{
 if(typeof erro!=="object"||erro===null)return false;
 if("code" in erro&&erro.code==="55P03")return true;
 if(!("meta" in erro)||typeof erro.meta!=="object"||erro.meta===null)return false;
 return "code" in erro.meta&&erro.meta.code==="55P03";
}