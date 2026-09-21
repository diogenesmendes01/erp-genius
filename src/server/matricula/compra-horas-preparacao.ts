import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { exigirAceiteIntegrado } from "@/server/contratos/aceite-estado";
import { planejarCobrancasEntrada } from "./plano-cobrancas-entrada";

/** Chamador mantém matrícula/cobrança bloqueadas. Compras legadas conservam conferência própria. */
export async function conferirCompraPreparadaTx(tx: Prisma.TransactionClient, m: { id: string; contratoDocumentoId: string | null; confirmacaoContratoPorId: string | null; confirmacaoContratoEm: Date | null }, c: { id: string; moeda: string; valorNegociado: Prisma.Decimal }, minutos: number) {
  const p = await tx.preparacaoComercialMatricula.findUnique({ where: { matriculaId: m.id }, select: { id: true, regime: true } });
  if (!p) return null;
  await exigirAceiteIntegrado(tx, m);
  if (p.regime !== "HORA_PARTICULAR") throw new ErroRegra("A compra de horas exige contratação por hora.");
  const condicoes = await tx.condicoesEntradaPreparacao.findFirstOrThrow({ where: { matriculaId: m.id }, orderBy: { versao: "desc" } });
  const previsto = planejarCobrancasEntrada(condicoes.dados).find(i => i.tipo === "HORA_PARTICULAR");
  const item = await tx.itemEmissaoEntrada.findFirst({ where: { cobrancaId: c.id, matriculaId: m.id, emissao: { condicoesId: condicoes.id, etapa: "CONFERENCIA_SECRETARIA", conferenciaInicial: { isNot: null } } }, select: { emissaoId: true } });
  if (!previsto || !item || previsto.minutos !== minutos || previsto.moeda !== c.moeda || !new Prisma.Decimal(previsto.valor).equals(c.valorNegociado))
    throw new ErroRegra("Os minutos, valor e cobrança precisam corresponder ao adiantamento contratado e emitido. Novas compras exigem condições próprias.");
  return { preparacaoId: p.id, condicoesId: condicoes.id, versaoCondicoes: condicoes.versao, emissaoId: item.emissaoId, minutosContratados: previsto.minutos };
}
