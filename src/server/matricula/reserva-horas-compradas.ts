"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, executarAcao, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { hashPrevia } from "@/server/contratos/previa-estado";

const Entrada = z.object({ compraId: z.string().min(1), encontroId: z.string().min(1), motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();
export async function reservarHorasCompradasParaEncontro(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Entrada.parse(input), hash = hashPrevia(d);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const inicial = await tx.compraHorasAntecipadas.findUnique({ where: { id: d.compraId }, select: { matriculaId: true } });
      if (!inicial) throw new ErroRegra("Compra não encontrada.");
      await bloquearMatriculas(tx, [inicial.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const repetida = await tx.reservaHorasCompradas.findUnique({ where: { autorId_chaveIdempotencia: { autorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave usada para outra reserva.");
        return { id: repetida.id };
      }
      await tx.$queryRaw`SELECT id FROM "CompraHorasAntecipadas" WHERE id = ${d.compraId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${d.encontroId} FOR UPDATE`;
      const compra = await tx.compraHorasAntecipadas.findUniqueOrThrow({ where: { id: d.compraId }, include: { liquidacaoAcerto: true, matricula: { select: { status: true } }, // Q175: consumo estornado devolve os minutos, como a liberação para remarcação.
        reservas: { where: { decisoesLiberacao: { none: { aprovada: true, proposta: { destino: "REMARCACAO" } } }, NOT: { consumo: { estorno: { isNot: null } } } } } } });
      if (compra.liquidacaoAcerto) throw new ErroRegra("Compra liquidada no encerramento não permite nova reserva.");
      const e = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId } });
      if (compra.matricula.status !== "ATIVA" || !e || e.finalidade !== "AULA" || e.matriculaId !== compra.matriculaId || e.status !== "PREVISTO" || e.inicio <= new Date()) throw new ErroRegra("Exige matrícula ativa e encontro particular futuro da mesma contratação.");
      const minutos = (e.fim.getTime() - e.inicio.getTime()) / 60000;
      if (!Number.isInteger(minutos) || minutos <= 0 || compra.reservas.reduce((s, r) => s + r.minutos, 0) + minutos > compra.minutosComprados) throw new ErroRegra("Saldo de horas insuficiente ou duração inválida.");
      if (await tx.reservaHorasCompradas.count({ where: { encontroId: e.id } })) throw new ErroRegra("O encontro já tem horas reservadas.");
      const r = await tx.reservaHorasCompradas.create({ data: { ...d, autorId: autor.id, entradaHash: hash, minutos, inicio: e.inicio, fim: e.fim } });
      await registrarEvento(tx, { tipo: "HorasCompradasReservadas", agregadoTipo: "Matricula", agregadoId: compra.matriculaId, autorId: autor.id, payload: { reservaId: r.id, compraId: compra.id, encontroId: e.id, minutos } });
      return { id: r.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}
