"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { estadoExtraRecuperacaoTx, EstadoExtraSchema } from "./extra-recuperacao-tx";
import { HABILIDADES } from "./calculo";
import { identificarMatriculaAvaliacao } from "./identificacao";

const id = z.string().min(1).max(100), sha = z.string().regex(/^[a-f0-9]{64}$/);
const hash = (d: unknown) => createHash("sha256").update(JSON.stringify(d)).digest("hex");
const propostaSchema = z.object({ alocacaoId: id, habilidade: z.enum(HABILIDADES), quantidade: z.number().int().min(1).max(2147483647),
  motivo: z.string().trim().min(5).max(2000), evidencias: z.string().trim().min(5).max(4000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function proporExtraRecuperacao(input: z.input<typeof propostaSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO), d = propostaSchema.parse(input);
    return prisma.$transaction(async tx => {
      await carregarConsolidadoAvaliacoesTx(tx, u.id, d.alocacaoId, "BASE_PLANO");
      const repetida = await tx.propostaExtraRecuperacao.findUnique({ where: { autorId_chaveIdempotencia: { autorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash(d)) throw new ErroRegra("Chave utilizada com outra proposta de oportunidade extra.");
        return { id: repetida.id };
      }
      const snapshot = await estadoExtraRecuperacaoTx(tx, d.alocacaoId, d.habilidade);
      if (!snapshot.ativa || snapshot.statusMatricula !== "ATIVA") throw new ErroRegra("Confira o vínculo ativo antes de solicitar oportunidade extra.");
      if (snapshot.ocupadas < snapshot.limiteBase + snapshot.extrasAprovados) throw new ErroRegra("Ainda há oportunidades disponíveis para essa habilidade.");
      const p = await tx.propostaExtraRecuperacao.create({ data: { ...d, matriculaId: snapshot.matriculaId, nivelId: snapshot.nivelId,
        autorId: u.id, snapshot, estadoHash: hash(snapshot), entradaHash: hash(d) } });
      await registrarEvento(tx, { tipo: "OportunidadeExtraRecuperacaoProposta", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id,
        payload: { propostaId: p.id, nivelId: p.nivelId, habilidade: p.habilidade, quantidade: p.quantidade } });
      return { id: p.id };
    });
  });
}

const decisaoSchema = z.object({ propostaId: id, entradaHash: sha, aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();
export async function decidirExtraRecuperacao(input: z.input<typeof decisaoSchema>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO), d = decisaoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaExtraRecuperacao.findUnique({ where: { id: d.propostaId }, select: { alocacaoId: true } });
      if (!ref) throw new ErroRegra("Proposta não encontrada.");
      await bloquearLancamento(tx, ref.alocacaoId); await conferirGestorAvaliacao(tx, u.id);
      const p = await tx.propostaExtraRecuperacao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (p.autorId === u.id) throw new ErroRegra("Outra pessoa deve decidir a oportunidade extra.");
      if (p.entradaHash !== d.entradaHash) throw new ErroRegra("Confira a proposta exata antes de decidir.");
      if (p.decisao) {
        if (p.decisao.decisorId === u.id && p.decisao.aprovada === d.aprovada && p.decisao.motivo === d.motivo) return { id: p.decisao.id };
        throw new ErroRegra("A proposta já possui decisão.");
      }
      if (d.aprovada) {
        const atual = await estadoExtraRecuperacaoTx(tx, p.alocacaoId, p.habilidade);
        if (hash(atual) !== p.estadoHash) throw new ErroRegra("O saldo ou vínculo mudou. Prepare nova proposta para conferência.");
      }
      const decisao = await tx.decisaoExtraRecuperacao.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovada, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: d.aprovada ? "OportunidadeExtraRecuperacaoAprovada" : "OportunidadeExtraRecuperacaoRejeitada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: u.id,
        payload: { propostaId: p.id, decisaoId: decisao.id, nivelId: p.nivelId, habilidade: p.habilidade, quantidade: p.quantidade } });
      return { id: decisao.id };
    });
  });
}

export async function consultarExtrasRecuperacao(input: { alocacaoId: string; antesId?: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ alocacaoId: id, antesId: id.optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await carregarConsolidadoAvaliacoesTx(tx, u.id, d.alocacaoId, "BASE_PLANO");
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: u.id }, select: { papeis: true } });
      const gestao = usuario.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR);
      const estados = await Promise.all(HABILIDADES.map(h => estadoExtraRecuperacaoTx(tx, d.alocacaoId, h)));
      const alocacao = await tx.alocacaoTurma.findUniqueOrThrow({ where: { id: d.alocacaoId } });
      const itens = await tx.propostaExtraRecuperacao.findMany({ where: { alocacaoId: d.alocacaoId, ...(d.antesId ? { id: { lt: d.antesId } } : {}) }, orderBy: { id: "desc" }, take: 21,
        select: { id: true, habilidade: true, quantidade: true, motivo: true, evidencias: true, autorId: true, entradaHash: true, estadoHash: true, snapshot: true, criadaEm: true,
          decisao: { select: { aprovada: true, motivo: true, criadaEm: true } } } });
      return { identificacao: await identificarMatriculaAvaliacao(tx, alocacao.matriculaId!, alocacao.turmaId),
        habilidadesSolicitaveis: estados.filter(e => e.ativa && e.statusMatricula === "ATIVA" && e.ocupadas >= e.limiteBase + e.extrasAprovados).map(e => e.habilidade),
        proximoId: itens.length > 20 ? itens[19].id : null, itens: itens.slice(0,20).map(p => ({
        id: p.id, habilidade: p.habilidade, quantidade: p.quantidade, motivo: p.motivo, evidencias: p.evidencias, criadaEm: p.criadaEm,
        base: EstadoExtraSchema.parse(p.snapshot), podeAprovar: gestao && p.autorId !== u.id && !p.decisao && p.estadoHash === hash(estados.find(e => e.habilidade === p.habilidade)),
        decisao: p.decisao, podeDecidir: gestao && p.autorId !== u.id && !p.decisao, entradaHash: gestao && p.autorId !== u.id && !p.decisao ? p.entradaHash : null,
      })) };
    });
  });
}
