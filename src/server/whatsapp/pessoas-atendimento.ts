import {prisma} from "@/lib/prisma";
import type {UsuarioSessao} from "@/server/_shared";
import {podeExecutar} from "@/server/inbox/permissoes";
import {atendimentoVisivel} from "./atendimentos";
import {PAPEIS_INBOX,type Db} from "./escopo";
import {papeisDoSetor} from "./setor";
import {ehLinhaComercial} from "./linha-comercial";
import {podeAmpliarAcessoAoLead} from "./visibilidade-lead";
export async function contextoPessoas(u:UsuarioSessao,id:string,para:"atribuir"|"convidar"|"transferir",db:Db=prisma){
  const a=await atendimentoVisivel(u,id,false,db);
  if(!a||a.encerradoEm)return null;
  const ctx={setor:a.finalidade,responsavelId:a.responsavelId};
  if(!podeExecutar(u,para,ctx))return null;
  if(para==="transferir"&&a.finalidade==="COMERCIAL"&&ehLinhaComercial(a.numero)&&!podeExecutar(u,"atribuir",ctx))return null;
  if(para==="convidar"&&!await podeAmpliarAcessoAoLead(u,a,db))return null;
  const papeis=para==="convidar"?PAPEIS_INBOX:papeisDoSetor(a.finalidade);
  const pessoas=await db.usuario.findMany({
    where:{ativo:true,id:{not:u.id},papeis:{hasSome:papeis}},
    select:{id:true,nome:true},orderBy:{nome:"asc"},take:200,
  });
  return{a,pessoas};
}
