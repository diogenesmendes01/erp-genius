import { Prisma,type GeracaoInsightInbox } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import { avisarAtendimentoAtualizado } from "@/server/inbox/barramento";

/** Só prova pré-envio permite esse terminal. Nunca chama provider ou inventa ChamadaIA de custo0. */
type GeracaoPreInicio=Pick<GeracaoInsightInbox,"id"|"estado"|"iniciadaEm"|"versao"|"autorId">;
async function terminalizarPreInicioInsight(tx:Prisma.TransactionClient,a:{id:string;conversaId:string},g:GeracaoPreInicio,autorOperacionalId:string|null,motivo:string,estado:"RECUSADA"|"FALHOU") {
  if(g.estado!=="PROCESSANDO"||g.iniciadaEm!==null)return false;
  const r=await tx.geracaoInsightInbox.updateMany({where:{id:g.id,atendimentoId:a.id,estado:"PROCESSANDO",iniciadaEm:null,versao:g.versao},
    data:{estado,versao:{increment:1},erroCodigo:motivo,finalizadoEm:new Date(),resultadoJson:Prisma.DbNull}});
  if(r.count!==1)return false;
  await registrarEvento(tx,{tipo:estado==="RECUSADA"?"InsightInboxPreInicioRecusado":"InsightInboxPreInicioFalhou",agregadoTipo:"AtendimentoWhatsApp",agregadoId:a.id,autorId:autorOperacionalId,
    payload:{contexto:"inbox377",geracaoId:g.id,autorClaimId:g.autorId,motivo,versao:g.versao+1}});
  await avisarAtendimentoAtualizado(tx,a);
  return true;
}


export function recusarPreInicioInsight(tx:Prisma.TransactionClient,a:{id:string;conversaId:string},g:GeracaoPreInicio,autor:string|null,motivo:string) {
  return terminalizarPreInicioInsight(tx,a,g,autor,motivo,"RECUSADA");
}
export function falharPreInicioInsight(tx:Prisma.TransactionClient,a:{id:string;conversaId:string},g:GeracaoPreInicio,autor:string|null,motivo:"ORCAMENTO_ESGOTADO"|"CONFIG_IA_INDISPONIVEL") {
  return terminalizarPreInicioInsight(tx,a,g,autor,motivo,"FALHOU");
}
