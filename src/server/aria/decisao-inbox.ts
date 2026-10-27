import { avisarAtendimentoAtualizado } from "../inbox/barramento";
import { ChaveIdempotenciaSchema } from "../_shared/validacao";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { marcaIdempotencia, repeticaoIdempotente, sqlBuscaIdempotente } from "../_shared/idempotencia";
import { registrarEvento } from "../_shared/evento";
import { compilarEdicaoSugestao, normalizarEdicaoFornecida } from "./edicao-sugestao";
import { pausarAriaComIntencoesTravadasTx } from "./pausa";
import { validarDestinoSaidaHumanaInboxTx } from "../whatsapp/enfileirar-inbox";
import { exigirAgendamentoNaJanela } from "../whatsapp/janela-agendamento";
import { aplicarAcao, urlDocumentoEnviavel } from "./turno/executor";
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
   const opcoes=verbo==="aprovar"&&acao.acao==="CRIAR_TAREFA"?{fusoTarefa:await carregarFusoInstitucionalTx(tx)}:undefined;
   if(verbo==="aprovar"&&acao.acao==="AGENDAR_MENSAGEM")await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id='escola' FOR SHARE`;
   await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${atendimentoId} FOR NO KEY UPDATE`;
   const inicial=await conferir(tx,autor.id,atendimentoId,acao);
   await travarAlvos(tx,acao,acao.oportunidadeId??inicial.a.leadId,verbo,inicial.a.leadId);
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

export type EdicaoSugestaoInboxInput={atendimentoId:string;id:string;edicao:Record<string,unknown>;chaveIdempotencia:string};
export async function aprovarSugestaoEditadaInboxTx(tx:Tx,autorId:string,input:EdicaoSugestaoInboxInput):Promise<void>{
 const {atendimentoId,id,edicao,chaveIdempotencia}=input;
 const marca=marcaIdempotencia(chaveIdempotencia,{atendimentoId,id,edicao:normalizarEdicaoFornecida(edicao)})!;
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`idem:AcaoAriaAprovada:${autorId}:${chaveIdempotencia}`}, 0))`;
 const [precedente]=await tx.$queryRaw<{agregadoId:string}[]>(sqlBuscaIdempotente({tipo:"AcaoAriaAprovada",agregadoTipo:"AcaoAgenteIA",autorId,chaveIdempotencia}));
 await tx.$queryRaw`SELECT id FROM "AcaoAgenteIA" WHERE id=${id} FOR UPDATE`;
 const acao=await tx.acaoAgenteIA.findUnique({where:{id}});
 if(!acao)throw new ErroRegra("Ação da Aria não encontrada.");
 if(acao.atendimentoId!==atendimentoId)throw new ErroPermissao("A sugestão não pertence a este atendimento.");
 const externa=["RESPONDER","ENVIAR_DOCUMENTO","AGENDAR_MENSAGEM"].includes(acao.acao);
 const opcoes=!precedente&&acao.acao==="CRIAR_TAREFA"?{fusoTarefa:await carregarFusoInstitucionalTx(tx)}:undefined;
 if(!precedente&&externa)await tx.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});
 if(!precedente&&acao.acao==="AGENDAR_MENSAGEM")await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id='escola' FOR SHARE`;
 const candidatas=!precedente&&externa?await tx.$queryRaw<{id:string}[]>`SELECT id FROM "IntencaoMensagem" WHERE "atendimentoId"=${atendimentoId} AND origem='IA' AND status IN ('PENDENTE','ADIADA') ORDER BY id FOR UPDATE`:[];
 await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${atendimentoId} FOR NO KEY UPDATE`;
 const inicial=await conferir(tx,autorId,atendimentoId,acao);
 await travarAlvos(tx,acao,acao.oportunidadeId??inicial.a.leadId,"aprovar",inicial.a.leadId);
 const {u}=await conferir(tx,autorId,atendimentoId,acao);
 const repetido=await repeticaoIdempotente(tx,{tipo:"AcaoAriaAprovada",agregadoTipo:"AcaoAgenteIA",autorId,marca,mensagemConflito:"Esta tentativa já foi usada com outra edição."});
 if(repetido){if(repetido.agregadoId!==id)throw new ErroRegra("Esta tentativa já foi usada com outra edição.");return;}
 if(acao.status!=="SUGERIDA")throw new ErroRegra("Esta sugestão já foi decidida.");
 if(acao.expiraEm&&acao.expiraEm.getTime()<=Date.now())throw new ErroRegra("Esta sugestão expirou.");
 const payloadOriginal=structuredClone(acao.payload);
 const compilada=compilarEdicaoSugestao(acao.acao,acao.payload,edicao);
 const original=Object.fromEntries(["texto","titulo","venceEmISO","agendadaPara"].flatMap(campo=>payloadOriginal&&typeof payloadOriginal==="object"&&!Array.isArray(payloadOriginal)&&Object.hasOwn(payloadOriginal,campo)?[[campo,payloadOriginal[campo]]]:[])) as Prisma.JsonObject;
 const payload={...compilada.payload,original,editadaPorId:u.id,editadaEm:new Date().toISOString(),camposEditados:compilada.camposEditados} as Prisma.JsonObject;
 let eventoId:string;
 let conferirEfeito: (()=>Promise<void>) | null=null;
 if(compilada.saidaHumana){
  const {conversa}=await validarDestinoSaidaHumanaInboxTx(tx,autorId,atendimentoId);
  if(conversa.encerradoEm)throw new ErroRegra("O atendimento já foi encerrado.");
  conferirEfeito=async()=>{const atual=await validarDestinoSaidaHumanaInboxTx(tx,autorId,atendimentoId);if(atual.conversa.id!==conversa.id||atual.conversa.numeroId!==conversa.numeroId||atual.conversa.contatoId!==conversa.contatoId)throw new ErroRegra("O destino da sugestão mudou. Reabra o painel antes de aprovar.");};
  const quando=acao.acao==="AGENDAR_MENSAGEM"?new Date(String(payload.agendadaPara)):null;
  if(quando){if(quando.getTime()<=Date.now())throw new ErroRegra("O horário agendado já passou.");await exigirAgendamentoNaJanela(quando,tx);}
  const documentoId=typeof payload.documentoId==="string"?payload.documentoId:null;
  if(documentoId)await tx.$queryRaw`SELECT id FROM "FonteConhecimento" WHERE id=${documentoId} FOR SHARE`;
  const midiaPath=documentoId?await urlDocumentoEnviavel(tx,documentoId):null;
  if(documentoId&&!midiaPath)throw new ErroRegra("O documento não pode mais ser enviado ao lead.");
  await conferir(tx,autorId,atendimentoId,acao);
  await conferirEfeito();
  const intencao=await tx.intencaoMensagem.create({data:{numeroId:conversa.numeroId,contatoId:conversa.contatoId,atendimentoId,leadId:inicial.a.leadId,origem:"HUMANO",autorId:u.id,tipo:documentoId?"DOCUMENTO":"TEXTO",midiaPath,corpoRenderizado:String(payload.texto??""),agendadaPara:quando,acaoAgenteIAId:id},select:{id:true}});
  await pausarAriaComIntencoesTravadasTx(tx,atendimentoId,u.id,candidatas.map(i=>i.id));
  const efeito=await registrarEvento(tx,{tipo:quando?"MensagemAgendada":"RespostaHumanaEditadaPreparada",agregadoTipo:"AtendimentoWhatsApp",agregadoId:atendimentoId,autorId:u.id,payload:{acaoAgenteIAId:id,intencaoId:intencao.id,origem:"HUMANO",editada:true,...(quando?{agendadaPara:quando.toISOString(),numeroId:conversa.numeroId}:{documento:!!documentoId})}});
  eventoId=efeito.id;
  await tx.acaoAgenteIA.update({where:{id},data:{intencaoId:intencao.id}});
 }else if(acao.acao==="NOTA_INTERNA"){
  const efeito=await registrarEvento(tx,{tipo:"NotaInterna",agregadoTipo:"AtendimentoWhatsApp",agregadoId:atendimentoId,autorId:u.id,payload:{nota:String(payload.texto),acaoAgenteIAId:id,editada:true}});eventoId=efeito.id;
  const linha=await tx.atendimentoWhatsApp.findUniqueOrThrow({where:{id:atendimentoId},select:{id:true,conversaId:true}});
  await avisarAtendimentoAtualizado(tx,linha);
 }else{
  const efeito=await aplicarAcao(tx,{...acao,payload},undefined,opcoes);eventoId=efeito.eventoId;
 }
 await tx.acaoAgenteIA.update({where:{id},data:{status:"APROVADA",decididaPorId:u.id,decididaEm:new Date(),eventoId,...(acao.acao==="CRIAR_TAREFA"?{}:{payload})}});
 await registrarEvento(tx,{tipo:"AcaoAriaAprovada",agregadoTipo:"AcaoAgenteIA",agregadoId:id,autorId:u.id,payload:{acaoAgenteIAId:id,acao:acao.acao,efeitoEventoId:eventoId,editada:true,payloadOriginal,original,camposEditados:compilada.camposEditados,...marca}});
 await conferir(tx,autorId,atendimentoId,acao);
 if(conferirEfeito)await conferirEfeito();
}

const EdicaoInboxSchema=z.object({atendimentoId:z.string().min(1),id:z.string().min(1),edicao:z.record(z.unknown()),chaveIdempotencia:ChaveIdempotenciaSchema}).strict();
export function aprovarSugestaoEditadaNoInbox(input:EdicaoSugestaoInboxInput){return executarAcao(async()=>{
 const u=await exigirSessao();const entrada=EdicaoInboxSchema.parse(input);
 await prisma.$transaction(tx=>aprovarSugestaoEditadaInboxTx(tx,u.id,entrada));
 revalidatePath("/inbox");
});}