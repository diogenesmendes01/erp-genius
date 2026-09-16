"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";

const id = z.string().min(1).max(100), motivo = z.string().trim().min(5).max(2000);
const preparar = z.object({ disponibilizacaoId: id, prazoAnterior: z.string().datetime({ offset: true }), novoPrazo: z.string().datetime({ offset: true }), versaoEsperada: z.number().int().min(0).max(2147483646), motivo, chaveIdempotencia: z.string().min(8).max(100) }).strict();
const decidir = z.object({ propostaId: id, propostaHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo }).strict();

export async function proporProrrogacaoRecuperacao(input: z.input<typeof preparar>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO), original = preparar.parse(input);
    const d = { ...original, prazoAnterior: new Date(original.prazoAnterior).toISOString(), novoPrazo: new Date(original.novoPrazo).toISOString() };
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      const ref = await tx.disponibilizacaoPlanoRecuperacao.findUnique({ where: { id: d.disponibilizacaoId }, include: { proposta: true } });
      if (!ref) throw new ErroRegra("Disponibilização não encontrada.");
      await carregarConsolidadoAvaliacoesTx(tx, u.id, ref.proposta.alocacaoId, "BASE_PLANO");
      const repetida = await tx.propostaProrrogacaoRecuperacao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave já utilizada com outra prorrogação.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const m = await tx.matricula.findUniqueOrThrow({ where: { id: ref.proposta.matriculaId }, select: { status: true } });
      if (m.status !== "ATIVA") throw new ErroRegra("Prorrogação não substitui autorização após pausa ou encerramento.");
      const vigente = await prazoRecuperacaoVigente(tx, ref.id), novo = new Date(d.novoPrazo);
      if (vigente.toISOString() !== d.prazoAnterior || novo <= vigente || novo <= new Date()) throw new ErroRegra("Confira o prazo vigente e proponha um limite posterior, ainda futuro.");
      const ultima = await tx.propostaProrrogacaoRecuperacao.findFirst({ where: { disponibilizacaoId: ref.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe proposta de prorrogação mais recente.");
      const p = await tx.propostaProrrogacaoRecuperacao.create({ data: { disponibilizacaoId: ref.id, preparadorId: u.id, versao: d.versaoEsperada + 1, prazoAnterior: vigente, novoPrazo: novo, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: "ProrrogacaoRecuperacaoProposta", agregadoTipo: "Matricula", agregadoId: ref.proposta.matriculaId, autorId: u.id, payload: { propostaId: p.id, disponibilizacaoId: ref.id, versao: p.versao, prazoAnterior: vigente.toISOString(), novoPrazo: novo.toISOString() } });
      return { id: p.id, versao: p.versao };
    });
  });
}

export async function decidirProrrogacaoRecuperacao(input: z.input<typeof decidir>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decidir.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaProrrogacaoRecuperacao.findUnique({ where: { id: d.propostaId }, include: { disponibilizacao: { include: { proposta: true } } } });
      if (!ref) throw new ErroRegra("Prorrogação não encontrada.");
      const plano = ref.disponibilizacao.proposta;
      await bloquearLancamento(tx, plano.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const p = await tx.propostaProrrogacaoRecuperacao.findUniqueOrThrow({ where: { id: ref.id }, include: { decisao: true } });
      if (p.preparadorId === u.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a prorrogação.");
      if (p.entradaHash !== d.propostaHash) throw new ErroRegra("Confira a versão exata da prorrogação.");
      if (p.decisao) {
        if (p.decisao.decisorId === u.id && p.decisao.aprovada === d.aprovada && p.decisao.motivo === d.motivo) return { id: p.decisao.id };
        throw new ErroRegra("A prorrogação já possui decisão.");
      }
      if (d.aprovada) {
        if ((await tx.matricula.findUniqueOrThrow({ where: { id: plano.matriculaId }, select: { status: true } })).status !== "ATIVA") throw new ErroRegra("Confira a autorização específica da matrícula.");
        if (await tx.propostaProrrogacaoRecuperacao.count({ where: { disponibilizacaoId: p.disponibilizacaoId, versao: { gt: p.versao } } })) throw new ErroRegra("Existe proposta mais recente.");
        const vigente = await prazoRecuperacaoVigente(tx, p.disponibilizacaoId);
        if (vigente.getTime() !== p.prazoAnterior.getTime() || p.novoPrazo <= vigente || p.novoPrazo <= new Date()) throw new ErroRegra("O prazo mudou ou o novo limite já venceu.");
      }
      const decisao = await tx.decisaoProrrogacaoRecuperacao.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovada, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: d.aprovada ? "ProrrogacaoRecuperacaoAprovada" : "ProrrogacaoRecuperacaoRejeitada", agregadoTipo: "Matricula", agregadoId: plano.matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId: decisao.id, motivo: d.motivo, novoPrazo: p.novoPrazo.toISOString() } });
      return { id: decisao.id };
    });
  });
}
