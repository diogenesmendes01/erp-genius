import { Prisma,type Evento } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra } from "@/server/_shared/sessao";
import { ReconciliarInsightSchema,DescartarInsightSchema } from "./entradas";
import { hashEntrada,sqlBuscaIdempotente } from "@/server/_shared/idempotencia";
import { registrarEvento } from "@/server/_shared/evento";
import { avisarAtendimentoAtualizado } from "@/server/inbox/barramento";
import { contextoOperacionalInsight } from "./contexto-autorizado";
import { resumoGeracaoInsight,travarAtendimentoInsight,travarGeracaoInsight,type BancoInsight } from "./persistencia";
type Operacao=z.infer<typeof ReconciliarInsightSchema>|z.infer<typeof DescartarInsightSchema>;

async function operar(autorId:string,i:Operacao,db:BancoInsight) {
  const descartar=i.estadoEsperado==="INCERTO";
  const chave=descartar?i.chaveDescarte:i.chaveReconciliacao;
  const tipo=descartar?"InsightInboxDescartado":"InsightInboxIncertezaReconhecida";
  const entradaHash=hashEntrada({atendimentoId:i.atendimentoId,geracaoId:i.geracaoId,versaoEsperada:i.versaoEsperada,estadoEsperado:i.estadoEsperado,contextoAtualEsperadoHash:i.contextoAtualEsperadoHash});
  return db.$transaction(async tx=>{
    const a=await travarAtendimentoInsight(tx,i.atendimentoId);
    const g=await travarGeracaoInsight(tx,i.geracaoId,a.id);
    const c=await contextoOperacionalInsight(tx,autorId,a.id);
    if(!c)throw new ErroRegra("Atendimento não encontrado ou sem acesso aos Insights.");
    if(c.contextoHash!==i.contextoAtualEsperadoHash)throw new ErroRegra("O contexto da conversa mudou. Atualize o painel.");
    const [anterior]=await tx.$queryRaw<Evento[]>(sqlBuscaIdempotente({tipo,agregadoTipo:"AtendimentoWhatsApp",autorId:c.autor.id,chaveIdempotencia:chave}));
    if(anterior){
      const p=anterior.payload!==null&&typeof anterior.payload==="object"&&!Array.isArray(anterior.payload)?anterior.payload as Record<string,unknown>:{};
      if(anterior.agregadoId!==a.id||p.geracaoId!==g.id||p.entradaHash!==entradaHash)throw new ErroRegra("A chave já foi usada com outra intenção.");
      return resumoGeracaoInsight(g);
    }
    if(g.estado!==i.estadoEsperado||g.versao!==i.versaoEsperada)throw new ErroRegra("A geração mudou. Atualize o painel.");
    if(!descartar&&g.iniciadaEm===null)throw new ErroRegra("A geração ainda não foi iniciada. Retome a mesma tentativa.");
    const estado=descartar?"DESCARTADA":"INCERTO";
    const data:Prisma.GeracaoInsightInboxUpdateManyMutationInput={estado,versao:{increment:1},resultadoJson:Prisma.DbNull,
      ...(descartar?{descartadaPorId:c.autor.id,descartadaEm:new Date(),finalizadoEm:new Date()}
        :{erroCodigo:"RESULTADO_NAO_CONFIRMADO",finalizadoEm:new Date()})};
    const r=await tx.geracaoInsightInbox.updateMany({where:{id:g.id,atendimentoId:a.id,estado:i.estadoEsperado,versao:i.versaoEsperada,...(!descartar?{iniciadaEm:{not:null}}:{})},data});
    if(r.count!==1)throw new ErroRegra("A geração mudou. Atualize o painel.");
    await registrarEvento(tx,{tipo,agregadoTipo:"AtendimentoWhatsApp",agregadoId:a.id,autorId:c.autor.id,
      payload:{contexto:"inbox377",geracaoId:g.id,autorClaimId:g.autorId,de:i.estadoEsperado,para:estado,versao:g.versao+1,chaveIdempotencia:chave,entradaHash}});
    await avisarAtendimentoAtualizado(tx,a);
    return {geracaoId:g.id,estado,versao:g.versao+1};
  });
}
export function reconciliarInsightInconclusivo(autorId:string,entrada:unknown,db:BancoInsight=prisma) {
  return operar(autorId,ReconciliarInsightSchema.parse(entrada),db);
}
export function descartarInsightIncerto(autorId:string,entrada:unknown,db:BancoInsight=prisma) {
  return operar(autorId,DescartarInsightSchema.parse(entrada),db);
}

