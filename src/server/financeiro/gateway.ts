import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ErroRegra, numero, numeroOuNull } from "@/server/_shared";
import { tokenPagamentoBemFormado } from "@/lib/token-pagamento";
import { baixarCobrancaTx, type ResultadoBaixa } from "./baixa";

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

export const gatewaySimulado: GatewayPagamento = {
  nome: "simulado",
  async gerarLink() {
    const token = randomBytes(24).toString("hex");
    return { url: `${baseUrl()}/pagar/${token}`, gatewayRef: token };
  },
};

export function gatewayAtivo(): GatewayPagamento {
  return gatewaySimulado;
}

export function pagamentoSimuladoHabilitado(): boolean {
  return false;
}

export interface CobrancaPublica {
  valor: number;
  moeda: string;
  vencimentoISO: string;
  status: string;
  descricao: string;
}

export async function cobrancaPorToken(token: string): Promise<CobrancaPublica | null> {
  if (!tokenPagamentoBemFormado(token)) return null;
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
