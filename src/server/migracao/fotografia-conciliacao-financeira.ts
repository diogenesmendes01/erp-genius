import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { canonizarFotografiaFinanceira, hashFotografiaFinanceira } from "./fotografia-financeira";

export type FotoConciliacaoFinanceira = ReturnType<typeof canonizarFotografiaFinanceira>;

/** Locks and reads are deliberately shared by proposal and approval. */
export async function fotografiaConciliacaoFinanceiraTx(tx: Prisma.TransactionClient, ids: { linhaId:string; matriculaId:string; cobrancaId:string; pagadorId:string; recebimentoId?:string|null }) {
  const [linha] = await tx.$queryRaw<{id:string;origem:string;financeiroOrigemId:string|null;matriculaOrigemId:string|null;entradaHash:string;dadosOrigem:Prisma.JsonValue;loteId:string}[]>(Prisma.sql`
    SELECT l.id,lo.origem,l."financeiroOrigemId",l."matriculaOrigemId",l."entradaHash",l."dadosOrigem",l."loteId"
    FROM "LinhaPreparacaoMigracao" l JOIN "LotePreparacaoMigracao" lo ON lo.id=l."loteId"
    WHERE l.id=${ids.linhaId} AND l."tipoEntrada"='FINANCEIRO_HISTORICO'::"TipoEntradaPreparacaoMigracao" FOR UPDATE`);
  if (!linha?.financeiroOrigemId || !linha.matriculaOrigemId) throw new ErroRegra("A fonte financeira precisa identificar registro e matrícula de origem.");
  await tx.$queryRaw`SELECT id FROM "MapaOrigemMatriculaMigracao" WHERE origem=${linha.origem} AND "matriculaOrigemId"=${linha.matriculaOrigemId} FOR SHARE`;
  const mapa = await tx.mapaOrigemMatriculaMigracao.findUnique({where:{origem_matriculaOrigemId:{origem:linha.origem,matriculaOrigemId:linha.matriculaOrigemId}},select:{origem:true,matriculaOrigemId:true,matriculaId:true,linhaId:true,entradaHash:true}});
  if (!mapa || mapa.matriculaId!==ids.matriculaId) throw new ErroRegra("A matrícula selecionada não corresponde ao vínculo M01 da fonte.");
  await bloquearMatriculas(tx,[ids.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=${ids.cobrancaId} FOR UPDATE`;
  const cobrancaAtual=await tx.cobranca.findUnique({where:{id:ids.cobrancaId},select:{id:true,matriculaId:true,tipo:true,status:true,moeda:true,valorOriginal:true,valorNegociado:true,valorRecebido:true,saldo:true,valorLiquidadoCredito:true,valorCompensadoPermuta:true,versao:true,pagoEm:true,formaPagamento:true,comprovanteUrl:true,comprovanteNome:true,comentario:true,vencimento:true}});
  // Não introduzir zero no hash das conferências anteriores à permuta.
  const cobranca = cobrancaAtual && (() => {
    const { valorCompensadoPermuta, ...anterior } = cobrancaAtual;
    return valorCompensadoPermuta.gt(0) ? { ...anterior, valorCompensadoPermuta } : anterior;
  })();
  if(!cobranca||cobranca.matriculaId!==ids.matriculaId) throw new ErroRegra("A cobrança não pertence ao contrato explícito.");
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=${ids.cobrancaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "PagadorPreparacaoMatricula" WHERE id=${ids.pagadorId} FOR SHARE`;
  const pagador=await tx.pagadorPreparacaoMatricula.findUnique({where:{id:ids.pagadorId},select:{id:true,matriculaId:true,versao:true,tipo:true,dados:true}});
  if(!pagador||pagador.matriculaId!==ids.matriculaId) throw new ErroRegra("O pagador não pertence ao contrato explícito.");
  await tx.$queryRaw`SELECT id FROM "PagadorPreparacaoMatricula" WHERE id=${ids.pagadorId} FOR SHARE`;
  if(ids.recebimentoId)await tx.$queryRaw`SELECT id FROM "Recebimento" WHERE id=${ids.recebimentoId} FOR SHARE`;
  // A fotografia nova vincula a parcela material, nunca o valor bruto do fato
  // de caixa. Fotografias pré-Q87 continuam com cobrancaId no recebimento.
  const recebimento=ids.recebimentoId ? await tx.recebimento.findUnique({where:{id:ids.recebimentoId},select:{id:true,cobrancaId:true,titularMatriculaId:true,pagadorId:true,valor:true,moeda:true,forma:true,dataPagamento:true,hashDados:true,chaveIdempotencia:true,autorId:true,destinacoes:{where:{cobrancaId:ids.cobrancaId},select:{id:true,cobrancaId:true,tipo:true,valor:true,evidencia:true,chaveIdempotencia:true}}}}):null;
  if(ids.recebimentoId&&!recebimento)throw new ErroRegra("Recebimento ERP não encontrado.");
  if(ids.recebimentoId)await tx.$queryRaw`SELECT id FROM "Recebimento" WHERE id=${ids.recebimentoId} FOR SHARE`;
  const foto=canonizarFotografiaFinanceira({linha,mapa,cobranca,pagador,recebimento});
  if (!foto || typeof foto !== "object" || Array.isArray(foto)) throw new ErroRegra("Fotografia financeira inválida.");
  return {linha,mapa,cobranca,pagador,recebimento,foto,hash:hashFotografiaFinanceira(foto)};
}
