import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { carregarArquivoConclusaoAditivo } from "@/server/contratos/aditivo-conclusao-arquivo";
import { ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; propostaId: string; conclusaoId: string; tipo: string }> }) {
  const privado = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try { const { id, propostaId, conclusaoId, tipo } = await params, a = await carregarArquivoConclusaoAditivo({ matriculaId: id, propostaId, conclusaoId, tipo });
    if (!a) return NextResponse.json({ erro: "Evidência indisponível nesta matrícula e proposta." }, { status: 404, headers: privado });
    return new NextResponse(new Uint8Array(a.bytes), { headers: { ...privado, "Content-Type": a.contentType, "Content-Security-Policy": "frame-ancestors 'self'", "Content-Disposition": `${a.inline ? "inline" : "attachment"}; filename="aditivo-assinado-${a.id.replace(/[^a-zA-Z0-9_-]/g, "")}.${a.extensao}"` } });
  } catch (e) { const status = e instanceof ErroAutenticacao ? 401 : e instanceof ErroPermissao ? 403 : e instanceof ZodError ? 400 : e instanceof ErroRegra ? 422 : 500; return NextResponse.json({ erro: status === 422 ? (e as Error).message : "Não foi possível abrir a evidência." }, { status, headers: privado }); }
}
