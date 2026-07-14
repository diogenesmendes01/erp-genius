import { NextResponse } from "next/server";
import { exigirSessao, ErroAutenticacao, exigirPapel, ErroPermissao } from "@/server/_shared/sessao";
import { PAPEIS_INBOX } from "@/server/whatsapp/escopo";
import { extensaoPorMime, salvarMidiaSaida, MAX_BYTES_MIDIA } from "@/server/whatsapp/midia";

// Upload de mídia para ENVIO pela inbox (doc 26 §Camada 3 · review PR #51 P1-2).
// Separado do /api/upload genérico (comprovantes/documentos) por dois motivos:
// 1. POSSE: grava em whatsapp-out/<usuarioId>/ — a action `enviarMidiaInbox` só aceita
//    URLs desta pasta DO PRÓPRIO autor, então nenhuma outra URL de /api/files (comprovante,
//    documento de lead) pode ser anexada e exfiltrada para um contato externo.
// 2. TIPOS: áudio/vídeo fazem sentido numa mensagem, não num comprovante.
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

  // Corpo declarado acima do teto nem vira formData (review PR #51 — validação ANTES de
  // materializar o binário; folga de 1MB para os cabeçalhos do multipart).
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES_MIDIA + 1024 * 1024) {
    return NextResponse.json({ erro: "Arquivo acima de 10MB." }, { status: 413 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Arquivo ausente." }, { status: 400 });
  }
  // MIME e tamanho validados ANTES do arrayBuffer() — arquivo grande não pressiona a
  // memória do servidor só para receber 400 no final.
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
  // salvarMidiaSaida revalida (fonte única da régua de mídia — mesma do inbound).
  const url = await salvarMidiaSaida(usuario.id, bytes, file.type);
  if (!url) {
    return NextResponse.json(
      { erro: "Tipo não suportado ou arquivo acima de 10MB (use imagem, áudio, vídeo ou PDF)." },
      { status: 400 },
    );
  }
  return NextResponse.json({ url, nome: file.name });
}
