import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { extensaoPorMime, salvarMidiaSaida, MAX_BYTES_MIDIA } from "@/server/whatsapp/midia";
import { atendimentoVisivel } from "@/server/whatsapp/atendimentos";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let usuario;
  try {
    usuario = await exigirSessao();
    exigirPapel(usuario, ...PAPEIS_INBOX);
  } catch (e) {
    if (e instanceof ErroAutenticacao) {
      return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    }
    if (e instanceof ErroPermissao) {
      return NextResponse.json({ erro: "Sem acesso à inbox." }, { status: 403 });
    }
    throw e;
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES_MIDIA + 1024 * 1024) {
    return NextResponse.json({ erro: "Arquivo acima de 10MB." }, { status: 413 });
  }

  const form = await req.formData();
  const atendimentoId = form.get("atendimentoId");
  if (typeof atendimentoId !== "string" || !await atendimentoVisivel(usuario, atendimentoId, true)) {
    return NextResponse.json({ erro: "Atendimento fora do seu escopo de envio." }, { status: 403 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Arquivo ausente." }, { status: 400 });
  }
  if (!extensaoPorMime(file.type)) {
    return NextResponse.json(
      { erro: "Tipo não suportado (use imagem, áudio, vídeo ou PDF)." },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES_MIDIA) {
    return NextResponse.json({ erro: "Arquivo vazio ou acima de 10MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await salvarMidiaSaida(usuario.id, bytes, file.type);
  if (!url) {
    return NextResponse.json(
      { erro: "Tipo não suportado ou arquivo acima de 10MB (use imagem, áudio, vídeo ou PDF)." },
      { status: 400 },
    );
  }
  return NextResponse.json({ url, nome: file.name });
}
