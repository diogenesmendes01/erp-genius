import { NextResponse } from "next/server";
import { z } from "zod";
import { exigirSessao,exigirPapel,ErroAutenticacao,ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { lerInsightAutorizado } from "@/server/aria/insights/leitura";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const Id=z.string().min(1).max(100);
const json=(dado:unknown,status=200)=>NextResponse.json(dado,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const usuario=await exigirSessao();exigirPapel(usuario,...PAPEIS_INBOX);
    const {id}=await params,url=new URL(req.url),entradas=[...url.searchParams.entries()];
    if(!Id.safeParse(id).success||entradas.some(([k])=>k!=="geracaoId")||entradas.length>1)return json({erro:"Consulta inválida."},400);
    const geracaoId=url.searchParams.get("geracaoId")??undefined;
    if(geracaoId!==undefined&&!Id.safeParse(geracaoId).success)return json({erro:"Consulta inválida."},400);
    const dado=await lerInsightAutorizado(usuario.id,id,{geracaoId});
    return dado?json(dado):json({erro:"Atendimento não encontrado."},404);
  } catch(e) {
    if(e instanceof ErroAutenticacao)return json({erro:"Não autenticado."},401);
    if(e instanceof ErroPermissao)return json({erro:"Sem acesso à inbox."},403);
    console.error("Não foi possível carregar Insights.");
    return json({erro:"Não foi possível carregar os Insights. Tente novamente."},503);
  }
}
