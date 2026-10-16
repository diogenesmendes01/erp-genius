import { rodarReconciliacaoAcessoVencimento } from "@/server/contratos/vencimento-acesso";
import { iniciarTurmasDaAgenda } from "@/server/agenda/inicio-turmas";
import { rodarVencimentoParticulares } from "@/server/matricula/reserva-particular-cron";
import { NextResponse } from "next/server";
import { rodarCronRegua } from "@/server/whatsapp/cron";
import { despacharFila } from "@/server/whatsapp/despachante";
import { adotarMensagensOrfasDaLinha } from "@/server/whatsapp/linha-comercial";
import { rodarControleAcessoAulas } from "@/server/cobrancas/acesso-aulas";
import { rodarFechamentoComissoes } from "@/server/financeiro/cron-financeiro";
import { rodarFechamentosPendentes } from "@/server/matricula/cron-fechamento";

// CRON DA RÉGUA (doc 26 §Camada 1 · doc 27 · doc 29 §fluxo F1). Rota machine-to-machine:
// autenticação por SEGREDO (header x-cron-secret), nunca por sessão. Agendamento externo
// chama POST — a idempotência por degrau torna chamadas repetidas inofensivas.
// CADÊNCIA: tick a cada 5 min (serviço `cron` do compose).
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
  // Controle acadêmico executa mesmo com WhatsApp desligado, sem gerar mensagens.
  const reservasParticulares = await seguro("reservas_particulares", () => rodarVencimentoParticulares());
  const inicioTurmas = await seguro("inicio_turmas", () => iniciarTurmasDaAgenda(agora));
  const acessoVencimentos = await seguro("acesso_vencimentos", () => rodarReconciliacaoAcessoVencimento());
  const acessoAulas = await seguro("acesso_aulas", () => rodarControleAcessoAulas(agora));
  // Cobrança: enfileira + drena (o rodarCronRegua já chama o despachante no fim).
  const cobranca = await seguro("cobranca", () => rodarCronRegua(agora));
  // Fase 2 (doc 03): fechamento mensal automático de comissões (1x por mês, se ligado).
  const comissoes = await seguro("fechamento_comissoes", () => rodarFechamentoComissoes(agora));
  // C4 backfill (review PR #60): matrículas que ficaram completas com a automação
  // desligada ativam no primeiro tick após ligar (idempotente).
  const fechamentosPendentes = await seguro("fechamentos_pendentes", () => rodarFechamentosPendentes());
  // SPEC-ERP-005 (LC-15): mensagens de linha comercial paradas na triagem vão para o atendimento
  // da linha — backfill idempotente e em lote, sem migração de dados.
  const linhaComercial = await seguro("linha_comercial_orfas", () => adotarMensagensOrfasDaLinha());
  // ...então uma passada do despachante drena o que eles enfileiraram (idempotente).
  const despacho = await seguro("despacho", () => despacharFila(agora));

  return NextResponse.json({
    reservasParticulares,
    inicioTurmas,
    acessoVencimentos,
    acessoAulas,
    cobranca,
    comissoes,
    fechamentosPendentes,
    linhaComercial,
    despacho,
  });
}
