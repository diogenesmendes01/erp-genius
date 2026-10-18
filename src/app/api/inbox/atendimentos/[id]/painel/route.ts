import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { carregarPainel } from "@/server/inbox/paineis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Painel lateral por setor (Tarefa 32). Só leitura; 404 fora do escopo (não revela se o atendimento existe).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const painel = await carregarPainel(usuario, id);
  if (!painel) return NextResponse.json({ erro: "Atendimento não encontrado." }, { status: 404 });
  return NextResponse.json(painel, { headers: { "Cache-Control": "no-store" } });
}
