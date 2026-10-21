"use server";

import { EstadoReconferenciaDeltaDesistencia, Papel, Prisma, StatusCobranca } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, ErroPermissao, ErroRegra, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { calcularReconferenciaDelta } from "./desistencia-reconferencia-delta-calculo";
import { carregarFontesReconferenciaDeltaTx } from "./desistencia-reconferencia-delta-fontes";

const identificador = z.string().trim().min(1).max(100);
const motivo = z.string().trim().min(5).max(3000);
const chave = z.string().trim().min(8).max(100);
const prepararSchema = z.object({ aplicacaoBaseId: identificador, motivo, chaveIdempotencia: chave }).strict();
const decidirSchema = z.object({ propostaId: identificador, fotografiaHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo, chaveIdempotencia: chave }).strict();
const aplicarSchema = z.object({ decisaoFinanceiraId: identificador, chaveIdempotencia: chave }).strict();
const ordemDelta: Prisma.AplicacaoReconferenciaDeltaDesistenciaOrderByWithRelationInput[] = [{ criadaEm: "desc" }, { id: "desc" }];
type CreditoExterno = { id: string; saldoDisponivel: string; moeda: string };
function creditosExternosMemoria(memoria: Prisma.JsonValue): CreditoExterno[] {
  return z.array(z.object({ id: identificador, saldoDisponivel: z.string().regex(/^\d{1,10}\.\d{2}$/), moeda: z.string().regex(/^[A-Z]{3}$/) }).strict())
    .parse((memoria as { creditosExternos?: unknown }).creditosExternos ?? []);
}
function mesmosCreditosExternos(a: CreditoExterno[], b: CreditoExterno[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function motivoMemoriaDelta(memoria: Prisma.JsonValue) {
  return z.object({ motivo }).passthrough().parse(memoria).motivo;
}

async function financeiroAprovador(tx: Prisma.TransactionClient, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!usuario?.ativo || (!usuario.papeis.includes(Papel.ADMINISTRADOR) &&
    (!usuario.papeis.includes(Papel.FINANCEIRO) || !usuario.permissoes.includes("financeiro.aprovar_acertos")))) throw new ErroPermissao();
}
async function financeiroPreparador(tx: Prisma.TransactionClient, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || (!usuario.papeis.includes(Papel.FINANCEIRO) && !usuario.papeis.includes(Papel.ADMINISTRADOR))) throw new ErroPermissao();
}
async function administrador(tx: Prisma.TransactionClient, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao();
}

async function decisoesDaAplicacaoVigentes(tx: Prisma.TransactionClient, aplicacaoId: string) {
  const aplicacao = await tx.aplicacaoReconferenciaDeltaDesistencia.findUnique({ where: { id: aplicacaoId }, include: {
    decisaoFinanceira: { include: { decisor: { select: { ativo: true, papeis: true, permissoes: true } } } },
    proposta: { include: { decisaoAdministrativa: { include: { decisor: { select: { ativo: true, papeis: true } } } } } },
  } });
  const financeira = aplicacao?.decisaoFinanceira;
  const administrativa = aplicacao?.proposta.decisaoAdministrativa;
  return Boolean(financeira?.aprovada && administrativa?.aprovada
    && financeira.decisorId !== aplicacao?.proposta.preparadorId
    && administrativa.decisorId !== aplicacao?.proposta.preparadorId
    && financeira.decisor.ativo
    && (financeira.decisor.papeis.includes(Papel.ADMINISTRADOR)
      || (financeira.decisor.papeis.includes(Papel.FINANCEIRO) && financeira.decisor.permissoes.includes("financeiro.aprovar_acertos")))
    && administrativa.decisor.ativo && administrativa.decisor.papeis.includes(Papel.ADMINISTRADOR));
}

/** Prepara somente a diferença contra a última aplicação da cadeia Q165. */
export async function prepararReconferenciaDeltaDesistencia(input: z.input<typeof prepararSchema>): Promise<Resultado<{ id: string; estado: EstadoReconferenciaDeltaDesistencia }>> {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = prepararSchema.parse(input);
    return prisma.$transaction(async tx => {
      await financeiroPreparador(tx, ator.id);
      const base = await tx.aplicacaoAcertoDesistenciaContratual.findUniqueOrThrow({
        where: { id: dados.aplicacaoBaseId }, include: { decisao: { include: { proposta: { include: { pedido: true } } } } },
      });
      const pedido = base.decisao.proposta.pedido;
      await bloquearMatriculas(tx, [pedido.matriculaId]);
      const replay = await tx.propostaReconferenciaDeltaDesistencia.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: ator.id, chaveIdempotencia: dados.chaveIdempotencia } } });
      if (replay) {
        if (replay.aplicacaoBaseId !== base.id || motivoMemoriaDelta(replay.memoriaDelta) !== dados.motivo) throw new ErroRegra("Chave de idempotência já pertence a outra reconferência.");
        return { id: replay.id, estado: replay.estado };
      }
      const anterior = await tx.aplicacaoReconferenciaDeltaDesistencia.findFirst({ where: { aplicacaoBaseId: base.id }, orderBy: ordemDelta });
      const fontes = await carregarFontesReconferenciaDeltaTx(tx, pedido.matriculaId, base.memoria);
      const fotografiaHash = hashSubstituicao(fontes.fotografia);
      // Cada aplicação criada a partir de Q165.255 deixa uma leitura posterior
      // imutável. Ela é a única âncora segura para saber se houve fato novo.
      // Aplicações antigas não a possuem: uma nova proposta pode reancorar a
      // cadeia quando houver fonte nova ou quando a alçada anterior perdeu
      // validade. Ela nunca reescreve a aplicação histórica a partir do saldo
      // presente.
      const fotografiaBaseAnterior = anterior?.fotografiaPosteriorHash ?? anterior?.fotografiaHash;
      const revisaoAutorizacao = Boolean(anterior && fotografiaHash === fotografiaBaseAnterior
        && !(await decisoesDaAplicacaoVigentes(tx, anterior.id)));
      if (anterior && fotografiaHash === fotografiaBaseAnterior && !revisaoAutorizacao) {
        throw new ErroRegra("Nenhum fato financeiro novo ocorreu desde a última reconferência delta.");
      }
      const fotografiaAnteriorHash = anterior?.fotografiaPosteriorHash ?? anterior?.fotografiaHash ?? base.fotografiaHash;
      const calculo = calcularReconferenciaDelta(fontes.fatos, fontes.obrigacoes, fotografiaAnteriorHash, fotografiaHash);
      const estado = calculo.tipo === "PENDENCIA" ? EstadoReconferenciaDeltaDesistencia.PENDENCIA_FINANCEIRA : EstadoReconferenciaDeltaDesistencia.PENDENTE;
      const proposta = await tx.propostaReconferenciaDeltaDesistencia.create({ data: {
        aplicacaoBaseId: base.id, aplicacaoDeltaAnteriorId: anterior?.id, versao: (await tx.propostaReconferenciaDeltaDesistencia.count({ where: { aplicacaoBaseId: base.id } })) + 1,
        pedidoId: pedido.id, condicoesId: base.decisao.proposta.condicoesId, preparadorId: ator.id,
        estadoHash: base.decisao.proposta.estadoHash, condicoesHash: base.condicoesHash,
        fotografiaAnteriorHash, fotografiaHash, fotografia: fontes.fotografia as Prisma.InputJsonObject,
        memoriaDelta: { motivo: dados.motivo, tipo: calculo.tipo, ...(revisaoAutorizacao ? { revisaoAutorizacao: true } : {}), ...(calculo.tipo === "PENDENCIA" ? { pendencia: calculo.motivo } : {}), itens: calculo.itens, creditosExternos: fontes.creditosExternos, creditosDoAcerto: fontes.creditosDoAcerto } as Prisma.InputJsonObject,
        estado, chaveIdempotencia: dados.chaveIdempotencia,
      } });
      await registrarEvento(tx, { tipo: "ReconferenciaDeltaDesistenciaPreparada", agregadoTipo: "Matricula", agregadoId: pedido.matriculaId, autorId: ator.id, payload: { propostaId: proposta.id, aplicacaoBaseId: base.id, fotografiaHash } });
      return { id: proposta.id, estado };
    });
  });
}

export async function decidirReconferenciaDeltaDesistencia(input: z.input<typeof decidirSchema>): Promise<Resultado<{ id: string; aprovada: boolean }>> {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = decidirSchema.parse(input);
    return prisma.$transaction(async tx => {
      await financeiroAprovador(tx, ator.id);
      const proposta = await tx.propostaReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: dados.propostaId }, include: { decisaoFinanceira: true, aplicacaoBase: { include: { decisao: { include: { proposta: { include: { pedido: true } } } } } } } });
      await bloquearMatriculas(tx, [proposta.aplicacaoBase.decisao.proposta.pedido.matriculaId]);
      const fontesAtuais = await carregarFontesReconferenciaDeltaTx(tx, proposta.aplicacaoBase.decisao.proposta.pedido.matriculaId, proposta.aplicacaoBase.memoria);
      const ultimaAplicacao = await tx.aplicacaoReconferenciaDeltaDesistencia.findFirst({ where: { aplicacaoBaseId: proposta.aplicacaoBaseId }, orderBy: ordemDelta });
      if (hashSubstituicao(fontesAtuais.fotografia) !== proposta.fotografiaHash || !mesmosCreditosExternos(fontesAtuais.creditosExternos, creditosExternosMemoria(proposta.memoriaDelta)) || (ultimaAplicacao?.id ?? null) !== proposta.aplicacaoDeltaAnteriorId) throw new ErroRegra("As fontes, créditos externos ou a cadeia delta mudaram; prepare nova reconferência.");
      if (proposta.decisaoFinanceira) {
        if (proposta.decisaoFinanceira.decisorId !== ator.id || proposta.decisaoFinanceira.aprovada !== dados.aprovada || proposta.decisaoFinanceira.chaveIdempotencia !== dados.chaveIdempotencia || proposta.decisaoFinanceira.motivo !== dados.motivo) throw new ErroRegra("Reconferência já decidida com outros dados.");
        return { id: proposta.decisaoFinanceira.id, aprovada: proposta.decisaoFinanceira.aprovada };
      }
      if (proposta.preparadorId === ator.id || proposta.fotografiaHash !== dados.fotografiaHash) throw new ErroRegra("Decisão financeira deve ser independente e corresponder à fotografia.");
      if (dados.aprovada && proposta.estado !== EstadoReconferenciaDeltaDesistencia.PENDENTE) throw new ErroRegra("Pendência financeira impede aprovação da reconferência.");
      const decisao = await tx.decisaoReconferenciaDeltaDesistencia.create({ data: { propostaId: proposta.id, decisorId: ator.id, aprovada: dados.aprovada, motivo: dados.motivo, fotografiaHash: proposta.fotografiaHash, chaveIdempotencia: dados.chaveIdempotencia } });
      await registrarEvento(tx, { tipo: "ReconferenciaDeltaDesistenciaDecidida", agregadoTipo: "Matricula", agregadoId: proposta.aplicacaoBase.decisao.proposta.pedido.matriculaId, autorId: ator.id, payload: { propostaId: proposta.id, decisaoId: decisao.id, aprovada: dados.aprovada } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}

export async function decidirAdministrativamenteReconferenciaDeltaDesistencia(input: z.input<typeof decidirSchema>): Promise<Resultado<{ id: string; aprovada: boolean }>> {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = decidirSchema.parse(input);
    return prisma.$transaction(async tx => {
      await administrador(tx, ator.id);
      const proposta = await tx.propostaReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: dados.propostaId }, include: { decisaoAdministrativa: true, aplicacaoBase: { include: { decisao: { include: { proposta: { include: { pedido: true } } } } } } } });
      await bloquearMatriculas(tx, [proposta.aplicacaoBase.decisao.proposta.pedido.matriculaId]);
      const fontesAtuais = await carregarFontesReconferenciaDeltaTx(tx, proposta.aplicacaoBase.decisao.proposta.pedido.matriculaId, proposta.aplicacaoBase.memoria);
      const ultimaAplicacao = await tx.aplicacaoReconferenciaDeltaDesistencia.findFirst({ where: { aplicacaoBaseId: proposta.aplicacaoBaseId }, orderBy: ordemDelta });
      if (hashSubstituicao(fontesAtuais.fotografia) !== proposta.fotografiaHash || !mesmosCreditosExternos(fontesAtuais.creditosExternos, creditosExternosMemoria(proposta.memoriaDelta)) || (ultimaAplicacao?.id ?? null) !== proposta.aplicacaoDeltaAnteriorId) throw new ErroRegra("As fontes, créditos externos ou a cadeia delta mudaram; prepare nova reconferência.");
      if (proposta.decisaoAdministrativa) {
        if (proposta.decisaoAdministrativa.decisorId !== ator.id || proposta.decisaoAdministrativa.aprovada !== dados.aprovada || proposta.decisaoAdministrativa.chaveIdempotencia !== dados.chaveIdempotencia || proposta.decisaoAdministrativa.motivo !== dados.motivo) throw new ErroRegra("Reconferência já decidida com outros dados.");
        return { id: proposta.decisaoAdministrativa.id, aprovada: proposta.decisaoAdministrativa.aprovada };
      }
      if (proposta.preparadorId === ator.id || proposta.fotografiaHash !== dados.fotografiaHash) throw new ErroRegra("Decisão administrativa deve ser independente e corresponder à fotografia.");
      if (dados.aprovada && proposta.estado !== EstadoReconferenciaDeltaDesistencia.PENDENTE) throw new ErroRegra("Pendência financeira impede aprovação da reconferência.");
      const decisao = await tx.decisaoAdministrativaReconferenciaDeltaDesistencia.create({ data: { propostaId: proposta.id, decisorId: ator.id, aprovada: dados.aprovada, motivo: dados.motivo, fotografiaHash: proposta.fotografiaHash, chaveIdempotencia: dados.chaveIdempotencia } });
      await registrarEvento(tx, { tipo: "ReconferenciaDeltaDesistenciaAdministrativaDecidida", agregadoTipo: "Matricula", agregadoId: proposta.aplicacaoBase.decisao.proposta.pedido.matriculaId, autorId: ator.id, payload: { propostaId: proposta.id, decisaoId: decisao.id, aprovada: dados.aprovada } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}

export async function aplicarReconferenciaDeltaDesistencia(input: z.input<typeof aplicarSchema>): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = aplicarSchema.parse(input);
    return prisma.$transaction(async tx => {
      await financeiroAprovador(tx, ator.id);
      const decisao = await tx.decisaoReconferenciaDeltaDesistencia.findUniqueOrThrow({ where: { id: dados.decisaoFinanceiraId }, include: { proposta: { include: { decisaoAdministrativa: true, aplicacaoBase: { include: { decisao: { include: { proposta: { include: { pedido: true } } } } } } } }, aplicacao: true } });
      const proposta = decisao.proposta;
      const matriculaId = proposta.aplicacaoBase.decisao.proposta.pedido.matriculaId;
      await bloquearMatriculas(tx, [matriculaId]);
      if (!decisao.aprovada || !proposta.decisaoAdministrativa?.aprovada || decisao.decisorId !== ator.id) throw new ErroRegra("Aplicação delta exige ambas as decisões aprovadas e executor financeiro independente.");
      const replay = await tx.aplicacaoReconferenciaDeltaDesistencia.findUnique({ where: { executorId_chaveIdempotencia: { executorId: ator.id, chaveIdempotencia: dados.chaveIdempotencia } } });
      if (replay) { if (replay.decisaoFinanceiraId !== decisao.id) throw new ErroRegra("Chave de idempotência já pertence a outra aplicação delta."); return { id: replay.id }; }
      if (proposta.estado !== EstadoReconferenciaDeltaDesistencia.PENDENTE || decisao.aplicacao) throw new ErroRegra("Decisão financeira delta já aplicada ou não está pendente.");
      const fontes = await carregarFontesReconferenciaDeltaTx(tx, matriculaId, proposta.aplicacaoBase.memoria);
      const atual = hashSubstituicao(fontes.fotografia);
      if (atual !== proposta.fotografiaHash || !mesmosCreditosExternos(fontes.creditosExternos, creditosExternosMemoria(proposta.memoriaDelta))) throw new ErroRegra("As fontes financeiras ou créditos externos mudaram; prepare nova reconferência.");
      const calculo = calcularReconferenciaDelta(fontes.fatos, fontes.obrigacoes, proposta.fotografiaAnteriorHash, atual);
      if (calculo.tipo === "PENDENCIA") throw new ErroRegra("A reconferência possui pendência financeira.");
      const anterior = await tx.aplicacaoReconferenciaDeltaDesistencia.findFirst({ where: { aplicacaoBaseId: proposta.aplicacaoBaseId }, orderBy: ordemDelta });
      if ((anterior?.id ?? null) !== proposta.aplicacaoDeltaAnteriorId) throw new ErroRegra("A cadeia delta foi atualizada por outra aplicação.");
      const aplicacao = await tx.aplicacaoReconferenciaDeltaDesistencia.create({ data: { propostaId: proposta.id, decisaoFinanceiraId: decisao.id, aplicacaoBaseId: proposta.aplicacaoBaseId, aplicacaoDeltaAnteriorId: anterior?.id, executorId: ator.id, fotografiaHash: atual, fotografia: fontes.fotografia as Prisma.InputJsonObject, memoriaDelta: proposta.memoriaDelta as Prisma.InputJsonValue, chaveIdempotencia: dados.chaveIdempotencia } });
      const cobrancas = await tx.cobranca.findMany({ where: { matriculaId } });
      for (const item of calculo.itens) {
        const cobranca = cobrancas.find(x => x.id === item.cobrancaId);
        if (!cobranca || cobranca.moeda !== item.moeda) throw new ErroRegra("Cobrança delta divergente.");
        const saldo = new Prisma.Decimal(item.saldoAlvo);
        const valorNegociado = new Prisma.Decimal(item.devidoAlvo);
        const status = saldo.isZero() ? StatusCobranca.PAGO : cobranca.status;
        const semAlteracao = cobranca.valorNegociado.equals(valorNegociado)
          && (cobranca.saldo?.equals(saldo) ?? false)
          && cobranca.status === status;
        if (!semAlteracao) {
          await tx.cobranca.update({ where: { id: cobranca.id }, data: {
            valorNegociado, saldo, status, versao: { increment: 1 },
          } });
        }
        const novoCredito = new Prisma.Decimal(item.creditoDelta);
        if (novoCredito.gt(0)) {
          const origem = await tx.origemCreditoReconferenciaDeltaDesistencia.create({ data: { aplicacaoId: aplicacao.id, matriculaId, cobrancaId: cobranca.id, valor: novoCredito, moeda: item.moeda } });
          await tx.creditoMatricula.create({ data: { matriculaId, origemReconferenciaDeltaDesistenciaId: origem.id, valorInicial: novoCredito, moeda: item.moeda } });
        }
      }
      const reconhecidos = await tx.reconhecimentoCreditoReconferenciaDeltaDesistencia.findMany({
        where: { creditoId: { in: fontes.creditosExternos.map(credito => credito.id) } }, select: { creditoId: true },
      });
      const jaReconhecidos = new Set(reconhecidos.map(reconhecimento => reconhecimento.creditoId));
      for (const credito of fontes.creditosExternos.filter(credito => !jaReconhecidos.has(credito.id) && new Prisma.Decimal(credito.saldoDisponivel).gt(0))) {
        await tx.reconhecimentoCreditoReconferenciaDeltaDesistencia.create({ data: { aplicacaoId: aplicacao.id, creditoId: credito.id, valor: new Prisma.Decimal(credito.saldoDisponivel) } });
      }
      const fontesPosteriores = await carregarFontesReconferenciaDeltaTx(tx, matriculaId, proposta.aplicacaoBase.memoria);
      const fotografiaPosteriorHash = hashSubstituicao(fontesPosteriores.fotografia);
      await tx.aplicacaoReconferenciaDeltaDesistencia.update({ where: { id: aplicacao.id }, data: {
        fotografiaPosteriorHash,
        fotografiaPosterior: fontesPosteriores.fotografia as Prisma.InputJsonObject,
      } });
      await tx.propostaReconferenciaDeltaDesistencia.update({ where: { id: proposta.id }, data: { estado: EstadoReconferenciaDeltaDesistencia.APLICADA } });
      await registrarEvento(tx, { tipo: "ReconferenciaDeltaDesistenciaAplicada", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: ator.id, payload: { aplicacaoId: aplicacao.id, propostaId: proposta.id } });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: aplicacao.id };
    });
  });
}



