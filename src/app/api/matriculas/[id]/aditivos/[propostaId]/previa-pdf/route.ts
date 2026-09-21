import { NextResponse } from "next/server";
import { carregarPdfPreviaAditivo } from "@/server/contratos/aditivo-arquivo";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; propostaId: string }> }) {
  const privado = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const { id, propostaId } = await params;
    const pdf = await carregarPdfPreviaAditivo({ matriculaId: id, propostaId });
    if (!pdf) return NextResponse.json({ erro: "Prévia indisponível nesta matrícula." }, { status: 404, headers: privado });
    return new NextResponse(new Uint8Array(pdf.bytes), { headers: { ...privado, "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="previa-aditivo-${pdf.id.replace(/[^a-zA-Z0-9_-]/g, "")}.pdf"`,
      "Content-Security-Policy": "frame-ancestors 'self'" } });
  } catch (e) {
    const status = e instanceof ErroAutenticacao ? 401 : e instanceof ErroPermissao ? 403 : e instanceof ErroRegra ? 422 : 500;
    return NextResponse.json({ erro: status === 422 ? (e as Error).message : "Não foi possível abrir a prévia." }, { status, headers: privado });
  }
}
