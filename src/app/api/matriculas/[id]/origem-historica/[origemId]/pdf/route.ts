import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { carregarArquivoOrigemHistorica } from "@/server/contratos/origem-historica-tx";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; origemId: string }> }) {
  const privado = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const { id, origemId } = await params;
    const a = await carregarArquivoOrigemHistorica({ matriculaId: id, origemId });
    if (!a) return NextResponse.json({ erro: "Origem histórica indisponível nesta matrícula." }, { status: 404, headers: privado });
    return new NextResponse(new Uint8Array(a.bytes), { headers: { ...privado, "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-origem-historica-${a.id.replace(/[^a-zA-Z0-9_-]/g, "")}.pdf"`, "Content-Security-Policy": "frame-ancestors 'self'" } });
  } catch (e) {
    const status = e instanceof ErroAutenticacao ? 401 : e instanceof ErroPermissao ? 403 : e instanceof ZodError ? 400 : e instanceof ErroRegra ? 422 : 500;
    return NextResponse.json({ erro: status === 422 ? (e as Error).message : "Não foi possível abrir o PDF." }, { status, headers: privado });
  }
}
