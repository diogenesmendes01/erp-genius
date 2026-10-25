import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { configPadrao } from "@/server/aria/config-schema";
import type { Db } from "@/server/whatsapp/escopo";
import type { AcaoAgenteIATipo, FinalidadeAtendimentoWhatsApp } from "@prisma/client";

export const AGORA344 = new Date("2026-10-24T12:00:00.123Z");
export async function cenarioContagens344() {
  const cat=await seedCatalogoMinimo();
  const admin=await criarUsuario(["ADMINISTRADOR"],"Admin344"), vendedor=await criarUsuario(["VENDEDOR"],"Vendedor344"), outro=await criarUsuario(["VENDEDOR"],"Outro344");
  const aluno=await prisma.aluno.create({data:{primeiroNome:"Aluno344",paisId:cat.pais.id}});
  const matricula=await prisma.matricula.create({data:{alunoId:aluno.id,produtoId:cat.produto.id,paisId:cat.pais.id,moeda:"CRC"}});
  const numero=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50670000347",rotulo:"Contagens344",driver:"MOTOR",finalidade:"AGENDA",setores:{create:[{finalidade:"COMERCIAL"},{finalidade:"SECRETARIA"},{finalidade:"FINANCEIRO"}]}}});
  await prisma.agenteIA.create({data:{id:"aria",estado:"ATIVA"}});
  await prisma.versaoAgenteIA.create({data:{numero:1,status:"PUBLICADA",config:configPadrao(),criadaPorId:admin.id,publicadaPorId:admin.id,publicadaEm:AGORA344}});
  await prisma.configIA.create({data:{id:"ia",orcamentoMensalUsd:1000,acaoAoEstourar:"PAUSAR"}});
  async function criar(letra:string,setor:FinalidadeAtendimentoWhatsApp,responsavelId:string|null,dono?:string) {
    const lead=dono?await prisma.oportunidade.create({data:{nome:"Lead "+letra,vendedorDonoId:dono}}):null;
    const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50680000"+String(letra.charCodeAt(0)).padStart(3,"0"),nomeExibicao:"Contato "+letra}});
    const conversa=await prisma.conversaWhatsApp.create({data:{numeroId:numero.id,contatoId:contato.id}});
    return prisma.atendimentoWhatsApp.create({data:{conversaId:conversa.id,contextoChave:"344-"+letra,finalidade:setor,responsavelId,leadId:lead?.id,...(setor==="FINANCEIRO"?{alunoId:aluno.id,matriculaId:matricula.id}:{})}});
  }
  const A=await criar("A","COMERCIAL",null,outro.id),B=await criar("B","COMERCIAL",vendedor.id,vendedor.id),C=await criar("C","COMERCIAL",null,outro.id),D=await criar("D","COMERCIAL",vendedor.id,vendedor.id),E=await criar("E","COMERCIAL",admin.id,outro.id),F=await criar("F","SECRETARIA",null),G=await criar("G","FINANCEIRO",admin.id);
  await prisma.atendimentoWhatsApp.update({where:{id:D.id},data:{iaPausadaEm:new Date(AGORA344.getTime()-1000),iaPausaMotivo:"HANDOFF"}});
  await prisma.atendimentoWhatsApp.update({where:{id:E.id},data:{iaPausadaEm:new Date(AGORA344.getTime()-1000),iaPausaMotivo:"HUMANO_RESPONDEU"}});
  await prisma.atendimentoWhatsApp.update({where:{id:F.id},data:{prazoRespostaEm:new Date(AGORA344.getTime()-1)}});
  const c={admin,vendedor,outro,numero,A,B,C,D,E,F,G};await sugestao344(c,C.id);
  return c;
}
export type Cenario344=Awaited<ReturnType<typeof cenarioContagens344>>;
let seq=0;
export async function sugestao344(c:Pick<Cenario344,"numero">,atendimentoId:string,expiraEm:Date|null=new Date(AGORA344.getTime()+1),db:Db=prisma,acao:AcaoAgenteIATipo="RESPONDER") {
  const a=await db.atendimentoWhatsApp.findUniqueOrThrow({where:{id:atendimentoId}});
  const ancora=await db.mensagemWhatsApp.create({data:{atendimentoId,conversaId:a.conversaId,numeroId:c.numero.id,direcao:"ENTRADA",corpo:"Fixture344",driver:"MOTOR",status:"ENTREGUE",providerMessageId:"344-ancora-"+(++seq),criadoEm:new Date(AGORA344.getTime()-2000)}});
  const turno=await db.turnoAgenteIA.create({data:{atendimentoId,ancoraMensagemId:ancora.id,tipo:"ATENDIMENTO",resultado:"SUGERIU"}});
  return db.acaoAgenteIA.create({data:{atendimentoId,turnoId:turno.id,acao,status:"SUGERIDA",modoConfigurado:"SUGERIR",confianca:70,payload:{texto:"SEGREDO344"},expiraEm,reversivel:false}});
}
