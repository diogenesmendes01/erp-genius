import type{Prisma}from"@prisma/client";
import{ErroAutenticacao}from"@/server/_shared/sessao";
import{usuarioPresencaFresco}from"./presenca-usuario";
export async function resolverCheckpointPresenca(db:Prisma.TransactionClient,usuarioId:string,abaId:string):Promise<{id:string;geracao:string}|null>{
 const user=await db.$queryRaw<{id:string}[]>`SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR NO KEY UPDATE`;
 if(!user.length)throw new ErroAutenticacao();await usuarioPresencaFresco(db,usuarioId);
 const row=await db.presencaInbox.findUnique({where:{usuarioId_abaId:{usuarioId,abaId}},select:{id:true,geracao:true}});
 await usuarioPresencaFresco(db,usuarioId);
 return row?{id:row.id,geracao:row.geracao.toString()}:null;
}
