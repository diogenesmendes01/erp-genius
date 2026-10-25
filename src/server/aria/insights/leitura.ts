import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { contextoOperacionalInsight } from "./contexto-autorizado";
import { servicosPadraoInsight } from "./gerador";
import { projetarInsightPainel } from "./dto";
import type { BancoInsight } from "./persistencia";

const statusSelect={id:true,estado:true,versao:true,iniciadaEm:true} as const;
const status=(g:{id:string;estado:string;versao:number;iniciadaEm:Date|null})=>({geracaoId:g.id,estado:g.estado,versao:g.versao,iniciada:g.iniciadaEm!==null});
const BaseSnapshot=z.object({base:z.object({ultimaMensagemEmISO:z.string().datetime().nullable(),referenciasHash:z.string().regex(/^[a-f0-9]{64}$/)})});
/** GET sem provider/mutações: ACL e cache pertencem ao mesmo snapshot de leitura. */
export async function lerInsightAutorizado(autorId:string,atendimentoId:string,opcoes:{db?:BancoInsight;geracaoId?:string}={}) {
  const db=opcoes.db??prisma;
  return db.$transaction(async tx=>{
    const c=await contextoOperacionalInsight(tx,autorId,atendimentoId);
    if(!c)return null;
    const ativo=await tx.geracaoInsightInbox.findFirst({where:{atendimentoId,estado:{in:["PROCESSANDO","INCERTO"]}},select:{...statusSelect,autorId:true,contextoHash:true},orderBy:[{solicitadoEm:"desc"},{id:"desc"}]});
    const observada=opcoes.geracaoId?await tx.geracaoInsightInbox.findFirst({where:{id:opcoes.geracaoId,atendimentoId},select:statusSelect}):null;
    // A incompatibilidade de Pessoa não impede resolver metadata; não autoriza leitura de análise.
    const ultima=c.pessoasCompativeis?await tx.geracaoInsightInbox.findFirst({where:{atendimentoId,estado:"PRONTA",contextoHash:c.contextoHash},
      orderBy:[{geradoEm:"desc"},{id:"desc"}],select:{id:true,geradoEm:true,simulada:true,resultadoJson:true,configSnapshotJson:true,baseUltimaMensagemId:true}}):null;
    let novasMensagens=0,contextoAlterado=false;
    if(ultima){
      const snapshot=BaseSnapshot.parse(ultima.configSnapshotJson);
      contextoAlterado=snapshot.base.referenciasHash!==c.referenciasHash;
      const data=snapshot.base.ultimaMensagemEmISO?new Date(snapshot.base.ultimaMensagemEmISO):null;
      novasMensagens=await tx.mensagemWhatsApp.count({where:{atendimentoId,apagadaEm:null,corpo:{not:null},
        AND:[{OR:[{direcao:"ENTRADA"},{direcao:"SAIDA",status:{in:["ENVIADA","ENTREGUE","LIDA"]}}]}],
        ...(data?{OR:[{criadoEm:{gt:data}},{criadoEm:data,id:{gt:ultima.baseUltimaMensagemId??""}}]}:{})}});
    }
    const disponivel=servicosPadraoInsight.disponivel();
    const emCurso=ativo?{...status(ativo),podeRetomar:ativo.estado==="PROCESSANDO"&&ativo.iniciadaEm===null&&ativo.autorId===autorId&&ativo.contextoHash===c.contextoHash&&c.pessoasCompativeis,
      podeReconciliar:ativo.estado==="PROCESSANDO"&&ativo.iniciadaEm!==null,podeDescartar:ativo.estado==="INCERTO"}:null;
    const painel=projetarInsightPainel({autorizado:true,capacidadeAtualizar:c.pessoasCompativeis,indisponivel:!disponivel,
      emCurso:ativo?{id:ativo.id,estado:ativo.estado as "PROCESSANDO"|"INCERTO"}:null,
      ultima:ultima?.geradoEm?{id:ultima.id,geradoEm:ultima.geradoEm,simulada:ultima.simulada,resultadoJson:ultima.resultadoJson}:null,
      novasMensagens,contextoAlterado});
    return {painel,contextoAtualEsperadoHash:c.contextoHash,emCurso,observada:observada?status(observada):null};
  },{isolationLevel:"RepeatableRead"});
}
