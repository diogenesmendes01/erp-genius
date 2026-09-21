"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { DataCivilSchema } from "./cobertura";
import { conferirCorrecaoPeriodoRelato, diasRemovidosPelaCorrecao } from "./indisponibilidade-oferta-correcao-regras";

const DataPersistivelSchema = DataCivilSchema.refine((data) => data >= "0001-01-01", "Data fora do intervalo persistível.");
const TextoMotivoSchema = z.string().trim().min(5).max(2_000);
const TextoEvidenciaSchema = z.string().trim().min(5).max(4_000);

const ProporCorrecaoSchema = z.object({
  registroId: z.string().min(1), inicio: DataPersistivelSchema, fim: DataPersistivelSchema.nullable(),
  motivo: TextoMotivoSchema, evidenciaTexto: TextoEvidenciaSchema, chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();
const DecidirCorrecaoSchema = z.object({ propostaId: z.string().min(1), aprovada: z.boolean(), motivo: TextoMotivoSchema, evidenciaTexto: TextoEvidenciaSchema }).strict();
const ConsultarCorrecoesSchema = z.object({ registroId: z.string().min(1), pagina: z.number().int().min(1).max(100_000).default(1) }).strict();

const dataUtc = (data: string) => new Date(`${data}T00:00:00.000Z`);
const dataCivil = (data: Date) => data.toISOString().slice(0, 10);
const civilOuNull = (data: Date | null) => (data ? dataCivil(data) : null);
const podePropor = (papeis: Papel[]) => papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
const podeDecidir = (papeis: Papel[]) => papeis.includes(Papel.GERENTE_PEDAGOGICO) || papeis.includes(Papel.ADMINISTRADOR);

async function conferirAutorAtual(tx: Prisma.TransactionClient, autorId: string, acao: "PROPOR" | "DECIDIR" | "CONSULTAR") {
  if (acao !== "CONSULTAR") await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  const papeis = autor?.papeis ?? [];
  const autorizado = acao === "DECIDIR" ? podeDecidir(papeis) : acao === "PROPOR" ? podePropor(papeis) : podePropor(papeis) || papeis.includes(Papel.FINANCEIRO);
  if (!autor?.ativo || !autorizado) throw new ErroPermissao();
  return autor;
}

async function bloquearContextoRegistro(tx: Prisma.TransactionClient, registroId: string, matriculaId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [matriculaId]);
  await tx.$queryRaw`SELECT id FROM "RegistroIndisponibilidadeOfertaMatricula" WHERE id = ${registroId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "PropostaCorrecaoRelatoIndisponibilidadeOferta" WHERE "registroId" = ${registroId} FOR UPDATE`;
}

async function carregarRelatoTx(tx: Prisma.TransactionClient, registroId: string, matriculaId: string) {
  const relato = await tx.registroIndisponibilidadeOfertaMatricula.findFirst({
    where: { id: registroId, matriculaId },
    select: { id: true, matriculaId: true, inicio: true, fim: true, confirmacao: { select: { confirmada: true } },
      propostasTermino: { where: { decisao: { is: { aprovada: true } } }, take: 1, select: { fim: true } } },
  });
  if (!relato) throw new ErroRegra("Relato de indisponibilidade não encontrado nesta matrícula.");
  if (!relato.confirmacao?.confirmada) throw new ErroRegra("Somente relato confirmado como indisponível admite correção de período.");
  return { ...relato, periodo: { inicio: dataCivil(relato.inicio), fim: civilOuNull(relato.fim) }, termino: civilOuNull(relato.propostasTermino[0]?.fim ?? null) };
}

/** Dias que deixam de ser cobertos não podem já sustentar compensação ou período integral aprovados. */
async function conferirEfeitosJaAprovadosTx(tx: Prisma.TransactionClient, matriculaId: string, removidos: Array<{ inicio: string; fim: string }>) {
  for (const intervalo of removidos) {
    const inicio = dataUtc(intervalo.inicio), fim = dataUtc(intervalo.fim);
    const compensado = await tx.diaCompensacaoCobertura.findFirst({ where: { matriculaId, diaOrigem: { gte: inicio, lte: fim }, compensacao: { status: "APROVADA" } }, select: { id: true } });
    if (compensado) throw new ErroRegra("A correção retira dias que já sustentam compensação aprovada. Trate a compensação antes de corrigir o relato.");
    const integral = await tx.propostaPeriodoIntegral.findFirst({ where: { matriculaId, decisao: { is: { aprovada: true } }, cobranca: { coberturaInicio: { lte: fim }, coberturaFim: { gte: inicio } } }, select: { id: true } });
    if (integral) throw new ErroRegra("A correção retira dias de um período integral já aprovado. Trate o período integral antes de corrigir o relato.");
  }
}

type PropostaComDecisao = Prisma.PropostaCorrecaoRelatoIndisponibilidadeOfertaGetPayload<{ include: { decisao: true } }>;
function projetarProposta(p: PropostaComDecisao | (Omit<PropostaComDecisao, "decisao"> & { decisao?: PropostaComDecisao["decisao"] })) {
  return {
    id: p.id, registroId: p.registroId, versao: p.versao,
    anterior: { inicio: dataCivil(p.inicioAnterior), fim: civilOuNull(p.fimAnterior) }, novo: { inicio: dataCivil(p.inicioNovo), fim: civilOuNull(p.fimNovo) },
    motivo: p.motivo, evidenciaTexto: p.evidenciaTexto, criadaEm: p.criadaEm.toISOString(),
    decisao: p.decisao ? { id: p.decisao.id, aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, evidenciaTexto: p.decisao.evidenciaTexto, decididaEm: p.decisao.decididaEm.toISOString() } : null,
  };
}

/** Propõe novo período para relato confirmado. Não altera o relato, cobranças nem compensações. */
export async function proporCorrecaoRelatoIndisponibilidadeOferta(input: z.input<typeof ProporCorrecaoSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = ProporCorrecaoSchema.parse(input), entradaHash = hashSubstituicao(dados);
    const referencia = await prisma.registroIndisponibilidadeOfertaMatricula.findUnique({ where: { id: dados.registroId }, select: { matriculaId: true } });
    if (!referencia) throw new ErroRegra("Relato de indisponibilidade não encontrado.");
    return prisma.$transaction(async (tx) => {
      await bloquearContextoRegistro(tx, dados.registroId, referencia.matriculaId);
      const relato = await carregarRelatoTx(tx, dados.registroId, referencia.matriculaId);
      await conferirAutorAtual(tx, sessao.id, "PROPOR");
      const repetida = await tx.propostaCorrecaoRelatoIndisponibilidadeOferta.findUnique({ where: { autorId_chaveIdempotencia: { autorId: sessao.id, chaveIdempotencia: dados.chaveIdempotencia } }, include: { decisao: true } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave de idempotência já usada para outra correção.");
        return projetarProposta(repetida);
      }
      const novo = { inicio: dados.inicio, fim: dados.fim };
      conferirCorrecaoPeriodoRelato(relato.periodo, novo, relato.termino);
      if (await tx.propostaCorrecaoRelatoIndisponibilidadeOferta.count({ where: { registroId: relato.id, decisao: null } })) throw new ErroRegra("Já existe correção aguardando decisão para este relato.");
      await conferirEfeitosJaAprovadosTx(tx, relato.matriculaId, diasRemovidosPelaCorrecao(relato.periodo, novo, relato.termino));
      const ultima = await tx.propostaCorrecaoRelatoIndisponibilidadeOferta.findFirst({ where: { registroId: relato.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const proposta = await tx.propostaCorrecaoRelatoIndisponibilidadeOferta.create({ data: {
        registroId: relato.id, versao: (ultima?.versao ?? 0) + 1, inicioAnterior: relato.inicio, fimAnterior: relato.fim, inicioNovo: dataUtc(dados.inicio), fimNovo: dados.fim ? dataUtc(dados.fim) : null,
        motivo: dados.motivo, evidenciaTexto: dados.evidenciaTexto, autorId: sessao.id, chaveIdempotencia: dados.chaveIdempotencia, entradaHash,
      } });
      await registrarEvento(tx, { tipo: "CorrecaoRelatoIndisponibilidadeOfertaProposta", agregadoTipo: "Matricula", agregadoId: relato.matriculaId, autorId: sessao.id,
        payload: { relatoId: relato.id, propostaId: proposta.id, versao: proposta.versao, anterior: relato.periodo, novo } });
      return projetarProposta(proposta);
    }, { timeout: 20_000 });
  });
}

/** Decide a correção. Aprovada, o relato passa a refletir o novo período na mesma transação. */
export async function decidirCorrecaoRelatoIndisponibilidadeOferta(input: z.input<typeof DecidirCorrecaoSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const dados = DecidirCorrecaoSchema.parse(input), entradaHash = hashSubstituicao(dados);
    const referencia = await prisma.propostaCorrecaoRelatoIndisponibilidadeOferta.findUnique({ where: { id: dados.propostaId }, select: { registroId: true, registro: { select: { matriculaId: true } } } });
    if (!referencia) throw new ErroRegra("Proposta de correção não encontrada.");
    return prisma.$transaction(async (tx) => {
      await bloquearContextoRegistro(tx, referencia.registroId, referencia.registro.matriculaId);
      const proposta = await tx.propostaCorrecaoRelatoIndisponibilidadeOferta.findUniqueOrThrow({ where: { id: dados.propostaId }, include: { decisao: true } });
      await conferirAutorAtual(tx, sessao.id, "DECIDIR");
      if (proposta.decisao) {
        if (proposta.decisao.decisorId === sessao.id && proposta.decisao.entradaHash === entradaHash) return projetarProposta(proposta);
        throw new ErroRegra("Esta correção já possui decisão.");
      }
      if (proposta.autorId === sessao.id) throw new ErroRegra("Outra pessoa deve decidir a correção do relato.");
      const relato = await carregarRelatoTx(tx, proposta.registroId, referencia.registro.matriculaId);
      const novo = { inicio: dataCivil(proposta.inicioNovo), fim: civilOuNull(proposta.fimNovo) };
      if (dados.aprovada) {
        if (dataCivil(proposta.inicioAnterior) !== relato.periodo.inicio || civilOuNull(proposta.fimAnterior) !== relato.periodo.fim) throw new ErroRegra("O período do relato mudou depois da proposta; prepare nova correção.");
        conferirCorrecaoPeriodoRelato(relato.periodo, novo, relato.termino);
        await conferirEfeitosJaAprovadosTx(tx, relato.matriculaId, diasRemovidosPelaCorrecao(relato.periodo, novo, relato.termino));
      }
      const decisao = await tx.decisaoCorrecaoRelatoIndisponibilidadeOferta.create({ data: { propostaId: proposta.id, decisorId: sessao.id, aprovada: dados.aprovada, motivo: dados.motivo, evidenciaTexto: dados.evidenciaTexto, entradaHash } });
      // O trigger do relato só aceita este UPDATE porque a decisão aprovada acima o respalda.
      if (dados.aprovada) await tx.registroIndisponibilidadeOfertaMatricula.update({ where: { id: relato.id }, data: { inicio: proposta.inicioNovo, fim: proposta.fimNovo } });
      await registrarEvento(tx, { tipo: "CorrecaoRelatoIndisponibilidadeOfertaDecidida", agregadoTipo: "Matricula", agregadoId: relato.matriculaId, autorId: sessao.id,
        payload: { relatoId: relato.id, propostaId: proposta.id, decisaoId: decisao.id, aprovada: dados.aprovada, anterior: relato.periodo, novo } });
      return projetarProposta({ ...proposta, decisao });
    }, { timeout: 20_000 });
  });
}

/** Histórico versionado das correções, com o período vigente do relato. */
export async function consultarCorrecoesRelatoIndisponibilidadeOferta(input: z.input<typeof ConsultarCorrecoesSchema>) {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = ConsultarCorrecoesSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const autor = await conferirAutorAtual(tx, sessao.id, "CONSULTAR");
      const relato = await tx.registroIndisponibilidadeOfertaMatricula.findUnique({ where: { id: dados.registroId },
        select: { id: true, matriculaId: true, inicio: true, fim: true, confirmacao: { select: { confirmada: true } }, propostasTermino: { where: { decisao: { is: { aprovada: true } } }, take: 1, select: { fim: true } } } });
      if (!relato) throw new ErroRegra("Relato de indisponibilidade não encontrado.");
      const propostas = await tx.propostaCorrecaoRelatoIndisponibilidadeOferta.findMany({ where: { registroId: relato.id }, orderBy: { versao: "desc" }, skip: (dados.pagina - 1) * 20, take: 21, include: { decisao: true, autor: { select: { nome: true } } } });
      const pendente = propostas.find((p) => !p.decisao) ?? (dados.pagina > 1 ? await tx.propostaCorrecaoRelatoIndisponibilidadeOferta.findFirst({ where: { registroId: relato.id, decisao: null }, include: { decisao: true, autor: { select: { nome: true } } } }) : null);
      return {
        relato: { id: relato.id, matriculaId: relato.matriculaId, inicio: dataCivil(relato.inicio), fim: civilOuNull(relato.fim), terminoAprovado: civilOuNull(relato.propostasTermino[0]?.fim ?? null), confirmado: !!relato.confirmacao?.confirmada },
        podePropor: podePropor(autor.papeis) && !!relato.confirmacao?.confirmada && !pendente,
        podeDecidir: !!pendente && podeDecidir(autor.papeis) && pendente.autorId !== sessao.id,
        pendenteId: pendente?.id ?? null, pagina: dados.pagina, temProxima: propostas.length > 20,
        propostas: propostas.slice(0, 20).map((p) => ({ ...projetarProposta(p), autorNome: p.autor.nome })),
      };
    });
  });
}
