import { NextResponse } from "next/server";
import { z } from "zod";
import { processarEnviosPortalAluno } from "@/server/portal-aluno/processar-envios";

export const runtime = "nodejs";
const Entrada = z.object({ cursor: z.string().trim().min(1).max(100).optional() });

export async function POST(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "Agendamento não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  if (process.env.EMAIL_PORTAL_ENVIO_ENABLED !== "true") {
    return NextResponse.json({ executou: false, motivo: "envio_desligado" });
  }
  const dados = Entrada.safeParse({ cursor: new URL(req.url).searchParams.get("cursor") ?? undefined });
  if (!dados.success) return NextResponse.json({ erro: "Cursor inválido." }, { status: 400 });
  try {
    return NextResponse.json(await processarEnviosPortalAluno(dados.data));
  } catch {
    // Não expor destinatários, configuração ou respostas do provedor.
    // Claims já iniciadas continuam INCERTO e não são repetidas pelo worker.
    return NextResponse.json({ erro: "Processamento não concluído. Confira a fila operacional." }, { status: 503 });
  }
}
