import { NextResponse } from "next/server";
import { medirSaudeCanal } from "@/server/whatsapp/saude";

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
