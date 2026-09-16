import { NextResponse } from "next/server";
import { lerJsonPortalAluno } from "@/server/portal-aluno/http";
import { relatarIndisponibilidadeMaterialPortalAluno } from "@/server/portal-aluno/entregas-reposicao";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";

export const runtime = "nodejs";

/** O identificador da reposição vem exclusivamente da rota; a ação revalida a
 * sessão opaca e o vínculo conta → aluno → matrícula antes de persistir. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!origemPortalAlunoPermitida(request)) {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const corpo = await lerJsonPortalAluno(request);
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw new Error("Corpo inválido.");
    const { id } = await params;
    const relato = await relatarIndisponibilidadeMaterialPortalAluno({ ...corpo, reposicaoId: id });
    return NextResponse.json({ ok: true, relato }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Não revela se o identificador pertence a outra matrícula ou se há
    // material publicado; a interface pode orientar o aluno sem enumerar dados.
    return NextResponse.json({ erro: "Não foi possível registrar o relato de indisponibilidade." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
