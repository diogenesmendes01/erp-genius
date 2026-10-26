import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra } from "@/server/_shared/sessao";
import { registrarEvento } from "@/server/_shared/evento";
import { avisarAtendimentoAtualizado } from "@/server/inbox/barramento";
import type { EnvelopeInsight } from "./envelope";
import { contextoInsightAutorizado } from "./contexto-autorizado";
import { planejarFinalizacaoInsight } from "./finalizacao-plano";
import { resumoGeracaoInsight,travarAtendimentoInsight,travarGeracaoInsight,type BancoInsight } from "./persistencia";

/** Porta técnica interna. Nenhuma action pública aceita envelope/custo fornecido pelo browser. */
export async function finalizarInsight(input:{atendimentoId:string;geracaoId:string;envelope:EnvelopeInsight;recebidoEm:Date},db:BancoInsight=prisma) {
  const recebidoEm=z.date().parse(input.recebidoEm);
  return db.$transaction(async tx=>{
    const a=await travarAtendimentoInsight(tx,input.atendimentoId);
    const g=await travarGeracaoInsight(tx,input.geracaoId,a.id);
    const c=await contextoInsightAutorizado(tx,g.autorId,a.id);
    const autorizado=!!c,contextoConfere=!!c&&c.contextoHash===g.contextoHash;
    const plano=planejarFinalizacaoInsight(g.estado,input.envelope,g.precosSnapshotJson,autorizado,contextoConfere);
    const usoNovo=!g.chamadaIAId&&plano.registroUso;
    // ACL negativa é resultado de publicação, não throw que apagaria uso já conhecido.
    const chamada=usoNovo?await tx.chamadaIA.create({data:{origem:"INSIGHT",...usoNovo,criadoEm:recebidoEm}}):null;
    if(!chamada&&!plano.proximoEstado)return {...resumoGeracaoInsight(g),autorizado,contextoConfere};
    const data:Prisma.GeracaoInsightInboxUpdateManyMutationInput={versao:{increment:1},
      ...(chamada?{chamadaIAId:chamada.id}:{}),
      ...(plano.proximoEstado?{estado:plano.proximoEstado,erroCodigo:plano.erroCodigo,finalizadoEm:recebidoEm,
        resultadoJson:plano.analise??Prisma.DbNull,...(plano.analise?{geradoEm:recebidoEm}:{})}:{}),
    };
    const atualizado=await tx.geracaoInsightInbox.updateMany({where:{id:g.id,atendimentoId:a.id,estado:g.estado,versao:g.versao,chamadaIAId:g.chamadaIAId},data});
    if(atualizado.count!==1)throw new ErroRegra("A geração mudou. Atualize o painel.");
    await registrarEvento(tx,{tipo:plano.proximoEstado?"InsightInboxFinalizado":"InsightInboxUsoContabilizado",agregadoTipo:"AtendimentoWhatsApp",agregadoId:a.id,autorId:null,
      payload:{contexto:"inbox377",geracaoId:g.id,autorClaimId:g.autorId,estado:plano.proximoEstado??g.estado,versao:g.versao+1,usoContabilizado:!!chamada}});
    await avisarAtendimentoAtualizado(tx,a);
    return {geracaoId:g.id,estado:plano.proximoEstado??g.estado,versao:g.versao+1,autorizado,contextoConfere};
  });
}
