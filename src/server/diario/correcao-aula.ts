"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarCorrecaoAulaTx } from "./correcao-aula-tx";
import { hashCorrecaoAula, prepararSnapshotCorrecaoAula, propostaCorrecaoAulaSchema } from "./correcao-aula-schema";
import { carregarImpactosCorrecaoAulaTx } from "./correcao-aula-impactos-tx";

export async function revisarCorrecaoAula(input: { encontroId: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ encontroId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(tx => carregarCorrecaoAulaTx(tx, usuario.id, d.encontroId));
  });
}

/** Histórico da própria aula, inclusive após o fim do vínculo docente. */
export async function consultarHistoricoCorrecaoAula(input: { encontroId: string; antesDaVersao?: number }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ encontroId: z.string().min(1), antesDaVersao: z.number().int().positive().safe().optional() }).strict().parse(input);
    return prisma.$transaction(tx => carregarCorrecaoAulaTx(tx, usuario.id, d.encontroId, { somenteLeitura: true, antesDaVersao: d.antesDaVersao }));
  });
}

/** Conferência institucional das dependências; não publica a correção. */
export async function revisarImpactosCorrecaoAula(input: { propostaId: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(tx => carregarImpactosCorrecaoAulaTx(tx, usuario.id, d.propostaId));
  });
}

/** Rejeição terminal da proposta; não altera os registros acadêmicos originais. */
export async function rejeitarCorrecaoAula(input: { propostaId: string; propostaHash: string; motivo: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1), propostaHash: z.string().regex(/^[a-f0-9]{64}$/),
      motivo: z.string().trim().min(5).max(3000) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE`;
      const atual = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const proposta = await tx.propostaCorrecaoAula.findUnique({ where: { id: d.propostaId }, include: { rejeicao: true, aprovacao: true } });
      if (!proposta) throw new ErroRegra("Proposta de correção não encontrada.");
      if (proposta.aprovacao) throw new ErroRegra("Uma correção publicada não pode ser rejeitada. Prepare outra correção quando necessário.");
      if (proposta.autorId === usuario.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a proposta, mesmo com acúmulo de papéis.");
      if (proposta.entradaHash !== d.propostaHash) throw new ErroRegra("A proposta não corresponde à versão conferida. Recarregue o histórico.");
      if (proposta.rejeicao) {
        if (proposta.rejeicao.decisorId !== usuario.id || proposta.rejeicao.motivo !== d.motivo) throw new ErroRegra("A proposta já possui uma rejeição registrada.");
        return { id: proposta.rejeicao.id, propostaId: proposta.id };
      }
      const ultima = await tx.propostaCorrecaoAula.findFirst({ where: { encontroId: proposta.encontroId }, orderBy: { versao: "desc" }, select: { id: true } });
      if (ultima?.id !== proposta.id) throw new ErroRegra("Existe uma proposta mais recente. Confira a versão atual antes de decidir.");
      const rejeicao = await tx.rejeicaoCorrecaoAula.create({ data: { propostaId: proposta.id, propostaHash: d.propostaHash,
        decisorId: usuario.id, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: "CorrecaoAulaRejeitada", agregadoTipo: "EncontroAgenda", agregadoId: proposta.encontroId,
        autorId: usuario.id, payload: { propostaId: proposta.id, rejeicaoId: rejeicao.id, versao: proposta.versao, motivo: d.motivo } });
      return { id: rejeicao.id, propostaId: proposta.id };
    });
  });
}

/** Publica a projeção conferida, sem reescrever o diário ou seus registros originais. */
export async function aprovarCorrecaoAula(input: { propostaId: string; propostaHash: string; impactosHash: string; motivo: string; confirmarPreservacaoReposicoes?: boolean; revisaoFinanceiraDecisaoId?: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = z.object({
      propostaId: z.string().min(1),
      propostaHash: z.string().regex(/^[a-f0-9]{64}$/),
      impactosHash: z.string().regex(/^[a-f0-9]{64}$/),
      motivo: z.string().trim().min(5).max(3000),
      confirmarPreservacaoReposicoes: z.boolean().default(false),
      revisaoFinanceiraDecisaoId: z.string().min(1).optional(),
    }).strict().parse(input);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE`;
      const atual = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();

      const proposta = await tx.propostaCorrecaoAula.findUnique({ where: { id: d.propostaId }, include: { rejeicao: true, aprovacao: true } });
      if (!proposta) throw new ErroRegra("Proposta de correção não encontrada.");
      if (proposta.aprovacao) {
        const preservacao = z.object({ preservacaoReposicoesConcluidas: z.array(z.string()).optional(), continuidadeReposicoesAutorizadas: z.array(z.string()).optional() }).passthrough().parse(proposta.aprovacao.impactos);
        if (proposta.aprovacao.decisorId !== usuario.id || proposta.aprovacao.propostaHash !== d.propostaHash
          || proposta.aprovacao.impactosHash !== d.impactosHash || proposta.aprovacao.motivo !== d.motivo
          || proposta.aprovacao.revisaoFinanceiraDecisaoId !== (d.revisaoFinanceiraDecisaoId ?? null)
          || !!(preservacao.preservacaoReposicoesConcluidas?.length || preservacao.continuidadeReposicoesAutorizadas?.length) !== d.confirmarPreservacaoReposicoes) {
          throw new ErroRegra("A proposta já possui uma aprovação registrada.");
        }
        return { id: proposta.aprovacao.id, propostaId: proposta.id };
      }
      if (proposta.rejeicao) throw new ErroRegra("Uma proposta rejeitada não pode ser publicada. Prepare outra correção quando necessário.");
      if (proposta.autorId === usuario.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a proposta, mesmo com acúmulo de papéis.");
      if (proposta.entradaHash !== d.propostaHash) throw new ErroRegra("A proposta não corresponde à versão conferida. Recarregue o histórico.");

      const impactos = await carregarImpactosCorrecaoAulaTx(tx, usuario.id, proposta.id);
      if (impactos.propostaHash !== d.propostaHash || impactos.impactosHash !== d.impactosHash) {
        throw new ErroRegra("Os impactos ou a proposta mudaram. Refaça a conferência antes de publicar.");
      }
      if (impactos.financeiro.exigeConferenciaFinanceira && !d.revisaoFinanceiraDecisaoId) throw new ErroRegra("A correção possui dependências financeiras e exige revisão financeira aprovada antes da publicação.");
      if (!impactos.financeiro.exigeConferenciaFinanceira && d.revisaoFinanceiraDecisaoId) throw new ErroRegra("A correção atual não possui dependência financeira para vincular à revisão.");
      const afetadas = [...new Set(impactos.comparacao.registros.flatMap(registro => registro.reposicoesParaConferencia.map(r => r.id)))].sort();
      if (afetadas.some(id => !impactos.reposicoesPreservaveisIds.includes(id) && !impactos.reposicoesContinuaveisIds.includes(id))) {
        throw new ErroRegra("A correção altera participação com reposições pendentes de conferência. A publicação depende da resolução dessas dependências.");
      }
      if (afetadas.length > 0 && !d.confirmarPreservacaoReposicoes) throw new ErroRegra("Confirme explicitamente a preservação das reposições e de seu histórico antes de publicar.");
      if (!afetadas.length && d.confirmarPreservacaoReposicoes) throw new ErroRegra("A conferência não identifica reposições afetadas para preservar.");
      const preservadas = afetadas.filter(id => impactos.reposicoesPreservaveisIds.includes(id));
      const continuadas = afetadas.filter(id => impactos.reposicoesContinuaveisIds.includes(id));

      const { impactosHash, ...snapshotImpactos } = impactos;
      const aprovacao = await tx.aprovacaoCorrecaoAula.create({ data: {
        propostaId: proposta.id,
        decisorId: usuario.id,
        motivo: d.motivo,
        propostaHash: d.propostaHash,
        impactosHash,
        revisaoFinanceiraDecisaoId: d.revisaoFinanceiraDecisaoId,
        impactos: { ...snapshotImpactos, ...(preservadas.length ? { preservacaoReposicoesConcluidas: preservadas } : {}),
          ...(continuadas.length ? { continuidadeReposicoesAutorizadas: continuadas } : {}) },
      } });
      await registrarEvento(tx, { tipo: "CorrecaoAulaAprovada", agregadoTipo: "EncontroAgenda", agregadoId: proposta.encontroId,
        autorId: usuario.id, payload: { propostaId: proposta.id, aprovacaoId: aprovacao.id, versao: proposta.versao,
          propostaHash: d.propostaHash, impactosHash, revisaoFinanceiraDecisaoId: d.revisaoFinanceiraDecisaoId ?? null, preservacaoReposicoesConcluidas: preservadas, continuidadeReposicoesAutorizadas: continuadas } });
      return { id: aprovacao.id, propostaId: proposta.id };
    });
  });
}

/** Preparação Q23: nunca altera o diário nem publica um resultado. */
export async function proporCorrecaoAula(input: z.input<typeof propostaCorrecaoAulaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const d = propostaCorrecaoAulaSchema.parse(input);
    const entradaHash = hashCorrecaoAula(d);
    return prisma.$transaction(async tx => {
      const atual = await carregarCorrecaoAulaTx(tx, usuario.id, d.encontroId);
      const existente = await tx.propostaCorrecaoAula.findUnique({ where: { autorId_chaveIdempotencia: { autorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Esta chave já identifica outra proposta de correção.");
        return { id: existente.id, versao: existente.versao };
      }
      if (d.estadoHash !== atual.estadoHash || d.versaoEsperada !== atual.versaoAtual) {
        throw new ErroRegra("A aula ou suas propostas mudaram. Recarregue a conferência antes de propor a correção.");
      }
      let novo;
      try { novo = prepararSnapshotCorrecaoAula(atual.snapshot, d.alteracao); }
      catch (erro) { throw new ErroRegra(erro instanceof Error ? erro.message : "Confira os registros da correção."); }
      if (hashCorrecaoAula(novo) === hashCorrecaoAula(atual.snapshot)) throw new ErroRegra("A proposta precisa identificar uma alteração na aula.");
      const proposta = await tx.propostaCorrecaoAula.create({ data: {
        encontroId: d.encontroId, diarioId: atual.snapshot.diarioId, autorId: usuario.id, versao: atual.versaoAtual + 1,
        snapshotAnterior: atual.snapshot, snapshotNovo: novo, estadoHash: atual.estadoHash,
        motivo: d.motivo, evidencia: d.evidencia, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
      } });
      await registrarEvento(tx, { tipo: "CorrecaoAulaProposta", agregadoTipo: "EncontroAgenda", agregadoId: d.encontroId, autorId: usuario.id,
        payload: { propostaId: proposta.id, versao: proposta.versao, estadoHash: atual.estadoHash, motivo: d.motivo } });
      return { id: proposta.id, versao: proposta.versao };
    });
  });
}
