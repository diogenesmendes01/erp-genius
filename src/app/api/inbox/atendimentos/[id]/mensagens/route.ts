import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { decodificarCursor } from "@/server/inbox/cursor";
import { listarMensagensPagina } from "@/server/inbox/consultas-pagina";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Thread paginada por cursor (E6): ?antes= (mais antigas) ou ?depois= (mais novas). 404 fora do escopo.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let usuario;
  try {
    usuario = await exigirSessao();
    exigirPapel(usuario, ...PAPEIS_INBOX);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403 });
    throw e;
  }
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const antes = q.get("antes") ?? undefined, depois = q.get("depois") ?? undefined;
  if ((antes && !decodificarCursor(antes)) || (depois && !decodificarCursor(depois))) return NextResponse.json({ erro: "Cursor inválido." }, { status: 400 });
  const limiteBruto = Number(q.get("limite"));
  const r = await listarMensagensPagina(usuario, id, { antes, depois, limite: Number.isFinite(limiteBruto) && limiteBruto > 0 ? limiteBruto : undefined });
  if (!r) return NextResponse.json({ erro: "Atendimento não encontrado." }, { status: 404 });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
