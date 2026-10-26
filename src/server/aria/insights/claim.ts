import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { ErroRegra } from "@/server/_shared/sessao";
import { NovoInsightSchema } from "./entradas";
import { registrarEvento } from "@/server/_shared/evento";
import { avisarAtendimentoAtualizado } from "@/server/inbox/barramento";
import { calcularEstadoOrcamento } from "../uso";
import { configPadrao } from "../config-schema";
import { versaoPublicada } from "../versoes";
import { modeloPermitido } from "../provedor/custo";
import { contextoInsightAutorizado } from "./contexto-autorizado";
import { capturarPrecosInsight } from "./precos";
import { criarSnapshotInsight,jsonInsight } from "./snapshot";
import { recusarPreInicioInsight } from "./preinicio";
import { resumoGeracaoInsight,travarAtendimentoInsight,travarGeracaoInsight,type BancoInsight } from "./persistencia";
const indisponivel=()=>new ErroRegra("A geração de Insights está indisponível.");

/** Claim sem rede. Uma unicidade perdida sai da TX abortada antes da releitura autorizada. */
export async function prepararNovoInsight(autorId:string,entrada:unknown,opcoes:{disponivel:boolean;demo?:boolean;db?:BancoInsight}) {
  const i=NovoInsightSchema.parse(entrada),db=opcoes.db??prisma;
  async function transacao(somenteReleitura=false) {
    return db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "ConfigIA" WHERE id='ia' FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "AgenteIA" WHERE id='aria' FOR SHARE`;
      const a=await travarAtendimentoInsight(tx,i.atendimentoId);
      let c=await contextoInsightAutorizado(tx,autorId,a.id);
      if(!c)throw new ErroRegra("Atendimento não encontrado ou sem acesso aos Insights.");
      const porChave=await tx.geracaoInsightInbox.findUnique({where:{chaveTentativa:i.chaveTentativa},select:{id:true,atendimentoId:true,autorId:true}});
      if(porChave){
        if(porChave.autorId!==autorId||porChave.atendimentoId!==a.id)throw new ErroRegra("Chave de tentativa indisponível. Inicie outra intenção.");
        const g=await travarGeracaoInsight(tx,porChave.id,a.id);
        c=await contextoInsightAutorizado(tx,autorId,a.id);
        if(!c||c.contextoHash!==g.contextoHash){
          await recusarPreInicioInsight(tx,a,g,c?.autor.id??null,c?"CONTEXTO_PRE_INICIO_ALTERADO":"ACL_PRE_INICIO_INVALIDA");
          return {...resumoGeracaoInsight(g),deveIniciar:false,ocupado:false,negado:true,contextoAtualEsperadoHash:c?.contextoHash??null};
        }
        return {...resumoGeracaoInsight(g),deveIniciar:g.estado==="PROCESSANDO"&&g.iniciadaEm===null,ocupado:false,negado:false,contextoAtualEsperadoHash:c.contextoHash};
      }
      const ativo=await tx.geracaoInsightInbox.findFirst({where:{atendimentoId:a.id,estado:{in:["PROCESSANDO","INCERTO"]}},select:{id:true}});
      if(ativo){
        const g=await travarGeracaoInsight(tx,ativo.id,a.id);
        c=await contextoInsightAutorizado(tx,autorId,a.id);
        if(!c)throw new ErroRegra("Atendimento não encontrado ou sem acesso aos Insights.");
        if(g.estado==="PROCESSANDO"&&g.iniciadaEm===null){
          const original=await contextoInsightAutorizado(tx,g.autorId,a.id);
          if(!original||original.contextoHash!==g.contextoHash){
            if(!await recusarPreInicioInsight(tx,a,g,c.autor.id,original?"CONTEXTO_PRE_INICIO_ALTERADO":"ACL_PRE_INICIO_INVALIDA"))throw new ErroRegra("A geração mudou. Atualize o painel.");
          } else return {...resumoGeracaoInsight(g),deveIniciar:false,ocupado:true,negado:false,contextoAtualEsperadoHash:c.contextoHash};
        } else return {...resumoGeracaoInsight(g),deveIniciar:false,ocupado:true,negado:false,contextoAtualEsperadoHash:c.contextoHash};
      }
      if(somenteReleitura)throw new ErroRegra("A tentativa mudou. Atualize o painel antes de tentar novamente.");
      const config=await tx.configIA.findUnique({where:{id:"ia"}}),agente=await tx.agenteIA.findUnique({where:{id:"aria"},select:{id:true}});
      if(!config||!agente||(!opcoes.demo&&!opcoes.disponivel))throw indisponivel();
      if(!Number.isFinite(Number(config.orcamentoMensalUsd))||Number(config.orcamentoMensalUsd)<0)throw indisponivel();
      const agora=new Date(),inicioMes=new Date(Date.UTC(agora.getUTCFullYear(),agora.getUTCMonth(),1));
      const soma=await tx.chamadaIA.aggregate({_sum:{custoMicroUsd:true},where:{criadoEm:{gte:inicioMes,lte:agora}}});
      if(calcularEstadoOrcamento(config,soma._sum.custoMicroUsd??0).situacao==="ESTOURADO")throw new ErroRegra("Orçamento de IA esgotado.");
      const publicada=await versaoPublicada(tx);
      const modelo=opcoes.demo?"simulado":config.modeloConversa;
      if(!opcoes.demo&&!modeloPermitido(modelo))throw indisponivel();
      const snapshot=criarSnapshotInsight(publicada?.config??configPadrao(),c.referenciasHash);
      const g=await tx.geracaoInsightInbox.create({data:{atendimentoId:a.id,autorId:c.autor.id,chaveTentativa:i.chaveTentativa,contextoHash:c.contextoHash,
        baseHash:createHash("sha256").update("[]").digest("hex"),baseQuantidade:0,configPublicadaId:publicada?.id??null,
        configSnapshotJson:jsonInsight(snapshot),precosSnapshotJson:jsonInsight(capturarPrecosInsight(modelo)),modelo,provedor:opcoes.demo?"simulado":"anthropic",simulada:!!opcoes.demo}});
      await registrarEvento(tx,{tipo:"InsightInboxSolicitado",agregadoTipo:"AtendimentoWhatsApp",agregadoId:a.id,autorId:c.autor.id,payload:{contexto:"inbox377",geracaoId:g.id,versao:g.versao}});
      await avisarAtendimentoAtualizado(tx,a);
      return {...resumoGeracaoInsight(g),deveIniciar:true,ocupado:false,negado:false,contextoAtualEsperadoHash:c.contextoHash};
    });
  }
  try{return await transacao();}catch(e){
    if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")return transacao(true);
    throw e;
  }
}



