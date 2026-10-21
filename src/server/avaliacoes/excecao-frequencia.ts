"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarEstadoFechamentoTx, hashFechamento } from "./fechamento-estado-tx";

const id = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const motivo = z.string().trim().min(5).max(3000);
const propostaSchema = z.object({ alocacaoId: id, fonteHash: hash, versaoEsperada: z.number().int().min(0).safe(),
  motivo, evidencias: z.string().trim().min(5).max(10000), chaveIdempotencia: id }).strict();
const decisaoSchema = z.object({ propostaId: id, fonteHash: hash, aprovada: z.boolean(), motivo }).strict();

export async function proporExcecaoFrequencia(entrada: z.input<typeof propostaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = propostaSchema.parse(entrada);
    return prisma.$transaction(async tx => {
      const estado = await carregarEstadoFechamentoTx(tx, usuario.id, d.alocacaoId);
      const entradaHash = hashFechamento(d);
      const anterior = await tx.propostaExcecaoFrequencia.findUnique({ where: { autorId_chaveIdempotencia: { autorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outra proposta de exceção.");
        return { id: anterior.id, versao: anterior.versao };
      }
      const frequencia = estado.snapshot.frequencia;
      if (frequencia.fonteHash !== d.fonteHash) throw new ErroRegra("A frequência mudou. Atualize a conferência antes de propor a exceção.");
      if (frequencia.atendeMinimo !== false || frequencia.pendencias.length || frequencia.pendenciasHistoricas.length) throw new ErroRegra("A exceção exige frequência apurada abaixo do mínimo e sem registros pendentes.");
      if ((estado.snapshot.excecaoFrequencia?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe proposta mais recente. Atualize a conferência.");
      const proposta = await tx.propostaExcecaoFrequencia.create({ data: {
        ...estado.contexto, fonteHash: d.fonteHash, versao: d.versaoEsperada + 1,
        frequencia: JSON.parse(JSON.stringify(frequencia)) as Prisma.InputJsonValue,
        motivo: d.motivo, evidencias: d.evidencias, autorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
      } });
      await registrarEvento(tx, { tipo: "ExcecaoFrequenciaProposta", agregadoTipo: "Matricula", agregadoId: proposta.matriculaId, autorId: usuario.id,
        payload: { propostaId: proposta.id, nivelId: proposta.nivelId, fonteHash: proposta.fonteHash, versao: proposta.versao } });
      return { id: proposta.id, versao: proposta.versao };
    });
  });
}

export async function decidirExcecaoFrequencia(entrada: z.input<typeof decisaoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = decisaoSchema.parse(entrada);
    return prisma.$transaction(async tx => {
      const origem = await tx.propostaExcecaoFrequencia.findUnique({ where: { id: d.propostaId }, select: { alocacaoReferenciaId: true } });
      if (!origem) throw new ErroRegra("Proposta de exceção não encontrada.");
      await bloquearLancamento(tx, origem.alocacaoReferenciaId);
      await conferirGestorAvaliacao(tx, usuario.id);
      const proposta = await tx.propostaExcecaoFrequencia.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
      if (proposta.autorId === usuario.id) throw new ErroRegra("Outra pessoa autorizada precisa decidir a exceção de frequência.");
      if (proposta.fonteHash !== d.fonteHash) throw new ErroRegra("Confira a fonte de frequência desta proposta.");
      if (proposta.decisao) {
        const decisao = proposta.decisao;
        if (decisao.decisorId !== usuario.id || decisao.aprovada !== d.aprovada || decisao.motivo !== d.motivo) throw new ErroRegra("Esta proposta já foi decidida.");
        return { id: decisao.id, aprovada: decisao.aprovada };
      }
      if (d.aprovada) {
        await conferirGestorAvaliacao(tx, proposta.autorId);
        const estado = await carregarEstadoFechamentoTx(tx, usuario.id, proposta.alocacaoReferenciaId);
        const frequencia = estado.snapshot.frequencia;
        if (estado.snapshot.excecaoFrequencia?.id !== proposta.id) throw new ErroRegra("A proposta foi substituída por uma versão mais recente.");
        if (estado.contexto.regraId !== proposta.regraId || frequencia.fonteHash !== proposta.fonteHash
          || frequencia.atendeMinimo !== false || frequencia.pendencias.length || frequencia.pendenciasHistoricas.length) throw new ErroRegra("A frequência ou a regra mudou. Prepare uma nova proposta antes de aprovar.");
      }
      const decisao = await tx.decisaoExcecaoFrequencia.create({ data: { propostaId: proposta.id, decisorId: usuario.id, aprovada: d.aprovada, motivo: d.motivo } });
      await registrarEvento(tx, { tipo: d.aprovada ? "ExcecaoFrequenciaAprovada" : "ExcecaoFrequenciaRejeitada", agregadoTipo: "Matricula", agregadoId: proposta.matriculaId, autorId: usuario.id,
        payload: { propostaId: proposta.id, decisaoId: decisao.id, fonteHash: proposta.fonteHash } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}
