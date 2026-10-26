import type {Prisma,PresencaInbox} from "@prisma/client";
import {ErroAutenticacao} from "@/server/_shared/sessao";
import {usuarioPresencaFresco} from "./presenca-usuario";
import type {EntradaPresenca} from "./presenca-schema";
export class ErroPresenca extends Error { constructor(public status:number){super("Presença indisponível. Tente novamente.");} }
const LIMITE=8,RETENCAO=24*60*60_000,TTL=60_000;
const viva=(r:PresencaInbox,agora:Date)=>r.desconectadaEm===null&&agora.getTime()-r.ultimoContatoEm.getTime()<TTL;
/** User→Presenca conserva a ordem FK/CASCADE; nunca toca locks de negócio. */
export async function escreverPresenca(tx:Prisma.TransactionClient,usuarioId:string,entrada:EntradaPresenca,expiraEm:number|null=null):Promise<{id:string;geracao:string}> {
 if(entrada.modo==="ler"||entrada.modo==="resolver")throw new ErroPresenca(400);
 const users=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR NO KEY UPDATE`;
 if(!users.length)throw new ErroAutenticacao();
 await usuarioPresencaFresco(tx,usuarioId);
 if(entrada.modo==="abrir")await tx.$queryRaw`SELECT id FROM "PresencaInbox" WHERE "usuarioId"=${usuarioId} AND "abaId"=${entrada.abaId}::uuid FOR UPDATE`;
 else await tx.$queryRaw`SELECT id FROM "PresencaInbox" WHERE id=${entrada.id} AND "usuarioId"=${usuarioId} FOR UPDATE`;
 await usuarioPresencaFresco(tx,usuarioId);
 const [{agora}]=await tx.$queryRaw<{agora:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS agora`;
 if(expiraEm!==null&&expiraEm<=agora.getTime())throw new ErroAutenticacao();
 if(!(agora instanceof Date)||!Number.isFinite(agora.getTime()))throw new ErroPresenca(503);
 const row=entrada.modo==="abrir"?await tx.presencaInbox.findUnique({where:{usuarioId_abaId:{usuarioId,abaId:entrada.abaId}}}):await tx.presencaInbox.findFirst({where:{id:entrada.id,usuarioId}});
 if(row&&row.usuarioId!==usuarioId)throw new ErroPresenca(409);
 if(entrada.modo==="abrir"){
  if(row?.aberturaId===entrada.aberturaId){if(!viva(row,agora))throw new ErroPresenca(409);return{id:row.id,geracao:row.geracao.toString()};}
  if(row?(entrada.inscricaoEsperada!==row.id||entrada.geracaoEsperada!==row.geracao):(entrada.inscricaoEsperada!==null||entrada.geracaoEsperada!==null||entrada.causa==="reconexao"))throw new ErroPresenca(409);
  if(row?.geracao===9223372036854775807n)throw new ErroPresenca(409);
  const ativas=await tx.presencaInbox.count({where:{usuarioId,desconectadaEm:null,ultimoContatoEm:{gt:new Date(agora.getTime()-TTL)}}});
  if(ativas-(row&&viva(row,agora)?1:0)>=LIMITE)throw new ErroPresenca(429);
  const antigas=await tx.presencaInbox.findMany({where:{usuarioId,ultimoContatoEm:{lt:new Date(agora.getTime()-RETENCAO)},...(row?{id:{not:row.id}}:{})},select:{id:true},orderBy:{ultimoContatoEm:"asc"},take:16});
  if(antigas.length)await tx.presencaInbox.deleteMany({where:{usuarioId,id:{in:antigas.map(r=>r.id)},ultimoContatoEm:{lt:new Date(agora.getTime()-RETENCAO)}}});
  const data={aberturaId:entrada.aberturaId,geracao:(row?.geracao??0n)+1n,sequencia:0n,confirmadaEm:null,ultimoContatoEm:agora,ultimaInteracaoEm:entrada.causa==="entrada"?agora:row?.ultimaInteracaoEm??null,desconectadaEm:null};
  const criada=row?await tx.presencaInbox.update({where:{id:row.id},data}):await tx.presencaInbox.create({data:{usuarioId,abaId:entrada.abaId,...data}});
  return{id:criada.id,geracao:criada.geracao.toString()};
 }
 if(!row||row.id!==entrada.id||row.geracao!==entrada.geracao||entrada.seq<=row.sequencia)throw new ErroPresenca(409);
 if(entrada.modo==="fechar"){
  if(row.desconectadaEm===null)await tx.presencaInbox.update({where:{id:row.id},data:{desconectadaEm:agora,sequencia:entrada.seq}});
 }else{
  if(!viva(row,agora)||(entrada.modo==="interacao"&&row.confirmadaEm===null))throw new ErroPresenca(409);
  await tx.presencaInbox.update({where:{id:row.id},data:{ultimoContatoEm:agora,confirmadaEm:row.confirmadaEm??agora,sequencia:entrada.seq,...(entrada.modo==="interacao"?{ultimaInteracaoEm:agora}:{})}});
 }
 return{id:row.id,geracao:row.geracao.toString()};
}
