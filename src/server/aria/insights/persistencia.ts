import type { GeracaoInsightInbox,Prisma,PrismaClient } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";
export type BancoInsight=Pick<PrismaClient,"$transaction">;
export async function travarAtendimentoInsight(tx:Prisma.TransactionClient,id:string) {
  const [a]=await tx.$queryRaw<{id:string;conversaId:string}[]>`SELECT id,"conversaId" FROM "AtendimentoWhatsApp" WHERE id=${id} FOR NO KEY UPDATE`;
  if(!a)throw new ErroRegra("Atendimento não encontrado.");
  return a;
}
export const METADADOS_GERACAO_INSIGHT={id:true,estado:true,versao:true,atendimentoId:true,autorId:true,chaveTentativa:true,contextoHash:true,
  iniciadaEm:true,modelo:true,provedor:true,simulada:true,configPublicadaId:true,configSnapshotJson:true,precosSnapshotJson:true,chamadaIAId:true,
  descartadaPorId:true,descartadaEm:true,erroCodigo:true,baseHash:true,baseQuantidade:true,baseUltimaMensagemId:true,solicitadoEm:true,geradoEm:true,finalizadoEm:true} as const;
export async function travarGeracaoInsight(tx:Prisma.TransactionClient,id:string,atendimentoId:string) {
  await tx.$queryRaw`SELECT id FROM "GeracaoInsightInbox" WHERE id=${id} AND "atendimentoId"=${atendimentoId} FOR UPDATE`;
  const g=await tx.geracaoInsightInbox.findFirst({where:{id,atendimentoId},select:METADADOS_GERACAO_INSIGHT});
  if(!g)throw new ErroRegra("Geração não encontrada.");
  return g;
}
export function resumoGeracaoInsight(g:Pick<GeracaoInsightInbox,"id"|"estado"|"versao">) {
  return {geracaoId:g.id,estado:g.estado,versao:g.versao};
}

