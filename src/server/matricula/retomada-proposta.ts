"use server";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { PAPEIS_PAUSA } from "./pausa-estado";
import { APROVADORES_PAUSA, estadoHashPausa, exigirUsuarioPausa, hashPausa } from "./pausa-integridade";
import { carregarPreviaRetomadaTx } from "./retomada-estado";
import { PreviaRetomadaMatriculasSchema, SolicitarRetomadaMatriculasSchema, type SolicitarRetomadaMatriculasInput } from "./retomada-schema";
import { DecidirPausaMatriculasSchema, type DecidirPausaMatriculasInput } from "./pausa-schema";

export async function solicitarRetomadaMatriculas(alunoId: string, input: SolicitarRetomadaMatriculasInput) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_PAUSA);
    const dados = SolicitarRetomadaMatriculasSchema.parse(input);
    const entrada = { retorno: dados.retorno, matriculas: [...dados.matriculas].sort((a, b) => a.matriculaId.localeCompare(b.matriculaId)) };
    const ids = entrada.matriculas.map((m) => m.matriculaId);
    const entradaHash = hashPausa({ alunoId, entrada, motivo: dados.motivo });
    return prisma.$transaction(async (tx) => {
      const snapshot = await carregarPreviaRetomadaTx(tx, alunoId, entrada, autor.id);
      const existente = await tx.propostaRetomadaMatriculas.findUnique({ where: { solicitanteId_chaveIdempotencia: { solicitanteId: autor.id, chaveIdempotencia: dados.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave já usada com outra seleção ou condição.");
        return { propostaId: existente.id, status: existente.status };
      }
      if (await tx.itemPropostaRetomadaMatriculas.findFirst({ where: { matriculaId: { in: ids }, proposta: { status: { in: ["PENDENTE", "APROVADA"] } } } }))
        throw new ErroRegra("Já existe proposta de retomada aberta para a seleção.");
      const p = await tx.propostaRetomadaMatriculas.create({ data: {
        alunoId, solicitanteId: autor.id, chaveIdempotencia: dados.chaveIdempotencia, entradaHash,
        estadoHash: await estadoHashPausa(tx, ids), motivo: dados.motivo, entrada, snapshot,
      } });
      await tx.itemPropostaRetomadaMatriculas.createMany({ data: ids.map((matriculaId) => ({ propostaId: p.id, matriculaId, alunoId })) });
      await registrarEvento(tx, { agregadoTipo: "Aluno", agregadoId: alunoId, tipo: "RetomadaMatriculasSolicitada", autorId: autor.id,
        payload: { propostaId: p.id, matriculaIds: ids, retorno: entrada.retorno, motivo: dados.motivo } });
      await tx.$executeRaw`SET CONSTRAINTS exigir_evento_transicao_retomada_matriculas IMMEDIATE`;
      return { propostaId: p.id, status: p.status };
    });
  });
}

/** Decisão persistida; não aplica a retomada até integrar os consumidores por contrato. */
export async function decidirRetomadaMatriculas(id: string, input: DecidirPausaMatriculasInput) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...APROVADORES_PAUSA);
    const dados = DecidirPausaMatriculasSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PropostaRetomadaMatriculas" WHERE id = ${id} FOR UPDATE`;
      const p = await tx.propostaRetomadaMatriculas.findUnique({ where: { id }, include: { itens: { orderBy: { matriculaId: "asc" } } } });
      if (!p) throw new ErroRegra("Proposta não encontrada.");
      if (autor.id === p.solicitanteId) throw new ErroRegra("Quem solicita não pode decidir a própria proposta.");
      await exigirUsuarioPausa(tx, autor.id, APROVADORES_PAUSA);
      const status = dados.aprovar ? "APROVADA" : "REJEITADA";
      if (p.status === status && p.decisorId === autor.id && p.motivoDecisao === dados.motivo) return { propostaId: p.id, status };
      if (p.status !== "PENDENTE" && !(p.status === "APROVADA" && !dados.aprovar)) throw new ErroRegra("Proposta já decidida ou aplicada.");
      if (dados.aprovar) {
        const entrada = PreviaRetomadaMatriculasSchema.parse(p.entrada);
        const ids = p.itens.map((i) => i.matriculaId);
        if (hashPausa({ alunoId: p.alunoId, entrada, motivo: p.motivo }) !== p.entradaHash ||
            hashPausa(entrada.matriculas.map((m) => m.matriculaId)) !== hashPausa(ids)) throw new ErroRegra("A seleção ou as condições da proposta mudaram.");
        const previa = await carregarPreviaRetomadaTx(tx, p.alunoId, entrada, autor.id);
        await exigirUsuarioPausa(tx, p.solicitanteId, PAPEIS_PAUSA);
        await exigirUsuarioPausa(tx, autor.id, APROVADORES_PAUSA);
        // Comparação estrutural normalizada: JSONB não preserva a ordem das chaves.
        if (await estadoHashPausa(tx, ids) !== p.estadoHash || !isDeepStrictEqual(p.snapshot, previa)) throw new ErroRegra("Os impactos mudaram. Prepare uma nova conferência.");
        if (previa.matriculas.some((m) => m.pendencias.length)) throw new ErroRegra("Há pendências que impedem aprovar a retomada.");
      }
      await tx.propostaRetomadaMatriculas.update({ where: { id }, data: { status, decisorId: autor.id, motivoDecisao: dados.motivo, decididoEm: new Date() } });
      await registrarEvento(tx, { agregadoTipo: "Aluno", agregadoId: p.alunoId, tipo: "RetomadaMatriculasDecidida", autorId: autor.id,
        payload: { propostaId: id, statusAnterior: p.status, status, motivo: dados.motivo } });
      await tx.$executeRaw`SET CONSTRAINTS exigir_evento_transicao_retomada_matriculas IMMEDIATE`;
      return { propostaId: id, status };
    });
  });
}
