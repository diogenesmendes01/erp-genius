import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { dinheiro } from "@/server/financeiro/regras";
import { RegrasHorasSchema } from "./condicoes-horas-schema";
import { classificarOcorrenciaHoras, OcorrenciaHorasSchema } from "./ocorrencia-horas";
import { resolverHoraVigenteTx } from "@/server/contratos/aditivo-hora-vigente";

/** O chamador mantém agenda/matrícula bloqueadas e valida o ator financeiro. */
export async function carregarPreviaOcorrenciaFinanceiraTx(tx: Prisma.TransactionClient, d: {
  alunoId: string; matriculaId: string; ocorrenciaId: string; condicoesId: string;
}) {
  const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId }, select: { moeda: true, contratoOk: true,
    contratoDocumentoId: true, confirmacaoContratoEm: true, leadId: true, preparacaoComercial: { select: { regime: true } } } });
  if (!m) throw new ErroRegra("Matrícula não encontrada para este aluno.");
  if (m.preparacaoComercial && m.preparacaoComercial.regime !== "HORA_PARTICULAR") throw new ErroRegra("Esta contratação não é por hora.");
  const o = await tx.ocorrenciaParticular.findFirst({ where: { id: d.ocorrenciaId, matriculaId: d.matriculaId },
    include: { encontro: { select: { id: true, matriculaId: true, turmaId: true, inicio: true, fim: true, status: true,
      reservasHoras: { select: { id: true, compraId: true, minutos: true, inicio: true, fim: true, consumo: { select: { id: true } }, decisoesLiberacao: { where: { aprovada: true }, select: { id: true } },
        compra: { select: { matriculaId: true, moeda: true, cobrancaId: true, minutosComprados: true, valorOriginal: true, valorPagoAlocado: true } } } } } } } });
  if (!o) throw new ErroRegra("Informe não encontrado nesta matrícula.");
  const e = o.encontro;
  if (e.matriculaId !== d.matriculaId || e.turmaId || e.inicio.getTime() !== o.inicio.getTime() || e.fim.getTime() !== o.fim.getTime()) throw new ErroRegra("A agenda mudou após o informe. Regularize as origens.");
  if (await tx.ocorrenciaParticular.count({ where: { encontroId: e.id, versao: { gt: o.versao } } })) throw new ErroRegra("Há uma versão mais recente do informe.");
  const condicoes = await tx.condicoesHorasMatricula.findMany({ where: { matriculaId: d.matriculaId, status: { in: ["PENDENTE", "APROVADA"] } }, orderBy: { versao: "desc" } });
  const c = condicoes.find(c => c.id === d.condicoesId);
  if (!c || c.status !== "APROVADA") throw new ErroRegra("Escolha condições aprovadas da matrícula.");
  const regras = RegrasHorasSchema.parse(c.regras);
  if (!m.contratoOk || !m.confirmacaoContratoEm || m.contratoDocumentoId !== c.documentoId || regras.moeda !== m.moeda) throw new ErroRegra("Confira a correspondência entre contrato confirmado, condições e moeda.");
  await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${c.documentoId} FOR SHARE`;
  const doc = await tx.documento.findFirst({ where: { id: c.documentoId, categoria: "CONTRATO", arquivado: false,
    OR: [{ matriculaId: d.matriculaId }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] }, select: { id: true, url: true } });
  if (!doc) throw new ErroRegra("Documento contratual indisponível.");
  if (Date.parse(regras.vigenteDesde) > o.inicio.getTime()) throw new ErroRegra("As condições ainda não valiam no início do encontro.");
  for (const outra of condicoes) {
    if (outra.id === c.id) continue;
    const r = RegrasHorasSchema.safeParse(outra.regras);
    if (!r.success) throw new ErroRegra("Outra versão de condições exige conferência.");
    const inicio = Date.parse(r.data.vigenteDesde);
    if (inicio >= o.fim.getTime()) continue;
    if (outra.status === "PENDENTE" || inicio > Date.parse(regras.vigenteDesde) || inicio === Date.parse(regras.vigenteDesde) && outra.versao > c.versao) {
      throw new ErroRegra("Existe outra versão aplicável ou mudança de condições durante o encontro. Confira a vigência antes de apurar.");
    }
  }
  const tipo = o.tipo;
  if (tipo.startsWith("CANCELAMENTO")) {
    if (e.status !== "CANCELADO" || !await tx.decisaoCancelamentoParticular.count({ where: { aprovada: true,
      proposta: { encontroId: e.id, origem: tipo === "CANCELAMENTO_ALUNO" ? "ALUNO" : "ESCOLA" } } })) throw new ErroRegra("Cancelamento sem origem aprovada correspondente.");
  } else if (!["PREVISTO", "MINISTRADO"].includes(e.status)) throw new ErroRegra("O estado do encontro difere do informe.");
  const entrada = OcorrenciaHorasSchema.parse({ matriculaId: o.matriculaId, referenciaEncontro: e.id, contratoVersaoId: c.id,
    inicio: o.inicio.toISOString(), fim: o.fim.toISOString(), registradoEm: o.criadoEm.toISOString(), evidencia: o.evidencia,
    ocorrencia: { tipo, ...(tipo.startsWith("CANCELAMENTO") ? { comunicadoEm: o.comunicadoEm?.toISOString() } : {}),
      ...(tipo === "CANCELAMENTO_ALUNO" ? { antecedenciaMinutos: regras.antecedenciaCancelamentoMinutos } : {}) } });
  const classificacao = classificarOcorrenciaHoras(entrada), minutos = (o.fim.getTime() - o.inicio.getTime()) / 60000;
  if (!Number.isSafeInteger(minutos) || minutos <= 0) throw new ErroRegra("Confira os minutos contratados; não arredonde a duração.");
  if (e.reservasHoras.length > 1) throw new ErroRegra("Há mais de uma reserva para o encontro; concilie o histórico antes da conferência.");
  const reserva = e.reservasHoras[0] ?? null;
  const podeConsumirReserva = !!reserva && ["FALTA_COBRAVEL", "CANCELAMENTO_TARDIO"].includes(classificacao.desfecho)
    && !reserva.consumo && !reserva.decisoesLiberacao.length && reserva.compra.matriculaId === d.matriculaId && reserva.compra.moeda === m.moeda
    && reserva.inicio.getTime() === e.inicio.getTime() && reserva.fim.getTime() === e.fim.getTime() && reserva.minutos === minutos;
  const pendenciasReserva = !reserva ? [] : podeConsumirReserva ? [] : [
    reserva.consumo ? "A reserva antecipada já foi consumida; alterações exigem revisão financeira." : reserva.decisoesLiberacao.length ? "A reserva antecipada já foi liberada; não pode ser consumida." :
      !["FALTA_COBRAVEL", "CANCELAMENTO_TARDIO"].includes(classificacao.desfecho) ? "A reserva antecipada só é consumida por falta cobrável ou cancelamento tardio; use o fluxo correspondente." :
        "A reserva antecipada diverge do encontro, da matrícula ou dos minutos conferidos.",
  ];
  const precoVigente = await resolverHoraVigenteTx(tx, { matriculaId: d.matriculaId, inicio: o.inicio, fim: o.fim, valorHoraOriginal: regras.valorHora, moedaOriginal: regras.moeda });
  const valorContratual = classificacao.consomeHoras ? dinheiro(new Prisma.Decimal(precoVigente.valorHora).mul(minutos).div(60)) : dinheiro(0);
  // A reserva já foi quitada na compra. Falta e cancelamento tardio consomem
  // esse preço histórico proporcional, sem reprecificar pela tabela/aditivo atual.
  const valor = podeConsumirReserva ? dinheiro(reserva!.compra.valorPagoAlocado.mul(reserva!.minutos).div(reserva!.compra.minutosComprados)) : valorContratual;
  if (valor.gt("9999999999.99")) throw new ErroRegra("Valor excede a capacidade da cobrança.");
  return { matriculaId: d.matriculaId, ocorrenciaId: o.id, versaoOcorrencia: o.versao, condicoesId: c.id, versaoCondicoes: c.versao,
    documento: doc, regras, classificacao, minutos, valorApurado: valor.toFixed(2), moeda: regras.moeda,
    precoHoraAplicado: precoVigente.valorHora, valorContratualInformativo: valorContratual.toFixed(2), aditivo: precoVigente.versaoAditivo,
    reservasHoras: e.reservasHoras, ...(podeConsumirReserva ? { reservaAntecipada: { reservaId: reserva!.id, compraId: reserva!.compraId, minutos: reserva!.minutos,
      moeda: reserva!.compra.moeda, cobrancaId: reserva!.compra.cobrancaId, valorOriginal: reserva!.compra.valorOriginal.toFixed(2), valorPagoAlocado: reserva!.compra.valorPagoAlocado.toFixed(2) } } : {}),
    pendencias: pendenciasReserva,
    conferenciaRegistrada: false as const, emiteCobranca: false as const };
}
