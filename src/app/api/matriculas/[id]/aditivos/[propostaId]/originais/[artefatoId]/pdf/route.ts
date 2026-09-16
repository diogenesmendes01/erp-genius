import { NextResponse } from "next/server";
import { carregarOriginalAditivo } from "@/server/contratos/aditivo-original-arquivo";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; propostaId: string; artefatoId: string }> }) {
  const privado = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const { id, propostaId, artefatoId } = await params;
    const arquivo = await carregarOriginalAditivo({ matriculaId: id, propostaId, artefatoId });
    if (!arquivo) return NextResponse.json({ erro: "Original indisponível nesta matrícula e proposta." }, { status: 404, headers: privado });
    return new NextResponse(new Uint8Array(arquivo.pdf), { headers: { ...privado, "Content-Type": "application/pdf", "Content-Security-Policy": "frame-ancestors 'self'",
      "Content-Disposition": `inline; filename="original-aditivo-${arquivo.id.replace(/[^a-zA-Z0-9_-]/g, "")}.pdf"` } });
  } catch (e) {
    const status = e instanceof ErroAutenticacao ? 401 : e instanceof ErroPermissao ? 403 : e instanceof ErroRegra ? 422 : 500;
    return NextResponse.json({ erro: status === 422 ? (e as Error).message : "Não foi possível abrir o original do aditivo." }, { status, headers: privado });
  }
}
