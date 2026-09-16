"use server";

import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { SolicitarEncerramentoSchema, type SolicitarEncerramentoInput } from "./encerramento-solicitacao-schema";

/** Registra o pedido do aluno; não aprova retroatividade, acerto ou alteração da matrícula. */
export async function solicitarEncerramentoMatriculas(input: SolicitarEncerramentoInput) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = SolicitarEncerramentoSchema.parse(input);
    const ids = [...d.matriculaIds].sort();
    const hash = createHash("sha256").update(JSON.stringify({ ...d, matriculaIds: ids })).digest("hex");
    return prisma.$transaction(async (tx) => {
      // A mesma chave pode chegar simultaneamente com seleções diferentes.
      const trava = `encerramento:${autor.id}:${d.chaveIdempotencia}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${trava}, 0))`;
      const usuario = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!usuario?.ativo || !usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA)) throw new ErroPermissao();
      const existente = await tx.solicitacaoEncerramentoMatriculas.findUnique({ where: { registradorId_chaveIdempotencia: { registradorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== hash) throw new ErroRegra("Esta chave já foi utilizada com outro pedido.");
        return { solicitacaoId: existente.id, status: existente.status };
      }
      await bloquearMatriculas(tx, ids);
      const matriculas = await tx.matricula.findMany({ where: { id: { in: ids }, alunoId: d.alunoId }, select: { id: true, status: true } });
      if (matriculas.length !== ids.length) throw new ErroRegra("Todas as matrículas devem pertencer ao aluno informado.");
      if (matriculas.some((m) => !["ATIVA", "PAUSADA"].includes(m.status))) throw new ErroRegra("Selecione somente matrículas ativas ou pausadas. Preparações seguem o fluxo de desistência.");
      if (await tx.itemSolicitacaoEncerramento.count({ where: { matriculaId: { in: ids }, solicitacao: { status: { in: ["ABERTA", "EM_ACERTO"] } } } })) throw new ErroRegra("Uma das matrículas já tem pedido de encerramento em aberto.");
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
      const fuso = FusoInstitucionalSchema.safeParse(config?.fusoInstitucional);
      if (!fuso.success) throw new ErroRegra("Configure o fuso institucional antes de registrar o pedido.");
      const agora = new Date();
      const dataPedido = dataCivilInstitucional(agora, fuso.data);
      if (d.dataSolicitada < dataPedido && (!d.motivoRetroatividade || !d.evidenciaRetroatividade)) throw new ErroRegra("Data retroativa exige motivo e evidência para aprovação explícita no acerto.");
      const p = await tx.solicitacaoEncerramentoMatriculas.create({ data: {
        alunoId: d.alunoId, registradorId: autor.id, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash,
        motivo: d.motivo, evidenciaPedido: d.evidenciaPedido,
        dataPedido: new Date(`${dataPedido}T00:00:00Z`), dataSolicitada: new Date(`${d.dataSolicitada}T00:00:00Z`),
        criadoEm: agora, fusoRegistro: fuso.data, motivoRetroatividade: d.motivoRetroatividade, evidenciaRetroatividade: d.evidenciaRetroatividade,
      } });
      await tx.itemSolicitacaoEncerramento.createMany({ data: ids.map((matriculaId) => ({ solicitacaoId: p.id, alunoId: d.alunoId, matriculaId })) });
      for (const matriculaId of ids) await registrarEvento(tx, { tipo: "EncerramentoMatriculaSolicitado", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: autor.id,
        payload: { solicitacaoId: p.id, dataSolicitada: d.dataSolicitada, dataPedido, retroatividadeSolicitada: d.dataSolicitada < dataPedido } });
      return { solicitacaoId: p.id, status: p.status };
    });
  });
}
