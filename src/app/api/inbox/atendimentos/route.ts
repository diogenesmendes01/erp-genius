import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { lerFiltrosInbox } from "@/server/inbox/filtros";
import { decodificarCursor } from "@/server/inbox/cursor";
import { contarChipsInbox, listarAtendimentosPagina } from "@/server/inbox/consultas-pagina";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista paginada por cursor (E6). O escopo é aplicado na consulta; filtros só restringem.
export async function GET(req: Request) {
  let usuario;
  try {
    usuario = await exigirSessao();
    exigirPapel(usuario, ...PAPEIS_INBOX);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403 });
    throw e;
  }
  const params = new URL(req.url).searchParams;
  const filtros = lerFiltrosInbox(Object.fromEntries(params));
  const bruto = params.get("cursor");
  const cursor = bruto && decodificarCursor(bruto) ? bruto : null;
  if (bruto && !cursor) return NextResponse.json({ erro: "Cursor inválido." }, { status: 400 });
  // `envio=1`: só os atendimentos em que o usuário pode enviar (destino do encaminhar).
  const enviar = params.get("envio") === "1";
  const [pagina, contagens] = await Promise.all([
    listarAtendimentosPagina(usuario, filtros, cursor, undefined, { enviar }),
    params.get("contagens") === "1" && !cursor ? contarChipsInbox(usuario, filtros, { enviar }) : Promise.resolve(undefined),
  ]);
  return NextResponse.json({ ...pagina, ...(contagens ? { contagens } : {}) }, { headers: { "Cache-Control": "no-store" } });
}
