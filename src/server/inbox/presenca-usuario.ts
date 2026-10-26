import type {Prisma} from "@prisma/client";
import {apenasPortal,temPapel,ErroPermissao,ErroAutenticacao} from "@/server/_shared/sessao";
import {PAPEIS_INBOX} from "@/server/whatsapp/escopo";
export async function usuarioPresencaFresco(tx:Prisma.TransactionClient,id:string){
 const u=await tx.usuario.findUnique({where:{id},select:{id:true,nome:true,ativo:true,papeis:true,permissoes:true}});
 if(!u?.ativo)throw new ErroAutenticacao();
 if(apenasPortal(u)||!temPapel(u,...PAPEIS_INBOX))throw new ErroPermissao();
 return u;
}
