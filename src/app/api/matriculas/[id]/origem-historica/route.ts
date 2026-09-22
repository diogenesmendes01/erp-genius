import { NextResponse } from "next/server";
import { Papel } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, ErroAutenticacao, ErroPermissao, ErroRegra } from "@/server/_shared";
import { registrarOrigemContratualHistoricaTx } from "@/server/contratos/origem-historica-tx";

// Registro da origem contratual histórica: PDF assinado (multipart) + transcrição (JSON no mesmo formulário).
// Sem Server Action porque os bytes do PDF são preservados no banco e conferidos por hash.
export const runtime = "nodejs";
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const privado = { "Cache-Control": "private, no-store" };
  try {
    const usuario = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const { id } = await params;
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 1024 * 1024) return NextResponse.json({ erro: "PDF acima de 20 MiB." }, { status: 413, headers: privado });
    const form = await request.formData();
    const arquivo = form.get("pdfAssinado");
    if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Envie o PDF assinado." }, { status: 400, headers: privado });
    const pdfAssinado = Buffer.from(await arquivo.arrayBuffer());
    let transcricao: unknown;
    try { transcricao = JSON.parse(String(form.get("transcricao") ?? "")); } catch { return NextResponse.json({ erro: "Transcrição inválida." }, { status: 400, headers: privado }); }
    const r = await prisma.$transaction(tx => registrarOrigemContratualHistoricaTx(tx, usuario.id, {
      matriculaId: id, referencia: String(form.get("referencia") ?? ""), assinadoEm: String(form.get("assinadoEm") ?? ""), pdfAssinado, transcricao,
      motivo: String(form.get("motivo") ?? ""), chaveIdempotencia: String(form.get("chaveIdempotencia") ?? ""),
    }), { timeout: 30000 });
    return NextResponse.json({ ok: true, dado: r }, { headers: privado });
  } catch (e) {
    const status = e instanceof ErroAutenticacao ? 401 : e instanceof ErroPermissao ? 403 : e instanceof ZodError ? 400 : e instanceof ErroRegra ? 422 : 500;
    const erro = e instanceof ZodError ? e.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") : status === 422 ? (e as Error).message : "Não foi possível registrar a origem histórica.";
    return NextResponse.json({ ok: false, erro }, { status, headers: privado });
  }
}
