import { Prisma, TipoCobranca } from "@prisma/client";
import { gerarCodigo } from "@/lib/codigo";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { instanteDaGrade } from "@/server/agenda/grade";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { carregarContinuidadeMensalTx } from "./continuidade-estado-tx";
import { EmitirContinuidadeMensalSchema } from "./continuidade-emissao-schema";

const civil = (data: Date) => data.toISOString().slice(0, 10);

/** Q30/Q64/Q160/Q161/Q162: executor sem sessão, cron ou UI; cria uma única mensalidade por âncora. */
export async function emitirContinuidadeMensalTx(tx: Prisma.TransactionClient, input: unknown) {
  const dados = EmitirContinuidadeMensalSchema.parse(input);
  const agora = new Date();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [dados.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${dados.ultimaCobrancaIdEsperada} AND "matriculaId" = ${dados.matriculaId} FOR UPDATE`;
  const ancora = await tx.cobranca.findFirst({ where: { id: dados.ultimaCobrancaIdEsperada, matriculaId: dados.matriculaId, tipo: TipoCobranca.MENSALIDADE }, select: { id: true } });
  if (!ancora) throw new ErroRegra("A âncora esperada não é uma mensalidade desta matrícula.");
  await tx.$queryRaw`SELECT id FROM "EmissaoContinuidadeMensal" WHERE "matriculaId" = ${dados.matriculaId} AND "anteriorCobrancaId" = ${ancora.id} FOR UPDATE`;
  const repetida = await tx.emissaoContinuidadeMensal.findUnique({ where: { matriculaId_anteriorCobrancaId: { matriculaId: dados.matriculaId, anteriorCobrancaId: ancora.id } }, include: { cobranca: true } });
  if (repetida) return { emissaoId: repetida.id, cobrancaId: repetida.cobrancaId, codigo: repetida.cobranca.codigo, repetida: true as const };

  const estado = await carregarContinuidadeMensalTx(tx, { matriculaId: dados.matriculaId, agora });
  if (estado.ultimaCobrancaId !== ancora.id) throw new ErroRegra("A âncora de continuidade mudou; recarregue antes de emitir.");
  if (estado.plano.status !== "PRONTA_PARA_EMISSAO") throw new ErroRegra("O marco de emissão da continuidade ainda não foi alcançado.");
  if (estado.oferta.estado !== "SEM_RELATO" || !["COMPROVADA_POR_AGENDA", "CONFIRMADA_PELA_GESTAO"].includes(estado.comprovacaoOferta.estado)) throw new ErroRegra("A oferta para a próxima cobertura não está comprovada.");
  const inicio = new Date(`${estado.plano.cobertura.inicio}T00:00:00.000Z`), fim = new Date(`${estado.plano.cobertura.fim}T00:00:00.000Z`);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${dados.matriculaId} AND tipo = 'MENSALIDADE' AND "coberturaInicio" <= ${fim} AND "coberturaFim" >= ${inicio} FOR UPDATE`;
  const sobreposta = await tx.cobranca.findFirst({ where: { matriculaId: dados.matriculaId, tipo: TipoCobranca.MENSALIDADE, status: { not: "CANCELADA" }, coberturaInicio: { lte: fim }, coberturaFim: { gte: inicio } }, select: { id: true } });
  if (sobreposta) throw new ErroRegra("A próxima cobertura já possui mensalidade sobreposta.");
  const vencimento = instanteDaGrade(estado.plano.vencimento, "00:00", estado.fusoInstitucional);
  const snapshot = JSON.parse(JSON.stringify({ ancoraId: ancora.id, plano: estado.plano, memoriaPreco: estado.memoriaPreco, condicoes: estado.condicoes, documentoId: estado.documentoId, oferta: estado.oferta, comprovacaoOferta: estado.comprovacaoOferta, emissaoEm: estado.plano.emissaoEm, fusoInstitucional: estado.fusoInstitucional }));
  const codigo = await gerarCodigo("cobranca", tx);
  const cobranca = await tx.cobranca.create({ data: { codigo, matriculaId: dados.matriculaId, tipo: TipoCobranca.MENSALIDADE, competencia: estado.plano.cobertura.inicio.slice(0, 7), valorOriginal: new Prisma.Decimal(estado.plano.valorOriginal), valorNegociado: new Prisma.Decimal(estado.plano.valorNegociado), saldo: new Prisma.Decimal(estado.plano.valorNegociado), moeda: estado.plano.moeda, vencimento, coberturaInicio: inicio, coberturaFim: fim } });
  const emissao = await tx.emissaoContinuidadeMensal.create({ data: { matriculaId: dados.matriculaId, cobrancaId: cobranca.id, anteriorCobrancaId: ancora.id, coberturaInicio: inicio, coberturaFim: fim, emissaoEm: new Date(`${estado.plano.emissaoEm}T00:00:00.000Z`), snapshot, snapshotHash: hashSubstituicao(snapshot), emitidaEm: agora } });
  await registrarEvento(tx, { tipo: "ContinuidadeMensalEmitida", agregadoTipo: "Matricula", agregadoId: dados.matriculaId, autorId: null, payload: { emissaoId: emissao.id, cobrancaId: cobranca.id, anteriorCobrancaId: ancora.id, cobertura: estado.plano.cobertura, codigo } });
  return { emissaoId: emissao.id, cobrancaId: cobranca.id, codigo, repetida: false as const };
}
