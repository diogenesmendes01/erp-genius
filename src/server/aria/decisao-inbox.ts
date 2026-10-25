import { Prisma, type AcaoAgenteIA } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessao, ErroPermissao, ErroRegra, type UsuarioSessao } from "../_shared";
import { carregarFusoInstitucionalTx } from "../operacao/relogio";
import { escopoAtendimentos } from "../whatsapp/escopo";
import { acoesDecidiveisNoInbox, pessoaDoPayloadValida, usaLeadAtualNaResposta } from "./escopo-decisao-inbox";
import { aprovarAcaoAriaTx, rejeitarAcaoAriaTx, desfazerAcaoAriaTx } from "./historico";

type Tx=Prisma.TransactionClient;
type Verbo="aprovar"|"rejeitar"|"desfazer";
async function autorAtual(tx:Tx,id:string):Promise<UsuarioSessao>{
 const u=await tx.usuario.findUnique({where:{id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
 if(!u?.ativo)throw new ErroPermissao("Sua sessão não está mais ativa.");
 return u;
}
async function conferir(tx:Tx,autorId:string,atendimentoId:string,acao:AcaoAgenteIA){
 const u=await autorAtual(tx,autorId);
 const a=await tx.atendimentoWhatsApp.findFirst({where:{AND:[{id:atendimentoId},await escopoAtendimentos(u,{db:tx})]},select:{id:true,finalidade:true,responsavelId:true,leadId:true}});
 if(!a||!(await acoesDecidiveisNoInbox(tx,u,a,[acao])).has(acao.id))throw new ErroPermissao("Esta ação está fora do seu escopo no atendimento.");
 return {u,a};
}
async function travarAlvos(tx:Tx,acao:AcaoAgenteIA,leadId:string|null,verbo:Verbo,leadEfetivo:string|null){
 const p=acao.payload!==null&&typeof acao.payload==="object"&&!Array.isArray(acao.payload)?acao.payload as Record<string,unknown>:{};
 const ids=[...new Set([leadId,...(usaLeadAtualNaResposta(acao)?[leadEfetivo]:[])].filter((id):id is string=>!!id))].sort();
 for(const id of ids)await tx.$queryRaw`SELECT id FROM "Lead" WHERE id=${id} FOR UPDATE`;
 const lead=leadId?await tx.oportunidade.findUnique({where:{id:leadId},select:{pessoaId:true}}):null;
 if(!pessoaDoPayloadValida(acao,lead?.pessoaId??null))throw new ErroRegra("O alvo da sugestão mudou. Reabra o painel antes de decidir.");
 if(lead?.pessoaId){
  const pessoaId=lead.pessoaId;
  await tx.$queryRaw`SELECT id FROM "Pessoa" WHERE id=${pessoaId} FOR KEY SHARE`;
  if(acao.acao==="TAG"&&typeof p.tagId==="string"){
   await tx.$queryRaw`SELECT id FROM "Tag" WHERE id=${p.tagId} FOR KEY SHARE`;
   await tx.$queryRaw`SELECT "pessoaId" FROM "PessoaTag" WHERE "pessoaId"=${pessoaId} AND "tagId"=${p.tagId} FOR UPDATE`;
  }
  if(acao.acao==="ATUALIZAR_CAMPO"&&typeof p.campoId==="string"){
   await tx.$queryRaw`SELECT id FROM "CampoPersonalizado" WHERE id=${p.campoId} FOR KEY SHARE`;
   await tx.$queryRaw`SELECT id FROM "ValorCampoPersonalizado" WHERE "pessoaId"=${pessoaId} AND "campoId"=${p.campoId} FOR UPDATE`;
  }
 }
 if(verbo==="desfazer"&&acao.acao==="CRIAR_TAREFA"&&typeof p.tarefaId==="string"){
  await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${p.tarefaId} FOR UPDATE`;
  const t=await tx.tarefa.findUnique({where:{id:p.tarefaId},select:{atendimentoId:true,leadId:true}});
  if(!t||t.atendimentoId!==acao.atendimentoId||t.leadId!==leadId)throw new ErroRegra("A tarefa não pertence ao alvo desta sugestão.");
 }
 if(verbo==="desfazer"&&acao.acao==="AGENDAR_MENSAGEM"&&acao.intencaoId){
  await tx.$queryRaw`SELECT id FROM "IntencaoMensagem" WHERE id=${acao.intencaoId} FOR UPDATE`;
  const m=await tx.intencaoMensagem.findUnique({where:{id:acao.intencaoId},select:{atendimentoId:true,leadId:true,acaoAgenteIAId:true}});
  if(!m||m.atendimentoId!==acao.atendimentoId||m.leadId!==leadId||m.acaoAgenteIAId!==acao.id)throw new ErroRegra("A mensagem não pertence ao alvo desta sugestão.");
 }
}
function decidir(atendimentoId:string,id:string,verbo:Verbo,motivo?:string){
 return executarAcao(async()=>{
  const autor=await exigirSessao();
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "AcaoAgenteIA" WHERE id=${id} FOR UPDATE`;
   const acao=await tx.acaoAgenteIA.findUnique({where:{id}});
   if(!acao)throw new ErroRegra("Ação da Aria não encontrada.");
   if(acao.atendimentoId!==atendimentoId)throw new ErroPermissao("A sugestão não pertence a este atendimento.");
   // Configuração necessária precede o atendimento; o executor reutiliza o mesmo lock/tx.
   const opcoes=verbo==="aprovar"&&acao.acao==="CRIAR_TAREFA"?{fusoTarefa:await carregarFusoInstitucionalTx(tx)}:undefined;
   if(verbo==="aprovar"&&acao.acao==="AGENDAR_MENSAGEM")await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id='escola' FOR SHARE`;
   await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${atendimentoId} FOR NO KEY UPDATE`;
   const inicial=await conferir(tx,autor.id,atendimentoId,acao);
   await travarAlvos(tx,acao,acao.oportunidadeId??inicial.a.leadId,verbo,inicial.a.leadId);
   // Nada capturado antes de uma espera autoriza a escrita posterior.
   const {u}=await conferir(tx,autor.id,atendimentoId,acao);
   if(verbo==="aprovar")await aprovarAcaoAriaTx(tx,acao,u,opcoes);
   else if(verbo==="rejeitar")await rejeitarAcaoAriaTx(tx,acao,u,motivo?.trim()?motivo.trim().slice(0,500):null);
   else await desfazerAcaoAriaTx(tx,acao,u,{replayMesmoAutorNoInbox:true});
  });
 });
}
export const aprovarSugestaoNoInbox=(atendimentoId:string,id:string)=>decidir(atendimentoId,id,"aprovar");
export const rejeitarSugestaoNoInbox=(atendimentoId:string,id:string,motivo?:string)=>decidir(atendimentoId,id,"rejeitar",motivo);
export const desfazerSugestaoNoInbox=(atendimentoId:string,id:string)=>decidir(atendimentoId,id,"desfazer");
