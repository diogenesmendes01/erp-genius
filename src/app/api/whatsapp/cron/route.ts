import { NextResponse } from "next/server";
import { rodarCronRegua } from "@/server/whatsapp/cron";
import {
  rodarCheckInVencido,
  rodarContratoSemAssinatura,
  rodarLeadNovoSemResposta,
  rodarLinkPagamentoSemPagamento,
  rodarNoShow,
  rodarPreExperimental,
} from "@/server/whatsapp/cron-comercial";
import { despacharFila } from "@/server/whatsapp/despachante";
import { rodarCopilotoQuietude } from "@/server/ia/copiloto";
import { rodarGestao } from "@/server/whatsapp/cron-gestao";
import { rodarFechamentoComissoes } from "@/server/financeiro/cron-financeiro";
import { rodarFechamentosPendentes } from "@/server/matricula/cron-fechamento";

// CRON DA RÉGUA (doc 26 §Camada 1 · doc 27 · doc 29 §fluxo F1). Rota machine-to-machine:
// autenticação por SEGREDO (header x-cron-secret), nunca por sessão. Agendamento externo
// chama POST — a idempotência por degrau torna chamadas repetidas inofensivas.
// CADÊNCIA (B4, doc 32): as réguas COMERCIAIS têm degraus de "+30min" — tick a cada
// 5–10 min (o serviço `cron` do docker-compose.prod.yml bate a cada 5). Um tick horário
// transformaria "+30min" em quase "+90min" e estouraria a tolerância dos degraus (B3).
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
  // Cenários comerciais: só ENFILEIRAM (um enfileirador isolado por cadência)...
  const leadNovo = await seguro("comercial_lead_novo", () => rodarLeadNovoSemResposta(agora));
  const preExperimental = await seguro("comercial_pre_experimental", () => rodarPreExperimental(agora));
  const noShow = await seguro("comercial_no_show", () => rodarNoShow(agora));
  // C4 (doc 27 §fechamento): contrato parado e link de pagamento parado.
  const contrato = await seguro("comercial_contrato", () => rodarContratoSemAssinatura(agora));
  const linkPagamento = await seguro("comercial_link_pagamento", () => rodarLinkPagamentoSemPagamento(agora));
  // B9 (doc 32): alerta de check-in vencido — roda no mesmo tick, independe de política.
  const checkInVencido = await seguro("comercial_checkin_vencido", () => rodarCheckInVencido(agora));
  // C3 (doc 27): gatilho de QUIETUDE do copiloto (~10min sem resposta ao último inbound).
  const copiloto = await seguro("copiloto_quietude", () => rodarCopilotoQuietude(agora));
  // C5 (doc 27): gestão — alerta de SLA + relatório diário do gestor.
  const gestao = await seguro("gestao", () => rodarGestao(agora));
  // Fase 2 (doc 03): fechamento mensal automático de comissões (1x por mês, se ligado).
  const comissoes = await seguro("fechamento_comissoes", () => rodarFechamentoComissoes(agora));
  // C4 backfill (review PR #60): matrículas que ficaram completas com a automação
  // desligada ativam no primeiro tick após ligar (idempotente).
  const fechamentosPendentes = await seguro("fechamentos_pendentes", () => rodarFechamentosPendentes());
  // ...então uma passada do despachante drena o que eles enfileiraram (idempotente).
  const despacho = await seguro("despacho", () => despacharFila(agora));

  return NextResponse.json({
    cobranca,
    comercial: { leadNovo, preExperimental, noShow, contrato, linkPagamento, checkInVencido },
    copiloto,
    gestao,
    comissoes,
    fechamentosPendentes,
    despacho,
  });
}
