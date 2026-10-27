import type{Prisma,PrismaClient}from"@prisma/client";
import{ErroPermissao,ErroRegra}from"@/server/_shared";
import{contentTypePorExtensao}from"@/lib/uploads";
import{calcularEstadoOrcamento}from"@/server/aria/uso";
import{situacaoAria}from"@/server/aria/estado";
import{ariaAtivaGlobal,derivarEstadoAria,idsHandoffPendente,linhaEstadoDe,sugestoesPendentesPorAtendimento}from"@/server/inbox/estado-aria";
import{atendimentoVisivel}from"./atendimentos";
import{midiaSaidaDoAutor,tipoPorMime}from"./midia";
import type{ConteudoEspecial}from"./canal";
import{exigirMotorConectado}from"./motor/capacidades";
import{apenasPortal}from"@/server/_shared/sessao";
type Tx=Prisma.TransactionClient;
export type SaidaInbox={tipo:"texto";texto:string}|{tipo:"midia";url:string;legenda?:string}|{tipo:"especial";conteudo:ConteudoEspecial;midiaUrl?:string};

function dadosEspeciais(payload:Extract<SaidaInbox,{tipo:"especial"}>,autorId:string,numero:Parameters<typeof exigirMotorConectado>[0]){
 if(numero.driver!=="MOTOR")throw new ErroRegra("Este canal não envia esse tipo de conteúdo.");
 exigirMotorConectado(numero);
 const c=payload.conteudo;
 let midiaPath:string|null=null;
 if(c.tipo==="FIGURINHA"||c.tipo==="GIF"){
  const esperado=c.tipo==="FIGURINHA"?"image/webp":"video/mp4";
  if(!payload.midiaUrl||!midiaSaidaDoAutor(payload.midiaUrl,autorId))throw new ErroRegra("Anexo inválido: envie o arquivo pelo uploader da inbox.");
  if(contentTypePorExtensao(payload.midiaUrl)!==esperado)throw new ErroRegra(c.tipo==="FIGURINHA"?"A figurinha precisa ser uma imagem WebP.":"O GIF precisa ser um vídeo MP4.");
  midiaPath=payload.midiaUrl;
 }
 const tipos={FIGURINHA:"FIGURINHA",GIF:"VIDEO",ENQUETE:"ENQUETE",LOCALIZACAO:"LOCALIZACAO",CONTATO:"CONTATO"}as const;
 const corpoRenderizado=c.tipo==="ENQUETE"?c.nome:c.tipo==="LOCALIZACAO"?`📍 ${c.nome??"Localização"}`:"";
 return{tipo:tipos[c.tipo],conteudo:c as unknown as Prisma.InputJsonObject,midiaPath,corpoRenderizado};
}
export async function lerContextoAtualInbox(tx:Tx,id:string){
 const agora=new Date();
 const s=await situacaoAria(agora,tx),config=await tx.configIA.findUnique({where:{id:"ia"}});
 if(!config)throw new ErroRegra("A configuração da Aria mudou. Atualize a conversa antes de responder.");
 const inicioMes=new Date(Date.UTC(agora.getUTCFullYear(),agora.getUTCMonth(),1));
 const soma=await tx.chamadaIA.aggregate({_sum:{custoMicroUsd:true},where:{criadoEm:{gte:inicioMes,lte:agora}}});
 const o=calcularEstadoOrcamento(config,soma._sum.custoMicroUsd??0);
 return{ctx:{agora,ariaAtiva:ariaAtivaGlobal({estado:s.estado,pausada:s.pausada,temVersao:s.versao!==null},o),handoffPendentes:new Set(await idsHandoffPendente(tx,[id]))},sugestao:(await sugestoesPendentesPorAtendimento(tx,[id],agora)).has(id)};
}
async function autorAtual(tx:Tx,id:string){const u=await tx.usuario.findUnique({where:{id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});if(!u?.ativo)throw new ErroPermissao("Sua sessão não está mais ativa.");if(apenasPortal(u))throw new ErroPermissao("Acesso restrito ao portal do aluno.");return u;}
export function enfileirarSaidaInbox(db:Pick<PrismaClient,"$transaction">,autorId:string,id:string,payload:SaidaInbox){return db.$transaction(async tx=>{
 await tx.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});
 await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR NO KEY UPDATE`;
 const {u,conversa}=await lerDestinoHumanoAutorizadoTx(tx,autorId,id);
 if(payload.tipo==="especial"&&conversa.encerradoEm)throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
 exigirEstadoDestinoHumano(conversa);
 let tipo:"TEXTO"|ReturnType<typeof tipoPorMime>="TEXTO";
 if(payload.tipo==="midia"){
  if(!midiaSaidaDoAutor(payload.url,u.id))throw new ErroRegra("Anexo inválido: envie o arquivo pelo uploader da inbox.");
  const mime=contentTypePorExtensao(payload.url);tipo=tipoPorMime(mime);
  if(!mime||tipo==="TEXTO"||tipo==="OUTRO")throw new ErroRegra("Tipo de arquivo não suportado para envio.");
 }
 const detalhes=payload.tipo==="especial"?dadosEspeciais(payload,u.id,conversa.numero):{tipo,corpoRenderizado:payload.tipo==="texto"?payload.texto:payload.legenda??"",...(payload.tipo==="midia"?{midiaPath:payload.url}:{})};
 const{ctx,sugestao}=await lerContextoAtualInbox(tx,id);
 const estado=derivarEstadoAria(linhaEstadoDe(conversa),ctx,sugestao);
 if(estado==="ia"||estado==="aprovacao"||estado==="handoff")throw new ErroRegra("Assuma a conversa para responder.");
 return tx.intencaoMensagem.create({data:{numeroId:conversa.numeroId,atendimentoId:conversa.id,contatoId:conversa.contatoId,origem:"HUMANO",...detalhes,autorId:u.id},select:{id:true}});
 });}

async function lerDestinoHumanoAutorizadoTx(tx:Tx,autorId:string,id:string){
 const u=await autorAtual(tx,autorId);
 const conversa=await atendimentoVisivel(u,id,true,tx);
 if(!conversa)throw new ErroRegra("Conversa não encontrada ou fora do seu escopo.");
 return {u,conversa};
}

function exigirEstadoDestinoHumano(conversa:Awaited<ReturnType<typeof lerDestinoHumanoAutorizadoTx>>["conversa"]){
 if(!conversa.numero.ativo)throw new ErroRegra("Este número está inativo.");
 if(conversa.contato.optOutEm)throw new ErroRegra("O contato pediu para não receber mensagens (opt-out). Reative-o antes de enviar.");
}
export async function validarDestinoSaidaHumanaInboxTx(tx:Tx,autorId:string,id:string){const r=await lerDestinoHumanoAutorizadoTx(tx,autorId,id);exigirEstadoDestinoHumano(r.conversa);return r;}
