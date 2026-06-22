import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";

// Upload de arquivos (comprovantes / documentos do lead — doc 09).
// Storage local em public/uploads (dev / hosting Node). Para serverless, trocar por S3/Supabase.
export const runtime = "nodejs";

const TIPOS_OK = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "Arquivo ausente." }, { status: 400 });
  }
  if (!TIPOS_OK.includes(file.type)) {
    return NextResponse.json({ erro: "Tipo inválido (use PDF, JPG ou PNG)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ erro: "Arquivo acima de 10MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const nomeArquivo = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;
  await writeFile(path.join(dir, nomeArquivo), bytes);

  return NextResponse.json({ url: `/uploads/${nomeArquivo}`, nome: file.name });
}
