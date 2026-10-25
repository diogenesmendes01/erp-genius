import { createHash } from "node:crypto";
import type { Db } from "@/server/whatsapp/escopo";
import { atendimentoVisivel } from "@/server/whatsapp/atendimentos";
import { podeVerLeadNaThread } from "@/server/whatsapp/visibilidade-lead";
import { hashVinculoInsight,pessoasCompativeisInsight,type VinculoInsight } from "./vinculo";

/** Sempre recebe a conexão em uso. Chamadores de escrita invocam após TODOS os locks/esperas. */
export async function contextoOperacionalInsight(db:Db,autorId:string,atendimentoId:string) {
  const autor=await db.usuario.findUnique({where:{id:autorId},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
  if(!autor?.ativo)return null;
  const a=await atendimentoVisivel(autor,atendimentoId,false,db);
  if(!a||a.finalidade!=="COMERCIAL"||!a.leadId)return null;
  if(!await podeVerLeadNaThread(autor,a.id,a.leadId,Date.now(),db))return null;
  const op=await db.oportunidade.findUnique({where:{id:a.leadId},select:{id:true,pessoaId:true,etapa:true,interesse:true,objetivo:true,urgencia:true,orcamento:true,objecao:true,proximaAcao:true}});
  if(!op)return null;
  const vinculo:VinculoInsight={atendimentoId:a.id,conversaId:a.conversaId,numeroId:a.conversa.numeroId,
    contatoId:a.conversa.contatoId,finalidade:a.finalidade,leadId:a.leadId,leadContatoId:a.contato.leadId,
    pessoaContatoId:a.contato.pessoaId,pessoaLeadId:op.pessoaId,alunoId:a.alunoId,matriculaId:a.matriculaId,turmaId:a.turmaId,grupoId:a.conversa.grupoId};
  const campos={etapa:op.etapa,interesse:op.interesse,objetivo:op.objetivo,urgencia:op.urgencia,orcamento:op.orcamento,objecao:op.objecao,proximaAcao:op.proximaAcao};
  const referenciasHash=createHash("sha256").update(JSON.stringify(campos)).digest("hex");
  return {autor,a,op,campos,vinculo,contextoHash:hashVinculoInsight(vinculo),referenciasHash,pessoasCompativeis:pessoasCompativeisInsight(a.contato.pessoaId,op.pessoaId)};
}
/** Publicação/geração continuam exigindo compatibilidade; operação só resolve status/custo. */
export async function contextoInsightAutorizado(db:Db,autorId:string,atendimentoId:string) {
  const c=await contextoOperacionalInsight(db,autorId,atendimentoId);
  return c?.pessoasCompativeis?c:null;
}
export type ContextoInsightAutorizado=NonNullable<Awaited<ReturnType<typeof contextoInsightAutorizado>>>;

