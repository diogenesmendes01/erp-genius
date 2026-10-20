import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INCLUDE_DESTINO, resolverDestinoCobranca, type DestinoCobranca } from "./identidade";

/** Falha incerta não é reaberta pelo cron nem pelo botão que apenas reenfileira um degrau. */
export function podeReabrirIntencao(status: string, motivo: string | null): boolean {
  if (["PENDENTE", "ENVIANDO", "DESPACHADA", "ADIADA", "FALHOU"].includes(status)) return false;
  return motivo !== "envio_interrompido" && motivo !== "resultado_incerto" && motivo !== "revisado_sem_reenvio";
}

/** Vincula o texto preparado à identidade, versão e contato conferidos. */
export function referenciaDestinoCobranca(destino: DestinoCobranca | null): string {
  return JSON.stringify(destino ? [destino.matriculaId, destino.referenciaFonte, destino.tipoPagador,
    destino.telefoneE164, destino.nome, destino.responsavelId, destino.contatoAlunoId] : null);
}

/** A quantia aprovada não pode continuar válida após recebimento parcial ou ajuste. */
export async function snapshotCobranca(cobrancaId: string, db: Prisma.TransactionClient = prisma) {
  const c = await db.cobranca.findUnique({ where: { id: cobrancaId }, include: INCLUDE_DESTINO });
  if (!c) return null;
  const destino = resolverDestinoCobranca(c);
  const saldo = c.saldo ?? c.valorNegociado.minus(c.valorRecebido ?? new Prisma.Decimal(0));
  return { c, destino, saldo, assinatura: JSON.stringify([
    c.id, c.moeda, c.valorNegociado.toFixed(), c.valorRecebido?.toFixed() ?? "0", saldo.toFixed(),
    c.vencimento.toISOString(), c.status, destino?.telefoneE164 ?? null,
    c.versao, c.cicloRegua, referenciaDestinoCobranca(destino),
  ]) };
}
