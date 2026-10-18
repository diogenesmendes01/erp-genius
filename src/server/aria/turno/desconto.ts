import type { Prisma } from "@prisma/client";
import { TipoAprovacao, Vigencia } from "@prisma/client";
import { registrarEvento } from "@/server/_shared/evento";
import { payloadDaAria } from "../ator";
import type { ConfigAria } from "../config-schema";

export type TipoCobrancaDesconto = "MATRICULA" | "MENSALIDADE";
export type FaixaDesconto = "SEM_APROVACAO" | "COM_APROVACAO" | "HANDOFF";

/** Faixas de desconto da política: até o limite sem aprovação, até o limite com aprovação, acima disso handoff. */
export function avaliarDesconto(
  pct: number,
  parcelas: number,
  tipo: TipoCobrancaDesconto,
  politicas: ConfigAria["politicas"],
): FaixaDesconto {
  if (!Number.isFinite(pct) || !Number.isFinite(parcelas)) return "HANDOFF";
  if (pct < 0 || parcelas < 1 || parcelas > politicas.parcelasMax) return "HANDOFF";
  const p = politicas[tipo];
  if (pct <= p.descontoSemAprovacaoPct) return "SEM_APROVACAO";
  if (pct <= p.descontoComAprovacaoPct) return "COM_APROVACAO";
  return "HANDOFF";
}

export interface EntradaAprovacaoDesconto {
  oportunidadeId: string;
  tipo: TipoCobrancaDesconto;
  pct: number;
  parcelas: number;
  acaoAgenteIAId: string;
}

/** Cria Aprovacao DESCONTO PENDENTE em nome do dono da oportunidade. Sem dono, nada é criado. */
export async function solicitarAprovacaoDesconto(
  tx: Prisma.TransactionClient,
  input: EntradaAprovacaoDesconto,
): Promise<{ aprovacaoId: string } | { semDono: true }> {
  const op = await tx.oportunidade.findUnique({
    where: { id: input.oportunidadeId },
    select: { id: true, vendedorDonoId: true },
  });
  if (!op?.vendedorDonoId) return { semDono: true };

  const payload = payloadDaAria(input.acaoAgenteIAId, {
    tipoCobranca: input.tipo,
    percentual: input.pct,
    parcelas: input.parcelas,
  });
  const aprovacao = await tx.aprovacao.create({
    data: {
      tipo: TipoAprovacao.DESCONTO,
      solicitanteId: op.vendedorDonoId,
      alvoTipo: "Lead",
      alvoId: op.id,
      vigencia: Vigencia.ESTA_COBRANCA,
      motivo: "Desconto proposto pela Aria acima do limite sem aprovação",
      payload,
    },
  });
  await registrarEvento(tx, {
    tipo: "AprovacaoSolicitada",
    agregadoTipo: "Lead",
    agregadoId: op.id,
    autorId: null,
    payload: payloadDaAria(input.acaoAgenteIAId, {
      aprovacaoId: aprovacao.id,
      tipoAprovacao: TipoAprovacao.DESCONTO,
      tipoCobranca: input.tipo,
      percentual: input.pct,
      parcelas: input.parcelas,
    }),
  });
  return { aprovacaoId: aprovacao.id };
}
