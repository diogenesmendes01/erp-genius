"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento } from "@/server/_shared";
import { carregarEstadoFechamentoTx, hashFechamento } from "./fechamento-estado-tx";

const consultaSchema = z.object({ alocacaoId: z.string().trim().min(1).max(100) }).strict();
const confirmacaoSchema = consultaSchema.extend({
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/), versaoEsperada: z.number().int().min(0).safe(),
  motivo: z.string().trim().min(5).max(3000), chaveIdempotencia: z.string().trim().min(1).max(100),
}).strict();

export async function revisarFechamentoAcademico(entrada: z.input<typeof consultaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = consultaSchema.parse(entrada);
    return prisma.$transaction(async tx => {
      const estado = await carregarEstadoFechamentoTx(tx, usuario.id, d.alocacaoId);
      const ultimo = await tx.fechamentoAcademico.findFirst({ where: {
        matriculaId: estado.contexto.matriculaId, nivelId: estado.contexto.nivelId,
      }, orderBy: { versao: "desc" }, select: { id: true, versao: true, estadoHash: true, resultadoSuficiente: true, confirmadoEm: true } });
      return { ...estado, versaoAtual: ultimo?.versao ?? 0, ultimo: ultimo ? {
        ...ultimo, confirmadoEm: ultimo.confirmadoEm.toISOString(), atual: ultimo.estadoHash === estado.estadoHash,
      } : null };
    });
  });
}

export async function confirmarFechamentoAcademico(entrada: z.input<typeof confirmacaoSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = confirmacaoSchema.parse(entrada);
    return prisma.$transaction(async tx => {
      const estado = await carregarEstadoFechamentoTx(tx, usuario.id, d.alocacaoId);
      const entradaHash = hashFechamento(d);
      const repetido = await tx.fechamentoAcademico.findUnique({ where: {
        confirmadoPorId_chaveIdempotencia: { confirmadoPorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia },
      } });
      if (repetido) {
        if (repetido.entradaHash !== entradaHash) throw new ErroRegra("Esta chave já foi utilizada para outro fechamento.");
        return { id: repetido.id, versao: repetido.versao, resultadoSuficiente: repetido.resultadoSuficiente };
      }
      if (estado.estadoHash !== d.estadoHash) throw new ErroRegra("As fontes acadêmicas mudaram. Confira novamente o resultado antes de fechar.");
      if (!estado.elegibilidade.podeFechar) throw new ErroRegra("Resolva as pendências de notas, frequência e decisões antes de confirmar o fechamento.");
      const ultimo = await tx.fechamentoAcademico.findFirst({ where: {
        matriculaId: estado.contexto.matriculaId, nivelId: estado.contexto.nivelId,
      }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultimo?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe um fechamento mais recente. Atualize a conferência.");
      const fechado = await tx.fechamentoAcademico.create({ data: {
        ...estado.contexto, versao: d.versaoEsperada + 1,
        snapshot: JSON.parse(JSON.stringify(estado.snapshot)) as Prisma.InputJsonValue,
        estadoHash: estado.estadoHash, resultadoSuficiente: estado.elegibilidade.podeProgredir,
        motivo: d.motivo, confirmadoPorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia, entradaHash,
      } });
      await registrarEvento(tx, { tipo: "ResultadoAcademicoFechado", agregadoTipo: "Matricula", agregadoId: estado.contexto.matriculaId, autorId: usuario.id,
        payload: { fechamentoId: fechado.id, nivelId: fechado.nivelId, alocacaoReferenciaId: fechado.alocacaoReferenciaId, versao: fechado.versao, resultadoSuficiente: fechado.resultadoSuficiente, estadoHash: fechado.estadoHash } });
      return { id: fechado.id, versao: fechado.versao, resultadoSuficiente: fechado.resultadoSuficiente };
    });
  });
}
