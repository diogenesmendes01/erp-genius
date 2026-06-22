import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { contentTypePorExtensao, resolverCaminhoUpload } from "@/lib/uploads";
import { podeLerArquivo } from "@/server/uploads/autorizacao";

// Leitura AUTENTICADA + AUTORIZADA POR OBJETO de arquivos privados (comprovantes /
// contratos / documentos). Os arquivos vivem em data/uploads (fora de public/), então
// esta é a única forma de acessá-los. Além de exigir sessão, validamos se o usuário pode
// LER o agregado que referencia o arquivo (Cobranca / Documento do Lead) — sem isso,
// qualquer autenticado abriria documento de qualquer aluno/lead. Ver POST /api/upload e
// src/server/uploads/autorizacao.ts.
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
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

  // Autorização POR OBJETO: o arquivo só é servido se o usuário pode ler o agregado que
  // o referencia (papel + escopo). Acesso negado => 403 (não vazamos o conteúdo).
  const autorizado = await podeLerArquivo(
    {
      id: session.user.id,
      papeis: (session.user.papeis ?? []) as Papel[],
    },
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
      // Conteúdo sensível: nunca cachear em proxies compartilhados.
      "Cache-Control": "private, no-store",
    },
  });
}
