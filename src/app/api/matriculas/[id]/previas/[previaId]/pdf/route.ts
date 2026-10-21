import { NextResponse } from "next/server";
import { Papel } from "@prisma/client";
import { exigirSessaoComPapel, ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared";
import { consultarPreviaContratual } from "@/server/contratos/previas";
import { TextoPreviaSchema } from "@/server/contratos/previa-projecao";
import { gerarPdfPrevia } from "@/server/contratos/pdf-previa";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; previaId: string }> }) {
  try {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const { id, previaId } = await params, r = await consultarPreviaContratual(previaId);
    if (!r.ok || !r.dado || r.dado.matriculaId !== id) return NextResponse.json({ erro: "Prévia indisponível." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    const p = r.dado, snapshot = TextoPreviaSchema.safeParse(p.snapshot);
    if (!snapshot.success) throw new ErroRegra("A estrutura da prévia precisa de conferência.");
    const pdf = await gerarPdfPrevia({ previaId, criadaEm: p.criadaEm, conteudoHash: p.conteudoHash, snapshot: snapshot.data });
    return new NextResponse(new Uint8Array(pdf.bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="previa-${previaId}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "frame-ancestors 'self'" } });
  } catch (e) {
    const status = e instanceof ErroAutenticacao ? 401 : e instanceof ErroPermissao ? 403 : e instanceof ErroRegra ? 422 : 500;
    return NextResponse.json({ erro: status === 422 ? (e as Error).message : "Não foi possível disponibilizar a prévia." }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
