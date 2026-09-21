import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import { CategoriaDocumento, Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao, exigirPapel, ErroAutenticacao, ErroPermissao } from "@/server/_shared/sessao";
import { UPLOAD_DIR } from "@/lib/uploads";
import { validarContextoArquivo } from "@/server/uploads/autorizacao";

// Upload de comprovantes / contratos / documentos (doc 09).
// Storage PRIVADO em data/uploads (fora de public/) — os arquivos NÃO são servidos
// estaticamente. A leitura passa por GET /api/files/[...path], que valida a sessão.
// Para serverless, trocar por S3/Supabase (signed URLs).
export const runtime = "nodejs";

// Só documentos/imagens: comprovante e contrato não têm áudio/vídeo. A mídia da inbox
// WhatsApp usa a rota própria POST /api/whatsapp/upload (posse por autor — PR #51 P1-2).
const TIPOS_OK = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  let usuario;
  try {
    usuario = await exigirSessao();
    exigirPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.PROFESSOR);
  } catch (erro) {
    if (erro instanceof ErroAutenticacao) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    if (erro instanceof ErroPermissao) return NextResponse.json({ erro: "Sem permissão para enviar documentos." }, { status: 403 });
    throw erro;
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 1024 * 1024)
    return NextResponse.json({ erro: "Arquivo acima de 10MB." }, { status: 413 });

  const form = await req.formData();
  const leadId = typeof form.get("leadId") === "string" ? String(form.get("leadId")) : undefined;
  const matriculaId = typeof form.get("matriculaId") === "string" ? String(form.get("matriculaId")) : undefined;
  const categoriaTexto = form.get("categoriaDocumento");
  const categoriaDocumento = typeof categoriaTexto === "string" && Object.values(CategoriaDocumento).includes(categoriaTexto as CategoriaDocumento) ? categoriaTexto as CategoriaDocumento : undefined;
  const generico = usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL || p === Papel.SECRETARIA_ACADEMICA || p === Papel.FINANCEIRO);
  if (!generico && (!leadId || categoriaDocumento !== CategoriaDocumento.TESTE_NIVEL))
    return NextResponse.json({ erro: "Professor pode enviar somente teste de nível de sua experimental." }, { status: 403 });
  let contexto;
  if (leadId || matriculaId) {
    try { contexto = await validarContextoArquivo(usuario, { leadId, matriculaId, categoriaDocumento }); }
    catch { return NextResponse.json({ erro: "Sem permissão para enviar documento neste contexto." }, { status: 403 }); }
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Arquivo ausente." }, { status: 400 });
  }
  if (!TIPOS_OK.includes(file.type.split(";")[0].trim())) {
    return NextResponse.json({ erro: "Tipo inválido (use PDF, JPG ou PNG)." }, { status: 400 });
  }
  if (!file.size || file.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo vazio ou acima de 10MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(UPLOAD_DIR, { recursive: true });

  const mime = file.type.split(";")[0].trim();
  const extensao = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
  const nomeArquivo = `${randomUUID()}.${extensao}`;
  // Storage de runtime não é um recurso a copiar para o bundle standalone.
  const arquivo = path.join(/* turbopackIgnore: true */ UPLOAD_DIR, nomeArquivo);
  const url = `/api/files/${nomeArquivo}`;
  await writeFile(arquivo, bytes, { flag: "wx" });
  try {
    await prisma.registroUpload.create({ data: { url, autorId: usuario.id, nome: file.name, mime, tamanho: file.size, ...contexto } });
  } catch (erro) {
    await unlink(arquivo).catch(() => undefined);
    throw erro;
  }

  // URL servida pela rota autenticada — nunca um caminho público estático.
  return NextResponse.json({ url, nome: file.name });
}
