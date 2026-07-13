import { NextResponse } from "next/server";
import { rodarCronRegua } from "@/server/whatsapp/cron";

// CRON DA RÉGUA (doc 26 §Camada 1 · doc 29 §fluxo F1). Primeira rota machine-to-machine do
// sistema: autenticação por SEGREDO (header x-cron-secret), nunca por sessão. Agendamento
// externo (systemd timer / cron do VPS / uptime service) chama POST 1x+/dia — a
// idempotência por degrau torna chamadas repetidas inofensivas.

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const resultado = await rodarCronRegua(new Date());
  return NextResponse.json(resultado);
}
