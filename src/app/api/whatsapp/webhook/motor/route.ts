import { after, NextResponse } from "next/server";
import { verificarAssinaturaMotor } from "@/server/whatsapp/motor/assinatura";
import { lerConfigMotor } from "@/server/whatsapp/motor/config";
import { EnvelopeMotorSchema } from "@/server/whatsapp/motor/eventos";
import { registrarEventoMotor } from "@/server/whatsapp/motor/receber";
import { drenarEventosMotor } from "@/server/whatsapp/motor/drenar";

// WEBHOOK DO MOTOR: confere o HMAC, grava o evento (dedupe por idEvento), responde 200 e drena depois.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let segredo: string;
  try {
    segredo = lerConfigMotor().segredoWebhook;
  } catch {
    return NextResponse.json({ erro: "Motor não configurado." }, { status: 503 });
  }
  const corpo = await req.text();
  const veredito = verificarAssinaturaMotor({
    corpo,
    timestamp: req.headers.get("x-motor-timestamp"),
    assinatura: req.headers.get("x-motor-assinatura"),
    segredo,
    agoraMs: Date.now(),
  });
  if (veredito !== "ok") return NextResponse.json({ erro: "Assinatura inválida." }, { status: 401 });

  let json: unknown;
  try {
    json = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  const env = EnvelopeMotorSchema.safeParse(json);
  if (!env.success) return NextResponse.json({ erro: "Envelope inválido." }, { status: 400 });
  if (req.headers.get("x-motor-evento") !== env.data.idEvento) {
    return NextResponse.json({ erro: "Evento divergente do cabeçalho." }, { status: 400 });
  }

  const r = await registrarEventoMotor(env.data);
  if (r === "novo") after(() => drenarEventosMotor());
  return NextResponse.json({ ok: true });
}
