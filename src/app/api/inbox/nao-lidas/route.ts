import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { contarConversasNaoLidas } from "@/server/inbox/nao-lidas";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  let usuario;
  try { usuario = await exigirSessao(); exigirPapel(usuario, ...PAPEIS_INBOX); }
  catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    throw e;
  }
  return NextResponse.json({ total: await contarConversasNaoLidas(usuario) }, { headers: { "Cache-Control": "no-store" } });
}
