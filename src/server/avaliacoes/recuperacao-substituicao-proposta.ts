"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { conferirSubstituicaoRecuperacaoTx } from "./recuperacao-substituicao-tx";
import { hashAgendaRecuperacao } from "./recuperacao-agenda-estado";
import { identificarMatriculaAvaliacao } from "./identificacao";

const id = z.string().min(1).max(100);
const schema = z.object({ itemReservaId: id, substitutoId: id, motivo: z.string().trim().min(5).max(2000), estadoConferido: z.string().regex(/^[a-f0-9]{64}$/), versaoEsperada: z.number().int().min(0).max(2147483646), chaveIdempotencia: z.string().min(8).max(100) }).strict();
const resumo = z.object({ inicio: z.string(), fim: z.string(), fusoOrigem: z.string(), avaliadorAtual: z.string(), substituto: z.string(), versaoDesignacao: z.number().int(), prazoVigente: z.string(), pendencias: z.array(z.string()) });
const decisaoSchema = z.object({ propostaId: id, aprovar: z.boolean(), propostaHash: z.string().regex(/^[a-f0-9]{64}$/), motivo: z.string().trim().min(5).max(2000) }).strict();
type DecisaoPersistida = { id: string; decisorId: string; aprovada: boolean; motivo: string; decididaEm: Date; decisor: string };

async function decisaoDaPropostaTx(tx: Prisma.TransactionClient, propostaId: string) {
  const [decisao] = await tx.$queryRaw<DecisaoPersistida[]>`
    SELECT d.id, d."decisorId", d.aprovada, d.motivo, d."decididaEm", u.nome AS decisor
    FROM "DecisaoSubstituicaoRecuperacao" d JOIN "Usuario" u ON u.id=d."decisorId"
    WHERE d."propostaId"=${propostaId}`;
  return decisao ?? null;
}
export async function proporSubstituicaoRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!ref) throw new ErroRegra("Tentativa não encontrada.");
      const a = await bloquearLancamento(tx, ref.reserva.proposta.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const entradaHash = hashAgendaRecuperacao(d);
      const repetida = await tx.propostaSubstituicaoRecuperacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra proposta de substituição.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const conferencia = await conferirSubstituicaoRecuperacaoTx(tx, u.id, d);
      if (hashAgendaRecuperacao(conferencia) !== d.estadoConferido) throw new ErroRegra("A conferência mudou. Confira novamente antes de guardar a proposta.");
      const ultima = await tx.propostaSubstituicaoRecuperacao.findFirst({ where: { encontroId: conferencia.encontroId }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe proposta mais recente. Atualize a consulta.");
      const p = await tx.propostaSubstituicaoRecuperacao.create({ data: { encontroId: conferencia.encontroId, autorId: u.id, substitutoId: d.substitutoId, versao: d.versaoEsperada + 1, motivo: d.motivo, snapshot: conferencia, entradaHash, chaveIdempotencia: d.chaveIdempotencia } });
      await registrarEvento(tx, { tipo: "SubstituicaoRecuperacaoProposta", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { propostaId: p.id, encontroId: p.encontroId, itemReservaId: d.itemReservaId, versao: p.versao, substitutoId: d.substitutoId } });
      return { id: p.id, versao: p.versao };
    });
  });
}

/** A aprovação é aplicada pela trigger da decisão: designação e encontro mudam ou ambos revertem. */
export async function decidirSubstituicaoRecuperacao(input: z.input<typeof decisaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decisaoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const p = await tx.propostaSubstituicaoRecuperacao.findUnique({ where: { id: d.propostaId } });
      if (!p) throw new ErroRegra("Proposta de substituição não encontrada.");
      const ref = await tx.encontroAgenda.findUnique({ where: { id: p.encontroId }, select: { propostaAgendaRecuperacao: { select: { itemReserva: { select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } } } } } });
      if (!ref?.propostaAgendaRecuperacao) throw new ErroRegra("A proposta não possui a origem da agenda publicada.");
      const a = await bloquearLancamento(tx, ref.propostaAgendaRecuperacao.itemReserva.reserva.proposta.alocacaoId);
      await conferirGestorAvaliacao(tx, u.id);
      if (d.propostaHash !== hashAgendaRecuperacao(p.snapshot)) throw new ErroRegra("Atualize a proposta antes de decidir.");
      if (p.autorId === u.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a proposta.");
      const anterior = await decisaoDaPropostaTx(tx, p.id);
      if (anterior) {
        if (anterior.decisorId !== u.id || anterior.aprovada !== d.aprovar || anterior.motivo !== d.motivo) throw new ErroRegra("A proposta já foi decidida.");
        return { id: anterior.id, aplicada: anterior.aprovada };
      }
      if (d.aprovar) {
        const ultima = await tx.propostaSubstituicaoRecuperacao.findFirstOrThrow({ where: { encontroId: p.encontroId }, orderBy: { versao: "desc" }, select: { id: true } });
        if (ultima.id !== p.id) throw new ErroRegra("Proposta superada; confira a versão mais recente.");
        const conferencia = await conferirSubstituicaoRecuperacaoTx(tx, u.id, { itemReservaId: z.object({ itemReservaId: id }).parse(p.snapshot).itemReservaId, substitutoId: p.substitutoId });
        if (!isDeepStrictEqual(p.snapshot, conferencia)) throw new ErroRegra("A conferência mudou. Prepare nova proposta antes de aprovar.");
        if (conferencia.pendencias.length) throw new ErroRegra("Resolva as pendências atuais antes de aprovar.");
      }
      const [decisao] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "DecisaoSubstituicaoRecuperacao" (id,"propostaId","decisorId",aprovada,motivo)
        VALUES (${`substituicao:${p.id}`},${p.id},${u.id},${d.aprovar},${d.motivo}) RETURNING id`;
      if (!decisao) throw new ErroRegra("Não foi possível registrar a decisão.");
      await registrarEvento(tx, { tipo: d.aprovar ? "SubstituicaoRecuperacaoAprovada" : "SubstituicaoRecuperacaoRejeitada", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id,
        payload: { propostaId: p.id, decisaoId: decisao.id, encontroId: p.encontroId, substitutoId: p.substitutoId, aprovada: d.aprovar, motivo: d.motivo } });
      return { id: decisao.id, aplicada: d.aprovar };
    });
  });
}
export async function consultarPropostasSubstituicaoRecuperacao(input: { itemReservaId: string; antesVersao?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ itemReservaId: id, antesVersao: z.number().int().positive().optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const item = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { habilidade: true, reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!item) throw new ErroRegra("Tentativa não encontrada.");
      const a = await bloquearLancamento(tx, item.reserva.proposta.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const e = await tx.encontroAgenda.findFirst({ where: { finalidade: "RECUPERACAO", propostaAgendaRecuperacao: { itemReservaId: d.itemReservaId, decisao: { aprovada: true } } }, select: { id: true, professorId: true, professor: { select: { nome: true } } } });
      if (!e) throw new ErroRegra("Tentativa sem agenda publicada.");
      const ultima = await tx.propostaSubstituicaoRecuperacao.findFirst({ where: { encontroId: e.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const propostas = await tx.propostaSubstituicaoRecuperacao.findMany({ where: { encontroId: e.id, ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}) }, orderBy: { versao: "desc" }, take: 21, include: { autor: { select: { nome: true } } } });
      const itens = [];
      for (const p of propostas.slice(0,20)) {
        let estadoMudou = false, impedimentoAtual: string | null = null;
        const decisao = await decisaoDaPropostaTx(tx, p.id);
        if (!decisao && p.versao === ultima?.versao) {
          try { estadoMudou = !isDeepStrictEqual(p.snapshot, await conferirSubstituicaoRecuperacaoTx(tx, u.id, { itemReservaId: d.itemReservaId, substitutoId: p.substitutoId })); }
          catch (erro) { if (!(erro instanceof ErroRegra)) throw erro; estadoMudou = true; impedimentoAtual = erro.message; }
        }
        const versaoAtual = p.versao === ultima?.versao;
        const conferenciaOriginal = resumo.parse(p.snapshot);
        itens.push({ id: p.id, versao: p.versao, autor: p.autor.nome, criadaEm: p.criadaEm.toISOString(), motivo: p.motivo, propostaHash: hashAgendaRecuperacao(p.snapshot), conferenciaOriginal,
          versaoAtual, revisaoIndependente: p.autorId !== u.id, estadoMudou, impedimentoAtual,
          decisao: decisao && { id: decisao.id, aprovada: decisao.aprovada, motivo: decisao.motivo, decididaEm: decisao.decididaEm.toISOString(), decisor: decisao.decisor },
          aplicada: decisao?.aprovada ?? false, avaliadorAplicado: decisao?.aprovada && e.professorId === p.substitutoId ? { id: e.professorId, nome: e.professor?.nome ?? "Não identificado" } : null,
          podeDecidir: !decisao && p.autorId !== u.id, podeAprovar: !decisao && p.autorId !== u.id && versaoAtual && conferenciaOriginal.pendencias.length === 0 && !estadoMudou && !impedimentoAtual });
      }
      return { itemReservaId: d.itemReservaId, habilidade: item.habilidade, identificacao: await identificarMatriculaAvaliacao(tx, a.matriculaId, a.turmaId), propostas: itens,
        versaoEsperada: ultima?.versao ?? 0, proximaAntesVersao: propostas.length > 20 ? propostas[19].versao : null };
    });
  });
}
