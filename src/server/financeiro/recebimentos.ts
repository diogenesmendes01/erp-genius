import { Prisma, StatusCobranca, FormaPagamento, TipoDestinacaoRecebimento } from "@prisma/client";
import { registrarEvento, ErroRegra, ErroPermissao } from "@/server/_shared";
import { dinheiro, saldoAtual } from "./regras";
import { createHash } from "node:crypto";

export type DestinoRecebimento = { tipo: TipoDestinacaoRecebimento; cobrancaId?: string; valor: number; evidencia: string; chaveIdempotencia: string };

export function hashDadosPagamento(input: { cobrancaId: string; autorId: string; valorRecebido: number; forma: FormaPagamento; dataPagamento?: Date | null; comprovanteUrl?: string | null; comprovanteNome?: string | null; comentario?: string | null; permitirExcedente?: boolean }) {
  return createHash("sha256").update(JSON.stringify({ cobrancaId: input.cobrancaId, autorId: input.autorId, valor: dinheiro(input.valorRecebido).toFixed(2), forma: input.forma, dataPagamento: input.dataPagamento?.toISOString() ?? null, comprovanteUrl: input.comprovanteUrl ?? null, comprovanteNome: input.comprovanteNome ?? null, comentario: input.comentario ?? null, permitirExcedente: input.permitirExcedente ?? false })).digest("hex");
}

export async function bloquearCobranca(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${id} FOR UPDATE`;
  const cobranca = await tx.cobranca.findUnique({ where: { id } });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
  return cobranca;
}

/** Segue a ordem usada na assunção/documentos: lead, matrícula e depois cobranças. */
export async function bloquearMatriculas(tx: Prisma.TransactionClient, ids: string[]) {
  const matriculas = await tx.matricula.findMany({ where: { id: { in: ids } }, select: { id: true, leadId: true } });
  const leads = [...new Set(matriculas.flatMap((matricula) => matricula.leadId ? [matricula.leadId] : []))].sort();
  for (const leadId of leads) await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${leadId} FOR UPDATE`;
  for (const matriculaId of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${matriculaId} FOR UPDATE`;
}

/** Cria um fato de caixa único e suas destinações materiais FIN-04. */
export async function receberComDestinacoesTx(tx: Prisma.TransactionClient, input: {
  titularMatriculaId: string; pagadorId?: string | null; chaveIdempotencia: string; autorId: string; valorRecebido: number; forma: FormaPagamento; dataPagamento: Date;
  destinos: DestinoRecebimento[]; comprovanteUrl?: string | null; comprovanteNome?: string | null; comentario?: string | null; informeId?: string; hashDados?: string; moeda: string;
}) {
  const valorOriginal = dinheiro(input.valorRecebido);
  if (valorOriginal.lte(0) || !input.destinos.length) throw new ErroRegra("O recebimento exige valor positivo e ao menos uma destinação.");
  if (input.destinos.some((d) => (d.tipo === TipoDestinacaoRecebimento.COBRANCA) !== !!d.cobrancaId || dinheiro(d.valor).lte(0) || d.evidencia.trim().length < 5 || !d.chaveIdempotencia)) throw new ErroRegra("Cada destinação exige tipo, valor positivo, chave e evidência identificada.");
  const total = input.destinos.reduce((v, d) => v.plus(dinheiro(d.valor)), new Prisma.Decimal(0));
  if (!total.equals(valorOriginal)) throw new ErroRegra("As destinações devem consumir exatamente o recebimento; o saldo deve virar crédito explícito.");
  const idsCobrancas = [...new Set(input.destinos.flatMap((d) => d.tipo === TipoDestinacaoRecebimento.COBRANCA && d.cobrancaId ? [d.cobrancaId] : []))].sort();
  if (idsCobrancas.length !== input.destinos.filter((d) => d.tipo === TipoDestinacaoRecebimento.COBRANCA).length) throw new ErroRegra("Uma cobrança só pode aparecer uma vez em cada recebimento; consolide sua parcela preservando a evidência.");

  const destinos = [...input.destinos].sort((a, b) => a.chaveIdempotencia.localeCompare(b.chaveIdempotencia));
  // O hash informado por fluxos legados identifica a fonte, mas não substitui
  // a identidade material do caixa (data, comprovantes, comentário e destinos).
  const hashDados = createHash("sha256").update(JSON.stringify({ titularMatriculaId: input.titularMatriculaId, pagadorId: input.pagadorId ?? null, autorId: input.autorId, informeId: input.informeId ?? null, valor: valorOriginal.toFixed(2), moeda: input.moeda, forma: input.forma, dataPagamento: input.dataPagamento.toISOString(), comprovanteUrl: input.comprovanteUrl ?? null, comprovanteNome: input.comprovanteNome ?? null, comentario: input.comentario ?? null, fonteHash: input.hashDados ?? null, destinos: destinos.map((d) => ({ ...d, valor: dinheiro(d.valor).toFixed(2) })) })).digest("hex");
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${input.autorId} FOR SHARE`;
  const caixa = await tx.usuario.findUnique({ where: { id: input.autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!caixa?.ativo || !(caixa.papeis.includes("ADMINISTRADOR") || caixa.papeis.includes("FINANCEIRO") || caixa.permissoes.includes("pagamento.caixa"))) throw new ErroPermissao("Exige capacidade de caixa vigente.");
  // Serializa também o replay: concorrentes da mesma matrícula relêem a chave
  // somente depois do lock e não produzem dois fatos/eventos.
  await bloquearMatriculas(tx, [input.titularMatriculaId]);
  const existente = await tx.recebimento.findUnique({ where: { chaveIdempotencia: input.chaveIdempotencia }, include: { destinacoes: { orderBy: { chaveIdempotencia: "asc" } } } });
  if (existente) {
    const iguais = existente.titularMatriculaId === input.titularMatriculaId && existente.pagadorId === (input.pagadorId ?? null) && existente.autorId === input.autorId && existente.moeda === input.moeda && existente.forma === input.forma && existente.informeId === (input.informeId ?? null) && existente.valor.equals(valorOriginal) && (!existente.hashDados || existente.hashDados === hashDados) && existente.destinacoes.length === destinos.length && existente.destinacoes.every((d, i) => d.tipo === destinos[i].tipo && d.cobrancaId === (destinos[i].cobrancaId ?? null) && d.valor.equals(dinheiro(destinos[i].valor)) && d.evidencia === destinos[i].evidencia && d.chaveIdempotencia === destinos[i].chaveIdempotencia);
    if (!iguais) throw new ErroRegra("Identificador de pagamento já usado para outra operação.");
    return existente;
  }
  if (!input.informeId && idsCobrancas.length && await tx.pagamentoInformado.count({ where: { cobrancaId: { in: idsCobrancas }, autorId: input.autorId, status: "A_CONFERIR" } })) throw new ErroPermissao("Seu informe aguarda conferência de outra pessoa.");
  // O replay já retornou acima antes de condições que só valem para uma baixa nova.
  const cobrancas = new Map<string, Awaited<ReturnType<typeof bloquearCobranca>>>();
  for (const id of idsCobrancas) cobrancas.set(id, await bloquearCobranca(tx, id));
  for (const cobranca of cobrancas.values()) {
    if (cobranca.matriculaId !== input.titularMatriculaId || cobranca.moeda !== input.moeda) throw new ErroRegra("A destinação deve preservar o titular e a moeda do recebimento.");
    if (cobranca.status === StatusCobranca.CANCELADA || cobranca.status === StatusCobranca.PAGO) throw new ErroRegra("Cobrança paga ou cancelada não recebe nova baixa.");
  }
  if (input.pagadorId) {
    const pagador = await tx.pagadorPreparacaoMatricula.findUnique({ where: { id: input.pagadorId }, select: { matriculaId: true } });
    if (!pagador || pagador.matriculaId !== input.titularMatriculaId) throw new ErroRegra("O pagador deve pertencer ao titular do recebimento.");
  }
  const recebimento = await tx.recebimento.create({ data: { chaveIdempotencia: input.chaveIdempotencia, cobrancaId: null, titularMatriculaId: input.titularMatriculaId, pagadorId: input.pagadorId ?? null, informeId: input.informeId ?? null, autorId: input.autorId, valor: valorOriginal, moeda: input.moeda, forma: input.forma, dataPagamento: input.dataPagamento, hashDados } });
  await registrarEvento(tx, {
    tipo: "RecebimentoRegistrado", agregadoTipo: "Recebimento", agregadoId: recebimento.id, autorId: input.autorId,
    payload: { recebimentoId: recebimento.id, titularMatriculaId: input.titularMatriculaId, pagadorId: input.pagadorId ?? null,
      valor: valorOriginal.toFixed(2), moeda: input.moeda, forma: input.forma, dataPagamento: input.dataPagamento.toISOString(),
      comprovanteUrl: input.comprovanteUrl ?? null, comprovanteNome: input.comprovanteNome ?? null, comentario: input.comentario ?? null,
      hashDados, destinos: destinos.map(d => ({ tipo: d.tipo, cobrancaId: d.cobrancaId ?? null, valor: dinheiro(d.valor).toFixed(2), evidencia: d.evidencia.trim() })) },
  });
  for (const destino of input.destinos) {
    const valor = dinheiro(destino.valor);
    const criado = await tx.destinacaoRecebimento.create({ data: { recebimentoId: recebimento.id, cobrancaId: destino.cobrancaId ?? null, autorId: input.autorId, tipo: destino.tipo, valor, evidencia: destino.evidencia.trim(), chaveIdempotencia: destino.chaveIdempotencia } });
    if (destino.tipo === TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO) {
      await tx.creditoMatricula.create({ data: { matriculaId: input.titularMatriculaId, origemDestinacaoRecebimentoId: criado.id, valorInicial: valor, moeda: input.moeda } });
      await registrarEvento(tx, { tipo: "RecebimentoCreditado", agregadoTipo: "Matricula", agregadoId: input.titularMatriculaId, autorId: input.autorId, payload: { recebimentoId: recebimento.id, destinacaoId: criado.id, valor: valor.toNumber(), moeda: input.moeda } });
      continue;
    }
    const cobranca = cobrancas.get(destino.cobrancaId!)!;
    const recebido = dinheiro(cobranca.valorRecebido ?? 0).plus(valor);
    const excedente = Prisma.Decimal.max(0, recebido.plus(cobranca.valorLiquidadoCredito).minus(cobranca.valorNegociado));
    if (excedente.gt(0)) throw new ErroRegra("A destinação excede o saldo devido; registre somente o saldo como cobrança e o restante como crédito.");
    const saldo = saldoAtual(cobranca.valorNegociado, recebido, cobranca.valorLiquidadoCredito);
    const quitada = saldo.isZero();
    await tx.cobranca.update({ where: { id: cobranca.id }, data: { valorRecebido: recebido, saldo, versao: { increment: 1 }, status: quitada ? StatusCobranca.PAGO : (cobranca.vencimento < new Date() ? StatusCobranca.ATRASADO : StatusCobranca.PENDENTE), pagoEm: quitada ? input.dataPagamento : null, formaPagamento: input.forma, comprovanteUrl: input.comprovanteUrl ?? null, comprovanteNome: input.comprovanteNome ?? null, comentario: input.comentario ?? null } });
    await registrarEvento(tx, { tipo: "PagamentoRegistrado", agregadoTipo: "Cobranca", agregadoId: cobranca.id, autorId: input.autorId, payload: { recebimentoId: recebimento.id, destinacaoId: criado.id, informeId: input.informeId ?? null, valorRecebido: valor.toNumber(), recebidoAcumulado: recebido.toNumber(), saldo: saldo.toNumber(), forma: input.forma, quitada, dataPagamento: input.dataPagamento.toISOString() } });
  }
  return recebimento;
}

/** Compatibilidade para os fluxos que ainda liquidam uma única cobrança. */
export async function receberTx(tx: Prisma.TransactionClient, input: {
  cobrancaId: string; chaveIdempotencia: string; autorId: string; valorRecebido: number; forma: FormaPagamento; dataPagamento: Date; comprovanteUrl?: string | null; comprovanteNome?: string | null; comentario?: string | null; permitirExcedente?: boolean; informeId?: string; hashDados?: string; moeda?: string; pagadorId?: string | null; evidencia?: string;
}) {
  const cobranca = await tx.cobranca.findUnique({ where: { id: input.cobrancaId }, select: { matriculaId: true, moeda: true } });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
  if (input.moeda && input.moeda !== cobranca.moeda) throw new ErroRegra("A moeda do informe difere da cobrança. Confira novamente o pagamento.");
  const evidencia = input.evidencia ?? input.comentario;
  if (!evidencia || evidencia.trim().length < 5) throw new ErroRegra("Informe a evidência da destinação do recebimento.");
  await bloquearMatriculas(tx, [cobranca.matriculaId]);
  const anterior = await tx.recebimento.findUnique({ where: { chaveIdempotencia: input.chaveIdempotencia }, include: { destinacoes: { orderBy: { chaveIdempotencia: "asc" } } } });
  let destinos: DestinoRecebimento[];
  if (anterior) {
    if (anterior.destinacoes.some(d => d.tipo === TipoDestinacaoRecebimento.COBRANCA && d.cobrancaId !== input.cobrancaId) || (anterior.destinacoes.some(d => d.tipo === TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO) && !input.permitirExcedente)) throw new ErroRegra("Identificador de pagamento já usado para outra operação.");
    // O saldo atual já reflete a primeira baixa; o replay conserva sua divisão.
    destinos = anterior.destinacoes.map(d => ({ tipo: d.tipo, cobrancaId: d.cobrancaId ?? undefined, valor: d.valor.toNumber(), evidencia, chaveIdempotencia: d.chaveIdempotencia }));
  } else {
    const atual = await bloquearCobranca(tx, input.cobrancaId);
    const saldo = saldoAtual(atual.valorNegociado, atual.valorRecebido, atual.valorLiquidadoCredito);
    const valor = dinheiro(input.valorRecebido);
    if (valor.gt(saldo) && !input.permitirExcedente) throw new ErroRegra("Autorize o registro do excedente como crédito.");
    destinos = [{ tipo: TipoDestinacaoRecebimento.COBRANCA, cobrancaId: input.cobrancaId, valor: Prisma.Decimal.min(valor, saldo).toNumber(), evidencia, chaveIdempotencia: `cobranca:${input.cobrancaId}` }];
    if (valor.gt(saldo)) destinos.push({ tipo: TipoDestinacaoRecebimento.CREDITO_SEM_DESTINO, valor: valor.minus(saldo).toNumber(), evidencia, chaveIdempotencia: "credito-sem-destino" });
  }
  return receberComDestinacoesTx(tx, { ...input, titularMatriculaId: cobranca.matriculaId, pagadorId: input.pagadorId ?? null, moeda: cobranca.moeda, destinos });
}
