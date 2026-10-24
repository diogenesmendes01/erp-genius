import { NextResponse } from "next/server";
import { exigirSessao, exigirPapel, ErroAutenticacao, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { listarCandidatosMencao } from "@/server/inbox/consultas-mencoes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Somente candidatos de uma nota visível; resposta nunca contém cadastro completo. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let u;
  try { u = await exigirSessao(); exigirPapel(u, ...PAPEIS_INBOX); }
  catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403 });
    throw e;
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 60) return NextResponse.json({ erro: "Busque de 2 a 60 caracteres." }, { status: 400 });
  const { id } = await params;
  const candidatos = await listarCandidatosMencao(u, id, q);
  if (!candidatos) return NextResponse.json({ erro: "Atendimento não encontrado." }, { status: 404 });
  return NextResponse.json(candidatos, { headers: { "Cache-Control": "no-store" } });
}
