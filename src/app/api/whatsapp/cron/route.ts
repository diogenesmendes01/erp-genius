import { NextResponse } from "next/server";
import { rodarCronRegua } from "@/server/whatsapp/cron";
import { rodarLeadNovoSemResposta } from "@/server/whatsapp/cron-comercial";
import { despacharFila } from "@/server/whatsapp/despachante";

// CRON DA RÉGUA (doc 26 §Camada 1 · doc 27 · doc 29 §fluxo F1). Rota machine-to-machine:
// autenticação por SEGREDO (header x-cron-secret), nunca por sessão. Agendamento externo
// chama POST 1x+/hora — a idempotência por degrau torna chamadas repetidas inofensivas.
//
// UM tick, N enfileiradores ISOLADOS (decisão de arquitetura — doc 27 §Tese): cada cenário
// (cobrança, lead-novo, e amanhã no-show/proposta) grava intenções na FILA ÚNICA; o
// despachante compartilhado envia/simula. Uma falha num enfileirador não derruba os outros.

export const runtime = "nodejs";

async function seguro<T>(rotulo: string, fn: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[cron ${rotulo}] falhou:`, e);
    return { erro: e instanceof Error ? e.message : "erro inesperado" };
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("x-cron-secret") !== segredo) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const agora = new Date();
  // Cobrança: enfileira + drena (o rodarCronRegua já chama o despachante no fim).
  const cobranca = await seguro("cobranca", () => rodarCronRegua(agora));
  // Comercial lead-novo: só ENFILEIRA...
  const comercial = await seguro("comercial_lead_novo", () => rodarLeadNovoSemResposta(agora));
  // ...então uma passada do despachante drena o que o comercial enfileirou (idempotente).
  const despacho = await seguro("despacho", () => despacharFila(agora));

  return NextResponse.json({ cobranca, comercial, despacho });
}
