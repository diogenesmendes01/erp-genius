import { NextResponse } from "next/server";
import { pagamentoSimuladoHabilitado, processarPagamentoGateway } from "@/server/financeiro/gateway";

// "WEBHOOK" do gateway SIMULADO (Fase 2): a página pública /pagar/[token] posta aqui.
// Só existe com PAGAMENTO_SIMULADO=1 no env (dev/demo) — em produção, o driver real
// (GreenPay/PIX) terá o próprio webhook autenticado por assinatura do provedor.
// O TOKEN é o segredo (opaco, único por cobrança) — mesma semântica de um link de
// pagamento real: quem tem o link paga aquela cobrança, e nada além dela.

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  if (!pagamentoSimuladoHabilitado()) {
    return NextResponse.json({ erro: "Pagamento simulado desabilitado." }, { status: 404 });
  }
  const corpo = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = corpo?.token;
  if (!token || !/^[0-9a-f]{16,64}$/.test(token)) {
    return NextResponse.json({ erro: "Token inválido." }, { status: 400 });
  }
  try {
    const r = await processarPagamentoGateway(token);
    return NextResponse.json({ ok: true, quitada: r.quitada, matriculaAtivada: r.matriculaAtivada });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Erro." }, { status: 400 });
  }
}
