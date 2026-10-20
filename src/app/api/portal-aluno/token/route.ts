import { lerJsonPortalAluno } from "@/server/portal-aluno/http";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
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
  } catch (e) {
    // Senha fora das regras (#172): o schema recusa antes de tocar no token, então o link continua valendo.
    // Só o campo é informado; token malformado, link vencido e corpo ilegível ficam no 422 genérico.
    if (e instanceof ZodError && e.issues.length > 0 && e.issues.every((i) => i.path[0] === "senha")) {
      return NextResponse.json({ erro: "Senha fora das regras.", campo: "senha" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ erro: "Este link não está disponível." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
