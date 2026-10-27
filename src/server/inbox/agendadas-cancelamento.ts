import {z} from "zod";
import {Papel} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {ErroRegra,type UsuarioSessao} from "@/server/_shared/sessao";
import {registrarEvento} from "@/server/_shared/evento";
import {exigirCapacidadeCrm} from "@/server/crm/permissoes";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {podeGerirAgendadaInbox} from "./atividade-regras";
import {avisarAtendimentoAtualizado} from "./barramento";
const Id=z.string().min(1,"Mensagem agendada não encontrada.");
const MARCA="cancelada_pelo_autor_inbox";
export async function cancelarAgendadaInboxTx(sessao:UsuarioSessao,atendimentoId:string,intencaoId:string,db=prisma):Promise<void>{
 const id=Id.parse(atendimentoId),mid=Id.parse(intencaoId);
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "IntencaoMensagem" WHERE id=${mid} AND "atendimentoId"=${id} AND "agendadaPara" IS NOT NULL AND "passo" IS NULL AND "passoComercial" IS NULL FOR UPDATE`;
  const ator=async()=>{
   const u=await tx.usuario.findUnique({where:{id:sessao.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
   if(!u?.ativo)throw new ErroRegra("Sua sessão não está mais ativa.");
   if(!u.papeis.includes(Papel.GERENTE_PEDAGOGICO))exigirCapacidadeCrm(u,"tarefas.ver");
   return u;
  };
  const inicial=await ator();
  if(!await atendimentoVisivel(inicial,id,false,tx))throw new ErroRegra("Atendimento não encontrado.");
  const m=await tx.intencaoMensagem.findFirst({where:{id:mid,atendimentoId:id,agendadaPara:{not:null},passo:null,passoComercial:null}});
  if(!m)throw new ErroRegra("Mensagem agendada não encontrada ou sem permissão para cancelar.");
  const autorizar=async()=>{
   const u=await ator();
   const a=await atendimentoVisivel(u,id,false,tx);
   if(!a)throw new ErroRegra("Atendimento não encontrado.");
   const ultimo=await ator();
   if(JSON.stringify([u.papeis,u.permissoes])!==JSON.stringify([ultimo.papeis,ultimo.permissoes])||
      !podeGerirAgendadaInbox(ultimo,m,{ativo:ultimo.ativo,responsavelId:a.responsavelId}))
    throw new ErroRegra("Mensagem agendada não encontrada ou sem permissão para cancelar.");
   return {u:ultimo,a};
  };
  const {u}=await autorizar();
  if(m.status==="CANCELADA"){
   const ultimo=await tx.evento.findFirst({where:{tipo:"MensagemAgendadaCancelada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:id,AND:[{payload:{path:["intencaoId"],equals:mid}},{payload:{path:["atendimentoId"],equals:id}},{payload:{path:["contexto"],equals:"inbox333"}}]},orderBy:[{criadoEm:"desc"},{id:"desc"}],select:{autorId:true}});
   await autorizar();
   if(m.motivoFalha===MARCA&&ultimo?.autorId===u.id)return;
   throw new ErroRegra("A mensagem já foi cancelada.");
  }
  if(m.status!=="PENDENTE"&&m.status!=="ADIADA")throw new ErroRegra("A mensagem já foi despachada ou não pode mais ser cancelada.");
  const r=await tx.intencaoMensagem.updateMany({where:{id:mid,atendimentoId:id,status:m.status,origem:m.origem,autorId:m.autorId,agendadaPara:m.agendadaPara,passo:null,passoComercial:null},data:{status:"CANCELADA",motivoFalha:MARCA}});
  if(r.count!==1)throw new ErroRegra("A mensagem mudou. Atualize a atividade e tente novamente.");
  await registrarEvento(tx,{tipo:"MensagemAgendadaCancelada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:id,autorId:u.id,payload:{intencaoId:mid,atendimentoId:id,contexto:"inbox333"}});
  const final=await autorizar();
  await avisarAtendimentoAtualizado(tx,final.a);
  await autorizar();
 });
}
