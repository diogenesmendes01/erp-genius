import { NextResponse } from "next/server";
import { lerJsonPortalAluno } from "@/server/portal-aluno/http";
import { registrarEntregaReposicaoPortalAluno } from "@/server/portal-aluno/entregas-reposicao";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!origemPortalAlunoPermitida(request)) {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const corpo = await lerJsonPortalAluno(request);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new Error("Corpo inválido.");
    const { id } = await params;
    const entrega = await registrarEntregaReposicaoPortalAluno({ ...corpo, reposicaoId: id });
    return NextResponse.json({ ok: true, entrega }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ erro: "A entrega não está disponível para registro." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
