import { Papel, type AcaoAgenteIATipo, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo } from "./integracao";
import { seedCanal } from "./integracao-whatsapp";
import { garantirAtendimento, atendimentoVisivel } from "@/server/whatsapp/atendimentos";
import { acoesDecidiveisNoInbox } from "@/server/aria/escopo-decisao-inbox";
let seq=0;
export async function cenarioEdicao355(){
 const cat=await seedCatalogoMinimo();const gerente=await criarUsuario([Papel.GERENTE_COMERCIAL]);const dono=await criarUsuario([Papel.VENDEDOR]);
 await prisma.usuario.update({where:{id:dono.id},data:{gerenteComercialId:gerente.id}});
 const {numero}=await seedCanal({estado:"ATIVA"});const pessoa=await prisma.pessoa.create({data:{nome:"Pessoa fictícia355"}});
 const op=await prisma.oportunidade.create({data:{nome:"Oportunidade fictícia355",paisId:cat.pais.id,telefoneE164:"+50688888888",vendedorDonoId:dono.id,pessoaId:pessoa.id}});
 const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50688888888",leadId:op.id}});
 const criado=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:numero.id,contatoId:contato.id,finalidade:"COMERCIAL",leadId:op.id,responsavelId:dono.id}));
 const at=await prisma.atendimentoWhatsApp.update({where:{id:criado.id},data:{responsavelId:dono.id}});
 const ancora=await prisma.mensagemWhatsApp.create({data:{atendimentoId:at.id,conversaId:at.conversaId,numeroId:numero.id,direcao:"ENTRADA",corpo:"Entrada fictícia355",driver:"MOTOR",status:"ENTREGUE",providerMessageId:`edicao355-${++seq}`}});
 const turno=await prisma.turnoAgenteIA.create({data:{ancoraMensagemId:ancora.id,atendimentoId:at.id,tipo:"ATENDIMENTO",resultado:"EM_ANDAMENTO"}});
 const c={gerente,dono,numero,pessoa,op,contato,at,turno};
 if(!(await atendimentoVisivel(dono,at.id,true,prisma)))throw Error("Canário de envio D1 inválido");
 return c;
}
export type CenarioEdicao355=Awaited<ReturnType<typeof cenarioEdicao355>>;
export async function sugestaoEdicao355(c:CenarioEdicao355,acao:AcaoAgenteIATipo="RESPONDER",payload:Prisma.InputJsonObject={texto:"Texto original IA355"}){
 const s=await prisma.acaoAgenteIA.create({data:{turnoId:c.turno.id,atendimentoId:c.at.id,oportunidadeId:c.op.id,acao,modoConfigurado:"SUGERE",status:"SUGERIDA",confianca:90,payload,reversivel:acao==="CRIAR_TAREFA"||acao==="AGENDAR_MENSAGEM"}});
 if(!(await acoesDecidiveisNoInbox(prisma,c.dono,c.at,[s])).has(s.id))throw Error("Canário D1 da sugestão inválido");return s;
}
export async function intencaoIA355(c:CenarioEdicao355){return prisma.intencaoMensagem.create({data:{numeroId:c.numero.id,contatoId:c.contato.id,atendimentoId:c.at.id,leadId:c.op.id,origem:"IA",status:"PENDENTE",tipo:"TEXTO",corpoRenderizado:"IA pendente fictícia355"}});}