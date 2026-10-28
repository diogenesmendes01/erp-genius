import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { lerFiltrosInbox } from "@/server/inbox/filtros";
import { decodificarCursor } from "@/server/inbox/cursor";
import { contarChipsInbox, listarAtendimentosPagina } from "@/server/inbox/consultas-pagina";

import { criarOperacaoListaInbox } from "@/server/inbox/contexto-lista";
import { resumoDaListaInbox } from "@/server/inbox/contagens";
import { ehVendedorExclusivo, opcoesFiltroInbox, vendedorSemWhatsAppConectado } from "@/server/inbox/opcoes-filtro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (ehVendedorExclusivo(usuario.papeis)) {
    const opcoesFiltro = await opcoesFiltroInbox(usuario);
    if (vendedorSemWhatsAppConectado(usuario.papeis, opcoesFiltro.numeros)) {
      return NextResponse.json({ itens: [], proximo: null }, { headers: { "Cache-Control": "no-store" } });
    }
  }
  const enviar = params.get("envio") === "1";
  const operacao=criarOperacaoListaInbox(usuario,{enviar});
  const pedirResumo=params.get("contagens")==="1"&&!cursor;
  const [pagina, contagens, resumo] = await Promise.all([
    listarAtendimentosPagina(usuario, filtros, cursor, undefined, { enviar,operacao }),
    pedirResumo ? contarChipsInbox(usuario, filtros, { enviar,operacao }) : Promise.resolve(undefined),
    pedirResumo ? resumoDaListaInbox(usuario,filtros,undefined,{enviar,operacao}) : Promise.resolve(undefined),
  ]);
  return NextResponse.json({ ...pagina, ...(contagens ? { contagens } : {}),...(resumo?{resumo}:{}) }, { headers: { "Cache-Control": "no-store" } });
}
