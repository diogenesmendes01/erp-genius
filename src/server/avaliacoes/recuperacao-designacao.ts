"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";

export async function designarProfessorRecuperacao(input: { itemReservaId: string; professorId: string | null; versaoEsperada: number; motivo: string; chaveIdempotencia: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const id = z.string().min(1).max(100);
    const d = z.object({ itemReservaId: id, professorId: id.nullable(), versaoEsperada: z.number().int().min(0).max(2147483646), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
      if (!ref) throw new ErroRegra("Tentativa não encontrada.");
      const a = await bloquearLancamento(tx, ref.reserva.proposta.alocacaoId);
      await conferirGestorAvaliacao(tx, u.id);
      const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
      const repetida = await tx.designacaoRecuperacao.findUnique({ where: { gestorId_chaveIdempotencia: { gestorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra designação.");
        return { id: repetida.id, versao: repetida.versao };
      }
      if (await tx.propostaAgendaRecuperacao.count({ where: { itemReservaId: d.itemReservaId, encontro: { status: "PREVISTO" } } })) throw new ErroRegra("Tentativa agendada exige revisão específica da agenda aprovada antes de trocar o avaliador.");
      const item = await tx.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: d.itemReservaId }, include: { realizacao: { include: { notas: { where: { decisao: { aprovada: true } } } } }, reserva: { include: { cancelamento: true } } } });
      if (item.realizacao?.notas.length || (item.reserva.cancelamento && !item.realizacao)) throw new ErroRegra("Tentativa sem pendência para designar.");
      if (d.professorId) {
        await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${d.professorId} FOR SHARE`;
        const professor = await tx.usuario.findUnique({ where: { id: d.professorId }, select: { ativo: true, papeis: true } });
        if (!professor?.ativo || !professor.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Selecione um professor ativo.");
      }
      const ultima = await tx.designacaoRecuperacao.findFirst({ where: { itemReservaId: item.id }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("A designação mudou. Atualize a consulta.");
      if ((ultima?.professorId ?? null) === d.professorId) throw new ErroRegra("A designação já corresponde à escolha.");
      const designacao = await tx.designacaoRecuperacao.create({ data: { itemReservaId: item.id, professorId: d.professorId, gestorId: u.id, versao: d.versaoEsperada + 1, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: d.professorId ? "ProfessorRecuperacaoDesignado" : "DesignacaoRecuperacaoRevogada", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { designacaoId: designacao.id, itemReservaId: item.id, professorId: d.professorId, versao: designacao.versao, motivo: d.motivo } });
      return { id: designacao.id, versao: designacao.versao };
    });
  });
}
