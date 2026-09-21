import { lerJsonPortalAluno } from "@/server/portal-aluno/http";
import { NextResponse } from "next/server";
import { consumirTokenPortalAluno } from "@/server/portal-aluno/identidade";
import { cookieSessaoPortalAluno } from "@/server/portal-aluno/sessao";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!origemPortalAlunoPermitida(request)) {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const resultado = await consumirTokenPortalAluno(await lerJsonPortalAluno(request));
    if (resultado.tipo === "EMAIL_VALIDADO") {
      return NextResponse.json({ ok: true, situacao: resultado.tipo }, { headers: { "Cache-Control": "no-store" } });
    }
    const resposta = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    resposta.cookies.set(cookieSessaoPortalAluno(resultado.sessaoCookie, resultado.expiraEm));
    return resposta;
  } catch {
    return NextResponse.json({ erro: "Este link não está disponível." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
