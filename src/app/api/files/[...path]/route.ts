import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { exigirSessao, ErroAutenticacao } from "@/server/_shared/sessao";
import { contentTypePorExtensao, resolverCaminhoUpload } from "@/lib/uploads";
import { podeLerArquivo } from "@/server/uploads/autorizacao";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  let usuario;
  try {
    usuario = await exigirSessao();
  } catch (e) {
    if (e instanceof ErroAutenticacao) {
      return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    }
    throw e;
  }

  const { path: segmentos } = await params;
  const caminho = resolverCaminhoUpload(segmentos ?? []);
  if (!caminho) {
    return NextResponse.json({ erro: "Caminho inválido." }, { status: 400 });
  }

  const contentType = contentTypePorExtensao(caminho);
  if (!contentType) {
    return NextResponse.json({ erro: "Tipo não permitido." }, { status: 400 });
  }

  const autorizado = await podeLerArquivo(
    { id: usuario.id, papeis: usuario.papeis },
    segmentos ?? [],
  );
  if (!autorizado) {
    return NextResponse.json({ erro: "Acesso negado." }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(caminho);
  } catch {
    return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${path.basename(caminho)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
