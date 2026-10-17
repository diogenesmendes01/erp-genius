import { after, NextResponse } from "next/server";
import { verificarAssinaturaMotor } from "@/server/whatsapp/motor/assinatura";
import { lerConfigMotor } from "@/server/whatsapp/motor/config";
import { EnvelopeMotorSchema } from "@/server/whatsapp/motor/eventos";
import { registrarEventoMotor } from "@/server/whatsapp/motor/receber";
import { drenarEventosMotor } from "@/server/whatsapp/motor/drenar";

// WEBHOOK DO MOTOR: confere o HMAC, grava o evento (dedupe por idEvento), responde 200 e drena depois.
export const runtime = "nodejs";

/**
 * Teto do corpo (R1 do #215, C3): a rota é pública e o HMAC só é conferido depois de ler o corpo.
 * O maior evento do contrato (MODO-SERVICO.md §Eventos) é `mensagem.recebida` com texto longo
 * (~65 mil caracteres, até ~260 KB em UTF-8) ou `sessao.qr` (data URL PNG, dezenas de KB); a mídia
 * nunca vem no corpo. 1 MB dá folga de ~4x.
 */
export const TETO_CORPO_WEBHOOK_MOTOR = 1024 * 1024;

const corpoGrande = () => NextResponse.json({ erro: "Corpo acima do limite." }, { status: 413 });

/** Lê o corpo até o teto; acima dele cancela a leitura e devolve null. */
async function lerCorpoLimitado(req: Request, teto: number): Promise<string | null> {
  if (!req.body) return "";
  const leitor = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > teto) {
      await leitor.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes).toString("utf8");
}

export async function POST(req: Request) {
  let segredo: string;
  try {
    segredo = lerConfigMotor().segredoWebhook;
  } catch {
    return NextResponse.json({ erro: "Motor não configurado." }, { status: 503 });
  }
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > TETO_CORPO_WEBHOOK_MOTOR) return corpoGrande();
  const corpo = await lerCorpoLimitado(req, TETO_CORPO_WEBHOOK_MOTOR);
  if (corpo === null) return corpoGrande();
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
