import { NextResponse } from "next/server";
import { pagamentoSimuladoHabilitado, processarPagamentoGateway } from "@/server/financeiro/gateway";

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
