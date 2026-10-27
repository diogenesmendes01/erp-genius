"use server";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apenasPortal, exigirSessao, exigirPapel, ErroAutenticacao, ErroRegra } from "@/server/_shared/sessao";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
type Ator = {id:string;ativo:boolean;papeis:Papel[];permissoes:string[]};
type Vendedor = {id:string;nome:string;ativo:boolean;papeis:Papel[];gerenteComercialId:string|null};
const mudou=()=>new ErroRegra("O cadastro ou acesso mudou. Confira o vendedor antes de continuar.");
export async function listarVendedoresNovaConversa():Promise<Resultado<{vendedores:{id:string;nome:string}[]}>>{
 return executarAcao(async()=>{
  const sessao=await exigirSessao();
  return prisma.$transaction(async tx=>{
   const perfil=await tx.usuario.findUnique({where:{id:sessao.id},select:{ativo:true,nome:true,papeis:true,permissoes:true}});
   if(!perfil?.ativo)throw new ErroAutenticacao();
   const autor={id:sessao.id,...perfil};if(apenasPortal(autor))throw mudou();exigirPapel(autor,Papel.VENDEDOR,Papel.GERENTE_COMERCIAL);
   const admin=autor.papeis.includes(Papel.ADMINISTRADOR),ven=autor.papeis.includes(Papel.VENDEDOR),gc=autor.papeis.includes(Papel.GERENTE_COMERCIAL);
   const filtro=admin?{}:gc?{OR:[...(ven?[{id:autor.id}]:[]),{gerenteComercialId:autor.id}]}:{id:autor.id};
   const candidatos=await tx.usuario.findMany({where:{ativo:true,papeis:{has:Papel.VENDEDOR},...filtro},select:{id:true,nome:true},orderBy:[{nome:"asc"},{id:"asc"}]});
   const ids=candidatos.map(v=>v.id),onde=ids.length?Prisma.sql`v.id IN (${Prisma.join(ids)})`:Prisma.sql`FALSE`;
   const rows=await tx.$queryRaw<{foto:{autor:Ator|null;vendedores:Vendedor[]}}[]>(Prisma.sql`
    SELECT jsonb_build_object('autor',CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'ativo',u.ativo,'papeis',u.papeis,'permissoes',u.permissoes) END,
     'vendedores',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'nome',v.nome,'ativo',v.ativo,'papeis',v.papeis,'gerenteComercialId',v."gerenteComercialId") ORDER BY v.nome,v.id) FROM "Usuario" v WHERE ${onde}),'[]'::jsonb)) AS foto
     FROM (SELECT 1) base LEFT JOIN "Usuario" u ON u.id=${autor.id}
   `);
   const f=rows.length===1?rows[0].foto:null;if(!f?.autor?.ativo)throw new ErroAutenticacao();
   const conjunto=(a:readonly string[])=>JSON.stringify([...a].sort());
   if(f.autor.id!==autor.id||conjunto(f.autor.papeis)!==conjunto(autor.papeis)||conjunto(f.autor.permissoes)!==conjunto(autor.permissoes??[]))throw mudou();
   if(f.vendedores.length!==new Set(ids).size||f.vendedores.some(v=>!ids.includes(v.id)||!v.ativo||!v.papeis.includes(Papel.VENDEDOR)||(!admin&&!(ven&&v.id===autor.id)&&!(gc&&v.gerenteComercialId===autor.id))))throw mudou();
   return {vendedores:f.vendedores.map(v=>({id:v.id,nome:v.nome}))};
  });
 });
}