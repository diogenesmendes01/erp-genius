import { NextResponse } from "next/server";
import { entregarAvisoAlteracaoAgenda, processarAvisosAlteracaoAgenda } from "@/server/comunicacoes-agenda/avisos";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "Agendamento não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  if (process.env.COMUNICACOES_AGENDA_ENVIO_ENABLED !== "true") return NextResponse.json({ executou: false, motivo: "envio_desligado" });
  try { return NextResponse.json({ executou: true, processados: await processarAvisosAlteracaoAgenda(entregarAvisoAlteracaoAgenda) }); }
  catch { return NextResponse.json({ erro: "Processamento não concluído. Confira a fila operacional." }, { status: 503 }); }
}
