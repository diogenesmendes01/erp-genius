"use server";
import { isDeepStrictEqual } from "node:util";

import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarPreviaPausaTx, PAPEIS_PAUSA } from "./pausa-estado";
import { SolicitarPausaMatriculasSchema, DecidirPausaMatriculasSchema, type SolicitarPausaMatriculasInput, type DecidirPausaMatriculasInput } from "./pausa-schema";

import { APROVADORES_PAUSA as APROVADORES, hashPausa as hash, estadoHashPausa as estadoHash, exigirUsuarioPausa as exigirUsuario } from "./pausa-integridade";

/** Persiste a seleção e os impactos; nenhuma matrícula ou cobrança é alterada. */
export async function solicitarPausaMatriculas(alunoId: string, input: SolicitarPausaMatriculasInput) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_PAUSA);
    const dados = SolicitarPausaMatriculasSchema.parse(input);
    const ids = [...dados.matriculaIds].sort();
    const entradaHash = hash({ alunoId, ids, motivo: dados.motivo, dataEfetiva: dados.dataEfetiva });
    return prisma.$transaction(async (tx) => {
      const previa = await carregarPreviaPausaTx(tx, alunoId, dados, autor.id);
      const existente = await tx.propostaPausaMatriculas.findUnique({ where: { solicitanteId_chaveIdempotencia: { solicitanteId: autor.id, chaveIdempotencia: dados.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave de repetição já utilizada com outra seleção ou condição.");
        return { propostaId: existente.id, status: existente.status };
      }
      const aberta = await tx.itemPropostaPausa.findFirst({ where: { matriculaId: { in: ids }, proposta: { status: { in: ["PENDENTE", "APROVADA"] } } } });
      if (aberta) throw new ErroRegra("Há proposta de pausa em aberto para uma das matrículas selecionadas.");
      const p = await tx.propostaPausaMatriculas.create({ data: {
        alunoId, solicitanteId: autor.id, chaveIdempotencia: dados.chaveIdempotencia, entradaHash,
        estadoHash: await estadoHash(tx, ids), dataEfetiva: new Date(`${dados.dataEfetiva}T00:00:00Z`),
        motivo: dados.motivo, snapshot: previa,
      } });
      await tx.itemPropostaPausa.createMany({ data: ids.map((matriculaId) => ({ propostaId: p.id, matriculaId, alunoId })) });
      await registrarEvento(tx, { agregadoTipo: "Aluno", agregadoId: alunoId, tipo: "PausaMatriculasSolicitada", autorId: autor.id,
        payload: { propostaId: p.id, matriculaIds: ids, dataEfetiva: dados.dataEfetiva, motivo: dados.motivo } });
      return { propostaId: p.id, status: p.status };
    });
  });
}

/** Aprovação da proposta permanece distinta da execução; o executor deverá revalidar o estado. */
export async function decidirPropostaPausaMatriculas(id: string, input: DecidirPausaMatriculasInput) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...APROVADORES);
    const dados = DecidirPausaMatriculasSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PropostaPausaMatriculas" WHERE id = ${id} FOR UPDATE`;
      const p = await tx.propostaPausaMatriculas.findUnique({ where: { id }, include: { itens: { orderBy: { matriculaId: "asc" } } } });
      if (!p) throw new ErroRegra("Proposta não encontrada.");
      if (p.solicitanteId === autor.id) throw new ErroRegra("Quem solicita não pode decidir a própria proposta.");
      await exigirUsuario(tx, autor.id, APROVADORES);
      const status = dados.aprovar ? "APROVADA" : "REJEITADA";
      if (p.status === status && p.decisorId === autor.id && p.motivoDecisao === dados.motivo) return { propostaId: p.id, status: p.status };
      // Aprovação ainda não aplicada pode ser retirada com decisão independente e motivo.
      // Isso libera uma nova conferência se o estado mudou; nunca desfaz uma pausa aplicada.
      if (p.status !== "PENDENTE" && !(p.status === "APROVADA" && !dados.aprovar)) throw new ErroRegra("A proposta já foi decidida ou aplicada.");
      if (dados.aprovar) {
        const ids = p.itens.map((i) => i.matriculaId);
        const dataEfetiva = p.dataEfetiva.toISOString().slice(0, 10);
        const previa = await carregarPreviaPausaTx(tx, p.alunoId, { matriculaIds: ids, dataEfetiva }, autor.id);
        await exigirUsuario(tx, p.solicitanteId, PAPEIS_PAUSA);
        await exigirUsuario(tx, autor.id, APROVADORES);
        if (hash({ alunoId: p.alunoId, ids, motivo: p.motivo, dataEfetiva }) !== p.entradaHash || await estadoHash(tx, ids) !== p.estadoHash || !isDeepStrictEqual(p.snapshot, previa))
          throw new ErroRegra("A seleção ou seus impactos mudaram. Rejeite a proposta e prepare uma nova conferência.");
        if (previa.matriculas.some((m) => m.pendencias.length > 0)) throw new ErroRegra("Há pendências de cobertura, vínculo ou recebimento que precisam ser conferidas antes de aprovar.");
      }
      await tx.propostaPausaMatriculas.update({ where: { id }, data: { status, decisorId: autor.id, motivoDecisao: dados.motivo, decididoEm: new Date() } });
      await registrarEvento(tx, { agregadoTipo: "Aluno", agregadoId: p.alunoId, tipo: "PropostaPausaMatriculasDecidida", autorId: autor.id,
        payload: { propostaId: p.id, statusAnterior: p.status, status, motivo: dados.motivo } });
      return { propostaId: p.id, status };
    });
  });
}
