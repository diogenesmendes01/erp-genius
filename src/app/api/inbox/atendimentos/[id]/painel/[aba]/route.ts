import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { carregarAbaPainel, type AbaDados } from "@/server/inbox/painel-abas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ABAS: readonly AbaDados[] = ["detalhes", "oportunidades", "atividade"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; aba: string }> }) {
  let usuario;
  try {
    usuario = await exigirSessao();
    exigirPapel(usuario, ...PAPEIS_INBOX);
  } catch (e) {
    if (e instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403 });
    throw e;
  }
  const { id, aba } = await params;
  const valida = ABAS.find(a => a === aba);
  if (!valida) return NextResponse.json({ erro: "Aba inválida." }, { status: 400 });
  const painel = await carregarAbaPainel(usuario, id, valida);
  if (!painel) return NextResponse.json({ erro: "Atendimento não encontrado." }, { status: 404 });
  return NextResponse.json(painel, { headers: { "Cache-Control": "no-store" } });
}
