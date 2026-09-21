import { lerJsonPortalAluno } from "@/server/portal-aluno/http";
import { NextResponse } from "next/server";
import { solicitarRecuperacaoPortalAluno } from "@/server/portal-aluno/identidade";
import { origemPortalAlunoPermitida } from "@/server/portal-aluno/politica";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!origemPortalAlunoPermitida(request)) {
    return NextResponse.json({ erro: "Origem não permitida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await solicitarRecuperacaoPortalAluno(await lerJsonPortalAluno(request));
  } catch {
    // A resposta é deliberadamente a mesma para entrada inválida, ausente ou bloqueada.
  }
  return NextResponse.json({ ok: true, situacao: "PENDENTE_ENVIO" }, { headers: { "Cache-Control": "no-store" } });
}
