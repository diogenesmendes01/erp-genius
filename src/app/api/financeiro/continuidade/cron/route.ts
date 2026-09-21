import { NextResponse } from "next/server";
import { rodarEmissaoMensalContinuidade } from "@/server/matricula/continuidade-emissao-cron";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  if (process.env.CONTINUIDADE_MENSAL_EMISSAO_ENABLED !== "true") return NextResponse.json({ executou: false, motivo: "emissao_desligada" }, { status: 200 });
  return NextResponse.json(await rodarEmissaoMensalContinuidade());
}
