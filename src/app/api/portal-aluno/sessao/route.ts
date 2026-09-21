import { lerJsonPortalAluno } from "@/server/portal-aluno/http";
import { NextResponse } from "next/server";
import { entrarPortalAluno } from "@/server/portal-aluno/identidade";
import { cookieSessaoPortalAluno } from "@/server/portal-aluno/sessao";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!origemPortalAlunoPermitida(request)) {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const corpo = await lerJsonPortalAluno(request);
    const resultado = await entrarPortalAluno(corpo);
    if (!resultado.autenticado) {
      return NextResponse.json({ erro: "Credenciais inválidas." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const resposta = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    resposta.cookies.set(cookieSessaoPortalAluno(resultado.sessaoCookie, resultado.expiraEm));
    return resposta;
  } catch {
    return NextResponse.json({ erro: "Não foi possível iniciar a sessão." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
