import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ErroRegra, numero, numeroOuNull } from "@/server/_shared";
import { baixarCobrancaTx, type ResultadoBaixa } from "./baixa";

// GATEWAY DE PAGAMENTO POR DRIVER (Fase 2, doc 03 · P1 do doc 15 segue aberta): o contrato
// é gerar um LINK para uma cobrança e conciliar o pagamento via webhook. O driver SIMULADO
// roda 100% local — página pública /pagar/[token] com botão de pagamento habilitado só com
// PAGAMENTO_SIMULADO=1 no env (dev/demo). GreenPay/PIX/Boleto/Cartão entram como drivers
// futuros NESTE contrato, sem tocar o resto do sistema.

export interface LinkGerado {
  url: string;
  gatewayRef: string;
}

export interface GatewayPagamento {
  nome: string;
  gerarLink(cobranca: { id: string; valor: number; moeda: string }): Promise<LinkGerado>;
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/** Driver SIMULADO: token opaco + página local. Nenhuma chamada externa. */
export const gatewaySimulado: GatewayPagamento = {
  nome: "simulado",
  async gerarLink() {
    const token = randomBytes(24).toString("hex");
    return { url: `${baseUrl()}/pagar/${token}`, gatewayRef: token };
  },
};

/** Driver ativo (futuro: escolhido por env GATEWAY_DRIVER quando houver GreenPay etc.). */
export function gatewayAtivo(): GatewayPagamento {
  return gatewaySimulado;
}

/** O botão "pagar" da página simulada só funciona com o flag explícito no env (dev/demo). */
export function pagamentoSimuladoHabilitado(): boolean {
  return process.env.PAGAMENTO_SIMULADO === "1";
}

export interface CobrancaPublica {
  valor: number;
  moeda: string;
  vencimentoISO: string;
  status: string;
  descricao: string;
}

/** Projeção MÍNIMA da cobrança para a página pública de pagamento (nada de dados pessoais). */
export async function cobrancaPorToken(token: string): Promise<CobrancaPublica | null> {
  if (!/^[0-9a-f]{16,64}$/.test(token)) return null;
  const cobranca = await prisma.cobranca.findUnique({
    where: { gatewayRef: token },
    include: { matricula: { include: { aluno: { select: { primeiroNome: true } } } } },
  });
  if (!cobranca) return null;
  const tipo = cobranca.tipo === "MATRICULA" ? "Taxa de matrícula" : "Mensalidade";
  return {
    valor: numeroOuNull(cobranca.saldo) ?? numero(cobranca.valorNegociado),
    moeda: cobranca.moeda,
    vencimentoISO: cobranca.vencimento.toISOString(),
    status: cobranca.status,
    descricao: `${tipo} — ${cobranca.matricula.aluno.primeiroNome}${cobranca.competencia ? ` (${cobranca.competencia})` : ""}`,
  };
}

/**
 * CONCILIAÇÃO AUTOMÁTICA: o "webhook" do gateway. Localiza a cobrança pelo `gatewayRef`
 * e dá a baixa pelo miolo compartilhado (evento `via: gateway_<driver>`; quitar a taxa
 * dispara a matrícula automática — C4). Autor = null (sistema/provedor).
 */
export async function processarPagamentoGateway(token: string): Promise<ResultadoBaixa> {
  const cobranca = await prisma.cobranca.findUnique({ where: { gatewayRef: token } });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada para este link.");
  const restante = numeroOuNull(cobranca.saldo) ?? numero(cobranca.valorNegociado);
  return prisma.$transaction((tx) =>
    baixarCobrancaTx(tx, null, cobranca.id, {
      valorRecebido: restante,
      forma: "PIX",
      comentario: `Pagamento via gateway (${gatewayAtivo().nome})`,
      via: `gateway_${gatewayAtivo().nome}`,
    }),
  );
}
