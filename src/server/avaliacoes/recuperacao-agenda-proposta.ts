"use server";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { DataHoraAvaliacaoSchema, instanteAvaliacaoLocal } from "./tempo";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { conferirAgendaRecuperacaoTx } from "./recuperacao-agenda-tx";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { baseAgendaRecuperacao as baseConferencia, hashAgendaRecuperacao } from "./recuperacao-agenda-estado";

const id = z.string().min(1).max(100);
const schema = z.object({ itemReservaId: id, inicioLocal: DataHoraAvaliacaoSchema, fimLocal: DataHoraAvaliacaoSchema, fuso: FusoInstitucionalSchema,
  versaoEsperada: z.number().int().min(0).max(2147483646), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
const resumoSchema = z.object({ professor: z.object({ id: z.string(), nome: z.string() }).nullable(), pendencias: z.array(z.string()), calendarioId: z.string().nullable(), prazoAte: z.string() });

export async function proporAgendaRecuperacao(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = schema.parse(input);
    const inicio = instanteAvaliacaoLocal(d.inicioLocal, d.fuso), fim = instanteAvaliacaoLocal(d.fimLocal, d.fuso);
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      const item = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true, matriculaId: true } } } } } });
      if (!item) throw new ErroRegra("Tentativa não encontrada.");
      await bloquearLancamento(tx, item.reserva.proposta.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const repetida = await tx.propostaAgendaRecuperacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra proposta de horário.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const ultima = await tx.propostaAgendaRecuperacao.findFirst({ where: { itemReservaId: d.itemReservaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe proposta mais recente. Atualize a conferência.");
      const conferencia = await conferirAgendaRecuperacaoTx(tx, u.id, { itemReservaId: d.itemReservaId, inicio, fim, fuso: d.fuso });
      const p = await tx.propostaAgendaRecuperacao.create({ data: { itemReservaId: d.itemReservaId, autorId: u.id, versao: d.versaoEsperada + 1, inicio, fim, fusoOrigem: d.fuso,
        motivo: d.motivo, snapshot: baseConferencia(conferencia), chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: "AgendaRecuperacaoProposta", agregadoTipo: "Matricula", agregadoId: item.reserva.proposta.matriculaId, autorId: u.id,
        payload: { propostaId: p.id, itemReservaId: p.itemReservaId, versao: p.versao } });
      return { id: p.id, versao: p.versao };
    });
  });
}

export async function consultarPropostasAgendaRecuperacao(input: { itemReservaId: string; antesVersao?: number }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = z.object({ itemReservaId: id, antesVersao: z.number().int().positive().optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const item = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { habilidade: true, reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!item) throw new ErroRegra("Tentativa não encontrada.");
      const alocacao = await bloquearLancamento(tx, item.reserva.proposta.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const agendaPublicada = await tx.propostaAgendaRecuperacao.count({ where: { itemReservaId: d.itemReservaId, decisao: { aprovada: true } } }) > 0;
      const ultima = await tx.propostaAgendaRecuperacao.findFirst({ where: { itemReservaId: d.itemReservaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const propostas = await tx.propostaAgendaRecuperacao.findMany({ where: { itemReservaId: d.itemReservaId, ...(d.antesVersao ? { versao: { lt: d.antesVersao } } : {}) }, orderBy: { versao: "desc" }, take: 21, include: { autor: { select: { nome: true } }, decisao: { include: { decisor: { select: { nome: true } } } }, encontro: { select: { id: true, status: true } } } });
      const itens = [];
      for (const p of propostas.slice(0,20)) {
        let estadoMudou = false, impedimentoAtual: string | null = null;
        if (!p.decisao && p.versao === ultima?.versao) {
          try { estadoMudou = !isDeepStrictEqual(p.snapshot, baseConferencia(await conferirAgendaRecuperacaoTx(tx, u.id, { itemReservaId: p.itemReservaId, inicio: p.inicio, fim: p.fim, fuso: p.fusoOrigem }))); }
          catch (erro) { if (!(erro instanceof ErroRegra)) throw erro; estadoMudou = true; impedimentoAtual = erro.message; }
        }
        itens.push({ id: p.id, versao: p.versao, inicio: p.inicio.toISOString(), fim: p.fim.toISOString(), fuso: p.fusoOrigem, motivo: p.motivo, autor: p.autor.nome,
          criadaEm: p.criadaEm.toISOString(), conferenciaOriginal: resumoSchema.parse(p.snapshot), estadoMudou, impedimentoAtual,
          versaoAtual: p.versao === ultima?.versao, revisaoIndependente: p.autorId !== u.id, publicacaoAutorizada: p.decisao?.aprovada ?? false,
          estadoConferido: p.autorId !== u.id && !p.decisao ? hashAgendaRecuperacao(p.snapshot) : null,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decisor: p.decisao.decisor.nome, criadaEm: p.decisao.criadaEm.toISOString(), autorizarDiaNaoLetivo: p.decisao.autorizarDiaNaoLetivo } : null,
          encontro: p.encontro });
      }
      return { itemReservaId: d.itemReservaId, agendaPublicada, identificacao: await identificarMatriculaAvaliacao(tx, alocacao.matriculaId, alocacao.turmaId), habilidade: item.habilidade, versaoEsperada: ultima?.versao ?? 0, proximaAntesVersao: propostas.length > 20 ? propostas[19].versao : null, propostas: itens };
    });
  });
}
