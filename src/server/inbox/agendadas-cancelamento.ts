import {z} from "zod";
import {prisma} from "@/lib/prisma";
import {ErroRegra,type UsuarioSessao} from "@/server/_shared/sessao";
import {registrarEvento} from "@/server/_shared/evento";
import {exigirCapacidadeCrm} from "@/server/crm/permissoes";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {podeGerirAgendadaInbox} from "./atividade-regras";
import {avisarAtendimento} from "./aviso";
const Id=z.string().min(1,"Mensagem agendada não encontrada.");
const MARCA="cancelada_pelo_autor_inbox";
/** Operação específica Inbox: mantém as APIs/defaults HUMANO do CRM e não desfaz AcaoAgenteIA. */
export async function cancelarAgendadaInboxTx(sessao:UsuarioSessao,atendimentoId:string,intencaoId:string,db=prisma):Promise<void>{
 const id=Id.parse(atendimentoId),mid=Id.parse(intencaoId);
 await db.$transaction(async tx=>{
  // Compatível com FK de novos registros; não bloqueia intenção NULL de abertura do despachante.
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR NO KEY UPDATE`;
  await tx.$queryRaw`SELECT id FROM "IntencaoMensagem" WHERE id=${mid} AND "atendimentoId"=${id} AND "agendadaPara" IS NOT NULL AND "passo" IS NULL AND "passoComercial" IS NULL FOR UPDATE`;
  const u=await tx.usuario.findUnique({where:{id:sessao.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
  if(!u?.ativo)throw new ErroRegra("Sua sessão não está mais ativa.");
  exigirCapacidadeCrm(u,"tarefas.ver");
  if(!await atendimentoVisivel(u,id,false,tx))throw new ErroRegra("Atendimento não encontrado.");
  const m=await tx.intencaoMensagem.findFirst({where:{id:mid,atendimentoId:id,agendadaPara:{not:null},passo:null,passoComercial:null}});
  if(!m||!podeGerirAgendadaInbox(u,m))throw new ErroRegra("Mensagem agendada não encontrada ou sem permissão para cancelar.");
  if(m.status==="CANCELADA"){
   const ultimo=await tx.evento.findFirst({where:{tipo:"MensagemAgendadaCancelada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:id,AND:[{payload:{path:["intencaoId"],equals:mid}},{payload:{path:["atendimentoId"],equals:id}},{payload:{path:["contexto"],equals:"inbox333"}}]},orderBy:[{criadoEm:"desc"},{id:"desc"}],select:{autorId:true}});
   if(m.motivoFalha===MARCA&&ultimo?.autorId===u.id)return;
   throw new ErroRegra("A mensagem já foi cancelada.");
  }
  if(m.status!=="PENDENTE"&&m.status!=="ADIADA")throw new ErroRegra("A mensagem já foi despachada ou não pode mais ser cancelada.");
  const r=await tx.intencaoMensagem.updateMany({where:{id:mid,atendimentoId:id,status:m.status,origem:m.origem,autorId:m.autorId,agendadaPara:m.agendadaPara,passo:null,passoComercial:null},data:{status:"CANCELADA",motivoFalha:MARCA}});
  if(r.count!==1)throw new ErroRegra("A mensagem mudou. Atualize a atividade e tente novamente.");
  await registrarEvento(tx,{tipo:"MensagemAgendadaCancelada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:id,autorId:u.id,payload:{intencaoId:mid,atendimentoId:id,contexto:"inbox333"}});
  await avisarAtendimento(tx,id);
 });
}