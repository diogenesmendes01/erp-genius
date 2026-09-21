import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";

const dinheiro = z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v));
const EfeitoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("SEM_ITEM"), valorAula: dinheiro, moeda: z.string() }),
  z.object({ tipo: z.literal("REDUZ_COBRANCA_ABERTA"), valorAula: dinheiro, moeda: z.string(), cobrancaId: z.string(), versaoCobranca: z.number().int(), valorNegociadoAnterior: dinheiro, valorNegociadoNovo: dinheiro }),
  z.object({ tipo: z.literal("GERA_CREDITO"), valorAula: dinheiro, moeda: z.string(), cobrancaId: z.string(), versaoCobranca: z.number().int(), valorNegociadoAnterior: dinheiro, creditoValor: dinheiro }),
  z.object({ tipo: z.literal("DEVOLVE_MINUTOS"), valorAula: dinheiro, moeda: z.string(), reservaId: z.string(), consumoId: z.string(), compraId: z.string(), minutos: z.number().int().positive() }),
]);
const FotoSchema = z.object({ tipo: z.literal("AULA_NAO_COBRAVEL"), conferencia: z.object({ id: z.string() }).nullable(), encontro: z.object({ matriculaId: z.string() }), efeito: EfeitoSchema }).passthrough();
export type EfeitoNaoCobravel = z.infer<typeof EfeitoSchema>;

/** Lê o efeito calculado pelo banco; o Node nunca o recalcula. */
export function lerEfeitoNaoCobravel(fotografia: unknown) {
  const foto = FotoSchema.safeParse(fotografia);
  return foto.success ? foto.data : null;
}

/**
 * Q175: chamado DENTRO da transação de `aprovarCorrecaoAula`, logo após nascer a aprovação.
 * O trigger da aprovação já revalidou a fotografia e as duas alçadas financeiras; aqui o
 * efeito aprovado vira fato: reduz a cobrança em aberto (trigger SQL), gera crédito quando
 * a fatura está paga, só marca a aula como não cobrável para o próximo fechamento, ou — aula
 * paga com horas pré-pagas — estorna o consumo e devolve os minutos à própria compra.
 * Revisão de outro tipo não tem efeito e devolve null.
 */
export async function aplicarRevisaoNaoCobravelTx(tx: Prisma.TransactionClient, input: { aprovacaoId: string; decisaoRevisaoId: string; autorId: string }) {
  const decisao = await tx.decisaoRevisaoFinanceiraCorrecaoAula.findUnique({ where: { id: input.decisaoRevisaoId }, select: { id: true, aprovada: true, proposta: { select: { tipo: true, fotografia: true, fotografiaHash: true } } } });
  if (!decisao?.aprovada) throw new ErroRegra("Revisão financeira aprovada não encontrada.");
  if (decisao.proposta.tipo !== "AULA_NAO_COBRAVEL") return null;
  const foto = lerEfeitoNaoCobravel(decisao.proposta.fotografia);
  if (!foto) throw new ErroRegra("A fotografia da revisão financeira não identifica o efeito aprovado.");
  const e = foto.efeito, matriculaId = foto.encontro.matriculaId;
  const cobranca = e.tipo === "REDUZ_COBRANCA_ABERTA" || e.tipo === "GERA_CREDITO" ? { id: e.cobrancaId, versao: e.versaoCobranca, valorNegociadoAnterior: e.valorNegociadoAnterior } : null;
  if (cobranca) await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=${cobranca.id} FOR UPDATE`;
  if (e.tipo === "DEVOLVE_MINUTOS") await tx.$queryRaw`SELECT id FROM "CompraHorasAntecipadas" WHERE id=${e.compraId} FOR UPDATE`;
  const aplicacao = await tx.aplicacaoRevisaoFinanceiraCorrecaoAula.create({ data: {
    decisaoRevisaoId: decisao.id, aprovacaoCorrecaoAulaId: input.aprovacaoId, conferenciaId: foto.conferencia?.id ?? null, matriculaId,
    cobrancaId: cobranca?.id ?? null, efeito: e.tipo, valorAula: e.valorAula, moeda: e.moeda,
    versaoCobrancaAntes: cobranca?.versao ?? null, valorNegociadoAnterior: cobranca?.valorNegociadoAnterior ?? null,
    valorNegociadoNovo: e.tipo === "REDUZ_COBRANCA_ABERTA" ? e.valorNegociadoNovo : null, creditoValor: e.tipo === "GERA_CREDITO" ? e.creditoValor : null,
    minutosDevolvidos: e.tipo === "DEVOLVE_MINUTOS" ? e.minutos : null, fotografiaHash: decisao.proposta.fotografiaHash,
  } });
  let creditoId: string | null = null, estornoId: string | null = null;
  if (e.tipo === "GERA_CREDITO") {
    const origem = await tx.origemCreditoRevisaoCorrecaoAula.create({ data: { aplicacaoId: aplicacao.id, matriculaId, cobrancaId: e.cobrancaId, valor: e.creditoValor, moeda: e.moeda } });
    creditoId = (await tx.creditoMatricula.create({ data: { matriculaId, moeda: e.moeda, valorInicial: e.creditoValor, origemRevisaoCorrecaoAulaId: origem.id } })).id;
  }
  if (e.tipo === "DEVOLVE_MINUTOS") {
    estornoId = (await tx.estornoConsumoHorasCompradas.create({ data: { consumoId: e.consumoId, aplicacaoId: aplicacao.id, compraId: e.compraId, minutos: e.minutos } })).id;
  }
  await registrarEvento(tx, { tipo: "CorrecaoAulaNaoCobravelAplicada", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: input.autorId,
    payload: { aplicacaoId: aplicacao.id, aprovacaoCorrecaoAulaId: input.aprovacaoId, decisaoRevisaoId: decisao.id, conferenciaId: foto.conferencia?.id ?? null, efeito: e.tipo,
      valorAula: e.valorAula.toFixed(2), moeda: e.moeda, cobrancaId: cobranca?.id ?? null, creditoId, estornoId, minutosDevolvidos: e.tipo === "DEVOLVE_MINUTOS" ? e.minutos : null } });
  return { id: aplicacao.id, efeito: e.tipo, creditoId, estornoId };
}
