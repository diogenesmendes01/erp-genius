import type{Prisma,PrismaClient}from"@prisma/client";
import{ErroPermissao,ErroRegra}from"@/server/_shared";
import{contentTypePorExtensao}from"@/lib/uploads";
import{calcularEstadoOrcamento}from"@/server/aria/uso";
import{situacaoAria}from"@/server/aria/estado";
import{ariaAtivaGlobal,derivarEstadoAria,idsHandoffPendente,linhaEstadoDe,sugestoesPendentesPorAtendimento}from"@/server/inbox/estado-aria";
import{atendimentoVisivel}from"./atendimentos";
import{midiaSaidaDoAutor,tipoPorMime}from"./midia";
type Tx=Prisma.TransactionClient;
export type SaidaInbox={tipo:"texto";texto:string}|{tipo:"midia";url:string;legenda?:string};
/** Não inicializa ConfigIA: somente a preparação anterior ao pai pode fazê-lo. */
export async function lerContextoAtualInbox(tx:Tx,id:string){
 const agora=new Date();
 const s=await situacaoAria(agora,tx),config=await tx.configIA.findUnique({where:{id:"ia"}});
 if(!config)throw new ErroRegra("A configuração da Aria mudou. Atualize a conversa antes de responder.");
 const inicioMes=new Date(Date.UTC(agora.getUTCFullYear(),agora.getUTCMonth(),1));
 const soma=await tx.chamadaIA.aggregate({_sum:{custoMicroUsd:true},where:{criadoEm:{gte:inicioMes,lte:agora}}});
 const o=calcularEstadoOrcamento(config,soma._sum.custoMicroUsd??0);
 return{ctx:{agora,ariaAtiva:ariaAtivaGlobal({estado:s.estado,pausada:s.pausada,temVersao:s.versao!==null},o),handoffPendentes:new Set(await idsHandoffPendente(tx,[id]))},sugestao:(await sugestoesPendentesPorAtendimento(tx,[id],agora)).has(id)};
}
async function autorAtual(tx:Tx,id:string){const u=await tx.usuario.findUnique({where:{id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});if(!u?.ativo)throw new ErroPermissao("Sua sessão não está mais ativa.");return u;}
/** Enfileira na mesma TX da autorização; o chamador só despacha depois do commit. */
export function enfileirarSaidaInbox(db:Pick<PrismaClient,"$transaction">,autorId:string,id:string,payload:SaidaInbox){return db.$transaction(async tx=>{
 await tx.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});
 await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR NO KEY UPDATE`;
 const u=await autorAtual(tx,autorId);
 const conversa=await atendimentoVisivel(u,id,true,tx);
 if(!conversa)throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
 if(!conversa.numero.ativo)throw new ErroRegra("Este número está inativo.");
 if(conversa.contato.optOutEm)throw new ErroRegra("O contato pediu para não receber mensagens (opt-out). Reative-o antes de enviar.");
 let tipo:"TEXTO"|ReturnType<typeof tipoPorMime>="TEXTO";
 if(payload.tipo==="midia"){
  // Posse por autor: nunca consultar conteúdo de arquivo alheio.
  if(!midiaSaidaDoAutor(payload.url,u.id))throw new ErroRegra("Anexo inválido: envie o arquivo pelo uploader da inbox.");
  const mime=contentTypePorExtensao(payload.url);tipo=tipoPorMime(mime);
  if(!mime||tipo==="TEXTO"||tipo==="OUTRO")throw new ErroRegra("Tipo de arquivo não suportado para envio.");
 }
 const{ctx,sugestao}=await lerContextoAtualInbox(tx,id);
 const estado=derivarEstadoAria(linhaEstadoDe(conversa),ctx,sugestao);
 if(estado==="ia"||estado==="aprovacao"||estado==="handoff")throw new ErroRegra("Assuma a conversa para responder.");
 return tx.intencaoMensagem.create({data:{numeroId:conversa.numeroId,atendimentoId:conversa.id,contatoId:conversa.contatoId,origem:"HUMANO",tipo,corpoRenderizado:payload.tipo==="texto"?payload.texto:payload.legenda??"",...(payload.tipo==="midia"?{midiaPath:payload.url}:{}),autorId:u.id},select:{id:true}});
 });}
