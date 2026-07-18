import { NextResponse } from "next/server";
import { medirSaudeCanal } from "@/server/whatsapp/saude";

// SAÚDE DO CANAL (doc 30 E5 · gap A7 do doc 28): endpoint para monitor externo
// (UptimeRobot/Better Stack/cron de alerta). Mesmo modelo machine-to-machine do cron:
// segredo no header, nunca sessão. Contrato HTTP:
//   200 = canal saudável · 503 = há alerta (corpo lista os motivos) · 401 = sem segredo.
// O monitor só precisa tratar "status != 200" como incidente e mostrar o corpo.

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const saude = await medirSaudeCanal(new Date());
  return NextResponse.json(saude, { status: saude.ok ? 200 : 503 });
}
