import { NextResponse } from "next/server";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";
import { revogarSessaoPortalAlunoAtual } from "@/server/portal-aluno/sessao";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!origemPortalAlunoPermitida(request)) {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  await revogarSessaoPortalAlunoAtual();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
