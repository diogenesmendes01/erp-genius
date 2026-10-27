import { NextResponse } from "next/server";
import { despacharFila } from "@/server/whatsapp/despachante";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  const despacho = await despacharFila(new Date());
  return NextResponse.json({ despacho });
}
