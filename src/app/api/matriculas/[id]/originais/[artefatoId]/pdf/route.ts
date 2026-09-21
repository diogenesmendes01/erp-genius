import { NextResponse } from "next/server";
import { consultarPdfOriginal } from "@/server/contratos/originais";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; artefatoId: string }> }) {
  const privado = { "Cache-Control": "private, no-store" };
  try {
    const { id, artefatoId } = await params;
    const a = await consultarPdfOriginal({ matriculaId: id, artefatoId });
    if (!a) return NextResponse.json({ erro: "Original indisponível." }, { status: 404, headers: privado });
    return new NextResponse(new Uint8Array(a.pdf), { headers: { ...privado, "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-${a.id.replace(/[^a-zA-Z0-9_-]/g, "")}.pdf"`,
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "frame-ancestors 'self'" } });
  } catch (e) {
    const status = e instanceof ErroAutenticacao ? 401 : e instanceof ErroPermissao ? 403 : e instanceof ErroRegra ? 422 : 500;
    return NextResponse.json({ erro: status === 422 ? (e as Error).message : "Não foi possível abrir o original." }, { status, headers: privado });
  }
}
