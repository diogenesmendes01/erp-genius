import { prisma } from "@/lib/prisma";
import { criarUsuario } from "@/test/integracao";
import type { EnvelopeInsight } from "@/server/aria/insights/envelope";

/** Dados exclusivos377; nunca usa provider/telefone real. Requer lease do perfil isolado. */
export async function cenarioInsight377() {
  const dono=await criarUsuario(["VENDEDOR"],"Vendedor fictício377");
  const op=await prisma.oportunidade.create({data:{nome:"Oportunidade fictícia377",vendedorDonoId:dono.id,etapa:"QUALIFICADO"}});
  const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+5500000377001",leadId:op.id}});
  const numero=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+5500001377001",rotulo:"Linha fictícia377",driver:"MOTOR",finalidade:"VENDAS",donoId:dono.id}});
  const conversa=await prisma.conversaWhatsApp.create({data:{numeroId:numero.id,contatoId:contato.id}});
  const a=await prisma.atendimentoWhatsApp.create({data:{conversaId:conversa.id,contextoChave:"COMERCIAL:377",finalidade:"COMERCIAL",leadId:op.id}});
  await prisma.configIA.create({data:{id:"ia",modeloConversa:"claude-sonnet-5-5",orcamentoMensalUsd:100}});
  await prisma.agenteIA.create({data:{id:"aria"}});
  const data=new Date("2026-10-25T12:00:00Z");
  for(const [id,corpo]of[["m377-0001","Gostaria de conhecer o curso."],["m377-0002","Posso estudar à tarde."]]) {
    await prisma.mensagemWhatsApp.create({data:{id,conversaId:conversa.id,numeroId:numero.id,atendimentoId:a.id,direcao:"ENTRADA",driver:"MOTOR",status:"ENTREGUE",corpo,criadoEm:data}});
  }
  return {dono,op,contato,numero,conversa,a};
}
export const analise377={temperatura:null,chanceFechar:null,sentimento:null,melhorHorario:null,intencao:null,sinais:[],riscos:[],proximoPasso:null,textoSugerido:"Texto fictício persistido377"};
export function respostaInsight377():EnvelopeInsight {
  return {tipo:"resposta",fase:"enviado",modelo:"claude-sonnet-5-5",provedor:"anthropic",latenciaMs:1,texto:JSON.stringify(analise377),recusa:false,
    uso:{tokensEntrada:100,tokensSaida:30,tokensCache:0,tokensEscritaCache:0}};
}
