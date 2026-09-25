import { NextResponse } from "next/server";

// LIVENESS do container (healthcheck do Coolify / Docker): sem dependências externas,
// sem segredo, sem lógica de negócio — só responde 200 se o Next está de pé.
// Não confundir com /api/whatsapp/health (saúde do CANAL WhatsApp, protegido e com alertas).

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() }, { status: 200 });
}

// HEAD também funciona (wget --spider usa HEAD).
export const HEAD = GET;
