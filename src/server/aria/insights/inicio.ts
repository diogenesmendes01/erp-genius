import { RetomarInsightSchema } from "./entradas";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { avisarAtendimentoAtualizado } from "@/server/inbox/barramento";
import { calcularEstadoOrcamento } from "../uso";
import { ocultarDadosPessoais } from "../turno/contexto";
import { contextoInsightAutorizado,contextoOperacionalInsight } from "./contexto-autorizado";
import { prepararContextoInsight } from "./contexto";
import { criarPedidoInsight } from "./prompt";
import { SnapshotInsightSchema,jsonInsight } from "./snapshot";
import { recusarPreInicioInsight,falharPreInicioInsight } from "./preinicio";
import { resumoGeracaoInsight,travarAtendimentoInsight,travarGeracaoInsight,type BancoInsight } from "./persistencia";

/** Só o vencedor entrega um pedido ao executor externo. Não há provider nesta transação. */
export async function iniciarInsight(autorId:string,entrada:unknown,db:BancoInsight=prisma) {
  const i=RetomarInsightSchema.parse(entrada);
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ConfigIA" WHERE id='ia' FOR SHARE`;
    const a=await travarAtendimentoInsight(tx,i.atendimentoId);
    const g=await travarGeracaoInsight(tx,i.geracaoId,a.id);
    const naoIniciada=(negado=false)=>({...resumoGeracaoInsight(g),iniciada:false as const,negado});
    if(g.autorId!==autorId)return naoIniciada(true);
    const c=await contextoInsightAutorizado(tx,autorId,a.id);
    if(!c||c.contextoHash!==g.contextoHash){
      const atual=await contextoOperacionalInsight(tx,autorId,a.id);
      await recusarPreInicioInsight(tx,a,g,atual?.autor.id??null,c?"CONTEXTO_PRE_INICIO_ALTERADO":"ACL_PRE_INICIO_INVALIDA");
      return naoIniciada(true);
    }
    if(c.contextoHash!==i.contextoAtualEsperadoHash)return naoIniciada(true);
    if(g.estado!=="PROCESSANDO"||g.iniciadaEm!==null||g.versao!==i.versaoEsperada)return naoIniciada();
    const config=await tx.configIA.findUnique({where:{id:"ia"},select:{orcamentoMensalUsd:true,acaoAoEstourar:true}});
    let falha:"ORCAMENTO_ESGOTADO"|"CONFIG_IA_INDISPONIVEL"|null=null;
    if(!config||!Number.isFinite(Number(config.orcamentoMensalUsd))||Number(config.orcamentoMensalUsd)<0)falha="CONFIG_IA_INDISPONIVEL";
    else {
      const agora=new Date(),inicioMes=new Date(Date.UTC(agora.getUTCFullYear(),agora.getUTCMonth(),1));
      const soma=await tx.chamadaIA.aggregate({_sum:{custoMicroUsd:true},where:{criadoEm:{gte:inicioMes,lte:agora}}});
      if(calcularEstadoOrcamento(config,soma._sum.custoMicroUsd??0).situacao==="ESTOURADO")falha="ORCAMENTO_ESGOTADO";
    }
    if(falha){
      if(!await falharPreInicioInsight(tx,a,g,c.autor.id,falha))return naoIniciada();
      return {...resumoGeracaoInsight(g),estado:"FALHOU" as const,versao:g.versao+1,iniciada:false as const,negado:false as const,erroCodigo:falha};
    }
    const snapshot=SnapshotInsightSchema.parse(g.configSnapshotJson);
    const mensagens=await tx.mensagemWhatsApp.findMany({where:{atendimentoId:a.id,apagadaEm:null,corpo:{not:null},OR:[{direcao:"ENTRADA"},{direcao:"SAIDA",status:{in:["ENVIADA","ENTREGUE","LIDA"]}}]},
      orderBy:[{criadoEm:"desc"},{id:"desc"}],take:30,select:{id:true,criadoEm:true,editadaEm:true,apagadaEm:true,direcao:true,status:true,corpo:true}});
    const contexto=prepararContextoInsight(mensagens,ocultarDadosPessoais);
    const ultima=mensagens.find(m=>m.id===contexto.ultimaMensagemId);
    const novoSnapshot={...snapshot,base:{ultimaMensagemEmISO:ultima?.criadoEm.toISOString()??null,referenciasHash:c.referenciasHash}};
    const cfg=snapshot.configPublicada;
    const pedido=criarPedidoInsight(contexto,{instrucoesPublicadas:JSON.stringify({instrucoes:cfg.instrucoes,nuncas:cfg.nuncas,prioridades:cfg.prioridades,faq:cfg.faq}),campos:c.campos},ocultarDadosPessoais);
    const r=await tx.geracaoInsightInbox.updateMany({where:{id:g.id,atendimentoId:a.id,autorId:c.autor.id,estado:"PROCESSANDO",iniciadaEm:null,versao:g.versao,contextoHash:g.contextoHash},
      data:{iniciadaEm:new Date(),versao:{increment:1},baseHash:contexto.baseHash,baseQuantidade:contexto.quantidade,baseUltimaMensagemId:contexto.ultimaMensagemId,configSnapshotJson:jsonInsight(novoSnapshot)}});
    if(r.count!==1)return naoIniciada();
    await registrarEvento(tx,{tipo:"InsightInboxIniciado",agregadoTipo:"AtendimentoWhatsApp",agregadoId:a.id,autorId:c.autor.id,
      payload:{contexto:"inbox377",geracaoId:g.id,versao:g.versao+1,chaveIdempotencia:g.chaveTentativa}});
    await avisarAtendimentoAtualizado(tx,a);
    return {geracaoId:g.id,estado:g.estado,versao:g.versao+1,iniciada:true as const,negado:false as const,pedido,modelo:g.modelo,provedor:g.provedor,simulada:g.simulada};
  });
}


